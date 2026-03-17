# 🚀 Deployment Guide - Build & Publish Flutter App

## Complete Deployment Guide untuk Production

Panduan lengkap untuk build aplikasi dan publish ke Google Play Store dan Apple App Store.

---

## 📋 Pre-Deployment Checklist

### **Code Quality**
- [ ] All tests passing
- [ ] No lint warnings
- [ ] Code formatted
- [ ] No hardcoded secrets
- [ ] Error handling complete
- [ ] Logging in place

### **Performance**
- [ ] No memory leaks
- [ ] No unnecessary rebuilds
- [ ] Images optimized
- [ ] Assets minimized
- [ ] Load time acceptable

### **Security**
- [ ] API calls use HTTPS
- [ ] Tokens stored securely
- [ ] No sensitive data in logs
- [ ] Permissions handled
- [ ] CORS properly configured

---

## 🏗️ Build Setup

### **1. App Configuration**

File: `pubspec.yaml`

```yaml
name: webrtc_app
description: Professional WebRTC video call application
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  # ... production dependencies only
  
dev_dependencies:
  flutter_test:
    sdk: flutter
  # ... dev dependencies only
```

### **2. Android Configuration**

File: `android/app/build.gradle.kts`

```gradle
android {
    namespace = "com.example.webrtcapp"
    compileSdk = 34
    
    defaultConfig {
        applicationId = "com.example.webrtcapp"
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    
    // Signing configuration for release
    signingConfigs {
        create("release") {
            storeFile = file("C:/path/to/keystore.jks")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KEY_ALIAS")
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }
    
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs["release"]
        }
    }
}
```

### **3. iOS Configuration**

File: `ios/Runner/Info.plist`

```xml
<dict>
    <key>CFBundleName</key>
    <string>WebRTC App</string>
    
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    
    <key>CFBundleVersion</key>
    <string>1</string>
    
    <!-- Permissions -->
    <key>NSCameraUsageDescription</key>
    <string>This app needs camera access for video calls</string>
    
    <key>NSMicrophoneUsageDescription</key>
    <string>This app needs microphone access for audio calls</string>
    
    <!-- ... other keys -->
</dict>
```

---

## 🔑 Signing Keys

### **Android: Generate Keystore**

```bash
# Generate signing key
keytool -genkey -v \
  -keystore ~/upload-keystore.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10950 \
  -alias upload

# Enter your information when prompted
# Keep this file safe and private!

# Reference in gradle (via environment variables)
```

### **iOS: Certificate Setup**

```bash
# Use Apple Developer Account
# 1. Go to Apple Developer portal
# 2. Create App ID
# 3. Create distribution certificate
# 4. Create provisioning profile
# 5. Download certificates
# 6. Install in Keychain

# Or use Xcode to manage
# Xcode > Settings > Accounts
# Select team
# Manage Certificates
```

---

## 🔨 Building for Release

### **Android APK/AAB**

```bash
# Build APK (for testing)
flutter build apk --release

# Output: build/app/outputs/flutter-apk/app-release.apk

# Build App Bundle (for Play Store)
flutter build appbundle --release

# Output: build/app/outputs/bundle/release/app-release.aab

# With specific parameters
flutter build appbundle \
  --release \
  --target-platform android-arm64 \
  --suppress-analytics
```

### **iOS App**

```bash
# Build for archive
flutter build ios --release

# Or use Xcode
open ios/Runner.xcworkspace

# In Xcode:
# 1. Select "Any iOS Device (arm64)" scheme
# 2. Product > Archive
# 3. Upload to App Store

# Or use Flutter
cd ios
pod install
xcodebuild -workspace Runner.xcworkspace \
  -scheme Runner \
  -configuration Release \
  -derivedDataPath build \
  -arch arm64 \
  build
```

---

## 📦 Versioning

### **Semantic Versioning**

Format: `major.minor.patch+buildNumber`

```
1.0.0+1     (Version 1.0.0, build 1)
1.1.0+2     (Version 1.1.0, build 2)
2.0.0+10    (Version 2.0.0, build 10)
```

Update in `pubspec.yaml`:

```yaml
version: 1.0.0+1

# After update:
version: 1.0.1+2
```

Also update Android/iOS:

```gradle
// Android build.gradle.kts
versionCode = 2        // Must be higher than previous
versionName = "1.0.1"
```

---

## 🎯 Google Play Store Deployment

### **Step 1: Create Developer Account**

- Go to Google Play Console
- Pay $25 registration fee
- Complete developer profile

### **Step 2: Create App Entry**

1. Google Play Console dashboard
2. Create new application
3. Fill in:
   - App name
   - Default language
   - App type (application)
   - Category (communications)

### **Step 3: Prepare App Bundle**

```bash
# Build release AAB
flutter build appbundle --release

# File: build/app/outputs/bundle/release/app-release.aab
```

### **Step 4: Create Release**

In Google Play Console:

1. **Testing Tracks**:
   - Internal Testing → Upload AAB → Test with 50 testers
   - Closed Testing → Expand to closed testers
   - Open Testing → Release to wider audience

2. **Details**:
   - Release notes
   - Screenshots (min. 2)
   - Feature graphic (1024x500)
   - App description
   - Category
   - Contact info

3. **Store Listing**:
   - Short description
   - Full description
   - Screenshots
   - Privacy policy
   - User rights

4. **Content Rating**:
   - Fill questionnaire
   - Get content rating

5. **Pricing & Distribution**:
   - Price (free or paid)
   - Countries
   - Restricted content

### **Step 5: Review & Publish**

- Google reviews (24-48 hours)
- Fix any issues
- Publish to Production

---

## 🍎 App Store Deployment

### **Step 1: Prepare**

- Apple Developer Account ($99/year)
- App identifier (bundle ID)
- Distribution certificate
- Provisioning profile

### **Step 2: Create App Record**

In App Store Connect:

1. Create new app
2. Fill in:
   - App name
   - Primary language
   - Bundle ID
   - SKU
   - Category

### **Step 3: Build & Archive**

```bash
# Build iOS
flutter build ios --release

# Or via Xcode
cd ios
xcodebuild -workspace Runner.xcworkspace \
  -scheme Runner \
  -configuration Release \
  -archivePath build/Runner.xcarchive \
  archive
```

### **Step 4: Submit for Review**

In Xcode:
1. Product > Archive
2. Distribute App
3. App Store Connect
4. Upload Certificate (if needed)
5. Select App Record
6. Configure options
7. Submit

Or use Transporter app:
1. Download from App Store
2. Drag & drop .ipa file
3. Submit

### **Step 5: App Review**

- Submit for review
- Usually 24-48 hours (can be 5+ days)
- Fix any rejections
- Resubmit

### **Step 6: Release**

- Check status on App Store Connect
- Configure phased release (optional)
- Publish to App Store

---

## 📊 Post-Deployment

### **Monitoring**

```dart
// Firebase Crashlytics
await FirebaseCrashlytics.instance.recordError(error, stack);

// Google Analytics
analytics.logEvent(
  name: 'call_completed',
  parameters: {
    'duration': callDuration,
    'bitrate': averageBitrate,
  },
);
```

### **Analytics Setup**

```bash
# Add Firebase
flutter pub add firebase_core firebase_analytics firebase_crashlytics

# Configure in main.dart
await Firebase.initializeApp();

# Enable Crashlytics for release only
FirebaseCrashlytics.instance.sendUnsentReports();
```

### **Update Tracking**

```dart
// In-app update for Android
final inAppUpdate = InAppUpdate();

Future<void> checkForUpdate() async {
  try {
    await inAppUpdate.checkForUpdate();
  } catch (e) {
    print('❌ Error checking for update: $e');
  }
}
```

---

## 🔐 Security Checklist

### **Before Release**
- [ ] Remove debug print statements
- [ ] Remove hardcoded credentials
- [ ] Enable obfuscation (Android)
- [ ] Enable bitcode (iOS)
- [ ] Use HTTPS for all API calls
- [ ] Implement certificate pinning (optional)
- [ ] Remove test accounts/data
- [ ] Review privacy policy
- [ ] Update backend for production API

### **Environment Configuration**

```dart
// lib/config/environment.dart
enum Environment { development, production }

class EnvironmentConfig {
  static const Environment environment = 
    kReleaseMode ? Environment.production : Environment.development;
  
  static String get apiBaseUrl {
    switch (environment) {
      case Environment.development:
        return 'http://10.0.2.2:3000';
      case Environment.production:
        return 'https://api.yourdomain.com';
    }
  }
  
  static bool get enableLogging {
    return environment == Environment.development;
  }
}
```

---

## 📋 Release Notes Template

```markdown
# Version 1.0.0 - Initial Release

## What's New
- 🎥 1-vs-1 video calling
- 🎤 High-quality audio
- 📊 Call statistics
- 👨‍💼 Admin controls
- 🔐 Secure authentication

## Improvements
- Optimized WebRTC implementation
- Reduced latency
- Improved UI/UX

## Bug Fixes
- Fixed camera switching issue
- Fixed audio routing on mute
- Fixed connection stability

## Known Issues
- Screen sharing coming in v1.1

---

* Requires Android 5.0+ / iOS 11.0+
* Internet connection required
```

---

## 🚀 Deployment Timeline

```
Week 1:
- Setup signing keys
- Configure stores
- Create app entries

Week 2:
- Build release versions
- Internal testing
- Bug fixes

Week 3:
- Submit to stores
- Handle reviews
- Fix rejections

Week 4:
- Publish to production
- Monitor metrics
- Release notes
```

---

## ✅ Post-Launch Checklist

- [ ] App live on Play Store
- [ ] App live on App Store
- [ ] Admin dashboard working
- [ ] Analytics tracking
- [ ] Crashlytics active
- [ ] Support system ready
- [ ] User feedback channel
- [ ] Update roadmap published

---

**Last Updated**: March 17, 2025
**Status**: Complete Deployment Guide
**Target Audiences**: Google Play Store + Apple App Store

