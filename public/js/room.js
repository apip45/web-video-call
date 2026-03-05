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
    let remoteUserRole = null; // Role of the remote user ('admin' or 'user')
    let isFullscreen = false;
    let isPipHidden = false;
    let isVideoHidden = false; // For non-admin visual state
    let isRemoteBlank = false; // For admin to blank remote video (visual)
    let isUserCameraDisabled = false; // For admin to control user camera
    let statsInterval = null;
    let audioResetTimeout = null;  // Timeout for admin audio soft-reset confirmation
    let forceRejoinTimeout = null; // Timeout for admin force-rejoin pending state
    // Flag: getUserMedia has completed — safe to emit join-room.
    // Prevents race condition where offer arrives before local tracks are added
    // to the peer connection (which causes Chrome Mobile to skip MODE_IN_COMMUNICATION
    // and route audio to the regular speaker instead of earpiece).
    let webrtcReady = false;
    // Bandwidth delta tracking (for realtime kbps calculation)
    let prevBytesSent = 0;
    let prevBytesReceived = 0;
    let prevStatsTime = 0;
    
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

            // Initialize Socket.IO first (start connecting in background)
            initSocket();

            // Initialize WebRTC — getUserMedia happens here.
            // IMPORTANT: join-room is NOT emitted until this resolves (see initSocket).
            // This ensures local audio track is always present when peer connection is
            // created, so Chrome Mobile activates MODE_IN_COMMUNICATION (earpiece routing).
            await initWebRTC();

            // Mark WebRTC as ready — now safe to join the room
            webrtcReady = true;
            // If socket already connected while getUserMedia was running, emit now
            if (socket.connected) {
                console.log('[Room] 🚪 WebRTC ready + socket already connected — emitting join-room');
                socket.emit('join-room', { roomId: ROOM_DATA.roomId });
            }
            // Otherwise the socket 'connect' handler will emit once connected

            // Setup UI event listeners
            setupEventListeners();

            // Make PIP draggable
            makePIPDraggable();

            // Start stats collection for all users (mini stats visible to everyone)
            // Admin also gets the full stats panel + sends stats to server
            startStatsCollection();

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

            // Only emit join-room after getUserMedia has completed (webrtcReady).
            // If socket connects before getUserMedia finishes, init() will emit
            // join-room once initWebRTC() resolves (see init() above).
            if (webrtcReady) {
                console.log('[Room] 🚪 Socket connected + WebRTC already ready — emitting join-room');
                socket.emit('join-room', { roomId: ROOM_DATA.roomId });
            } else {
                console.log('[Room] ⏳ Socket connected — waiting for WebRTC ready before join-room');
            }
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

        // Media sync - peer requests we send our current media state
        socket.on('media-sync-requested', () => {
            console.log('[Room] 🔄 Media sync requested by peer - sending our status');
            if (webrtc) webrtc.sendMediaStatus();
        });

        // Focus control (client side - receives commands from admin)
        socket.on('request-focus-capabilities', handleFocusCapabilitiesRequest);
        socket.on('focus-command', handleFocusCommand);
        socket.on('poi-command', handlePOICommand);

        // Focus control (admin side - receives capability response from client)
        socket.on('focus-capabilities-response', handleFocusCapabilitiesResponse);

        // Admin camera control command
        socket.on('admin-camera-command', handleAdminCameraCommand);

        // Admin camera response (confirmation for admin)
        socket.on('admin-camera-response', handleAdminCameraResponse);

        // Admin switch camera command
        socket.on('admin-switch-camera-command', handleAdminSwitchCameraCommand);

        // Admin video quality command
        socket.on('admin-quality-command', handleAdminQualityCommand);

        // Admin quality response (confirmation for admin)
        socket.on('admin-quality-response', handleAdminQualityResponse);

        // Screen share status
        socket.on('screen-share-status', handleRemoteScreenShare);

        // Reconnection
        socket.on('reconnect-peer', handleReconnectPeer);
        socket.on('reconnect-failed', handleReconnectFailed);

        // Heartbeat - respond to server pings
        socket.on('ping', () => {
            socket.emit('pong');
        });

        // Audio reset: admin-triggered force restart (user side)
        socket.on('force-audio-reset', handleForceAudioReset);

        // Audio reset: confirmation from user (admin side)
        socket.on('audio-reset-confirmed', handleAudioResetConfirmed);

        // Guard blocked feedback (admin control disabled or user gone)
        socket.on('audio-reset-blocked', (data) => {
            if (!ROOM_DATA.isAdmin) return;
            if (audioResetTimeout) { clearTimeout(audioResetTimeout); audioResetTimeout = null; }
            setAudioResetBtnState('error', '\u2717 ' + (data?.message || 'Perintah ditolak server'));
            setTimeout(resetAudioResetBtnToDefault, 3000);
        });
        socket.on('force-rejoin-blocked', (data) => {
            if (!ROOM_DATA.isAdmin) return;
            if (forceRejoinTimeout) { clearTimeout(forceRejoinTimeout); forceRejoinTimeout = null; }
            setRejoinBtnState('error', '\u2717 ' + (data?.message || 'Perintah ditolak server'));
            setTimeout(() => setRejoinBtnState('idle'), 3000);
        });

        // Force rejoin: admin commanded page reload (user side)
        socket.on('force-rejoin', handleForceRejoin);

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
        console.log(`[Room] 🎯 Mode: ${ROOM_DATA.webrtcMode || 'mesh'}`);

        webrtc = new WebRTCHandler({
            roomId: ROOM_DATA.roomId,
            userId: ROOM_DATA.userId,
            username: ROOM_DATA.username,
            iceServers: ROOM_DATA.iceServers,
            socket: socket,
            mode: ROOM_DATA.webrtcMode || 'mesh',  // 'mesh' or 'sfu'
            ionSFUConfig: ROOM_DATA.ionSFUConfig,  // Ion-SFU config (if SFU mode)
            videoSettings: ROOM_DATA.videoSettings, // Global video settings from server

            onRemoteStream: (stream) => {
                console.log('[Room] 📥 Remote stream received');
                elements.remoteVideo.srcObject = stream;
                hideWaitingState();
                hideConnectionStatus();
                // Explicitly call play() after setting srcObject.
                // On Chrome Mobile, after a reconnect the browser may not auto-play the new
                // stream, which prevents it from registering in "call audio" mode (earpiece).
                elements.remoteVideo.play().catch(err => {
                    // Autoplay may be blocked before user interaction — not critical,
                    // the browser will play once the user interacts with the page.
                    console.warn('[Room] ⚠️ remoteVideo.play() blocked:', err.message);
                });
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
                // User: camera OFF by default (admin can turn it on remotely if control is enabled)
                videoTrack.enabled = false;
                webrtc.isCameraTrackEnabled = false;
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
        console.log(`[Room] 🎯 Mode: ${ROOM_DATA.webrtcMode || 'mesh'}`);

        webrtc.isInitiator = data.isInitiator;

        // Handle based on WebRTC mode
        if (ROOM_DATA.webrtcMode === 'sfu') {
            // SFU mode: Start session immediately
            handleRoomJoinedSFU(data);
        } else {
            // Mesh mode: Original P2P signaling logic
            handleRoomJoinedMesh(data);
        }
    }
    
    /**
     * Handle room joined in Mesh P2P mode
     */
    function handleRoomJoinedMesh(data) {
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

            // If server told us who is already in the room (reconnect scenario),
            // pre-populate remoteSocketId and show correct admin controls
            if (data.existingParticipant && data.existingParticipant.socketId) {
                remoteSocketId = data.existingParticipant.socketId;
                remoteUserRole = data.existingParticipant.role;
                console.log(`[Room] 📡 Pre-populated remote info from room-joined: ${remoteSocketId} (${remoteUserRole})`);
                updateAdminControlsVisibility();
            }
        }
    }
    
    /**
     * Handle room joined in SFU mode
     */
    async function handleRoomJoinedSFU(data) {
        try {
            hideConnectionStatus();
            showConnectionStatus('Menghubungkan ke SFU server...');
            
            console.log('[Room] 🚀 Starting SFU session...');
            
            // Start SFU session (connect, join, publish)
            await webrtc.startSFUSession();
            
            hideConnectionStatus();
            
            // In SFU mode, we're always connected to server
            // Remote stream will come via onRemoteTrack callback
            if (data.participantCount === 1) {
                showWaitingState();
            }
            
            console.log('[Room] ✅ SFU session started');
            showToast('Terhubung ke server SFU', 'success');
            
        } catch (error) {
            console.error('[Room] ❌ Failed to start SFU session:', error);
            showToast('Gagal terhubung ke server SFU: ' + error.message, 'error');
            hideConnectionStatus();
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

    async function handleUserJoined(data) {
        console.log(`[Room] 👤 User joined: ${data.username} (${data.socketId}) - role: ${data.userRole}`);
        showToast(`${data.username} bergabung`, 'success');

        // Cancel any pending reconnect that was scheduled due to ICE failure.
        // The peer has rejoined - a fresh offer/answer will re-establish everything.
        if (webrtc) webrtc.cancelReconnect();

        // Store remote socket ID and role for admin controls
        remoteSocketId = data.socketId;
        remoteUserRole = data.userRole;

        // Reset admin camera control state for new user
        isUserCameraDisabled = false;

        // Show / hide admin controls based on who just joined
        updateAdminControlsVisibility();
        // Refresh audio panel user section if open
        updateAudioPanelUserSection();
        // If a force-rejoin was pending, this join is the confirmation
        if (forceRejoinTimeout) {
            clearTimeout(forceRejoinTimeout);
            forceRejoinTimeout = null;
            showToast(`✅ ${data.username} berhasil rejoin — audio seharusnya normal`, 'success');
            setRejoinBtnState('idle');
        }

        // Update remote username display
        elements.remoteUsername.textContent = data.username;

        // Close any existing peer connection first
        if (webrtc.peerConnection) {
            console.log('[Room] 🔄 Closing existing peer connection before creating new one');
            // If there was an active connection, audio restart will be triggered automatically
            // by _audioRestartNeeded flag set inside closePeerConnection()
            webrtc.closePeerConnection();
        } else {
            // No existing connection but we're handling a new user-joined:
            // this can happen after a disconnect where the watchdog/ICE already cleaned up
            // the peer connection but Chrome still lost its communication audio mode.
            // Force audio restart on the next successful connection.
            webrtc._audioRestartNeeded = true;
        }
        
        // Wait a bit for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
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

        // Cancel any pending reconnect timers — peer has disconnected intentionally,
        // a new user-joined will trigger fresh renegotiation.
        if (webrtc) webrtc.cancelReconnect();

        // Hide admin controls and reset state
        remoteSocketId = null;
        remoteUserRole = null;
        updateAdminControlsVisibility();
        // Refresh audio panel user section (will switch to "no user" state)
        updateAudioPanelUserSection();
        // If a soft audio-reset was pending, cancel it (user gone = no response coming)
        if (audioResetTimeout) {
            clearTimeout(audioResetTimeout);
            audioResetTimeout = null;
            resetAudioResetBtnToDefault();
        }
        // If a force-rejoin was pending, DON'T cancel it — the user is reloading and
        // will rejoin shortly. handleUserJoined will detect the pending timeout and
        // show the success confirmation. Update button to "rejoining" state.
        if (forceRejoinTimeout) {
            setRejoinBtnState('loading', 'User sedang rejoin\u2026');
        }

        // Also clear left-over active/disabled class from user camera button
        const userCameraBtn = document.getElementById('userCameraBtn');
        if (userCameraBtn) {
            userCameraBtn.classList.remove('active', 'camera-disabled');
            userCameraBtn.title = 'Nonaktifkan kamera user';
        }
        
        // Reset admin camera control state
        isUserCameraDisabled = false;

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

        // Reset focus panel state
        adminFocusCapabilities = null;
        if (adminPOIActive) deactivatePOI();
        updateFocusPanelUI();
    }

    async function handleOffer(data) {
        console.log(`[Room] 📥 Received offer from: ${data.senderUsername} (${data.senderSocketId})`);
        
        // CRITICAL: Update remoteSocketId from offer — this handles the reconnect scenario
        // where WE are the rejoining side and the staying peer sends us an offer first.
        // Without this, admin commands would fail because remoteSocketId stays null.
        remoteSocketId = data.senderSocketId;
        remoteUserRole = data.senderRole || null;
        elements.remoteUsername.textContent = data.senderUsername;
        updateAdminControlsVisibility();
        
        // Close any existing peer connection before handling new offer
        if (webrtc.peerConnection) {
            console.log('[Room] 🔄 Closing existing peer connection before handling new offer');
            webrtc.closePeerConnection();
            // Wait a bit for cleanup
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        webrtc.handleOffer(data.offer, data.senderSocketId, data.senderUsername);
    }

    function handleAnswer(data) {
        console.log(`[Room] 📥 Received answer from: ${data.senderUsername} (${data.senderSocketId})`);
        // Keep remoteSocketId fresh — answer carries the answerer's socket ID
        if (data.senderSocketId && !remoteSocketId) {
            remoteSocketId = data.senderSocketId;
            console.log(`[Room] 📡 Set remoteSocketId from answer: ${remoteSocketId}`);
            updateAdminControlsVisibility();
        }
        webrtc.handleAnswer(data.answer, data.senderSocketId);
    }

    function handleIceCandidate(data) {
        webrtc.handleIceCandidate(data.candidate);
    }

    function handleRemoteMediaStatus(data) {
        console.log(`[Room] 📡 Remote media status from ${data.username} (${data.userRole}): muted=${data.isMuted}, cameraHidden=${data.isCameraHidden}, trackEnabled=${data.isCameraTrackEnabled}`);
        
        // Store remote socket ID and role if available (keeps remoteSocketId always fresh)
        if (data.socketId) {
            if (!remoteSocketId) {
                remoteSocketId = data.socketId;
                console.log(`[Room] 📡 Set remoteSocketId from media status: ${remoteSocketId}`);
            }
            if (!remoteUserRole) {
                remoteUserRole = data.userRole;
                updateAdminControlsVisibility();
            }
        }
        
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
        if (!data || !data.action) {
            console.warn('[Room] ⚠️ handleAdminCameraCommand: invalid data', data);
            return;
        }
        console.log(`[Room] 👑 Admin camera command received:`, data);
        console.log(`[Room] 👑 Current userRole: ${ROOM_DATA.userRole}`);
        
        if (ROOM_DATA.userRole === 'user') {
            const videoTrack = webrtc.localStream?.getVideoTracks()[0];
            console.log(`[Room] 👑 Video track found: ${!!videoTrack}`);
            
            if (data.action === 'on') {
                // Admin forcing track ON
                if (videoTrack) {
                    videoTrack.enabled = true;
                    webrtc.isCameraTrackEnabled = true;
                    console.log(`[Room] 👑 Video track enabled: ${videoTrack.enabled}`);
                }
                webrtc.isAdminDisabled = false; // Clear admin block so user can self-toggle again
                // Restore preview if user had hidden it before admin disabled
                console.log('[Room] 👑 Track enabled by admin, admin block cleared');
            } else if (data.action === 'off') {
                // Admin forcing track OFF
                if (videoTrack) {
                    videoTrack.enabled = false;
                    webrtc.isCameraTrackEnabled = false;
                    console.log(`[Room] 👑 Video track disabled: ${videoTrack.enabled}`);
                }
                webrtc.isAdminDisabled = true; // Prevent user from re-enabling via their own toggle
                console.log('[Room] 👑 Track disabled by admin, admin block set');
            } else {
                console.log(`[Room] 👑 Unknown action: ${data.action}`);
            }
            
            // Send updated media status
            webrtc.sendMediaStatus();
            console.log('[Room] 👑 Media status sent');
        } else {
            console.log(`[Room] 👑 Ignoring command - not a user role`);
        }
    }

    function handleAdminCameraResponse(data) {
        console.log(`[Room] 👑 Admin camera response:`, data);
        
        if (data.success) {
            const actionText = data.action === 'on' ? 'diaktifkan' : 'dinonaktifkan';
            showToast(`✅ Kamera user ${actionText}`, 'success');
        } else {
            showToast(`❌ ${data.message}`, 'error');
        }
    }

    async function handleAdminSwitchCameraCommand(data) {
        if (!data) return;
        console.log(`[Room] 👑 Admin switch camera command from ${data.adminUsername || 'admin'}`);
        
        if (ROOM_DATA.userRole === 'user') {
            // Execute camera switch silently (no notification to user)
            await webrtc.switchCamera();
        }
    }

    async function handleAdminQualityCommand(data) {
        if (!data) return;
        console.log(`[Room] 👑 Admin quality command received:`, data);
        console.log(`[Room] 👑 Current userRole: ${ROOM_DATA.userRole}`);
        
        if (ROOM_DATA.userRole === 'user') {
            const { qualitySettings } = data;
            
            if (!qualitySettings) {
                console.error('[Room] ❌ No quality settings provided');
                return;
            }

            console.log(`[Room] 🎥 Applying quality settings:`, qualitySettings);
            
            // Apply video quality silently (no notification to user)
            const result = await webrtc.applyVideoQuality(qualitySettings);
            
            if (result.success) {
                console.log(`[Room] ✅ Video quality applied:`, result.appliedSettings);
                
                // If resolution fell back, log it but don't notify user
                if (result.appliedSettings.fellBack) {
                    console.log(`[Room] ⚠️ Fell back from ${result.appliedSettings.originalResolution} to ${result.appliedSettings.resolution}`);
                }
            } else {
                console.error(`[Room] ❌ Failed to apply video quality:`, result.error);
            }
        } else {
            console.log(`[Room] 👑 Ignoring quality command - not a user role`);
        }
    }

    function handleAdminQualityResponse(data) {
        if (!data) return;
        console.log(`[Room] 👑 Admin quality response:`, data);
        
        if (data.success) {
            showToast(`✅ ${data.message}`, 'success');
        } else {
            showToast(`❌ ${data.message}`, 'error');
        }
    }

    function handleReconnectPeer(data) {
        if (!data || !data.socketId) return;
        console.log(`[Room] 🔄 Reconnect request from: ${data.username}`);
        webrtc.handleReconnectPeer(data.socketId, data.username);
    }

    function handleReconnectFailed(data) {
        console.error('[Room] ❌ Server rejected reconnect');
        showToast(data?.message || 'Reconnect gagal', 'error');
    }

    // ==========================================================================
    // AUDIO RESET HANDLERS
    // ==========================================================================

    /**
     * User side: admin commanded an audio track restart.
     */
    async function handleForceAudioReset(data) {
        console.log(`[Room] 🔊 Force audio reset received from admin (${data?.by})`);
        if (!webrtc) {
            socket.emit('audio-reset-done', { roomId: ROOM_DATA.roomId, success: false });
            return;
        }
        const success = await webrtc.restartAudioTrack();
        socket.emit('audio-reset-done', { roomId: ROOM_DATA.roomId, success });
        if (success) {
            showToast('🔊 Admin me-reset audio — mencoba kembali ke mode komunikasi', 'info');
        }
    }

    /**
     * User side: admin commanded a full page reload (reliable audio fix).
     * After reload the user automatically rejoins the same room.
     */
    async function handleForceRejoin(data) {
        console.log(`[Room] 🔄 Force rejoin commanded by admin: ${data?.by}`);
        showToast(`Admin me-refresh halaman untuk memperbaiki audio…`, 'info');
        await new Promise(r => setTimeout(r, 1500));
        window.location.reload();
    }

    /**
     * Admin side: confirmation from user that soft-reset completed.
     */
    function handleAudioResetConfirmed(data) {
        if (!ROOM_DATA.isAdmin) return;
        // Clear pending timeout regardless of result
        if (audioResetTimeout) {
            clearTimeout(audioResetTimeout);
            audioResetTimeout = null;
        }
        if (data.success) {
            setAudioResetBtnState('success', '✓ Audio berhasil di-reset');
            showToast(`✅ Audio ${data.username || 'user'} berhasil di-reset`, 'success');
        } else {
            setAudioResetBtnState('error', '✗ Reset gagal di sisi user');
            showToast(`❌ Audio reset gagal di perangkat user`, 'error');
        }
        setTimeout(resetAudioResetBtnToDefault, 3000);
    }

    // ==========================================================================
    // FOCUS CONTROL HANDLERS
    // ==========================================================================

    // --- CLIENT SIDE (non-admin: receives commands, applies to own camera) ---

    async function handleFocusCapabilitiesRequest() {
        if (ROOM_DATA.isAdmin) return; // Only non-admin responds
        console.log('[Room] 🎯 Focus capabilities requested by admin');

        if (!socket) return;

        if (!webrtc) {
            socket.emit('focus-capabilities-response', {
                roomId: ROOM_DATA.roomId,
                capabilities: { supported: false, reason: 'webrtc_not_ready' }
            });
            return;
        }

        const capabilities = webrtc.getFocusCapabilities();
        socket.emit('focus-capabilities-response', {
            roomId: ROOM_DATA.roomId,
            capabilities
        });

        console.log('[Room] 🎯 Focus capabilities sent:', capabilities.supported);
    }

    async function handleFocusCommand(data) {
        if (ROOM_DATA.isAdmin) return;
        if (!data || !data.focusMode) {
            console.warn('[Room] ⚠️ handleFocusCommand: invalid data', data);
            return;
        }
        console.log('[Room] 🎯 Focus command received:', data);

        if (!webrtc) return;
        const result = await webrtc.applyFocus({
            focusMode: data.focusMode,
            focusDistance: data.focusDistance
        });

        if (!result.success) {
            console.warn('[Room] ⚠️ Focus command failed:', result.error);
        }
    }

    async function handlePOICommand(data) {
        if (ROOM_DATA.isAdmin) return;
        if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') {
            console.warn('[Room] ⚠️ handlePOICommand: invalid data', data);
            return;
        }
        console.log('[Room] 🎯 POI command received:', data);

        if (!webrtc) return;
        const result = await webrtc.setPointOfInterest(data.x, data.y);

        if (!result.success) {
            console.warn('[Room] ⚠️ POI command failed:', result.error);
        }
    }

    // --- ADMIN SIDE (sends commands, receives capability response) ---

    let adminFocusCapabilities = null; // capabilities object from client
    let adminFocusMode = 'auto';       // 'auto' | 'manual'
    let adminFocusDistance = 0.5;
    let adminPOIActive = false;
    let focusIndicatorTimer = null;    // timer for phase-2 of focus ring animation

    function handleFocusCapabilitiesResponse(data) {
        if (!ROOM_DATA.isAdmin) return;
        if (!data || !data.capabilities) {
            console.warn('[Room] ⚠️ handleFocusCapabilitiesResponse: missing capabilities');
            return;
        }
        console.log('[Room] 🎯 Focus capabilities received:', data.capabilities);
        adminFocusCapabilities = data.capabilities;
        updateFocusPanelUI();
    }

    window.requestFocusCapabilities = function() {
        if (!socket) return;
        if (!remoteSocketId) {
            showToast('Belum ada user yang terhubung', 'warning');
            return;
        }
        console.log('[Room] 🎯 Requesting focus capabilities from client...');
        socket.emit('request-focus-capabilities', { roomId: ROOM_DATA.roomId });
    };

    /**
     * Update all focus panel UI elements based on current state.
     */
    function updateFocusPanelUI() {
        const focusUnsupported = document.getElementById('focusUnsupported');
        const focusControls   = document.getElementById('focusControls');
        if (!focusUnsupported || !focusControls) return;

        if (!adminFocusCapabilities || !adminFocusCapabilities.supported) {
            focusUnsupported.style.display = 'flex';
            focusControls.style.display = 'none';
            return;
        }

        focusUnsupported.style.display = 'none';
        focusControls.style.display = 'block';

        // Focus mode buttons
        const btnAuto   = document.getElementById('focusModeAuto');
        const btnManual = document.getElementById('focusModeManual');
        if (btnAuto)   btnAuto.classList.toggle('active', adminFocusMode === 'auto');
        if (btnManual) btnManual.classList.toggle('active', adminFocusMode === 'manual');

        // Focus distance slider
        const slider    = document.getElementById('focusDistanceSlider');
        const sliderVal = document.getElementById('focusDistanceValue');
        if (slider) {
            const cap = adminFocusCapabilities.focusDistance;
            if (cap) {
                const capMin = parseFloat(cap.min);
                const capMax = parseFloat(cap.max);
                slider.min  = capMin;
                slider.max  = capMax;
                slider.step = cap.step || 0.01;

                // Only seed the value if admin's current setting is outside the device's range
                // (e.g. default 0.5 may be outside a device's 1–10 range).
                // Once the admin has touched the slider, preserve their choice.
                if (adminFocusDistance < capMin || adminFocusDistance > capMax) {
                    const current = adminFocusCapabilities.currentFocusDistance;
                    adminFocusDistance = current !== undefined
                        ? parseFloat(current)
                        : (capMin + capMax) / 2;
                }
                slider.value = adminFocusDistance;
                if (sliderVal) sliderVal.textContent = adminFocusDistance.toFixed(2);
            }
            slider.disabled = (adminFocusMode !== 'manual');
        }

        // POI toggle
        const poiToggle = document.getElementById('poiToggle');
        const poiBtnText = document.getElementById('poiBtnText');
        const poiHint   = document.getElementById('poiHint');
        if (adminFocusCapabilities.pointOfInterest) {
            if (poiToggle) poiToggle.style.display = 'flex';
        } else {
            if (poiToggle) poiToggle.style.display = 'none';
            if (poiHint)   poiHint.style.display   = 'none';
        }
        if (poiToggle)  poiToggle.classList.toggle('active', adminPOIActive);
        if (poiBtnText) poiBtnText.textContent = adminPOIActive ? 'POI: ON' : 'POI: OFF';
        if (poiHint)    poiHint.style.display  = adminPOIActive ? 'block' : 'none';
    }

    window.toggleFocusPanel = function() {
        const panel    = document.getElementById('focusPanel');
        const focusBtn = document.getElementById('focusBtn');
        if (!panel) return;

        const isOpen = panel.classList.contains('visible');

        // Close other panels first
        document.getElementById('qualityPanel')?.classList.remove('visible');
        document.getElementById('qualityBtn')?.classList.remove('active');
        document.getElementById('statsPanel')?.classList.remove('visible');
        document.getElementById('statsBtn')?.classList.remove('active');
        document.getElementById('audioPanel')?.classList.remove('visible');
        document.getElementById('audioBtn')?.classList.remove('active');

        if (isOpen) {
            panel.classList.remove('visible');
            if (focusBtn) focusBtn.classList.remove('active');
            // Deactivate POI when panel closes
            if (adminPOIActive) deactivatePOI();
        } else {
            panel.classList.add('visible');
            if (focusBtn) focusBtn.classList.add('active');
            // Auto-request capabilities
            if (remoteSocketId && !adminFocusCapabilities) {
                window.requestFocusCapabilities();
            } else {
                updateFocusPanelUI();
            }
        }
    };

    window.setAdminFocusMode = function(mode) {
        if (!ROOM_DATA.isAdmin) return;
        if (!remoteSocketId) {
            showToast('Belum ada user yang terhubung', 'warning');
            return;
        }
        if (!adminFocusCapabilities?.supported) {
            showToast('Client tidak support manual focus', 'warning');
            return;
        }

        adminFocusMode = mode;

        if (socket) {
            socket.emit('set-focus', {
                roomId: ROOM_DATA.roomId,
                targetSocketId: remoteSocketId,
                focusMode: mode,
                focusDistance: mode === 'manual' ? adminFocusDistance : undefined
            });
        }

        // Turn off POI if switching back to auto
        if (mode === 'auto' && adminPOIActive) deactivatePOI();

        updateFocusPanelUI();
        showToast(`🎯 Focus mode: ${mode}`, 'info');
    };

    window.onFocusDistanceChange = function() {
        const slider    = document.getElementById('focusDistanceSlider');
        const sliderVal = document.getElementById('focusDistanceValue');
        if (!slider) return;
        adminFocusDistance = parseFloat(slider.value);
        if (sliderVal) sliderVal.textContent = adminFocusDistance.toFixed(2);
    };

    window.applyFocusDistance = function() {
        if (!ROOM_DATA.isAdmin || adminFocusMode !== 'manual' || !remoteSocketId || !socket) return;

        socket.emit('set-focus', {
            roomId: ROOM_DATA.roomId,
            targetSocketId: remoteSocketId,
            focusMode: 'manual',
            focusDistance: adminFocusDistance
        });

        showToast(`🎯 Focus distance: ${adminFocusDistance.toFixed(2)}`, 'info');
    };

    window.toggleAdminPOI = function() {
        if (!ROOM_DATA.isAdmin) return;
        if (!adminFocusCapabilities?.pointOfInterest) {
            showToast('Client tidak support Point of Interest', 'warning');
            return;
        }
        if (!remoteSocketId) {
            showToast('Belum ada user yang terhubung', 'warning');
            return;
        }

        if (adminPOIActive) {
            deactivatePOI();
        } else {
            activatePOI();
        }
    };

    function activatePOI() {
        adminPOIActive = true;
        elements.remoteVideoWrapper.classList.add('poi-active');
        // Ensure manual mode is active (POI requires manual)
        if (adminFocusMode !== 'manual') {
            window.setAdminFocusMode('manual');
        }
        updateFocusPanelUI();
        console.log('[Room] 🎯 POI mode activated');
    }

    function deactivatePOI() {
        adminPOIActive = false;
        elements.remoteVideoWrapper.classList.remove('poi-active');
        // Cancel any in-flight focus ring animation and hide indicator
        if (focusIndicatorTimer) {
            clearTimeout(focusIndicatorTimer);
            focusIndicatorTimer = null;
        }
        const indicator = document.getElementById('focusIndicator');
        if (indicator) {
            indicator.classList.remove('focusing', 'locked');
        }
        updateFocusPanelUI();
        console.log('[Room] 🎯 POI mode deactivated');
    }

    /**
     * Handle click on remote video wrapper.
     * Only fires POI logic when POI mode is active and user is admin.
     */
    window.handleRemoteVideoClick = function(event) {
        if (!ROOM_DATA.isAdmin || !adminPOIActive || !remoteSocketId) return;

        const videoEl = elements.remoteVideo;
        if (!videoEl) return;

        const rect = videoEl.getBoundingClientRect();

        // Normalise to [0, 1] relative to the actual video element
        const rawX = (event.clientX - rect.left)  / rect.width;
        const rawY = (event.clientY - rect.top)   / rect.height;

        // Clamp
        const x = Math.max(0, Math.min(1, rawX));
        const y = Math.max(0, Math.min(1, rawY));

        console.log(`[Room] 🎯 POI click: (${x.toFixed(3)}, ${y.toFixed(3)})`);

        // Show visual indicator at click position (relative to the wrapper)
        showFocusIndicator(event.clientX, event.clientY);

        // Send to server → client
        if (!socket) return;
        socket.emit('set-point-of-interest', {
            roomId: ROOM_DATA.roomId,
            targetSocketId: remoteSocketId,
            x,
            y
        });
    };

    /**
     * Two-phase camera focus ring:
     *   Phase 1 (focusing): white ring shrinks 88px → 46px over 550ms
     *   Phase 2 (locked):   ring flashes yellow then fades over 550ms
     */
    function showFocusIndicator(clientX, clientY) {
        if (!elements.remoteVideoWrapper) return;

        let indicator = document.getElementById('focusIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'focusIndicator';
            indicator.className = 'focus-indicator';
            elements.remoteVideoWrapper.appendChild(indicator);
        }

        // Cancel any running phase-2 timer from a previous click
        if (focusIndicatorTimer) {
            clearTimeout(focusIndicatorTimer);
            focusIndicatorTimer = null;
        }

        // Position at click point (wrapper-relative, centred via CSS translate)
        const wrapperRect = elements.remoteVideoWrapper.getBoundingClientRect();
        indicator.style.left = (clientX - wrapperRect.left) + 'px';
        indicator.style.top  = (clientY - wrapperRect.top)  + 'px';

        // Phase 1 — white ring shrinks (focusing)
        indicator.classList.remove('focusing', 'locked');
        void indicator.offsetWidth;              // force reflow to restart animation
        indicator.classList.add('focusing');

        // Phase 2 — yellow flash + fade (locked) after shrink finishes
        focusIndicatorTimer = setTimeout(() => {
            focusIndicatorTimer = null;
            indicator.classList.remove('focusing');
            void indicator.offsetWidth;
            indicator.classList.add('locked');
        }, 550);
    }

    // ==========================================================================
    // AUDIO RESET PANEL (Admin Only)
    // ==========================================================================

    /**
     * Toggle the Audio Reset panel open/close.
     * Closes all other panels when opening (consistent UX).
     */
    window.toggleAudioPanel = function() {
        if (!ROOM_DATA.isAdmin) return;
        const panel = document.getElementById('audioPanel');
        const btn   = document.getElementById('audioBtn');
        if (!panel) return;

        const isOpen = panel.classList.contains('visible');

        // Close all other panels first (use toggleFocusPanel for proper POI cleanup)
        document.getElementById('qualityPanel')?.classList.remove('visible');
        document.getElementById('qualityBtn')?.classList.remove('active');
        document.getElementById('statsPanel')?.classList.remove('visible');
        document.getElementById('statsBtn')?.classList.remove('active');
        const focusPanelEl = document.getElementById('focusPanel');
        if (focusPanelEl && focusPanelEl.classList.contains('visible')) {
            window.toggleFocusPanel();
        }

        if (isOpen) {
            panel.classList.remove('visible');
            btn?.classList.remove('active');
        } else {
            panel.classList.add('visible');
            btn?.classList.add('active');
            updateAudioPanelUserSection();
        }
    };

    /**
     * Sync audio panel "user section" vs "no user" visibility.
     * Called whenever remoteSocketId / remoteUserRole changes.
     */
    function updateAudioPanelUserSection() {
        const userSection   = document.getElementById('audioResetUserSection');
        const noUserSection = document.getElementById('audioResetNoUser');
        if (!userSection || !noUserSection) return;

        const hasUser = !!remoteSocketId && remoteUserRole === 'user';
        userSection.style.display   = hasUser ? 'flex' : 'none';
        noUserSection.style.display = hasUser ? 'none' : 'flex';
        if (hasUser) {
            userSection.style.flexDirection = 'column';
            userSection.style.gap = 'var(--spacing-sm)';
        }
    }

    /**
     * Admin: emit reset command, start 6-second fallback timeout.
     */
    window.adminResetAudio = function() {
        if (!ROOM_DATA.isAdmin || !remoteSocketId) {
            showToast('Belum ada user yang terhubung', 'warning');
            return;
        }
        // Cancel any previous pending timeout
        if (audioResetTimeout) {
            clearTimeout(audioResetTimeout);
            audioResetTimeout = null;
        }

        setAudioResetBtnState('loading', 'Mengirim reset...');

        socket.emit('admin-reset-audio', {
            roomId: ROOM_DATA.roomId,
            targetSocketId: remoteSocketId
        });

        // Fallback: if no confirmation within 6 seconds, show timeout error
        audioResetTimeout = setTimeout(() => {
            audioResetTimeout = null;
            setAudioResetBtnState('error', '✗ Tidak ada respon dari user (timeout)');
            setTimeout(resetAudioResetBtnToDefault, 3000);
        }, 6000);

        console.log(`[Room] 🔊 Admin sent audio reset to: ${remoteSocketId}`);
    };

    /**
     * Admin: emit force-rejoin command (page reload on user side).
     * Confirmation comes implicitly via user-left then user-joined events.
     */
    window.adminForceRejoin = function() {
        if (!ROOM_DATA.isAdmin || !remoteSocketId) {
            showToast('Belum ada user yang terhubung', 'warning');
            return;
        }
        if (forceRejoinTimeout) { clearTimeout(forceRejoinTimeout); forceRejoinTimeout = null; }

        setRejoinBtnState('loading', 'Mengirim perintah…');

        socket.emit('admin-force-rejoin', {
            roomId: ROOM_DATA.roomId,
            targetSocketId: remoteSocketId
        });

        // User's page will reload — we'll see user-left then user-joined.
        // Reset button after 15s if nothing happens.
        forceRejoinTimeout = setTimeout(() => {
            forceRejoinTimeout = null;
            setRejoinBtnState('error', '✗ User tidak merespons');
            setTimeout(() => setRejoinBtnState('idle'), 3000);
        }, 15000);

        console.log(`[Room] 🔄 Admin sent force-rejoin to: ${remoteSocketId}`);
    };

    /**
     * Update the audio reset button and status text.
     * @param {'loading'|'success'|'error'} state
     * @param {string} text
     */
    function setAudioResetBtnState(state, text) {
        const btn       = document.getElementById('audioResetBtn');
        const btnText   = document.getElementById('audioResetBtnText');
        const statusEl  = document.getElementById('audioResetStatus');
        const resetIcon = btn?.querySelector('.reset-icon');
        if (!btn || !btnText) return;

        // Remove previous state classes
        btn.classList.remove('success', 'error');
        // Remove any old spinner
        btn.querySelector('.spin-icon')?.remove();

        if (state === 'loading') {
            btn.disabled = true;
            if (resetIcon) resetIcon.style.display = 'none';
            // Insert spinner SVG before text
            const spinner = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            spinner.classList.add('spin-icon');
            spinner.setAttribute('viewBox', '0 0 24 24');
            spinner.setAttribute('fill', 'none');
            spinner.setAttribute('stroke', 'currentColor');
            spinner.setAttribute('stroke-width', '2');
            spinner.style.cssText = 'width:1rem;height:1rem;flex-shrink:0;animation:spin 1s linear infinite';
            spinner.innerHTML = '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>';
            btn.insertBefore(spinner, btn.firstChild);
            btnText.textContent = text;
            if (statusEl) { statusEl.textContent = 'Menunggu konfirmasi dari user...'; statusEl.className = 'audio-reset-status loading'; }
        } else if (state === 'success') {
            btn.disabled = false;
            if (resetIcon) resetIcon.style.display = '';
            btn.classList.add('success');
            btnText.textContent = text;
            if (statusEl) {
                const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                statusEl.textContent = `✓ Berhasil direset pada ${time}`;
                statusEl.className = 'audio-reset-status success';
            }
        } else { // error
            btn.disabled = false;
            if (resetIcon) resetIcon.style.display = '';
            btn.classList.add('error');
            btnText.textContent = text;
            if (statusEl) { statusEl.textContent = text; statusEl.className = 'audio-reset-status error'; }
        }
    }

    /** Reset button back to its default (idle) appearance. */
    function resetAudioResetBtnToDefault() {
        const btn      = document.getElementById('audioResetBtn');
        const btnText  = document.getElementById('audioResetBtnText');
        const statusEl = document.getElementById('audioResetStatus');
        if (!btn) return;
        btn.classList.remove('success', 'error');
        btn.disabled = false;
        btn.querySelector('.spin-icon')?.remove();
        const resetIcon = btn.querySelector('.reset-icon');
        if (resetIcon) resetIcon.style.display = '';
        if (btnText) btnText.textContent = 'Restart Audio';
        // Clear status text only if it was an error or loading (preserve last-success timestamp)
        if (statusEl && !statusEl.classList.contains('success')) {
            statusEl.textContent = 'Siap';
            statusEl.className = 'audio-reset-status';
        }
    }

    /**
     * Set state of the Force Rejoin button.
     * @param {'idle'|'loading'|'error'} state
     * @param {string} [text]
     */
    function setRejoinBtnState(state, text) {
        const btn     = document.getElementById('audioRejoinBtn');
        const btnText = document.getElementById('audioRejoinBtnText');
        if (!btn || !btnText) return;
        btn.classList.remove('loading', 'error');
        btn.querySelector('.spin-icon')?.remove();
        if (state === 'loading') {
            btn.disabled = true;
            btn.classList.add('loading');
            btnText.textContent = text || 'Menunggu…';
        } else if (state === 'error') {
            btn.disabled = false;
            btn.classList.add('error');
            btnText.textContent = text || 'Gagal';
        } else {
            btn.disabled = false;
            btnText.textContent = 'Force Rejoin User';
        }
    }

    // ==========================================================================
    // CONNECTION STATE HANDLERS
    // ==========================================================================

    /**
     * Update visibility of admin control buttons based on remoteUserRole.
     * Called whenever remoteSocketId or remoteUserRole changes.
     */
    function updateAdminControlsVisibility() {
        const userCameraBtn = document.getElementById('userCameraBtn');
        const switchUserCameraBtn = document.getElementById('switchUserCameraBtn');

        const shouldShow = ROOM_DATA.isAdmin && ROOM_DATA.adminControlEnabled &&
                           remoteUserRole === 'user' && !!remoteSocketId;

        if (userCameraBtn) {
            userCameraBtn.style.display = shouldShow ? 'flex' : 'none';
            if (shouldShow) {
                // Sync button appearance with current isUserCameraDisabled state
                if (isUserCameraDisabled) {
                    userCameraBtn.classList.add('active');
                    userCameraBtn.title = 'Aktifkan kamera user';
                } else {
                    userCameraBtn.classList.remove('active');
                    userCameraBtn.title = 'Nonaktifkan kamera user';
                }
            }
        }
        if (switchUserCameraBtn) {
            switchUserCameraBtn.style.display = shouldShow ? 'flex' : 'none';
        }

        if (shouldShow) {
            console.log(`[Room] 👑 Admin controls shown for user: ${remoteSocketId}`);
        }
    }

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
                // Ask peer to (re-)send their media status so we always have fresh state.
                // This is crucial after reconnect so both sides know each other's camera/mic state.
                setTimeout(() => {
                    socket.emit('request-media-sync', { roomId: ROOM_DATA.roomId });
                    console.log('[Room] 🔄 Requested media sync from peer after connection');
                }, 1000);
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
                
                // Check connection state when returning
                if (webrtc && webrtc.peerConnection) {
                    const connState = webrtc.peerConnection.connectionState;
                    const iceState = webrtc.peerConnection.iceConnectionState;
                    console.log(`[Room] 🔍 Connection check: connectionState=${connState}, iceState=${iceState}`);
                    
                    // If connection is broken, show message and suggest refresh
                    if (connState === 'disconnected' || connState === 'failed' || 
                        iceState === 'disconnected' || iceState === 'failed') {
                        console.warn('[Room] ⚠️ Connection lost while in background');
                        showToast('Koneksi terputus. Coba refresh halaman.', 'warning');
                    }
                }
            }
        });

        // Handle page unload - improved cleanup
        window.addEventListener('beforeunload', () => {
            console.log('[Room] 💾 Cleaning up before unload...');
            
            // Cleanup stats interval
            if (statsInterval) {
                clearInterval(statsInterval);
                statsInterval = null;
            }
            prevBytesSent = 0; prevBytesReceived = 0; prevStatsTime = 0;
            
            // Cleanup WebRTC first (this clears timeouts)
            if (webrtc) {
                webrtc.cleanup();
            }
            
            // Then leave room via socket
            if (socket && socket.connected) {
                socket.emit('leave-room', { roomId: ROOM_DATA.roomId });
                // Give a tiny moment for the message to send
                // Note: This is best-effort, browser may cut it off
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
            // Non-admin (user): track + preview both toggled by webrtc.toggleCamera
            if (result.blocked) {
                showToast('Kamera dikontrol oleh admin', 'warning');
                return;
            }
            isVideoHidden = result.isCameraHidden;
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
            console.log('[Room] ⚠️ No remoteSocketId, checking for connected users...');
            showToast('Belum ada user yang terhubung', 'warning');
            return;
        }

        // Toggle state
        isUserCameraDisabled = !isUserCameraDisabled;
        const action = isUserCameraDisabled ? 'off' : 'on';

        console.log(`[Room] 👑 Admin toggling user camera: ${action}`);
        console.log(`[Room] 👑 Target socket ID: ${remoteSocketId}`);

        // Update button UI
        const userCameraBtn = document.getElementById('userCameraBtn');
        if (userCameraBtn) {
            if (isUserCameraDisabled) {
                userCameraBtn.classList.add('active');
                userCameraBtn.title = 'Aktifkan kamera user';
            } else {
                userCameraBtn.classList.remove('active');
                userCameraBtn.title = 'Nonaktifkan kamera user';
            }
        }

        // Send command to user via socket
        socket.emit('admin-toggle-user-camera', {
            roomId: ROOM_DATA.roomId,
            targetSocketId: remoteSocketId,
            action: action
        });

        const actionText = action === 'on' ? 'Mengaktifkan' : 'Menonaktifkan';
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

    window.switchUserCamera = function() {
        if (!ROOM_DATA.isAdmin || !remoteSocketId) {
            showToast('Tidak dapat mengontrol kamera user', 'error');
            return;
        }

        console.log(`[Room] 👑 Admin switching user camera`);

        // Send command to user
        socket.emit('admin-switch-user-camera', {
            roomId: ROOM_DATA.roomId,
            targetSocketId: remoteSocketId
        });

        showToast('🔄 Mengirim perintah switch kamera ke user', 'info');
    };

    window.endCall = function() {
        console.log('[Room] 📞 Ending call...');
        
        // Cleanup stats interval
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
        prevBytesSent = 0; prevBytesReceived = 0; prevStatsTime = 0;
        
        if (socket) {
            socket.emit('leave-room', { roomId: ROOM_DATA.roomId });
        }

        // Deactivate POI mode before leaving
        if (adminPOIActive) deactivatePOI();
        document.getElementById('focusPanel')?.classList.remove('visible');
        document.getElementById('focusBtn')?.classList.remove('active');
        document.getElementById('audioPanel')?.classList.remove('visible');
        document.getElementById('audioBtn')?.classList.remove('active');
        if (audioResetTimeout)  { clearTimeout(audioResetTimeout);  audioResetTimeout  = null; }
        if (forceRejoinTimeout) { clearTimeout(forceRejoinTimeout); forceRejoinTimeout = null; }
        adminFocusCapabilities = null;
        
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
            
            // Close other panels if open
            const qualityPanel = document.getElementById('qualityPanel');
            if (qualityPanel && qualityPanel.classList.contains('visible')) {
                toggleQualityPanel();
            }
            const focusPanel = document.getElementById('focusPanel');
            if (focusPanel && focusPanel.classList.contains('visible')) {
                window.toggleFocusPanel();
            }
            document.getElementById('audioPanel')?.classList.remove('visible');
            document.getElementById('audioBtn')?.classList.remove('active');
        }
    };

    // Toggle Quality Settings Panel (Admin)
    window.toggleQualityPanel = function() {
        const qualityPanel = document.getElementById('qualityPanel');
        const qualityBtn = document.getElementById('qualityBtn');
        
        if (!qualityPanel) return;
        
        if (qualityPanel.classList.contains('visible')) {
            qualityPanel.classList.remove('visible');
            if (qualityBtn) qualityBtn.classList.remove('active');
        } else {
            qualityPanel.classList.add('visible');
            if (qualityBtn) qualityBtn.classList.add('active');
            
            // Close other panels if open
            if (elements.statsPanel && elements.statsPanel.classList.contains('visible')) {
                toggleStatsPanel();
            }
            const focusPanel = document.getElementById('focusPanel');
            if (focusPanel && focusPanel.classList.contains('visible')) {
                window.toggleFocusPanel();
            }
            document.getElementById('audioPanel')?.classList.remove('visible');
            document.getElementById('audioBtn')?.classList.remove('active');

            // Initialize with current settings
            initializeQualitySettings();
        }
    };

    // Initialize quality settings with current values
    function initializeQualitySettings() {
        const resolutionPreset = document.getElementById('resolutionPreset');
        const bitrateSlider = document.getElementById('bitrateSlider');
        const framerateSlider = document.getElementById('framerateSlider');
        
        if (!resolutionPreset || !bitrateSlider || !framerateSlider) return;
        
        // Set current resolution preset if available
        if (webrtc && webrtc.videoSettings) {
            const currentResolution = webrtc.videoSettings.resolution || '720p';
            resolutionPreset.value = currentResolution;
            
            bitrateSlider.value = webrtc.videoSettings.maxBitrate || 1200;
            framerateSlider.value = webrtc.videoSettings.maxFramerate || 30;
            
            updateBitrateDisplay();
            updateFramerateDisplay();
        }
    }

    // Handle preset change
    window.onPresetChange = function() {
        const resolutionPreset = document.getElementById('resolutionPreset');
        const customResolutionSection = document.getElementById('customResolutionSection');
        const bitrateSlider = document.getElementById('bitrateSlider');
        const framerateSlider = document.getElementById('framerateSlider');
        const customWidth = document.getElementById('customWidth');
        const customHeight = document.getElementById('customHeight');
        
        const selectedPreset = resolutionPreset.value;
        
        if (selectedPreset === 'custom') {
            // Show custom resolution inputs
            customResolutionSection.style.display = 'block';
        } else {
            // Hide custom resolution inputs and load preset values
            customResolutionSection.style.display = 'none';
            
            if (window.getPreset) {
                const preset = window.getPreset(selectedPreset);
                customWidth.value = preset.width;
                customHeight.value = preset.height;
                bitrateSlider.value = preset.idealBitrate;
                framerateSlider.value = preset.idealFramerate;
                
                updateBitrateDisplay();
                updateFramerateDisplay();
            }
        }
    };

    // Update bitrate display
    window.updateBitrateDisplay = function() {
        const bitrateSlider = document.getElementById('bitrateSlider');
        const bitrateValue = document.getElementById('bitrateValue');
        
        if (bitrateSlider && bitrateValue) {
            bitrateValue.textContent = `${bitrateSlider.value} kbps`;
        }
    };

    // Update framerate display
    window.updateFramerateDisplay = function() {
        const framerateSlider = document.getElementById('framerateSlider');
        const framerateValue = document.getElementById('framerateValue');
        
        if (framerateSlider && framerateValue) {
            framerateValue.textContent = `${framerateSlider.value} fps`;
        }
    };

    // Apply quality settings
    window.applyQualitySettings = function() {
        if (!ROOM_DATA.isAdmin) {
            showToast('Hanya admin yang dapat mengubah video quality', 'error');
            return;
        }

        if (!remoteSocketId) {
            showToast('Belum ada user yang terhubung', 'warning');
            return;
        }

        const resolutionPreset = document.getElementById('resolutionPreset').value;
        const customWidth = parseInt(document.getElementById('customWidth').value);
        const customHeight = parseInt(document.getElementById('customHeight').value);
        const maxBitrate = parseInt(document.getElementById('bitrateSlider').value);
        const maxFramerate = parseInt(document.getElementById('framerateSlider').value);

        // Validate inputs
        if (isNaN(customWidth) || isNaN(customHeight) || isNaN(maxBitrate) || isNaN(maxFramerate)) {
            showToast('Nilai tidak valid', 'error');
            return;
        }

        // Validate custom settings if custom is selected
        if (resolutionPreset === 'custom' && window.validateCustomSettings) {
            if (!window.validateCustomSettings({ width: customWidth, height: customHeight, maxBitrate, maxFramerate })) {
                showToast('Pengaturan custom tidak valid. Width: 320-3840, Height: 240-2160, Bitrate: 100-10000 kbps, FPS: 15-60', 'error');
                return;
            }
        }

        const qualitySettings = {
            resolution: resolutionPreset,
            width: customWidth,
            height: customHeight,
            maxBitrate: maxBitrate,
            maxFramerate: maxFramerate
        };

        console.log(`[Room] 👑 Admin applying quality settings:`, qualitySettings);

        // Send to user via socket
        socket.emit('admin-change-video-quality', {
            roomId: ROOM_DATA.roomId,
            targetSocketId: remoteSocketId,
            qualitySettings: qualitySettings
        });

        showToast(`🎥 Menerapkan ${resolutionPreset === 'custom' ? 'custom' : resolutionPreset} (${customWidth}x${customHeight}, ${maxBitrate}kbps, ${maxFramerate}fps)...`, 'info');
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
                    
                    // Only admin sends stats to server
                    if (ROOM_DATA.isAdmin && ROOM_DATA.adminControlEnabled) {
                        socket.emit('webrtc-stats', {
                            roomId: ROOM_DATA.roomId,
                            stats: stats
                        });
                    }
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

                // Use targetBitrate if reported directly by the browser
                if (report.targetBitrate) {
                    result.targetBitrate = Math.round(report.targetBitrate / 1000); // kbps
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
        
        // Compute realtime send/receive bandwidth (kbps) from byte deltas
        const now = Date.now();
        if (prevStatsTime > 0) {
            const elapsed = (now - prevStatsTime) / 1000; // seconds
            if (elapsed > 0) {
                result.bitrateSend    = Math.round((result.bytesSent     - prevBytesSent)     * 8 / elapsed / 1000); // kbps
                result.bitrateRecv    = Math.round((result.bytesReceived - prevBytesReceived) * 8 / elapsed / 1000); // kbps
            }
        }
        // Clamp negatives (wrap-around protection)
        result.bitrateSend = Math.max(0, result.bitrateSend || 0);
        result.bitrateRecv = Math.max(0, result.bitrateRecv || 0);

        prevBytesSent     = result.bytesSent;
        prevBytesReceived = result.bytesReceived;
        prevStatsTime     = now;

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
        setInnerText('statBitrate', formatKbps(stats.bitrateSend));
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

    /** Format a kbps value for display */
    function formatKbps(kbps) {
        if (kbps <= 0) return '— kbps';
        if (kbps < 1000) return `${kbps} kbps`;
        return `${(kbps / 1000).toFixed(2)} Mbps`;
    }

    /** @deprecated Use formatKbps for bitrate; kept for any legacy callers */
    function formatBitrate(bytes) {
        // Legacy: approximate bitrate from cumulative bytes (rough)
        const bitsPerSecond = (bytes * 8) / 2;
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
