/**
 * =============================================================================
 * AUTH ROUTES
 * =============================================================================
 * Routes untuk autentikasi: login, logout, register
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { redirectIfAuthenticated } = require('../middleware/auth');

/**
 * GET /login
 * Halaman login
 */
router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('login', {
        title: 'Login',
        error: null
    });
});

/**
 * POST /login
 * Proses login
 */
router.post('/login', redirectIfAuthenticated, async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log(`[Auth] 🔐 Login attempt: ${username}`);

        // Validasi input
        if (!username || !password) {
            return res.render('login', {
                title: 'Login',
                error: 'Username dan password wajib diisi'
            });
        }

        // Cari user
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            console.log(`[Auth] ❌ User not found: ${username}`);
            return res.render('login', {
                title: 'Login',
                error: 'Username atau password salah'
            });
        }

        // Verifikasi password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`[Auth] ❌ Wrong password for: ${username}`);
            return res.render('login', {
                title: 'Login',
                error: 'Username atau password salah'
            });
        }

        // Set session
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.displayName = user.displayName || user.username;
        req.session.role = user.role;

        // Update status online
        await User.findByIdAndUpdate(user._id, { 
            isOnline: true, 
            lastActive: new Date() 
        });

        console.log(`[Auth] ✅ Login successful: ${username} (${user.role})`);

        res.redirect('/');
    } catch (error) {
        console.error(`[Auth] ❌ Login error: ${error.message}`);
        res.render('login', {
            title: 'Login',
            error: 'Terjadi kesalahan, silakan coba lagi'
        });
    }
});

/**
 * GET /register
 * Halaman register
 */
router.get('/register', redirectIfAuthenticated, (req, res) => {
    res.render('register', {
        title: 'Register',
        error: null
    });
});

/**
 * POST /register
 * Proses register
 */
router.post('/register', redirectIfAuthenticated, async (req, res) => {
    try {
        const { username, password, confirmPassword, displayName } = req.body;

        console.log(`[Auth] 📝 Register attempt: ${username}`);

        // Validasi input
        if (!username || !password) {
            return res.render('register', {
                title: 'Register',
                error: 'Username dan password wajib diisi'
            });
        }

        if (password !== confirmPassword) {
            return res.render('register', {
                title: 'Register',
                error: 'Password tidak cocok'
            });
        }

        if (password.length < 6) {
            return res.render('register', {
                title: 'Register',
                error: 'Password minimal 6 karakter'
            });
        }

        // Cek username sudah ada
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            console.log(`[Auth] ❌ Username already exists: ${username}`);
            return res.render('register', {
                title: 'Register',
                error: 'Username sudah digunakan'
            });
        }

        // Buat user baru
        const user = new User({
            username: username.toLowerCase(),
            password: password,
            displayName: displayName || username,
            role: 'user' // Default role
        });

        await user.save();

        console.log(`[Auth] ✅ User registered: ${username}`);

        // Auto login setelah register
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.displayName = user.displayName;
        req.session.role = user.role;

        res.redirect('/');
    } catch (error) {
        console.error(`[Auth] ❌ Register error: ${error.message}`);
        res.render('register', {
            title: 'Register',
            error: 'Terjadi kesalahan, silakan coba lagi'
        });
    }
});

/**
 * GET /logout
 * Proses logout
 */
router.get('/logout', async (req, res) => {
    try {
        if (req.session.userId) {
            // Update status offline
            await User.findByIdAndUpdate(req.session.userId, { 
                isOnline: false,
                lastActive: new Date()
            });
            
            console.log(`[Auth] 👋 User logged out: ${req.session.username}`);
        }

        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error(`[Auth] ❌ Logout error: ${err.message}`);
            }
            res.redirect('/login');
        });
    } catch (error) {
        console.error(`[Auth] ❌ Logout error: ${error.message}`);
        res.redirect('/login');
    }
});

module.exports = router;
