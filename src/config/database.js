/**
 * =============================================================================
 * DATABASE CONFIGURATION
 * =============================================================================
 * Konfigurasi koneksi MongoDB Atlas dengan mongoose
 * Includes connection pooling dan error handling
 */

const mongoose = require('mongoose');

/**
 * Koneksi ke MongoDB Atlas
 * @returns {Promise} Mongoose connection promise
 */
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'webrtc_app',
            // Mongoose 8 sudah tidak perlu useNewUrlParser & useUnifiedTopology
            maxPoolSize: 10, // Connection pool size
            serverSelectionTimeoutMS: 5000, // Timeout koneksi
            socketTimeoutMS: 45000, // Socket timeout
        });

        console.log(`[DB] ✅ MongoDB Connected: ${conn.connection.host}`);
        
        // Event listeners untuk monitoring koneksi
        mongoose.connection.on('error', (err) => {
            console.error(`[DB] ❌ MongoDB Error: ${err.message}`);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('[DB] ⚠️ MongoDB Disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('[DB] 🔄 MongoDB Reconnected');
        });

        return conn;
    } catch (error) {
        console.error(`[DB] ❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
