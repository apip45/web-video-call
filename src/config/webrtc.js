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

    console.log(`[WebRTC] 🌐 Total ICE Servers: ${iceServers.length} servers`);
    return iceServers;
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
    rtcConfig
};
