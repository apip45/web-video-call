/**
 * =============================================================================
 * API ROUTES FOR MOBILE APP
 * =============================================================================
 * RESTful API endpoints untuk aplikasi mobile
 * Mengembalikan JSON response
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const jwt = require('jsonwebtoken');

// Middleware untuk verifikasi JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    jwt.verify(token, process.env.SESSION_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token tidak valid' });
        }
        req.user = user;
        next();
    });
};

/**
 * POST /api/auth/register
 * Register user baru (untuk mobile)
 */
router.post('/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        console.log(`[API] 📱 Register attempt: ${username}`);

        // Validasi input
        if (!username || !email || !password) {
            return res.status(400).json({
                message: 'Username, email, dan password wajib diisi'
            });
        }

        // Validasi panjang password
        if (password.length < 6) {
            return res.status(400).json({
                message: 'Password minimal 6 karakter'
            });
        }

        // Cek username sudah ada
        const existingUser = await User.findOne({ 
            username: username.toLowerCase() 
        });
        if (existingUser) {
            return res.status(400).json({
                message: 'Username sudah digunakan'
            });
        }

        // Cek email sudah ada
        const existingEmail = await User.findOne({ 
            email: email.toLowerCase() 
        });
        if (existingEmail) {
            return res.status(400).json({
                message: 'Email sudah terdaftar'
            });
        }

        // Buat user baru
        const user = new User({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: password,
            displayName: username,
            role: 'user',
            isOnline: false
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                username: user.username,
                role: user.role 
            },
            process.env.SESSION_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        console.log(`[API] ✅ Register successful: ${username}`);

        res.status(201).json({
            message: 'Registrasi berhasil',
            token: token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                displayName: user.displayName,
                role: user.role
            }
        });
    } catch (error) {
        console.error(`[API] ❌ Register error: ${error.message}`);
        res.status(500).json({
            message: 'Terjadi kesalahan saat registrasi'
        });
    }
});

/**
 * POST /api/auth/login
 * Login user (untuk mobile)
 */
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log(`[API] 📱 Login attempt: ${username}`);

        // Validasi input
        if (!username || !password) {
            return res.status(400).json({
                message: 'Username dan password wajib diisi'
            });
        }

        // Cari user
        const user = await User.findOne({ 
            username: username.toLowerCase() 
        });
        
        if (!user) {
            console.log(`[API] ❌ User not found: ${username}`);
            return res.status(401).json({
                message: 'Username atau password salah'
            });
        }

        // Verifikasi password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`[API] ❌ Wrong password for: ${username}`);
            return res.status(401).json({
                message: 'Username atau password salah'
            });
        }

        // Update status online
        await User.findByIdAndUpdate(user._id, { 
            isOnline: true, 
            lastActive: new Date() 
        });

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                username: user.username,
                role: user.role 
            },
            process.env.SESSION_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        console.log(`[API] ✅ Login successful: ${username}`);

        res.status(200).json({
            message: 'Login berhasil',
            token: token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                displayName: user.displayName,
                role: user.role
            }
        });
    } catch (error) {
        console.error(`[API] ❌ Login error: ${error.message}`);
        res.status(500).json({
            message: 'Terjadi kesalahan saat login'
        });
    }
});

/**
 * POST /api/room/create
 * Buat room baru (untuk mobile)
 */
router.post('/room/create', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.userId;

        console.log(`[API] 📱 Create room by: ${req.user.username}`);

        // Generate unique room ID
        const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();

        // Buat room baru
        const room = new Room({
            roomId: roomId,
            name: name || `Room ${roomId}`,
            host: userId,
            isActive: true,
            participants: []
        });

        await room.save();

        console.log(`[API] ✅ Room created: ${roomId}`);

        res.status(201).json({
            message: 'Room berhasil dibuat',
            room: {
                id: room._id,
                roomId: room.roomId,
                name: room.name,
                host: room.host,
                isActive: room.isActive,
                createdAt: room.createdAt
            }
        });
    } catch (error) {
        console.error(`[API] ❌ Create room error: ${error.message}`);
        res.status(500).json({
            message: 'Terjadi kesalahan saat membuat room'
        });
    }
});

/**
 * GET /api/room/:roomId
 * Get room info (untuk mobile)
 */
router.get('/room/:roomId', authenticateToken, async (req, res) => {
    try {
        const { roomId } = req.params;

        console.log(`[API] 📱 Get room info: ${roomId}`);

        const room = await Room.findOne({ roomId: roomId })
            .populate('host', 'username displayName');

        if (!room) {
            return res.status(404).json({
                message: 'Room tidak ditemukan'
            });
        }

        res.status(200).json({
            room: {
                id: room._id,
                roomId: room.roomId,
                name: room.name,
                host: room.host,
                isActive: room.isActive,
                participants: room.participants,
                createdAt: room.createdAt
            }
        });
    } catch (error) {
        console.error(`[API] ❌ Get room error: ${error.message}`);
        res.status(500).json({
            message: 'Terjadi kesalahan saat mengambil data room'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info (untuk mobile)
 */
router.get('/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-password');

        if (!user) {
            return res.status(404).json({
                message: 'User tidak ditemukan'
            });
        }

        res.status(200).json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                isOnline: user.isOnline
            }
        });
    } catch (error) {
        console.error(`[API] ❌ Get user error: ${error.message}`);
        res.status(500).json({
            message: 'Terjadi kesalahan'
        });
    }
});

module.exports = router;
