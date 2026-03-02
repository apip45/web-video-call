/**
 * =============================================================================
 * SETTINGS MODEL
 * =============================================================================
 * Global application settings stored in MongoDB
 * Used for video call optimization settings like bitrate, resolution, FPS
 */

const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    // Setting key identifier
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Setting value (JSON)
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    
    // Description
    description: {
        type: String,
        default: ''
    },
    
    // Last updated by
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

/**
 * Get a setting by key
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if not found
 * @returns {Promise<*>}
 */
settingsSchema.statics.get = async function(key, defaultValue = null) {
    const setting = await this.findOne({ key });
    return setting ? setting.value : defaultValue;
};

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @param {string} userId - User who updated (optional)
 * @returns {Promise<Settings>}
 */
settingsSchema.statics.set = async function(key, value, userId = null) {
    const update = { 
        value,
        ...(userId && { updatedBy: userId })
    };
    
    return this.findOneAndUpdate(
        { key },
        { $set: update },
        { upsert: true, new: true }
    );
};

/**
 * Get all video settings
 * @returns {Promise<Object>}
 */
settingsSchema.statics.getVideoSettings = async function() {
    const defaultSettings = {
        maxBitrate: 1500, // kbps
        resolution: '720p', // 720p, 480p, 360p, 1080p
        maxFramerate: 30, // fps
        videoCpuOveruseDetection: true,
        audioEchoCancellation: true,
        audioNoiseSuppression: true,
        preferredVideoCodec: 'auto' // auto, h264, vp8, vp9, av1
    };
    
    const settings = await this.get('videoSettings', defaultSettings);
    return { ...defaultSettings, ...settings };
};

/**
 * Get admin control enabled state
 * @returns {Promise<boolean>}
 */
settingsSchema.statics.getAdminControlEnabled = async function() {
    return this.get('adminControlEnabled', true);
};

/**
 * Set admin control enabled state
 * @param {boolean} enabled
 * @param {string} userId
 */
settingsSchema.statics.setAdminControlEnabled = async function(enabled, userId) {
    return this.set('adminControlEnabled', Boolean(enabled), userId);
};

/**
 * Set video settings
 * @param {Object} settings - Video settings object
 * @param {string} userId - User who updated
 * @returns {Promise<Settings>}
 */
settingsSchema.statics.setVideoSettings = async function(settings, userId) {
    // Validate and sanitize settings
    const validatedSettings = {
        maxBitrate: Math.min(Math.max(parseInt(settings.maxBitrate) || 1500, 100), 5000),
        resolution: ['360p', '480p', '720p', '1080p'].includes(settings.resolution) ? settings.resolution : '720p',
        maxFramerate: Math.min(Math.max(parseInt(settings.maxFramerate) || 30, 10), 60),
        videoCpuOveruseDetection: Boolean(settings.videoCpuOveruseDetection),
        audioEchoCancellation: Boolean(settings.audioEchoCancellation),
        audioNoiseSuppression: Boolean(settings.audioNoiseSuppression),
        preferredVideoCodec: ['auto', 'h264', 'vp8', 'vp9', 'av1'].includes(settings.preferredVideoCodec)
            ? settings.preferredVideoCodec
            : 'auto'
    };
    
    return this.set('videoSettings', validatedSettings, userId);
};

/**
 * Get resolution dimensions
 * @param {string} resolution - Resolution string like '720p'
 * @returns {Object} { width, height }
 */
settingsSchema.statics.getResolutionDimensions = function(resolution) {
    const resolutions = {
        '360p': { width: 640, height: 360 },
        '480p': { width: 854, height: 480 },
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 }
    };
    return resolutions[resolution] || resolutions['720p'];
};

module.exports = mongoose.model('Settings', settingsSchema);
