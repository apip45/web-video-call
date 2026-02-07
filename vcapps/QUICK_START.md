# Quick Start Guide - Video Call Mobile App (Android)

## 🚀 Setup Cepat

### 1. Konfigurasi Server URL

Buka file: `lib/core/constants/api_constants.dart`

**Untuk Android Emulator:**
```dart
static const String baseUrl = 'http://10.0.2.2:3000';  // Sudah default
```

**Untuk Android Device Fisik:**
```dart
static const String baseUrl = 'http://192.168.1.100:3000';  // Ganti dengan IP komputer Anda
```

**Cara cek IP komputer:**
- Windows: Buka CMD, ketik `ipconfig`, lihat IPv4 Address
- Pastikan device dan komputer di WiFi yang sama

### 2. Konfigurasi TURN/STUN Server

Jika Anda memiliki TURN server sendiri, edit di file yang sama:

```dart
static const Map<String, dynamic> iceServers = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
    {
      'urls': 'turn:your-turn-server.com:3478',
      'username': 'username',
      'credential': 'password',
    },
  ],
};
```

**Catatan:** STUN server Google sudah cukup untuk testing di jaringan lokal.

### 3. Install Dependencies

```bash
cd vcapps
flutter pub get
```

### 4. Jalankan Aplikasi

**Android:**
```bash
flutter run
```

**iOS:**
```bash
flutter run
```

**Atau pilih device dari VS Code:**
1. Tekan F5 atau klik Run > Start Debugging
2. Pilih device (Android/iOS)

## 📱 Testing

### Skenario Testing:

1. **Login/Register**
   - Buka aplikasi
   - Register akun baru atau login dengan akun existing

2. **Create Room**
   - Di home screen, klik "Buat Room Baru"
   - Copy Room ID yang muncul

3. **Join Room (Device ke-2)**
   - Buka aplikasi di device lain
   - Login dengan akun berbeda
   - Paste Room ID
   - Klik "Join Room"

4. **Video Call**
   - Kedua device akan terhubung
   - Test controls: Mic, Camera, Switch Camera
   - Test Leave Room

## 🔧 Troubleshooting

### Permissions Tidak Muncul
- Uninstall dan install ulang aplikasi
- Atau buka Settings > Apps > Video Call > Permissions

### Tidak Bisa Connect ke Server
- Pastikan server backend running
- Cek firewall tidak memblokir port 3000
- Gunakan IP yang benar (bukan localhost jika di device fisik)

### Video Call Tidak Terhubung
- Pastikan TURN server terkonfigurasi jika di network berbeda
- Cek koneksi internet
- Pastikan kedua user di room yang sama

### Build Error
```bash
flutter clean
flutter pub get
flutter run
```

## 📦 Build APK

```bash
flutter build apk --release
```

APK ada di: `build/app/outputs/flutter-apk/app-release.apk`

Install ke device:
```bash
flutter install
```

## 🎯 Checklist Sebelum Testing

- [ ] Server backend sudah running
- [ ] URL server sudah dikonfigurasi dengan benar
- [ ] Dependencies sudah diinstall (`flutter pub get`)
- [ ] Device/Emulator sudah terhubung
- [ ] Camera dan Microphone permissions sudah diberikan

## 📝 Catatan Penting

1. **Network**: Device dan server harus di network yang sama untuk testing lokal
2. **HTTPS**: Untuk production, gunakan HTTPS untuk server
3. **TURN Server**: Wajib untuk koneksi antar network berbeda
4. **iOS**: Memerlukan Mac dan Xcode untuk build

## 🆘 Support

Jika ada masalah:
1. Cek console log untuk error messages
2. Pastikan semua konfigurasi sudah benar
3. Test di emulator dulu sebelum device fisik
4. Cek dokumentasi lengkap di README_APP.md
