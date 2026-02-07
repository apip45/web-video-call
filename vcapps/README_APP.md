# Video Call Mobile App

Aplikasi mobile video call berbasis Flutter yang terintegrasi dengan backend Node.js menggunakan WebRTC dengan TURN/STUN server.

## Fitur

- ✅ **Authentication**: Login dan Register
- ✅ **Create Room**: Buat room video call baru
- ✅ **Join Room**: Bergabung ke room dengan Room ID
- ✅ **Video Call**: Video call real-time dengan WebRTC
- ✅ **Controls**: Toggle microphone, camera, dan switch camera
- ✅ **Dark Theme**: Tampilan modern dengan dark theme mirip website

## Teknologi

- **Flutter**: Framework aplikasi mobile
- **WebRTC**: Real-time video communication
- **Socket.IO**: Real-time communication
- **TURN/STUN**: NAT traversal untuk koneksi peer-to-peer

## Konfigurasi

### 1. Update API URL

Edit file `lib/core/constants/api_constants.dart`:

```dart
class ApiConstants {
  // Update dengan URL server Anda
  static const String baseUrl = 'http://YOUR_SERVER_IP:3000';
  
  // ...
}
```

### 2. Konfigurasi TURN/STUN Server

Edit file `lib/core/constants/api_constants.dart`:

```dart
static const Map<String, dynamic> iceServers = {
  'iceServers': [
    // Google STUN servers
    {'urls': 'stun:stun.l.google.com:19302'},
    
    // Tambahkan TURN server Anda di sini
    {
      'urls': 'turn:your-turn-server.com:3478',
      'username': 'your-username',
      'credential': 'your-password',
    },
  ],
};
```

## Instalasi

### 1. Install Dependencies

```bash
cd vcapps
flutter pub get
```

### 2. Setup Android

Permissions sudah ditambahkan di `android/app/src/main/AndroidManifest.xml`:
- Camera
- Microphone
- Internet
- Network State

### 3. Setup iOS (Opsional)

Edit `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Aplikasi membutuhkan akses kamera untuk video call</string>
<key>NSMicrophoneUsageDescription</key>
<string>Aplikasi membutuhkan akses microphone untuk video call</string>
```

## Menjalankan Aplikasi

### Android

```bash
flutter run
```

### iOS

```bash
flutter run
```

### Build APK

```bash
flutter build apk --release
```

APK akan tersedia di: `build/app/outputs/flutter-apk/app-release.apk`

### Build iOS

```bash
flutter build ios --release
```

## Struktur Folder

```
lib/
├── core/
│   ├── constants/
│   │   └── api_constants.dart        # Konfigurasi API dan ICE servers
│   ├── services/
│   │   ├── api_service.dart          # HTTP API service
│   │   └── webrtc_service.dart       # WebRTC service
│   └── theme/
│       └── app_theme.dart            # Theme aplikasi
├── models/
│   ├── user.dart                     # User model
│   └── room.dart                     # Room model
├── screens/
│   ├── auth/
│   │   ├── login_screen.dart         # Login screen
│   │   └── register_screen.dart      # Register screen
│   ├── home/
│   │   └── home_screen.dart          # Home screen
│   └── room/
│       └── room_screen.dart          # Video call room screen
└── main.dart                         # Entry point
```

## Penggunaan

### 1. Login/Register
- Buka aplikasi
- Login dengan akun yang sudah ada atau register akun baru

### 2. Buat Room Baru
- Di home screen, masukkan nama room (opsional)
- Klik "Buat Room Baru"
- Bagikan Room ID ke orang lain

### 3. Join Room
- Di home screen, masukkan Room ID
- Klik "Join Room"
- Mulai video call

### 4. Controls Video Call
- **Microphone**: Toggle on/off microphone
- **Camera**: Toggle on/off camera
- **Switch Camera**: Ganti kamera depan/belakang
- **Leave**: Keluar dari room

## Troubleshooting

### Kamera/Microphone tidak berfungsi
- Pastikan permissions sudah diberikan di pengaturan aplikasi
- Restart aplikasi setelah memberikan permissions

### Tidak bisa connect ke server
- Pastikan server backend sudah berjalan
- Update `baseUrl` di `api_constants.dart`
- Pastikan device dan server di network yang sama (atau gunakan public IP)

### Video call tidak terhubung
- Pastikan TURN server sudah dikonfigurasi dengan benar
- Cek koneksi internet
- Pastikan kedua user sudah join ke room yang sama

## Catatan

- Aplikasi menggunakan WebRTC dengan TURN/STUN server untuk koneksi peer-to-peer
- Styling mirip dengan versi website (dark theme dengan aksen hijau)
- Mendukung portrait dan landscape mode
- Optimized untuk Android (iOS memerlukan konfigurasi tambahan)

## Backend Requirements

Backend server harus memiliki:
- Socket.IO untuk signaling
- Endpoints: `/auth/login`, `/auth/register`, `/room/create`, `/room/:roomId`
- Support untuk WebRTC signaling (offer, answer, ice-candidate)

## License

Sesuai dengan lisensi project utama.
