# 📡 WebSocket Events - Complete Event Reference

## Daftar Lengkap Socket.IO Events untuk WebRTC Signaling

---

## 🚀 Connection Events

### **Connect**
```dart
socket.on('connect', (_) {
  print('✅ Socket connected: ${socket.id}');
});
```

### **Disconnect**
```dart
socket.on('disconnect', (_) {
  print('❌ Socket disconnected');
});
```

### **Connect Error**
```dart
socket.on('connect_error', (error) {
  print('❌ Connection error: $error');
});
```

---

## 🏠 Room Events

### **1. Join Room (Client → Server)**

```dart
socket.emit('joinRoom', {
  'roomId': 'room123',
  'userId': 'user456',
  'userName': 'John Doe',
  'userEmail': 'john@example.com',
});
```

**Server Response**:
```dart
socket.on('existingPeers', (data) {
  List<String> peers = List.from(data['peers']);
  print('Existing peers: $peers');
});
```

---

### **2. User Joined (Server → Clients)**

```dart
socket.on('userJoined', (data) {
  String userId = data['userId'];
  String userName = data['userName'];
  String userEmail = data['userEmail'];
  
  print('📲 User joined: $userName');
  // Create peer connection for this user
});
```

---

### **3. Leave Room (Client → Server)**

```dart
socket.emit('leaveRoom', {
  'roomId': 'room123',
  'userId': 'user456',
});
```

---

### **4. User Left (Server → Clients)**

```dart
socket.on('userLeft', (data) {
  String userId = data['userId'];
  
  print('📴 User left: $userId');
  // Close peer connection
  // Remove from UI
});
```

---

## 🎥 WebRTC Signaling Events

### **1. Send Offer (Client A → Server → Client B)**

```dart
// Client A creates offer
final offer = await webrtcService.createOffer(peerId);

// Send to specific peer
socket.emit('offer', {
  'to': peerId,
  'from': myUserId,
  'offer': {
    'type': offer.type,  // 'offer'
    'sdp': offer.sdp,    // Session Description Protocol
  },
});
```

---

### **2. Receive Offer (Server → Client B)**

```dart
socket.on('offer', (data) {
  String fromPeerId = data['from'];
  Map<String, dynamic> offerSdp = data['offer'];
  
  // Create RTCSessionDescription
  final offer = RTCSessionDescription(
    offerSdp['sdp'],
    offerSdp['type'],
  );
  
  // Set as remote description
  await webrtcService.setRemoteOffer(fromPeerId, offer);
  
  // Create answer
  final answer = await webrtcService.createAnswer(fromPeerId);
  
  // Send answer back
  socket.emit('answer', {
    'to': fromPeerId,
    'from': myUserId,
    'answer': {
      'type': answer.type,
      'sdp': answer.sdp,
    },
  });
});
```

---

### **3. Send Answer (Client B → Server → Client A)**

```dart
socket.emit('answer', {
  'to': peerId,
  'from': myUserId,
  'answer': {
    'type': answer.type,  // 'answer'
    'sdp': answer.sdp,
  },
});
```

---

### **4. Receive Answer (Server → Client A)**

```dart
socket.on('answer', (data) {
  String fromPeerId = data['from'];
  Map<String, dynamic> answerSdp = data['answer'];
  
  // Create RTCSessionDescription
  final answer = RTCSessionDescription(
    answerSdp['sdp'],
    answerSdp['type'],
  );
  
  // Set as remote description
  await webrtcService.setRemoteAnswer(fromPeerId, answer);
  
  print('✅ Answer received from: $fromPeerId');
});
```

---

### **5. ICE Candidate (Continuous)**

```dart
// Client A sends candidate to Client B
socket.emit('iceCandidate', {
  'to': peerId,
  'from': myUserId,
  'iceCandidate': {
    'candidate': candidate.candidate,
    'sdpMid': candidate.sdpMid,
    'sdpMlineIndex': candidate.sdpMlineIndex,
  },
});
```

---

### **6. Receive ICE Candidate**

```dart
socket.on('iceCandidate', (data) {
  String fromPeerId = data['from'];
  Map<String, dynamic> candidateData = data['iceCandidate'];
  
  // Create RTCIceCandidate
  final iceCandidate = RTCIceCandidate(
    candidateData['candidate'],
    candidateData['sdpMid'],
    candidateData['sdpMlineIndex'],
  );
  
  // Add to peer connection
  await webrtcService.addIceCandidate(fromPeerId, iceCandidate);
  
  print('🧊 ICE candidate added');
});
```

---

## 👨‍💼 Admin Events

### **1. Disable User Camera (Admin → Server → User)**

```dart
// Admin action
socket.emit('admin:disableCamera', {
  'userId': targetUserId,
  'roomId': roomId,
});
```

**User receives:**
```dart
socket.on('cameraDisabled', (data) {
  print('⚠️ Your camera has been disabled by admin');
  // Disable camera in UI
  mediaProvider.disableVideo();
});
```

---

### **2. Enable User Camera**

```dart
socket.emit('admin:enableCamera', {
  'userId': targetUserId,
  'roomId': roomId,
});

// User receives
socket.on('cameraEnabled', (data) {
  print('✅ Your camera has been enabled');
  mediaProvider.enableVideo();
});
```

---

### **3. Mute User Audio (Admin → Server → User)**

```dart
socket.emit('admin:muteAudio', {
  'userId': targetUserId,
  'roomId': roomId,
});

// User receives
socket.on('audioMuted', (data) {
  print('🔇 Your audio has been muted by admin');
  mediaProvider.disableAudio();
});
```

---

### **4. Unmute User Audio**

```dart
socket.emit('admin:unmuteAudio', {
  'userId': targetUserId,
  'roomId': roomId,
});

// User receives
socket.on('audioUnmuted', (data) {
  print('🔊 Your audio has been unmuted');
  mediaProvider.enableAudio();
});
```

---

### **5. Force Rejoin**

```dart
socket.emit('admin:forceRejoin', {
  'userId': targetUserId,
  'roomId': roomId,
});

// User receives
socket.on('forceRejoin', (data) {
  print('⚠️ Reconnecting to room...');
  // Disconnect and rejoin
  await callProvider.leaveRoom();
  await Future.delayed(Duration(seconds: 1));
  await callProvider.joinRoom(roomId);
});
```

---

### **6. Blank Remote Video**

```dart
socket.emit('admin:blankRemoteVideo', {
  'userId': targetUserId,
  'roomId': roomId,
});

// Others receive
socket.on('blankRemoteVideo', (data) {
  String userId = data['userId'];
  print('📹 Remote video blanked for: $userId');
  // Update UI to show blank video
});
```

---

## 📊 Statistics Events

### **1. Send Call Statistics**

```dart
socket.emit('callStats', {
  'peerId': peerId,
  'stats': {
    'fps': 30,
    'bitrate': 1500,  // kbps
    'latency': 45,    // ms
    'packetsLost': 0,
    'timestamp': DateTime.now().millisecondsSinceEpoch,
  },
});
```

---

### **2. Receive Remote Statistics**

```dart
socket.on('callStats', (data) {
  String fromPeerId = data['from'];
  Map<String, dynamic> stats = data['stats'];
  
  print('📊 Stats from $fromPeerId:');
  print('   FPS: ${stats['fps']}');
  print('   Bitrate: ${stats['bitrate']} kbps');
  print('   Latency: ${stats['latency']} ms');
});
```

---

## 💬 Custom Events (Optional)

### **1. Text Chat**

```dart
// Send message
socket.emit('chatMessage', {
  'roomId': roomId,
  'userId': myUserId,
  'userName': myName,
  'message': 'Hello everyone!',
  'timestamp': DateTime.now().millisecondsSinceEpoch,
});

// Receive message
socket.on('chatMessage', (data) {
  String userName = data['userName'];
  String message = data['message'];
  
  print('💬 $userName: $message');
});
```

---

### **2. Hand Raise (Attention)**

```dart
// Raise hand
socket.emit('raiseHand', {
  'roomId': roomId,
  'userId': myUserId,
  'userName': myName,
});

// Others receive
socket.on('handRaised', (data) {
  String userName = data['userName'];
  print('✋ $userName raised hand');
});

// Lower hand
socket.emit('lowerHand', {
  'roomId': roomId,
  'userId': myUserId,
});
```

---

### **3. Screen Share Start/Stop**

```dart
// Start screen share
socket.emit('screenShareStart', {
  'roomId': roomId,
  'userId': myUserId,
  'userName': myName,
});

// Others receive
socket.on('screenShareStarted', (data) {
  String userName = data['userName'];
  print('🖥️ $userName started screen sharing');
});

// Stop screen share
socket.emit('screenShareStop', {
  'roomId': roomId,
  'userId': myUserId,
});

// Others receive
socket.on('screenShareStopped', (data) {
  String userName = data['userName'];
  print('🖥️ $userName stopped screen sharing');
});
```

---

## 🔄 Complete Event Flow Diagram

```
┌─ USER A ──────────┐      Socket.IO      ┌─ USER B ──────────┐
│                    │      Server         │                    │
│  1. Join Room      │ ──────────────────► │                    │
│                    │                     │                    │
│                    │ ◄──── User Joined ──│                    │
│                    │                     │                    │
│  2. Get Peers      │ ◄── Existing Peers ─│                    │
│                    │                     │                    │
│  3. Create Offer   │                     │                    │
│  4. Send Offer     │ ──────────────────► │                    │
│                    │                     │  5. Receive Offer  │
│                    │                     │  6. Set Remote SDP │
│                    │                     │  7. Create Answer  │
│                    │ ◄── Send Answer ────│                    │
│  8. Receive Answer │                     │                    │
│  9. Set Remote SDP │                     │                    │
│                    │                     │                    │
│  10. ICE Exchange (continuous)           │                    │
│  11. Media Stream Connected              │                    │
│                    │ ◄──────────────────►│                    │
│                    │    (Video + Audio)   │                    │
│                    │                     │                    │
│  12. Send Stats    │ ──────────────────► │ 13. Receive Stats  │
│                    │                     │                    │
└────────────────────┘                     └────────────────────┘
```

---

## 🧪 Event Testing

```dart
// Mock test events
test('Offer received creates answer', () async {
  final mockSocket = MockSocket();
  
  // Simulate receiving offer
  mockSocket.emit('offer', {
    'from': 'peer123',
    'offer': {'type': 'offer', 'sdp': 'test_sdp'},
  });
  
  // Verify answer was sent
  verify(mockSocket.emit('answer', any)).called(1);
});
```

---

**Last Updated**: March 17, 2025
**Status**: Complete Event Reference
**Events Covered**: 25+ socket events

