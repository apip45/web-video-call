# Video Quality Control Feature - Dokumentasi

## 📋 Overview
Fitur ini memungkinkan **Admin** untuk mengontrol kualitas video (resolusi, bitrate, dan FPS) dari **User** secara realtime selama panggilan video berlangsung. Perubahan diterapkan secara diam-diam tanpa menampilkan notifikasi kepada User.

## ✨ Fitur Utama

### 1. **Preset Resolusi**
Admin dapat memilih dari preset resolusi yang telah ditentukan:
- **360p (nHD)** - 640x360 @ 24fps, 400 kbps (ideal untuk koneksi lambat)
- **480p (SD)** - 854x480 @ 30fps, 650 kbps (standar definition)
- **720p (HD)** - 1280x720 @ 30fps, 1200 kbps (high definition) - **Default**
- **1080p (Full HD)** - 1920x1080 @ 30fps, 2500 kbps (full HD)
- **Custom** - Pengaturan manual sesuai kebutuhan

### 2. **Pengaturan Bitrate**
- **Range**: 300 - 5000 kbps
- **Adjustable**: Real-time slider untuk kontrol bitrate yang presisi
- Bitrate otomatis disesuaikan dengan preset yang dipilih

### 3. **Pengaturan Framerate (FPS)**
- **Range**: 15 - 60 fps
- **Adjustable**: Real-time slider
- FPS otomatis disesuaikan dengan preset yang dipilih

### 4. **Custom Resolution**
Admin dapat mengatur resolusi custom dengan batasan:
- **Width**: 320px - 3840px (4K)
- **Height**: 240px - 2160px (4K)
- **Bitrate**: 100 - 10000 kbps
- **Framerate**: 15 - 60 fps

### 5. **Automatic Fallback Mechanism**
Jika device User tidak mendukung resolusi yang dipilih, sistem otomatis akan:
1. Mencoba resolusi yang diminta
2. Jika gagal, turun ke resolusi berikutnya (1080p → 720p → 480p → 360p)
3. Terus mencoba hingga menemukan resolusi yang didukung
4. Log fallback di console untuk debugging

## 🎯 Cara Penggunaan

### Sebagai Admin:

1. **Buka Quality Settings Panel**
   - Klik tombol Quality Settings (ikon gear) di control bar
   - Panel akan muncul di sebelah kanan layar

2. **Pilih Preset atau Custom**
   - Pilih salah satu preset (360p, 480p, 720p, 1080p)
   - Atau pilih "Custom" untuk pengaturan manual

3. **Sesuaikan Settings** (opsional)
   - Geser slider Bitrate untuk menyesuaikan bandwidth
   - Geser slider Framerate untuk menyesuaikan FPS
   - Untuk Custom: input Width dan Height secara manual

4. **Terapkan Perubahan**
   - Klik tombol "Terapkan Perubahan"
   - User akan menerima pengaturan baru secara diam-diam
   - Sistem otomatis fallback jika resolusi tidak support

### Sebagai User:

- **Tidak ada interaksi yang diperlukan**
- Video quality akan berubah secara otomatis ketika Admin melakukan perubahan
- **Tidak ada notifikasi** yang ditampilkan kepada User
- Perubahan berjalan seamless di background

## 🔧 Technical Details

### File yang Dimodifikasi/Dibuat:

1. **`public/js/videoQualityPresets.js`** (BARU)
   - Definisi preset untuk berbagai resolusi
   - Fungsi validasi dan helper functions
   - Fallback resolution order

2. **`src/views/room.ejs`**
   - Tambahan UI: Quality Settings Panel
   - Button untuk membuka panel
   - Form inputs untuk resolution, bitrate, FPS

3. **`public/css/room.css`**
   - Styling untuk Quality Settings Panel
   - Responsive design untuk mobile/desktop
   - Animasi dan transitions

4. **`src/socket/socketHandler.js`**
   - Event handler: `admin-change-video-quality`
   - Validasi admin permissions
   - Broadcast quality settings ke target user

5. **`public/js/webrtc.js`**
   - Method: `applyVideoQuality(settings)`
   - Method: `applyVideoConstraintsWithFallback()`
   - Automatic fallback logic
   - Bitrate constraint application

6. **`public/js/room.js`**
   - Socket event listeners untuk quality commands
   - UI control functions (toggle panel, preset change, etc.)
   - Handler untuk apply quality settings

### Socket Events:

#### Admin → Server:
```javascript
socket.emit('admin-change-video-quality', {
    roomId: string,
    targetSocketId: string,
    qualitySettings: {
        resolution: string,  // '360p', '480p', '720p', '1080p', 'custom'
        width: number,
        height: number,
        maxBitrate: number,  // kbps
        maxFramerate: number // fps
    }
});
```

#### Server → User:
```javascript
socket.emit('admin-quality-command', {
    qualitySettings: {
        resolution: string,
        width: number,
        height: number,
        maxBitrate: number,
        maxFramerate: number
    },
    adminUsername: string
});
```

#### Server → Admin (Response):
```javascript
socket.emit('admin-quality-response', {
    success: boolean,
    message: string,
    settings: object  // Applied settings (jika success)
});
```

### Fallback Mechanism:

```
Requested: 1080p (1920x1080)
    ↓ (Jika gagal)
Try: 720p (1280x720)
    ↓ (Jika gagal)
Try: 480p (854x480)
    ↓ (Jika gagal)
Try: 360p (640x360)
    ↓ (Jika semua gagal)
Error: No suitable resolution
```

## 🎨 UI/UX Features

1. **Real-time Preview**
   - Slider menampilkan nilai current saat digeser
   - Preset auto-fill form fields

2. **Validation**
   - Input validation untuk custom resolution
   - Range limits untuk semua inputs
   - Error messages untuk invalid values

3. **Visual Feedback**
   - Toast notifications untuk admin
   - Active state pada button
   - Panel animations (slide in/out)

4. **Responsive Design**
   - Mobile-friendly layout
   - Touch-optimized controls
   - Adapts to screen size

## 📊 Performance Considerations

1. **Bandwidth Management**
   - Lower bitrate untuk koneksi lambat
   - Auto-adjust berdasarkan network conditions
   - Smooth transitions antara quality levels

2. **Device Compatibility**
   - Automatic fallback untuk unsupported resolutions
   - Graceful degradation
   - Logs untuk debugging

3. **Real-time Application**
   - Constraints applied langsung ke video track
   - Tidak perlu restart stream
   - Minimal disruption

## 🐛 Debugging

### Console Logs:
- `[WebRTC] 🎥 Applying video quality:` - Quality change requested
- `[WebRTC] 🔽 Trying fallback:` - Fallback ke resolusi lebih rendah
- `[WebRTC] ✅ Constraints applied successfully!` - Success
- `[WebRTC] ⚠️ Fell back from X to Y` - Fallback terjadi

### Common Issues:

1. **Resolution tidak berubah**
   - Check console untuk error messages
   - Verifikasi device support resolusi tersebut
   - Pastikan video track active

2. **User tidak menerima changes**
   - Verifikasi socket connection
   - Check user role (harus 'user', bukan 'admin')
   - Pastikan remoteSocketId valid

3. **Bitrate tidak diterapkan**
   - Requires active peer connection
   - Check sender exists dalam peer connection

## 🔐 Security & Permissions

- **Only Admin** dapat mengubah video quality
- Validasi role di server-side (socketHandler.js)
- User tidak bisa menolak atau override settings dari admin
- All commands logged untuk audit trail

## 📝 Future Enhancements

Potensial improvements untuk versi mendatang:
- [ ] Auto quality adjustment berdasarkan network stats
- [ ] Quality history/analytics
- [ ] Multiple user support (broadcast ke semua user)
- [ ] Save preferred quality settings per room
- [ ] Quality profiles (Low/Medium/High/Ultra)
- [ ] Bandwidth estimation sebelum apply
- [ ] Preview mode sebelum apply changes

## 🙏 Credits

Developed for: Web Video Call Application
Feature: Real-time Video Quality Control
Version: 1.0.0
Date: February 2026
