/**
 * =============================================================================
 * SOCKET HANDLER
 * =============================================================================
 * WebRTC signaling dengan Socket.IO
 * Handles: join room, offer, answer, ICE candidates, media status
 */

const Room = require('../models/Room');
const User = require('../models/User');

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
            console.log(`[Socket] 🔌 Connection authorized: ${socket.username}`);
            next();
        } else {
            console.log('[Socket] ⚠️ Unauthorized socket connection attempt');
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] ✅ Connected: ${socket.username} (${socket.id})`);

        // =========================================================================
        // JOIN ROOM
        // =========================================================================
        socket.on('join-room', async (data) => {
            try {
                const { roomId } = data;
                console.log(`[Socket] 🚪 ${socket.username} joining room: ${roomId}`);

                // Cari atau buat room
                let room = await Room.findOne({ roomId: roomId, isActive: true });
                
                if (!room) {
                    console.log(`[Socket] ❌ Room not found: ${roomId}`);
                    socket.emit('error', { message: 'Room tidak ditemukan' });
                    return;
                }

                // Cek apakah user sudah di room
                const existingParticipant = room.participants.find(
                    p => p.user && p.user.toString() === socket.userId.toString()
                );

                // Cek kapasitas room
                if (room.isFull() && !existingParticipant) {
                    console.log(`[Socket] ⚠️ Room full: ${roomId}`);
                    socket.emit('room-full', { message: 'Room sudah penuh (max 2 orang)' });
                    return;
                }

                // Tambah/update participant
                if (existingParticipant) {
                    existingParticipant.socketId = socket.id;
                    existingParticipant.joinedAt = new Date();
                } else {
                    room.participants.push({
                        user: socket.userId,
                        socketId: socket.id,
                        joinedAt: new Date()
                    });
                }

                await room.save();

                // Join socket room
                socket.join(roomId);
                socket.roomId = roomId;

                // Get other participant
                const otherParticipant = room.getOtherParticipant(socket.id);

                console.log(`[Socket] ✅ ${socket.username} joined room: ${roomId}`);
                console.log(`[Socket] 👥 Participants: ${room.participants.length}/2`);

                // Notify user of successful join
                socket.emit('room-joined', {
                    roomId: roomId,
                    participantCount: room.participants.length,
                    isInitiator: !otherParticipant // First user is initiator
                });

                // Notify other participant
                if (otherParticipant) {
                    console.log(`[Socket] 📢 Notifying other participant: ${otherParticipant.socketId}`);
                    io.to(otherParticipant.socketId).emit('user-joined', {
                        socketId: socket.id,
                        username: socket.username,
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
                    senderUsername: socket.username
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
                const { roomId, isMuted, isCameraOff } = data;
                console.log(`[Socket] 🎤 Media status from ${socket.username}: muted=${isMuted}, cameraOff=${isCameraOff}`);

                // Update di database
                const room = await Room.findOne({ roomId: roomId });
                if (room) {
                    const participant = room.participants.find(p => p.socketId === socket.id);
                    if (participant) {
                        participant.isMuted = isMuted;
                        participant.isCameraOff = isCameraOff;
                        await room.save();
                    }
                }

                // Broadcast ke room (except sender)
                socket.to(roomId).emit('media-status', {
                    socketId: socket.id,
                    username: socket.username,
                    isMuted: isMuted,
                    isCameraOff: isCameraOff
                });
            } catch (error) {
                console.error(`[Socket] ❌ Media status error: ${error.message}`);
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
            await handleLeaveRoom(socket, io, socket.roomId);
        });
    });
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
            await room.save();

            // Notify remaining participants
            socket.to(roomId).emit('user-left', {
                socketId: socket.id,
                username: socket.username,
                participantCount: room.participants.length
            });

            console.log(`[Socket] 👥 Room ${roomId} participants: ${room.participants.length}/2`);

            // Hapus room jika kosong
            if (room.participants.length === 0) {
                room.isActive = false;
                await room.save();
                console.log(`[Socket] 🗑️ Room ${roomId} marked inactive (empty)`);
            }
        }

        socket.leave(roomId);
    } catch (error) {
        console.error(`[Socket] ❌ Leave room error: ${error.message}`);
    }
}

module.exports = setupSocketHandlers;
