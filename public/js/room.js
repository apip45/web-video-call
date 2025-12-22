/**
 * =============================================================================
 * ROOM CONTROLLER
 * =============================================================================
 * Main controller untuk halaman video call room
 * Menghubungkan WebRTC, Socket.IO, dan UI
 */

(function() {
    'use strict';

    // ==========================================================================
    // VARIABLES
    // ==========================================================================
    
    let socket = null;
    let webrtc = null;
    let mySocketId = null;
    let isFullscreen = false;

    // DOM Elements
    const elements = {
        localVideo: document.getElementById('localVideo'),
        remoteVideo: document.getElementById('remoteVideo'),
        remoteVideoWrapper: document.getElementById('remoteVideoWrapper'),
        localVideoWrapper: document.getElementById('localVideoWrapper'),
        waitingState: document.getElementById('waitingState'),
        connectionStatus: document.getElementById('connectionStatus'),
        statusText: document.getElementById('statusText'),
        remoteUsername: document.getElementById('remoteUsername'),
        remoteMuteIndicator: document.getElementById('remoteMuteIndicator'),
        remoteCameraIndicator: document.getElementById('remoteCameraIndicator'),
        localMuteIndicator: document.getElementById('localMuteIndicator'),
        micBtn: document.getElementById('micBtn'),
        cameraBtn: document.getElementById('cameraBtn'),
        switchCameraBtn: document.getElementById('switchCameraBtn'),
        endCallBtn: document.getElementById('endCallBtn'),
        audioOutputBtn: document.getElementById('audioOutputBtn'),
        fullscreenBtn: document.getElementById('fullscreenBtn'),
        toastContainer: document.getElementById('toastContainer'),
        videoContainer: document.getElementById('videoContainer')
    };

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================

    async function init() {
        console.log('[Room] 🚀 Initializing room...');
        console.log(`[Room] 📍 Room ID: ${ROOM_DATA.roomId}`);
        console.log(`[Room] 👤 User: ${ROOM_DATA.username}`);

        try {
            // Show connecting status
            showConnectionStatus('Menghubungkan ke server...');

            // Initialize Socket.IO
            initSocket();

            // Initialize WebRTC
            await initWebRTC();

            // Setup UI event listeners
            setupEventListeners();

            // Make PIP draggable
            makePIPDraggable();

            console.log('[Room] ✅ Room initialized successfully');
        } catch (error) {
            console.error('[Room] ❌ Initialization failed:', error);
            showToast('Gagal menginisialisasi: ' + error.message, 'error');
        }
    }

    // ==========================================================================
    // SOCKET.IO
    // ==========================================================================

    function initSocket() {
        console.log('[Room] 🔌 Connecting to Socket.IO...');

        socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        // Connection events
        socket.on('connect', () => {
            console.log(`[Room] ✅ Socket connected: ${socket.id}`);
            mySocketId = socket.id;
            
            // Join room
            socket.emit('join-room', { roomId: ROOM_DATA.roomId });
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Room] ⚠️ Socket disconnected: ${reason}`);
            showConnectionStatus('Koneksi terputus...');
        });

        socket.on('connect_error', (error) => {
            console.error('[Room] ❌ Socket connection error:', error);
            showToast('Gagal terhubung ke server', 'error');
        });

        // Room events
        socket.on('room-joined', handleRoomJoined);
        socket.on('room-full', handleRoomFull);
        socket.on('user-joined', handleUserJoined);
        socket.on('user-left', handleUserLeft);

        // WebRTC signaling events
        socket.on('offer', handleOffer);
        socket.on('answer', handleAnswer);
        socket.on('ice-candidate', handleIceCandidate);

        // Media status
        socket.on('media-status', handleRemoteMediaStatus);

        // Reconnection
        socket.on('reconnect-peer', handleReconnectPeer);
        socket.on('reconnect-failed', handleReconnectFailed);

        // Errors
        socket.on('error', (data) => {
            console.error('[Room] ❌ Server error:', data.message);
            showToast(data.message, 'error');
        });
    }

    // ==========================================================================
    // WEBRTC INITIALIZATION
    // ==========================================================================

    async function initWebRTC() {
        console.log('[Room] 📹 Initializing WebRTC...');

        webrtc = new WebRTCHandler({
            roomId: ROOM_DATA.roomId,
            userId: ROOM_DATA.userId,
            username: ROOM_DATA.username,
            iceServers: ROOM_DATA.iceServers,
            socket: socket,

            onRemoteStream: (stream) => {
                console.log('[Room] 📥 Remote stream received');
                elements.remoteVideo.srcObject = stream;
                hideWaitingState();
                hideConnectionStatus();
            },

            onConnectionStateChange: (state) => {
                console.log(`[Room] 🔄 Connection state: ${state}`);
                handleConnectionState(state);
            },

            onReconnectFailed: () => {
                console.error('[Room] ❌ Reconnection failed');
                showToast('Gagal menghubungkan kembali. Kembali ke home...', 'error');
                setTimeout(() => {
                    window.location.href = '/';
                }, 3000);
            },

            onError: (error) => {
                console.error('[Room] ❌ WebRTC error:', error);
                showToast(error.message, 'error');
            }
        });

        // Get local media stream
        try {
            showConnectionStatus('Mengakses kamera dan mikrofon...');
            const stream = await webrtc.getLocalStream();
            elements.localVideo.srcObject = stream;
            console.log('[Room] ✅ Local video set');
        } catch (error) {
            console.error('[Room] ❌ Failed to get local stream:', error);
            showToast('Gagal mengakses kamera/mikrofon', 'error');
            throw error;
        }
    }

    // ==========================================================================
    // SOCKET EVENT HANDLERS
    // ==========================================================================

    function handleRoomJoined(data) {
        console.log(`[Room] ✅ Joined room: ${data.roomId}`);
        console.log(`[Room] 👥 Participants: ${data.participantCount}`);
        console.log(`[Room] 🎯 Is initiator: ${data.isInitiator}`);

        webrtc.isInitiator = data.isInitiator;

        if (data.isInitiator) {
            // First user, wait for others
            hideConnectionStatus();
            showWaitingState();
        } else {
            // Second user, will receive offer
            hideConnectionStatus();
            showConnectionStatus('Menghubungkan video call...');
        }
    }

    function handleRoomFull(data) {
        console.log('[Room] ⚠️ Room is full');
        showToast(data.message, 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }

    function handleUserJoined(data) {
        console.log(`[Room] 👤 User joined: ${data.username} (${data.socketId})`);
        showToast(`${data.username} bergabung`, 'success');

        // Update remote username display
        elements.remoteUsername.textContent = data.username;

        // If I'm initiator, create offer
        if (webrtc.isInitiator) {
            console.log('[Room] 🎯 I am initiator, creating offer...');
            webrtc.createPeerConnection();
            webrtc.createOffer(data.socketId);
        }

        hideWaitingState();
    }

    function handleUserLeft(data) {
        console.log(`[Room] 👋 User left: ${data.username}`);
        showToast(`${data.username} keluar`, 'info');

        // Reset remote video
        elements.remoteVideo.srcObject = null;
        elements.remoteUsername.textContent = 'Menunggu...';

        // Show waiting state
        showWaitingState();

        // Close peer connection
        webrtc.closePeerConnection();
    }

    function handleOffer(data) {
        console.log(`[Room] 📥 Received offer from: ${data.senderUsername}`);
        elements.remoteUsername.textContent = data.senderUsername;
        webrtc.handleOffer(data.offer, data.senderSocketId, data.senderUsername);
    }

    function handleAnswer(data) {
        console.log(`[Room] 📥 Received answer from: ${data.senderUsername}`);
        webrtc.handleAnswer(data.answer, data.senderSocketId);
    }

    function handleIceCandidate(data) {
        webrtc.handleIceCandidate(data.candidate);
    }

    function handleRemoteMediaStatus(data) {
        console.log(`[Room] 📡 Remote media status: muted=${data.isMuted}, cameraOff=${data.isCameraOff}`);
        
        // Update indicators
        if (data.isMuted) {
            elements.remoteMuteIndicator.classList.remove('hidden');
        } else {
            elements.remoteMuteIndicator.classList.add('hidden');
        }

        if (data.isCameraOff) {
            elements.remoteCameraIndicator.classList.remove('hidden');
        } else {
            elements.remoteCameraIndicator.classList.add('hidden');
        }
    }

    function handleReconnectPeer(data) {
        console.log(`[Room] 🔄 Reconnect request from: ${data.username}`);
        webrtc.handleReconnectPeer(data.socketId, data.username);
    }

    function handleReconnectFailed(data) {
        console.error('[Room] ❌ Server rejected reconnect');
        showToast(data?.message || 'Reconnect gagal', 'error');
    }

    // ==========================================================================
    // CONNECTION STATE HANDLERS
    // ==========================================================================

    function handleConnectionState(state) {
        switch (state) {
            case 'checking':
                showConnectionStatus('Memeriksa koneksi...');
                break;
            case 'connected':
            case 'completed':
                hideConnectionStatus();
                hideWaitingState();
                showToast('Terhubung!', 'success');
                break;
            case 'disconnected':
                showConnectionStatus('Koneksi terputus, mencoba kembali...');
                break;
            case 'failed':
                showConnectionStatus('Koneksi gagal, mencoba kembali...');
                break;
        }
    }

    // ==========================================================================
    // UI CONTROLS
    // ==========================================================================

    function setupEventListeners() {
        // Handle visibility change (app goes to background)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('[Room] 📱 App went to background');
            } else {
                console.log('[Room] 📱 App came to foreground');
            }
        });

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            if (socket) {
                socket.emit('leave-room', { roomId: ROOM_DATA.roomId });
            }
            if (webrtc) {
                webrtc.cleanup();
            }
        });

        // Fullscreen change event
        document.addEventListener('fullscreenchange', () => {
            isFullscreen = !!document.fullscreenElement;
            updateFullscreenButton();
        });
    }

    // ==========================================================================
    // CONTROL BUTTON FUNCTIONS (Global)
    // ==========================================================================

    window.toggleMic = function() {
        if (!webrtc) return;
        
        const isMuted = webrtc.toggleMute();
        
        if (isMuted) {
            elements.micBtn.classList.add('muted');
            elements.localMuteIndicator.classList.remove('hidden');
        } else {
            elements.micBtn.classList.remove('muted');
            elements.localMuteIndicator.classList.add('hidden');
        }

        console.log(`[Room] 🎤 Mic: ${isMuted ? 'MUTED' : 'ON'}`);
    };

    window.toggleCamera = function() {
        if (!webrtc) return;
        
        const isCameraOff = webrtc.toggleCamera();
        
        if (isCameraOff) {
            elements.cameraBtn.classList.add('camera-off');
        } else {
            elements.cameraBtn.classList.remove('camera-off');
        }

        console.log(`[Room] 📹 Camera: ${isCameraOff ? 'OFF' : 'ON'}`);
    };

    window.switchCamera = async function() {
        if (!webrtc) return;
        
        const success = await webrtc.switchCamera();
        if (success) {
            showToast('Kamera diubah', 'success');
        } else {
            showToast('Gagal mengubah kamera', 'error');
        }
    };

    window.toggleAudioOutput = function() {
        if (!webrtc) return;
        
        const usingSpeaker = webrtc.toggleAudioOutput(elements.remoteVideo);
        
        if (usingSpeaker) {
            elements.audioOutputBtn.classList.remove('active');
        } else {
            elements.audioOutputBtn.classList.add('active');
        }

        showToast(usingSpeaker ? 'Speaker' : 'Earpiece', 'info');
    };

    window.toggleFullscreen = function() {
        if (!document.fullscreenElement) {
            elements.videoContainer.requestFullscreen().catch(err => {
                console.error('[Room] ❌ Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
    };

    window.endCall = function() {
        console.log('[Room] 📞 Ending call...');
        
        if (socket) {
            socket.emit('leave-room', { roomId: ROOM_DATA.roomId });
        }
        
        if (webrtc) {
            webrtc.cleanup();
        }
        
        window.location.href = '/';
    };

    window.copyRoomId = function() {
        navigator.clipboard.writeText(ROOM_DATA.roomId).then(() => {
            showToast('Room ID disalin!', 'success');
        }).catch(() => {
            showToast('Gagal menyalin', 'error');
        });
    };

    function updateFullscreenButton() {
        if (isFullscreen) {
            elements.fullscreenBtn.classList.add('active');
        } else {
            elements.fullscreenBtn.classList.remove('active');
        }
    }

    // ==========================================================================
    // UI HELPERS
    // ==========================================================================

    function showConnectionStatus(message) {
        elements.statusText.textContent = message;
        elements.connectionStatus.classList.add('visible');
    }

    function hideConnectionStatus() {
        elements.connectionStatus.classList.remove('visible');
    }

    function showWaitingState() {
        elements.waitingState.classList.remove('hidden');
    }

    function hideWaitingState() {
        elements.waitingState.classList.add('hidden');
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '';
        switch (type) {
            case 'success':
                icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
                break;
            case 'error':
                icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
                break;
            default:
                icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        }
        
        toast.innerHTML = `${icon}<span>${message}</span>`;
        elements.toastContainer.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==========================================================================
    // DRAGGABLE PIP
    // ==========================================================================

    function makePIPDraggable() {
        const pip = elements.localVideoWrapper;
        let isDragging = false;
        let startX, startY, startLeft, startBottom;

        pip.addEventListener('touchstart', handleDragStart, { passive: false });
        pip.addEventListener('mousedown', handleDragStart);

        function handleDragStart(e) {
            isDragging = true;
            
            const touch = e.touches ? e.touches[0] : e;
            startX = touch.clientX;
            startY = touch.clientY;
            
            const rect = pip.getBoundingClientRect();
            startLeft = rect.left;
            startBottom = window.innerHeight - rect.bottom;

            document.addEventListener('touchmove', handleDragMove, { passive: false });
            document.addEventListener('mousemove', handleDragMove);
            document.addEventListener('touchend', handleDragEnd);
            document.addEventListener('mouseup', handleDragEnd);

            pip.style.transition = 'none';
        }

        function handleDragMove(e) {
            if (!isDragging) return;
            e.preventDefault();

            const touch = e.touches ? e.touches[0] : e;
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            let newLeft = startLeft + deltaX;
            let newBottom = startBottom - deltaY;

            // Boundaries
            const maxLeft = window.innerWidth - pip.offsetWidth - 16;
            const maxBottom = window.innerHeight - pip.offsetHeight - 120;

            newLeft = Math.max(16, Math.min(newLeft, maxLeft));
            newBottom = Math.max(100, Math.min(newBottom, maxBottom));

            pip.style.left = `${newLeft}px`;
            pip.style.right = 'auto';
            pip.style.bottom = `${newBottom}px`;
        }

        function handleDragEnd() {
            isDragging = false;
            pip.style.transition = '';
            
            document.removeEventListener('touchmove', handleDragMove);
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('touchend', handleDragEnd);
            document.removeEventListener('mouseup', handleDragEnd);
        }
    }

    // ==========================================================================
    // START
    // ==========================================================================

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
