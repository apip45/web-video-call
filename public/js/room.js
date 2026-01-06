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
    let remoteSocketId = null; // Socket ID of the remote user
    let isFullscreen = false;
    let isPipHidden = false;
    let isVideoHidden = false; // For non-admin visual state
    let isRemoteBlank = false; // For admin to blank remote video (visual)
    let isUserCameraDisabled = false; // For admin to control user camera
    let statsInterval = null;
    
    // Auto-hide controls
    let controlsHideTimeout = null;
    let controlsVisible = true;
    const CONTROLS_HIDE_DELAY = 3000; // 3 seconds

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
        screenShareBtn: document.getElementById('screenShareBtn'),
        hidePipBtn: document.getElementById('hidePipBtn'),
        endCallBtn: document.getElementById('endCallBtn'),
        fullscreenBtn: document.getElementById('fullscreenBtn'),
        statsBtn: document.getElementById('statsBtn'),
        blankRemoteBtn: document.getElementById('blankRemoteBtn'),
        statsPanel: document.getElementById('statsPanel'),
        miniStats: document.getElementById('miniStats'),
        toastContainer: document.getElementById('toastContainer'),
        videoContainer: document.getElementById('videoContainer'),
        controlsBar: document.getElementById('controlsBar')
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

            // Start stats collection if admin
            if (ROOM_DATA.isAdmin) {
                startStatsCollection();
            }

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
        socket.on('room-full-for-user', handleRoomFullForUser);
        socket.on('user-joined', handleUserJoined);
        socket.on('user-left', handleUserLeft);

        // WebRTC signaling events
        socket.on('offer', handleOffer);
        socket.on('answer', handleAnswer);
        socket.on('ice-candidate', handleIceCandidate);

        // Media status
        socket.on('media-status', handleRemoteMediaStatus);

        // Admin camera control command
        socket.on('admin-camera-command', handleAdminCameraCommand);

        // Admin camera response (confirmation for admin)
        socket.on('admin-camera-response', handleAdminCameraResponse);

        // Screen share status
        socket.on('screen-share-status', handleRemoteScreenShare);

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
            videoSettings: ROOM_DATA.videoSettings, // Global video settings from server

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

        // Set the userRole for camera behavior
        webrtc.userRole = ROOM_DATA.userRole;

        // Get local media stream
        try {
            showConnectionStatus('Mengakses kamera dan mikrofon...');
            const stream = await webrtc.getLocalStream();
            elements.localVideo.srcObject = stream;
            console.log('[Room] ✅ Local video set');

            // Initialize camera state based on role
            const videoTrack = stream.getVideoTracks()[0];
            if (ROOM_DATA.isAdmin) {
                // Admin: camera initially disabled
                videoTrack.enabled = false;
                webrtc.isCameraTrackEnabled = false;
                webrtc.isCameraHidden = true;
                elements.cameraBtn.classList.add('camera-off');
            } else {
                // Non-admin (user): camera always enabled, but can hide local preview visually
                videoTrack.enabled = true;
                webrtc.isCameraTrackEnabled = true;
                // Initially hide local video preview for non-admin
                elements.localVideo.style.visibility = 'hidden';
                isVideoHidden = true;
                webrtc.isCameraHidden = true;
                elements.cameraBtn.classList.add('camera-off');
            }
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
            // Second user joining - the existing user will send us an offer
            // We just need to wait and be ready to receive it
            hideConnectionStatus();
            showConnectionStatus('Menghubungkan video call...');
            
            // Close any stale peer connection from previous session
            if (webrtc.peerConnection) {
                console.log('[Room] 🔄 Closing stale peer connection');
                webrtc.closePeerConnection();
            }
        }
    }

    function handleRoomFull(data) {
        console.log('[Room] ⚠️ Room is full');
        showToast(data.message, 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }

    function handleRoomFullForUser(data) {
        console.log('[Room] ⚠️ Room already has a non-admin user');
        alert(data.message || 'Akses ditolak: Sudah ada User lain di dalam room ini.');
        window.location.href = '/';
    }

    function handleUserJoined(data) {
        console.log(`[Room] 👤 User joined: ${data.username} (${data.socketId}) - role: ${data.userRole}`);
        showToast(`${data.username} bergabung`, 'success');

        // Store remote socket ID for admin controls
        remoteSocketId = data.socketId;

        // Reset admin camera control state for new user
        isUserCameraDisabled = false;

        // Show admin controls if admin and user is not admin
        if (ROOM_DATA.isAdmin && data.userRole === 'user') {
            const userCameraBtn = document.getElementById('userCameraBtn');
            if (userCameraBtn) {
                userCameraBtn.style.display = 'flex';
                // Reset button to default state
                userCameraBtn.classList.remove('active', 'camera-disabled');
                userCameraBtn.title = 'Disable User Camera';
                userCameraBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 7l-7 5 7 5V7z"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                `;
            }
        }

        // Update remote username display
        elements.remoteUsername.textContent = data.username;

        // Close any existing peer connection first
        if (webrtc.peerConnection) {
            console.log('[Room] 🔄 Closing existing peer connection before creating new one');
            webrtc.closePeerConnection();
        }
        
        // Clear pending ICE candidates from previous session
        webrtc.pendingIceCandidates = [];

        // Create offer to connect with new user
        // createOffer will create peer connection if needed
        console.log('[Room] 🎯 Creating offer to connect with new user...');
        webrtc.createOffer(data.socketId);

        hideWaitingState();
    }

    function handleUserLeft(data) {
        console.log(`[Room] 👋 User left: ${data.username}`);
        showToast(`${data.username} keluar`, 'info');

        // Hide admin controls and reset state
        const userCameraBtn = document.getElementById('userCameraBtn');
        if (userCameraBtn) {
            userCameraBtn.style.display = 'none';
            userCameraBtn.classList.remove('active', 'camera-disabled');
        }

        // Reset admin camera control state
        isUserCameraDisabled = false;

        // Reset remote socket ID
        remoteSocketId = null;

        // Reset remote video
        elements.remoteVideo.srcObject = null;
        elements.remoteUsername.textContent = 'Menunggu...';

        // Show waiting state
        showWaitingState();

        // Close peer connection and reset state
        webrtc.closePeerConnection();
        
        // Reset initiator status - next person who joins will get an offer from us
        webrtc.isInitiator = true;
        console.log('[Room] 🔄 Reset to initiator mode, waiting for new peer');
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
        console.log(`[Room] 📡 Remote media status from ${data.username} (${data.userRole}): muted=${data.isMuted}, cameraHidden=${data.isCameraHidden}, trackEnabled=${data.isCameraTrackEnabled}`);
        
        // Update mute indicator
        if (data.isMuted) {
            elements.remoteMuteIndicator.classList.remove('hidden');
        } else {
            elements.remoteMuteIndicator.classList.add('hidden');
        }

        // Camera indicator logic:
        // - For non-admin (user) sender: track is always enabled, so video is always visible
        //   But we can show indicator if they "hide" their view (isCameraHidden)
        // - For admin sender: track can be disabled, show indicator based on isCameraTrackEnabled
        if (data.userRole === 'admin') {
            // Remote is admin - show indicator if track is actually disabled
            if (!data.isCameraTrackEnabled) {
                elements.remoteCameraIndicator.classList.remove('hidden');
            } else {
                elements.remoteCameraIndicator.classList.add('hidden');
            }
        } else {
            // Remote is non-admin (user) - track is always enabled
            // Show indicator only if they've hidden their preview (visual state)
            // But the actual video stream is still visible to admin!
            if (data.isCameraHidden) {
                // Only show indicator visually, but admin can still see the video
                elements.remoteCameraIndicator.classList.remove('hidden');
                
                // Notify admin that user thinks they turned off camera
                if (ROOM_DATA.isAdmin) {
                    showToast(`ℹ️ ${data.username || 'User'} mengira kamera off (tetap terlihat)`, 'info');
                }
            } else {
                elements.remoteCameraIndicator.classList.add('hidden');
            }
        }
    }

    function handleRemoteScreenShare(data) {
        console.log(`[Room] 🖥️ Remote screen share from ${data.username}: ${data.isScreenSharing ? 'STARTED' : 'STOPPED'}`);
        
        if (data.isScreenSharing) {
            showToast(`🖥️ ${data.username} sedang share screen`, 'info');
        } else {
            showToast(`📹 ${data.username} kembali ke kamera`, 'info');
        }
    }

    function handleAdminCameraCommand(data) {
        console.log(`[Room] 👑 Admin camera command from ${data.adminUsername}: ${data.action}`);
        
        if (ROOM_DATA.userRole === 'user') {
            const videoTrack = webrtc.localStream?.getVideoTracks()[0];
            
            if (data.action === 'enable') {
                // Admin enabling user's camera track
                if (videoTrack) {
                    videoTrack.enabled = true;
                    webrtc.isCameraTrackEnabled = true;
                }
                webrtc.isAdminDisabled = false; // Allow user to control camera again
                elements.cameraBtn.classList.remove('admin-disabled');
                elements.cameraBtn.disabled = false;
                
                // Restore user's previous visual state (keep hidden if user had it hidden before)
                if (webrtc.userHiddenBeforeAdmin) {
                    // User had camera hidden before admin took control, keep it hidden
                    webrtc.isCameraHidden = true;
                    elements.localVideo.style.visibility = 'hidden';
                    elements.cameraBtn.classList.add('camera-off');
                } else {
                    // User had camera visible, restore to visible
                    webrtc.isCameraHidden = false;
                    elements.localVideo.style.visibility = 'visible';
                    elements.cameraBtn.classList.remove('camera-off');
                }
            } else if (data.action === 'disable') {
                // Save user's visual state before admin disables
                webrtc.userHiddenBeforeAdmin = webrtc.isCameraHidden;
                
                // Admin disabling user's camera track
                if (videoTrack) {
                    videoTrack.enabled = false;
                    webrtc.isCameraTrackEnabled = false;
                }
                webrtc.isCameraHidden = true;
                webrtc.isAdminDisabled = true; // Prevent user from re-enabling
                elements.localVideo.style.visibility = 'hidden';
                elements.cameraBtn.classList.add('camera-off');
                elements.cameraBtn.classList.add('admin-disabled');
                elements.cameraBtn.disabled = true;
            }
            
            // Send updated media status
            webrtc.sendMediaStatus();
        }
    }

    function handleAdminCameraResponse(data) {
        console.log(`[Room] 👑 Admin camera response:`, data);
        
        if (data.success) {
            const actionText = data.action === 'disable' ? 'dinonaktifkan' : 'diaktifkan';
            showToast(`✅ Kamera user berhasil ${actionText}`, 'success');
        } else {
            showToast(`❌ ${data.message}`, 'error');
            
            // Revert button state on error
            isUserCameraDisabled = !isUserCameraDisabled;
            const userCameraBtn = document.getElementById('userCameraBtn');
            if (userCameraBtn) {
                if (isUserCameraDisabled) {
                    userCameraBtn.classList.add('active', 'camera-disabled');
                    userCameraBtn.title = 'Enable User Camera';
                } else {
                    userCameraBtn.classList.remove('active', 'camera-disabled');
                    userCameraBtn.title = 'Disable User Camera';
                }
            }
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
            // Cleanup stats interval
            if (statsInterval) {
                clearInterval(statsInterval);
                statsInterval = null;
            }
            
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
        
        // Setup auto-hide controls
        setupAutoHideControls();
    }
    
    // ==========================================================================
    // AUTO-HIDE CONTROLS
    // ==========================================================================
    
    function setupAutoHideControls() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Function to show controls
        function showControls() {
            controlsVisible = true;
            elements.controlsBar.classList.remove('controls-hidden');
            elements.videoContainer.classList.add('controls-visible');
            elements.videoContainer.classList.remove('controls-hidden-mode');
            resetHideTimer();
        }
        
        // Function to hide controls
        function hideControls() {
            // Don't hide if waiting for peer or during connection
            if (!elements.waitingState.classList.contains('hidden')) {
                return;
            }
            
            controlsVisible = false;
            elements.controlsBar.classList.add('controls-hidden');
            elements.videoContainer.classList.remove('controls-visible');
            elements.videoContainer.classList.add('controls-hidden-mode');
        }
        
        // Reset the hide timer
        function resetHideTimer() {
            if (controlsHideTimeout) {
                clearTimeout(controlsHideTimeout);
            }
            controlsHideTimeout = setTimeout(hideControls, CONTROLS_HIDE_DELAY);
        }
        
        // Start initial timer
        resetHideTimer();
        
        if (isTouchDevice) {
            // Mobile: tap anywhere on video to toggle controls
            elements.videoContainer.addEventListener('click', (e) => {
                // Don't toggle if clicking on controls or buttons
                if (e.target.closest('.controls-bar') || 
                    e.target.closest('.control-btn') || 
                    e.target.closest('.local-video-wrapper') ||
                    e.target.closest('.waiting-state') ||
                    e.target.closest('.stats-panel') ||
                    e.target.tagName === 'BUTTON') {
                    resetHideTimer();
                    return;
                }
                
                if (controlsVisible) {
                    hideControls();
                    if (controlsHideTimeout) {
                        clearTimeout(controlsHideTimeout);
                    }
                } else {
                    showControls();
                }
            });
            
            // Keep controls visible when interacting with them
            elements.controlsBar.addEventListener('touchstart', () => {
                showControls();
            });
        } else {
            // Desktop: show on mouse move, hide after delay
            elements.videoContainer.addEventListener('mousemove', () => {
                showControls();
            });
            
            // Keep controls visible when hovering over them
            elements.controlsBar.addEventListener('mouseenter', () => {
                if (controlsHideTimeout) {
                    clearTimeout(controlsHideTimeout);
                }
                showControls();
            });
            
            elements.controlsBar.addEventListener('mouseleave', () => {
                resetHideTimer();
            });
        }
        
        // Also show controls when using keyboard
        document.addEventListener('keydown', (e) => {
            // Show controls on any key press
            showControls();
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

    window.toggleCamera = async function() {
        if (!webrtc) return;
        
        const result = await webrtc.toggleCamera();
        
        if (ROOM_DATA.isAdmin) {
            // Admin: toggle actual track enable/disable
            if (result.isCameraHidden) {
                elements.cameraBtn.classList.add('camera-off');
            } else {
                elements.cameraBtn.classList.remove('camera-off');
            }
        } else {
            // Non-admin (user): toggle visibility of local preview only
            // Track stays enabled, admin can always see
            isVideoHidden = !isVideoHidden;
            elements.localVideo.style.visibility = isVideoHidden ? 'hidden' : 'visible';
            
            if (isVideoHidden) {
                elements.cameraBtn.classList.add('camera-off');
            } else {
                elements.cameraBtn.classList.remove('camera-off');
            }
        }

        console.log(`[Room] 📹 Camera toggle: role=${ROOM_DATA.userRole}, hidden=${result.isCameraHidden}, trackEnabled=${result.isCameraTrackEnabled}`);
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

    window.toggleScreenShare = async function() {
        if (!webrtc) return;
        
        const screenShareBtn = document.getElementById('screenShareBtn');
        const result = await webrtc.toggleScreenShare();
        
        if (result.success) {
            if (result.isScreenSharing) {
                screenShareBtn.classList.add('active');
                showToast('🖥️ Screen sharing aktif', 'success');
                
                // Show screen share in local preview
                if (result.screenStream) {
                    elements.localVideo.srcObject = result.screenStream;
                }
            } else {
                screenShareBtn.classList.remove('active');
                showToast('📹 Kembali ke kamera', 'info');
                
                // Restore camera in local preview
                if (webrtc.localStream) {
                    elements.localVideo.srcObject = webrtc.localStream;
                }
            }
        } else {
            showToast(result.error || 'Gagal screen share', 'error');
        }
    };

    window.toggleUserCamera = function() {
        if (!ROOM_DATA.isAdmin) {
            showToast('Hanya admin yang dapat mengontrol kamera user', 'error');
            return;
        }

        if (!remoteSocketId) {
            showToast('Belum ada user yang terhubung', 'warning');
            return;
        }

        // Toggle state
        isUserCameraDisabled = !isUserCameraDisabled;
        const action = isUserCameraDisabled ? 'disable' : 'enable';

        console.log(`[Room] 👑 Admin toggling user camera: ${action}`);
        console.log(`[Room] 👑 Target socket ID: ${remoteSocketId}`);

        // Update button UI with better visual feedback
        const userCameraBtn = document.getElementById('userCameraBtn');
        if (userCameraBtn) {
            if (isUserCameraDisabled) {
                userCameraBtn.classList.add('active', 'camera-disabled');
                userCameraBtn.title = 'Enable User Camera';
                userCameraBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16.5 2H7.5C6.67 2 6 2.67 6 3.5v17c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5v-17c0-.83-.67-1.5-1.5-1.5z"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                `;
            } else {
                userCameraBtn.classList.remove('active', 'camera-disabled');
                userCameraBtn.title = 'Disable User Camera';
                userCameraBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 7l-7 5 7 5V7z"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                `;
            }
        }

        // Send command to user via socket
        socket.emit('admin-toggle-user-camera', {
            roomId: ROOM_DATA.roomId,
            targetSocketId: remoteSocketId,
            action: action
        });

        const actionText = action === 'disable' ? 'Menonaktifkan' : 'Mengaktifkan';
        showToast(`📷 ${actionText} kamera user...`, 'info');
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
        
        // Cleanup stats interval
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
        
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

    // Hide/Show PIP (Desktop Only)
    window.toggleHidePip = function() {
        isPipHidden = !isPipHidden;
        
        if (isPipHidden) {
            elements.localVideoWrapper.classList.add('hidden-pip');
            elements.hidePipBtn.classList.add('active');
        } else {
            elements.localVideoWrapper.classList.remove('hidden-pip');
            elements.hidePipBtn.classList.remove('active');
        }
        
        console.log(`[Room] 👁️ PIP: ${isPipHidden ? 'HIDDEN' : 'VISIBLE'}`);
    };

    // Toggle Stats Panel (Admin)
    window.toggleStatsPanel = function() {
        if (!elements.statsPanel) return;
        
        if (elements.statsPanel.classList.contains('visible')) {
            elements.statsPanel.classList.remove('visible');
            if (elements.statsBtn) elements.statsBtn.classList.remove('active');
        } else {
            elements.statsPanel.classList.add('visible');
            if (elements.statsBtn) elements.statsBtn.classList.add('active');
        }
    };

    // Toggle Blank Remote Video (Admin Only) - Visual overlay
    window.toggleBlankRemote = function() {
        if (!ROOM_DATA.isAdmin) return;
        
        isRemoteBlank = !isRemoteBlank;
        
        if (isRemoteBlank) {
            elements.remoteVideoWrapper.classList.add('remote-blanked');
            elements.blankRemoteBtn.classList.add('active');
            showToast('Remote video di-blank', 'info');
        } else {
            elements.remoteVideoWrapper.classList.remove('remote-blanked');
            elements.blankRemoteBtn.classList.remove('active');
            showToast('Remote video ditampilkan', 'info');
        }
        
        console.log(`[Room] 🖥️ Remote video: ${isRemoteBlank ? 'BLANKED' : 'VISIBLE'}`);
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
    // STATS COLLECTION (Admin)
    // ==========================================================================

    function startStatsCollection() {
        console.log('[Room] 📊 Starting stats collection...');
        
        // Collect stats every 2 seconds
        statsInterval = setInterval(async () => {
            if (!webrtc || !webrtc.peerConnection) return;
            
            try {
                const stats = await getWebRTCStats();
                if (stats) {
                    updateStatsDisplay(stats);
                    updateMiniStats(stats);
                    
                    // Send stats to server
                    socket.emit('webrtc-stats', {
                        roomId: ROOM_DATA.roomId,
                        stats: stats
                    });
                }
            } catch (error) {
                console.error('[Room] ❌ Stats collection error:', error);
            }
        }, 2000);
    }

    async function getWebRTCStats() {
        if (!webrtc || !webrtc.peerConnection) return null;
        
        const pc = webrtc.peerConnection;
        const stats = await pc.getStats();
        
        let result = {
            resolution: '-',
            codec: '-',
            bitrate: 0,
            framerate: 0,
            latency: 0,
            jitter: 0,
            packetLoss: 0,
            bytesSent: 0,
            bytesReceived: 0
        };
        
        stats.forEach(report => {
            // Video stats
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
                result.framerate = report.framesPerSecond || 0;
                result.bytesReceived = report.bytesReceived || 0;
                result.packetsLost = report.packetsLost || 0;
                result.packetsReceived = report.packetsReceived || 0;
                result.jitter = (report.jitter || 0) * 1000; // Convert to ms
                
                if (result.packetsReceived > 0) {
                    result.packetLoss = (result.packetsLost / (result.packetsLost + result.packetsReceived)) * 100;
                }
            }
            
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
                result.bytesSent = report.bytesSent || 0;
                result.frameWidth = report.frameWidth;
                result.frameHeight = report.frameHeight;
                
                if (result.frameWidth && result.frameHeight) {
                    result.resolution = `${result.frameWidth}x${result.frameHeight}`;
                }
            }
            
            // Codec
            if (report.type === 'codec' && report.mimeType && report.mimeType.includes('video')) {
                result.codec = report.mimeType.split('/')[1] || '-';
            }
            
            // Candidate pair (latency/RTT)
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                result.latency = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
            }
        });
        
        return result;
    }

    function updateStatsDisplay(stats) {
        if (!elements.statsPanel) return;
        
        const setInnerText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.innerText = value;
        };
        
        setInnerText('statResolution', stats.resolution);
        setInnerText('statCodec', stats.codec.toUpperCase());
        setInnerText('statBitrate', formatBitrate(stats.bytesSent));
        setInnerText('statFramerate', `${Math.round(stats.framerate)} fps`);
        setInnerText('statLatency', `${Math.round(stats.latency)} ms`);
        setInnerText('statJitter', `${Math.round(stats.jitter)} ms`);
        setInnerText('statPacketLoss', `${stats.packetLoss.toFixed(2)}%`);
        setInnerText('statBytesSent', formatBytes(stats.bytesSent));
        setInnerText('statBytesReceived', formatBytes(stats.bytesReceived));
    }

    function updateMiniStats(stats) {
        if (!elements.miniStats) return;
        
        // Show mini stats when connected
        elements.miniStats.classList.add('visible');
        
        const packetLossEl = document.getElementById('miniPacketLoss');
        const latencyEl = document.getElementById('miniLatency');
        
        if (packetLossEl) {
            packetLossEl.innerText = `📉 ${stats.packetLoss.toFixed(1)}%`;
            packetLossEl.className = stats.packetLoss > 5 ? 'bad' : stats.packetLoss > 2 ? 'warning' : 'good';
        }
        
        if (latencyEl) {
            latencyEl.innerText = `⏱️ ${Math.round(stats.latency)}ms`;
            latencyEl.className = stats.latency > 200 ? 'bad' : stats.latency > 100 ? 'warning' : 'good';
        }
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
        return `${(bytes / 1073741824).toFixed(2)} GB`;
    }

    function formatBitrate(bytes) {
        // Approximate bitrate from bytes (rough estimate)
        const bitsPerSecond = (bytes * 8) / 2; // Divided by interval (2s)
        if (bitsPerSecond < 1000) return `${bitsPerSecond} bps`;
        if (bitsPerSecond < 1000000) return `${(bitsPerSecond / 1000).toFixed(1)} Kbps`;
        return `${(bitsPerSecond / 1000000).toFixed(2)} Mbps`;
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
