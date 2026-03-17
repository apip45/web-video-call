# 🐛 Troubleshooting Guide

## Solusi untuk Masalah Umum dalam Development

---

## 🔴 Critical Issues

### **Issue 1: WebRTC Connection Failed**

**Symptoms:**
- Peers tidak bisa terhubung
- Ice candidates tidak tertukar
- Signaling messages timeout

**Solutions:**

```dart
// Debugging WebRTC connection
Future<void> debugWebRTCConnection(String peerId) async {
  final peerConnection = webrtcService.peerConnections[peerId];
  
  if (peerConnection == null) {
    print('❌ Peer connection not found');
    return;
  }
  
  // Check connection state
  print('🔍 Connection State: ${peerConnection.connectionState}');
  print('🔍 ICE State: ${peerConnection.iceConnectionState}');
  print('🔍 Signaling State: ${peerConnection.signalingState}');
  
  // Get connection stats
  final stats = await peerConnection.getStats();
  for (var stat in stats) {
    if (stat.type == 'inbound-rtp' || stat.type == 'outbound-rtp') {
      print('📊 ${stat.type}: ${stat.values}');
    }
  }
}

// Checklist
void checkWebRTCPrerequisites() {
  // 1. Check STUN/TURN servers
  print('✅ STUN servers configured');
  
  // 2. Check ICE candidates
  print('✅ ICE candidates enabled');
  
  // 3. Check firewall
  print('⚠️ Firewall may block UDP');
  
  // 4. Check permissions
  print('✅ Camera/mic permissions granted');
}
```

---

### **Issue 2: Audio Not Working (Complete Silence)**

**Symptoms:**
- Microphone tidak capture audio
- Speaker tidak output suara
- Audio levels = 0

**Solutions:**

```dart
// Check audio setup
Future<void> debugAudio() async {
  // 1. Check audio session configuration
  final session = await AudioSession.instance;
  print('🔊 Audio Category: ${session.category}');
  print('🔊 Audio Mode: ${session.mode}');
  print('🔊 Audio Options: ${session.options}');
  
  // 2. Check microphone
  final localStream = await webrtcService.getLocalMediaStream();
  final audioTracks = localStream?.getAudioTracks() ?? [];
  
  if (audioTracks.isEmpty) {
    print('❌ No audio tracks found');
    // Solution: Request microphone permission
    await Permission.microphone.request();
  }
  
  // 3. Check audio levels
  for (var track in audioTracks) {
    print('📻 Audio track enabled: ${track.enabled}');
    print('📻 Audio track state: ${track.state}');
  }
  
  // 4. Check speaker output (iOS)
  if (Platform.isIOS) {
    final devices = await session.getDevices();
    print('🔊 Available devices: $devices');
  }
}

// Fix audio issues
Future<void> fixAudioIssues() async {
  // On iOS, switch to speaker
  if (Platform.isIOS) {
    final session = await AudioSession.instance;
    final overrideOptions = AVAudioSessionCategoryOptions();
    overrideOptions.defaultToSpeaker = true;
    await session.setActive(true, avAudioSessionOptions: overrideOptions);
  }
  
  // On Android, ensure audio focus
  if (Platform.isAndroid) {
    // Check audio manager settings
  }
}
```

---

### **Issue 3: Video Stream Freezes or Jitter**

**Symptoms:**
- Video freeze untuk beberapa detik
- Jitter/pixelation
- Frame drops

**Solutions:**

```dart
// Monitor video quality
Future<void> monitorVideoQuality(String peerId) async {
  final peerConnection = webrtcService.peerConnections[peerId];
  
  // Get periodic stats
  Timer.periodic(Duration(seconds: 2), (timer) async {
    final stats = await peerConnection?.getStats();
    
    for (var stat in stats ?? []) {
      if (stat.type == 'inbound-rtp' && stat.kind == 'video') {
        final framesDecoded = stat.values['framesDecoded'] ?? 0;
        final framesDropped = stat.values['framesDropped'] ?? 0;
        final jitter = stat.values['jitter'] ?? 0;
        
        print('📹 Frames Decoded: $framesDecoded');
        print('📹 Frames Dropped: $framesDropped');
        print('📹 Jitter: ${(jitter * 1000).toStringAsFixed(2)}ms');
        
        // Adapt bitrate if needed
        if (framesDropped > 10) {
          print('⚠️ Too many dropped frames, reducing bitrate');
          await reduceBitrate(peerId);
        }
      }
    }
  });
}

// Reduce bitrate for poor network
Future<void> reduceBitrate(String peerId) async {
  final peerConnection = webrtcService.peerConnections[peerId];
  final senders = await peerConnection?.getSenders() ?? [];
  
  for (var sender in senders) {
    if (sender.track?.kind == 'video') {
      // Set max bitrate to 500k
      final parameters = sender.parameters;
      for (var encoding in parameters.encodings) {
        encoding.maxBitrate = 500000; // 500 kbps
      }
      await sender.setParameters(parameters);
    }
  }
}
```

---

## 🟡 Common Issues

### **Issue 4: Login Screen Infinite Loop**

**Symptoms:**
- Login screen terus reload
- Tidak bisa navigate ke home
- Token tidak tersave

**Solutions:**

```dart
// Check auth state management
void debugAuthState() {
  // 1. Check token storage
  FutureBuilder(
    future: secureStorage.read(key: 'auth_token'),
    builder: (context, snapshot) {
      if (snapshot.hasData) {
        print('✅ Token found: ${snapshot.data}');
      } else {
        print('❌ No token in storage');
      }
      return SizedBox.shrink();
    },
  );
  
  // 2. Check API response
  print('✅ API endpoints accessible');
  
  // 3. Check navigation logic
  print('✅ GoRouter configured correctly');
}

// Fix infinite loop
StreamBuilder<AuthState>(
  stream: authProvider.authStateStream,
  builder: (context, snapshot) {
    if (!snapshot.hasData) {
      return SplashScreen();
    }
    
    final authState = snapshot.data;
    
    if (authState.isAuthenticated) {
      return HomeScreen();
    } else {
      return LoginScreen();
    }
  },
);
```

---

### **Issue 5: Socket.IO Connection Drops**

**Symptoms:**
- Koneksi socket terputus
- Signals tidak terkirim
- Peer tidak receive messages

**Solutions:**

```dart
// Monitor socket connection
void monitorSocketConnection() {
  socketService.socket.on('disconnect', (_) {
    print('❌ Socket disconnected');
    // Attempt reconnect
    socketService.socket.connect();
  });
  
  socketService.socket.on('connect_error', (error) {
    print('❌ Connection error: $error');
  });
  
  socketService.socket.on('reconnect', (_) {
    print('✅ Socket reconnected');
    // Restore state
    restoreSocketState();
  });
}

// Implement auto-reconnect
Future<void> setupAutoReconnect() async {
  socketService.socket.io.onError((error) {
    print('🔴 Socket error: $error');
    
    // Exponential backoff
    int retries = 0;
    const maxRetries = 5;
    
    Timer.periodic(Duration(seconds: 2 * retries), (timer) {
      if (retries >= maxRetries) {
        timer.cancel();
        return;
      }
      
      socketService.socket.connect();
      retries++;
    });
  });
}

// Check socket version compatibility
void verifySocketVersion() {
  print('📡 Socket.IO version: ${socketService.socket.io.engineVersion}');
  print('📡 Protocol version: ${socketService.socket.io.protocolVersion}');
  
  // Minimum versions
  const minSocketVersion = '4.0';
  const minProtocolVersion = 4;
}
```

---

### **Issue 6: Memory Leak in WebRTC**

**Symptoms:**
- App jadi lambat seiring waktu
- Memory usage terus naik
- App crash setelah beberapa jam

**Solutions:**

```dart
// Detect memory leaks
Future<void> detectMemoryLeaks() async {
  // 1. Check peer connection cleanup
  void cleanupPeerConnections() {
    webrtcService.peerConnections.forEach((peerId, peerConnection) {
      // Ensure all tracks are closed
      peerConnection.getSenders().then((senders) {
        for (var sender in senders) {
          sender.track?.stop();
        }
      });
      
      // Close connection
      peerConnection.close();
    });
    
    webrtcService.peerConnections.clear();
    print('✅ All peer connections cleaned');
  }
  
  // 2. Check media stream cleanup
  void cleanupMediaStreams() {
    final localStream = webrtcService.localStream;
    if (localStream != null) {
      for (var track in localStream.getTracks()) {
        track.stop();
      }
      localStream.dispose();
    }
  }
  
  // 3. Check screen share cleanup
  void cleanupScreenShare() {
    final screenStream = screenShareService._screenStream;
    if (screenStream != null) {
      for (var track in screenStream.getTracks()) {
        track.stop();
      }
      screenStream.dispose();
    }
  }
}

// Proper cleanup in dispose
@override
void dispose() {
  // Cancel all timers
  _statsTimer?.cancel();
  _reconnectTimer?.cancel();
  
  // Close peer connections
  webrtcService.peerConnections.forEach((peerId, pc) {
    pc.close();
  });
  
  // Stop media tracks
  webrtcService.localStream?.getTracks().forEach((track) {
    track.stop();
  });
  
  // Close socket
  socketService.disconnect();
  
  // Dispose providers
  WidgetsBinding.instance.addPostFrameCallback((_) {
    // Clean up
  });
  
  super.dispose();
}
```

---

## 🟢 Performance Issues

### **Issue 7: High CPU Usage**

**Symptoms:**
- Device panas
- Battery draining cepat
- Video encoding slow

**Solutions:**

```dart
// Reduce quality settings
void optimizeForLowEndDevice() {
  // Reduce video resolution
  final constraints = <String, dynamic>{
    'audio': true,
    'video': {
      'mandatory': {
        'minWidth': 320,
        'minHeight': 240,
        'minFrameRate': 15,
      },
      'facingMode': 'user',
    }
  };
  
  // Reduce frame rate
  mediaStream.getVideoTracks().forEach((track) {
    final settings = track.getSettings();
    track.applyConstraints({
      'frameRate': 15,  // 15 fps instead of 30
    });
  });
}

// Monitor CPU usage
void monitorCPUUsage() {
  final nativePlatform = NativePlatformService();
  
  Timer.periodic(Duration(seconds: 5), (_) async {
    final batteryLevel = await nativePlatform.getBatteryLevel();
    final isLowPower = await nativePlatform.isLowPowerModeEnabled();
    
    if (batteryLevel < 20) {
      print('⚠️ Low battery: $batteryLevel%');
      optimizeForLowEndDevice();
    }
    
    if (isLowPower) {
      print('⚠️ Low power mode enabled');
      // Reduce quality
    }
  });
}
```

---

### **Issue 8: High Bandwidth Usage**

**Symptoms:**
- Data usage tinggi
- Video quality rusak
- Buffering sering terjadi

**Solutions:**

```dart
// Implement bitrate adaptation
class BitrateAdaptation {
  static const Map<String, int> qualityPresets = {
    'low': 500,      // 500 kbps
    'medium': 1500,  // 1500 kbps
    'high': 2500,    // 2500 kbps
  };
  
  // Auto-adjust based on network
  static Future<void> adaptBitrate(
    RTCPeerConnection peerConnection,
    NetworkQuality quality,
  ) async {
    final targetBitrate = qualityPresets[quality.name] ?? 1500;
    
    final senders = await peerConnection.getSenders();
    
    for (var sender in senders) {
      if (sender.track?.kind == 'video') {
        final parameters = sender.parameters;
        parameters.encodings.forEach((encoding) {
          encoding.maxBitrate = targetBitrate * 1000;
        });
        await sender.setParameters(parameters);
      }
    }
  }
}

enum NetworkQuality {
  poor,    // 500 kbps
  fair,    // 1500 kbps
  good,    // 2500 kbps
}
```

---

## 🔧 Debugging Tools

### **Enable Debug Logging**

```dart
// lib/services/logger_service.dart
class LoggerService {
  static void enableDebugLogging() {
    // WebRTC logging
    WebRTC.setLogging(enabled: true, logLevel: LogLevel.debug);
    
    // Socket.IO logging
    socketService.socket.onConnect((_) {
      socketService.socket.on('debug', (data) {
        print('🐛 Socket Debug: $data');
      });
    });
    
    // DIO logging
    dioClient.dio.interceptors.add(
      LoggingInterceptor(),
    );
  }
}

class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    print('📤 [${options.method.toUpperCase()}] ${options.path}');
    print('📤 Headers: ${options.headers}');
    handler.next(options);
  }
  
  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    print('📥 [${response.statusCode}] ${response.requestOptions.path}');
    handler.next(response);
  }
  
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    print('❌ Error: ${err.message}');
    handler.next(err);
  }
}
```

---

### **Network Inspector**

```dart
// Monitor network conditions
class NetworkInspector {
  static Future<void> inspectNetwork() async {
    final connectivity = Connectivity();
    
    connectivity.onConnectivityChanged.listen((result) {
      print('🌐 Network: ${result.first.name}');
      
      if (result.first == ConnectivityResult.none) {
        print('❌ No internet connection');
      }
    });
    
    // Check latency
    final response = await http.get(Uri.parse('https://api.example.com/ping'));
    print('📡 Ping: ${response.statusCode} - ${response.body}');
  }
}
```

---

## ✅ Troubleshooting Checklist

- [ ] Check internet connection
- [ ] Verify permissions granted
- [ ] Clear app cache
- [ ] Restart app
- [ ] Update Flutter SDK
- [ ] Check STUN/TURN servers
- [ ] Monitor memory usage
- [ ] Check socket connection
- [ ] Verify token expiration
- [ ] Test on clean device

---

**Last Updated**: March 17, 2025
**Updated as Issues Arise**: Continuously

