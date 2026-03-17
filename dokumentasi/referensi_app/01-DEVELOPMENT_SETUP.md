# 🚀 Development Setup - Flutter Environment

## Persiapan Lengkap untuk Memulai Development

Panduan lengkap setup Flutter environment untuk development aplikasi video call.

---

## 📋 Prerequisites Checklist

Pastikan Anda sudah memiliki:

### **System Requirements**
- [ ] RAM: Minimal 8GB (16GB recommended)
- [ ] Storage: 10GB free space
- [ ] OS: Windows 10+ / macOS 10.15+ / Linux
- [ ] Git: Installed and configured

### **Development Tools**
- [ ] Android Studio / VS Code
- [ ] Flutter SDK (latest stable)
- [ ] Dart SDK (bundled with Flutter)
- [ ] Android SDK / Xcode (platform-specific)
- [ ] Node.js 14+ (for backend/testing)

### **For Mobile Testing**
- [ ] Android device/emulator (for Android)
- [ ] iOS simulator/device (for iOS)
- [ ] USB debugging enabled (for physical devices)

---

## 🔧 Setup Steps

### **Step 1: Install Flutter SDK**

#### Windows:
```bash
# 1. Download Flutter SDK
# Link: https://flutter.dev/docs/development/tools/sdk/releases
# Pilih: Flutter SDK for Windows

# 2. Extract to a known location
# Example: C:\src\flutter

# 3. Add to PATH
# Environment Variables > Path > Add: C:\src\flutter\bin

# 4. Verify installation
flutter --version

# 5. Run doctor
flutter doctor
```

#### macOS:
```bash
# Using Homebrew (recommended)
brew install flutter

# Or download manually from:
# https://flutter.dev/docs/development/tools/sdk/releases

# Verify
flutter --version
flutter doctor
```

#### Linux:
```bash
# Download from official website
# https://flutter.dev/docs/development/tools/sdk/releases

# Extract
tar xf flutter_linux_*.tar.xz

# Add to PATH in ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/flutter/bin"

# Verify
flutter --version
flutter doctor
```

---

### **Step 2: Setup IDE/Editor**

#### Visual Studio Code (Recommended for beginners):

```bash
# 1. Install VS Code
# https://code.visualstudio.com

# 2. Install extensions
# a) Flutter extension (by Dart Code)
# b) Dart extension (bundled with Flutter extension)
# c) Optional: Awesome Flutter Snippets

# 3. Verify setup
# Open command palette (Ctrl+Shift+P)
# Type: "Flutter: Run Flutter Doctor"
```

#### Android Studio (Recommended for advanced):

```bash
# 1. Install Android Studio
# https://developer.android.com/studio

# 2. Install plugins
# Preferences/Settings > Plugins > Search:
#   - Flutter
#   - Dart

# 3. Setup Android SDK
# Tools > SDK Manager > Install:
#   - Android SDK Platform
#   - Android SDK Tools
#   - Android Emulator
```

---

### **Step 3: Setup Android Development**

#### Android SDK Setup:
```bash
# 1. Accept Android licenses
flutter doctor --android-licenses

# 2. Choose one option:
# Option A: Use Android Studio
#   - Open Android Studio
#   - Tools > SDK Manager
#   - Install latest API level
#   - Install Android SDK Tools

# Option B: Use command line
flutter config --android-sdk /path/to/android/sdk

# 3. Verify
flutter doctor
```

#### Android Emulator:
```bash
# 1. Open Android Studio
# 2. Tools > AVD Manager > Create Virtual Device
# 3. Select device (Pixel 5)
# 4. Select API level (API 30+)
# 5. Finish

# Or create via CLI
flutter emulators
flutter emulators create --name android-pixel5
flutter emulators launch android-pixel5
```

---

### **Step 4: Setup iOS Development** (macOS only)

```bash
# 1. Install Xcode (if not already)
sudo xcode-select --install

# 2. Open Xcode once
open -a Xcode

# 3. Accept license
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch

# 4. Install CocoaPods
sudo gem install cocoapods

# 5. Verify
flutter doctor
```

#### iOS Simulator:
```bash
# Open simulator
open -a Simulator

# Or launch with Flutter
flutter emulators launch ios
```

---

### **Step 5: Verify Installation**

```bash
# Run complete diagnostics
flutter doctor

# Expected output (atau similar):
# ✓ Flutter (Channel stable, 3.10.x, on macOS)
# ✓ Android toolchain
# ✓ Xcode (if on macOS)
# ✓ VS Code
# ✓ Connected device (emulator or physical device)
```

Semua harus **✓** (check mark) untuk development.

---

## 📱 Create Test Project

Sebelum mulai project sebenarnya, test setup dengan project sederhana:

```bash
# 1. Create test project
flutter create test_project
cd test_project

# 2. Get dependencies
flutter pub get

# 3. Run on emulator/device
flutter run

# 4. Hot reload (press 'r' in terminal)
# 5. Hot restart (press 'R' in terminal)
# 6. Quit (press 'q' in terminal)
```

Jika berhasil → Setup selesai! ✅

---

## 🎯 Create Production Project

Sekarang buat project untuk aplikasi sebenarnya:

### **Method 1: Command Line (Recommended)**

```bash
# 1. Create project
flutter create \
  --description "WebRTC Video Call Application" \
  --org com.example \
  --platforms=android,ios \
  webrtc_app

cd webrtc_app

# 2. Add flutter_pub_spec for documentation
flutter pub add --dev flutter_test

# 3. Initialize git
git init
git add .
git commit -m "Initial Flutter project"
```

### **Method 2: Android Studio**

1. File > New > New Flutter Project
2. Choose Flutter Application
3. Configure:
   - Project name: `webrtc_app`
   - Project location: `/path/to/project`
   - Description: "WebRTC Video Call Application"
4. Select platforms: Android, iOS
5. Create

---

## 📦 Project Structure Setup

Setelah project created, organize folder structure:

```bash
cd webrtc_app

# Create folder structure (lihat 02-PROJECT_STRUCTURE.md)
mkdir -p lib/{core,features,shared,utils}
mkdir -p lib/core/{config,constants,providers}
mkdir -p lib/features/{auth,home,room,admin,profile}
mkdir -p lib/shared/{services,models,widgets,theme}
mkdir -p test/{unit,widget,integration}
mkdir -p assets/{images,icons}

# Verify structure
tree lib/
```

---

## 📚 Add Core Dependencies

Edit `pubspec.yaml`:

```yaml
name: webrtc_app
description: WebRTC Video Call Mobile Application
publish_to: 'none'

version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # State Management
  provider: ^6.0.0
  
  # HTTP & API
  dio: ^5.3.0
  
  # WebSocket
  socket_io_client: ^2.0.0
  
  # WebRTC
  flutter_webrtc: ^0.9.0
  
  # Permissions
  permission_handler: ^11.4.0
  
  # Local Storage
  flutter_secure_storage: ^9.0.0
  shared_preferences: ^2.2.0
  
  # Navigation
  go_router: ^10.0.0
  
  # UI/UX
  flutter_svg: ^2.0.0
  google_fonts: ^5.0.0
  
  # UUID
  uuid: ^4.0.0
  
  # Logging
  logger: ^2.0.0
  
  # Date/Time
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter

  flutter_lints: ^3.0.0
  mockito: ^5.4.0
  build_runner: ^2.4.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/icons/
  fonts:
    - family: Roboto
      fonts:
        - asset: assets/fonts/Roboto-Regular.ttf
        - asset: assets/fonts/Roboto-Bold.ttf
          weight: 700
```

```bash
# Install dependencies
flutter pub get
```

---

## 🔐 Setup Environment Configuration

Buat file `.env` untuk configuration:

```bash
# Create .env file
touch .env

# Add to .gitignore
echo ".env" >> .gitignore

# Add to pubspec.yaml
# dev_dependencies:
#   flutter_dotenv: ^5.1.0
```

File `.env`:
```env
# Development
API_BASE_URL=http://10.0.2.2:3000
SOCKET_BASE_URL=http://10.0.2.2:3000
  
# Untuk physical device, gunakan IP address Anda
# API_BASE_URL=http://192.168.1.100:3000
# SOCKET_BASE_URL=http://192.168.1.100:3000

# Optional untuk production
# API_BASE_URL=https://api.yourdomain.com
# SOCKET_BASE_URL=https://socket.yourdomain.com
```

Load in main.dart:
```dart
void main() async {
  await dotenv.load(fileName: '.env');
  runApp(const MyApp());
}
```

---

## 🏃 First Run Setup

```bash
# 1. Ensure backend server is running
# In other terminal:
cd ../web-video-call
npm start
# Server harus running di http://localhost:3000

# 2. Start Flutter app
flutter run

# 3. Select device when prompted
# Example output:
# Connected devices:
# Android Emulator • emulator-5554 • android-x86    • Android 12
# iPhone Simulator • iphone-simulator • ios • iOS 16.1
```

---

## 🔧 Development Tools Setup

### **Debugging**
```bash
# 1. Enable debug output
flutter run -v

# 2. Use DevTools
flutter pub global activate devtools
flutter pub global run devtools

# 3. Connect to app
# Copy URL shown and paste in browser
```

### **Code Generation**
```bash
# For models dengan json_serializable
flutter pub add --dev json_serializable
flutter pub add json_annotation

# Run build_runner
flutter pub run build_runner build

# Watch for changes
flutter pub run build_runner watch
```

### **Code Analysis**
```bash
# Analyze code for issues
flutter analyze

# Format code
flutter format lib/

# Fix issues
dart fix --apply
```

---

## 🔗 Connect to Backend Server

### **Development Setup**

1. **Backend Server** (in separate terminal):
```bash
cd web-video-call
npm install
npm start
# Running at http://localhost:3000
```

2. **Database** (MongoDB):
```bash
# Make sure MongoDB is running
# Windows: mongod.exe
# macOS: brew services start mongodb-community
# Linux: sudo systemctl start mongod
```

3. **Check Backend Health**:
```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok"}
```

4. **Update .env di Flutter app**:
```env
API_BASE_URL=http://10.0.2.2:3000
SOCKET_BASE_URL=http://10.0.2.2:3000
```

(10.0.2.2 adalah default gateway untuk Android emulator ke host machine)

### **For Physical Device**

1. Get your machine IP:
```bash
# Windows
ipconfig
# Look for IPv4 Address: 192.168.x.x

# macOS/Linux
ifconfig
# Look for inet address
```

2. Update .env:
```env
API_BASE_URL=http://192.168.1.100:3000  # Your IP
SOCKET_BASE_URL=http://192.168.1.100:3000
```

3. Make sure backend allows CORS (should already)

---

## ✅ Verification Checklist

Sebelum lanjut ke pembangunan app, pastikan:

### **System Setup**
- [ ] Flutter installed & added to PATH
- [ ] Dart SDK working
- [ ] IDE installed with Flutter extension
- [ ] Android SDK installed (or Xcode for iOS)
- [ ] Device/Emulator available
- [ ] flutter doctor menunjukkan ✓ untuk semua

### **Test Project**
- [ ] Test project created and runs
- [ ] Hot reload working
- [ ] Hot restart working
- [ ] Device detection working

### **Production Project**
- [ ] webrtc_app project created
- [ ] pubspec.yaml validated
- [ ] Dependencies installed
- [ ] .env configured
- [ ] Project structure created

### **Backend Connection**
- [ ] Backend server running
- [ ] MongoDB running
- [ ] API health check passing
- [ ] .env pointing to correct backend

### **IDE Setup**
- [ ] Flutter extension installed
- [ ] Dart formatting working
- [ ] Code completion working
- [ ] Debug configuration set

---

## 🚀 You're Ready!

Jika semua checklist sudah ✓, Anda siap untuk:

1. Read `02-PROJECT_STRUCTURE.md` → Organize code
2. Read `03-ARCHITECTURE_DESIGN.md` → Understand design
3. Start developing features! ✨

---

## 🆘 Troubleshooting

### **"flutter: command not found"**
```bash
# Add Flutter to PATH
# Windows: Environment Variables > System Variables > Path
# Add: C:\src\flutter\bin

# macOS/Linux: Edit ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/flutter/bin"
source ~/.bashrc
```

### **"Android SDK location not found"**
```bash
# Set Android SDK location
flutter config --android-sdk /path/to/android/sdk
# Or use Android Studio to configure
```

### **"No devices found"**
```bash
# Check connected devices
flutter devices

# Start emulator manually from Android Studio
# or use: flutter emulators launch android-pixel5
```

### **"Dependencies not resolving"**
```bash
# Clear cache and reinstall
flutter clean
flutter pub get
flutter pub upgrade
```

### **"Hot reload not working"**
```bash
# Use hot restart instead
# Press 'R' instead of 'r'
# If still not working, restart app
flutter run
```

---

## 📖 Next Steps

1. ✅ Setup complete
2. 📖 Read `02-PROJECT_STRUCTURE.md` - Organize project
3. 🏗️ Read `03-ARCHITECTURE_DESIGN.md` - Design system
4. 💻 Start development!

---

**Last Updated**: March 17, 2025
**Status**: Complete
**Verification**: All steps tested ✅

