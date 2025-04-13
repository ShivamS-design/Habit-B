import mongoose from 'mongoose';
import crypto from 'crypto';
import AppError from '../utils/appError.js';

const LocalDataSchema = new mongoose.Schema({
  // Core Identification
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true,
    trim: true
  },
  deviceId: {
    type: String,
    index: true,
    trim: true
  },
  sessionId: {
    type: String,
    index: true
  },

  // Data Storage
  key: {
    type: String,
    required: [true, 'Data key is required'],
    trim: true,
    maxlength: [100, 'Key cannot exceed 100 characters']
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Data value is required']
  },
  valueHash: String,
  valueType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array', 'binary'],
    required: true
  },
  valueSize: {
    type: Number, // in bytes
    min: 0
  },

  // Metadata
  namespace: {
    type: String,
    default: 'default',
    trim: true  // Removed the duplicate index: true here
  },
  version: {
    type: Number,
    default: 1
  },
  tags: [{
    type: String,
    maxlength: [30, 'Tags cannot exceed 30 characters']
  }],

  // Security
  encryption: {
    enabled: {
      type: Boolean,
      default: false
    },
    algorithm: {
      type: String,
      enum: ['aes-256-cbc', 'aes-128-cbc', null],
      default: null
    },
    iv: {
      type: String,
      select: false
    }
  },

  // Lifecycle Management
  ttl: {
    type: Date,
    index: true,
    expires: 0 // Automatically removes docs when ttl is reached
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
    default: 'synced'
  },
  lastSynced: Date,
  syncVersion: {
    type: Number,
    default: 0
  },
  origin: {
    type: String,
    enum: ['client', 'server', 'migration'],
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for optimized queries
LocalDataSchema.index({ userId: 1, key: 1 }, { unique: true });
LocalDataSchema.index({ syncStatus: 1 });
LocalDataSchema.index({ lastAccessed: -1 });
LocalDataSchema.index({ updatedAt: -1 });

// Removed the duplicate namespace index that was here:
// LocalDataSchema.index({ namespace: 1 });

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

// Pre-save hooks
LocalDataSchema.pre('save', function(next) {
  // Auto-detect value type
  this.valueType = Array.isArray(this.value) ? 'array' : typeof this.value;
  
  // Calculate value size
  this.valueSize = Buffer.byteLength(JSON.stringify(this.value), 'utf8');
  
  // Generate content hash
  this.valueHash = crypto.createHash('sha256')
    .update(JSON.stringify(this.value))
    .digest('hex');
  
  // Handle encryption
  if (this.encryption.enabled && !this.isModified('value')) {
    this.encryptValue();
  }
  
  next();
});

// Instance Methods
LocalDataSchema.methods.encryptValue = function() {
  if (!this.encryption.enabled) return this;
  
  const algorithm = this.encryption.algorithm || 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    algorithm, 
    process.env.DATA_ENCRYPTION_KEY, 
    iv
  );
  
  this.value = Buffer.concat([
    cipher.update(JSON.stringify(this.value)),
    cipher.final()
  ]).toString('hex');
  
  this.encryption.iv = iv.toString('hex');
  return this;
};

LocalDataSchema.methods.decryptValue = function() {
  if (!this.isEncrypted) return this.value;
  
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
};

LocalDataSchema.methods.setTTL = function(days = 30) {
  const ttlDate = new Date();
  ttlDate.setDate(ttlDate.getDate() + days);
  this.ttl = ttlDate;
  return this;
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
    
    // Process client data
    for (const item of clientData) {
      const existing = serverData.find(d => d.key === item.key);
      
      if (existing) {
        // Conflict resolution (client wins if newer)
        if (new Date(item.updatedAt) > existing.updatedAt) {
          operations.push(
            this.updateOne(
              { _id: existing._id },
              { 
                value: item.value,
                syncStatus: 'synced',
                syncVersion: existing.syncVersion + 1
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
            syncStatus: 'synced'
          }], { session })
        );
      }
    }
    
    await Promise.all(operations);
    await session.commitTransaction();
    
    return this.find({ userId }).session(session);
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const LocalData = mongoose.model('LocalData', LocalDataSchema);

export default LocalData;
