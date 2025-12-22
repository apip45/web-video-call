/**
 * =============================================================================
 * ADMIN ROUTES
 * =============================================================================
 * Routes untuk admin panel: user management, room management, stats
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const Stats = require('../models/Stats');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

/**
 * GET /admin
 * Admin dashboard
 */
router.get('/admin', isAuthenticated, isAdmin, async (req, res) => {
    try {
        // Get counts
        const userCount = await User.countDocuments({ role: 'user' });
        const adminCount = await User.countDocuments({ role: 'admin' });
        const activeRoomCount = await Room.countDocuments({ isActive: true });
        const totalRoomCount = await Room.countDocuments();

        // Get today's stats
        const todayStats = await Stats.getDailyStats(new Date());

        // Get weekly stats for chart
        const weeklyStats = await Stats.getWeeklyStats();

        // Get recent rooms
        const recentRooms = await Room.find()
            .populate('createdBy', 'username displayName')
            .sort({ createdAt: -1 })
            .limit(10);

        // Get online users
        const onlineUsers = await User.find({ isOnline: true })
            .select('username displayName role lastActive');

        // Get current admin user
        const user = await User.findById(req.session.userId).select('username displayName role');

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user,
            stats: {
                userCount,
                adminCount,
                activeRoomCount,
                totalRoomCount,
                today: todayStats,
                weekly: weeklyStats
            },
            recentRooms,
            onlineUsers
        });
    } catch (error) {
        console.error(`[Admin] ❌ Dashboard error: ${error.message}`);
        res.render('error', {
            title: 'Error',
            message: 'Gagal memuat dashboard'
        });
    }
});

/**
 * GET /admin/users
 * User management page
 */
router.get('/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const role = req.query.role || '';

        // Build query
        const query = {};
        if (role) {
            query.role = role;
        }
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { displayName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        // Get current admin user
        const user = await User.findById(req.session.userId).select('username displayName role');

        res.render('admin/users', {
            title: 'Kelola User',
            user,
            users,
            pagination: {
                page,
                pages: totalPages,
                total: totalUsers,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            search,
            role,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(`[Admin] ❌ Users page error: ${error.message}`);
        res.render('error', {
            title: 'Error',
            message: 'Gagal memuat data user'
        });
    }
});

/**
 * POST /admin/users/create
 * Create a new user
 */
router.post('/admin/users/create', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { username, displayName, email, role, password } = req.body;

        // Validate
        if (!username || !password) {
            return res.redirect('/admin/users?error=' + encodeURIComponent('Username dan password wajib diisi'));
        }

        if (password.length < 6) {
            return res.redirect('/admin/users?error=' + encodeURIComponent('Password minimal 6 karakter'));
        }

        // Check if username exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.redirect('/admin/users?error=' + encodeURIComponent('Username sudah digunakan'));
        }

        // Create user
        const newUser = new User({
            username,
            displayName: displayName || username,
            email: email || undefined,
            role: role || 'user',
            password
        });
        await newUser.save();

        console.log(`[Admin] ➕ User created: ${username} by ${req.session.username}`);
        res.redirect('/admin/users?success=' + encodeURIComponent('User berhasil dibuat'));
    } catch (error) {
        console.error(`[Admin] ❌ Create user error: ${error.message}`);
        res.redirect('/admin/users?error=' + encodeURIComponent('Gagal membuat user'));
    }
});

/**
 * POST /admin/users/:id/update
 * Update a user
 */
router.post('/admin/users/:id/update', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, displayName, email, role, password } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.redirect('/admin/users?error=' + encodeURIComponent('User tidak ditemukan'));
        }

        // Update fields
        if (username) user.username = username;
        if (displayName !== undefined) user.displayName = displayName;
        if (email !== undefined) user.email = email || undefined;
        if (role) user.role = role;
        if (password && password.length >= 6) {
            user.password = password;
        }

        await user.save();

        console.log(`[Admin] ✏️ User updated: ${user.username} by ${req.session.username}`);
        res.redirect('/admin/users?success=' + encodeURIComponent('User berhasil diupdate'));
    } catch (error) {
        console.error(`[Admin] ❌ Update user error: ${error.message}`);
        res.redirect('/admin/users?error=' + encodeURIComponent('Gagal update user'));
    }
});

/**
 * POST /admin/users/:id/delete
 * Delete a user
 */
router.post('/admin/users/:id/delete', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.redirect('/admin/users?error=' + encodeURIComponent('User tidak ditemukan'));
        }

        if (user._id.toString() === req.session.userId) {
            return res.redirect('/admin/users?error=' + encodeURIComponent('Tidak dapat menghapus akun sendiri'));
        }

        await User.findByIdAndDelete(id);
        console.log(`[Admin] 🗑️ User deleted: ${user.username} by ${req.session.username}`);

        res.redirect('/admin/users?success=' + encodeURIComponent('User berhasil dihapus'));
    } catch (error) {
        console.error(`[Admin] ❌ Delete user error: ${error.message}`);
        res.redirect('/admin/users?error=' + encodeURIComponent('Gagal menghapus user'));
    }
});

/**
 * POST /admin/users/:id/reset-password
 * Reset user password to default
 */
router.post('/admin/users/:id/reset-password', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const newPassword = '123456'; // Default password

        const user = await User.findById(id);
        if (!user) {
            return res.redirect('/admin/users?error=' + encodeURIComponent('User tidak ditemukan'));
        }

        user.password = newPassword;
        await user.save();

        console.log(`[Admin] 🔑 Password reset for: ${user.username} by ${req.session.username}`);

        res.redirect('/admin/users?success=' + encodeURIComponent('Password direset ke: 123456'));
    } catch (error) {
        console.error(`[Admin] ❌ Reset password error: ${error.message}`);
        res.redirect('/admin/users?error=' + encodeURIComponent('Gagal reset password'));
    }
});

/**
 * GET /admin/rooms
 * Room management page
 */
router.get('/admin/rooms', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const filter = req.query.filter || 'all';

        // Build query
        const query = {};
        if (filter === 'active') {
            query.isActive = true;
        } else if (filter === 'inactive') {
            query.isActive = false;
        }

        const rooms = await Room.find(query)
            .populate('createdBy', 'username displayName')
            .populate('participants.user', 'username displayName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalRooms = await Room.countDocuments(query);
        const totalPages = Math.ceil(totalRooms / limit);

        // Get current admin user
        const user = await User.findById(req.session.userId).select('username displayName role');

        res.render('admin/rooms', {
            title: 'Kelola Room',
            user,
            rooms,
            pagination: {
                page,
                pages: totalPages,
                total: totalRooms,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            status: filter,
            search: req.query.search || '',
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(`[Admin] ❌ Rooms page error: ${error.message}`);
        res.render('error', {
            title: 'Error',
            message: 'Gagal memuat data room'
        });
    }
});

/**
 * POST /admin/rooms/:roomId/delete
 * Delete a room
 */
router.post('/admin/rooms/:roomId/delete', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.redirect('/admin/rooms?error=' + encodeURIComponent('Room tidak ditemukan'));
        }

        await Room.deleteOne({ roomId });
        console.log(`[Admin] 🗑️ Room deleted: ${roomId} by ${req.session.username}`);

        res.redirect('/admin/rooms?success=' + encodeURIComponent('Room berhasil dihapus'));
    } catch (error) {
        console.error(`[Admin] ❌ Delete room error: ${error.message}`);
        res.redirect('/admin/rooms?error=' + encodeURIComponent('Gagal menghapus room'));
    }
});

/**
 * POST /admin/rooms/cleanup
 * Cleanup inactive rooms
 */
router.post('/admin/rooms/cleanup', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await Room.deleteMany({ isActive: false });
        console.log(`[Admin] 🧹 Cleaned up ${result.deletedCount} inactive rooms`);

        res.redirect('/admin/rooms?success=' + encodeURIComponent(`${result.deletedCount} room tidak aktif berhasil dihapus`));
    } catch (error) {
        console.error(`[Admin] ❌ Cleanup error: ${error.message}`);
        res.redirect('/admin/rooms?error=' + encodeURIComponent('Gagal membersihkan room'));
    }
});

/**
 * GET /admin/stats
 * Statistics page
 */
router.get('/admin/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const period = req.query.period || 'today';

        // Get stats for different periods
        const todayStats = await Stats.getDailyStats(new Date());
        const weeklyStats = await Stats.getWeeklyStats();

        // Get period stats
        let startDate = new Date();
        if (period === 'week') {
            startDate.setDate(startDate.getDate() - 7);
        } else if (period === 'month') {
            startDate.setDate(startDate.getDate() - 30);
        } else {
            startDate.setHours(0, 0, 0, 0);
        }

        // Aggregate stats for period
        const periodStats = await Stats.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    type: 'call'
                }
            },
            {
                $group: {
                    _id: null,
                    totalBytesSent: { $sum: '$bytesSent' },
                    totalBytesReceived: { $sum: '$bytesReceived' },
                    totalCalls: { $sum: 1 },
                    totalDuration: { $sum: '$callDuration' },
                    avgPacketLoss: { $avg: '$avgPacketLoss' },
                    avgLatency: { $avg: '$avgLatency' },
                    avgJitter: { $avg: '$avgJitter' }
                }
            }
        ]);

        // Get recent calls
        const recentCalls = await Stats.find({ type: 'call' })
            .populate('user', 'username displayName')
            .sort({ createdAt: -1 })
            .limit(20);

        res.render('admin/stats', {
            title: 'Statistik',
            period,
            stats: {
                summary: periodStats[0] || { 
                    totalBytesSent: 0, 
                    totalBytesReceived: 0, 
                    totalCalls: 0, 
                    totalDuration: 0,
                    avgPacketLoss: 0,
                    avgLatency: 0,
                    avgJitter: 0
                },
                daily: weeklyStats,
                recentCalls
            }
        });
    } catch (error) {
        console.error(`[Admin] ❌ Stats page error: ${error.message}`);
        res.render('error', {
            title: 'Error',
            message: 'Gagal memuat statistik'
        });
    }
});

/**
 * GET /admin/api/stats/realtime
 * Get realtime stats via API
 */
router.get('/admin/api/stats/realtime', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const activeRooms = await Room.find({ isActive: true, 'participants.0': { $exists: true } })
            .populate('participants.user', 'username displayName');
        
        const onlineUsers = await User.countDocuments({ isOnline: true });
        const todayStats = await Stats.getDailyStats(new Date());

        res.json({
            success: true,
            data: {
                activeRooms: activeRooms.length,
                onlineUsers,
                todayBandwidth: todayStats.totalBytesSent + todayStats.totalBytesReceived,
                todayCalls: todayStats.totalCalls
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
