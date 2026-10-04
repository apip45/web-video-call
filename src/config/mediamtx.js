/**
 * =============================================================================
 * MEDIAMTX CONFIGURATION
 * =============================================================================
 * Konfigurasi untuk fitur "Stream" (OBS -> MediaMTX -> WHEP).
 *
 * Alur:
 * - Streamer publish dari OBS via WHIP ke MediaMTX (H264 + Opus)
 * - Viewer menonton via WHEP (WebRTC) di halaman room
 * - MediaMTX memverifikasi kredensial ke endpoint /api/mediamtx/auth (HTTP auth)
 * - Hook runOnAvailable/runOnUnavailable MediaMTX memanggil /api/mediamtx/hook
 *
 * Token publish/read dibuat dengan HMAC (MEDIAMTX_AUTH_SECRET) sehingga tidak
 * perlu round-trip ke database saat MediaMTX melakukan autentikasi.
 */

const crypto = require('crypto');

const DEFAULTS = {
    publicUrl: 'https://media.mikan.my.id',
    apiUrl: 'http://127.0.0.1:9997',
    pathPrefix: 'room-',
    tokenTtl: 2 * 60 * 60 // 2 jam (samakan dengan umur session)
};

/**
 * Apakah fitur MediaMTX diaktifkan
 * @returns {boolean}
 */
const isMediaMtxEnabled = () => {
    return process.env.MEDIAMTX_ENABLED === 'true';
};

/**
 * Base URL publik MediaMTX (di-proxy Caddy), tanpa trailing slash
 * @returns {string}
 */
const getPublicUrl = () => {
    return (process.env.MEDIAMTX_PUBLIC_URL || DEFAULTS.publicUrl).replace(/\/+$/, '');
};

/**
 * URL Control API MediaMTX (hanya localhost)
 * @returns {string}
 */
const getApiUrl = () => {
    return (process.env.MEDIAMTX_API_URL || DEFAULTS.apiUrl).replace(/\/+$/, '');
};

/**
 * Prefix path MediaMTX per room
 * @returns {string}
 */
const getPathPrefix = () => {
    return process.env.MEDIAMTX_PATH_PREFIX || DEFAULTS.pathPrefix;
};

/**
 * TTL token (detik)
 * @returns {number}
 */
const getTokenTtl = () => {
    const ttl = parseInt(process.env.MEDIAMTX_TOKEN_TTL, 10);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULTS.tokenTtl;
};

/**
 * Secret untuk menandatangani token publish/read
 * @returns {string}
 */
const getAuthSecret = () => {
    return process.env.MEDIAMTX_AUTH_SECRET || 'change-me-mediamtx-auth-secret';
};

/**
 * Secret untuk memvalidasi hook dari MediaMTX
 * @returns {string}
 */
const getHookSecret = () => {
    return process.env.MEDIAMTX_HOOK_SECRET || 'change-me-mediamtx-hook-secret';
};

/**
 * Normalisasi roomId (hanya huruf kecil, angka, dan dash)
 * @param {string} roomId
 * @returns {string}
 */
const sanitizeRoomId = (roomId) => {
    return String(roomId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
};

/**
 * Path MediaMTX untuk sebuah room
 * @param {string} roomId
 * @returns {string}
 */
const getRoomPath = (roomId) => {
    return `${getPathPrefix()}${sanitizeRoomId(roomId)}`;
};

/**
 * Ekstrak roomId dari path MediaMTX
 * @param {string} path
 * @returns {string|null}
 */
const pathToRoomId = (path) => {
    const prefix = getPathPrefix();
    const value = String(path || '');
    if (!value.startsWith(prefix)) return null;
    const roomId = sanitizeRoomId(value.slice(prefix.length));
    return roomId || null;
};

/**
 * Encode payload menjadi token bertanda tangan: <base64url(payload)>.<hmac>
 * @param {{ action: string, path: string, ttl?: number }} options
 * @returns {string}
 */
const signToken = ({ action, path, ttl }) => {
    const payload = {
        a: action,
        p: path,
        exp: Math.floor(Date.now() / 1000) + (ttl || getTokenTtl())
    };
    const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = crypto
        .createHmac('sha256', getAuthSecret())
        .update(data)
        .digest('base64url');
    return `${data}.${signature}`;
};

/**
 * Verifikasi token bertanda tangan
 * @param {string} token
 * @returns {{ a: string, p: string, exp: number }|null}
 */
const verifyToken = (token) => {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    const expected = crypto
        .createHmac('sha256', getAuthSecret())
        .update(data)
        .digest('base64url');

    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null;

    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
        if (!payload || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch (error) {
        return null;
    }
};

/**
 * Konfigurasi stream lengkap untuk sebuah room (dikirim ke client)
 * @param {string} roomId
 * @returns {Object}
 */
const getRoomStreamConfig = (roomId) => {
    const enabled = isMediaMtxEnabled();
    const publicUrl = getPublicUrl();
    const path = getRoomPath(roomId);
    const ttl = getTokenTtl();

    return {
        enabled,
        path,
        publicUrl,
        whipUrl: `${publicUrl}/${path}/whip`,
        whepUrl: `${publicUrl}/${path}/whep`,
        publishToken: enabled ? signToken({ action: 'publish', path, ttl }) : '',
        readToken: enabled ? signToken({ action: 'read', path, ttl }) : '',
        tokenTtl: ttl
    };
};

module.exports = {
    isMediaMtxEnabled,
    getPublicUrl,
    getApiUrl,
    getPathPrefix,
    getTokenTtl,
    getAuthSecret,
    getHookSecret,
    sanitizeRoomId,
    getRoomPath,
    pathToRoomId,
    signToken,
    verifyToken,
    getRoomStreamConfig
};
