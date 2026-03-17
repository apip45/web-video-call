# 📡 Socket.IO Events - Real-time Signaling

## Overview

Socket.IO handles **real-time bidirectional communication** untuk:
- **WebRTC Signaling**: Offer/Answer/ICE candidates
- **Media Status**: Mute/unmute, camera on/off
- **Admin Control**: Disable user camera, force rejoin
- **Notifications**: User joined/left, connection status
- **Stats**: Call statistics & performance monitoring

---

## Connection Sequence

```
┌─────────────────┐           ┌──────────────┐
│   Web Browser   │           │   Server     │
└────────┬────────┘           └──────┬───────┘
         │                           │
         │─── Socket.IO connect ────►│
         │    (session/JWT auth)     │
         │                           │
         │◄─── connection (ACK) ─────│
         │                           │
         │─── emit('join-room') ────►│
         │    {roomId, userInfo}     │
         │                           │
         │                      [Call setup]
         │◄─── on('user-joined') ────│
         │     {remoteUser}          │
         │                           │
      [WebRTC negotiation via offer/answer/candidates]
         │                           │
         │                      ✅ Connected
         │                           │
```

---

## 🔌 Socket Events Reference

### Connection & Room Management

#### Event: `connection`
**Direction**: Server → Auto (happens after auth)

**Emitted by**: Socket.IO automatically after successful auth

**Server-side listener** (src/socket/socketHandler.js):
```javascript
io.on('connection', (socket) => {
  console.log(`[Socket] ✅ Connected: ${socket.username}`);
  // socket.userId, socket.username, socket.userRole now available
});
```

---

#### Event: `join-room`
**Direction**: Client → Server

**Emitted by**: Client after getUserMedia() successful

**Payload**:
```javascript
socket.emit('join-room', {
  roomId: 'abc123',
  username: 'testuser',
  displayName: 'Test User',
  userRole: 'admin|user'
});
```

**Server handling** (socketHandler.js):
```javascript
socket.on('join-room', async (data) => {
  // 1. Validate room & user
  // 2. Add participant to room
  // 3. Notify other participant: user-joined
  // 4. If both participants ready:
  //    - Set one as initiator
  //    - emit 'prepare-offer' to initiator
});
```

**Server response to joining user**: Direct socket update
**Broadcast to other**: `user-joined` event

---

#### Event: `user-joined`
**Direction**: Server → Other participant

**Sent after**: Target user successfully joins room

**Payload**:
```javascript
{
  userId: '507f1f77bcf86cd799439012',
  username: 'user2',
  displayName: 'User Two',
  userRole: 'admin|user',
  socketId: 'socket-id-xyz',
  isInitiator: false
}
```

**Client handler** (room.js):
```javascript
socket.on('user-joined', (data) => {
  console.log(`${data.displayName} joined`);
  remoteUserRole = data.userRole;
  
  // If you're not initiator, create WebRTC peer connection
  if (!data.isInitiator) {
    webrtc.createPeerConnection();
  }
});
```

---

#### Event: `disconnect`
**Direction**: Server → Auto (after socket closes)

**Emitted by**: Socket.IO automatically

**Server-side handler**:
```javascript
socket.on('disconnect', () => {
  // 1. Remove user from room
  // 2. Schedule room cleanup (if empty)
  // 3. Notify other participant: user-left
});
```

---

### WebRTC Signaling

#### Event: `prepare-offer`
**Direction**: Server → Initiator

**Sent after**: Both users in room, ready for negotiation

**Payload**:
```javascript
{
  remoteSocketId: 'socket-id-xyz'
}
```

**Client handler**:
```javascript
socket.on('prepare-offer', async (data) => {
  remoteSocketId = data.remoteSocketId;
  
  // Now create offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  socket.emit('offer', {
    offer: offer,
    to: remoteSocketId
  });
});
```

---

#### Event: `offer`
**Direction**: Client → Server → Other client

**Emitted by**: Initiator after creating offer

**Payload**:
```javascript
{
  offer: RTCSessionDescription,  // SDP
  to: 'socket-id-xyz'
}
```

**Server forwarding**:
```javascript
socket.on('offer', (data) => {
  io.to(data.to).emit('offer', {
    offer: data.offer,
    from: socket.socketId
  });
});
```

**Receiver handler**:
```javascript
socket.on('offer', async (data) => {
  remoteSocketId = data.from;
  
  const description = new RTCSessionDescription(data.offer);
  await peerConnection.setRemoteDescription(description);
  
  // Create answer
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  
  socket.emit('answer', {
    answer: answer,
    to: remoteSocketId
  });
});
```

---

#### Event: `answer`
**Direction**: Client → Server → Initiator

**Emitted by**: Receiver after creating answer

**Payload**:
```javascript
{
  answer: RTCSessionDescription,  // SDP
  to: 'socket-id-xyz'
}
```

**Server forwarding**:
```javascript
socket.on('answer', (data) => {
  io.to(data.to).emit('answer', {
    answer: data.answer,
    from: socket.socketId
  });
});
```

**Initiator handler**:
```javascript
socket.on('answer', async (data) => {
  const description = new RTCSessionDescription(data.answer);
  await peerConnection.setRemoteDescription(description);
  // Connection established, ICE gathering starts
});
```

---

#### Event: `ice-candidate`
**Direction**: Client ↔ Server ↔ Client

**Emitted by**: Both sides when ICE candidates are gathered

**Payload**:
```javascript
{
  candidate: RTCIceCandidate,  // { candidate, sdpMLineIndex, sdpMid }
  to: 'socket-id-xyz'
}
```

**Server forwarding**:
```javascript
socket.on('ice-candidate', (data) => {
  io.to(data.to).emit('ice-candidate', {
    candidate: data.candidate,
    from: socket.socketId
  });
});
```

**Receiver handler**:
```javascript
socket.on('ice-candidate', async (data) => {
  try {
    await peerConnection.addIceCandidate(
      new RTCIceCandidate(data.candidate)
    );
  } catch (err) {
    console.error('Error adding ICE candidate:', err);
  }
});
```

**⚠️ Important**: ICE candidates boleh datang sebelum remote description set:
- Solution: Queue candidates sampai remote description ready
- Implementasi di WebRTCHandler: `pendingIceCandidates` array

---

### Media Control Events

#### Event: `mute-toggle`
**Direction**: Client → Server → Broadcast

**Emitted by**: User when toggle mute button

**Payload**:
```javascript
{
  isMuted: true,
  roomId: 'abc123'
}
```

**Server broadcast**:
```javascript
socket.on('mute-toggle', (data) => {
  io.to(data.roomId).emit('remote-muted', {
    userId: socket.userId,
    isMuted: data.isMuted
  });
});
```

**Other participant handler**:
```javascript
socket.on('remote-muted', (data) => {
  // Update UI: show mute indicator
  // Don't actually mute - they still send audio
  updateMuteIndicator(data.userId, data.isMuted);
});
```

---

#### Event: `camera-toggle`
**Direction**: Client → Server → Broadcast

**Emitted by**: User when toggle camera

**Payload**:
```javascript
{
  isCameraOff: false,
  roomId: 'abc123'
}
```

**Server broadcast**:
```javascript
socket.on('camera-toggle', (data) => {
  io.to(data.roomId).emit('remote-camera-status', {
    userId: socket.userId,
    isCameraOff: data.isCameraOff,
    timestamp: Date.now()
  });
});
```

**Client handler**:
```javascript
socket.on('remote-camera-status', (data) => {
  if (data.userId === remoteUserId) {
    updateCameraIndicator(data.isCameraOff);
  }
});
```

---

### Admin Control Events

#### Event: `admin-disable-camera`
**Direction**: Admin Client → Server → User Client

**Emitted by**: Admin to disable user's camera

**Payload**:
```javascript
{
  targetUserId: '507f1f77bcf86cd799439012',
  targetSocketId: 'socket-id-xyz',
  roomId: 'abc123'
}
```

**Server validation & forwarding**:
```javascript
socket.on('admin-disable-camera', async (data) => {
  // Guard: Check admin control enabled
  const allowed = await guardAdminControl(socket, 'admin-camera-response');
  if (!allowed) return;
  
  // Emit to target user
  io.to(data.targetSocketId).emit('admin-camera-disabled', {
    message: 'Admin has disabled your camera'
  });
});
```

**Target user handler**:
```javascript
socket.on('admin-camera-disabled', (data) => {
  // Disable camera track
  webrtc.disableCameraTrack();
  
  // Update UI
  showNotification('Admin disabled your camera');
  updateCameraButton(false);
});
```

---

#### Event: `admin-mute-audio`
**Direction**: Admin Client → Server → User Client

**Emitted by**: Admin to mute user's microphone

**Payload**:
```javascript
{
  targetUserId: '507f1f77bcf86cd799439012',
  targetSocketId: 'socket-id-xyz',
  roomId: 'abc123'
}
```

**Server validation**:
```javascript
socket.on('admin-mute-audio', async (data) => {
  const allowed = await guardAdminControl(socket, 'admin-audio-response');
  if (!allowed) return;
  
  io.to(data.targetSocketId).emit('admin-audio-muted', {
    message: 'Admin has muted your microphone'
  });
});
```

**Target user handler**:
```javascript
socket.on('admin-audio-muted', (data) => {
  webrtc.muteAudioTrack();
  showNotification('Admin muted your microphone');
});
```

---

#### Event: `admin-force-rejoin`
**Direction**: Admin Client → Server → User Client

**Emitted by**: Admin to kick user from room

**Payload**:
```javascript
{
  targetSocketId: 'socket-id-xyz',
  roomId: 'abc123',
  reason: 'Examination integrity check'
}
```

**Target user handler**:
```javascript
socket.on('admin-force-rejoin', (data) => {
  // Disconnect current peer connection
  webrtc.close();
  
  // Disconnect socket
  socket.disconnect();
  
  // Redirect to home (mobile: show message)
  showNotification(data.reason);
  setTimeout(() => {
    window.location.href = '/';
  }, 2000);
});
```

---

#### Event: `admin-blank-remote`
**Direction**: Admin Client → Server → User Client

**Emitted by**: Admin to hide remote user's video (visual only)

**Payload**:
```javascript
{
  isBlank: true,
  roomId: 'abc123'
}
```

**Server broadcast to room**:
```javascript
socket.on('admin-blank-remote', (data) => {
  const allowed = await guardAdminControl(socket, 'admin-blank-response');
  if (!allowed) return;
  
  io.to(data.roomId).emit('admin-blank-remote-notify', {
    isBlank: data.isBlank
  });
});
```

---

### Statistics & Monitoring

#### Event: `request-stats`
**Direction**: Client → Server

**Emitted by**: Client periodically to get WebRTC stats

**Payload**:
```javascript
{
  roomId: 'abc123'
}
```

**Client loop** (room.js):
```javascript
setInterval(() => {
  socket.emit('request-stats', { roomId: ROOM_DATA.roomId });
}, 1000);  // Every second
```

---

#### Event: `stats-update`
**Direction**: Server → Client (in response to request-stats)

**Sent by**: Server with collected WebRTC metrics

**Payload**:
```javascript
{
  roomId: 'abc123',
  timestamp: 1710682200000,
  stats: {
    localVideo: {
      width: 1280,
      height: 720,
      framesSent: 1500,
      bytesSent: 5242880
    },
    remoteVideo: {
      width: 1280,
      height: 720,
      framesDecoded: 1500,
      bytesReceived: 5242880
    },
    audio: {
      bytesSent: 125000,
      bytesReceived: 125000,
      audioLevel: 60
    },
    connection: {
      state: 'connected',
      currentRoundTripTime: 0.045,
      availableOutgoingBitrate: 2500000
    }
  }
}
```

**Client handler** (room.js):
```javascript
socket.on('stats-update', (data) => {
  updateStatsPanel(data.stats);
  calculateBitrate(data.stats);
});
```

---

#### Event: `call-ended`
**Direction**: Either participant → Server → Other participant

**Emitted by**: User when click "End Call"

**Payload**:
```javascript
{
  roomId: 'abc123',
  userId: '507f1f77bcf86cd799439011',
  sessionDuration: 300,         // seconds
  reason: 'user-initiated'      // or 'network-lost', 'admin-kick'
}
```

**Server handling**:
```javascript
socket.on('call-ended', async (data) => {
  // 1. Save call statistics
  // 2. Remove participant from room
  // 3. Notify other participant: peer-disconnected
  // 4. Schedule room cleanup if no more participants
});
```

**Other participant handler**:
```javascript
socket.on('peer-disconnected', (data) => {
  webrtc.close();
  showNotification('Call ended');
  updateUI('waiting-state');
});
```

---

### Error & Status Events

#### Event: `error`
**Direction**: Server → Client

**Emitted by**: Server on any error condition

**Payload**:
```javascript
{
  message: 'Error description',
  code: 'ERROR_CODE',
  details: {}
}
```

**Common error codes**:
- `ROOM_NOT_FOUND` - Room doesn't exist
- `ROOM_FULL` - Already 2 participants
- `INVALID_TOKEN` - JWT verification failed
- `ADMIN_CONTROL_DISABLED` - Can't execute admin action
- `WEBRTC_ERROR` - Peer connection failed

---

#### Event: `connection-status-change`
**Direction**: Server → Client

**Emitted by**: Server when detects connection state change

**Payload**:
```javascript
{
  state: 'connecting|connected|disconnected|failed',
  reason: 'string',
  timestamp: 1710682200000
}
```

**Client handler**:
```javascript
socket.on('connection-status-change', (data) => {
  updateConnectionIndicator(data.state);
  
  if (data.state === 'failed') {
    showAlert('Connection failed, attempting reconnect...');
    // WebRTCHandler handles auto-reconnect
  }
});
```

---

## 🎯 Event Flow Diagram: Complete Call

```
User A                          Server                          User B
  │                              │                               │
  ├─ Socket.connect ────────────►│                               │
  │  (session/JWT)               │                               │
  │                              │                               │
  ├─ emit join-room ────────────►│                               │
  │                              ├─ emit user-joined ──────────►│
  │                              │                               │
  │                              │                    ┌─ Socket.connect ──┐
  │                              │                    │ (session/JWT)      │
  │                              │                    └────────────────────┘
  │                              │                               │
  │                              │                    ├─ emit join-room ──┐
  │                              │◄──────────────────┤              
  │                              │
  ├─ emit prepare-offer ◄────────┤
  │                              │
  │  [create offer]              │
  │                              │
  ├─ emit offer ─────────────────┤
  │                              ├─ emit offer ──────────────────►│
  │                              │                               │
  │                              │                    [create answer]
  │                              │                               │
  │                              │◄────── emit answer ───────────┤
  │◄──────────────────── emit answer ──────────┤
  │                              │
  ├─ emit ice-candidate ────────►├─ emit ice-candidate ───────►│
  │◄─ emit ice-candidate ────────┤◄─ emit ice-candidate ───────┤
  │                              │
  │  ✅ PeerConnection Ready     │                   ✅ PeerConnection Ready
  │  [Media flowing]             │                   [Media flowing]
  │◄───────────── [Video/Audio Stream] ────────────────►│
  │                              │
  │◄─ emit stats-update ─────────┤───────► emit stats-update ──►│
  │  [every 1 second]            │                               │
  │                              │
  │  [user clicks End Call]      │                               │
  │                              │                               │
  ├─ emit call-ended ───────────►├─ emit peer-disconnected ────►│
  │                              │                               │
  │  [disconnect]                │                   [disconnect]
```

---

## 🔐 Middleware & Guards

### Socket Authentication Middleware

```javascript
io.use((socket, next) => {
  const session = socket.request.session;
  const token = socket.handshake.auth.token;

  // Web: Session-based
  if (session && session.userId) {
    socket.userId = session.userId;
    socket.username = session.username;
    socket.userRole = session.role;
    return next();
  }

  // Mobile: JWT-based
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.SESSION_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.userRole = decoded.role;
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  }

  next(new Error('Unauthorized'));
});
```

### Admin Guard Function

```javascript
async function guardAdminControl(socket, responseEvent) {
  try {
    const enabled = await Settings.getAdminControlEnabled();
    if (!enabled) {
      if (responseEvent) {
        socket.emit(responseEvent, {
          success: false,
          message: 'Admin control disabled'
        });
      }
      return false;
    }
    return true;
  } catch (err) {
    // DB error: fail-open (allow)
    console.warn('Guard check DB error, allowing:', err.message);
    return true;
  }
}
```

---

## 💡 Best Practices

### 1. Always validate on server
```javascript
// ❌ BAD: Trust client input
io.on('join-room', (data) => {
  room.addParticipant(data.userId);  // What if userId is forged?
});

// ✅ GOOD: Use authenticated user ID
io.on('join-room', (data) => {
  room.addParticipant(socket.userId);  // Authenticated user ID
});
```

### 2. Handle connection loss gracefully
```javascript
// Client-side
socket.on('disconnect', () => {
  webrtc.startAutoReconnect();
  showNotification('Connection lost, reconnecting...');
});

socket.on('reconnect', () => {
  webrtc.closeAndRejoin();
  showNotification('Reconnected');
});
```

### 3. Queue ICE candidates before remote description
```javascript
// WebRTCHandler.js
async addIceCandidate(candidate) {
  if (!this.remoteDescriptionSet) {
    // Queue for later
    this.pendingIceCandidates.push(candidate);
  } else {
    // Safe to add immediately
    await this.peerConnection.addIceCandidate(candidate);
  }
}
```

---

## 📝 Next Steps

- 🎥 Read [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md) for media handling
- 🎨 Check [06-FRONTEND_ARCHITECTURE.md](06-FRONTEND_ARCHITECTURE.md) for UI flow

---

**Last Updated**: March 17, 2025
**Version**: 1.0.0
