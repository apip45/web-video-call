# 🎵 Media Handling - Camera, Microphone & Audio Routing

## Complete Guide untuk Media Management

Panduan lengkap untuk camera control, microphone muting, dan audio output routing.

---

## 🎤 Microphone & Audio Management

### **Audio State Tracking**

```dart
class MediaStateProvider extends ChangeNotifier {
  // Audio state
  bool _isAudioEnabled = true;
  bool _isSpeakerOn = true;
  AudioSessionCategory? _audioCategory;
  
  bool get isAudioEnabled => _isAudioEnabled;
  bool get isSpeakerOn => _isSpeakerOn;
  
  final WebRTCRepository webrtcRepository;
  
  MediaStateProvider(this.webrtcRepository);
  
  // Toggle microphone
  Future<void> toggleAudio() async {
    try {
      _isAudioEnabled = !_isAudioEnabled;
      webrtcRepository.toggleAudio(_isAudioEnabled);
      notifyListeners();
    } catch (e) {
      _isAudioEnabled = !_isAudioEnabled; // Revert
      notifyListeners();
      rethrow;
    }
  }
  
  // Toggle speaker/earpiece
  Future<void> toggleSpeaker() async {
    try {
      _isSpeakerOn = !_isSpeakerOn;
      
      // iOS: Use audio_session package
      await AudioSession.instance.setActive(true);
      
      if (_isSpeakerOn) {
        await AudioSession.instance.setCategory(
          AudioSessionCategory.default,
          options: AudioSessionOptions.defaultToSpeaker,
        );
      } else {
        await AudioSession.instance.setCategory(
          AudioSessionCategory.communication,
          options: AudioSessionOptions.duckOthers,
        );
      }
      
      notifyListeners();
    } catch (e) {
      _isSpeakerOn = !_isSpeakerOn; // Revert
      notifyListeners();
      rethrow;
    }
  }
}
```

### **Audio Session Setup** (iOS/Android)

File: `lib/shared/services/audio_service.dart`

```dart
import 'package:audio_session/audio_session.dart';

class AudioService {
  static Future<void> initAudio() async {
    try {
      final session = AudioSession.instance;
      
      // For iOS
      if (Platform.isIOS) {
        await session.configure(
          AudioSessionConfiguration(
            avAudioSessionCategory: AVAudioSessionCategory.communication,
            avAudioSessionCategoryOptions: {
              AVAudioSessionCategoryOption.defaultToSpeaker,
              AVAudioSessionCategoryOption.duckOthers,
            },
            avAudioSessionMode: AVAudioSessionMode.default_,
            avAudioSessionRouteSharingPolicy:
                AVAudioSessionRouteSharingPolicy.default_,
            androidAudioAttributes: AndroidAudioAttributes(
              contentType: AndroidAudioContentType.speech,
              flags: AndroidAudioFlags.audibilityEnforced,
              usage: AndroidAudioUsage.voiceCommunication,
            ),
            androidAudioFocusGainType:
                AndroidAudioFocusGainType.gainTransientMayDuck,
            androidWillPauseWhenDucked: true,
          ),
        );
      } else if (Platform.isAndroid) {
        // For Android
        await session.configure(
          AudioSessionConfiguration.phoneCall(),
        );
      }
      
      print('✅ Audio session initialized');
    } catch (e) {
      print('❌ Error initializing audio: $e');
    }
  }
  
  static Future<void> enableSpeaker() async {
    try {
      final session = AudioSession.instance;
      
      if (Platform.isIOS) {
        await session.setActive(true, avAudioSessionOptions: {
          AVAudioSessionOption.overrideMutedMicrophone,
          AVAudioSessionOption.duckOthers,
        });
        
        // Force speaker output
        await session.setCategory(
          AudioSessionCategory.playWithoutMixing,
          options: {AVAudioSessionCategoryOption.defaultToSpeaker},
        );
      }
      
      print('✅ Speaker enabled');
    } catch (e) {
      print('❌ Error enabling speaker: $e');
    }
  }
  
  static Future<void> disableSpeaker() async {
    try {
      final session = AudioSession.instance;
      
      if (Platform.isIOS) {
        await session.setCategory(
          AudioSessionCategory.communication,
          options: {AVAudioSessionCategoryOption.duckOthers},
        );
      }
      
      print('✅ Speaker disabled (earpiece enabled)');
    } catch (e) {
      print('❌ Error disabling speaker: $e');
    }
  }
}
```

---

## 📷 Camera Management

### **Camera State**

```dart
class CameraController extends ChangeNotifier {
  bool _isCameraEnabled = true;
  bool _isFrontCamera = true;
  
  bool get isCameraEnabled => _isCameraEnabled;
  bool get isFrontCamera => _isFrontCamera;
  
  final WebRTCRepository webrtcRepository;
  
  CameraController(this.webrtcRepository);
  
  Future<void> toggleCamera() async {
    try {
      _isCameraEnabled = !_isCameraEnabled;
      webrtcRepository.toggleVideo(_isCameraEnabled);
      notifyListeners();
    } catch (e) {
      _isCameraEnabled = !_isCameraEnabled; // Revert
      notifyListeners();
      rethrow;
    }
  }
  
  Future<void> switchCamera() async {
    try {
      await webrtcRepository.switchCamera();
      _isFrontCamera = !_isFrontCamera;
      notifyListeners();
    } catch (e) {
      notifyListeners();
      rethrow;
    }
  }
}
```

### **Video Display Widgets**

```dart
// Local video display
class LocalVideoWidget extends StatelessWidget {
  final MediaStream? stream;
  
  @override
  Widget build(BuildContext context) {
    if (stream == null) {
      return Container(
        color: Colors.black,
        child: Center(
          child: Text('No camera'),
        ),
      );
    }
    
    return RTCVideoView(
      stream as RTCVideoRenderer, // Cast stream to renderer
      objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
      mirror: true, // Mirror front camera
    );
  }
}

// Remote video display
class RemoteVideoWidget extends StatelessWidget {
  final String peerId;
  final MediaStream? stream;
  final String? peerName;
  
  @override
  Widget build(BuildContext context) {
    if (stream == null) {
      return Container(
        color: Colors.black87,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 40,
                child: Text(peerName?[0] ?? '?'),
              ),
              SizedBox(height: 10),
              Text(
                peerName ?? 'User',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      );
    }
    
    return RTCVideoView(
      stream as RTCVideoRenderer,
      objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
      mirror: false, // Don't mirror remote video
    );
  }
}

// Video grid for multiple participants
class VideoGrid extends StatelessWidget {
  final MediaStream localStream;
  final Map<String, MediaStream> remoteStreams;
  final Map<String, String> peerNames; // peerId -> name mapping
  
  @override
  Widget build(BuildContext context) {
    final totalParticipants = 1 + remoteStreams.length; // local + remote
    
    if (totalParticipants == 1) {
      // Only local video
      return LocalVideoWidget(stream: localStream);
    } else if (totalParticipants == 2) {
      // Local + 1 remote (side by side or stacked)
      return Row(
        children: [
          Expanded(
            flex: 1,
            child: LocalVideoWidget(stream: localStream),
          ),
          Expanded(
            flex: 1,
            child: RemoteVideoWidget(
              peerId: remoteStreams.keys.first,
              stream: remoteStreams.values.first,
              peerName: peerNames[remoteStreams.keys.first],
            ),
          ),
        ],
      );
    } else {
      // Grid layout
      return GridView.count(
        crossAxisCount: 2,
        children: [
          // Local video
          LocalVideoWidget(stream: localStream),
          
          // Remote videos
          ...remoteStreams.entries.map((entry) {
            return RemoteVideoWidget(
              peerId: entry.key,
              stream: entry.value,
              peerName: peerNames[entry.key],
            );
          }).toList(),
        ],
      );
    }
  }
}
```

---

## 🔊 Audio Routing

### **Audio Output Control**

```dart
class AudioOutputManager {
  static Future<void> setToSpeaker() async {
    if (Platform.isIOS) {
      await AudioService.enableSpeaker();
    } else if (Platform.isAndroid) {
      // Android handles speaker through AudioSession
      // but you can also use:
      // await _webrtcService.setDefaultAudioRoute(true);
    }
  }
  
  static Future<void> setToEarpiece() async {
    if (Platform.isIOS) {
      await AudioService.disableSpeaker();
    }
  }
  
  // Get available audio devices
  static Future<List<String>> getAudioDevices() async {
    // This varies by platform
    // For iOS, you might check AVAudioSession routes
    // For Android, query audio devices
    return [];
  }
}
```

---

## 🎬 Video Quality Control

### **Video Constraints**

```dart
enum VideoQuality {
  low,
  medium,
  high,
}

class VideoQualityManager {
  static Map<String, dynamic> getConstraints(VideoQuality quality) {
    switch (quality) {
      case VideoQuality.low:
        return {
          'video': {
            'mandatory': {
              'minWidth': 320,
              'minHeight': 240,
              'minFrameRate': 15,
            },
          }
        };
      case VideoQuality.medium:
        return {
          'video': {
            'mandatory': {
              'minWidth': 640,
              'minHeight': 480,
              'minFrameRate': 24,
            },
          }
        };
      case VideoQuality.high:
        return {
          'video': {
            'mandatory': {
              'minWidth': 1280,
              'minHeight': 720,
              'minFrameRate': 30,
            },
          }
        };
    }
  }
  
  // Adaptive bitrate based on network
  static Future<void> adjustBitrate({
    required RTCPeerConnection peerConnection,
    required int bitrate, // in kbps
  }) async {
    try {
      // Get current parameters
      final sender = peerConnection.getSenders().first;
      final parameters = sender.parameters;
      
      // Modify encoding parameters
      parameters.encodings[0].maxBitrate = bitrate;
      parameters.encodings[0].targetBitrate = bitrate;
      
      // Update parameters
      await sender.parameters = parameters;
      
      print('✅ Bitrate adjusted to $bitrate kbps');
    } catch (e) {
      print('❌ Error adjusting bitrate: $e');
    }
  }
}
```

---

## 🔄 Permissions Management

```dart
class PermissionManager {
  static Future<bool> requestCameraPermission() async {
    final status = await Permission.camera.request();
    return status.isGranted;
  }
  
  static Future<bool> requestMicrophonePermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }
  
  static Future<bool> requestAllPermissions() async {
    final results = await [
      Permission.camera,
      Permission.microphone,
    ].request();
    
    return results.values.every((status) => status.isGranted);
  }
  
  static Future<void> checkAndRequestPermissions() async {
    print('🔐 Checking permissions...');
    
    try {
      final cameraStatus = await Permission.camera.status;
      final micStatus = await Permission.microphone.status;
      
      if (!cameraStatus.isGranted) {
        print('📷 Requesting camera permission');
        await requestCameraPermission();
      }
      
      if (!micStatus.isGranted) {
        print('🎤 Requesting microphone permission');
        await requestMicrophonePermission();
      }
      
      print('✅ Permissions granted');
    } catch (e) {
      print('❌ Permission error: $e');
    }
  }
}
```

---

## 🎯 Media Provider Integration

```dart
class MediaProvider extends ChangeNotifier {
  final WebRTCRepository webrtcRepository;
  
  bool _isAudioEnabled = true;
  bool _isVideoEnabled = true;
  bool _isSpeakerOn = true;
  bool _isFrontCamera = true;
  
  MediaStream? _localStream;
  
  bool get isAudioEnabled => _isAudioEnabled;
  bool get isVideoEnabled => _isVideoEnabled;
  bool get isSpeakerOn => _isSpeakerOn;
  bool get isFrontCamera => _isFrontCamera;
  MediaStream? get localStream => _localStream;
  
  MediaProvider(this.webrtcRepository);
  
  Future<void> initMedia() async {
    try {
      await PermissionManager.checkAndRequestPermissions();
      await AudioService.initAudio();
      
      _localStream = await webrtcRepository.initLocalStream();
      notifyListeners();
    } catch (e) {
      print('❌ Error initializing media: $e');
      rethrow;
    }
  }
  
  Future<void> toggleAudio() async {
    try {
      _isAudioEnabled = !_isAudioEnabled;
      webrtcRepository.toggleAudio(_isAudioEnabled);
      notifyListeners();
    } catch (e) {
      _isAudioEnabled = !_isAudioEnabled;
      notifyListeners();
      rethrow;
    }
  }
  
  Future<void> toggleVideo() async {
    try {
      _isVideoEnabled = !_isVideoEnabled;
      webrtcRepository.toggleVideo(_isVideoEnabled);
      notifyListeners();
    } catch (e) {
      _isVideoEnabled = !_isVideoEnabled;
      notifyListeners();
      rethrow;
    }
  }
  
  Future<void> toggleSpeaker() async {
    try {
      _isSpeakerOn = !_isSpeakerOn;
      
      if (_isSpeakerOn) {
        await AudioOutputManager.setToSpeaker();
      } else {
        await AudioOutputManager.setToEarpiece();
      }
      
      notifyListeners();
    } catch (e) {
      _isSpeakerOn = !_isSpeakerOn;
      notifyListeners();
      rethrow;
    }
  }
  
  Future<void> switchCamera() async {
    try {
      await webrtcRepository.switchCamera();
      _isFrontCamera = !_isFrontCamera;
      notifyListeners();
    } catch (e) {
      notifyListeners();
      rethrow;
    }
  }
  
  Future<void> cleanup() async {
    await webrtcRepository.closeAll();
    _localStream = null;
  }
}
```

---

## 🎨 Call Controls UI Example

```dart
class CallControlsWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<MediaProvider>(
      builder: (context, mediaProvider, _) {
        return Container(
          padding: EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // Microphone toggle
              FloatingActionButton(
                onPressed: () => mediaProvider.toggleAudio(),
                backgroundColor: mediaProvider.isAudioEnabled
                    ? Colors.green
                    : Colors.red,
                child: Icon(
                  mediaProvider.isAudioEnabled
                      ? Icons.mic
                      : Icons.mic_off,
                ),
              ),
              
              // Camera toggle
              FloatingActionButton(
                onPressed: () => mediaProvider.toggleVideo(),
                backgroundColor: mediaProvider.isVideoEnabled
                    ? Colors.green
                    : Colors.red,
                child: Icon(
                  mediaProvider.isVideoEnabled
                      ? Icons.videocam
                      : Icons.videocam_off,
                ),
              ),
              
              // Speaker toggle
              FloatingActionButton(
                onPressed: () => mediaProvider.toggleSpeaker(),
                backgroundColor: mediaProvider.isSpeakerOn
                    ? Colors.green
                    : Colors.blue,
                child: Icon(
                  mediaProvider.isSpeakerOn
                      ? Icons.speaker
                      : Icons.speaker_phone,
                ),
              ),
              
              // Switch camera
              FloatingActionButton(
                onPressed: () => mediaProvider.switchCamera(),
                backgroundColor: Colors.blue,
                child: Icon(Icons.flip_camera_ios),
              ),
            ],
          ),
        );
      },
    );
  }
}
```

---

## 🚀 Complete Checklist

- [ ] Setup audio session (iOS/Android)
- [ ] Implement audio toggle (mute/unmute)
- [ ] Implement speaker/earpiece toggle
- [ ] Setup video constraints
- [ ] Implement camera toggle
- [ ] Implement camera switch (front/back)
- [ ] Create video display widgets
- [ ] Test audio routing
- [ ] Test video playback
- [ ] Handle permission requests

---

**Last Updated**: March 17, 2025
**Status**: Complete
**Platforms**: iOS & Android

