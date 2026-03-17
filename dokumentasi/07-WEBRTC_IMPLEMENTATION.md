# 🎥 WebRTC Implementation Deep Dive

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                 WebRTCHandler Class                     │
│                                                         │
│  ┌────────────────┐  ┌────────────────┐               │
│  │  Local Stream  │  │ Remote Stream  │               │
│  │  (Audio+Video) │  │ (Audio+Video)  │               │
│  └────────┬───────┘  └────────┬───────┘               │
│           │                    │                       │
│           └────────┬───────────┘                       │
│                    │                                   │
│                    ▼                                   │
│          ┌──────────────────┐                         │
│          │ PeerConnection   │                         │
│          │  (RTCPeerCon)    │                         │
│          └──────────────────┘                         │
│                    │                                   │
│        ┌───────────┼───────────┐                      │
│        │           │           │                      │
│    Offers       Answers    ICE Candidates            │
│        │           │           │                      │
│        └───────────┼───────────┘                      │
│                    │                                   │
│             [Socket.IO Signaling]                     │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Media Stream Acquisition

### getUserMedia() - Request Camera & Microphone

```javascript
async getLocalStream() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: this.videoSettings.width },
        height: { ideal: this.videoSettings.height },
        frameRate: { ideal: this.videoSettings.maxFramerate },
        facingMode: this.currentCameraFacing  // 'user' or 'environment'
      },
      audio: {
        echoCancellation: this.videoSettings.audioEchoCancellation,
        noiseSuppression: this.videoSettings.audioNoiseSuppression,
        autoGainControl: true
      }
    });

    this.localStream = stream;
    console.log('[WebRTC] ✅ Local stream acquired');
    
    // Update tracks enabled state
    this.isMuted = false;
    this.isCameraTrackEnabled = true;
    
    return stream;
  } catch (error) {
    console.error('[WebRTC] ❌ getUserMedia error:', error);
    
    if (error.name === 'NotAllowedError') {
      // User denied permission
      this.onError({ message: 'Camera/Mic permission denied' });
    } else if (error.name === 'NotFoundError') {
      // No device found
      this.onError({ message: 'Camera/Mic not found' });
    } else if (error.name === 'NotReadableError') {
      // Device already in use
      this.onError({ message: 'Device already in use' });
    }
    
    throw error;
  }
}
```

**Browser Constraints**:
- User must explicitly allow camera/microphone access
- Permission persists for that origin
- HTTPS required (except localhost)
- One getUserMedia per device type at a time

---

### Display Local Video

```javascript
// Once stream acquired, display in video element
const videoElement = document.getElementById('localVideo');
videoElement.srcObject = this.localStream;  // Modern way (HTML5)

// Ensure video plays
await videoElement.play();

// Listen to stream changes (tracks ending)
this.localStream.onremovetrack = (event) => {
  console.warn('[WebRTC] Track removed:', event.track.kind);
};
```

---

## 2. Peer Connection Setup

### Create PeerConnection with ICE Configuration

```javascript
async createPeerConnection() {
  this.peerConnection = new RTCPeerConnection({
    iceServers: this.iceServers,  // STUN/TURN servers
    bundlePolicy: 'max-bundle',   // Combine all media in one connection
    rtcpMuxPolicy: 'require',     // Share RTCP/RTP on same port
    iceTransportPolicy: 'all'     // Use all ICE candidates
  });

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================

  // When local ICE candidate generated
  this.peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('[WebRTC] 📍 ICE candidate:', event.candidate.type);
      
      // Send to peer via Socket.IO
      this.socket.emit('ice-candidate', {
        candidate: event.candidate,
        to: this.remoteSocketId
      });
    } else {
      console.log('[WebRTC] ✅ ICE gathering complete');
    }
  };

  // When ICE connection state changes
  this.peerConnection.oniceconnectionstatechange = (event) => {
    console.log('[WebRTC] 🔗 ICE state:', this.peerConnection.iceConnectionState);
    
    switch (this.peerConnection.iceConnectionState) {
      case 'connected':
      case 'completed':
        console.log('[WebRTC] ✅ ICE connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;  // Reset on successful connect
        this.onConnectionStateChange('connected');
        break;
        
      case 'failed':
        console.error('[WebRTC] ❌ ICE failed');
        this.isConnected = false;
        this.onConnectionStateChange('failed');
        this.attemptReconnect();
        break;
        
      case 'disconnected':
        console.warn('[WebRTC] ⚠️ ICE disconnected');
        // Grace period before treating as failed
        this.setupDisconnectWatchdog();
        break;
        
      case 'closed':
        console.log('[WebRTC] 🔌 Peer connection closed');
        this.isConnected = false;
        break;
    }
  };

  // Connection state change (higher level)
  this.peerConnection.onconnectionstatechange = (event) => {
    console.log('[WebRTC] 📊 Connection state:', this.peerConnection.connectionState);
  };

  // When remote track received
  this.peerConnection.ontrack = (event) => {
    console.log('[WebRTC] 📹 Remote track received:', event.track.kind);
    
    // Set remote stream
    if (!this.remoteStream) {
      this.remoteStream = event.streams[0];
      this.onRemoteStream(this.remoteStream);
    }
    
    // Handle track events
    event.track.onended = () => {
      console.warn('[WebRTC] 🚫 Remote track ended:', event.track.kind);
    };
  };

  // Add local tracks to connection
  if (this.localStream) {
    this.localStream.getTracks().forEach(track => {
      try {
        this.peerConnection.addTrack(track, this.localStream);
        console.log(`[WebRTC] ✅ Added ${track.kind} track`);
      } catch (err) {
        console.error(`[WebRTC] ❌ Error adding ${track.kind} track:`, err);
      }
    });
  }

  console.log('[WebRTC] 🔧 PeerConnection created');
  return this.peerConnection;
}
```

---

### ICE Server Configuration

**STUN** (Session Traversal Utilities for NAT):
```javascript
{
  urls: 'stun:stun.l.google.com:19302'
}
// Server return public IP/port of client
// Cost: None, Google provides free
// Use: Discover own address
```

**TURN** (Traversal Using Relays around NAT):
```javascript
{
  urls: 'turn:turn.example.com:3478',
  username: 'user',
  credential: 'pass'
}
// Server relay traffic between peers
// Cost: Yes, must run own or use service
// Use: When NAT is very restrictive
```

**Configuration Priority**:
1. Local/private TURN server (fastest, full control)
2. Commercial TURN service (reliable, managed)
3. Google STUN fallback (free but may fail)

---

## 3. SDP Offer/Answer Exchange

### Create Offer

```javascript
async createOffer() {
  try {
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });

    await this.peerConnection.setLocalDescription(offer);
    
    console.log('[WebRTC] 📋 Offer created');
    console.log('[WebRTC] Offer SDP (first 100 chars):',
      offer.sdp.substring(0, 100) + '...');

    return offer;
  } catch (error) {
    console.error('[WebRTC] ❌ Error creating offer:', error);
    throw error;
  }
}
```

**What's in SDP Offer**:
```
v=0                           // Version
o=user 123456 789012 IN IP4 192.168.1.1   // Origin
s=WebRTC Session            // Session name
c=IN IP4 192.168.1.1        // Connection
t=0 0                       // Timing

m=audio 54242 RTP/SAVPF 111 // Media: audio
a=rtpmap:111 opus/48000     // Codec
a=fmtp:111 maxplaybackrate=48000  // Codec params

m=video 54243 RTP/SAVPF 96  // Media: video
a=rtpmap:96 VP8/90000       // Video codec
a=rtcp-fb:96 goog-remb      // Feedback mechanism

a=candidate:... // ICE candidates (added later)
```

---

### Create Answer

```javascript
async createAnswer() {
  try {
    // Receiver must set the offer as remote description first
    // This is done in the handler before calling createAnswer
    
    const answer = await this.peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });

    await this.peerConnection.setLocalDescription(answer);
    
    console.log('[WebRTC] 📋 Answer created');
    return answer;
  } catch (error) {
    console.error('[WebRTC] ❌ Error creating answer:', error);
    throw error;
  }
}
```

---

### Set Remote Description

```javascript
async setRemoteDescription(sdp) {
  try {
    const description = new RTCSessionDescription(sdp);
    await this.peerConnection.setRemoteDescription(description);
    
    this.remoteDescriptionSet = true;
    
    // Now safe to add pending ICE candidates
    this.flushPendingIceCandidates();
    
    console.log('[WebRTC] ✅ Remote description set');
  } catch (error) {
    console.error('[WebRTC] ❌ Error setting remote description:', error);
    throw error;
  }
}
```

---

## 4. ICE Candidate Handling

### The Challenge: Race Condition

```
Timeline Problem:
─────────────────

Initiator                    Network                    Receiver
   │                            │                          │
   ├─ create offer              │                          │
   ├─ set local description     │                          │
   │                            │                          │
   ├─ emit offer ───────────────┼──────────────────────►  │
   │                            │                          │
   ├─ ICE candidate 1 ──────────┼──────────────────────►  │
   │ [too early!]               │                          │
   │                            │         Receiver must:
   │                            │         1. Receive offer
   │                            │         2. Set remote description
   │                            │         3. THEN add ICE candidates
   │                            │                          │
   │                            │                  ├─ receive offer
   │                            │                  ├─ set remote description
   │                            │                  ├─ Now can add ICEs
   │                            │◄─ ICE collected ──┤
   │                            │
```

### Solution: Queue Pending ICE Candidates

```javascript
async addIceCandidate(candidate) {
  try {
    // Candidate arrives before remote description set
    if (!this.remoteDescriptionSet) {
      // Queue it for later
      this.pendingIceCandidates.push(candidate);
      console.log('[WebRTC] 📦 ICE candidate queued (waiting for remote description)');
      return;
    }

    // Remote description already set, safe to add immediately
    await this.peerConnection.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
    console.log('[WebRTC] ✅ ICE candidate added');
  } catch (error) {
    console.error('[WebRTC] ⚠️ Error adding ICE candidate:', error);
  }
}

// Called after remote description is set
async flushPendingIceCandidates() {
  if (this.pendingIceCandidates.length === 0) {
    return;
  }

  console.log(`[WebRTC] 📤 Flushing ${this.pendingIceCandidates.length} pending ICE candidates`);
  
  for (const candidate of this.pendingIceCandidates) {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] ⚠️ Error adding pending candidate:', err);
    }
  }
  
  this.pendingIceCandidates = [];
}
```

---

## 5. Media Track Management

### Toggle Audio

```javascript
toggleAudio(enable) {
  if (!this.localStream) return;
  
  const audioTracks = this.localStream.getAudioTracks();
  
  audioTracks.forEach(track => {
    track.enabled = enable;  // Enable/disable without removing
  });
  
  this.isMuted = !enable;
  console.log(`[WebRTC] 🔊 Audio ${enable ? 'enabled' : 'muted'}`);
  
  return this.isMuted;
}
```

**Important**: 
- Setting `track.enabled = false` doesn't actually stop sending audio
- Browser still sends silence frames
- To truly stop: use `peerConnection.removeTrack()`

---

### Toggle Video

```javascript
toggleVideo(enable) {
  if (!this.localStream) return;
  
  const videoTracks = this.localStream.getVideoTracks();
  
  videoTracks.forEach(track => {
    track.enabled = enable;
  });
  
  this.isCameraTrackEnabled = enable;
  console.log(`[WebRTC] 📹 Camera ${enable ? 'on' : 'off'}`);
  
  return this.isCameraTrackEnabled;
}
```

---

### Switch Camera (Front ↔ Back)

```javascript
async switchCamera(facingMode = 'user') {
  try {
    // Stop current video track
    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach(track => track.stop());

    // Get new stream with different camera
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facingMode,  // 'user' (front) or 'environment' (back)
        width: { ideal: this.videoSettings.width },
        height: { ideal: this.videoSettings.height }
      },
      audio: false  // Keep existing audio track
    });

    // Replace video track in peer connection
    const newVideoTrack = newStream.getVideoTracks()[0];
    const sender = this.peerConnection
      .getSenders()
      .find(s => s.track && s.track.kind === 'video');

    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    }

    // Update local stream
    this.removeLocalTrack('video');
    this.localStream.addTrack(newVideoTrack);

    this.currentCameraFacing = facingMode;
    console.log('[WebRTC] 🔄 Camera switched to:', facingMode);
  } catch (error) {
    console.error('[WebRTC] ❌ Error switching camera:', error);
    throw error;
  }
}
```

---

### Screen Sharing

```javascript
async startScreenShare() {
  try {
    // Request screen/window
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always'
      },
      audio: false
    });

    const screenTrack = screenStream.getVideoTracks()[0];
    
    // Save original camera track
    this.originalVideoTrack = this.localStream.getVideoTracks()[0];

    // Replace video track with screen
    const sender = this.peerConnection
      .getSenders()
      .find(s => s.track && s.track.kind === 'video');

    if (sender) {
      await sender.replaceTrack(screenTrack);
    }

    // Update local stream
    this.localStream.removeTrack(this.originalVideoTrack);
    this.localStream.addTrack(screenTrack);

    // Handle screen share stop
    screenTrack.onended = async () => {
      console.log('[WebRTC] 📸 Screen share stopped');
      await this.stopScreenShare();
    };

    this.isScreenSharing = true;
    console.log('[WebRTC] 📺 Screen sharing started');
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      console.log('[WebRTC] User cancelled screen share');
    } else {
      console.error('[WebRTC] ❌ Screen share error:', error);
    }
    throw error;
  }
}

async stopScreenShare() {
  try {
    // Get current (screen) track
    const screenTrack = this.localStream.getVideoTracks()[0];
    
    // Replace with original camera track
    const sender = this.peerConnection
      .getSenders()
      .find(s => s.track && s.track.kind === 'video');

    if (sender && this.originalVideoTrack) {
      await sender.replaceTrack(this.originalVideoTrack);
    }

    // Update local stream
    this.localStream.removeTrack(screenTrack);
    this.localStream.addTrack(this.originalVideoTrack);
    
    screenTrack.stop();
    this.isScreenSharing = false;
    console.log('[WebRTC] 📸 Camera restored');
  } catch (error) {
    console.error('[WebRTC] ❌ Error stopping screen share:', error);
    throw error;
  }
}
```

---

## 6. Bandwidth & Quality Management

### Bitrate Limitation

```javascript
async setBitrate(maxKbps) {
  if (!this.peerConnection) return;

  const senders = this.peerConnection.getSenders();
  
  for (const sender of senders) {
    if (sender.track.kind === 'video') {
      const params = sender.getParameters();
      
      if (!params.encodings) {
        params.encodings = [{}];
      }
      
      params.encodings[0].maxBitrate = maxKbps * 1000;  // Convert to bps
      
      try {
        await sender.setParameters(params);
        console.log(`[WebRTC] ⚙️ Video bitrate limited to ${maxKbps} kbps`);
      } catch (error) {
        console.warn('[WebRTC] ⚠️ Error setting bitrate:', error);
      }
    }
  }
}
```

---

### Video Codec Selection

```javascript
// Prefer specific codec for better quality
async setPreferredVideoCodec(codecName) {
  if (!this.peerConnection) return;

  const sender = this.peerConnection
    .getSenders()
    .find(s => s.track && s.track.kind === 'video');

  if (!sender) return;

  const params = sender.getParameters();
  const codecs = RTCRtpSender.getCapabilities('video').codecs;

  // Find codec by name
  const selectedCodec = codecs.find(c => c.mimeType.includes(codecName));
  
  if (selectedCodec) {
    params.codecs = [selectedCodec, ...codecs.filter(c => c !== selectedCodec)];
    
    try {
      await sender.setParameters(params);
      console.log(`[WebRTC] ⚙️ Preferred codec: ${codecName}`);
    } catch (error) {
      console.warn('[WebRTC] ⚠️ Error setting codec:', error);
    }
  }
}
```

**Common Codecs**:
- **VP8/VP9**: Open source, good quality, higher CPU
- **H.264**: Patent-protected, hardware accelerated, battery efficient
- **AV1**: New, excellent quality but very CPU intensive

---

## 7. Statistics & Monitoring

### Get WebRTC Stats

```javascript
async getConnectionStats() {
  if (!this.peerConnection) return null;

  const stats = {
    video: {},
    audio: {},
    connection: {}
  };

  const report = await this.peerConnection.getStats();

  report.forEach(stat => {
    // Inbound RTP (received from peer)
    if (stat.type === 'inbound-rtp') {
      if (stat.mediaType === 'video') {
        stats.video.received = {
          bytesReceived: stat.bytesReceived,
          framesDecoded: stat.framesDecoded,
          frameSize: `${stat.frameWidth}x${stat.frameHeight}`,
          framesPerSecond: stat.framesPerSecond,
          packetsLost: stat.packetsLost
        };
      }
      if (stat.mediaType === 'audio') {
        stats.audio.bytesReceived = stat.bytesReceived;
      }
    }

    // Outbound RTP (sent to peer)
    if (stat.type === 'outbound-rtp') {
      if (stat.mediaType === 'video') {
        stats.video.sent = {
          bytesSent: stat.bytesSent,
          framesSent: stat.framesSent,
          frameSize: `${stat.frameWidth}x${stat.frameHeight}`,
          framesPerSecond: stat.framesPerSecond,
          qualityLimitation: stat.qualityLimitation
        };
      }
      if (stat.mediaType === 'audio') {
        stats.audio.bytesSent = stat.bytesSent;
      }
    }

    // Candidate pair (connection quality)
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
      stats.connection = {
        currentRoundTripTime: stat.currentRoundTripTime,
        availableOutgoingBitrate: stat.availableOutgoingBitrate,
        availableIncomingBitrate: stat.availableIncomingBitrate,
        bytesReceived: stat.bytesReceived,
        bytesSent: stat.bytesSent
      };
    }
  });

  return stats;
}
```

---

## 8. Connection Recovery

### Auto-Reconnect Mechanism

```javascript
async attemptReconnect() {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    console.error('[WebRTC] ❌ Max reconnect attempts exceeded');
    this.onReconnectFailed({
      message: 'Failed to restore connection',
      attempts: this.reconnectAttempts
    });
    return;
  }

  this.reconnectAttempts++;
  const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
  
  console.log(`[WebRTC] 🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
  
  this.reconnectTimer = setTimeout(async () => {
    try {
      // Close old connection
      this.closeAndCleanup();
      
      // Re-setup
      this._audioRestartNeeded = true;  // Force audio restart for mobile
      await this.createPeerConnection();
      
      // Rejoin room
      this.socket.emit('rejoin-room', {
        roomId: this.roomId
      });
      
      console.log('[WebRTC] ✅ Reconnected successfully');
    } catch (error) {
      console.error('[WebRTC] ❌ Reconnect failed:', error);
      this.attemptReconnect();
    }
  }, delay);
}
```

---

## 9. Mesh vs SFU Mode

### Mesh P2P (Direct Connection)

```javascript
// WebRTC setup directly peer-to-peer
this.mode === 'mesh'

// Advantages
+ Low latency (direct)
+ Server only does signaling
+ Full E2E encryption possible

// Disadvantages
- Both upload/download own media
- NAT issues without TURN
- Bandwidth per user: 2x
```

---

### SFU Mode (Via Ion-SFU)

```javascript
// Connect to SFU server instead
this.mode === 'sfu'
this.ionSFUClient = new IonSFUClient(this.ionSFUConfig)

async connectToSFU() {
  try {
    // Connect WebSocket to SFU
    this.ionSFUClient.ontrack = (track) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      this.remoteStream.addTrack(track);
    };

    await this.ionSFUClient.join(this.roomId);
    
    // Add local tracks to SFU
    this.localStream.getTracks().forEach(track => {
      this.ionSFUClient.publish(track);
    });

    console.log('[WebRTC] ✅ Connected to Ion-SFU');
  } catch (error) {
    console.error('[WebRTC] ❌ SFU connection failed:', error);
    
    // Fallback to mesh if enabled
    if (this.ionSFUConfig.fallbackToMesh) {
      console.log('[WebRTC] 🔄 Falling back to Mesh mode');
      this.mode = 'mesh';
      await this.createPeerConnection();
    }
  }
}
```

**Advantages**:
+ Works through any NAT
+ Server controls bandwidth
+ Easy to scale (group calls)
+ Better admin control

**Disadvantages**:
- Higher server cost
- Slightly higher latency
- Requires SFU server

---

## 10. Mobile Optimizations

### Audio Context for Better Mobile Audio

```javascript
setupAudioContext() {
  if (!window.AudioContext && !window.webkitAudioContext) {
    return;
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();
    
    // iOS specific
    if (navigator.userAgent.includes('iPhone')) {
      // Force audio session to communication mode
      this.audioContext.createGain();  // Trigger audio context
    }
    
    console.log('[WebRTC] 🔊 Audio context initialized');
  } catch (error) {
    console.warn('[WebRTC] ⚠️ Audio context setup failed:', error);
  }
}
```

---

### Mobile Camera Constraints

```javascript
// Mobile devices have different capabilities
async getLocalStream() {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  
  const constraints = {
    video: {
      width: isMobile 
        ? { ideal: 480 }   // Lower res for mobile
        : { ideal: 1280 },
      height: isMobile
        ? { ideal: 360 }
        : { ideal: 720 },
      frameRate: isMobile
        ? { ideal: 15 }    // Lower FPS to save battery
        : { ideal: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      // Mobile specific
      googEchoCancellation: true,
      googNoiseSuppression: true,
      googAutoGainControl: true
    }
  };
  
  return navigator.mediaDevices.getUserMedia(constraints);
}
```

---

## 11. Cleanup & Disconnection

```javascript
async close() {
  try {
    // Stop all media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`[WebRTC] 🛑 Stopped ${track.kind} track`);
      });
    }

    // Close peer connection
    if (this.peerConnection) {
      // Close senders
      this.peerConnection.getSenders().forEach(sender => {
        sender.track?.stop();
      });
      
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Close SFU if used
    if (this.ionSFUClient) {
      await this.ionSFUClient.close();
    }

    // Clear timers
    clearTimeout(this.iceGatheringTimeout);
    clearTimeout(this.connectionTimeout);
    clearTimeout(this.reconnectTimer);

    this.isConnected = false;
    console.log('[WebRTC] ✅ Cleaned up');
  } catch (error) {
    console.error('[WebRTC] ⚠️ Error during cleanup:', error);
  }
}
```

---

## 📊 Common WebRTC Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No video/audio | Permission denied | Check browser permissions, HTTPS required |
| One-way audio | Mute toggle stuck | Ensure track.enabled state matches UI |
| Video freezes | High latency/packet loss | Use TURN server, reduce bitrate |
| App crashes on switch | Not cleaning up streams | Call track.stop() before new stream |
| Mobile audio wrong route | Browser limitation | Use native App for full audio control |
| Black remote video | Track not received | Check ICE candidates, firewall |

---

## 🚀 Performance Benchmarks

| Metric | Target | Note |
|--------|--------|------|
| Time to first video | < 3s | Including getUserMedia |
| Latency (RTT) | 50-200ms | Depends on network |
| Bitrate video | 500-2000 kbps | Varies with quality |
| CPU usage | < 30% | Per peer connection |
| Battery drain | < 10% per hour | Mobile device |

---

## 📝 Next Steps

- ⚙️ Read [08-DEPLOYMENT.md](08-DEPLOYMENT.md) for production setup
- 🛠️ Check [02-SETUP.md](02-SETUP.md) for local development

---

**Last Updated**: March 17, 2025
**Version**: 1.0.0
