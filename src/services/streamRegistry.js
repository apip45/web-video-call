/**
 * =============================================================================
 * STREAM REGISTRY
 * =============================================================================
 * In-memory state for the MediaMTX "Stream" feature.
 *
 * - sessionByRoom : room yang sedang mengaktifkan sesi stream (socketId streamer)
 * - liveByRoom    : path MediaMTX yang benar-benar live (dari hook runOnAvailable)
 *
 * Dipakai bersama oleh socketHandler (signaling) dan routes/mediamtx (hook).
 */

// roomId -> socketId streamer yang mengaktifkan sesi
const sessionByRoom = new Map();

// roomId -> { roomId, path, sharerSocketId, startedAt }
const liveByRoom = new Map();

/**
 * Aktifkan sesi stream untuk room
 * @param {string} roomId
 * @param {string} socketId
 */
const startSession = (roomId, socketId) => {
    if (!roomId || !socketId) return;
    sessionByRoom.set(roomId, socketId);
};

/**
 * Matikan sesi stream untuk room (hanya jika socketId adalah pemiliknya)
 * @param {string} roomId
 * @param {string} socketId
 * @returns {boolean} true jika sesi dihapus
 */
const stopSession = (roomId, socketId) => {
    if (!roomId) return false;
    if (sessionByRoom.get(roomId) !== socketId) return false;
    sessionByRoom.delete(roomId);
    return true;
};

/**
 * Tandai stream live untuk room
 * @param {string} roomId
 * @param {{ path: string, sharerSocketId?: string|null }} info
 */
const markLive = (roomId, info = {}) => {
    if (!roomId) return;
    liveByRoom.set(roomId, {
        roomId,
        path: info.path,
        sharerSocketId: info.sharerSocketId || sessionByRoom.get(roomId) || null,
        startedAt: Date.now()
    });
};

/**
 * Tandai stream tidak live untuk room
 * @param {string} roomId
 */
const markOffline = (roomId) => {
    if (!roomId) return;
    liveByRoom.delete(roomId);
};

/**
 * Ambil state live sebuah room
 * @param {string} roomId
 * @returns {{ roomId: string, path: string, sharerSocketId: string|null, startedAt: number }|null}
 */
const getLive = (roomId) => {
    return liveByRoom.get(roomId) || null;
};

module.exports = {
    sessionByRoom,
    liveByRoom,
    startSession,
    stopSession,
    markLive,
    markOffline,
    getLive
};
