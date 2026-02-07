/**
 * =============================================================================
 * USER MODEL
 * =============================================================================
 * Schema user dengan role (admin/user)
 * Password di-hash dengan bcryptjs
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username wajib diisi'],
        unique: true,
        trim: true,
        minlength: [3, 'Username minimal 3 karakter'],
        maxlength: [20, 'Username maksimal 20 karakter']
    },
    email: {
        type: String,
        sparse: true, // Allow null/undefined, but unique if exists
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: [true, 'Password wajib diisi'],
        minlength: [6, 'Password minimal 6 karakter']
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    displayName: {
        type: String,
        trim: true,
        maxlength: [50, 'Display name maksimal 50 karakter']
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // createdAt & updatedAt
});

/**
 * Hash password sebelum save
 */
userSchema.pre('save', async function(next) {
    // Skip jika password tidak dimodifikasi
    if (!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

/**
 * Compare password untuk login
 * @param {String} candidatePassword - Password yang diinput user
 * @returns {Promise<Boolean>} True jika cocok
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Virtual untuk display name (fallback ke username)
 */
userSchema.virtual('name').get(function() {
    return this.displayName || this.username;
});

// Pastikan virtual disertakan saat convert ke JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
