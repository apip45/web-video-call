/**
 * =============================================================================
 * MEDIAMTX ROUTES
 * =============================================================================
 * Endpoint integrasi MediaMTX:
 *
 * 1. POST /api/mediamtx/auth
 *    Dipanggil MediaMTX (authHTTPAddress) untuk setiap permintaan
 *    publish/read. Memvalidasi token HMAC yang dibuat server.
 *
 * 2. GET /api/mediamtx/hook
 *    Dipanggil MediaMTX via runOnAvailable/runOnUnavailable. Meneruskan
 *    status live ke room melalui Socket.IO.
 *
 * 3. GET /api/mediamtx/status/:roomId
 *    Status stream untuk UI (session web atau JWT mobile).
 */

const express = require('express');
const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');
const router = express.Router();

const streamRegistry = require('../services/streamRegistry');
const {
    isMediaMtxEnabled,
    getApiUrl,
    getHookSecret,
    getRoomPath,
    pathToRoomId,
    verifyToken
} = require('../config/mediamtx');

// Body parser khusus router ini. MediaMTX mengirim JSON, tapi kita terima
// content-type apa pun agar kompatibel lintas versi.
router.use(express.json({ type: '*/*', limit: '1mb' }));

/**
 * Cek apakah request berasal dari loopback (hook MediaMTX)
 * @param {import('express').Request} req
 * @returns {boolean}
 */
const isLoopbackRequest = (req) => {
    const ip = (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
};

/**
 * Ambil token dari payload auth MediaMTX atau header Authorization
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const extractToken = (req) => {
    const body = req.body || {};
    if (body.token) return String(body.token);
    if (body.password) return String(body.password);

    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7);
    return null;
};

/**
 * Autentikasi web session atau JWT mobile (untuk endpoint status)
 */
const authenticateAny = (req, res, next) => {
    if (req.session && req.session.userId) return next();

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
        try {
            jwt.verify(token, process.env.SESSION_SECRET || 'your-secret-key');
            return next();
        } catch (error) {
            return res.status(403).json({ message: 'Token tidak valid' });
        }
    }

    return res.status(401).json({ message: 'Unauthorized' });
};

/**
 * Request ke Control API MediaMTX
 * @param {string} apiPath
 * @returns {Promise<Object>}
 */
const mediaMtxApiGet = (apiPath) => {
    return new Promise((resolve, reject) => {
        let url;
        try {
            url = new URL(getApiUrl() + apiPath);
        } catch (error) {
            return reject(error);
        }

        const lib = url.protocol === 'https:' ? https : http;
        const req = lib.get(url, { timeout: 3000 }, (resp) => {
            let raw = '';
            resp.on('data', (chunk) => { raw += chunk; });
            resp.on('end', () => {
                if (resp.statusCode < 200 || resp.statusCode >= 300) {
                    return reject(new Error(`MediaMTX API ${resp.statusCode}`));
                }
                try {
                    resolve(JSON.parse(raw));
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('timeout', () => req.destroy(new Error('MediaMTX API timeout')));
        req.on('error', reject);
    });
};

/**
 * POST /auth
 * Validasi kredensial dari MediaMTX (HTTP auth)
 */
router.post('/auth', (req, res) => {
    if (!isMediaMtxEnabled()) {
        return res.status(401).end();
    }

    const { action, path } = req.body || {};
    const token = extractToken(req);

    const payload = verifyToken(token);
    if (!payload) {
        console.log(`[MediaMTX] ⛔ Auth ditolak (token invalid/expired): action=${action} path=${path}`);
        return res.status(401).end();
    }

    if (payload.a !== action || payload.p !== path) {
        console.log(`[MediaMTX] ⛔ Auth ditolak (scope tidak cocok): action=${action} path=${path}`);
        return res.status(401).end();
    }

    console.log(`[MediaMTX] ✅ Auth OK: action=${action} path=${path}`);
    return res.status(200).end();
});

/**
 * GET /hook
 * Dipanggil MediaMTX saat stream available/unavailable
 */
router.get('/hook', (req, res) => {
    const { event, path, secret } = req.query;

    if (secret !== getHookSecret() || !isLoopbackRequest(req)) {
        console.log(`[MediaMTX] ⛔ Hook ditolak dari ${req.ip}`);
        return res.status(401).end();
    }

    const roomId = pathToRoomId(path);
    if (!roomId) {
        return res.status(400).json({ ok: false, message: 'Path tidak dikenal' });
    }

    const io = req.app.get('io');

    if (event === 'available') {
        streamRegistry.markLive(roomId, { path });
        const live = streamRegistry.getLive(roomId);
        console.log(`[MediaMTX] 🟢 Stream LIVE: ${path} (room ${roomId}, sharer ${live?.sharerSocketId || '-'})`);
        if (io) {
            io.to(roomId).emit('stream-available', {
                roomId,
                path,
                sharerSocketId: live?.sharerSocketId || null
            });
        }
    } else if (event === 'unavailable') {
        streamRegistry.markOffline(roomId);
        console.log(`[MediaMTX] 🔴 Stream OFFLINE: ${path} (room ${roomId})`);
        if (io) {
            io.to(roomId).emit('stream-unavailable', { roomId, path });
        }
    } else {
        return res.status(400).json({ ok: false, message: 'Event tidak dikenal' });
    }

    return res.json({ ok: true });
});

/**
 * GET /status/:roomId
 * Cek status stream (live + jumlah reader) via Control API
 */
router.get('/status/:roomId', authenticateAny, async (req, res) => {
    const enabled = isMediaMtxEnabled();
    const path = getRoomPath(req.params.roomId);

    if (!enabled) {
        return res.json({ enabled: false, live: false, path });
    }

    try {
        const info = await mediaMtxApiGet(`/v3/paths/get/${encodeURIComponent(path)}`);
        return res.json({
            enabled: true,
            path,
            live: Boolean(info && info.ready),
            readers: Array.isArray(info?.readers) ? info.readers.length : 0,
            tracks: info?.tracks || []
        });
    } catch (error) {
        // Path belum ada = belum ada publisher, bukan error fatal
        return res.json({
            enabled: true,
            path,
            live: false,
            readers: 0,
            error: error.message
        });
    }
});

module.exports = router;
