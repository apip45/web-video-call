# ✨ Features Implementation - Complete Feature Guide

## Step-by-Step Feature Implementation Guide

Panduan lengkap untuk mengimplementasikan semua fitur aplikasi.

---

## 📋 Feature Checklist

### **Phase 1: Core Features (Weeks 1-4)**
- [ ] User Authentication (Register/Login)
- [ ] Room Management (Create/Join/Leave)
- [ ] 1-vs-1 Video Call Setup
- [ ] Media Controls (Camera/Mic toggle)
- [ ] Basic UI Screens

### **Phase 2: Advanced Features (Weeks 4-6)**
- [ ] Admin Controls
- [ ] Call Statistics
- [ ] Screen Sharing
- [ ] Enhanced UI/UX

### **Phase 3: Polish (Weeks 6-8)**
- [ ] Performance Optimization
- [ ] Error Handling
- [ ] Testing
- [ ] Deployment

---

## 🔐 Feature 1: Authentication

### **Implementation Steps**

1. **Setup API Integration** (see `04-REST_API_INTEGRATION.md`)
   - Create ApiClient with Dio
   - Setup login/register endpoints
   - Save JWT tokens securely

2. **Create Auth Repository**
   ```dart
   class AuthRepositoryImpl implements AuthRepository {
     Future<UserEntity> login(String email, String password) async {
       // Call API
       // Save token
       // Return user entity
     }
   }
   ```

3. **Create Auth Provider**
   ```dart
   class AuthProvider extends ChangeNotifier {
     Future<void> login(String email, String password) async {
       // Call repository
       // Update UI state
     }
   }
   ```

4. **Create Login Page**
   - Email input field
   - Password input field
   - Login button
   - Register link
   - Error handling

5. **Test Authentication**
   - Test login with correct credentials
   - Test login with wrong credentials
   - Test token persistence
   - Test auto-login on app restart

---

## 🏠 Feature 2: Room Management

### **Create Room**

```dart
// Use case
class CreateRoomUseCase {
  final RoomRepository repository;
  
  Future<RoomEntity> call(String roomName) async {
    return await repository.createRoom(roomName);
  }
}

// In UI
final roomProvider = Provider.of<RoomProvider>(context, listen: false);
roomProvider.createRoom('My Meeting');
```

### **Join Room**

```dart
// Steps:
// 1. Get list of available rooms
// 2. User clicks "Join"
// 3. Navigate to room page with roomId
// 4. Initialize WebRTC + Socket.IO
// 5. Connect to signaling server
// 6. Get list of existing peers
// 7. Create peer connections for each peer

class JoinRoomUseCase {
  Future<void> call(String roomId) async {
    // 1. Notify server
    socketRepository.joinRoom(roomId);
    
    // 2. Get existing peers
    await _waitForExistingPeers();
    
    // 3. Create peer connections
    for (final peerId in existingPeers) {
      await webrtcRepository.createPeerConnection(peerId);
    }
  }
}
```

### **Leave Room**

```dart
class LeaveRoomUseCase {
  Future<void> call(String roomId) async {
    // 1. Close all peer connections
    await webrtcRepository.closeAll();
    
    // 2. Leave room via socket
    socketRepository.leaveRoom();
    
    // 3. Cleanup media
    await mediaRepository.cleanup();
  }
}
```

---

## 📹 Feature 3: 1-vs-1 Video Call

### **Call Initiation Flow**

```
User A (Caller)          Signaling Server          User B (Receiver)
    │                            │                        │
    ├─ Join Room ──────────────► │                       │
    │                            ├─ Notify B joined ────►│
    │                            │                       │
    │                       ◄────┴─ B's Peer ID ────────┤
    │                            │                       │
    ├─ Create offer ─────────────────────────────────────┼─►
    │   (for B)                  │                       │
    │                            │                       │
    │                       ◄────┴─ Offer ──────────────┤
    │                            │                       │
    ├─ Set remote offer          │                       │
    │  & create answer ──────────────────────────────────┼─►
    │                            │                       │
    │                       ◄────┴─ Answer ─────────────┤
    │                            │                       │
    ├─ Set remote answer         │                       │
    │                            │                       │
    ├─ Exchange ICE candidates ──────────────────────────►─
    │  (connection established)  │                       ◄──
    │                            │                       │
    │◄───────── Media Stream ──────────────────────────────►
    │                            │                       │
```

### **Implementation Code**

```dart
class CallProvider extends ChangeNotifier {
  final SocketRepository socketRepository;
  final WebRTCRepository webrtcRepository;
  
  Map<String, RTCPeerConnection> _peerConnections = {};
  
  void _setupSocketListeners() {
    // Listen for user joined
    socketRepository.onUserJoined((userId, data) {
      _createPeerConnection(userId);
    });
    
    // Listen for offer from peer
    socketRepository.onOffer((fromPeerId, offer) {
      _handleOffer(fromPeerId, offer);
    });
    
    // Listen for answer from peer
    socketRepository.onAnswer((fromPeerId, answer) {
      _handleAnswer(fromPeerId, answer);
    });
    
    // Listen for ICE candidates
    socketRepository.onIceCandidate((fromPeerId, candidate) {
      _handleIceCandidate(fromPeerId, candidate);
    });
  }
  
  Future<void> _createPeerConnection(String peerId) async {
    try {
      // Create PC
      final pc = await webrtcRepository.createPeerConnection(peerId);
      _peerConnections[peerId] = pc;
      
      // Create and send offer
      final offer = await webrtcRepository.createOffer(peerId);
      socketRepository.sendOffer(peerId, offer.toJson());
      
      notifyListeners();
    } catch (e) {
      print('❌ Error creating peer connection: $e');
    }
  }
  
  Future<void> _handleOffer(String peerId, Map<String, dynamic> offerJson) async {
    try {
      // Create PC if not exists
      if (!_peerConnections.containsKey(peerId)) {
        final pc = await webrtcRepository.createPeerConnection(peerId);
        _peerConnections[peerId] = pc;
      }
      
      // Set remote offer
      await webrtcRepository.setRemoteOffer(peerId, offerJson);
      
      // Create answer
      final answer = await webrtcRepository.createAnswer(peerId);
      socketRepository.sendAnswer(peerId, answer.toJson());
      
      notifyListeners();
    } catch (e) {
      print('❌ Error handling offer: $e');
    }
  }
  
  Future<void> _handleAnswer(String peerId, Map<String, dynamic> answerJson) async {
    try {
      await webrtcRepository.setRemoteAnswer(peerId, answerJson);
      notifyListeners();
    } catch (e) {
      print('❌ Error handling answer: $e');
    }
  }
  
  Future<void> _handleIceCandidate(String peerId, Map<String, dynamic> candidateJson) async {
    try {
      await webrtcRepository.addIceCandidate(peerId, candidateJson);
    } catch (e) {
      print('⚠️ Error adding ICE candidate: $e');
    }
  }
}
```

---

## 🎤 Feature 4: Media Controls

### **Mute/Unmute Audio**

```dart
// In MediaProvider
Future<void> toggleAudio() async {
  _isAudioEnabled = !_isAudioEnabled;
  webrtcRepository.toggleAudio(_isAudioEnabled);
  
  // Notify server (optional)
  if (_isAudioEnabled) {
    socketRepository.emit('audioEnabled', {});
  } else {
    socketRepository.emit('audioDisabled', {});
  }
  
  notifyListeners();
}
```

### **Enable/Disable Video**

```dart
Future<void> toggleVideo() async {
  _isVideoEnabled = !_isVideoEnabled;
  webrtcRepository.toggleVideo(_isVideoEnabled);
  
  // Notify server
  if (_isVideoEnabled) {
    socketRepository.emit('cameraEnabled', {});
  } else {
    socketRepository.emit('cameraDisabled', {});
  }
  
  notifyListeners();
}
```

### **Switch Camera**

```dart
Future<void> switchCamera() async {
  await webrtcRepository.switchCamera();
  _isFrontCamera = !_isFrontCamera;
  notifyListeners();
}
```

---

## 👨‍💼 Feature 5: Admin Controls

### **Admin Panel**

```dart
class AdminPanelPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Admin Controls')),
      body: Consumer<RoomProvider>(
        builder: (context, roomProvider, _) {
          return ListView.builder(
            itemCount: roomProvider.activeUsers.length,
            itemBuilder: (context, index) {
              final user = roomProvider.activeUsers[index];
              return AdminUserCard(
                user: user,
                onDisableCamera: () {
                  roomProvider.disableUserCamera(user.id);
                },
                onMuteAudio: () {
                  roomProvider.muteUserAudio(user.id);
                },
                onForceRejoin: () {
                  roomProvider.forceUserRejoin(user.id);
                },
              );
            },
          );
        },
      ),
    );
  }
}
```

### **Admin Actions**

```dart
class AdminProvider extends ChangeNotifier {
  final AdminRepository repository;
  final SocketRepository socketRepository;
  
  // Disable user's camera
  Future<void> disableUserCamera(String userId, String roomId) async {
    try {
      await repository.disableUserCamera(userId, roomId);
      socketRepository.emit('disableCamera', {
        'userId': userId,
        'roomId': roomId,
      });
      notifyListeners();
    } catch (e) {
      print('❌ Error disabling camera: $e');
    }
  }
  
  // Mute user's audio
  Future<void> muteUserAudio(String userId, String roomId) async {
    try {
      await repository.muteUserAudio(userId, roomId);
      socketRepository.emit('muteAudio', {
        'userId': userId,
        'roomId': roomId,
      });
      notifyListeners();
    } catch (e) {
      print('❌ Error muting audio: $e');
    }
  }
  
  // Force rejoin
  Future<void> forceUserRejoin(String userId, String roomId) async {
    try {
      await repository.forceRejoin(userId, roomId);
      socketRepository.emit('forceRejoin', {
        'userId': userId,
        'roomId': roomId,
      });
      notifyListeners();
    } catch (e) {
      print('❌ Error forcing rejoin: $e');
    }
  }
}
```

---

## 📊 Feature 6: Call Statistics

### **Statistics Collection**

```dart
class StatsProvider extends ChangeNotifier {
  final WebRTCRepository webrtcRepository;
  
  double _fps = 0;
  double _bitrate = 0; // kbps
  int _latency = 0; // ms
  
  double get fps => _fps;
  double get bitrate => _bitrate;
  int get latency => _latency;
  
  Timer? _statsTimer;
  
  void startCollecting(String peerId) {
    _statsTimer = Timer.periodic(Duration(seconds: 1), (_) async {
      try {
        final report = await webrtcRepository.getStats(peerId);
        _parseStats(report);
        notifyListeners();
      } catch (e) {
        print('❌ Error getting stats: $e');
      }
    });
  }
  
  void _parseStats(RTCStatsReport report) {
    for (final stat in report.stats) {
      if (stat.type == 'inboundRtp') {
        // Parse video stats
        final framesDecoded = stat.values['framesDecoded'] ?? 0;
        final timestamp = stat.values['timestamp'] ?? 0;
        
        // Calculate FPS
        // ... calculation logic
      }
      
      if (stat.type == 'candidate-pair') {
        final bitsSent = stat.values['bytesSent'] ?? 0;
        final timestamp = stat.values['timestamp'] ?? 0;
        
        // Calculate bitrate
        // ... calculation logic
        
        // Get latency
        _latency = (stat.values['currentRoundTripTime'] as double? ?? 0).toInt();
      }
    }
  }
  
  void stopCollecting() {
    _statsTimer?.cancel();
  }
  
  @override
  void dispose() {
    stopCollecting();
    super.dispose();
  }
}
```

### **Display Stats in UI**

```dart
class CallStatsWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<StatsProvider>(
      builder: (context, statsProvider, _) {
        return Container(
          padding: EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.black54,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _StatRow('FPS', '${statsProvider.fps.toStringAsFixed(1)}'),
              _StatRow('Bitrate', '${statsProvider.bitrate.toStringAsFixed(0)} kbps'),
              _StatRow('Latency', '${statsProvider.latency} ms'),
            ],
          ),
        );
      },
    );
  }
}

class _StatRow extends StatelessWidget {
  final String label;
  final String value;
  
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: Colors.white70)),
        Text(value, style: TextStyle(color: Colors.white)),
      ],
    );
  }
}
```

---

## 🚀 Feature Implementation Timeline

**Week 1**:
- ✅ Setup, Auth (done in steps 1-2)
- ✅ Room Management (steps 2-3)

**Week 2-3**:
- ✅ WebRTC (step 3)
- ✅ Media Controls (step 4)

**Week 4**:
- ✅ UI Polish
- ⏳ Basic call working

**Week 5**:
- ⏳ Admin controls
- ⏳ Statistics

**Week 6-7**:
- ⏳ Testing
- ⏳ Optimization

**Week 8+**:
- ⏳ Deployment

---

## ✅ Feature Acceptance Criteria

### **Authentication**
- [ ] User can register
- [ ] User can login
- [ ] Token persists
- [ ] Auto-login on restart
- [ ] Logout clears data

### **Video Call**
- [ ] Can join room
- [ ] Remote video displays
- [ ] Audio works
- [ ] Can switch cameras
- [ ] Reconnection works

### **Admin Controls**
- [ ] Can disable remote camera
- [ ] Can mute remote audio
- [ ] Can force rejoin
- [ ] Changes reflect immediately

### **Statistics**
- [ ] FPS displayed
- [ ] Bitrate tracked
- [ ] Latency measured
- [ ] Updates in real-time

---

**Last Updated**: March 17, 2025
**Status**: Complete Feature Guide
**Estimated Duration**: 8 weeks for full implementation

