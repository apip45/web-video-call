/**
 * =============================================================================
 * ION-SFU CLIENT
 * =============================================================================
 * WebSocket client untuk komunikasi dengan Ion-SFU server
 * Handles: join session, publish tracks, subscribe tracks, ICE candidates
 * 
 * Ion-SFU Protocol (JSON-RPC over WebSocket):
 * - join: Join a session (room)
 * - offer: Publish local tracks to SFU
 * - answer: Receive answer from SFU for published tracks
 * - trickle: Send ICE candidates to SFU
 */

class IonSFUClient {
    constructor(options = {}) {
        this.serverUrl = options.serverUrl || 'wss://sfu.mikan.my.id/ws';
        this.roomId = options.roomId;
        this.userId = options.userId;
        this.username = options.username;
        
        // WebSocket
        this.ws = null;
        this.wsConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        // RTCPeerConnection untuk publish (upload) local tracks ke SFU
        this.publishPC = null;
        
        // RTCPeerConnection untuk subscribe (download) remote tracks dari SFU
        this.subscribePC = null;
        
        // Tracks
        this.localStream = null;
        this.remoteStream = null;
        
        // JSON-RPC
        this.requestId = 1;
        this.pendingRequests = new Map();
        
        // ICE servers (akan diset dari config)
        this.iceServers = options.iceServers || [];
        
        // Callbacks
        this.onConnected = options.onConnected || (() => {});
        this.onDisconnected = options.onDisconnected || (() => {});
        this.onRemoteTrack = options.onRemoteTrack || (() => {});
        this.onError = options.onError || (() => {});
        
        console.log('[IonSFU] 🎯 Client initialized');
        console.log(`[IonSFU] 🌐 Server: ${this.serverUrl}`);
        console.log(`[IonSFU] 🚪 Room: ${this.roomId}`);
    }

    /**
     * =========================================================================
     * WEBSOCKET CONNECTION
     * =========================================================================
     */

    /**
     * Connect to Ion-SFU WebSocket server
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log(`[IonSFU] 🔌 Connecting to: ${this.serverUrl}`);
                
                this.ws = new WebSocket(this.serverUrl);
                
                this.ws.onopen = () => {
                    console.log('[IonSFU] ✅ WebSocket connected');
                    this.wsConnected = true;
                    this.reconnectAttempts = 0;
                    this.onConnected();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                
                this.ws.onerror = (error) => {
                    console.error('[IonSFU] ❌ WebSocket error:', error);
                    this.onError(error);
                    reject(error);
                };
                
                this.ws.onclose = (event) => {
                    console.log('[IonSFU] 🔌 WebSocket closed:', event.code, event.reason);
                    this.wsConnected = false;
                    this.onDisconnected();
                    
                    // Auto reconnect
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`[IonSFU] 🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                        setTimeout(() => this.connect(), this.reconnectDelay);
                    } else {
                        console.error('[IonSFU] ❌ Max reconnect attempts reached');
                        this.onError(new Error('Failed to reconnect to SFU server'));
                    }
                };
                
            } catch (error) {
                console.error('[IonSFU] ❌ Connection error:', error);
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        console.log('[IonSFU] 🔌 Disconnecting...');
        
        if (this.publishPC) {
            this.publishPC.close();
            this.publishPC = null;
        }
        
        if (this.subscribePC) {
            this.subscribePC.close();
            this.subscribePC = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.wsConnected = false;
        console.log('[IonSFU] ✅ Disconnected');
    }

    /**
     * =========================================================================
     * JSON-RPC PROTOCOL
     * =========================================================================
     */

    /**
     * Send JSON-RPC request
     * @param {string} method - Method name
     * @param {Object} params - Parameters
     * @returns {Promise} Response data
     */
    sendRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.wsConnected) {
                reject(new Error('WebSocket not connected'));
                return;
            }
            
            const id = this.requestId++;
            const request = {
                jsonrpc: '2.0',
                id: id,
                method: method,
                params: params
            };
            
            this.pendingRequests.set(id, { resolve, reject });
            
            console.log(`[IonSFU] 📤 Sending request:`, method, params);
            this.ws.send(JSON.stringify(request));
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request timeout: ${method}`));
                }
            }, 10000);
        });
    }

    /**
     * Send JSON-RPC notification (no response expected)
     * @param {string} method - Method name
     * @param {Object} params - Parameters
     */
    sendNotification(method, params = {}) {
        if (!this.wsConnected) {
            console.error('[IonSFU] ❌ Cannot send notification: WebSocket not connected');
            return;
        }
        
        const notification = {
            jsonrpc: '2.0',
            method: method,
            params: params
        };
        
        console.log(`[IonSFU] 📤 Sending notification:`, method);
        this.ws.send(JSON.stringify(notification));
    }

    /**
     * Handle incoming WebSocket message
     * @param {string} data - JSON string
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log(`[IonSFU] 📥 Received message:`, message);
            
            // Response to request
            if (message.id && this.pendingRequests.has(message.id)) {
                const { resolve, reject } = this.pendingRequests.get(message.id);
                this.pendingRequests.delete(message.id);
                
                if (message.error) {
                    console.error(`[IonSFU] ❌ Request error:`, message.error);
                    reject(new Error(message.error.message || 'Request failed'));
                } else {
                    resolve(message.result);
                }
            }
            // Notification from server
            else if (message.method) {
                this.handleNotification(message.method, message.params);
            }
            
        } catch (error) {
            console.error('[IonSFU] ❌ Message parse error:', error);
        }
    }

    /**
     * Handle notification from server
     * @param {string} method - Notification method
     * @param {Object} params - Parameters
     */
    handleNotification(method, params) {
        console.log(`[IonSFU] 🔔 Notification:`, method, params);
        
        switch (method) {
            case 'offer':
                // SFU sending offer for subscribe peer connection
                this.handleSubscribeOffer(params);
                break;
                
            case 'trickle':
                // ICE candidate from SFU
                this.handleTrickle(params);
                break;
                
            default:
                console.log(`[IonSFU] ⚠️ Unknown notification:`, method);
        }
    }

    /**
     * =========================================================================
     * SESSION MANAGEMENT
     * =========================================================================
     */

    /**
     * Join session (room)
     * @returns {Promise}
     */
    async join() {
        try {
            console.log(`[IonSFU] 🚪 Joining session: ${this.roomId}`);
            
            const response = await this.sendRequest('join', {
                sid: this.roomId,  // Session ID = Room ID
                uid: this.userId,  // User ID
                offer: null  // No offer yet, will publish later
            });
            
            console.log('[IonSFU] ✅ Joined session:', response);
            return response;
            
        } catch (error) {
            console.error('[IonSFU] ❌ Join failed:', error);
            throw error;
        }
    }

    /**
     * =========================================================================
     * PUBLISH (Upload local tracks to SFU)
     * =========================================================================
     */

    /**
     * Publish local stream to SFU
     * @param {MediaStream} stream - Local media stream
     * @returns {Promise}
     */
    async publish(stream) {
        try {
            console.log('[IonSFU] 📤 Publishing local stream...');
            this.localStream = stream;
            
            // Log ICE servers configuration
            console.log('[IonSFU] 🌐 Publish Connection - ICE Servers Configuration:');
            this.iceServers.forEach((server, index) => {
                const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                console.log(`[IonSFU]   Server ${index + 1}:`);
                urls.forEach(url => {
                    const type = url.startsWith('stun:') ? '🔵 STUN' : url.startsWith('turn:') ? '🟢 TURN' : '🟣 OTHER';
                    console.log(`[IonSFU]     ${type}: ${url}`);
                    if (server.username) {
                        console.log(`[IonSFU]       Username: ${server.username}`);
                    }
                });
            });
            
            // Create RTCPeerConnection for publishing
            this.publishPC = new RTCPeerConnection({
                iceServers: this.iceServers,
                bundlePolicy: 'max-bundle'
            });
            
            // Add local tracks to peer connection
            stream.getTracks().forEach(track => {
                console.log(`[IonSFU] 📹 Adding track: ${track.kind}`);
                this.publishPC.addTrack(track, stream);
            });
            
            // Handle ICE candidates for publish PC
            this.publishPC.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('[IonSFU] 🧊 Publish ICE candidate');
                    this.sendNotification('trickle', {
                        target: 0,  // 0 = publisher
                        candidate: event.candidate.toJSON()
                    });
                }
            };
            
            // Monitor ICE connection state for publish
            this.publishPC.oniceconnectionstatechange = () => {
                console.log(`[IonSFU] 🔄 Publish ICE state: ${this.publishPC.iceConnectionState}`);
                if (this.publishPC.iceConnectionState === 'connected' || 
                    this.publishPC.iceConnectionState === 'completed') {
                    this.logActiveICECandidate(this.publishPC, 'PUBLISH');
                }
            };
            
            // Create offer
            const offer = await this.publishPC.createOffer();
            await this.publishPC.setLocalDescription(offer);
            
            console.log('[IonSFU] 📤 Sending publish offer...');
            
            // Send offer to SFU
            const response = await this.sendRequest('offer', {
                sid: this.roomId,
                offer: {
                    type: offer.type,
                    sdp: offer.sdp
                }
            });
            
            // Set remote description (answer from SFU)
            if (response && response.sdp) {
                console.log('[IonSFU] 📥 Received publish answer');
                await this.publishPC.setRemoteDescription(new RTCSessionDescription({
                    type: 'answer',
                    sdp: response.sdp
                }));
            }
            
            console.log('[IonSFU] ✅ Published successfully');
            
            // Now subscribe to remote tracks
            await this.subscribe();
            
        } catch (error) {
            console.error('[IonSFU] ❌ Publish failed:', error);
            throw error;
        }
    }

    /**
     * =========================================================================
     * SUBSCRIBE (Download remote tracks from SFU)
     * =========================================================================
     */

    /**
     * Subscribe to remote tracks from SFU
     * @returns {Promise}
     */
    async subscribe() {
        try {
            console.log('[IonSFU] 📥 Subscribing to remote tracks...');
            
            // Create RTCPeerConnection for subscribing
            this.subscribePC = new RTCPeerConnection({
                iceServers: this.iceServers,
                bundlePolicy: 'max-bundle'
            });
            
            // Handle remote tracks
            this.subscribePC.ontrack = (event) => {
                console.log(`[IonSFU] 🎬 Remote track received: ${event.track.kind}`);
                
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                }
                
                this.remoteStream.addTrack(event.track);
                this.onRemoteTrack(this.remoteStream, event.track);
            };
            
            // Handle ICE candidates for subscribe PC
            this.subscribePC.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('[IonSFU] 🧊 Subscribe ICE candidate');
                    this.sendNotification('trickle', {
                        target: 1,  // 1 = subscriber
                        candidate: event.candidate.toJSON()
                    });
                }
            };
            
            // Monitor ICE connection state for subscribe
            this.subscribePC.oniceconnectionstatechange = () => {
                console.log(`[IonSFU] 🔄 Subscribe ICE state: ${this.subscribePC.iceConnectionState}`);
                if (this.subscribePC.iceConnectionState === 'connected' || 
                    this.subscribePC.iceConnectionState === 'completed') {
                    this.logActiveICECandidate(this.subscribePC, 'SUBSCRIBE');
                }
            };
            
            // Create offer for subscribing (required by Ion-SFU protocol)
            // Add transceiver for receiving video and audio
            this.subscribePC.addTransceiver('video', { direction: 'recvonly' });
            this.subscribePC.addTransceiver('audio', { direction: 'recvonly' });
            
            const offer = await this.subscribePC.createOffer();
            await this.subscribePC.setLocalDescription(offer);
            
            console.log('[IonSFU] 📥 Sending subscribe offer...');
            
            // Send subscribe offer to SFU
            // Note: SFU will send back an offer (not answer) which we need to handle
            // This is stored and will be handled when server sends 'offer' notification
            
            console.log('[IonSFU] ✅ Subscribe setup complete, waiting for tracks...');
            
        } catch (error) {
            console.error('[IonSFU] ❌ Subscribe failed:', error);
            throw error;
        }
    }

    /**
     * Handle subscribe offer from SFU
     * SFU sends an offer containing remote tracks
     * @param {Object} params - Offer parameters
     */
    async handleSubscribeOffer(params) {
        try {
            console.log('[IonSFU] 📥 Handling subscribe offer from SFU');
            
            if (!this.subscribePC) {
                console.error('[IonSFU] ❌ Subscribe PC not initialized');
                return;
            }
            
            // Set remote description (offer from SFU)
            await this.subscribePC.setRemoteDescription(new RTCSessionDescription({
                type: 'offer',
                sdp: params.sdp
            }));
            
            // Create answer
            const answer = await this.subscribePC.createAnswer();
            await this.subscribePC.setLocalDescription(answer);
            
            // Send answer back to SFU
            await this.sendRequest('answer', {
                sid: this.roomId,
                answer: {
                    type: answer.type,
                    sdp: answer.sdp
                }
            });
            
            console.log('[IonSFU] ✅ Subscribe answer sent');
            
        } catch (error) {
            console.error('[IonSFU] ❌ Handle subscribe offer failed:', error);
        }
    }

    /**
     * Handle trickle ICE candidate from SFU
     * @param {Object} params - Trickle parameters
     */
    async handleTrickle(params) {
        try {
            const { target, candidate } = params;
            const pc = target === 0 ? this.publishPC : this.subscribePC;
            
            if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log(`[IonSFU] 🧊 ICE candidate added (target: ${target})`);
            }
            
        } catch (error) {
            console.error('[IonSFU] ❌ Add ICE candidate failed:', error);
        }
    }

    /**
     * =========================================================================
     * UTILITY METHODS
     * =========================================================================
     */

    /**
     * Get connection stats
     * @returns {Object} Connection statistics
     */
    async getStats() {
        const stats = {
            publish: null,
            subscribe: null
        };
        
        if (this.publishPC) {
            stats.publish = await this.publishPC.getStats();
        }
        
        if (this.subscribePC) {
            stats.subscribe = await this.subscribePC.getStats();
        }
        
        return stats;
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.wsConnected && 
               (this.publishPC && this.publishPC.connectionState === 'connected');
    }

    /**
     * Log active ICE candidate untuk debugging TURN/STUN usage
     */
    async logActiveICECandidate(peerConnection, connectionType) {
        if (!peerConnection) return;

        try {
            const stats = await peerConnection.getStats();
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

                console.log('══════════════════════════════════════════════════');
                console.log(`[IonSFU] 🎯 ACTIVE ICE ${connectionType} CONNECTION DETAILS:`);
                console.log('══════════════════════════════════════════════════');
                
                if (localCandidate) {
                    console.log('[IonSFU] 📍 Local Candidate:');
                    console.log(`[IonSFU]   Type: ${localCandidate.candidateType}`);
                    console.log(`[IonSFU]   Protocol: ${localCandidate.protocol}`);
                    console.log(`[IonSFU]   Address: ${localCandidate.address || localCandidate.ip}:${localCandidate.port}`);
                    
                    // Identifikasi server yang digunakan
                    if (localCandidate.candidateType === 'relay') {
                        console.log('[IonSFU]   🟢 Using TURN Server (Relay)');
                        console.log(`[IonSFU]   TURN Server: ${localCandidate.relayProtocol || localCandidate.protocol}`);
                        if (localCandidate.address) {
                            const turnServer = this.iceServers.find(s => {
                                const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
                                return urls.some(url => url.includes(localCandidate.address));
                            });
                            if (turnServer) {
                                const urls = Array.isArray(turnServer.urls) ? turnServer.urls : [turnServer.urls];
                                console.log(`[IonSFU]   Server URLs: ${urls.join(', ')}`);
                            }
                        }
                    } else if (localCandidate.candidateType === 'srflx') {
                        console.log('[IonSFU]   🔵 Using STUN Server (Server Reflexive)');
                        console.log('[IonSFU]   Connection: Via public internet (NAT traversal)');
                    } else if (localCandidate.candidateType === 'host') {
                        console.log('[IonSFU]   🟡 Using Local Network (Direct to SFU)');
                        console.log('[IonSFU]   Connection: Direct without STUN/TURN');
                    }
                }

                if (remoteCandidate) {
                    console.log('[IonSFU] 📍 Remote Candidate (SFU):');
                    console.log(`[IonSFU]   Type: ${remoteCandidate.candidateType}`);
                    console.log(`[IonSFU]   Protocol: ${remoteCandidate.protocol}`);
                    console.log(`[IonSFU]   Address: ${remoteCandidate.address || remoteCandidate.ip}:${remoteCandidate.port}`);
                }

                console.log('[IonSFU] 📊 Connection Statistics:');
                console.log(`[IonSFU]   Bytes Sent: ${selectedPair.bytesSent || 0}`);
                console.log(`[IonSFU]   Bytes Received: ${selectedPair.bytesReceived || 0}`);
                console.log(`[IonSFU]   RTT (Round Trip Time): ${selectedPair.currentRoundTripTime ? (selectedPair.currentRoundTripTime * 1000).toFixed(2) + ' ms' : 'N/A'}`);
                console.log('══════════════════════════════════════════════════');
            }
        } catch (error) {
            console.warn('[IonSFU] ⚠️ Could not get ICE candidate stats:', error.message);
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IonSFUClient;
}
