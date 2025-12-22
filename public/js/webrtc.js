/**
 * =============================================================================
 * WEBRTC HANDLER
 * =============================================================================
 * WebRTC peer connection dengan auto reconnect
 * Mendukung mobile: switch camera, audio output
 */

class WebRTCHandler {
    constructor(options = {}) {
        this.roomId = options.roomId;
        this.userId = options.userId;
        this.username = options.username;
        this.iceServers = options.iceServers || [];
        this.socket = options.socket;

        // State
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isInitiator = false;
        this.isConnected = false;
        this.isMuted = false;
        this.isCameraTrackEnabled = true; // Actual track enabled state
        this.isCameraHidden = false; // Visual state (for non-admin preview)
        this.usingSpeaker = true;
        this.currentCameraFacing = 'user'; // 'user' = front, 'environment' = back
        this.userRole = null; // Will be set by room.js

        // Reconnect config
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;

        // Callbacks
        this.onRemoteStream = options.onRemoteStream || (() => {});
        this.onConnectionStateChange = options.onConnectionStateChange || (() => {});
        this.onRemoteMediaStatus = options.onRemoteMediaStatus || (() => {});
        this.onUserJoined = options.onUserJoined || (() => {});
        this.onUserLeft = options.onUserLeft || (() => {});
        this.onReconnectFailed = options.onReconnectFailed || (() => {});
        this.onError = options.onError || (() => {});

        console.log('[WebRTC] 🔧 Handler initialized');
        console.log(`[WebRTC] 🌐 ICE servers: ${this.iceServers.length}`);
        
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
                    echoCancellation: this.videoSettings.audioEchoCancellation,
                    noiseSuppression: this.videoSettings.audioNoiseSuppression,
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
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
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
     * Toggle audio output (speaker/earpiece) - Mobile
     */
    toggleAudioOutput(remoteVideoElement) {
        if (!remoteVideoElement) return false;

        try {
            this.usingSpeaker = !this.usingSpeaker;
            
            // Use sinkId if supported (Chrome)
            if (typeof remoteVideoElement.setSinkId === 'function') {
                // Note: This requires HTTPS and user permission
                console.log(`[WebRTC] 🔊 Audio output: ${this.usingSpeaker ? 'Speaker' : 'Earpiece'}`);
            }

            return this.usingSpeaker;
        } catch (error) {
            console.error('[WebRTC] ❌ Failed to toggle audio output:', error.message);
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
                // Non-admin (user): only toggle visual, track stays always enabled
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

        const config = {
            iceServers: this.iceServers,
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };

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

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[WebRTC] 🧊 ICE candidate generated');
                this.socket.emit('ice-candidate', {
                    roomId: this.roomId,
                    candidate: event.candidate,
                    targetSocketId: this.remoteSocketId
                });
            }
        };

        // Handle ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log(`[WebRTC] 🔄 ICE connection state: ${state}`);
            
            this.handleConnectionStateChange(state);
        };

        // Handle connection state
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log(`[WebRTC] 🔄 Connection state: ${state}`);
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
                console.log('[WebRTC] ✅ Connection established');
                
                // Send initial media status when connection is established
                // This ensures remote peer knows our current camera/mic state
                setTimeout(() => {
                    this.sendMediaStatus();
                    console.log('[WebRTC] 📡 Sent initial media status after connection');
                }, 500);
                break;

            case 'disconnected':
                console.warn('[WebRTC] ⚠️ Connection disconnected');
                this.scheduleReconnect();
                break;

            case 'failed':
                console.error('[WebRTC] ❌ Connection failed');
                this.scheduleReconnect();
                break;

            case 'closed':
                this.isConnected = false;
                console.log('[WebRTC] 🔒 Connection closed');
                break;
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

            if (!this.peerConnection) {
                this.createPeerConnection();
            }

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
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
            if (this.peerConnection && candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('[WebRTC] 🧊 ICE candidate added');
            }
        } catch (error) {
            console.warn('[WebRTC] ⚠️ Failed to add ICE candidate:', error.message);
        }
    }

    /**
     * =========================================================================
     * RECONNECTION
     * =========================================================================
     */

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
        console.log(`[WebRTC] 🔄 Scheduling reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.reconnect();
        }, this.reconnectDelay * this.reconnectAttempts);
    }

    /**
     * Attempt to reconnect
     */
    async reconnect() {
        console.log(`[WebRTC] 🔄 Attempting reconnect...`);

        // Close existing connection
        this.closePeerConnection();

        // Request reconnection from server
        this.socket.emit('reconnect-request', {
            roomId: this.roomId,
            attemptNumber: this.reconnectAttempts
        });
    }

    /**
     * Handle reconnection with peer
     */
    async handleReconnectPeer(socketId, username) {
        console.log(`[WebRTC] 🔄 Reconnecting with peer: ${username}`);
        
        // Create new connection and send offer
        this.createPeerConnection();
        await this.createOffer(socketId);
    }

    /**
     * =========================================================================
     * CLEANUP
     * =========================================================================
     */

    /**
     * Close peer connection
     */
    closePeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
            console.log('[WebRTC] 🔒 Peer connection closed');
        }
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
        this.closePeerConnection();
        this.stopLocalStream();
        this.isConnected = false;
        this.reconnectAttempts = 0;
    }
}

// Export for use
window.WebRTCHandler = WebRTCHandler;
