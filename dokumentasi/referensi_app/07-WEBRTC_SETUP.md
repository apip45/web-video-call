# 📹 WebRTC Setup - Peer Connection Implementation

## Flutter WebRTC Configuration dan Setup

Panduan lengkap untuk setup WebRTC dengan flutter_webrtc package.

---

## 📦 Dependencies

```yaml
dependencies:
  flutter_webrtc: ^0.9.0
  permission_handler: ^11.4.0
```

Install:
```bash
flutter pub add flutter_webrtc permission_handler
```

---

## 🔧 Platform Configuration

### **Android Setup**

File: `android/app/build.gradle.kts`

```gradle
android {
    compileSdk 34
    
    defaultConfig {
        minSdk 21 // minimum for WebRTC
        targetSdk 34
    }
}

dependencies {
    // Already added by flutter_webrtc
    implementation 'org.webrtc:google-webrtc:1.0.32006'
}
```

File: `android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CHANGE_NETWORK_STATE" />
    <uses-permission android:name="android.permission.INTERNET" />
    
    <application>
        <!-- Activity config -->
    </application>
</manifest>
```

### **iOS Setup**

File: `ios/Runner/Info.plist`

```xml
<dict>
    <key>NSCameraUsageDescription</key>
    <string>This app needs access to your camera for video calls</string>
    
    <key>NSMicrophoneUsageDescription</key>
    <string>This app needs access to your microphone for audio calls</string>
    
    <key>NSLocalNetworkUsageDescription</key>
    <string>This app needs access to your local network for calling</string>
    
    <key>NSBonjourServices</key>
    <array>
        <string>_services._dns-sd._udp</string>
    </array>
</dict>
```

---

## 🏗️ WebRTC Service

File: `lib/shared/services/webrtc_service.dart`

```dart
import 'package:flutter_webrtc/flutter_webrtc.dart';

class WebRTCService {
  // Peer connections
  Map<String, RTCPeerConnection> _peerConnections = {};
  
  // Local stream
  MediaStream? _localStream;
  MediaStream? get localStream => _localStream;
  
  // Configuration
  static const Map<String, dynamic> _configuration = {
    'iceServers': [
      {
        'urls': [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
        ]
      },
      // Add TURN server if needed
      {
        'urls': ['turn:turnserver.example.com:3478'],
        'username': 'user',
        'credential': 'pass',
      }
    ]
  };
  
  static const Map<String, dynamic> _constraints = {
    'audio': true,
    'video': {
      'mandatory': {
        'minWidth': 640,
        'minHeight': 480,
        'minFrameRate': 30,
      },
      'facingMode': 'user',
    }
  };
  
  // ============ LOCAL MEDIA ============
  
  Future<MediaStream> getLocalStream({
    bool audio = true,
    bool video = true,
  }) async {
    try {
      final stream = await navigator.mediaDevices.getUserMedia({
        'audio': audio,
        'video': video ? _constraints['video'] : false,
      });
      
      _localStream = stream;
      print('✅ Local stream obtained');
      return stream;
    } catch (e) {
      print('❌ Error getting local stream: $e');
      rethrow;
    }
  }
  
  void disableAudio() {
    if (_localStream != null) {
      _localStream!.getAudioTracks().forEach((track) {
        track.enabled = false;
      });
    }
  }
  
  void enableAudio() {
    if (_localStream != null) {
      _localStream!.getAudioTracks().forEach((track) {
        track.enabled = true;
      });
    }
  }
  
  void disableVideo() {
    if (_localStream != null) {
      _localStream!.getVideoTracks().forEach((track) {
        track.enabled = false;
      });
    }
  }
  
  void enableVideo() {
    if (_localStream != null) {
      _localStream!.getVideoTracks().forEach((track) {
        track.enabled = true;
      });
    }
  }
  
  bool get isAudioEnabled {
    if (_localStream == null) return false;
    return _localStream!.getAudioTracks().any((track) => track.enabled);
  }
  
  bool get isVideoEnabled {
    if (_localStream == null) return false;
    return _localStream!.getVideoTracks().any((track) => track.enabled);
  }
  
  // Switch camera (front/back)
  Future<void> switchCamera() async {
    if (_localStream != null) {
      final videoTracks = _localStream!.getVideoTracks();
      if (videoTracks.isNotEmpty) {
        await videoTracks.first.switchCamera();
      }
    }
  }
  
  void closeLocalStream() {
    if (_localStream != null) {
      _localStream!.getTracks().forEach((track) {
        track.stop();
      });
      _localStream = null;
    }
  }
  
  // ============ PEER CONNECTION ============
  
  Future<RTCPeerConnection> createPeerConnection(String peerId) async {
    try {
      final pc = await createPeerConnection(
        _configuration,
        const RTCMediaConstraints(),
      );
      
      // Add local stream
      if (_localStream != null) {
        await pc.addStream(_localStream!);
      }
      
      // Setup event handlers
      pc.onIceCandidate = (RTCIceCandidate candidate) {
        print('🧊 ICE candidate: ${candidate.candidate}');
        _onIceCandidate?.call(peerId, candidate);
      };
      
      pc.onAddStream = (MediaStream stream) {
        print('✅ Remote stream added');
        _onRemoteStream?.call(peerId, stream);
      };
      
      pc.onRemoveStream = (MediaStream stream) {
        print('❌ Remote stream removed');
        _onRemoteStreamRemoved?.call(peerId);
      };
      
      pc.onRenegotiationNeeded = () {
        print('🔄 Renegotiation needed');
      };
      
      pc.onConnectionState = (RTCPeerConnectionState state) {
        print('🔗 Connection state: $state');
        _onConnectionStateChanged?.call(peerId, state);
      };
      
      pc.onIceConnectionState = (RTCIceConnectionState state) {
        print('🧊 ICE connection state: $state');
        _onIceConnectionStateChanged?.call(peerId, state);
      };
      
      _peerConnections[peerId] = pc;
      return pc;
    } catch (e) {
      print('❌ Error creating peer connection: $e');
      rethrow;
    }
  }
  
  RTCPeerConnection? getPeerConnection(String peerId) {
    return _peerConnections[peerId];
  }
  
  // ============ OFFER/ANSWER ============
  
  Future<RTCSessionDescription> createOffer(String peerId) async {
    try {
      final pc = _peerConnections[peerId];
      if (pc == null) throw Exception('Peer connection not found');
      
      final offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      
      print('📤 Offer created');
      return offer;
    } catch (e) {
      print('❌ Error creating offer: $e');
      rethrow;
    }
  }
  
  Future<void> setRemoteOffer(String peerId, RTCSessionDescription offer) async {
    try {
      final pc = _peerConnections[peerId];
      if (pc == null) throw Exception('Peer connection not found');
      
      await pc.setRemoteDescription(offer);
      print('✅ Remote offer set');
    } catch (e) {
      print('❌ Error setting remote offer: $e');
      rethrow;
    }
  }
  
  Future<RTCSessionDescription> createAnswer(String peerId) async {
    try {
      final pc = _peerConnections[peerId];
      if (pc == null) throw Exception('Peer connection not found');
      
      final answer = await pc.createAnswer({});
      await pc.setLocalDescription(answer);
      
      print('📤 Answer created');
      return answer;
    } catch (e) {
      print('❌ Error creating answer: $e');
      rethrow;
    }
  }
  
  Future<void> setRemoteAnswer(String peerId, RTCSessionDescription answer) async {
    try {
      final pc = _peerConnections[peerId];
      if (pc == null) throw Exception('Peer connection not found');
      
      await pc.setRemoteDescription(answer);
      print('✅ Remote answer set');
    } catch (e) {
      print('❌ Error setting remote answer: $e');
      rethrow;
    }
  }
  
  // ============ ICE CANDIDATES ============
  
  Future<void> addIceCandidate(
    String peerId,
    RTCIceCandidate iceCandidate,
  ) async {
    try {
      final pc = _peerConnections[peerId];
      if (pc == null) throw Exception('Peer connection not found');
      
      await pc.addCandidate(iceCandidate);
      print('✅ ICE candidate added');
    } catch (e) {
      print('⚠️ Error adding ICE candidate: $e');
      // Don't rethrow, some candidates might fail
    }
  }
  
  // ============ CLEANUP ============
  
  Future<void> closePeerConnection(String peerId) async {
    try {
      final pc = _peerConnections[peerId];
      if (pc != null) {
        await pc.close();
        _peerConnections.remove(peerId);
        print('✅ Peer connection closed: $peerId');
      }
    } catch (e) {
      print('❌ Error closing peer connection: $e');
    }
  }
  
  Future<void> closeAllConnections() async {
    try {
      for (final pc in _peerConnections.values) {
        await pc.close();
      }
      _peerConnections.clear();
      closeLocalStream();
      print('✅ All connections closed');
    } catch (e) {
      print('❌ Error closing all connections: $e');
    }
  }
  
  // ============ EVENT HANDLERS ============
  
  Function(String peerId, RTCIceCandidate)? _onIceCandidate;
  Function(String peerId, MediaStream)? _onRemoteStream;
  Function(String peerId)? _onRemoteStreamRemoved;
  Function(String peerId, RTCPeerConnectionState)? _onConnectionStateChanged;
  Function(String peerId, RTCIceConnectionState)? _onIceConnectionStateChanged;
  
  set onIceCandidate(Function(String, RTCIceCandidate)? callback) {
    _onIceCandidate = callback;
  }
  
  set onRemoteStream(Function(String, MediaStream)? callback) {
    _onRemoteStream = callback;
  }
  
  set onRemoteStreamRemoved(Function(String)? callback) {
    _onRemoteStreamRemoved = callback;
  }
  
  set onConnectionStateChanged(
    Function(String, RTCPeerConnectionState)? callback,
  ) {
    _onConnectionStateChanged = callback;
  }
  
  set onIceConnectionStateChanged(
    Function(String, RTCIceConnectionState)? callback,
  ) {
    _onIceConnectionStateChanged = callback;
  }
  
  // ============ STATS ============
  
  Future<RTCStatsReport> getStats(String peerId) async {
    try {
      final pc = _peerConnections[peerId];
      if (pc == null) throw Exception('Peer connection not found');
      
      return await pc.getStats();
    } catch (e) {
      print('❌ Error getting stats: $e');
      rethrow;
    }
  }
}
```

---

## 🎯 Repository Layer

File: `lib/features/room/data/repositories/webrtc_repository.dart`

```dart
abstract class WebRTCRepository {
  Future<MediaStream> initLocalStream();
  MediaStream? get localStream;
  
  Future<RTCPeerConnection> createPeerConnection(String peerId);
  Future<RTCSessionDescription> createOffer(String peerId);
  Future<void> setRemoteOffer(String peerId, Map<String, dynamic> offerJson);
  Future<RTCSessionDescription> createAnswer(String peerId);
  Future<void> setRemoteAnswer(String peerId, Map<String, dynamic> answerJson);
  
  Future<void> addIceCandidate(String peerId, Map<String, dynamic> candidateJson);
  
  Future<void> closePeerConnection(String peerId);
  Future<void> closeAll();
  
  void toggleAudio(bool enabled);
  void toggleVideo(bool enabled);
  Future<void> switchCamera();
  
  Stream<RemoteStreamEvent> get remoteStreamStream;
  Stream<IceCandidateEvent> get iceCandidateStream;
  Stream<ConnectionStateEvent> get connectionStateStream;
}

class WebRTCRepositoryImpl implements WebRTCRepository {
  final WebRTCService _webrtcService;
  
  final _remoteStreamController = StreamController<RemoteStreamEvent>.broadcast();
  final _iceCandidateController = StreamController<IceCandidateEvent>.broadcast();
  final _connectionStateController = StreamController<ConnectionStateEvent>.broadcast();
  
  WebRTCRepositoryImpl(this._webrtcService) {
    _setupWebRTCHandlers();
  }
  
  void _setupWebRTCHandlers() {
    _webrtcService.onRemoteStream = (peerId, stream) {
      _remoteStreamController.add(
        RemoteStreamEvent(peerId: peerId, stream: stream),
      );
    };
    
    _webrtcService.onIceCandidate = (peerId, candidate) {
      _iceCandidateController.add(
        IceCandidateEvent(peerId: peerId, candidate: candidate),
      );
    };
    
    _webrtcService.onConnectionStateChanged = (peerId, state) {
      _connectionStateController.add(
        ConnectionStateEvent(peerId: peerId, state: state),
      );
    };
  }
  
  @override
  Future<MediaStream> initLocalStream() async {
    return await _webrtcService.getLocalStream(
      audio: true,
      video: true,
    );
  }
  
  @override
  MediaStream? get localStream => _webrtcService.localStream;
  
  @override
  Future<RTCPeerConnection> createPeerConnection(String peerId) async {
    return await _webrtcService.createPeerConnection(peerId);
  }
  
  @override
  Future<RTCSessionDescription> createOffer(String peerId) async {
    return await _webrtcService.createOffer(peerId);
  }
  
  @override
  Future<void> setRemoteOffer(String peerId, Map<String, dynamic> offerJson) async {
    final offer = RTCSessionDescription(
      offerJson['sdp'] as String,
      offerJson['type'] as String,
    );
    await _webrtcService.setRemoteOffer(peerId, offer);
  }
  
  @override
  Future<RTCSessionDescription> createAnswer(String peerId) async {
    return await _webrtcService.createAnswer(peerId);
  }
  
  @override
  Future<void> setRemoteAnswer(String peerId, Map<String, dynamic> answerJson) async {
    final answer = RTCSessionDescription(
      answerJson['sdp'] as String,
      answerJson['type'] as String,
    );
    await _webrtcService.setRemoteAnswer(peerId, answer);
  }
  
  @override
  Future<void> addIceCandidate(String peerId, Map<String, dynamic> candidateJson) async {
    final candidate = RTCIceCandidate(
      candidateJson['candidate'] as String,
      candidateJson['sdpMlineIndex'] as int?,
      candidateJson['sdpMid'] as String?,
    );
    await _webrtcService.addIceCandidate(peerId, candidate);
  }
  
  @override
  Future<void> closePeerConnection(String peerId) async {
    await _webrtcService.closePeerConnection(peerId);
  }
  
  @override
  Future<void> closeAll() async {
    await _webrtcService.closeAllConnections();
  }
  
  @override
  void toggleAudio(bool enabled) {
    if (enabled) {
      _webrtcService.enableAudio();
    } else {
      _webrtcService.disableAudio();
    }
  }
  
  @override
  void toggleVideo(bool enabled) {
    if (enabled) {
      _webrtcService.enableVideo();
    } else {
      _webrtcService.disableVideo();
    }
  }
  
  @override
  Future<void> switchCamera() async {
    await _webrtcService.switchCamera();
  }
  
  @override
  Stream<RemoteStreamEvent> get remoteStreamStream => _remoteStreamController.stream;
  
  @override
  Stream<IceCandidateEvent> get iceCandidateStream => _iceCandidateController.stream;
  
  @override
  Stream<ConnectionStateEvent> get connectionStateStream => _connectionStateController.stream;
}

// Events
class RemoteStreamEvent {
  final String peerId;
  final MediaStream stream;
  
  RemoteStreamEvent({required this.peerId, required this.stream});
}

class IceCandidateEvent {
  final String peerId;
  final RTCIceCandidate candidate;
  
  IceCandidateEvent({required this.peerId, required this.candidate});
}

class ConnectionStateEvent {
  final String peerId;
  final RTCPeerConnectionState state;
  
  ConnectionStateEvent({required this.peerId, required this.state});
}
```

---

## 🚀 Complete Checklist

- [ ] Add flutter_webrtc dependency
- [ ] Setup Android manifest permissions
- [ ] Setup iOS info.plist permissions
- [ ] Create WebRTCService
- [ ] Create WebRTCRepository
- [ ] Test local stream capture
- [ ] Test offer/answer flow
- [ ] Test ICE candidate handling
- [ ] Test peer connection establishment
- [ ] Monitor connection stats

---

**Last Updated**: March 17, 2025
**Status**: Complete
**Framework**: flutter_webrtc

