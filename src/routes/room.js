/**
 * =============================================================================
 * ROOM ROUTES
 * =============================================================================
 * Routes untuk manajemen room video call
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Room = require('../models/Room');
const { isAuthenticated } = require('../middleware/auth');
const { getIceServers, getWebRTCMode, getIonSFUConfig } = require('../config/webrtc');

/**
 * GET /
 * Halaman utama (dashboard)
 */
router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Get active rooms created by user or public rooms
        const rooms = await Room.find({ 
            isActive: true,
            $or: [
                { createdBy: req.session.userId },
                { 'participants.user': req.session.userId }
            ]
        })
        .populate('createdBy', 'username displayName')
        .populate('participants.user', 'username displayName')
        .sort({ createdAt: -1 })
        .limit(10);

        res.render('home', {
            title: 'Dashboard',
            rooms: rooms
        });
    } catch (error) {
        console.error(`[Room] ❌ Error loading dashboard: ${error.message}`);
        res.render('home', {
            title: 'Dashboard',
            rooms: [],
            error: 'Gagal memuat data room'
        });
    }
});

/**
 * POST /room/create
 * Buat room baru
 */
router.post('/room/create', isAuthenticated, async (req, res) => {
    try {
        const { name } = req.body;
        const roomId = uuidv4().substring(0, 8); // Short room ID

        console.log(`[Room] 📝 Creating room: ${roomId} by ${req.session.username}`);

        const room = new Room({
            roomId: roomId,
            name: name || `Room ${roomId}`,
            createdBy: req.session.userId
        });

        await room.save();

        console.log(`[Room] ✅ Room created: ${roomId}`);

        res.redirect(`/room/${roomId}`);
    } catch (error) {
        console.error(`[Room] ❌ Error creating room: ${error.message}`);
        res.redirect('/?error=create_failed');
    }
});

/**
 * GET /room/:roomId
 * Halaman video call room
 */
router.get('/room/:roomId', isAuthenticated, async (req, res) => {
    try {
        const { roomId } = req.params;

        console.log(`[Room] 🚪 User ${req.session.username} entering room: ${roomId}`);

        // Cari room (termasuk yang inactive untuk reaktivasi)
        let room = await Room.findOne({ roomId: roomId })
            .populate('createdBy', 'username displayName')
            .populate('participants.user', 'username displayName');

        // Jika room tidak ada, buat baru
        if (!room) {
            console.log(`[Room] 📝 Room not found, creating: ${roomId}`);
            room = new Room({
                roomId: roomId,
                name: `Room ${roomId}`,
                createdBy: req.session.userId
            });
            await room.save();
            room = await Room.findById(room._id)
                .populate('createdBy', 'username displayName');
        } else if (!room.isActive) {
            // Reaktivasi room yang inactive
            console.log(`[Room] 🔄 Reactivating room: ${roomId}`);
            room.isActive = true;
            room.participants = []; // Clear old participants
            room.lastActivity = new Date();
            await room.save();
        }

        // Cek apakah room penuh
        const isUserInRoom = room.participants.some(
            p => p.user && p.user._id.toString() === req.session.userId.toString()
        );

        if (room.isFull() && !isUserInRoom) {
            console.log(`[Room] ⚠️ Room full: ${roomId}`);
            return res.redirect('/?error=room_full');
        }

        // Get ICE servers configuration
        const iceServers = getIceServers();
        
        // Get WebRTC mode (mesh or sfu)
        const webrtcMode = getWebRTCMode();
        const ionSFUConfig = getIonSFUConfig();

        // Get global video settings
        const Settings = require('../models/Settings');
        const videoSettings = await Settings.getVideoSettings();
        const resolutionDimensions = Settings.getResolutionDimensions(videoSettings.resolution);

        // Default to true (enabled) if DB fetch fails — never block the room page
        let adminControlEnabled = true;
        try {
            adminControlEnabled = await Settings.getAdminControlEnabled();
        } catch (e) {
            console.warn('[Room] ⚠️ Could not fetch adminControlEnabled, defaulting to true:', e.message);
        }

        res.render('room', {
            title: `Video Call - ${room.name}`,
            room: room,
            iceServers: JSON.stringify(iceServers),
            userId: req.session.userId,
            username: req.session.displayName || req.session.username,
            userRole: req.session.role,
            isAdmin: req.session.role === 'admin',
            adminControlEnabled,
            webrtcMode: webrtcMode,
            ionSFUConfig: JSON.stringify(ionSFUConfig),
            videoSettings: JSON.stringify({
                ...videoSettings,
                width: resolutionDimensions.width,
                height: resolutionDimensions.height
            })
        });
    } catch (error) {
        console.error(`[Room] ❌ Error entering room: ${error.message}`);
        res.redirect('/?error=room_error');
    }
});

/**
 * POST /room/:roomId/leave
 * Keluar dari room
 */
router.post('/room/:roomId/leave', isAuthenticated, async (req, res) => {
    try {
        const { roomId } = req.params;

        console.log(`[Room] 👋 User ${req.session.username} leaving room: ${roomId}`);

        // Room cleanup dilakukan di socket handler
        res.redirect('/');
    } catch (error) {
        console.error(`[Room] ❌ Error leaving room: ${error.message}`);
        res.redirect('/');
    }
});

/**
 * DELETE /room/:roomId (Admin only)
 * Hapus room
 */
router.delete('/room/:roomId', isAuthenticated, async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const room = await Room.findOne({ roomId: roomId });
        
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room tidak ditemukan' });
        }

        // Hanya creator atau admin yang bisa hapus
        if (room.createdBy.toString() !== req.session.userId.toString() && 
            req.session.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
        }

        room.isActive = false;
        await room.save();

        console.log(`[Room] 🗑️ Room deleted: ${roomId} by ${req.session.username}`);

        res.json({ success: true, message: 'Room dihapus' });
    } catch (error) {
        console.error(`[Room] ❌ Error deleting room: ${error.message}`);
        res.status(500).json({ success: false, message: 'Gagal menghapus room' });
    }
});

module.exports = router;
