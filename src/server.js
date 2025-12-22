/**
 * =============================================================================
 * MAIN SERVER
 * =============================================================================
 * Entry point aplikasi video call
 * Setup Express, Socket.IO, MongoDB, Session
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

// Import configurations
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');
const adminRoutes = require('./routes/admin');

// Import middleware
const { attachUserToLocals } = require('./middleware/auth');

// Import socket handler
const setupSocketHandlers = require('./socket/socketHandler');

// =============================================================================
// APP INITIALIZATION
// =============================================================================

const app = express();
const server = http.createServer(app);

// Socket.IO dengan CORS settings
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? false 
            : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// =============================================================================
// SESSION CONFIGURATION
// =============================================================================

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60, // 1 day
        autoRemove: 'native'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
});

app.use(sessionMiddleware);

// Share session dengan Socket.IO
io.engine.use(sessionMiddleware);

// Attach user to all views
app.use(attachUserToLocals);

// =============================================================================
// ROUTES
// =============================================================================

// Auth routes
app.use('/', authRoutes);

// Room routes
app.use('/', roomRoutes);

// Admin routes
app.use('/', adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: '404 - Not Found',
        message: 'Halaman tidak ditemukan'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(`[Server] ❌ Error: ${err.message}`);
    res.status(500).render('error', {
        title: 'Error',
        message: 'Terjadi kesalahan pada server'
    });
});

// =============================================================================
// SOCKET.IO SETUP
// =============================================================================

setupSocketHandlers(io);

// =============================================================================
// DATABASE CONNECTION & SERVER START
// =============================================================================

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Create default admin user if not exists
        const User = require('./models/User');
        const adminExists = await User.findOne({ role: 'admin' });
        
        if (!adminExists) {
            const admin = new User({
                username: 'admin',
                password: 'admin123',
                displayName: 'Administrator',
                role: 'admin'
            });
            await admin.save();
            console.log('[Server] 👤 Default admin created: admin / admin123');
        }

        // Start server
        server.listen(PORT, () => {
            console.log('='.repeat(60));
            console.log(`[Server] 🚀 Video Call App running on port ${PORT}`);
            console.log(`[Server] 🌐 http://localhost:${PORT}`);
            console.log(`[Server] 📱 Mode: ${process.env.NODE_ENV || 'development'}`);
            console.log('='.repeat(60));
        });
    } catch (error) {
        console.error(`[Server] ❌ Failed to start: ${error.message}`);
        process.exit(1);
    }
};

startServer();

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

process.on('SIGTERM', () => {
    console.log('[Server] 📴 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('[Server] 👋 Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[Server] 📴 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('[Server] 👋 Server closed');
        process.exit(0);
    });
});
