# 📺 Screen Sharing Implementation

## Implementasi Fitur Screen Share untuk Flutter App

---

## 🎯 Persiapan Platform

### **Android Setup**

#### 1. AndroidManifest.xml
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <!-- Permissions untuk screen capture -->
  <uses-permission android:name="android.permission.CAPTURE_VIDEO_OUTPUT" />
  
  <!-- Dialog untuk meminta permission screen share -->
  <activity
    android:name=".ScreenCaptureRequest"
    android:theme="@android:style/Theme.Translucent.NoTitleBar"
    android:exported="true" />
</manifest>
```

#### 2. Build gradle
```gradle
dependencies {
    // Screen capture library
    implementation 'com.github.webrtc-flutter:webrtc:0.9.43'
}
```

---

### **iOS Setup**

#### 1. Info.plist
```xml
<key>NSCameraUsageDescription</key>
<string>Need camera for screen sharing</string>
<key>RTCScreenCapture</key>
<true/>
```

#### 2. Podfile
```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    flutter_additional_ios_build_settings(target)
    
    # Enable ReplayKit untuk screen capture
    target.build_configurations.each do |config|
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= [
        '$(inherited)',
        'WEBRTC_MAC=1',
      ]
    end
  end
end
```

---

## 🖥️ Screen Sharing Service

### **Model Data**

```dart
// ScreenShareState enum
enum ScreenShareState {
  idle,
  requesting,
  capturing,
  stopped,
  error,
}

// ScreenShareInfo class
class ScreenShareInfo {
  final String userId;
  final String userName;
  final DateTime startTime;
  final RTCVideoTrack? videoTrack;
  
  ScreenShareInfo({
    required this.userId,
    required this.userName,
    required this.startTime,
    this.videoTrack,
  });
}
```

---

### **Screen Share Service**

```dart
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'dart:async';

class ScreenShareService {
  // Variables
  MediaStream? _screenStream;
  RTCVideoTrack? _screenTrack;
  StreamController<ScreenShareState> stateController = 
    StreamController<ScreenShareState>.broadcast();
  
  Stream<ScreenShareState> get screenShareState => stateController.stream;
  
  // Get screen stream (start screen capture)
  Future<MediaStream?> getDisplayMedia() async {
    try {
      stateController.add(ScreenShareState.requesting);
      
      // Request screen capture permission
      final constraints = <String, dynamic>{
        'audio': false,
        'video': {
          'mandatory': {
            'chromeMediaSource': 'screen',
          }
        }
      };
      
      _screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      // Get video track
      if (_screenStream!.getVideoTracks().isNotEmpty) {
        _screenTrack = _screenStream!.getVideoTracks()[0] as RTCVideoTrack;
      }
      
      stateController.add(ScreenShareState.capturing);
      print('✅ Screen capture started');
      
      return _screenStream;
    } catch (e) {
      print('❌ Screen capture error: $e');
      stateController.add(ScreenShareState.error);
      return null;
    }
  }
  
  // Stop screen sharing
  Future<void> stopScreenShare() async {
    try {
      if (_screenStream != null) {
        // Stop all tracks
        for (var track in _screenStream!.getTracks()) {
          await track.stop();
        }
        await _screenStream!.dispose();
      }
      
      _screenStream = null;
      _screenTrack = null;
      stateController.add(ScreenShareState.stopped);
      
      print('✅ Screen sharing stopped');
    } catch (e) {
      print('❌ Error stopping screen share: $e');
      stateController.add(ScreenShareState.error);
    }
  }
  
  // Get screen track
  RTCVideoTrack? get screenTrack => _screenTrack;
  
  // Check if screen is being shared
  bool get isScreenSharing => _screenStream != null;
  
  // Dispose resources
  void dispose() {
    stateController.close();
  }
}
```

---

## 🔗 WebRTC Screen Share Integration

### **Add Screen Track to Peer Connection**

```dart
class WebRTCService {
  // ... existing code ...
  
  ScreenShareService screenShareService = ScreenShareService();
  
  // Start screen share for specific peer
  Future<void> startScreenShareWithPeer(String peerId) async {
    try {
      // Get screen media
      final screenStream = await screenShareService.getDisplayMedia();
      
      if (screenStream == null) {
        throw Exception('Failed to get screen stream');
      }
      
      // Get or create peer connection
      final peerConnection = peerConnections[peerId];
      if (peerConnection == null) {
        throw Exception('Peer connection not found');
      }
      
      // Get screen video track
      final screenTrack = screenShareService.screenTrack;
      if (screenTrack == null) {
        throw Exception('Screen track not available');
      }
      
      // Add screen track to peer connection
      final transceiver = await peerConnection.addTrack(
        screenTrack,
        ['screen-share'],
      );
      
      print('✅ Screen track added to peer: $peerId');
      
      // Listen for track end events
      screenTrack.onEnded = () {
        print('📺 Screen share ended');
        endScreenShareWithPeer(peerId);
      };
    } catch (e) {
      print('❌ Error starting screen share: $e');
    }
  }
  
  // Stop screen share for specific peer
  Future<void> endScreenShareWithPeer(String peerId) async {
    try {
      final peerConnection = peerConnections[peerId];
      if (peerConnection == null) return;
      
      // Get all senders
      final senders = await peerConnection.getSenders();
      
      // Find and remove screen track
      for (var sender in senders) {
        if (sender.track?.kind == 'video') {
          if (sender.parameters.encodings.any((e) => e.rid == 'screen-share')) {
            await peerConnection.removeTrack(sender);
            print('✅ Screen track removed from peer: $peerId');
          }
        }
      }
      
      // Stop screen share service
      await screenShareService.stopScreenShare();
    } catch (e) {
      print('❌ Error ending screen share: $e');
    }
  }
  
  // Switch between camera and screen
  Future<void> switchToScreen(String peerId) async {
    try {
      // Stop camera
      await stopCameraForPeer(peerId);
      
      // Start screen
      await startScreenShareWithPeer(peerId);
    } catch (e) {
      print('❌ Error switching to screen: $e');
    }
  }
  
  // Switch from screen to camera
  Future<void> switchToCamera(String peerId) async {
    try {
      // Stop screen share
      await endScreenShareWithPeer(peerId);
      
      // Start camera
      await startCameraForPeer(peerId);
    } catch (e) {
      print('❌ Error switching to camera: $e');
    }
  }
}
```

---

## 📡 Socket.IO Events untuk Screen Share

### **Server Side (Node.js)**

```javascript
// app/socket/socketHandler.js
socket.on('screenShareStart', (data) => {
  const { roomId, userId, userName } = data;
  
  // Notify other users in room
  io.to(roomId).emit('screenShareStarted', {
    userId,
    userName,
    startTime: new Date(),
  });
  
  // Add to room stats
  const room = rooms.get(roomId);
  if (room) {
    room.screenShareActive = true;
    room.screenShareUser = userId;
  }
});

socket.on('screenShareStop', (data) => {
  const { roomId, userId } = data;
  
  // Notify other users
  io.to(roomId).emit('screenShareStopped', {
    userId,
    stopTime: new Date(),
  });
  
  const room = rooms.get(roomId);
  if (room) {
    room.screenShareActive = false;
    room.screenShareUser = null;
  }
});

socket.on('screenShareTrackChange', (data) => {
  const { roomId, userId } = data;
  
  // Notify specific peer to renegotiate SDP
  socket.to(roomId).emit('peerScreenShareActivity', {
    userId,
    action: 'trackchange',
  });
});
```

---

## 🎨 UI Components

### **Screen Share Provider**

```dart
class ScreenShareProvider extends ChangeNotifier {
  final WebRTCService webrtcService;
  final SocketService socketService;
  
  ScreenShareState _state = ScreenShareState.idle;
  ScreenShareInfo? _currentScreenShare;
  
  ScreenShareProvider({
    required this.webrtcService,
    required this.socketService,
  }) {
    _init();
  }
  
  void _init() {
    webrtcService.screenShareService.screenShareState.listen((state) {
      _state = state;
      notifyListeners();
    });
  }
  
  ScreenShareState get state => _state;
  ScreenShareInfo? get currentScreenShare => _currentScreenShare;
  bool get isScreenSharing => _state == ScreenShareState.capturing;
  
  // Start screen share
  Future<void> startScreenShare(String peerId) async {
    try {
      await webrtcService.startScreenShareWithPeer(peerId);
      
      _currentScreenShare = ScreenShareInfo(
        userId: 'my_id', // From auth provider
        userName: 'My Name',
        startTime: DateTime.now(),
        videoTrack: webrtcService.screenShareService.screenTrack,
      );
      
      // Notify peers via socket
      socketService.emit('screenShareStart', {
        'userId': 'my_id',
        'userName': 'My Name',
      });
      
      notifyListeners();
    } catch (e) {
      _state = ScreenShareState.error;
      notifyListeners();
    }
  }
  
  // Stop screen share
  Future<void> stopScreenShare(String peerId) async {
    try {
      await webrtcService.endScreenShareWithPeer(peerId);
      
      _currentScreenShare = null;
      _state = ScreenShareState.idle;
      
      // Notify peers
      socketService.emit('screenShareStop', {
        'userId': 'my_id',
      });
      
      notifyListeners();
    } catch (e) {
      _state = ScreenShareState.error;
      notifyListeners();
    }
  }
  
  // Switch between camera and screen
  Future<void> toggleScreenShare(String peerId) async {
    if (isScreenSharing) {
      await stopScreenShare(peerId);
    } else {
      await startScreenShare(peerId);
    }
  }
}
```

---

### **Screen Share Widget**

```dart
// Widgets untuk menampilkan screen share

class ScreenShareDisplay extends StatelessWidget {
  final RTCVideoTrack screenTrack;
  final String userName;
  
  const ScreenShareDisplay({
    required this.screenTrack,
    required this.userName,
  });
  
  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Fullscreen view untuk screen share
        RTCVideoView(
          screenTrack,
          objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain,
        ),
        
        // Info badge
        Positioned(
          top: 16,
          left: 16,
          child: Container(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.red,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Icon(Icons.screen_share, color: Colors.white, size: 16),
                SizedBox(width: 8),
                Text(
                  '$userName screen',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// Control button untuk screen share
class ScreenShareButton extends StatelessWidget {
  final bool isScreenSharing;
  final VoidCallback onPressed;
  
  const ScreenShareButton({
    required this.isScreenSharing,
    required this.onPressed,
  });
  
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding: EdgeInsets.all(12),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isScreenSharing 
            ? Colors.red 
            : Colors.grey[800],
        ),
        child: Icon(
          Icons.screen_share,
          color: Colors.white,
        ),
      ),
    );
  }
}
```

---

## 🧪 Testing Screen Share

```dart
void main() {
  group('Screen Share Tests', () {
    late WebRTCService webrtcService;
    late ScreenShareService screenShareService;
    late MockSocket mockSocket;
    
    setUp(() {
      screenShareService = ScreenShareService();
      webrtcService = WebRTCService();
      mockSocket = MockSocket();
    });
    
    test('Request screen capture', () async {
      final stream = await screenShareService.getDisplayMedia();
      expect(stream, isNotNull);
      expect(screenShareService.isScreenSharing, true);
    });
    
    test('Stop screen sharing', () async {
      await screenShareService.getDisplayMedia();
      await screenShareService.stopScreenShare();
      
      expect(screenShareService.isScreenSharing, false);
      expect(screenShareService.screenTrack, isNull);
    });
    
    test('Add screen track to peer connection', () async {
      await webrtcService.createPeerConnection('peer123');
      await webrtcService.startScreenShareWithPeer('peer123');
      
      final senders = await webrtcService.peerConnections['peer123']!
        .getSenders();
      expect(senders.length, greaterThan(0));
    });
    
    test('Screen share state changes', (onTest) async {
      var states = <ScreenShareState>[];
      
      screenShareService.screenShareState.listen((state) {
        states.add(state);
      });
      
      await screenShareService.getDisplayMedia();
      await screenShareService.stopScreenShare();
      
      expect(states, contains(ScreenShareState.requesting));
      expect(states, contains(ScreenShareState.capturing));
      expect(states, contains(ScreenShareState.stopped));
    });
  });
}
```

---

## 🚀 Complete Example Flow

```dart
// Full screen share flow in Room Screen

class RoomScreen extends StatefulWidget {
  @override
  _RoomScreenState createState() => _RoomScreenState();
}

class _RoomScreenState extends State<RoomScreen> {
  bool _isScreenSharing = false;
  
  @override
  Widget build(BuildContext context) {
    return Consumer2<CallProvider, ScreenShareProvider>(
      builder: (context, callProvider, screenProvider, _) {
        return Scaffold(
          body: _isScreenSharing
            ? _buildScreenShareView(screenProvider)
            : _buildVideoView(callProvider),
          bottomNavigationBar: _buildControls(callProvider, screenProvider),
        );
      },
    );
  }
  
  Widget _buildScreenShareView(ScreenShareProvider provider) {
    return ScreenShareDisplay(
      screenTrack: provider.currentScreenShare!.videoTrack!,
      userName: provider.currentScreenShare!.userName,
    );
  }
  
  Widget _buildVideoView(CallProvider provider) {
    return GridView.builder(
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2),
      itemCount: provider.remotePeers.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return LocalVideoWidget();
        }
        return RemoteVideoWidget(peerId: provider.remotePeers[index - 1]);
      },
    );
  }
  
  Widget _buildControls(CallProvider callProvider, ScreenShareProvider screenProvider) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        // Toggle camera
        IconButton(
          icon: Icon(
            callProvider.isCameraOn ? Icons.videocam : Icons.videocam_off
          ),
          onPressed: () => callProvider.toggleCamera(),
        ),
        
        // Toggle audio
        IconButton(
          icon: Icon(
            callProvider.isAudioOn ? Icons.mic : Icons.mic_off
          ),
          onPressed: () => callProvider.toggleAudio(),
        ),
        
        // Screen share button
        ScreenShareButton(
          isScreenSharing: screenProvider.isScreenSharing,
          onPressed: () async {
            await screenProvider.toggleScreenShare(
              callProvider.remotePeers.first
            );
            setState(() {
              _isScreenSharing = screenProvider.isScreenSharing;
            });
          },
        ),
        
        // Hang up
        IconButton(
          icon: Icon(Icons.call_end),
          color: Colors.red,
          onPressed: () => callProvider.leaveRoom(),
        ),
      ],
    );
  }
}
```

---

## ⚠️ Common Issues & Solutions

### **Issue 1: Screen Capture Permission Denied**
```dart
// Solution: Show permission request dialog
Future<void> requestScreenCapturePermission() async {
  if (Platform.isAndroid) {
    final result = await Permission.cameraScreen.request();
    if (result.isDenied) {
      openAppSettings();
    }
  }
}
```

### **Issue 2: Screen Share Freezes After 30 Seconds**
```dart
// Solution: Refresh ICE candidates
Future<void> handleScreenShareFreeze(String peerId) async {
  final peerConnection = webrtcService.peerConnections[peerId];
  
  // Renegotiate connection
  final offer = await peerConnection!.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  socket.emit('offer', {
    'to': peerId,
    'from': myUserId,
    'offer': offer.toMap(),
  });
}
```

### **Issue 3: Both Camera and Screen Active**
```dart
// Solution: Switch properly
Future<void> handleScreenShareButKeepCamera(String peerId) async {
  // Instead of stopping camera, create new transceiver
  // for screen with different mediaStreamId
  
  final peerConnection = webrtcService.peerConnections[peerId];
  final screenTrack = screenShareService.screenTrack!;
  
  // Add as new track, don't replace
  await peerConnection!.addTrack(screenTrack, ['screen']);
}
```

---

**Last Updated**: March 17, 2025
**Difficulty Level**: Advanced
**Estimated Implementation Time**: 2-3 days

