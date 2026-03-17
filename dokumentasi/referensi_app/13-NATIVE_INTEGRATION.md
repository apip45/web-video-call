# 🔌 Native Integration & Platform Specifics

## Integrasi Native Android/iOS dengan Flutter

---

## 🤖 Android Native Integration

### **Accessing Native Android APIs**

#### **1. Permission Handling dengan Native Code**

```dart
// lib/services/native_platform.dart
import 'package:flutter/services.dart';

class NativePlatformService {
  static const platform = MethodChannel('com.videocall.app/native');
  
  // Request camera permission natively
  Future<bool> requestCameraPermission() async {
    try {
      final bool result = await platform.invokeMethod('requestCameraPermission');
      return result;
    } catch (e) {
      print('Error requesting camera permission: $e');
      return false;
    }
  }
  
  // Request microphone permission natively
  Future<bool> requestMicrophonePermission() async {
    try {
      final bool result = await platform.invokeMethod('requestMicrophonePermission');
      return result;
    } catch (e) {
      print('Error requesting microphone permission: $e');
      return false;
    }
  }
  
  // Request location device permission
  Future<bool> requestLocationPermission() async {
    try {
      final bool result = await platform.invokeMethod('requestLocationPermission');
      return result;
    } catch (e) {
      return false;
    }
  }
  
  // Get battery level
  Future<int> getBatteryLevel() async {
    try {
      final int batteryLevel = await platform.invokeMethod('getBatteryLevel');
      return batteryLevel;
    } catch (e) {
      print('Error getting battery level: $e');
      return -1;
    }
  }
  
  // Enable low power mode detection
  Future<bool> isLowPowerModeEnabled() async {
    try {
      final bool result = await platform.invokeMethod('isLowPowerModeEnabled');
      return result;
    } catch (e) {
      return false;
    }
  }
}
```

---

#### **2. Native Android Code (Kotlin)**

```kotlin
// android/app/src/main/kotlin/com/videocall/app/NativePlatform.kt

package com.videocall.app

import android.Manifest
import android.content.Context
import android.os.BatteryManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.dart.DartExecutor
import io.flutter.plugin.common.MethodChannel

class NativePlatformManager(private val context: Context) {
    companion object {
        private const val CHANNEL = "com.videocall.app/native"
    }
    
    fun setupMethodChannel(flutterEngine: FlutterEngine) {
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "requestCameraPermission" -> {
                        val hasPermission = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.CAMERA
                        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                        
                        if (!hasPermission) {
                            ActivityCompat.requestPermissions(
                                (context as android.app.Activity),
                                arrayOf(Manifest.permission.CAMERA),
                                101
                            )
                        }
                        result.success(hasPermission)
                    }
                    
                    "requestMicrophonePermission" -> {
                        val hasPermission = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.RECORD_AUDIO
                        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                        
                        if (!hasPermission) {
                            ActivityCompat.requestPermissions(
                                (context as android.app.Activity),
                                arrayOf(Manifest.permission.RECORD_AUDIO),
                                102
                            )
                        }
                        result.success(hasPermission)
                    }
                    
                    "getBatteryLevel" -> {
                        val batteryManager = context.getSystemService(
                            Context.BATTERY_SERVICE
                        ) as BatteryManager
                        
                        val level = batteryManager.getIntProperty(
                            BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER
                        )
                        result.success(level)
                    }
                    
                    "isLowPowerModeEnabled" -> {
                        val powerManager = context.getSystemService(
                            Context.POWER_SERVICE
                        ) as android.os.PowerManager
                        
                        val isLowPower = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            powerManager.isPowerSaveMode
                        } else {
                            false
                        }
                        result.success(isLowPower)
                    }
                    
                    else -> result.notImplemented()
                }
            }
    }
}
```

---

#### **3. MainActivity Setup**

```kotlin
// android/app/src/main/kotlin/com/videocall/app/MainActivity.kt

package com.videocall.app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity: FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        // Setup native platform manager
        NativePlatformManager(this).setupMethodChannel(flutterEngine)
    }
}
```

---

### **AndroidManifest.xml Configuration**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.videocall.app">
    
    <!-- Essential Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    
    <!-- Network Permission -->
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CHANGE_NETWORK_STATE" />
    
    <!-- Low Power Mode Detection -->
    <uses-permission android:name="android.permission.BATTERY_STATS" />
    
    // Features required
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    
    <application>
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme">
            
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            
            <!-- Deep linking -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="videocall" android:host="room" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

---

## 🍎 iOS Native Integration

### **Accessing Native iOS APIs**

#### **1. Method Channel untuk iOS**

```swift
// ios/Runner/NativePlatform.swift

import Flutter

class NativePlatformManager {
    static let CHANNEL = "com.videocall.app/native"
    
    static func setupMethodChannel(controller: FlutterViewController) {
        let methodChannel = FlutterMethodChannel(
            name: CHANNEL,
            binaryMessenger: controller.binaryMessenger
        )
        
        methodChannel.setMethodCallHandler { call, result in
            switch call.method {
            case "requestCameraPermission":
                requestCameraPermission(result: result)
                
            case "requestMicrophonePermission":
                requestMicrophonePermission(result: result)
                
            case "getBatteryLevel":
                let batteryLevel = UIDevice.current.batteryLevel
                result(Int(batteryLevel * 100))
                
            case "isLowPowerModeEnabled":
                let isLowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
                result(isLowPower)
                
            default:
                result(FlutterMethodNotImplemented)
            }
        }
    }
    
    private static func requestCameraPermission(result: @escaping FlutterResult) {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            result(granted)
        }
    }
    
    private static func requestMicrophonePermission(result: @escaping FlutterResult) {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            result(granted)
        }
    }
}
```

---

#### **2. GeneratedPluginRegistrant Setup**

```swift
// ios/Runner/GeneratedPluginRegistrant.m

#import <Flutter/Flutter.h>

@interface GeneratedPluginRegistrant : NSObject
+ (void)registerWithRegistry:(NSObject<FlutterPluginRegistry>*)registry;
@end

@implementation GeneratedPluginRegistrant
+ (void)registerWithRegistry:(NSObject<FlutterPluginRegistry>*)registry {
    [FlutterWebRtcPlugin registerWithRegistry:registry];
    [permission_handlerPlugin registerWithRegistry:registry];
    [flutter_secure_storagePlugin registerWithRegistry:registry];
}
@end
```

---

### **Info.plist Configuration**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Video Call App</string>
    
    <!-- Camera Permission -->
    <key>NSCameraUsageDescription</key>
    <string>We need access to your camera to enable video calls.</string>
    
    <!-- Microphone Permission -->
    <key>NSMicrophoneUsageDescription</key>
    <string>We need access to your microphone for audio during calls.</string>
    
    <!-- Local Network Permission (iOS 14+) -->
    <key>NSLocalNetworkUsageDescription</key>
    <string>We need access to local network for peer discovery.</string>
    
    <key>NSBonjourServices</key>
    <array>
        <string>_videocall._tcp</string>
        <string>_videocall._udp</string>
    </array>
    
    <!-- Multimedia Settings -->
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>arkit</string>
        <string>microphone</string>
    </array>
    
    <!-- Support Background Processing -->
    <key>UIBackgroundModes</key>
    <array>
        <string>voip</string>
        <string>remote-notification</string>
    </array>
    
    <!-- Minimum iOS Version -->
    <key>MinimumOSVersion</key>
    <string>12.0</string>
    
    <!-- Dark Mode Support -->
    <key>UIUserInterfaceStyle</key>
    <string>Automatic</string>
</dict>
</plist>
```

---

## 🔊 Audio Session Management

### **Dart Audio Session Setup**

```dart
import 'package:audio_session/audio_session.dart';

class AudioSessionManager {
  static final AudioSessionManager _instance = AudioSessionManager._internal();
  
  factory AudioSessionManager() => _instance;
  
  AudioSessionManager._internal();
  
  // Configure audio session
  Future<void> configureAudioSession() async {
    final session = await AudioSession.instance;
    
    // iOS: Configure for voice communication
    if (Platform.isIOS) {
      await session.configure(
        AudioSessionConfiguration.voiceChat(),
      );
    }
    
    // Android: Configure for communication
    if (Platform.isAndroid) {
      await session.configure(
        AudioSessionConfiguration.speech(),
      );
    }
    
    // Listen for changes
    session.devicesStream.listen((devices) {
      print('Available audio devices: $devices');
    });
  }
  
  // Set audio output (speaker/earpiece)
  Future<void> setAudioOutput(AudioOutput output) async {
    final session = await AudioSession.instance;
    if (Platform.isIOS) {
      await session.setActive(true, avAudioSessionOptions: AVAudioSessionOptions.defaultToSpeaker);
    }
  }
  
  // Enable speaker output
  Future<void> enableSpeakerOutput() async {
    final session = await AudioSession.instance;
    if (Platform.isIOS) {
      final overrideOptions = AVAudioSessionCategoryOptions();
      overrideOptions.defaultToSpeaker = true;
      await session.setActive(true, avAudioSessionOptions: overrideOptions);
    }
  }
  
  // Disable speaker (use earpiece)
  Future<void> disableSpeakerOutput() async {
    final session = await AudioSession.instance;
    if (Platform.isIOS) {
      final overrideOptions = AVAudioSessionCategoryOptions();
      overrideOptions.defaultToSpeaker = false;
      await session.setActive(true, avAudioSessionOptions: overrideOptions);
    }
  }
}
```

---

## 🔗 Deep Linking Setup

### **Android Deep Links**

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    
    <!-- Handle links like: videocall://room/room123 -->
    <data
        android:scheme="videocall"
        android:host="room"
        android:pathPattern="/.*" />
    
    <!-- Handle https links -->
    <data
        android:scheme="https"
        android:host="videocall.app"
        android:pathPrefix="/join" />
</intent-filter>
```

---

### **iOS Deep Links**

```xml
<!-- ios/Runner/Info.plist -->
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>video-call-app</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>videocall</string>
        </array>
    </dict>
</array>
```

---

### **GoRouter Deep Link Handling**

```dart
// lib/router/app_router.dart
final goRouter = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => HomeScreen(),
    ),
    GoRoute(
      path: '/room/:roomId',
      builder: (context, state) {
        final roomId = state.pathParameters['roomId'];
        return RoomScreen(roomId: roomId!);
      },
    ),
  ],
  redirect: (context, state) {
    // Handle deep links
    if (state.location.startsWith('/room/')) {
      return state.location;
    }
    return null;
  },
);
```

---

## 📱 Platform-Specific Handling

### **Platform Check Service**

```dart
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';

class PlatformService {
  static final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();
  
  // Get platform info
  static Future<PlatformInfo> getPlatformInfo() async {
    if (Platform.isAndroid) {
      final androidInfo = await _deviceInfo.androidInfo;
      return PlatformInfo(
        platform: 'Android',
        version: androidInfo.version.release,
        model: androidInfo.model,
        manufacturer: androidInfo.manufacturer,
      );
    } else if (Platform.isIOS) {
      final iosInfo = await _deviceInfo.iosInfo;
      return PlatformInfo(
        platform: 'iOS',
        version: iosInfo.systemVersion,
        model: iosInfo.model,
        manufacturer: 'Apple',
      );
    }
    
    throw UnsupportedError('Unsupported platform');
  }
  
  // Check if device supports required features
  static Future<bool> supportsRequiredFeatures() async {
    final info = await getPlatformInfo();
    
    if (Platform.isAndroid) {
      // Check minimum Android version 8
      return int.parse(info.version.split('.').first) >= 8;
    } else if (Platform.isIOS) {
      // Check minimum iOS version 12
      return double.parse(info.version.split('.').take(2).join('.')) >= 12;
    }
    
    return false;
  }
}

class PlatformInfo {
  final String platform;
  final String version;
  final String model;
  final String manufacturer;
  
  PlatformInfo({
    required this.platform,
    required this.version,
    required this.model,
    required this.manufacturer,
  });
}
```

---

## 🧪 Testing Native Code

```dart
void main() {
  group('Native Platform Tests', () {
    late NativePlatformService nativePlatform;
    
    setUp(() {
      nativePlatform = NativePlatformService();
    });
    
    test('Request camera permission', () async {
      final result = await nativePlatform.requestCameraPermission();
      expect(result, isA<bool>());
    });
    
    test('Get battery level', () async {
      final level = await nativePlatform.getBatteryLevel();
      expect(level, greaterThanOrEqualTo(0));
      expect(level, lessThanOrEqualTo(100));
    });
    
    test('Check platform support', () async {
      final supported = await PlatformService.supportsRequiredFeatures();
      expect(supported, true);
    });
  });
}
```

---

## 🐛 Common Platform Issues & Solutions

### **Issue 1: Camera Permission on Android**
```dart
// Solution: Handle runtime permissions
Future<void> handleCameraPermission() async {
  if (Platform.isAndroid) {
    if (await Permission.camera.isDenied) {
      final status = await Permission.camera.request();
      if (status.isDenied) {
        openAppSettings();
      }
    }
  }
}
```

### **Issue 2: Audio Session Conflicts (iOS)**
```swift
// Solution: Properly configure audio session
let session = AVAudioSession.sharedInstance()
do {
    try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.duckOthers, .defaultToSpeaker])
    try session.setActive(true, options: .notifyOthersOnDeactivation)
} catch {
    print("Audio session error: \(error)")
}
```

### **Issue 3: Low Power Mode Impact**
```dart
// Solution: Detect and adapt quality
Future<void> adaptToLowPowerMode() async {
  final nativePlatform = NativePlatformService();
  final isLowPower = await nativePlatform.isLowPowerModeEnabled();
  
  if (isLowPower) {
    // Reduce video quality
    // Disable background audio
    // Reduce frame rate
  }
}
```

---

**Last Updated**: March 17, 2025
**Difficulty Level**: Advanced
**Estimated Implementation Time**: 2-3 days

