/**
 * =============================================================================
 * VIDEO QUALITY PRESETS
 * =============================================================================
 * Preset konfigurasi kualitas video untuk berbagai resolusi
 * Mendukung: 360p, 480p, 720p, 1080p, dan Custom
 */

const VIDEO_QUALITY_PRESETS = {
    '360p': {
        label: '360p (nHD)',
        width: 640,
        height: 360,
        maxBitrate: 500,  // kbps
        minBitrate: 300,
        idealBitrate: 400,
        maxFramerate: 24,
        idealFramerate: 24
    },
    '480p': {
        label: '480p (SD)',
        width: 854,
        height: 480,
        maxBitrate: 800,  // kbps
        minBitrate: 500,
        idealBitrate: 650,
        maxFramerate: 30,
        idealFramerate: 30
    },
    '720p': {
        label: '720p (HD)',
        width: 1280,
        height: 720,
        maxBitrate: 1500,  // kbps
        minBitrate: 1000,
        idealBitrate: 1200,
        maxFramerate: 30,
        idealFramerate: 30
    },
    '1080p': {
        label: '1080p (Full HD)',
        width: 1920,
        height: 1080,
        maxBitrate: 3000,  // kbps
        minBitrate: 2000,
        idealBitrate: 2500,
        maxFramerate: 30,
        idealFramerate: 30
    }
};

/**
 * Resolution fallback order - jika resolusi tidak support, coba yang lebih rendah
 */
const RESOLUTION_FALLBACK_ORDER = ['1080p', '720p', '480p', '360p'];

/**
 * Get preset configuration by resolution key
 * @param {string} resolution - Resolution key (e.g., '720p')
 * @returns {Object} Preset configuration
 */
function getPreset(resolution) {
    return VIDEO_QUALITY_PRESETS[resolution] || VIDEO_QUALITY_PRESETS['720p'];
}

/**
 * Get all available presets for dropdown
 * @returns {Array} Array of preset options
 */
function getPresetOptions() {
    return Object.keys(VIDEO_QUALITY_PRESETS).map(key => ({
        value: key,
        label: VIDEO_QUALITY_PRESETS[key].label,
        ...VIDEO_QUALITY_PRESETS[key]
    }));
}

/**
 * Get next lower resolution for fallback
 * @param {string} currentResolution - Current resolution key
 * @returns {string|null} Next lower resolution key or null if none available
 */
function getNextLowerResolution(currentResolution) {
    const currentIndex = RESOLUTION_FALLBACK_ORDER.indexOf(currentResolution);
    if (currentIndex === -1 || currentIndex === RESOLUTION_FALLBACK_ORDER.length - 1) {
        return null;
    }
    return RESOLUTION_FALLBACK_ORDER[currentIndex + 1];
}

/**
 * Validate custom quality settings
 * @param {Object} settings - Custom settings {width, height, maxBitrate, maxFramerate}
 * @returns {boolean} True if valid
 */
function validateCustomSettings(settings) {
    const { width, height, maxBitrate, maxFramerate } = settings;
    
    // Validate dimensions
    if (width < 320 || width > 3840) return false;
    if (height < 240 || height > 2160) return false;
    
    // Validate bitrate (kbps)
    if (maxBitrate < 100 || maxBitrate > 10000) return false;
    
    // Validate framerate
    if (maxFramerate < 15 || maxFramerate > 60) return false;
    
    return true;
}

/**
 * Create custom quality preset
 * @param {Object} settings - Custom settings
 * @returns {Object} Custom preset configuration
 */
function createCustomPreset(settings) {
    return {
        label: `Custom (${settings.width}x${settings.height})`,
        width: settings.width,
        height: settings.height,
        maxBitrate: settings.maxBitrate,
        minBitrate: Math.floor(settings.maxBitrate * 0.5),
        idealBitrate: Math.floor(settings.maxBitrate * 0.8),
        maxFramerate: settings.maxFramerate,
        idealFramerate: settings.maxFramerate
    };
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.VIDEO_QUALITY_PRESETS = VIDEO_QUALITY_PRESETS;
    window.RESOLUTION_FALLBACK_ORDER = RESOLUTION_FALLBACK_ORDER;
    window.getPreset = getPreset;
    window.getPresetOptions = getPresetOptions;
    window.getNextLowerResolution = getNextLowerResolution;
    window.validateCustomSettings = validateCustomSettings;
    window.createCustomPreset = createCustomPreset;
}
