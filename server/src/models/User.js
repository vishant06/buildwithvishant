import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // Password-less accounts are created through a trusted OAuth provider.
  password: {
    type: String,
    minlength: 8
  },
  providers: [{
    provider: {
      type: String,
      enum: ['google', 'github'],
      required: true
    },
    providerId: {
      type: String,
      required: true
    }
  }],
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // Profile photo. `provider` records where it came from so OAuth logins
  // don't clobber a photo the user deliberately uploaded, and vice versa.
  avatar: {
    url: {
      type: String,
      default: ''
    },
    publicId: {
      type: String,
      default: ''
    },
    provider: {
      type: String,
      enum: ['upload', 'google', 'github', ''],
      default: ''
    }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  // Never returned by default queries. Only the hash is stored; the raw
  // token is emailed to the user and never persisted.
  emailVerificationTokenHash: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  emailVerificationLastSentAt: {
    type: Date,
    select: false
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function matchPassword(password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;