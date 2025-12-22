/**
 * =============================================================================
 * ROOM MODEL
 * =============================================================================
 * Schema room untuk video call
 * Maksimal 2 participants per room
 */

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        trim: true,
        maxlength: [50, 'Nama room maksimal 50 karakter']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['admin', 'user'],
            default: 'user'
        },
        socketId: String,
        joinedAt: {
            type: Date,
            default: Date.now
        },
        isMuted: {
            type: Boolean,
            default: false
        },
        isCameraOff: {
            type: Boolean,
            default: false
        },
        // For exam mode - actual camera state (admin can see even if user toggles off)
        actualCameraOn: {
            type: Boolean,
            default: true
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    maxParticipants: {
        type: Number,
        default: 2 // Maksimal 2 untuk 1 vs 1
    },
    // Exam mode - admin can monitor user's camera even if toggled off
    isExamMode: {
        type: Boolean,
        default: false
    },
    // Last activity timestamp for auto-cleanup
    lastActivity: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

/**
 * Check apakah room sudah penuh
 * @returns {Boolean} True jika room penuh
 */
roomSchema.methods.isFull = function() {
    return this.participants.length >= this.maxParticipants;
};

/**
 * Tambah participant ke room
 * @param {ObjectId} userId - User ID
 * @param {String} socketId - Socket ID
 * @param {String} userRole - User role (admin/user)
 * @returns {Boolean} True jika berhasil
 */
roomSchema.methods.addParticipant = function(userId, socketId, userRole) {
    if (this.isFull()) {
        return false;
    }

    // Cek apakah user sudah ada di room
    const existingIndex = this.participants.findIndex(
        p => p.user && p.user.toString() === userId.toString()
    );

    if (existingIndex !== -1) {
        // Update socket ID jika sudah ada
        this.participants[existingIndex].socketId = socketId;
        this.participants[existingIndex].joinedAt = new Date();
        if (userRole) {
            this.participants[existingIndex].role = userRole;
        }
    } else {
        // Tambah participant baru
        this.participants.push({
            user: userId,
            socketId: socketId,
            role: userRole || 'user',
            joinedAt: new Date(),
            actualCameraOn: true
        });
    }

    // Update last activity
    this.lastActivity = new Date();

    return true;
};

/**
 * Hapus participant dari room
 * @param {String} socketId - Socket ID
 * @returns {Object|null} Participant yang dihapus
 */
roomSchema.methods.removeParticipant = function(socketId) {
    const index = this.participants.findIndex(p => p.socketId === socketId);
    if (index !== -1) {
        const removed = this.participants.splice(index, 1);
        return removed[0];
    }
    return null;
};

/**
 * Get participant lain dalam room
 * @param {String} socketId - Socket ID user saat ini
 * @returns {Object|null} Participant lawan
 */
roomSchema.methods.getOtherParticipant = function(socketId) {
    return this.participants.find(p => p.socketId !== socketId) || null;
};

/**
 * Update last activity timestamp
 */
roomSchema.methods.updateActivity = function() {
    this.lastActivity = new Date();
};

/**
 * Check if room has admin participant
 */
roomSchema.methods.hasAdmin = function() {
    return this.participants.some(p => p.role === 'admin');
};

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
