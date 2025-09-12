import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import { roles } from '../config/roles.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      validate(value) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new Error('Password must contain at least one letter and one number');
        }
      },
      private: true, // used by the toJSON plugin
    },
    role: {
      type: String,
      default: 'user',
      validate: {
        validator: function(value) {
          // Allow predefined roles or 'custom' for custom roles
          return roles.includes(value) || value === 'custom';
        },
        message: 'Role must be a predefined role or "custom"'
      }
    },
    subRole: {
      type: String,
      required: function() {
        return this.role === 'custom';
      },
      validate: {
        validator: function(value) {
          // If role is custom, subRole is required and must be a non-empty string
          if (this.role === 'custom') {
            return typeof value === 'string' && value.trim().length > 0;
          }
          return true; // subRole is optional for non-custom roles
        },
        message: 'SubRole is required when role is custom'
      }
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // Optional fields for different roles
    phoneNumber: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    education: {
      type: String,
      trim: true,
    },
    experience: {
      type: String,
      trim: true,
    },
    profilePicture: {
      type: String,
      trim: true,
    },
    documents: [{
      fileType: {
        type: String,
        required: true,
        enum: ['image', 'pdf', 'document']
      },
      key: {
        type: String,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {import('mongoose').ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  // @ts-ignore
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
};

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 8);
  }
  next();
});


const User = mongoose.model('User', userSchema);

export default User;