import mongoose from 'mongoose';

const LocalDataSchema = new mongoose.Schema({
  // Identify user
  userId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
 
  //local storage key
  key: {
    type: String,
    required: true,
    trim: true
  },
 
  //value
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
 
  //update marker
  updatedAt: {
    type: Date,
    default: Date.now
  },
 
  //created marker
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
 
  timestamps: true,
 
  //
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

//compound index
LocalDataSchema.index({ userId: 1, key: 1 }, { unique: true });

//parsing if needed
LocalDataSchema.methods.getParsedValue = function() {
  if (typeof this.value === 'string') {
    try {
      return JSON.parse(this.value);
    } catch (e) {
      return this.value;
    }
  }
  return this.value;
};

//find or create data
LocalDataSchema.statics.findOrCreate = async function(userId, key, defaultValue = {}) {
  let data = await this.findOne({ userId, key });
 
  if (!data) {
    data = await this.create({
      userId,
      key,
      value: defaultValue
    });
  }
 
  return data;
};

// get data
LocalDataSchema.statics.getAllForUser = async function(userId) {
  return this.find({ userId }).sort({ key: 1 });
};


LocalDataSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

const LocalData = mongoose.model('LocalData', LocalDataSchema);

export default LocalData;