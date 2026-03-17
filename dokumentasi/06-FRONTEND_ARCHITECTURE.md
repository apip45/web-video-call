# 🎨 Frontend Architecture - React-free Vanilla JavaScript

## Overview

Frontend menggunakan **pure Vanilla JavaScript** (no framework) untuk:
- Lightweight footprint
- Direct DOM manipulation
- Better mobile performance
- No build step needed

**Key Files**:
- `public/js/room.js` - Main controller
- `public/js/webrtc.js` - WebRTC handler
- `public/js/ionSFUClient.js` - Ion-SFU support
- `public/views/room.ejs` - HTML template

---

## File Structure & Responsibilities

### room.js - Main Controller
```
Size: ~1000+ lines
Purpose: Orchestrate entire room experience
Contains: UI logic, Socket.IO handlers, Media controls, Stats display
```

**Initialization Flow**:
```javascript
// On page load
document.addEventListener('DOMContentLoaded', () => {
  init();  // Initialize room
});

async function init() {
  // 1. Get DOM elements cache
  // 2. Create Socket.IO connection (auto-auth via session)
  // 3. Create WebRTCHandler instance
  // 4. Setup event listeners
  // 5. Request camera/microphone
  // 6. Emit 'join-room' to server
}
```

---

### webrtc.js - WebRTC Handler Class
```
Size: ~700+ lines
Purpose: Manage WebRTC peer connection (Mesh & SFU mode)
Contains: Media streams, ICE candidates, track management
```

**Class Structure**:
```javascript
class WebRTCHandler {
  constructor(options) {
    // Initialize properties
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    // ... more properties
  }

  // Media Management
  async getLocalStream() { }
  async switchCamera() { }
  toggleAudio() { }
  toggleVideo() { }

  // Connection Management
  async createPeerConnection() { }
  async addIceCandidate(candidate) { }
  async createOffer() { }
  async createAnswer() { }

  // SFU Support
  async connectToSFU() { }
  async joinSFURoom() { }

  // Cleanup
  close() { }
  stop() { }
}
```

---

### ionSFUClient.js - Ion-SFU Integration
```
Size: ~300+ lines
Purpose: Connect to Ion-SFU server (alternative to peer-to-peer)
Contains: SFU protocol implementation, relay connection
```

**When Used**: `WEBRTC_MODE=sfu`

---

### room.ejs - HTML Template
```
Contains: Video elements, Control buttons, Stats panel, Admin controls
Rendered server-side in Express
```

---

## 🎬 User Journey

### 1. Page Load & Initial Setup

```javascript
// HTML loads room.ejs template
// Global variable injected:
ROOM_DATA = {
  roomId: 'abc123',
  userId: '507f...',
  username: 'testuser',
  userRole: 'admin|user',
  displayName: 'Test User',
  iceServers: [...],
  webrtcMode: 'mesh',
  videoSettings: {...}
}
```

**Browser Timeline**:
```
1. Parse HTML
   ├─ Load CSS
   ├─ Load JavaScript (room.js, webrtc.js, etc)
   └─ Create video elements
   
2. DOMContentLoaded event
   ├─ Cache DOM elements
   ├─ Setup event listener
   └─ Call init()
   
3. init() function
   ├─ Initialize Socket.IO (auto-auth)
   ├─ Create WebRTCHandler
   ├─ Setup Socket listeners
   └─ Request camera/mic
   
4. getUserMedia() granted
   ├─ Display local video
   ├─ Emit 'join-room'
   └─ webrtcReady = true
   
5. Waiting for peer
   └─ Show "Waiting for someone to join..."
```

---

### 2. Peer Joins & WebRTC Negotiation

```javascript
// Server sends 'user-joined'
socket.on('user-joined', async (data) => {
  remoteUserRole = data.userRole;
  remoteSocketId = data.socketId;
  
  // Show UI update
  elements.waitingState.style.display = 'none';
  elements.remoteVideoWrapper.style.display = 'block';
  
  // Only non-initiator creates peer connection here
  if (!data.isInitiator) {
    await webrtc.createPeerConnection();
  }
});

// Initiator receives 'prepare-offer'
socket.on('prepare-offer', async (data) => {
  remoteSocketId = data.remoteSocketId;
  
  // Create and send offer
  const offer = await webrtc.createOffer();
  socket.emit('offer', {
    offer: offer,
    to: remoteSocketId
  });
});

// Receiver gets 'offer'
socket.on('offer', async (data) => {
  remoteSocketId = data.from;
  
  // Set remote description & create answer
  await webrtc.setRemoteDescription(data.offer);
  const answer = await webrtc.createAnswer();
  socket.emit('answer', {
    answer: answer,
    to: remoteSocketId
  });
});

// Initiator gets 'answer'
socket.on('answer', async (data) => {
  await webrtc.setRemoteDescription(data.answer);
  // Connection now established!
});

// Both exchange ICE candidates
socket.on('ice-candidate', async (data) => {
  await webrtc.addIceCandidate(data.candidate);
});
```

**State Transition**:
```
[Waiting]
   │
   ├─ Peer joins ─► [Negotiating] ─ offer/answer/ICE ─► [Connected]
   │
   └─ Peer leaves ──────────────────────────────────► [Disconnected]
```

---

### 3. Active Call - Media Control

User dapat mengontrol media dengan button clicks:

**Mute Microphone**:
```javascript
document.getElementById('micBtn').addEventListener('click', async () => {
  const isMuted = !webrtc.isMuted;
  
  // Disable audio track
  webrtc.localStream.getAudioTracks()[0].enabled = !isMuted;
  webrtc.isMuted = isMuted;
  
  // Notify peer
  socket.emit('mute-toggle', {
    isMuted: isMuted,
    roomId: ROOM_DATA.roomId
  });
  
  // Update UI
  elements.micBtn.classList.toggle('muted', isMuted);
});
```

**Toggle Camera**:
```javascript
document.getElementById('cameraBtn').addEventListener('click', async () => {
  const isOff = !webrtc.isCameraTrackEnabled;
  
  // Disable video track
  webrtc.localStream.getVideoTracks()[0].enabled = isOff;
  webrtc.isCameraTrackEnabled = isOff;
  
  // Notify peer
  socket.emit('camera-toggle', {
    isCameraOff: !isOff,
    roomId: ROOM_DATA.roomId
  });
  
  // Update UI
  elements.cameraBtn.classList.toggle('off', !isOff);
});
```

**Switch Camera (Mobile)**:
```javascript
document.getElementById('switchCameraBtn').addEventListener('click', async () => {
  const newFacing = webrtc.currentCameraFacing === 'user' 
    ? 'environment' 
    : 'user';
  
  await webrtc.switchCamera(newFacing);
  webrtc.currentCameraFacing = newFacing;
});
```

**Screen Share**:
```javascript
document.getElementById('screenShareBtn').addEventListener('click', async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always'
      },
      audio: false
    });
    
    // Replace video track with screen
    const screenTrack = screenStream.getVideoTracks()[0];
    await webrtc.replaceVideoTrack(screenTrack);
    
    // Notify peer (track renegotiation handles via WebRTC)
    
    // When user stops screen share
    screenTrack.onended = async () => {
      await webrtc.restoreCamera();
    };
  } catch (err) {
    console.error('Screen share error:', err);
  }
});
```

---

### 4. Call Statistics Display

Real-time monitoring of connection quality:

```javascript
// Every 1 second
setInterval(() => {
  socket.emit('request-stats', { roomId: ROOM_DATA.roomId });
}, 1000);

socket.on('stats-update', (data) => {
  // Calculate bitrate
  const bitrateSent = calculateBitrate(data.stats.sent);
  const bitrateRecv = calculateBitrate(data.stats.received);
  const latency = data.stats.connection.currentRoundTripTime * 1000;
  
  // Update mini stats (bottom left)
  elements.miniStats.innerHTML = `
    Bitrate: ${bitrateSent} / ${bitrateRecv} kbps
    Latency: ${latency.toFixed(0)} ms
    Video: ${data.stats.localVideo.width}x${data.stats.localVideo.height}
  `;
  
  // Update full stats panel (if open)
  if (statsPanel.visible) {
    updateFullStatsPanel(data.stats);
  }
});
```

**Stats Display Components**:
- Mini stats (always visible, bottom left)
- Full stats panel (click button to toggle)
- Connection quality indicator (color: green/yellow/red)

---

## 🎯 DOM Element Caching

For performance, cache all frequently accessed elements:

```javascript
const elements = {
  // Video elements
  localVideo: document.getElementById('localVideo'),
  remoteVideo: document.getElementById('remoteVideo'),
  localVideoWrapper: document.getElementById('localVideoWrapper'),
  remoteVideoWrapper: document.getElementById('remoteVideoWrapper'),

  // Status indicators
  connectionStatus: document.getElementById('connectionStatus'),
  statusText: document.getElementById('statusText'),
  remoteMuteIndicator: document.getElementById('remoteMuteIndicator'),
  remoteCameraIndicator: document.getElementById('remoteCameraIndicator'),

  // Control buttons
  micBtn: document.getElementById('micBtn'),
  cameraBtn: document.getElementById('cameraBtn'),
  switchCameraBtn: document.getElementById('switchCameraBtn'),
  screenShareBtn: document.getElementById('screenShareBtn'),
  hidePipBtn: document.getElementById('hidePipBtn'),
  endCallBtn: document.getElementById('endCallBtn'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  statsBtn: document.getElementById('statsBtn'),
  
  // Admin controls
  blankRemoteBtn: document.getElementById('blankRemoteBtn'),
  disableCameraBtn: document.getElementById('disableCameraBtn'),
  muteAudioBtn: document.getElementById('muteAudioBtn'),
  forceRejoinBtn: document.getElementById('forceRejoinBtn'),

  // Panels
  statsPanel: document.getElementById('statsPanel'),
  miniStats: document.getElementById('miniStats'),
  toastContainer: document.getElementById('toastContainer'),
  controlsBar: document.getElementById('controlsBar')
};
```

---

## 🎙️ Audio Output Control (Mobile)

Special handling untuk mobile audio routing:

```javascript
class AudioOutputManager {
  constructor() {
    this.usingSpeaker = true;
    this.audioContext = null;
  }

  async setSpeakerOutput(useSpeaker) {
    if (!navigator.mediaDevices.enumerateDevices) {
      console.log('Audio output selection not supported');
      return;
    }

    try {
      const audioTracks = webrtc.remoteStream.getAudioTracks();
      if (audioTracks.length === 0) return;

      // This is limited by browser - actual routing depends on device audio API
      // For better control, use native mobile app
      console.log(`Audio routing: ${useSpeaker ? 'Speaker' : 'Earpiece'}`);
      this.usingSpeaker = useSpeaker;
    } catch (err) {
      console.error('Error setting speaker output:', err);
    }
  }

  toggleAudioOutput() {
    this.setSpeakerOutput(!this.usingSpeaker);
  }
}
```

**Note**: Web browsers memiliki limited control atas audio routing. Full control memerlukan native mobile app.

---

## 📱 Fullscreen & PIP Modes

```javascript
// Fullscreen Mode
elements.fullscreenBtn.addEventListener('click', async () => {
  const container = elements.videoContainer;
  
  if (!isFullscreen) {
    try {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
      isFullscreen = true;
      elements.fullscreenBtn.classList.add('active');
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  } else {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.webkitFullscreenElement) {
      document.webkitExitFullscreen();
    }
    isFullscreen = false;
    elements.fullscreenBtn.classList.remove('active');
  }
});

// Picture-in-Picture Mode
elements.hidePipBtn.addEventListener('click', async () => {
  try {
    if (!isPipHidden) {
      // Show PIP
      await elements.localVideo.requestPictureInPicture();
      isPipHidden = false;
    } else {
      // Exit PIP
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      isPipHidden = true;
    }
    elements.hidePipBtn.classList.toggle('active', !isPipHidden);
  } catch (err) {
    console.error('PIP error:', err);
  }
});
```

---

## 🎨 UI Theme System

```javascript
// themes/theme.js
class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.apply();
  }

  apply() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
  }

  toggle() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.apply();
  }

  get isDark() {
    return this.currentTheme === 'dark';
  }
}

// CSS Variable Support
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #333333;
  --color-primary: #007bff;
}

[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --text-primary: #ffffff;
  --color-primary: #00d4ff;
}
```

---

## 🛡️ Admin Controls UI

Only visible to admin users:

```javascript
// room.ejs
<% if (userRole === 'admin') { %>
  <div id="adminControls">
    <!-- Camera Control -->
    <button id="disableCameraBtn" class="admin-btn">
      🚫 Disable Camera
    </button>
    
    <!-- Audio Control -->
    <button id="muteAudioBtn" class="admin-btn">
      🔇 Mute Audio
    </button>
    
    <!-- Force Rejoin -->
    <button id="forceRejoinBtn" class="admin-btn">
      ⛔ Force Rejoin
    </button>
    
    <!-- Blank Remote -->
    <button id="blankRemoteBtn" class="admin-btn">
      ⬜ Blank Remote
    </button>
  </div>
<% } %>
```

**Handlers**:
```javascript
elements.disableCameraBtn.addEventListener('click', () => {
  socket.emit('admin-disable-camera', {
    targetUserId: remoteUserId,
    targetSocketId: remoteSocketId,
    roomId: ROOM_DATA.roomId
  });
});

elements.muteAudioBtn.addEventListener('click', () => {
  socket.emit('admin-mute-audio', {
    targetUserId: remoteUserId,
    targetSocketId: remoteSocketId,
    roomId: ROOM_DATA.roomId
  });
});

// etc...
```

---

## 🔄 Auto-hide Controls

Controls auto-hide setelah inactivity:

```javascript
const CONTROLS_HIDE_DELAY = 3000; // 3 seconds

function showControls() {
  elements.controlsBar.style.opacity = '1';
  controlsVisible = true;
  
  // Clear existing timeout
  if (controlsHideTimeout) {
    clearTimeout(controlsHideTimeout);
  }
  
  // Auto-hide after delay
  controlsHideTimeout = setTimeout(() => {
    if (controlsVisible && isFullscreen) {
      elements.controlsBar.style.opacity = '0';
      controlsVisible = false;
    }
  }, CONTROLS_HIDE_DELAY);
}

// Trigger on any user interaction
document.addEventListener('mousemove', showControls);
document.addEventListener('touchstart', showControls);
```

---

## 📡 Error Handling & Recovery

```javascript
// WebRTC Connection Error
webrtc.onError = (error) => {
  console.error('WebRTC error:', error);
  showToast(`Error: ${error.message}`, 'error');
  
  // Attempt auto-reconnect
  if (webrtc.reconnectAttempts < webrtc.maxReconnectAttempts) {
    showToast('Attempting reconnect...', 'info');
    webrtc.reconnect();
  } else {
    showToast('Connection failed. Please reload page.', 'error');
  }
};

// Network disconnection
window.addEventListener('offline', () => {
  showToast('Network connection lost', 'error');
  webrtc.startAutoReconnect();
});

window.addEventListener('online', () => {
  showToast('Network restored', 'success');
  if (webrtc.reconnectTimer) {
    webrtc.reconnect();
  }
});
```

---

## 🔔 Toast Notifications

```javascript
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  elements.toastContainer.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Usage
showToast('Call started', 'success');
showToast('User muted', 'info');
showToast('Connection error', 'error');
```

---

## 💾 Session Recovery

```javascript
// Before unload/refresh - save state
window.addEventListener('beforeunload', (e) => {
  if (webrtc.isConnected) {
    // Notify server
    socket.emit('call-ended', {
      roomId: ROOM_DATA.roomId,
      userId: ROOM_DATA.userId,
      sessionDuration: calculateSessionDuration(),
      reason: 'page-unload'
    });
    
    // Close connections gracefully
    webrtc.close();
    socket.disconnect();
  }
});
```

---

## 📊 Performance Optimization

### Memory Management
```javascript
// Cleanup on disconnect
function cleanup() {
  // Stop all media tracks
  webrtc.localStream?.getTracks().forEach(track => track.stop());
  webrtc.remoteStream?.getTracks().forEach(track => track.stop());
  
  // Close peer connection
  webrtc.peerConnection?.close();
  
  // Clear intervals
  if (statsInterval) clearInterval(statsInterval);
  
  // Disconnect socket
  socket.disconnect(true);
  
  // Clear element cache (or reuse)
  webrtc = null;
  socket = null;
}
```

### DOM Batch Updates
```javascript
// ❌ BAD: Multiple reflows
for (let i = 0; i < 100; i++) {
  element.style.left = i + 'px';  // Triggers reflow each time
}

// ✅ GOOD: Batch updates
element.style.transition = 'all 0.3s ease';
element.style.transform = `translateX(100px)`;
```

---

## 📝 Best Practices

1. **Minimize DOM queries**: Cache elements at initialization
2. **Use event delegation**: For dynamically added elements
3. **Async/await**: For cleaner async code
4. **Error boundaries**: Wrap try-catch around media ops
5. **Progressive enhancement**: Work without features (no camera = chat)

---

## 🔗 File Dependencies

```
room.ejs
├── room.js (Main controller)
│   ├── webrtc.js (Media handling)
│   ├── ionSFUClient.js (SFU optional)
│   └── Socket.IO (Real-time)
├── theme.js (UI theme)
├── videoQualityPresets.js (Quality settings)
└── CSS files
    ├── style.css (Global)
    ├── room.css (Room specific)
    └── admin.css (Admin specific)
```

---

## 🚀 Next Steps

- 🎥 Read [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md) for media deep-dive
- ⚙️ Check [08-DEPLOYMENT.md](08-DEPLOYMENT.md) for production setup

---

**Last Updated**: March 17, 2025
**Version**: 1.0.0
