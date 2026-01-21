/**
 * =============================================================================
 * WEBRTC CONFIGURATION
 * =============================================================================
 * Konfigurasi ICE servers (STUN & TURN) untuk WebRTC
 * Support dual mode: Mesh P2P dan SFU (Ion-SFU)
 * TURN server wajib untuk koneksi melewati NAT/firewall (mode mesh)
 */

/**
 * Get WebRTC mode from environment
 * @returns {string} 'mesh' or 'sfu'
 */
const getWebRTCMode = () => {
    const mode = process.env.WEBRTC_MODE || 'mesh';
    return mode.toLowerCase();
};

/**
 * Check if Ion-SFU is enabled
 * @returns {boolean}
 */
const isIonSFUEnabled = () => {
    return process.env.ION_SFU_ENABLED === 'true' && getWebRTCMode() === 'sfu';
};

/**
 * Get Ion-SFU configuration
 * @returns {Object} Ion-SFU config
 */
const getIonSFUConfig = () => {
    return {
        enabled: isIonSFUEnabled(),
        serverUrl: process.env.ION_SFU_SERVER_URL || 'wss://sfu.mikan.my.id/ws',
        serverIp: process.env.SFU_SERVER_IP || '202.155.91.241',
        fallbackToMesh: process.env.WEBRTC_FALLBACK_TO_MESH === 'true'
    };
};

/**
 * Generate ICE servers configuration for SFU mode
 * SFU mode uses Ion-SFU's STUN/TURN servers configured in sfu.toml
 * Client only needs to connect to SFU server
 * @returns {Array} Array of ICE server configurations
 */
const getIceServersForSFU = () => {
    const iceServers = [];
    const sfuConfig = getIonSFUConfig();

    // SFU server's public IP as STUN (configured in Ion-SFU sfu.toml)
    if (sfuConfig.serverIp) {
        iceServers.push({
            urls: `stun:${sfuConfig.serverIp}:3478`
        });
    }

    // STUN dari Coturn (backup, sudah configured di Ion-SFU sfu.toml)
    if (process.env.STUN_SERVER_URL) {
        iceServers.push({
            urls: process.env.STUN_SERVER_URL
        });
    }

    // Google STUN fallback
    iceServers.push({
        urls: 'stun:stun.l.google.com:19302'
    });

    console.log(`[WebRTC] 🎯 SFU Mode - ICE Servers: ${iceServers.length}`);
    console.log(`[WebRTC] 🌐 Ion-SFU Server: ${sfuConfig.serverUrl}`);
    
    return iceServers;
};

/**
 * Generate ICE servers configuration for Mesh P2P mode
 * @returns {Array} Array of ICE server configurations
 */
const getIceServersForMesh = () => {
    const iceServers = [];

    // STUN Server (free, untuk simple NAT traversal)
    if (process.env.STUN_SERVER_URL) {
        iceServers.push({
            urls: process.env.STUN_SERVER_URL
        });
    } else {
        // Multiple STUN servers untuk redundancy
        iceServers.push({
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302'
            ]
        });
    }

    // TURN Server (wajib untuk koneksi reliable, terutama Tri/Indosat)
    if (process.env.TURN_SERVER_URL) {
        const turnUrl = process.env.TURN_SERVER_URL;
        const turnUser = process.env.TURN_SERVER_USERNAME || '';
        const turnPass = process.env.TURN_SERVER_CREDENTIAL || '';

        // TURN UDP (primary) - port 3478
        iceServers.push({
            urls: turnUrl,
            username: turnUser,
            credential: turnPass,
            credentialType: 'password'
        });

        // TURN TCP (fallback untuk firewall yang blokir UDP)
        if (turnUrl.includes(':3478')) {
            const turnTcp = turnUrl + '?transport=tcp';
            iceServers.push({
                urls: turnTcp,
                username: turnUser,
                credential: turnPass,
                credentialType: 'password'
            });
        }

        // TURN alternate ports (untuk NAT ketat seperti Tri)
        // Port 80, 443 lebih jarang diblokir
        if (process.env.TURN_SERVER_URL_ALT) {
            iceServers.push({
                urls: process.env.TURN_SERVER_URL_ALT,
                username: turnUser,
                credential: turnPass,
                credentialType: 'password'
            });
        }

        console.log(`[WebRTC] ✅ TURN server configured: ${turnUrl}`);
    } else {
        console.warn('[WebRTC] ⚠️  WARNING: No TURN server configured!');
        console.warn('[WebRTC] ⚠️  Tri, Indosat, dan operator dengan Symmetric NAT akan gagal!');
        console.warn('[WebRTC] ⚠️  Setup Coturn dan configure TURN_SERVER_URL di .env');
    }

    // TURNS Server (TLS - untuk tembus firewall sangat ketat)
    if (process.env.TURNS_SERVER_URL) {
        iceServers.push({
            urls: process.env.TURNS_SERVER_URL,
            username: process.env.TURNS_SERVER_USERNAME || process.env.TURN_SERVER_USERNAME || '',
            credential: process.env.TURNS_SERVER_CREDENTIAL || process.env.TURN_SERVER_CREDENTIAL || '',
            credentialType: 'password'
        });
        console.log(`[WebRTC] ✅ TURNS (TLS) server configured`);
    }

    console.log(`[WebRTC] 🌐 Mesh Mode - Total ICE Servers: ${iceServers.length} servers`);
    return iceServers;
};

/**
 * Generate ICE servers configuration based on mode
 * @returns {Array} Array of ICE server configurations
 */
const getIceServers = () => {
    const mode = getWebRTCMode();
    
    if (mode === 'sfu' && isIonSFUEnabled()) {
        console.log(`[WebRTC] 🎯 Mode: SFU (Ion-SFU)`);
        return getIceServersForSFU();
    } else {
        console.log(`[WebRTC] 🔗 Mode: Mesh P2P`);
        return getIceServersForMesh();
    }
};

/**
 * WebRTC peer connection configuration
 */
const rtcConfig = {
    iceServers: [], // Will be populated at runtime
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    // ICE transport policy:
    // 'all' = coba peer-to-peer dulu, fallback ke TURN
    // 'relay' = paksa semua lewat TURN (untuk Symmetric NAT)
    iceTransportPolicy: process.env.FORCE_TURN === 'true' ? 'relay' : 'all'
};

module.exports = {
    getIceServers,
    getWebRTCMode,
    isIonSFUEnabled,
    getIonSFUConfig,
    rtcConfig
};
