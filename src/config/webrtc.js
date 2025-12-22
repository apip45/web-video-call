/**
 * =============================================================================
 * WEBRTC CONFIGURATION
 * =============================================================================
 * Konfigurasi ICE servers (STUN & TURN) untuk WebRTC
 * TURN server wajib untuk koneksi melewati NAT/firewall
 */

/**
 * Generate ICE servers configuration
 * @returns {Array} Array of ICE server configurations
 */
const getIceServers = () => {
    const iceServers = [];

    // STUN Server (free, untuk simple NAT traversal)
    if (process.env.STUN_SERVER_URL) {
        iceServers.push({
            urls: process.env.STUN_SERVER_URL
        });
    } else {
        // Default Google STUN
        iceServers.push({
            urls: 'stun:stun.l.google.com:19302'
        });
    }

    // TURN Server (wajib untuk koneksi reliable)
    if (process.env.TURN_SERVER_URL) {
        iceServers.push({
            urls: process.env.TURN_SERVER_URL,
            username: process.env.TURN_SERVER_USERNAME || '',
            credential: process.env.TURN_SERVER_CREDENTIAL || ''
        });

        // Tambah TURN dengan TCP sebagai fallback
        const turnTcp = process.env.TURN_SERVER_URL.replace(':3478', ':3478?transport=tcp');
        iceServers.push({
            urls: turnTcp,
            username: process.env.TURN_SERVER_USERNAME || '',
            credential: process.env.TURN_SERVER_CREDENTIAL || ''
        });
    }

    // TURNS Server (TLS - untuk tembus firewall ketat)
    if (process.env.TURNS_SERVER_URL) {
        iceServers.push({
            urls: process.env.TURNS_SERVER_URL,
            username: process.env.TURNS_SERVER_USERNAME || '',
            credential: process.env.TURNS_SERVER_CREDENTIAL || ''
        });
    }

    console.log(`[WebRTC] 🌐 ICE Servers configured: ${iceServers.length} servers`);
    return iceServers;
};

/**
 * WebRTC peer connection configuration
 */
const rtcConfig = {
    iceServers: [], // Will be populated at runtime
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

module.exports = {
    getIceServers,
    rtcConfig
};
