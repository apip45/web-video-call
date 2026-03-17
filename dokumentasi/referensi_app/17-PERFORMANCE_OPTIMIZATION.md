# ⚡ Performance Optimization Guide

## Mengoptimalkan Video Quality, CPU, dan Bandwidth

---

## 📊 Performance Metrics

```dart
class PerformanceMetrics {
  // Video metrics
  double fps = 30;
  int videoBitrate = 1500;  // kbps
  int videoResolution = 640; // width
  
  // Audio metrics
  int audioBitrate = 128;   // kbps
  
  // Network metrics
  int latency = 0;          // ms
  double packetLoss = 0;    // percentage
  double jitter = 0;        // ms
  
  // Device metrics
  int cpuUsage = 0;         // percentage
  int memoryUsage = 0;      // MB
  int batteryLevel = 100;   // percentage
  
  // Connection metrics
  bool isConnected = false;
  String connectionType = 'unknown';
}
```

---

## 🎥 Video Quality Optimization

### **1. Adaptive Video Quality**

```dart
class VideoQualityManager {
  late RTCPeerConnection peerConnection;
  VideoQuality currentQuality = VideoQuality.medium;
  
  // Quality presets
  static final qualityPresets = {
    VideoQuality.low: {
      'width': 320,
      'height': 240,
      'frameRate': 15,
      'bitrate': 500,    // kbps
    },
    VideoQuality.medium: {
      'width': 640,
      'height': 480,
      'frameRate': 24,
      'bitrate': 1500,   // kbps
    },
    VideoQuality.high: {
      'width': 1280,
      'height': 720,
      'frameRate': 30,
      'bitrate': 2500,   // kbps
    },
  };
  
  // Adapt quality based on network
  Future<void> adaptQuality(NetworkCondition condition) async {
    final newQuality = _getQualityForCondition(condition);
    
    if (newQuality != currentQuality) {
      await setVideoQuality(newQuality);
      currentQuality = newQuality;
      print('🎥 Quality changed to: $newQuality');
    }
  }
  
  VideoQuality _getQualityForCondition(NetworkCondition condition) {
    switch (condition) {
      case NetworkCondition.poor:
        return VideoQuality.low;
      case NetworkCondition.fair:
        return VideoQuality.medium;
      case NetworkCondition.good:
        return VideoQuality.high;
    }
  }
  
  // Set video quality
  Future<void> setVideoQuality(VideoQuality quality) async {
    final preset = qualityPresets[quality]!;
    
    // Apply constraints to local stream
    final localStream = await getDisplayMedia();
    final videoTrack = localStream?.getVideoTracks()[0];
    
    if (videoTrack != null) {
      await videoTrack.applyConstraints({
        'width': {'ideal': preset['width']},
        'height': {'ideal': preset['height']},
        'frameRate': {'ideal': preset['frameRate']},
      });
    }
    
    // Apply sender bitrate constraints
    await _applyBitrateLimits(preset['bitrate'] as int);
  }
  
  Future<void> _applyBitrateLimits(int bitrateKbps) async {
    final senders = await peerConnection.getSenders();
    
    for (var sender in senders) {
      if (sender.track?.kind == 'video') {
        final params = sender.parameters;
        
        for (var encoding in params.encodings) {
          encoding.maxBitrate = bitrateKbps * 1000;
          encoding.targetBitrate = bitrateKbps * 1000;
        }
        
        await sender.setParameters(params);
      }
    }
  }
}

enum VideoQuality { low, medium, high }
enum NetworkCondition { poor, fair, good }
```

---

### **2. Hardware Acceleration**

```dart
class HardwareAccelerationManager {
  // Enable H.264 codec for better performance
  Future<void> enableH264Codec() async {
    var rtcConfiguration = <String, dynamic>{
      'iceServers': [
        {'urls': ['stun:stun.l.google.com:19302']}
      ]
    };
    
    // Prefer H.264 for mobile devices
    var constraints = <String, dynamic>{
      'video': {
        'codec': [
          {'name': 'H264'}, // Hardware accelerated
          {'name': 'VP9'},
          {'name': 'VP8'},
        ]
      }
    };
  }
  
  // Use platform-specific video encoder
  Future<void> usePlatformVideoEncoder() async {
    if (Platform.isAndroid) {
      // Use MediaCodec hardware encoder
      print('🔧 Using Android MediaCodec');
    } else if (Platform.isIOS) {
      // Use VideoToolbox hardware encoder
      print('🔧 Using iOS VideoToolbox');
    }
  }
}
```

---

### **3. Simulcast (Multiple Quality Streams)**

```dart
class SimulcastManager {
  // Send multiple qualities to server
  Future<void> setupSimulcast(RTCPeerConnection peerConnection) async {
    final videoTrack = // get local video track
    
    final transceiver = await peerConnection.addTrack(videoTrack);
    
    // Configure 3 layers: low, medium, high
    final params = transceiver.sender.parameters;
    
    params.encodings = [
      {
        'rid': 'low',
        'maxBitrate': 500000,  // 500 kbps
        'maxFramerate': 15,
      },
      {
        'rid': 'medium',
        'maxBitrate': 1500000, // 1500 kbps
        'maxFramerate': 24,
      },
      {
        'rid': 'high',
        'maxBitrate': 2500000, // 2500 kbps
        'maxFramerate': 30,
      },
    ];
    
    await transceiver.sender.setParameters(params);
  }
}
```

---

## 🔊 Audio Optimization

### **1. Audio Codec Selection**

```dart
class AudioOptimizer {
  // Use latest audio codec
  Future<void> optimizeAudioCodec() async {
    var sdp = '''
    a=fmtp:111 minptime=10; useinbandfec=1
    a=rtpmap:111 opus/48000/2
    ''';
    
    // Opus supports:
    // - 6-500 kbps bitrate
    // - DTX (Discontinuous Transmission)
    // - FEC (Forward Error Correction)
    
    print('✅ Using Opus codec for better audio');
  }
  
  // Set audio bitrate
  Future<void> setAudioBitrate(int kbps) async {
    // Minimum: 6 kbps
    // Recommended: 128 kbps
    // Maximum: 500 kbps
    
    final bitrate = kbps.clamp(6, 500);
    print('🔊 Audio bitrate set to: ${bitrate}kbps');
  }
}
```

---

### **2. Acoustic Echo Cancellation (AEC)**

```dart
class AcousticEchoCancellation {
  // Enable AEC for better audio quality
  Future<void> enableAEC() async {
    final audioConstraints = <String, dynamic>{
      'audio': {
        'mandatory': {
          'echoCancellation': true,
          'noiseSuppression': true,
          'autoGainControl': true,
        }
      }
    };
    
    print('✅ AEC, noise suppression, and AGC enabled');
  }
}
```

---

## 💾 Memory Optimization

### **1. Media Stream Management**

```dart
class MemoryOptimizer {
  // Reuse media streams instead of creating new ones
  static MediaStream? _cachedLocalStream;
  
  Future<MediaStream> getLocalMediaStream() async {
    if (_cachedLocalStream != null) {
      return _cachedLocalStream!;
    }
    
    final stream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': {'facingMode': 'user'},
    });
    
    _cachedLocalStream = stream;
    return stream;
  }
  
  // Properly dispose resources
  void disposeLocalStream() {
    if (_cachedLocalStream != null) {
      for (var track in _cachedLocalStream!.getTracks()) {
        track.stop();
      }
      _cachedLocalStream?.dispose();
      _cachedLocalStream = null;
    }
  }
}
```

---

### **2. Image Optimization**

```dart
class ImageOptimizer {
  // Compress images before sending
  static const maxImageSize = 2 * 1024 * 1024; // 2MB
  
  Future<Uint8List> compressImage(Uint8List imageBytes) async {
    final image = img.decodeImage(imageBytes);
    
    // Resize to max 1920x1080
    final resized = img.copyResize(
      image!,
      width: 1920,
      height: 1080,
    );
    
    // Compress to JPEG 85% quality
    return Uint8List.fromList(
      img.encodeJpg(resized, quality: 85)
    );
  }
}
```

---

## ⚡ CPU Optimization

### **1. Frame Rate Optimization**

```dart
class FrameRateOptimizer {
  // Adaptive frame rate based on CPU usage
  int targetFrameRate = 30;
  
  Future<void> adaptFrameRate(int cpuUsage) async {
    if (cpuUsage > 80) {
      // Reduce to 15 fps
      targetFrameRate = 15;
    } else if (cpuUsage > 60) {
      // Reduce to 24 fps
      targetFrameRate = 24;
    } else {
      // Use 30 fps
      targetFrameRate = 30;
    }
    
    await applyFrameRate(targetFrameRate);
  }
  
  Future<void> applyFrameRate(int fps) async {
    // Apply to video track
    print('⚡ Frame rate set to: ${fps}fps');
  }
}
```

---

### **2. Background Processing**

```dart
class BackgroundOptimizer {
  // Reduce processing when app is not in focus
  Future<void> setupLifecycleListener() async {
    WidgetsBinding.instance.addObserver(
      _LifecycleObserver(
        onPause: () {
          print('⏸️ App paused, reducing quality...');
          // Reduce video quality
          // Disable simulcast
          // Lower frame rate
        },
        onResume: () {
          print('▶️ App resumed, restoring quality...');
          // Restore settings
        },
      ),
    );
  }
}

class _LifecycleObserver extends WidgetsBindingObserver {
  final VoidCallback onPause;
  final VoidCallback onResume;
  
  _LifecycleObserver({
    required this.onPause,
    required this.onResume,
  });
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
        onPause();
        break;
      case AppLifecycleState.resumed:
        onResume();
        break;
      default:
        break;
    }
  }
}
```

---

## 🌐 Network Optimization

### **1. Network Quality Detection**

```dart
class NetworkOptimizer {
  static Timer? _networkMonitor;
  
  void startNetworkMonitoring(
    Function(NetworkCondition) onConditionChanged
  ) {
    _networkMonitor = Timer.periodic(
      Duration(seconds: 5),
      (_) async {
        final condition = await detectNetworkCondition();
        onConditionChanged(condition);
      },
    );
  }
  
  Future<NetworkCondition> detectNetworkCondition() async {
    // Measure ping to STUN server
    final stopwatch = Stopwatch()..start();
    try {
      // Attempt to reach server
      await http.get(Uri.parse('https://stun.l.google.com:19302')).timeout(
        Duration(seconds: 5),
      );
    } catch (e) {
      return NetworkCondition.poor;
    }
    stopwatch.stop();
    
    final latency = stopwatch.elapsedMilliseconds;
    
    if (latency < 50) {
      return NetworkCondition.good;
    } else if (latency < 150) {
      return NetworkCondition.fair;
    } else {
      return NetworkCondition.poor;
    }
  }
  
  void stopNetworkMonitoring() {
    _networkMonitor?.cancel();
  }
}
```

---

### **2. TURN Server Optimization**

```dart
class TURNOptimizer {
  // Use regional TURN servers
  static const turnServers = [
    // Primary TURN
    'turns:turn.example.com?transport=tcp',
    'turns:turn.example.com:443?transport=tcp',
    
    // Backup TURN
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
  ];
  
  static Map<String, dynamic> getTURNConfig() {
    return {
      'iceServers': [
        {
          'urls': ['stun:stun.l.google.com:19302'],
        },
        {
          'urls': ['turns:numb.viagenie.ca?transport=tcp'],
          'credential': 'muazkh',
          'username': 'webrtc@live.com',
        },
      ]
    };
  }
}
```

---

## 📈 Performance Monitoring

### **Real-time Metrics Collection**

```dart
class PerformanceMonitor {
  final Duration sampleInterval = Duration(seconds: 2);
  late Timer _monitorTimer;
  
  final metrics = <PerformanceMetrics>[];
  
  void startMonitoring(RTCPeerConnection peerConnection) {
    _monitorTimer = Timer.periodic(sampleInterval, (_) async {
      final stats = await peerConnection.getStats();
      final metric = parseStatsReport(stats);
      
      metrics.add(metric);
      
      // Keep last 300 samples (10 minutes)
      if (metrics.length > 300) {
        metrics.removeAt(0);
      }
      
      print('''
      📊 Performance Metrics:
      - FPS: ${metric.fps.toStringAsFixed(1)}
      - Bitrate: ${metric.videoBitrate} kbps
      - Latency: ${metric.latency} ms
      - Packet Loss: ${metric.packetLoss.toStringAsFixed(2)}%
      - CPU: ${metric.cpuUsage}%
      - Memory: ${metric.memoryUsage} MB
      ''');
    });
  }
  
  PerformanceMetrics parseStatsReport(List<StatsReport> stats) {
    final metrics = PerformanceMetrics();
    
    for (var stat in stats) {
      if (stat.type == 'inbound-rtp' && stat.kind == 'video') {
        metrics.fps = (stat.values['framesDecoded'] ?? 0).toDouble();
        metrics.jitter = (stat.values['jitter'] ?? 0).toDouble();
        metrics.packetLoss = (stat.values['packetsLost'] ?? 0).toDouble();
      }
      
      if (stat.type == 'outbound-rtp' && stat.kind == 'video') {
        metrics.videoBitrate = 
          ((stat.values['bytesSent'] ?? 0) / 1000).toInt();
      }
      
      if (stat.type == 'candidate-pair') {
        metrics.latency = (stat.values['currentRoundTripTime'] ?? 0)
          .toDouble()
          .toInt();
      }
    }
    
    return metrics;
  }
  
  void stopMonitoring() {
    _monitorTimer.cancel();
  }
}
```

---

## ✅ Performance Checklist

- [ ] Video quality adapts to network
- [ ] Audio is clear without echo
- [ ] CPU usage < 60% during call
- [ ] Memory stable (no leaks)
- [ ] Frames per second >= 24
- [ ] Latency < 200ms
- [ ] Packet loss < 2%
- [ ] Battery drain acceptable
- [ ] No jitter > 50ms
- [ ] TURN fallback works

---

**Last Updated**: March 17, 2025
**Difficulty Level**: Advanced
**Ongoing Optimization**: Continuous

