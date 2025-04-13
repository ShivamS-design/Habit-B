import mongoose from 'mongoose';
import crypto from 'crypto';
import AppError from '../utils/appError.js';

const LocalDataSchema = new mongoose.Schema({
  // Core Identification
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true,
    trim: true,
    validate: {
      validator: (v) => v.length >= 8 && v.length <= 64,
      message: 'User ID must be 8-64 characters'
    }
  },
  deviceId: {
    type: String,
    index: true,
    trim: true,
    validate: {
      validator: (v) => !v || (v.length >= 8 && v.length <= 64),
      message: 'Device ID must be 8-64 characters if provided'
    }
  },
  sessionId: {
    type: String,
    index: true,
    validate: {
      validator: (v) => !v || crypto.randomBytes(8).toString('hex').length === v.length,
      message: 'Session ID must be 16 hex characters if provided'
    }
  },

  // Data Storage
  key: {
    type: String,
    required: [true, 'Data key is required'],
    trim: true,
    maxlength: [100, 'Key cannot exceed 100 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Key can only contain alphanumerics, hyphens and underscores']
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Data value is required'],
    validate: {
      validator: function(v) {
        try {
          const str = JSON.stringify(v);
          return str.length <= 1024 * 1024; // 1MB max
        } catch (e) {
          return false;
        }
      },
      message: 'Value must be serializable and cannot exceed 1MB'
    }
  },
  valueHash: {
    type: String,
    immutable: true
  },
  valueType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array', 'binary'],
    required: true
  },
  valueSize: {
    type: Number, // in bytes
    min: 0,
    max: 1024 * 1024 // 1MB
  },

  // Metadata
  namespace: {
    type: String,
    default: 'default',
    index: true,
    trim: true,
    match: [/^[a-z0-9_-]+$/, 'Namespace can only contain lowercase alphanumerics, hyphens and underscores']
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  tags: [{
    type: String,
    maxlength: [30, 'Tags cannot exceed 30 characters'],
    match: [/^[a-z0-9-]+$/, 'Tags can only contain lowercase alphanumerics and hyphens']
  }],

  // Security
  encryption: {
    enabled: {
      type: Boolean,
      default: false
    },
    algorithm: {
      type: String,
      enum: ['aes-256-cbc', 'aes-128-cbc'],
      default: 'aes-256-cbc'
    },
    iv: {
      type: String,
      select: false
    },
    keyVersion: {
      type: Number,
      default: 1
    }
  },

  // Lifecycle Management
  ttl: {
    type: Date,
    index: true,
    expires: 0 // Automatic TTL
  },
  lastAccessed: {
    type: Date,
    default: Date.now,
    index: true
  },
  accessCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Synchronization
  syncStatus: {
    type: String,
    enum: ['pending', 'synced', 'conflict', 'local-only'],
    default: 'synced',
    index: true
  },
  lastSynced: {
    type: Date,
    index: true
  },
  syncVersion: {
    type: Number,
    default: 0,
    min: 0
  },
  origin: {
    type: String,
    enum: ['client', 'server', 'migration'],
    required: true
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Hide sensitive fields
      delete ret.encryption;
      delete ret.valueHash;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.encryption;
      delete ret.valueHash;
      return ret;
    }
  }
});

// Compound Indexes
LocalDataSchema.index({ userId: 1, namespace: 1 });
LocalDataSchema.index({ userId: 1, key: 1 }, { unique: true });
LocalDataSchema.index({ namespace: 1, tags: 1 });
LocalDataSchema.index({ syncStatus: 1, lastSynced: -1 });

// Virtual Properties
LocalDataSchema.virtual('isExpired').get(function() {
  return this.ttl && this.ttl < new Date();
});

LocalDataSchema.virtual('isEncrypted').get(function() {
  return this.encryption.enabled && this.encryption.algorithm;
});

LocalDataSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

LocalDataSchema.virtual('needsSync').get(function() {
  return this.syncStatus === 'pending' || 
         (this.syncStatus === 'synced' && 
          this.updatedAt > this.lastSynced);
});

// Pre-save hooks
LocalDataSchema.pre('save', function(next) {
  // Auto-detect value type
  this.valueType = Array.isArray(this.value) ? 'array' : typeof this.value;
  
  // Calculate value size
  try {
    this.valueSize = Buffer.byteLength(JSON.stringify(this.value), 'utf8');
  } catch (e) {
    throw new AppError('Invalid data value: cannot calculate size', 400);
  }

  // Generate content hash
  this.valueHash = crypto.createHash('sha256')
    .update(JSON.stringify(this.value))
    .digest('hex');
  
  // Handle encryption if enabled
  if (this.encryption.enabled && this.isModified('value') && process.env.DATA_ENCRYPTION_KEY) {
    this.encryptValue();
  }

  // Update sync timestamp if modified
  if (this.isModified('value') || this.isModified('encryption')) {
    this.syncStatus = 'pending';
  }

  next();
});

// Instance Methods
LocalDataSchema.methods.encryptValue = function() {
  if (!this.encryption.enabled || !process.env.DATA_ENCRYPTION_KEY) {
    return this;
  }

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.encryption.algorithm, 
      process.env.DATA_ENCRYPTION_KEY, 
      iv
    );
    
    this.value = Buffer.concat([
      cipher.update(JSON.stringify(this.value)),
      cipher.final()
    ]).toString('hex');
    
    this.encryption.iv = iv.toString('hex');
    return this;
  } catch (err) {
    throw new AppError(`Encryption failed: ${err.message}`, 500);
  }
};

LocalDataSchema.methods.decryptValue = function() {
  if (!this.isEncrypted || !this.encryption.iv || !process.env.DATA_ENCRYPTION_KEY) {
    return this.value;
  }

  try {
    const decipher = crypto.createDecipheriv(
      this.encryption.algorithm,
      process.env.DATA_ENCRYPTION_KEY,
      Buffer.from(this.encryption.iv, 'hex')
    );
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(this.value, 'hex')),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString());
  } catch (err) {
    throw new AppError(`Decryption failed: ${err.message}`, 500);
  }
};

LocalDataSchema.methods.setTTL = function(days = 30) {
  this.ttl = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return this;
};

LocalDataSchema.methods.touch = function() {
  this.lastAccessed = new Date();
  this.accessCount += 1;
  return this.save();
};

// Static Methods
LocalDataSchema.statics.findByUserAndKey = async function(userId, key, options = {}) {
  return this.findOne({ userId, key })
    .select(options.select || '-__v')
    .lean(options.lean || false);
};

LocalDataSchema.statics.getAllForUser = async function(userId, namespace = null) {
  const query = { userId };
  if (namespace) query.namespace = namespace;
  
  return this.find(query)
    .sort({ key: 1 })
    .lean();
};

LocalDataSchema.statics.cleanupExpired = async function() {
  return this.deleteMany({ 
    ttl: { $lt: new Date() } 
  });
};

LocalDataSchema.statics.syncUserData = async function(userId, clientData) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const serverData = await this.find({ userId }).session(session);
    const operations = [];
    const now = new Date();
    
    // Process client data
    for (const item of clientData) {
      const existing = serverData.find(d => d.key === item.key);
      
      if (existing) {
        // Conflict resolution (client wins if newer)
        const clientModified = new Date(item.updatedAt);
        const serverModified = existing.updatedAt;
        
        if (clientModified > serverModified) {
          operations.push(
            this.updateOne(
              { _id: existing._id },
              { 
                value: item.value,
                syncStatus: 'synced',
                syncVersion: existing.syncVersion + 1,
                lastSynced: now
              }
            ).session(session)
          );
        }
      } else {
        // New client data
        operations.push(
          this.create([{
            userId,
            key: item.key,
            value: item.value,
            origin: 'client',
            syncStatus: 'synced',
            lastSynced: now
          }], { session })
        );
      }
    }
    
    await Promise.all(operations);
    await session.commitTransaction();
    
    return this.find({ userId })
      .session(session)
      .lean();
  } catch (err) {
    await session.abortTransaction();
    throw new AppError(`Sync failed: ${err.message}`, 500);
  } finally {
    session.endSession();
  }
};

const LocalData = mongoose.model('LocalData', LocalDataSchema);

export default LocalData;
