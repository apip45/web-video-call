/**
 * =============================================================================
 * SOCKET HANDLER
 * =============================================================================
 * WebRTC signaling dengan Socket.IO
 * Handles: join room, offer, answer, ICE candidates, media status, exam mode, stats
 */

const Room = require('../models/Room');
const User = require('../models/User');
const Stats = require('../models/Stats');

// Store for room cleanup timers
const roomCleanupTimers = new Map();
const ROOM_CLEANUP_DELAY = 10000; // 10 seconds

// Store for active call stats
const activeCallStats = new Map();

// Store for heartbeat tracking
const heartbeatTimers = new Map();
const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_TIMEOUT = 25000; // 25 seconds (2.5x interval)

/**
 * Setup Socket.IO handlers
 * @param {Server} io - Socket.IO server instance
 */
const setupSocketHandlers = (io) => {
    // Middleware untuk logging koneksi
    io.use((socket, next) => {
        const session = socket.request.session;
        if (session && session.userId) {
            socket.userId = session.userId;
            socket.username = session.displayName || session.username;
            socket.userRole = session.role;
            console.log(`[Socket] 🔌 Connection authorized: ${socket.username} (${socket.userRole})`);
            next();
        } else {
            console.log('[Socket] ⚠️ Unauthorized socket connection attempt');
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] ✅ Connected: ${socket.username} (${socket.id}) - Role: ${socket.userRole}`);

        // Start heartbeat for this socket
        startHeartbeat(socket);

        // =========================================================================
        // HEARTBEAT - PONG
        // =========================================================================
        socket.on('pong', () => {
            // Reset heartbeat timeout
            resetHeartbeat(socket);
        });

        // =========================================================================
        // JOIN ROOM
        // =========================================================================
        socket.on('join-room', async (data) => {
            try {
                const { roomId } = data;
                console.log(`[Socket] 🚪 ${socket.username} joining room: ${roomId}`);

                // Cancel any pending cleanup for this room
                if (roomCleanupTimers.has(roomId)) {
                    clearTimeout(roomCleanupTimers.get(roomId));
                    roomCleanupTimers.delete(roomId);
                    console.log(`[Socket] ⏱️ Cancelled cleanup timer for room: ${roomId}`);
                }

                // Cari room (termasuk inactive untuk reaktivasi)
                let room = await Room.findOne({ roomId: roomId });
                
                if (!room) {
                    console.log(`[Socket] ❌ Room not found: ${roomId}`);
                    socket.emit('error', { message: 'Room tidak ditemukan' });
                    return;
                }
                
                // Reaktivasi room jika inactive
                if (!room.isActive) {
                    console.log(`[Socket] 🔄 Reactivating room via socket: ${roomId}`);
                    room.isActive = true;
                    room.participants = []; // Clear old participants
                    room.lastActivity = new Date();
                    await room.save();
                }

                // Cek apakah user sudah di room
                const existingParticipant = room.participants.find(
                    p => p.user && p.user.toString() === socket.userId.toString()
                );

                // NEW: Check if non-admin is trying to join when another non-admin is already in room
                // Room can only have: 1 admin + 1 user, or multiple admins
                if (socket.userRole !== 'admin' && !existingParticipant) {
                    const existingNonAdmin = room.participants.find(p => p.role !== 'admin');
                    if (existingNonAdmin) {
                        console.log(`[Socket] ⚠️ Room ${roomId} already has a non-admin user, rejecting: ${socket.username}`);
                        socket.emit('room-full-for-user', { 
                            message: 'Akses ditolak: Sudah ada User lain di dalam room ini. Room ini hanya bisa dimasuki oleh 1 Admin dan 1 User, atau beberapa Admin.' 
                        });
                        return;
                    }
                }

                // Cek kapasitas room
                if (room.isFull() && !existingParticipant) {
                    console.log(`[Socket] ⚠️ Room full: ${roomId}`);
                    socket.emit('room-full', { message: 'Room sudah penuh (max 2 orang)' });
                    return;
                }

                // Tambah/update participant with role
                if (existingParticipant) {
                    existingParticipant.socketId = socket.id;
                    existingParticipant.joinedAt = new Date();
                    existingParticipant.role = socket.userRole;
                } else {
                    room.participants.push({
                        user: socket.userId,
                        socketId: socket.id,
                        role: socket.userRole,
                        joinedAt: new Date(),
                        isCameraHidden: false // For visual state (non-admin)
                    });
                }

                room.lastActivity = new Date();
                await room.save();

                // Join socket room
                socket.join(roomId);
                socket.roomId = roomId;

                // Initialize call stats tracking
                if (!activeCallStats.has(roomId)) {
                    activeCallStats.set(roomId, {
                        startTime: new Date(),
                        participants: new Map()
                    });
                }
                activeCallStats.get(roomId).participants.set(socket.id, {
                    bytesSent: 0,
                    bytesReceived: 0,
                    userId: socket.userId
                });

                // Get other participant
                const otherParticipant = room.getOtherParticipant(socket.id);

                console.log(`[Socket] ✅ ${socket.username} joined room: ${roomId}`);
                console.log(`[Socket] 👥 Participants: ${room.participants.length}/2`);

                // Notify user of successful join
                socket.emit('room-joined', {
                    roomId: roomId,
                    participantCount: room.participants.length,
                    isInitiator: !otherParticipant,
                    userRole: socket.userRole,
                    isAdmin: socket.userRole === 'admin'
                });

                // Notify other participant
                if (otherParticipant) {
                    console.log(`[Socket] 📢 Notifying other participant: ${otherParticipant.socketId}`);
                    io.to(otherParticipant.socketId).emit('user-joined', {
                        socketId: socket.id,
                        username: socket.username,
                        userRole: socket.userRole,
                        participantCount: room.participants.length
                    });
                }

            } catch (error) {
                console.error(`[Socket] ❌ Join room error: ${error.message}`);
                socket.emit('error', { message: 'Gagal join room' });
            }
        });

        // =========================================================================
        // WEBRTC SIGNALING - OFFER
        // =========================================================================
        socket.on('offer', async (data) => {
            try {
                const { roomId, offer, targetSocketId } = data;
                console.log(`[Socket] 📤 Offer from ${socket.username} to ${targetSocketId}`);

                // Kirim offer ke target
                io.to(targetSocketId).emit('offer', {
                    offer: offer,
                    senderSocketId: socket.id,
                    senderUsername: socket.username,
                    senderRole: socket.userRole
                });
            } catch (error) {
                console.error(`[Socket] ❌ Offer error: ${error.message}`);
            }
        });

        // =========================================================================
        // WEBRTC SIGNALING - ANSWER
        // =========================================================================
        socket.on('answer', async (data) => {
            try {
                const { roomId, answer, targetSocketId } = data;
                console.log(`[Socket] 📥 Answer from ${socket.username} to ${targetSocketId}`);

                // Kirim answer ke target
                io.to(targetSocketId).emit('answer', {
                    answer: answer,
                    senderSocketId: socket.id,
                    senderUsername: socket.username
                });
            } catch (error) {
                console.error(`[Socket] ❌ Answer error: ${error.message}`);
            }
        });

        // =========================================================================
        // WEBRTC SIGNALING - ICE CANDIDATE
        // =========================================================================
        socket.on('ice-candidate', async (data) => {
            try {
                const { roomId, candidate, targetSocketId } = data;
                console.log(`[Socket] 🧊 ICE candidate from ${socket.username}`);

                // Kirim ICE candidate ke target
                io.to(targetSocketId).emit('ice-candidate', {
                    candidate: candidate,
                    senderSocketId: socket.id
                });
            } catch (error) {
                console.error(`[Socket] ❌ ICE candidate error: ${error.message}`);
            }
        });

        // =========================================================================
        // MEDIA STATUS UPDATE (Mute/Camera)
        // =========================================================================
        socket.on('media-status', async (data) => {
            try {
                const { roomId, isMuted, isCameraHidden, isCameraTrackEnabled } = data;
                console.log(`[Socket] 🎤 Media status from ${socket.username} (${socket.userRole}): muted=${isMuted}, cameraHidden=${isCameraHidden}, trackEnabled=${isCameraTrackEnabled}`);

                // Update di database
                const room = await Room.findOne({ roomId: roomId });
                if (room) {
                    const participant = room.participants.find(p => p.socketId === socket.id);
                    if (participant) {
                        participant.isMuted = isMuted;
                        participant.isCameraHidden = isCameraHidden;
                        participant.isCameraTrackEnabled = isCameraTrackEnabled;
                        await room.save();
                    }

                    // Broadcast ke room (except sender)
                    // For non-admin (user): track always enabled, so receiver always sees video
                    // isCameraHidden is just visual state for non-admin's own view
                    socket.to(roomId).emit('media-status', {
                        socketId: socket.id,
                        username: socket.username,
                        userRole: socket.userRole,
                        isMuted: isMuted,
                        // For admin viewing non-admin: show visual status but track is always on
                        // For anyone viewing admin: show actual track state
                        isCameraHidden: isCameraHidden,
                        isCameraTrackEnabled: isCameraTrackEnabled
                    });
                }
            } catch (error) {
                console.error(`[Socket] ❌ Media status error: ${error.message}`);
            }
        });

        // =========================================================================
        // ADMIN TOGGLE USER CAMERA
        // =========================================================================
        socket.on('admin-toggle-user-camera', async (data) => {
            try {
                const { roomId, targetSocketId, action } = data; // action: 'enable' or 'disable'
                
                // Only allow admin to send this command
                if (socket.userRole !== 'admin') {
                    console.log(`[Socket] ⚠️ Non-admin ${socket.username} tried to toggle user camera`);
                    socket.emit('admin-camera-response', { 
                        success: false, 
                        message: 'Hanya admin yang dapat mengontrol kamera user' 
                    });
                    return;
                }

                console.log(`[Socket] 👑 Admin ${socket.username} toggling camera for user ${targetSocketId}: ${action}`);

                // Find the target user in the room
                const room = await Room.findOne({ roomId: roomId });
                if (room) {
                    const targetParticipant = room.participants.find(p => p.socketId === targetSocketId);
                    if (targetParticipant && targetParticipant.role === 'user') {
                        // Send command to target user
                        socket.to(targetSocketId).emit('admin-camera-command', {
                            action: action, // 'on' or 'off'
                            adminUsername: socket.username
                        });

                        // Send confirmation to admin
                        const actionText = action === 'on' ? 'diaktifkan' : 'dinonaktifkan';
                        socket.emit('admin-camera-response', { 
                            success: true, 
                            action: action,
                            message: `Kamera user berhasil ${actionText}` 
                        });

                        // Log the action
                        console.log(`[Socket] 📡 Sent camera ${action} command to user`);
                    } else {
                        console.log(`[Socket] ⚠️ Target user not found or not a user role`);
                        socket.emit('admin-camera-response', { 
                            success: false, 
                            message: 'User tidak ditemukan atau bukan role user' 
                        });
                    }
                } else {
                    socket.emit('admin-camera-response', { 
                        success: false, 
                        message: 'Room tidak ditemukan' 
                    });
                }
            } catch (error) {
                console.error(`[Socket] ❌ Admin toggle user camera error: ${error.message}`);
                socket.emit('admin-camera-response', { 
                    success: false, 
                    message: 'Terjadi error: ' + error.message 
                });
            }
        });

        // =========================================================================
        // ADMIN SWITCH USER CAMERA
        // =========================================================================
        socket.on('admin-switch-user-camera', async (data) => {
            try {
                const { roomId, targetSocketId } = data;
                
                // Only allow admin to send this command
                if (socket.userRole !== 'admin') {
                    console.log(`[Socket] ⚠️ Non-admin ${socket.username} tried to switch user camera`);
                    return;
                }

                console.log(`[Socket] 👑 Admin ${socket.username} switching camera for user ${targetSocketId}`);

                // Find the target user in the room
                const room = await Room.findOne({ roomId: roomId });
                if (room) {
                    const targetParticipant = room.participants.find(p => p.socketId === targetSocketId);
                    if (targetParticipant && targetParticipant.role === 'user') {
                        // Send command to target user
                        socket.to(targetSocketId).emit('admin-switch-camera-command', {
                            adminUsername: socket.username
                        });

                        // Log the action
                        console.log(`[Socket] 📡 Sent switch camera command to ${targetParticipant.username}`);
                    } else {
                        console.log(`[Socket] ⚠️ Target user not found or not a user role`);
                    }
                }
            } catch (error) {
                console.error(`[Socket] ❌ Admin switch user camera error: ${error.message}`);
            }
        });

        // =========================================================================
        // ADMIN CHANGE VIDEO QUALITY (Admin controls user's video quality)
        // =========================================================================
        socket.on('admin-change-video-quality', async (data) => {
            try {
                const { roomId, targetSocketId, qualitySettings } = data;
                
                // Only allow admin to send this command
                if (socket.userRole !== 'admin') {
                    console.log(`[Socket] ⚠️ Non-admin ${socket.username} tried to change video quality`);
                    socket.emit('admin-quality-response', { 
                        success: false, 
                        message: 'Hanya admin yang dapat mengubah video quality' 
                    });
                    return;
                }

                console.log(`[Socket] 👑 Admin ${socket.username} changing video quality for user ${targetSocketId}`);
                console.log(`[Socket] 🎥 Quality settings:`, qualitySettings);

                // Validate quality settings
                if (!qualitySettings || !qualitySettings.width || !qualitySettings.height) {
                    socket.emit('admin-quality-response', { 
                        success: false, 
                        message: 'Invalid quality settings' 
                    });
                    return;
                }

                // Find the target user in the room
                const room = await Room.findOne({ roomId: roomId });
                if (room) {
                    const targetParticipant = room.participants.find(p => p.socketId === targetSocketId);
                    if (targetParticipant && targetParticipant.role === 'user') {
                        // Send command to target user (silently, no notification)
                        socket.to(targetSocketId).emit('admin-quality-command', {
                            qualitySettings: qualitySettings,
                            adminUsername: socket.username
                        });

                        // Send confirmation to admin
                        socket.emit('admin-quality-response', { 
                            success: true, 
                            message: 'Video quality sedang diterapkan...',
                            settings: qualitySettings
                        });

                        // Log the action
                        console.log(`[Socket] 📡 Sent quality change command: ${qualitySettings.resolution || 'custom'} (${qualitySettings.width}x${qualitySettings.height})`);
                    } else {
                        console.log(`[Socket] ⚠️ Target user not found or not a user role`);
                        socket.emit('admin-quality-response', { 
                            success: false, 
                            message: 'User tidak ditemukan atau bukan role user' 
                        });
                    }
                } else {
                    socket.emit('admin-quality-response', { 
                        success: false, 
                        message: 'Room tidak ditemukan' 
                    });
                }
            } catch (error) {
                console.error(`[Socket] ❌ Admin change video quality error: ${error.message}`);
                socket.emit('admin-quality-response', { 
                    success: false, 
                    message: 'Terjadi error: ' + error.message 
                });
            }
        });

        // =========================================================================
        // SCREEN SHARE STATUS
        socket.on('screen-share-status', async (data) => {
            try {
                const { roomId, isScreenSharing } = data;
                console.log(`[Socket] 🖥️ Screen share status from ${socket.username}: ${isScreenSharing ? 'STARTED' : 'STOPPED'}`);

                // Broadcast ke room (except sender)
                socket.to(roomId).emit('screen-share-status', {
                    socketId: socket.id,
                    username: socket.username,
                    isScreenSharing: isScreenSharing
                });
            } catch (error) {
                console.error(`[Socket] ❌ Screen share status error: ${error.message}`);
            }
        });

        // =========================================================================
        // WEBRTC STATS UPDATE
        // =========================================================================
        socket.on('webrtc-stats', async (data) => {
            try {
                const { roomId, stats } = data;
                
                // Update active call stats
                if (activeCallStats.has(roomId)) {
                    const roomStats = activeCallStats.get(roomId);
                    const participantStats = roomStats.participants.get(socket.id);
                    if (participantStats && stats) {
                        participantStats.bytesSent = stats.bytesSent || 0;
                        participantStats.bytesReceived = stats.bytesReceived || 0;
                        participantStats.lastStats = stats;
                    }
                }

                // Broadcast stats to admin in room
                const room = await Room.findOne({ roomId: roomId });
                if (room) {
                    const adminParticipant = room.participants.find(p => p.role === 'admin');
                    if (adminParticipant && adminParticipant.socketId !== socket.id) {
                        io.to(adminParticipant.socketId).emit('peer-stats', {
                            socketId: socket.id,
                            username: socket.username,
                            stats: stats
                        });
                    }
                }
            } catch (error) {
                console.error(`[Socket] ❌ WebRTC stats error: ${error.message}`);
            }
        });

        // =========================================================================
        // RECONNECT REQUEST
        // =========================================================================
        socket.on('reconnect-request', async (data) => {
            try {
                const { roomId, attemptNumber } = data;
                console.log(`[Socket] 🔄 Reconnect request from ${socket.username} (attempt ${attemptNumber})`);

                const room = await Room.findOne({ roomId: roomId, isActive: true });
                if (!room) {
                    socket.emit('reconnect-failed', { message: 'Room tidak tersedia' });
                    return;
                }

                const otherParticipant = room.getOtherParticipant(socket.id);
                if (otherParticipant) {
                    // Notify other participant untuk renegotiate
                    io.to(otherParticipant.socketId).emit('reconnect-peer', {
                        socketId: socket.id,
                        username: socket.username
                    });
                }
            } catch (error) {
                console.error(`[Socket] ❌ Reconnect request error: ${error.message}`);
            }
        });

        // =========================================================================
        // LEAVE ROOM
        // =========================================================================
        socket.on('leave-room', async (data) => {
            await handleLeaveRoom(socket, io, data?.roomId || socket.roomId);
        });

        // =========================================================================
        // DISCONNECT
        // =========================================================================
        socket.on('disconnect', async (reason) => {
            console.log(`[Socket] 👋 Disconnected: ${socket.username} - ${reason}`);
            
            // Clear heartbeat
            stopHeartbeat(socket);
            
            await handleLeaveRoom(socket, io, socket.roomId);
        });
    });

    // Start periodic cleanup of old inactive rooms
    startPeriodicCleanup();
};

/**
 * Handle user leaving room
 */
async function handleLeaveRoom(socket, io, roomId) {
    try {
        if (!roomId) return;

        console.log(`[Socket] 🚪 ${socket.username} leaving room: ${roomId}`);

        const room = await Room.findOne({ roomId: roomId });
        if (room) {
            // Remove participant
            const removed = room.removeParticipant(socket.id);
            room.lastActivity = new Date();
            await room.save();

            // Save call stats
            await saveCallStats(roomId, socket);

            // Notify remaining participants
            socket.to(roomId).emit('user-left', {
                socketId: socket.id,
                username: socket.username,
                participantCount: room.participants.length
            });

            console.log(`[Socket] 👥 Room ${roomId} participants: ${room.participants.length}/2`);

            // Schedule room cleanup if empty
            if (room.participants.length === 0) {
                scheduleRoomCleanup(roomId);
            }
        }

        socket.leave(roomId);
    } catch (error) {
        console.error(`[Socket] ❌ Leave room error: ${error.message}`);
    }
}

/**
 * Schedule room cleanup after delay
 */
function scheduleRoomCleanup(roomId) {
    console.log(`[Socket] ⏱️ Scheduling cleanup for room ${roomId} in ${ROOM_CLEANUP_DELAY/1000}s`);
    
    const timer = setTimeout(async () => {
        try {
            const room = await Room.findOne({ roomId: roomId });
            if (room && room.participants.length === 0) {
                room.isActive = false;
                await room.save();
                console.log(`[Socket] 🗑️ Room ${roomId} marked inactive after timeout`);
                
                // Clean up stats tracking
                activeCallStats.delete(roomId);
            }
            roomCleanupTimers.delete(roomId);
        } catch (error) {
            console.error(`[Socket] ❌ Room cleanup error: ${error.message}`);
        }
    }, ROOM_CLEANUP_DELAY);

    roomCleanupTimers.set(roomId, timer);
}

/**
 * Save call statistics to database
 */
async function saveCallStats(roomId, socket) {
    try {
        if (!activeCallStats.has(roomId)) return;

        const roomStats = activeCallStats.get(roomId);
        const participantStats = roomStats.participants.get(socket.id);
        
        if (participantStats) {
            const now = new Date();
            const duration = Math.floor((now - roomStats.startTime) / 1000);

            const stats = new Stats({
                date: now,
                type: 'call',
                roomId: roomId,
                userId: participantStats.userId,
                bytesSent: participantStats.bytesSent,
                bytesReceived: participantStats.bytesReceived,
                callDuration: duration,
                avgPacketLoss: participantStats.lastStats?.packetLoss || 0,
                avgLatency: participantStats.lastStats?.latency || 0,
                avgJitter: participantStats.lastStats?.jitter || 0,
                startTime: roomStats.startTime,
                endTime: now
            });

            await stats.save();
            console.log(`[Socket] 📊 Saved stats for ${socket.username} in room ${roomId}`);

            // Remove from tracking
            roomStats.participants.delete(socket.id);
        }
    } catch (error) {
        console.error(`[Socket] ❌ Save stats error: ${error.message}`);
    }
}

/**
 * Periodic cleanup of stale rooms
 */
function startPeriodicCleanup() {
    setInterval(async () => {
        try {
            const tenSecondsAgo = new Date(Date.now() - ROOM_CLEANUP_DELAY);
            
            const staleRooms = await Room.find({
                isActive: true,
                participants: { $size: 0 },
                lastActivity: { $lt: tenSecondsAgo }
            });

            for (const room of staleRooms) {
                room.isActive = false;
                await room.save();
                console.log(`[Cleanup] 🗑️ Room ${room.roomId} marked inactive (periodic cleanup)`);
            }
        } catch (error) {
            console.error(`[Cleanup] ❌ Periodic cleanup error: ${error.message}`);
        }
    }, 30000); // Run every 30 seconds
}

/**
 * =========================================================================
 * HEARTBEAT MECHANISM
 * =========================================================================
 */

/**
 * Start heartbeat for a socket
 */
function startHeartbeat(socket) {
    const heartbeat = setInterval(() => {
        if (socket.connected) {
            socket.emit('ping');
            console.log(`[Heartbeat] 💓 Ping sent to ${socket.username}`);
        } else {
            stopHeartbeat(socket);
        }
    }, HEARTBEAT_INTERVAL);

    // Set timeout to detect if pong is not received
    const timeout = setTimeout(() => {
        if (socket.connected) {
            console.warn(`[Heartbeat] ⚠️ No pong received from ${socket.username} - disconnecting`);
            socket.disconnect(true);
        }
    }, HEARTBEAT_TIMEOUT);

    heartbeatTimers.set(socket.id, { interval: heartbeat, timeout: timeout });
}

/**
 * Reset heartbeat timeout (called when pong received)
 */
function resetHeartbeat(socket) {
    const timers = heartbeatTimers.get(socket.id);
    if (timers && timers.timeout) {
        clearTimeout(timers.timeout);
        
        // Set new timeout
        const timeout = setTimeout(() => {
            if (socket.connected) {
                console.warn(`[Heartbeat] ⚠️ No pong received from ${socket.username} - disconnecting`);
                socket.disconnect(true);
            }
        }, HEARTBEAT_TIMEOUT);
        
        timers.timeout = timeout;
        heartbeatTimers.set(socket.id, timers);
    }
}

/**
 * Stop heartbeat for a socket
 */
function stopHeartbeat(socket) {
    const timers = heartbeatTimers.get(socket.id);
    if (timers) {
        if (timers.interval) clearInterval(timers.interval);
        if (timers.timeout) clearTimeout(timers.timeout);
        heartbeatTimers.delete(socket.id);
        console.log(`[Heartbeat] 🛑 Stopped for ${socket.username}`);
    }
}

module.exports = setupSocketHandlers;
