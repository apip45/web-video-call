# 🔌 Socket.IO Integration - Real-time Signaling Setup

## Setup Socket.IO Client untuk WebRTC Signaling

Panduan lengkap untuk mengintegrasikan Socket.IO client dan handle real-time signaling events.

---

## 📦 Dependencies

```yaml
dependencies:
  socket_io_client: ^2.0.0
```

Install:
```bash
flutter pub add socket_io_client
```

---

## 🏗️ Socket Service Setup

File: `lib/shared/services/socket_service.dart`

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter/material.dart';

class SocketService {
  late IO.Socket _socket;
  
  bool _isConnected = false;
  bool get isConnected => _isConnected;
  
  String? _roomId;
  String? get roomId => _roomId;
  
  String? _userId;
  String? get userId => _userId;
  
  // Connection state listeners
  final ValueNotifier<bool> connectionState = ValueNotifier(false);
  
  SocketService();
  
  // ============ CONNECTION ============
  
  Future<void> connect({
    required String socketUrl,
    required String token,
    required String userId,
  }) async {
    try {
      _userId = userId;
      
      _socket = IO.io(
        socketUrl,
        IO.OptionBuilder()
          .setTransports(['websocket']) // Use WebSocket instead of polling
          .disableAutoConnect()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .setReconnectionAttempts(99999) // Retry forever
          .setAuth({'token': token}) // Send token in handshake
          .build(),
      );
      
      // Setup event handlers
      _setupEventHandlers();
      
      // Connect
      _socket.connect();
      
      // Wait for connection
      await Future.delayed(Duration(milliseconds: 500));
    } catch (e) {
      print('❌ Socket connection error: $e');
      rethrow;
    }
  }
  
  void _setupEventHandlers() {
    // Connection events
    _socket.on('connect', (_) {
      print('✅ Socket connected: ${_socket.id}');
      _isConnected = true;
      connectionState.value = true;
    });
    
    _socket.on('disconnect', (_) {
      print('❌ Socket disconnected');
      _isConnected = false;
      connectionState.value = false;
    });
    
    _socket.on('connect_error', (error) {
      print('❌ Socket connection error: $error');
      _isConnected = false;
      connectionState.value = false;
    });
    
    _socket.on('error', (error) {
      print('❌ Socket error: $error');
    });
  }
  
  Future<void> disconnect() async {
    if (_socket.connected) {
      _socket.disconnect();
      _isConnected = false;
      connectionState.value = false;
    }
  }
  
  // ============ ROOM EVENTS ============
  
  void joinRoom({
    required String roomId,
    required String userName,
    required String userEmail,
  }) {
    _roomId = roomId;
    
    emit('joinRoom', {
      'roomId': roomId,
      'userId': _userId,
      'userName': userName,
      'userEmail': userEmail,
    });
  }
  
  void leaveRoom() {
    if (_roomId != null) {
      emit('leaveRoom', {
        'roomId': _roomId,
        'userId': _userId,
      });
      _roomId = null;
    }
  }
  
  // Listen for user joined
  void onUserJoined(Function(String userId, Map<String, dynamic> data) callback) {
    _socket.on('userJoined', (data) {
      callback(data['userId'] as String, data as Map<String, dynamic>);
    });
  }
  
  // Listen for user left
  void onUserLeft(Function(String userId) callback) {
    _socket.on('userLeft', (data) {
      callback(data['userId'] as String);
    });
  }
  
  // Listen for existing peers (when joining)
  void onExistingPeers(Function(List<String> peerIds) callback) {
    _socket.on('existingPeers', (data) {
      final peerIds = List<String>.from(data['peers'] as List);
      callback(peerIds);
    });
  }
  
  // ============ WEBRTC SIGNALING ============
  
  // Send offer
  void sendOffer({
    required String peerId,
    required Map<String, dynamic> offer,
  }) {
    emit('offer', {
      'to': peerId,
      'offer': offer,
    });
  }
  
  // Listen for offer
  void onOffer(Function(String fromPeerId, Map<String, dynamic> offer) callback) {
    _socket.on('offer', (data) {
      final fromPeerId = data['from'] as String;
      final offer = data['offer'] as Map<String, dynamic>;
      callback(fromPeerId, offer);
    });
  }
  
  // Send answer
  void sendAnswer({
    required String peerId,
    required Map<String, dynamic> answer,
  }) {
    emit('answer', {
      'to': peerId,
      'answer': answer,
    });
  }
  
  // Listen for answer
  void onAnswer(Function(String fromPeerId, Map<String, dynamic> answer) callback) {
    _socket.on('answer', (data) {
      final fromPeerId = data['from'] as String;
      final answer = data['answer'] as Map<String, dynamic>;
      callback(fromPeerId, answer);
    });
  }
  
  // Send ICE candidate
  void sendIceCandidate({
    required String peerId,
    required Map<String, dynamic> iceCandidate,
  }) {
    emit('iceCandidate', {
      'to': peerId,
      'iceCandidate': iceCandidate,
    });
  }
  
  // Listen for ICE candidate
  void onIceCandidate(Function(String fromPeerId, Map<String, dynamic> iceCandidate) callback) {
    _socket.on('iceCandidate', (data) {
      final fromPeerId = data['from'] as String;
      final iceCandidate = data['iceCandidate'] as Map<String, dynamic>;
      callback(fromPeerId, iceCandidate);
    });
  }
  
  // ============ ADMIN EVENTS ============
  
  // Listen for camera disabled by admin
  void onCameraDisabled(Function() callback) {
    _socket.on('cameraDisabled', (_) {
      callback();
    });
  }
  
  // Listen for camera enabled by admin
  void onCameraEnabled(Function() callback) {
    _socket.on('cameraEnabled', (_) {
      callback();
    });
  }
  
  // Listen for audio muted by admin
  void onAudioMuted(Function() callback) {
    _socket.on('audioMuted', (_) {
      callback();
    });
  }
  
  // Listen for audio unmuted by admin
  void onAudioUnmuted(Function() callback) {
    _socket.on('audioUnmuted', (_) {
      callback();
    });
  }
  
  // Listen for force rejoin
  void onForceRejoin(Function() callback) {
    _socket.on('forceRejoin', (_) {
      callback();
    });
  }
  
  // Listen for blank remote video
  void onBlankRemoteVideo(Function(String userId) callback) {
    _socket.on('blankRemoteVideo', (data) {
      callback(data['userId'] as String);
    });
  }
  
  // ============ STATISTICS ============
  
  // Send call statistics
  void sendCallStats({
    required String peerId,
    required Map<String, dynamic> stats,
  }) {
    emit('callStats', {
      'peerId': peerId,
      'stats': stats,
    });
  }
  
  // Listen for remote call statistics
  void onCallStats(Function(String fromPeerId, Map<String, dynamic> stats) callback) {
    _socket.on('callStats', (data) {
      final fromPeerId = data['from'] as String;
      final stats = data['stats'] as Map<String, dynamic>;
      callback(fromPeerId, stats);
    });
  }
  
  // ============ GENERIC EMIT/LISTEN ============
  
  void emit(String event, dynamic data) {
    if (_socket.connected) {
      _socket.emit(event, data);
      print('📤 Emitted event: $event');
    } else {
      print('⚠️ Socket not connected, cannot emit: $event');
    }
  }
  
  void on(String event, Function(dynamic) callback) {
    _socket.on(event, (data) {
      print('📥 Received event: $event');
      callback(data);
    });
  }
  
  void off(String event) {
    _socket.off(event);
  }
  
  void offAll() {
    _socket.clearListeners();
  }
  
  // ============ DEBUG ============
  
  void printSocketInfo() {
    print('''
    === Socket Info ===
    Connected: $_isConnected
    Socket ID: ${_socket.id}
    Room ID: $_roomId
    User ID: $_userId
    ''');
  }
}
```

---

## 🔌 Socket Repository

File: `lib/features/room/data/repositories/socket_repository.dart`

```dart
abstract class SocketRepository {
  Future<void> connect(String token, String userId);
  void disconnect();
  
  bool get isConnected;
  
  void joinRoom(String roomId, String userName, String userEmail);
  void leaveRoom();
  
  // WebRTC signaling
  void sendOffer(String peerId, Map<String, dynamic> offer);
  void onOffer(Function(String peerId, Map<String, dynamic> offer) callback);
  
  void sendAnswer(String peerId, Map<String, dynamic> answer);
  void onAnswer(Function(String peerId, Map<String, dynamic> answer) callback);
  
  void sendIceCandidate(String peerId, Map<String, dynamic> iceCandidate);
  void onIceCandidate(Function(String peerId, Map<String, dynamic> iceCandidate) callback);
  
  // Event listeners
  void onUserJoined(Function(String userId, Map<String, dynamic> data) callback);
  void onUserLeft(Function(String userId) callback);
  void onExistingPeers(Function(List<String> peerIds) callback);
  
  // Admin events
  void onCameraDisabled(Function() callback);
  void onCameraEnabled(Function() callback);
  void onAudioMuted(Function() callback);
  void onAudioUnmuted(Function() callback);
  void onForceRejoin(Function() callback);
}

class SocketRepositoryImpl implements SocketRepository {
  final SocketService socketService;
  
  SocketRepositoryImpl(this.socketService);
  
  @override
  Future<void> connect(String token, String userId) async {
    await socketService.connect(
      socketUrl: 'http://10.0.2.2:3000', // Change for physical device
      token: token,
      userId: userId,
    );
  }
  
  @override
  void disconnect() {
    socketService.disconnect();
  }
  
  @override
  bool get isConnected => socketService.isConnected;
  
  @override
  void joinRoom(String roomId, String userName, String userEmail) {
    socketService.joinRoom(
      roomId: roomId,
      userName: userName,
      userEmail: userEmail,
    );
  }
  
  @override
  void leaveRoom() {
    socketService.leaveRoom();
  }
  
  @override
  void sendOffer(String peerId, Map<String, dynamic> offer) {
    socketService.sendOffer(peerId: peerId, offer: offer);
  }
  
  @override
  void onOffer(Function(String peerId, Map<String, dynamic> offer) callback) {
    socketService.onOffer(callback);
  }
  
  @override
  void sendAnswer(String peerId, Map<String, dynamic> answer) {
    socketService.sendAnswer(peerId: peerId, answer: answer);
  }
  
  @override
  void onAnswer(Function(String peerId, Map<String, dynamic> answer) callback) {
    socketService.onAnswer(callback);
  }
  
  @override
  void sendIceCandidate(String peerId, Map<String, dynamic> iceCandidate) {
    socketService.sendIceCandidate(
      peerId: peerId,
      iceCandidate: iceCandidate,
    );
  }
  
  @override
  void onIceCandidate(Function(String peerId, Map<String, dynamic> iceCandidate) callback) {
    socketService.onIceCandidate(callback);
  }
  
  @override
  void onUserJoined(Function(String userId, Map<String, dynamic> data) callback) {
    socketService.onUserJoined(callback);
  }
  
  @override
  void onUserLeft(Function(String userId) callback) {
    socketService.onUserLeft(callback);
  }
  
  @override
  void onExistingPeers(Function(List<String> peerIds) callback) {
    socketService.onExistingPeers(callback);
  }
  
  @override
  void onCameraDisabled(Function() callback) {
    socketService.onCameraDisabled(callback);
  }
  
  @override
  void onCameraEnabled(Function() callback) {
    socketService.onCameraEnabled(callback);
  }
  
  @override
  void onAudioMuted(Function() callback) {
    socketService.onAudioMuted(callback);
  }
  
  @override
  void onAudioUnmuted(Function() callback) {
    socketService.onAudioUnmuted(callback);
  }
  
  @override
  void onForceRejoin(Function() callback) {
    socketService.onForceRejoin(callback);
  }
}
```

---

## 🎯 Usage in Provider

File: `lib/features/room/presentation/providers/socket_provider.dart`

```dart
import 'package:flutter/material.dart';

class SocketProvider extends ChangeNotifier {
  final SocketRepository _socketRepository;
  
  bool _isConnected = false;
  String? _connectedRoomId;
  List<String> _activePeers = [];
  String? _error;
  
  bool get isConnected => _isConnected;
  String? get connectedRoomId => _connectedRoomId;
  List<String> get activePeers => _activePeers;
  String? get error => _error;
  
  // Stream controllers for events
  final _userJoinedController = StreamController<String>.broadcast();
  final _userLeftController = StreamController<String>.broadcast();
  final _offerController = StreamController<Map<String, dynamic>>.broadcast();
  final _answerController = StreamController<Map<String, dynamic>>.broadcast();
  final _iceCandidateController = StreamController<Map<String, dynamic>>.broadcast();
  
  Stream<String> get userJoinedStream => _userJoinedController.stream;
  Stream<String> get userLeftStream => _userLeftController.stream;
  Stream<Map<String, dynamic>> get offerStream => _offerController.stream;
  Stream<Map<String, dynamic>> get answerStream => _answerController.stream;
  Stream<Map<String, dynamic>> get iceCandidateStream => _iceCandidateController.stream;
  
  SocketProvider(this._socketRepository) {
    _setupListeners();
  }
  
  void _setupListeners() {
    // Connection state
    _socketRepository.connectionState.addListener(() {
      _isConnected = _socketRepository.connectionState.value;
      notifyListeners();
    });
    
    // User events
    _socketRepository.onUserJoined((userId, data) {
      _activePeers.add(userId);
      _userJoinedController.add(userId);
      notifyListeners();
    });
    
    _socketRepository.onUserLeft((userId) {
      _activePeers.remove(userId);
      _userLeftController.add(userId);
      notifyListeners();
    });
    
    // WebRTC signaling
    _socketRepository.onOffer((peerId, offer) {
      offer['from'] = peerId;
      _offerController.add(offer);
    });
    
    _socketRepository.onAnswer((peerId, answer) {
      answer['from'] = peerId;
      _answerController.add(answer);
    });
    
    _socketRepository.onIceCandidate((peerId, iceCandidate) {
      iceCandidate['from'] = peerId;
      _iceCandidateController.add(iceCandidate);
    });
    
    // Existing peers on join
    _socketRepository.onExistingPeers((peerIds) {
      _activePeers = peerIds;
      notifyListeners();
    });
  }
  
  Future<void> connect(String token, String userId) async {
    try {
      await _socketRepository.connect(token, userId);
      _error = null;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
  
  void disconnect() {
    _socketRepository.disconnect();
    _connectedRoomId = null;
    _activePeers.clear();
    notifyListeners();
  }
  
  void joinRoom(String roomId, String userName, String userEmail) {
    _connectedRoomId = roomId;
    _socketRepository.joinRoom(roomId, userName, userEmail);
    notifyListeners();
  }
  
  void leaveRoom() {
    _socketRepository.leaveRoom();
    _connectedRoomId = null;
    _activePeers.clear();
    notifyListeners();
  }
  
  void sendOffer(String peerId, Map<String, dynamic> offer) {
    _socketRepository.sendOffer(peerId, offer);
  }
  
  void sendAnswer(String peerId, Map<String, dynamic> answer) {
    _socketRepository.sendAnswer(peerId, answer);
  }
  
  void sendIceCandidate(String peerId, Map<String, dynamic> iceCandidate) {
    _socketRepository.sendIceCandidate(peerId, iceCandidate);
  }
  
  @override
  void dispose() {
    _userJoinedController.close();
    _userLeftController.close();
    _offerController.close();
    _answerController.close();
    _iceCandidateController.close();
    super.dispose();
  }
}
```

---

## 🎯 Usage in Widget

```dart
class RoomPage extends StatefulWidget {
  final String roomId;
  
  @override
  State<RoomPage> createState() => _RoomPageState();
}

class _RoomPageState extends State<RoomPage> {
  late SocketProvider socketProvider;
  
  @override
  void initState() {
    super.initState();
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      socketProvider = Provider.of<SocketProvider>(context, listen: false);
      socketProvider.joinRoom(widget.roomId, 'John', 'john@example.com');
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Consumer<SocketProvider>(
      builder: (context, socketProvider, _) {
        if (!socketProvider.isConnected) {
          return Center(child: Text('Disconnected'));
        }
        
        return Column(
          children: [
            Text('Active peers: ${socketProvider.activePeers.length}'),
            // Watch for new users
            StreamBuilder<String>(
              stream: socketProvider.userJoinedStream,
              builder: (context, snapshot) {
                if (snapshot.hasData) {
                  return Text('${snapshot.data} joined');
                }
                return SizedBox.shrink();
              },
            ),
          ],
        );
      },
    );
  }
  
  @override
  void dispose() {
    socketProvider.leaveRoom();
    super.dispose();
  }
}
```

---

## 🧪 Testing Socket Service

```dart
test('Connect emits correct events', () async {
  final mockSocket = MockSocket();
  final socketService = SocketService();
  
  // Setup
  socketService.connect(
    socketUrl: 'http://localhost:3000',
    token: 'test_token',
    userId: 'user123',
  );
  
  // Verify connection attempted
  verify(() => mockSocket.connect()).called(1);
});

test('emitting offer sends correct data', () {
  // Arrange
  final socketService = SocketService();
  final offer = {'type': 'offer', 'sdp': 'test'};
  
  // Act
  socketService.sendOffer(peerId: 'peer1', offer: offer);
  
  // Assert
  verify(() => mockSocket.emit('offer', any())).called(1);
});
```

---

## ⚠️ Error Handling

```dart
// Connection errors are automatically handled
_socket.on('connect_error', (error) {
  print('Connection error: $error');
  // UI will show error through provider state
});

// Event errors
void _safeEmit(String event, dynamic data) {
  try {
    emit(event, data);
  } catch (e) {
    print('Error emitting $event: $e');
    // Log to analytics or error tracking
  }
}
```

---

## 🚀 Complete Checklist

- [ ] Add socket_io_client dependency
- [ ] Create SocketService with connection logic
- [ ] Setup event handlers for all events
- [ ] Create SocketRepository abstraction
- [ ] Create SocketRepositoryImpl
- [ ] Create SocketProvider
- [ ] Test connection
- [ ] Test event emission/listening
- [ ] Setup error handling
- [ ] Test with real backend

---

**Last Updated**: March 17, 2025
**Status**: Complete
**References**: Website Socket Events in `../../05-SOCKET_EVENTS.md`

