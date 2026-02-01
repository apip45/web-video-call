# 🚀 Quick Start Guide - Video Quality Control

## Untuk Admin

### 1. Akses Quality Settings
Saat berada di dalam room/panggilan:
1. Cari ikon **Quality Settings** (⚙️) di control bar bagian kanan
2. Klik icon tersebut untuk membuka panel Quality Settings

### 2. Pilih Preset Resolusi
Di panel yang terbuka, pilih salah satu preset:
- **360p (nHD)** - Untuk koneksi sangat lambat
- **480p (SD)** - Untuk koneksi lambat  
- **720p (HD)** - Standar (Default)
- **1080p (Full HD)** - Kualitas tinggi
- **Custom** - Untuk pengaturan manual

### 3. Sesuaikan Bitrate (Opsional)
Geser slider **Bitrate**:
- Minimum: 300 kbps
- Maximum: 5000 kbps
- Semakin tinggi = kualitas lebih baik, bandwidth lebih besar

### 4. Sesuaikan Framerate (Opsional)
Geser slider **Framerate**:
- Minimum: 15 fps
- Maximum: 60 fps
- Semakin tinggi = gerakan lebih smooth

### 5. Custom Resolution (Jika Dipilih)
Jika memilih "Custom", input manual:
- **Width**: 320 - 3840 pixels
- **Height**: 240 - 2160 pixels

### 6. Terapkan Perubahan
Klik tombol **"Terapkan Perubahan"**
- User akan otomatis menerima pengaturan baru
- User TIDAK akan melihat notifikasi apapun
- Anda akan melihat toast konfirmasi

## Untuk User

**Tidak ada yang perlu dilakukan!**
- Video quality akan berubah otomatis
- Tidak ada notifikasi yang ditampilkan
- Perubahan berjalan smooth di background

## 💡 Tips

### Untuk Koneksi Lambat:
```
Pilih: 360p atau 480p
Bitrate: 300-500 kbps
Framerate: 24 fps
```

### Untuk Koneksi Normal:
```
Pilih: 720p
Bitrate: 1000-1500 kbps
Framerate: 30 fps
```

### Untuk Koneksi Cepat:
```
Pilih: 1080p
Bitrate: 2000-3000 kbps
Framerate: 30 fps
```

## 🔧 Troubleshooting

### Video Tidak Berubah?
1. Pastikan ada user yang terhubung (bukan hanya admin)
2. Check console browser untuk error
3. Coba preset yang lebih rendah (misalnya 480p)

### Resolusi Tidak Sesuai?
- Ini normal! Sistem otomatis fallback ke resolusi yang support
- Check console: Akan ada log "Fell back from X to Y"
- Device user mungkin tidak support resolusi tinggi

### Button Quality Settings Tidak Muncul?
- Pastikan login sebagai **Admin** (bukan User)
- Button hanya muncul untuk role admin

## 📊 Rekomendasi Berdasarkan Use Case

| Use Case | Preset | Bitrate | FPS | Catatan |
|----------|--------|---------|-----|---------|
| Mobile Data | 360p | 400 kbps | 24 | Hemat kuota |
| WiFi Lemah | 480p | 650 kbps | 30 | Balanced |
| WiFi Normal | 720p | 1200 kbps | 30 | Recommended |
| WiFi Cepat | 1080p | 2500 kbps | 30 | Best quality |
| Screen Share | 720p+ | 1500+ kbps | 15-24 | Text clarity |
| Video Recording | 1080p | 3000 kbps | 30 | Archive quality |

## ⚡ Keyboard Shortcuts

Tidak ada keyboard shortcuts untuk fitur ini saat ini.
Gunakan mouse/touch untuk interact dengan panel.

## 🆘 Support

Jika mengalami masalah:
1. Buka Developer Console (F12)
2. Check tab Console untuk error messages
3. Screenshot error dan laporkan ke developer
4. Include: Browser, OS, Network condition

---

**Version:** 1.0.0  
**Last Updated:** February 2026
