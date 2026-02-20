/**
 * =============================================================================
 * WEBRTC HANDLER
 * =============================================================================
 * WebRTC connection handler dengan dual mode support:
 * - Mesh P2P: Direct peer-to-peer connection
 * - SFU: Selective Forwarding Unit via Ion-SFU
 * Mendukung mobile: switch camera, audio output, auto reconnect
 */

class WebRTCHandler {
    constructor(options = {}) {
        this.roomId = options.roomId;
        this.userId = options.userId;
        this.username = options.username;
        this.iceServers = options.iceServers || [];
        this.socket = options.socket;
        
        // WebRTC Mode: 'mesh' or 'sfu'
        this.mode = options.mode || 'mesh';
        this.ionSFUConfig = options.ionSFUConfig || null;
        this.ionSFUClient = null; // Ion-SFU client instance (SFU mode only)

        // State
        this.peerConnection = null; // For mesh mode
        this.localStream = null;
        this.remoteStream = null;
        this.isInitiator = false;
        this.isConnected = false;
        this.isMuted = false;
        this.isCameraTrackEnabled = true; // Actual track enabled state
        this.isCameraHidden = false; // Visual state (for non-admin preview)
        this.isAdminDisabled = false; // Track if admin has disabled user's camera
        this.userHiddenBeforeAdmin = false; // User's visual state before admin control
        this.usingSpeaker = true;
        this.currentCameraFacing = 'user'; // 'user' = front, 'environment' = back
        this.userRole = null; // Will be set by room.js
        this.audioContext = null; // Web Audio API for better mobile audio handling
        this.isScreenSharing = false; // Screen sharing state
        this.screenStream = null; // Screen share stream
        this.originalVideoTrack = null; // Original camera track for restore
        this.pendingIceCandidates = []; // Queue for ICE candidates that arrive before remote description

        // Reconnect config
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.reconnectTimer = null;       // Pending reconnect timer ID
        this.disconnectWatchdog = null;   // Watchdog for transient 'disconnected' state
        this.DISCONNECT_WATCHDOG_TIMEOUT = 5000; // 5s grace before treating disconnected as failed

        // Timeouts
        this.iceGatheringTimeout = null;
        this.connectionTimeout = null;
        this.ICE_GATHERING_TIMEOUT = 15000; // 15 seconds
        this.CONNECTION_TIMEOUT = 20000; // 20 seconds

        // Callbacks
        this.onRemoteStream = options.onRemoteStream || (() => {});
        this.onConnectionStateChange = options.onConnectionStateChange || (() => {});
        this.onRemoteMediaStatus = options.onRemoteMediaStatus || (() => {});
        this.onUserJoined = options.onUserJoined || (() => {});
        this.onUserLeft = options.onUserLeft || (() => {});
        this.onReconnectFailed = options.onReconnectFailed || (() => {});
        this.onError = options.onError || (() => {});

        console.log('[WebRTC] 🔧 Handler initialized');
        console.log(`[WebRTC] 🎯 Mode: ${this.mode.toUpperCase()}`);
        console.log(`[WebRTC] 🌐 ICE servers: ${this.iceServers.length}`);
        
        if (this.mode === 'sfu') {
            console.log(`[WebRTC] 🌐 Ion-SFU Server: ${this.ionSFUConfig?.serverUrl}`);
        }
        
        // Video settings from server (global settings)
        this.videoSettings = options.videoSettings || {
            maxBitrate: 1500,
            resolution: '720p',
            maxFramerate: 30,
            width: 1280,
            height: 720,
            videoCpuOveruseDetection: true,
            audioEchoCancellation: true,
            audioNoiseSuppression: true
        };
        console.log(`[WebRTC] ⚙️ Video settings:`, this.videoSettings);
    }

    /**
     * =========================================================================
     * MEDIA STREAM
     * =========================================================================
     */

    /**
     * Get local media stream (camera + mic)
     * Uses global video settings from server
     */
    async getLocalStream() {
        try {
            console.log('[WebRTC] 📹 Requesting local media stream...');
            console.log(`[WebRTC] ⚙️ Using settings: ${this.videoSettings.resolution}, ${this.videoSettings.maxFramerate}fps, ${this.videoSettings.maxBitrate}kbps`);

            const constraints = {
                video: {
                    width: { ideal: this.videoSettings.width, max: 1920 },
                    height: { ideal: this.videoSettings.height, max: 1080 },
                    facingMode: this.currentCameraFacing,
                    frameRate: { ideal: this.videoSettings.maxFramerate, max: 60 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('[WebRTC] ✅ Local stream obtained');
            console.log(`[WebRTC] 📹 Video tracks: ${this.localStream.getVideoTracks().length}`);
            console.log(`[WebRTC] 🎤 Audio tracks: ${this.localStream.getAudioTracks().length}`);

            return this.localStream;
        } catch (error) {
            console.error('[WebRTC] ❌ Failed to get local stream:', error.message);
            this.onError({ 
                type: 'media', 
                message: this.getMediaErrorMessage(error) 
            });
            throw error;
        }
    }

    /**
     * Get user-friendly media error message
     */
    getMediaErrorMessage(error) {
        switch(error.name) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
                return 'Izin kamera/mikrofon ditolak. Silakan izinkan akses di pengaturan browser.';
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                return 'Kamera atau mikrofon tidak ditemukan.';
            case 'NotReadableError':
            case 'TrackStartError':
                return 'Kamera atau mikrofon sedang digunakan aplikasi lain.';
            case 'OverconstrainedError':
                return 'Kamera tidak mendukung resolusi yang diminta.';
            default:
                return 'Gagal mengakses kamera/mikrofon: ' + error.message;
        }
    }

    /**
     * Switch camera (front/back) - Mobile
     */
    async switchCamera() {
        if (!this.localStream) return;

        try {
            // Toggle facing mode
            this.currentCameraFacing = this.currentCameraFacing === 'user' ? 'environment' : 'user';
            
            console.log(`[WebRTC] 🔄 Switching camera to: ${this.currentCameraFacing}`);

            // Stop current video track
            const currentVideoTrack = this.localStream.getVideoTracks()[0];
            if (currentVideoTrack) {
                currentVideoTrack.stop();
            }

            // Get new video stream
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this.currentCameraFacing,
                    width: { ideal: this.videoSettings.width },
                    height: { ideal: this.videoSettings.height },
                    frameRate: { ideal: this.videoSettings.maxFramerate }
                }
            });

            const newVideoTrack = newStream.getVideoTracks()[0];

            // Replace track in local stream
            this.localStream.removeTrack(currentVideoTrack);
            this.localStream.addTrack(newVideoTrack);

            // Replace track in peer connection
            if (this.peerConnection) {
                const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                }
            }

            console.log('[WebRTC] ✅ Camera switched successfully');
            return true;
        } catch (error) {
            console.error('[WebRTC] ❌ Failed to switch camera:', error.message);
            // Revert facing mode
            this.currentCameraFacing = this.currentCameraFacing === 'user' ? 'environment' : 'user';
            return false;
        }
    }

    /**
     * Apply new video quality settings with fallback mechanism
     * @param {Object} settings - Quality settings {resolution, width, height, maxBitrate, maxFramerate}
     * @returns {Promise<Object>} Result with success status and applied settings
     */
    async applyVideoQuality(settings) {
        if (!this.localStream) {
            console.error('[WebRTC] ❌ No local stream available');
            return { success: false, error: 'No local stream' };
        }

        console.log(`[WebRTC] 🎥 Applying video quality:`, settings);

        // Update video settings
        this.videoSettings = {
            ...this.videoSettings,
            resolution: settings.resolution || 'custom',
            width: settings.width,
            height: settings.height,
            maxBitrate: settings.maxBitrate,
            maxFramerate: settings.maxFramerate
        };

        try {
            // Get current video track
            const currentVideoTrack = this.localStream.getVideoTracks()[0];
            if (!currentVideoTrack) {
                throw new Error('No video track found');
            }

            // Try to apply new constraints with fallback
            const appliedSettings = await this.applyVideoConstraintsWithFallback(
                settings.resolution,
                settings.width,
                settings.height,
                settings.maxFramerate
            );

            // Apply bitrate constraint if peer connection exists
            if (this.peerConnection) {
                const videoSender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (videoSender) {
                    await this.applyBitrateConstraint(videoSender);
                    console.log(`[WebRTC] ✅ Bitrate constraint applied: ${settings.maxBitrate} kbps`);
                }
            }

            console.log('[WebRTC] ✅ Video quality applied successfully');
            console.log(`[WebRTC] 📊 Final settings:`, appliedSettings);

            return {
                success: true,
                appliedSettings: appliedSettings
            };

        } catch (error) {
            console.error('[WebRTC] ❌ Failed to apply video quality:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Apply video constraints with automatic fallback to lower resolutions if not supported
     * @param {string} resolution - Target resolution (e.g., '720p')
     * @param {number} width - Target width
     * @param {number} height - Target height
     * @param {number} framerate - Target framerate
     * @returns {Promise<Object>} Applied settings
     */
    async applyVideoConstraintsWithFallback(resolution, width, height, framerate) {
        const currentVideoTrack = this.localStream.getVideoTracks()[0];
        
        // Define fallback chain
        const resolutionFallbacks = window.RESOLUTION_FALLBACK_ORDER || ['1080p', '720p', '480p', '360p'];
        let currentResolutionIndex = resolutionFallbacks.indexOf(resolution);
        
        // If custom or not in fallback list, start from the closest match
        if (currentResolutionIndex === -1) {
            // Find closest resolution based on height
            if (height >= 1080) currentResolutionIndex = 0;
            else if (height >= 720) currentResolutionIndex = 1;
            else if (height >= 480) currentResolutionIndex = 2;
            else currentResolutionIndex = 3;
        }

        let lastError = null;
        
        // Try current resolution first, then fallback to lower resolutions
        while (currentResolutionIndex < resolutionFallbacks.length) {
            const targetResolution = resolutionFallbacks[currentResolutionIndex];
            let targetWidth = width;
            let targetHeight = height;
            
            // Get preset dimensions if falling back
            if (currentResolutionIndex > resolutionFallbacks.indexOf(resolution) && window.getPreset) {
                const preset = window.getPreset(targetResolution);
                targetWidth = preset.width;
                targetHeight = preset.height;
                console.log(`[WebRTC] 🔽 Trying fallback: ${targetResolution} (${targetWidth}x${targetHeight})`);
            }

            try {
                const constraints = {
                    width: { ideal: targetWidth, max: targetWidth },
                    height: { ideal: targetHeight, max: targetHeight },
                    frameRate: { ideal: framerate, max: 60 },
                    facingMode: this.currentCameraFacing
                };

                console.log(`[WebRTC] 🎯 Attempting to apply constraints:`, constraints);
                await currentVideoTrack.applyConstraints(constraints);

                // Get actual settings that were applied
                const actualSettings = currentVideoTrack.getSettings();
                console.log(`[WebRTC] ✅ Constraints applied successfully!`);
                console.log(`[WebRTC] 📊 Actual settings:`, {
                    width: actualSettings.width,
                    height: actualSettings.height,
                    frameRate: actualSettings.frameRate
                });

                // If we had to fallback, notify
                if (currentResolutionIndex > resolutionFallbacks.indexOf(resolution)) {
                    console.log(`[WebRTC] ⚠️ Fell back from ${resolution} to ${targetResolution}`);
                    this.videoSettings.resolution = targetResolution;
                    this.videoSettings.width = targetWidth;
                    this.videoSettings.height = targetHeight;
                }

                return {
                    resolution: this.videoSettings.resolution,
                    width: actualSettings.width || targetWidth,
                    height: actualSettings.height || targetHeight,
                    frameRate: actualSettings.frameRate || framerate,
                    fellBack: currentResolutionIndex > resolutionFallbacks.indexOf(resolution),
                    originalResolution: resolution
                };

            } catch (error) {
                lastError = error;
                console.warn(`[WebRTC] ⚠️ Failed to apply ${targetResolution}:`, error.message);
                
                // Try next lower resolution
                currentResolutionIndex++;
                
                // If we've tried all fallbacks, throw the last error
                if (currentResolutionIndex >= resolutionFallbacks.length) {
                    throw new Error(`Failed to apply any resolution. Last error: ${lastError.message}`);
                }
            }
        }

        throw new Error('No suitable resolution found');
    }

    /**
     * Toggle audio output (speaker/earpiece) - Mobile
     * Note: This feature has limited browser support on mobile devices
     * 
     * Methods attempted:
     * 1. setSinkId() - Only works on desktop Chrome, not mobile
     * 2. AudioContext routing - Limited control over output device
     * 3. For most mobile browsers, this is controlled by the OS/hardware
     * 
     * Workaround: We can try to use setSinkId with 'default' vs specific device
     */
    async toggleAudioOutput(remoteVideoElement) {
        if (!remoteVideoElement) return this.usingSpeaker;

        try {
            this.usingSpeaker = !this.usingSpeaker;
            
            // Method 1: Try setSinkId if available (Chrome/Edge on desktop, some Android)
            if (typeof remoteVideoElement.setSinkId === 'function') {
                try {
                    // Get available audio output devices
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
                    
                    console.log('[WebRTC] 🔊 Available audio outputs:', audioOutputs.map(d => `${d.label} (${d.deviceId})`));
                    
                    if (audioOutputs.length > 1) {
                        // Try to find earpiece (usually labeled with 'earpiece', 'handset', or 'receiver')
                        const earpieceDevice = audioOutputs.find(d => 
                            d.label.toLowerCase().includes('earpiece') ||
                            d.label.toLowerCase().includes('handset') ||
                            d.label.toLowerCase().includes('receiver') ||
                            d.label.toLowerCase().includes('phone')
                        );
                        
                        // Find speaker device
                        const speakerDevice = audioOutputs.find(d => 
                            d.label.toLowerCase().includes('speaker') ||
                            d.deviceId === 'default'
                        );
                        
                        if (this.usingSpeaker && speakerDevice) {
                            await remoteVideoElement.setSinkId(speakerDevice.deviceId);
                            console.log(`[WebRTC] 🔊 Switched to Speaker: ${speakerDevice.label}`);
                        } else if (!this.usingSpeaker && earpieceDevice) {
                            await remoteVideoElement.setSinkId(earpieceDevice.deviceId);
                            console.log(`[WebRTC] 🔊 Switched to Earpiece: ${earpieceDevice.label}`);
                        } else {
                            // Fallback: toggle between default and first non-default
                            const targetDevice = this.usingSpeaker ? 'default' : (audioOutputs[1]?.deviceId || 'default');
                            await remoteVideoElement.setSinkId(targetDevice);
                            console.log(`[WebRTC] 🔊 Switched to: ${targetDevice}`);
                        }
                    } else {
                        console.log('[WebRTC] ⚠️ Only one audio output device available');
                    }
                } catch (sinkError) {
                    console.warn('[WebRTC] ⚠️ setSinkId failed:', sinkError.message);
                }
            } else {
                console.log('[WebRTC] ⚠️ setSinkId not supported on this browser/device');
            }
            
            // Method 2: For iOS Safari and other browsers without setSinkId
            // We can only inform the user that this feature is not available
            // The OS handles audio routing based on proximity sensor and connected devices
            
            console.log(`[WebRTC] 🔊 Audio output state: ${this.usingSpeaker ? 'Speaker' : 'Earpiece'}`);
            return this.usingSpeaker;
            
        } catch (error) {
            console.error('[WebRTC] ❌ Failed to toggle audio output:', error.message);
            // Revert state on error
            this.usingSpeaker = !this.usingSpeaker;
            return this.usingSpeaker;
        }
    }

    /**
     * Toggle microphone mute
     */
    toggleMute() {
        if (!this.localStream) return false;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            this.isMuted = !this.isMuted;
            audioTrack.enabled = !this.isMuted;
            
            console.log(`[WebRTC] 🎤 Microphone: ${this.isMuted ? 'MUTED' : 'ON'}`);
            
            // Notify peer
            this.sendMediaStatus();
        }

        return this.isMuted;
    }

    /**
     * Toggle camera on/off
     * For admin: toggle actual track enabled state
     * For non-admin (user): only toggle visual (track always stays enabled)
     * User cannot toggle if admin has disabled their camera
     */
    async toggleCamera() {
        if (!this.localStream) return { isCameraHidden: this.isCameraHidden, isCameraTrackEnabled: this.isCameraTrackEnabled };

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            if (this.userRole === 'admin') {
                // Admin: toggle actual track enable/disable
                this.isCameraTrackEnabled = !this.isCameraTrackEnabled;
                videoTrack.enabled = this.isCameraTrackEnabled;
                this.isCameraHidden = !this.isCameraTrackEnabled;
                
                console.log(`[WebRTC] 📹 Admin Camera: track=${this.isCameraTrackEnabled ? 'ON' : 'OFF'}`);
                
                // Force refresh track on sender when enabling camera
                // This ensures remote peer receives the video after re-enabling
                if (this.isCameraTrackEnabled && this.peerConnection) {
                    const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        try {
                            await sender.replaceTrack(videoTrack);
                            console.log('[WebRTC] 📹 Admin: Refreshed video track on sender');
                        } catch (err) {
                            console.warn('[WebRTC] ⚠️ Could not refresh track:', err.message);
                        }
                    }
                }
            } else {
                // Non-admin (user): check if admin has disabled camera
                if (this.isAdminDisabled) {
                    console.log('[WebRTC] 📹 User Camera: BLOCKED - Admin has disabled camera');
                    return { isCameraHidden: this.isCameraHidden, isCameraTrackEnabled: this.isCameraTrackEnabled, blocked: true };
                }
                
                // Only toggle visual, track stays always enabled
                this.isCameraHidden = !this.isCameraHidden;
                videoTrack.enabled = true; // Always keep enabled for admin to see
                
                console.log(`[WebRTC] 📹 User Camera: visual=${this.isCameraHidden ? 'HIDDEN' : 'VISIBLE'}, track=ALWAYS ON`);
            }
            
            // Notify peer with status
            this.sendMediaStatus();
        }

        return { isCameraHidden: this.isCameraHidden, isCameraTrackEnabled: this.isCameraTrackEnabled };
    }

    /**
     * Toggle screen sharing
     */
    async toggleScreenShare() {
        try {
            if (!this.isScreenSharing) {
                // Start screen sharing
                console.log('[WebRTC] 🖥️ Starting screen share...');
                
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: 'always',
                        displaySurface: 'monitor'
                    },
                    audio: false
                });

                const screenTrack = this.screenStream.getVideoTracks()[0];
                
                // Save original camera track
                this.originalVideoTrack = this.localStream.getVideoTracks()[0];
                
                // Replace video track in peer connection
                if (this.peerConnection) {
                    const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(screenTrack);
                        console.log('[WebRTC] 🖥️ Screen track replaced in peer connection');
                    }
                }

                // Listen for screen share end (user clicks "Stop sharing" in browser)
                screenTrack.onended = () => {
                    console.log('[WebRTC] 🖥️ Screen share stopped by user');
                    this.stopScreenShare();
                };

                this.isScreenSharing = true;
                console.log('[WebRTC] ✅ Screen sharing started');
                
                // Notify peer
                if (this.socket && this.roomId) {
                    this.socket.emit('screen-share-status', {
                        roomId: this.roomId,
                        isScreenSharing: true
                    });
                }
                
                return { success: true, isScreenSharing: true, screenStream: this.screenStream };
            } else {
                // Stop screen sharing
                return await this.stopScreenShare();
            }
        } catch (error) {
            console.error('[WebRTC] ❌ Screen share error:', error.message);
            
            // User cancelled or error
            if (error.name === 'NotAllowedError') {
                return { success: false, error: 'Izin screen sharing ditolak' };
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop screen sharing and restore camera
     */
    async stopScreenShare() {
        try {
            console.log('[WebRTC] 🖥️ Stopping screen share...');
            
            // Stop screen stream
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
                this.screenStream = null;
            }

            // Restore original camera track
            if (this.originalVideoTrack && this.peerConnection) {
                const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(this.originalVideoTrack);
                    console.log('[WebRTC] 📹 Camera track restored');
                }
            }

            this.isScreenSharing = false;
            
            // Notify peer
            if (this.socket && this.roomId) {
                this.socket.emit('screen-share-status', {
                    roomId: this.roomId,
                    isScreenSharing: false
                });
            }
            
            console.log('[WebRTC] ✅ Screen sharing stopped');
            return { success: true, isScreenSharing: false };
        } catch (error) {
            console.error('[WebRTC] ❌ Stop screen share error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send media status to peer
     */
    sendMediaStatus() {
        if (this.socket && this.roomId) {
            const videoTrack = this.localStream?.getVideoTracks()[0];
            this.socket.emit('media-status', {
                roomId: this.roomId,
                isMuted: this.isMuted,
                isCameraHidden: this.isCameraHidden,
                isCameraTrackEnabled: videoTrack ? videoTrack.enabled : false
            });
        }
    }

    /**
     * =========================================================================
     * PEER CONNECTION
     * =========================================================================
     */

    /**
     * Create RTCPeerConnection
     */
    createPeerConnection() {
        console.log('[WebRTC] 🔗 Creating peer connection...');

        // Clear any existing timeouts
        this.clearConnectionTimeouts();

        const config = {
            iceServers: this.iceServers,
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };

        // Log ICE server configuration untuk debugging
        console.log('[WebRTC] 🌐 ICE Servers Configuration:');
        this.iceServers.forEach((server, index) => {
            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
            console.log(`[WebRTC]   Server ${index + 1}:`);
            urls.forEach(url => {
                const type = url.startsWith('stun:') ? '🔵 STUN' : url.startsWith('turn:') ? '🟢 TURN' : '🟣 OTHER';
                console.log(`[WebRTC]     ${type}: ${url}`);
                if (server.username) {
                    console.log(`[WebRTC]       Username: ${server.username}`);
                }
            });
        });

        this.peerConnection = new RTCPeerConnection(config);

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                const sender = this.peerConnection.addTrack(track, this.localStream);
                console.log(`[WebRTC] ➕ Added local track: ${track.kind}`);
                
                // Apply bitrate constraint for video
                if (track.kind === 'video' && this.videoSettings.maxBitrate) {
                    this.applyBitrateConstraint(sender);
                }
            });
        }

        // Handle ICE candidates with timeout
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[WebRTC] 🧊 ICE candidate generated');
                this.socket.emit('ice-candidate', {
                    roomId: this.roomId,
                    candidate: event.candidate,
                    targetSocketId: this.remoteSocketId
                });
            } else {
                // ICE gathering complete
                console.log('[WebRTC] ✅ ICE gathering complete');
                this.clearIceGatheringTimeout();
            }
        };

        // Handle ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log(`[WebRTC] 🔄 ICE connection state: ${state}`);
            
            if (state === 'connected' || state === 'completed') {
                this.clearConnectionTimeouts();
            } else if (state === 'disconnected' || state === 'failed') {
                this.clearConnectionTimeouts();
            }
            
            this.handleConnectionStateChange(state);
        };

        // Handle connection state with detailed logging and timeout handling
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log(`[WebRTC] 🔄 Connection state: ${state}`);
            
            if (state === 'connecting') {
                // Start connection timeout
                this.startConnectionTimeout();
            } else if (state === 'connected' || state === 'failed' || state === 'closed') {
                this.clearConnectionTimeouts();
            }
        };

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log(`[WebRTC] 📥 Received remote track: ${event.track.kind}`);
            
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                this.onRemoteStream(this.remoteStream);
            }
        };

        console.log('[WebRTC] ✅ Peer connection created');
        return this.peerConnection;
    }

    /**
     * Apply bitrate constraint to video sender
     */
    async applyBitrateConstraint(sender) {
        try {
            const params = sender.getParameters();
            if (!params.encodings) {
                params.encodings = [{}];
            }
            
            // Set max bitrate in bits per second (settings are in kbps)
            params.encodings[0].maxBitrate = this.videoSettings.maxBitrate * 1000;
            
            await sender.setParameters(params);
            console.log(`[WebRTC] ⚙️ Applied bitrate constraint: ${this.videoSettings.maxBitrate} kbps`);
        } catch (error) {
            console.warn('[WebRTC] ⚠️ Could not apply bitrate constraint:', error.message);
        }
    }

    /**
     * Handle connection state changes
     */
    handleConnectionStateChange(state) {
        this.onConnectionStateChange(state);

        switch (state) {
            case 'connected':
            case 'completed':
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.cancelReconnect();           // Cancel any pending reconnect timer
                this.cancelDisconnectWatchdog();  // Cancel transient-disconnect watchdog
                console.log('[WebRTC] ✅ Connection established');
                
                // Log ICE candidate yang digunakan untuk debugging
                this.logActiveICECandidate();
                
                // Send initial media status when connection is established
                // This ensures remote peer knows our current camera/mic state
                setTimeout(() => {
                    this.sendMediaStatus();
                    console.log('[WebRTC] 📡 Sent initial media status after connection');
                }, 500);
                break;

            case 'disconnected':
                // ICE 'disconnected' is often transient (network blip, browser tab switch).
                // DON'T schedule reconnect immediately — start a watchdog instead.
                // If the connection doesn't self-heal within the grace period, then reconnect.
                console.warn('[WebRTC] ⚠️ Connection disconnected - starting watchdog');
                this.startDisconnectWatchdog();
                break;

            case 'failed':
                // ICE 'failed' is definitive — schedule reconnect right away.
                console.error('[WebRTC] ❌ Connection failed');
                this.cancelDisconnectWatchdog();
                this.scheduleReconnect();
                break;

            case 'closed':
                this.isConnected = false;
                this.cancelDisconnectWatchdog();
                console.log('[WebRTC] 🔒 Connection closed');
                break;
        }
    }

    /**
     * Log active ICE candidate untuk debugging TURN/STUN usage
     */
    async logActiveICECandidate() {
        if (!this.peerConnection) return;

        try {
            const stats = await this.peerConnection.getStats();
            let selectedPair = null;
            let localCandidate = null;
            let remoteCandidate = null;

            // Find selected candidate pair
            stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    selectedPair = report;
                }
            });

            if (selectedPair) {
                // Get local and remote candidates
                stats.forEach(report => {
                    if (report.type === 'local-candidate' && report.id === selectedPair.localCandidateId) {
                        localCandidate = report;
                    }
                    if (report.type === 'remote-candidate' && report.id === selectedPair.remoteCandidateId) {
                        remoteCandidate = report;
                    }
                });

                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('[WebRTC] 🎯 ACTIVE ICE CONNECTION DETAILS:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                if (localCandidate) {
                    console.log('[WebRTC] 📍 Local Candidate:');
                    console.log(`[WebRTC]   Type: ${localCandidate.candidateType}`);
                    console.log(`[WebRTC]   Protocol: ${localCandidate.protocol}`);
                    console.log(`[WebRTC]   Address: ${localCandidate.address || localCandidate.ip}:${localCandidate.port}`);
                    
                    // Identifikasi server yang digunakan
                    if (localCandidate.candidateType === 'relay') {
                        console.log('[WebRTC]   🟢 Using TURN Server (Relay)');
                        console.log(`[WebRTC]   TURN Server: ${localCandidate.relayProtocol || localCandidate.protocol}`);
                        if (localCandidate.address) {
                            const turnServer = this.iceServers.find(s => {
                                const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
                                return urls.some(url => url.includes(localCandidate.address));
                            });
                            if (turnServer) {
                                const urls = Array.isArray(turnServer.urls) ? turnServer.urls : [turnServer.urls];
                                console.log(`[WebRTC]   Server URLs: ${urls.join(', ')}`);
                            }
                        }
                    } else if (localCandidate.candidateType === 'srflx') {
                        console.log('[WebRTC]   🔵 Using STUN Server (Server Reflexive)');
                        console.log('[WebRTC]   Connection: Via public internet (NAT traversal)');
                    } else if (localCandidate.candidateType === 'host') {
                        console.log('[WebRTC]   🟡 Using Local Network (Direct Connection)');
                        console.log('[WebRTC]   Connection: Peer-to-peer without STUN/TURN');
                    }
                }

                if (remoteCandidate) {
                    console.log('[WebRTC] 📍 Remote Candidate:');
                    console.log(`[WebRTC]   Type: ${remoteCandidate.candidateType}`);
                    console.log(`[WebRTC]   Protocol: ${remoteCandidate.protocol}`);
                    console.log(`[WebRTC]   Address: ${remoteCandidate.address || remoteCandidate.ip}:${remoteCandidate.port}`);
                }

                console.log('[WebRTC] 📊 Connection Statistics:');
                console.log(`[WebRTC]   Bytes Sent: ${selectedPair.bytesSent || 0}`);
                console.log(`[WebRTC]   Bytes Received: ${selectedPair.bytesReceived || 0}`);
                console.log(`[WebRTC]   RTT (Round Trip Time): ${selectedPair.currentRoundTripTime ? (selectedPair.currentRoundTripTime * 1000).toFixed(2) + ' ms' : 'N/A'}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            }
        } catch (error) {
            console.warn('[WebRTC] ⚠️ Could not get ICE candidate stats:', error.message);
        }
    }

    /**
     * =========================================================================
     * SIGNALING
     * =========================================================================
     */

    /**
     * Create and send offer (initiator)
     */
    async createOffer(targetSocketId) {
        try {
            console.log('[WebRTC] 📤 Creating offer...');
            this.remoteSocketId = targetSocketId;

            if (!this.peerConnection) {
                this.createPeerConnection();
            }

            // Start ICE gathering timeout
            this.startIceGatheringTimeout();

            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await this.peerConnection.setLocalDescription(offer);

            console.log('[WebRTC] 📤 Sending offer');
            this.socket.emit('offer', {
                roomId: this.roomId,
                offer: offer,
                targetSocketId: targetSocketId
            });
        } catch (error) {
            console.error('[WebRTC] ❌ Failed to create offer:', error.message);
            this.clearConnectionTimeouts();
            this.onError({ type: 'offer', message: error.message });
        }
    }

    /**
     * Handle incoming offer and send answer
     */
    async handleOffer(offer, senderSocketId, senderUsername) {
        try {
            console.log(`[WebRTC] 📥 Received offer from: ${senderUsername}`);
            this.remoteSocketId = senderSocketId;

            // Close existing peer connection if any (for reconnection scenarios)
            if (this.peerConnection) {
                console.log('[WebRTC] 🔄 Closing existing peer connection before handling new offer');
                this.closePeerConnection();
            }
            
            // Create new peer connection
            this.createPeerConnection();

            // Start ICE gathering timeout
            this.startIceGatheringTimeout();

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Process any ICE candidates that arrived before remote description was set
            await this.processPendingIceCandidates();
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            console.log('[WebRTC] 📤 Sending answer');
            this.socket.emit('answer', {
                roomId: this.roomId,
                answer: answer,
                targetSocketId: senderSocketId
            });
        } catch (error) {
            console.error('[WebRTC] ❌ Failed to handle offer:', error.message);
            this.clearConnectionTimeouts();
            this.onError({ type: 'answer', message: error.message });
        }
    }

    /**
     * Handle incoming answer
     */
    async handleAnswer(answer, senderSocketId) {
        try {
            console.log('[WebRTC] 📥 Received answer');
            
            if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('[WebRTC] ✅ Remote description set');
                
                // Process any ICE candidates that arrived before remote description was set
                await this.processPendingIceCandidates();
            }
        } catch (error) {
            console.error('[WebRTC] ❌ Failed to handle answer:', error.message);
        }
    }

    /**
     * Handle incoming ICE candidate
     */
    async handleIceCandidate(candidate) {
        try {
            if (!candidate) return;
            
            // If peer connection doesn't exist or remote description not set yet, queue the candidate
            if (!this.peerConnection || !this.peerConnection.remoteDescription) {
                console.log('[WebRTC] 🧳 Queuing ICE candidate (waiting for remote description)');
                this.pendingIceCandidates.push(candidate);
                return;
            }
            
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('[WebRTC] 🧳 ICE candidate added');
        } catch (error) {
            console.warn('[WebRTC] ⚠️ Failed to add ICE candidate:', error.message);
        }
    }

    /**
     * Process queued ICE candidates after remote description is set
     */
    async processPendingIceCandidates() {
        if (this.pendingIceCandidates.length === 0) return;
        
        console.log(`[WebRTC] 🧳 Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
        
        for (const candidate of this.pendingIceCandidates) {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('[WebRTC] 🧳 Pending ICE candidate added');
            } catch (error) {
                console.warn('[WebRTC] ⚠️ Failed to add pending ICE candidate:', error.message);
            }
        }
        
        this.pendingIceCandidates = [];
    }

    /**
     * =========================================================================
     * RECONNECTION
     * =========================================================================
     */

    /**
     * Cancel any pending reconnect timer
     */
    cancelReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
            console.log('[WebRTC] 🚫 Pending reconnect cancelled');
        }
    }

    /**
     * Start watchdog for transient 'disconnected' state.
     * If connection hasn't recovered after grace period, trigger reconnect.
     */
    startDisconnectWatchdog() {
        this.cancelDisconnectWatchdog();
        this.disconnectWatchdog = setTimeout(() => {
            this.disconnectWatchdog = null;
            if (!this.peerConnection) return; // Already cleaned up
            const iceState = this.peerConnection.iceConnectionState;
            const connState = this.peerConnection.connectionState;
            if (iceState === 'disconnected' || iceState === 'failed' ||
                connState === 'disconnected' || connState === 'failed') {
                console.warn('[WebRTC] ⚠️ Disconnect watchdog triggered — connection did not self-heal, scheduling reconnect');
                this.scheduleReconnect();
            } else {
                console.log(`[WebRTC] ✅ Disconnect watchdog: connection self-healed (${iceState}/${connState})`);
            }
        }, this.DISCONNECT_WATCHDOG_TIMEOUT);
    }

    /**
     * Cancel disconnect watchdog timer
     */
    cancelDisconnectWatchdog() {
        if (this.disconnectWatchdog) {
            clearTimeout(this.disconnectWatchdog);
            this.disconnectWatchdog = null;
        }
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebRTC] ❌ Max reconnect attempts reached');
            this.onReconnectFailed();
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        console.log(`[WebRTC] 🔄 Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        // Store timer ID so it can be cancelled if peer-rejoins via user-joined
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnect();
        }, delay);
    }

    /**
     * Attempt to reconnect
     */
    async reconnect() {
        // Guard: abort if connection already recovered
        if (this.isConnected) {
            console.log('[WebRTC] ✋ Reconnect aborted — already connected');
            return;
        }
        // Guard: abort if a new connection is already being negotiated
        if (this.peerConnection &&
            (this.peerConnection.connectionState === 'connected' ||
             this.peerConnection.connectionState === 'connecting')) {
            console.log('[WebRTC] ✋ Reconnect aborted — connection in progress');
            return;
        }

        console.log(`[WebRTC] 🔄 Attempting reconnect...`);

        // Close stale connection before requesting new one
        this.closePeerConnection();

        // Request reconnection from server — server will forward to peer
        this.socket.emit('reconnect-request', {
            roomId: this.roomId,
            attemptNumber: this.reconnectAttempts
        });
    }

    /**
     * Handle reconnection with peer (called when server forwards reconnect-peer)
     */
    async handleReconnectPeer(socketId, username) {
        console.log(`[WebRTC] 🔄 Reconnecting with peer: ${username} (${socketId})`);
        
        // MUST close existing connection before starting fresh renegotiation
        this.closePeerConnection();
        
        // Small delay for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // createOffer will create peer connection if needed
        await this.createOffer(socketId);
    }

    /**
     * =========================================================================
     * ION-SFU MODE (SFU)
     * =========================================================================
     */

    /**
     * Initialize Ion-SFU client
     */
    initIonSFUClient() {
        if (!this.ionSFUConfig || !this.ionSFUConfig.enabled) {
            console.error('[WebRTC] ❌ Ion-SFU config not available');
            return;
        }

        console.log('[WebRTC] 🎯 Initializing Ion-SFU client...');

        this.ionSFUClient = new IonSFUClient({
            serverUrl: this.ionSFUConfig.serverUrl,
            roomId: this.roomId,
            userId: this.userId,
            username: this.username,
            iceServers: this.iceServers,
            onConnected: () => {
                console.log('[WebRTC] ✅ Ion-SFU connected');
                this.isConnected = true;
                this.onConnectionStateChange('connected');
            },
            onDisconnected: () => {
                console.log('[WebRTC] 🔌 Ion-SFU disconnected');
                this.isConnected = false;
                this.onConnectionStateChange('disconnected');
            },
            onRemoteTrack: (stream, track) => {
                console.log(`[WebRTC] 📥 Ion-SFU remote track: ${track.kind}`);
                this.remoteStream = stream;
                this.onRemoteStream(stream);
                this.isConnected = true;
                this.onConnectionStateChange('connected');
            },
            onError: (error) => {
                console.error('[WebRTC] ❌ Ion-SFU error:', error);
                this.onError(error);
            }
        });
    }

    /**
     * Start SFU session
     */
    async startSFUSession() {
        try {
            console.log('[WebRTC] 🚀 Starting SFU session...');

            // Initialize Ion-SFU client if not already
            if (!this.ionSFUClient) {
                this.initIonSFUClient();
            }

            // Connect to Ion-SFU WebSocket server
            await this.ionSFUClient.connect();

            // Join session
            await this.ionSFUClient.join();

            // Get local stream if not already
            if (!this.localStream) {
                await this.getLocalStream();
            }

            // Publish local stream to SFU
            await this.ionSFUClient.publish(this.localStream);

            console.log('[WebRTC] ✅ SFU session started');

        } catch (error) {
            console.error('[WebRTC] ❌ Failed to start SFU session:', error);
            this.onError({ type: 'sfu', message: error.message });
            throw error;
        }
    }

    /**
     * Stop SFU session
     */
    stopSFUSession() {
        console.log('[WebRTC] 🛑 Stopping SFU session...');
        
        if (this.ionSFUClient) {
            this.ionSFUClient.disconnect();
            this.ionSFUClient = null;
        }
        
        this.isConnected = false;
        console.log('[WebRTC] ✅ SFU session stopped');
    }

    /**
     * =========================================================================
     * CLEANUP
     * =========================================================================
     */

    /**
     * Close peer connection with proper cleanup
     */
    closePeerConnection() {
        // Clear all timeouts first
        this.clearConnectionTimeouts();
        
        // Cancel any pending reconnect timers to avoid interfering with new connections
        this.cancelReconnect();
        this.cancelDisconnectWatchdog();
        
        if (this.peerConnection) {
            // Remove event listeners to prevent memory leaks
            this.peerConnection.onicecandidate = null;
            this.peerConnection.oniceconnectionstatechange = null;
            this.peerConnection.onconnectionstatechange = null;
            this.peerConnection.ontrack = null;
            
            // Close the connection
            this.peerConnection.close();
            this.peerConnection = null;
            console.log('[WebRTC] 🔒 Peer connection closed');
        }
        this.remoteStream = null;
        this.isConnected = false;
        this.pendingIceCandidates = []; // Clear pending candidates
        this.remoteSocketId = null;
    }

    /**
     * Stop all local media tracks
     */
    stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`[WebRTC] ⏹️ Stopped track: ${track.kind}`);
            });
            this.localStream = null;
        }
    }

    /**
     * Full cleanup
     */
    cleanup() {
        console.log('[WebRTC] 🧹 Cleaning up...');
        
        // Cancel all pending timers
        this.clearConnectionTimeouts();
        this.cancelReconnect();
        this.cancelDisconnectWatchdog();
        
        // Cleanup based on mode
        if (this.mode === 'sfu') {
            this.stopSFUSession();
        } else {
            this.closePeerConnection();
        }
        
        this.stopLocalStream();
        this.isConnected = false;
        this.reconnectAttempts = 0;
    }

    /**
     * =========================================================================
     * TIMEOUT MANAGEMENT
     * =========================================================================
     */

    /**
     * Start ICE gathering timeout
     */
    startIceGatheringTimeout() {
        this.clearIceGatheringTimeout();
        
        console.log(`[WebRTC] ⏰ Starting ICE gathering timeout (${this.ICE_GATHERING_TIMEOUT/1000}s)`);
        this.iceGatheringTimeout = setTimeout(() => {
            if (this.peerConnection && this.peerConnection.iceGatheringState !== 'complete') {
                console.warn('[WebRTC] ⚠️ ICE gathering timeout - forcing complete');
                // Don't close connection, just log warning
                // ICE gathering can continue in background
            }
        }, this.ICE_GATHERING_TIMEOUT);
    }

    /**
     * Clear ICE gathering timeout
     */
    clearIceGatheringTimeout() {
        if (this.iceGatheringTimeout) {
            clearTimeout(this.iceGatheringTimeout);
            this.iceGatheringTimeout = null;
        }
    }

    /**
     * Start connection timeout
     */
    startConnectionTimeout() {
        this.clearConnectionTimeout();
        
        console.log(`[WebRTC] ⏰ Starting connection timeout (${this.CONNECTION_TIMEOUT/1000}s)`);
        this.connectionTimeout = setTimeout(() => {
            if (this.peerConnection && 
                this.peerConnection.connectionState === 'connecting' &&
                !this.isConnected) {
                console.error('[WebRTC] ❌ Connection timeout - closing and retrying');
                this.handleConnectionStateChange('failed');
                this.closePeerConnection();
                this.onError({ 
                    type: 'timeout', 
                    message: 'Koneksi timeout. Silakan coba refresh atau keluar dan masuk lagi.' 
                });
            }
        }, this.CONNECTION_TIMEOUT);
    }

    /**
     * Clear connection timeout
     */
    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    /**
     * Clear all connection timeouts
     */
    clearConnectionTimeouts() {
        this.clearIceGatheringTimeout();
        this.clearConnectionTimeout();
    }
}

// Export for use
window.WebRTCHandler = WebRTCHandler;
