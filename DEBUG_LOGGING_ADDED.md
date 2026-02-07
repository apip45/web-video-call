# 🔍 DEBUG LOGGING - TURN/STUN Server Usage

## Perubahan yang Dilakukan

Telah ditambahkan logging detail untuk debugging server TURN dan STUN yang digunakan saat panggilan berlangsung.

## File yang Dimodifikasi

### 1. `public/js/webrtc.js`
**Perubahan:**
- ✅ Tambahkan detail logging ICE servers saat peer connection dibuat
- ✅ Tambahkan monitoring ICE candidate yang dipilih saat connection berhasil  
- ✅ Tambahkan method `logActiveICECandidate()` untuk menampilkan detail koneksi aktif

**Fitur Logging:**
- 🌐 Daftar lengkap ICE servers yang dikonfigurasi (STUN/TURN)
- 🎯 Tipe koneksi yang digunakan (Direct/STUN/TURN)
- 📍 Candidate lokal dan remote yang dipilih
- 📊 Statistik koneksi (bytes sent/received, RTT)
- 🔵 STUN - Server Reflexive (NAT traversal via public internet)
- 🟢 TURN - Relay (Through TURN server)
- 🟡 Host - Direct local network connection

### 2. `public/js/ionSFUClient.js`
**Perubahan:**
- ✅ Tambahkan logging ICE servers untuk publish connection
- ✅ Tambahkan monitoring ICE state untuk publish connection
- ✅ Tambahkan monitoring ICE state untuk subscribe connection
- ✅ Tambahkan method `logActiveICECandidate()` untuk Ion-SFU mode

**Fitur Logging:**
- 🌐 Daftar ICE servers untuk koneksi ke SFU
- 🎯 Detail koneksi PUBLISH (upload ke SFU)
- 🎯 Detail koneksi SUBSCRIBE (download dari SFU)
- 📍 Candidate yang digunakan untuk komunikasi dengan SFU
- 📊 Statistik koneksi per direction (publish/subscribe)

## Cara Menggunakan

### 1. **Buka Browser Console**
   - Chrome/Edge: F12 atau Ctrl+Shift+I
   - Firefox: F12 atau Ctrl+Shift+K
   - Safari: Cmd+Option+I

### 2. **Mulai Video Call**
   - Join room atau buat room baru
   - Tunggu hingga koneksi terbentuk

### 3. **Lihat Debug Logs**

Saat koneksi terbentuk, Anda akan melihat log seperti:

```
══════════════════════════════════════════════════
[WebRTC] 🎯 ACTIVE ICE CONNECTION DETAILS:
══════════════════════════════════════════════════
[WebRTC] 📍 Local Candidate:
[WebRTC]   Type: relay
[WebRTC]   Protocol: udp
[WebRTC]   Address: 202.155.91.241:3478
[WebRTC]   🟢 Using TURN Server (Relay)
[WebRTC]   TURN Server: udp
[WebRTC]   Server URLs: turn:202.155.91.241:3478
[WebRTC] 📍 Remote Candidate:
[WebRTC]   Type: srflx
[WebRTC]   Protocol: udp
[WebRTC]   Address: xxx.xxx.xxx.xxx:xxxx
[WebRTC] 📊 Connection Statistics:
[WebRTC]   Bytes Sent: 123456
[WebRTC]   Bytes Received: 234567
[WebRTC]   RTT (Round Trip Time): 45.23 ms
══════════════════════════════════════════════════
```

## Interpretasi Log

### Tipe Candidate:

1. **🟡 host** - Koneksi langsung via local network
   - Paling cepat dan efisien
   - Hanya bekerja jika kedua peer dalam network yang sama

2. **🔵 srflx (Server Reflexive)** - Via STUN server
   - Menggunakan STUN untuk NAT traversal
   - Koneksi peer-to-peer melalui internet publik
   - Efisien, tapi perlu port forwarding di NAT

3. **🟢 relay** - Via TURN server
   - Semua traffic melalui TURN server
   - Paling reliable, bekerja dengan Symmetric NAT
   - Konsumsi bandwidth server lebih tinggi

### Mode Koneksi:

#### **Mesh P2P Mode:**
- Satu koneksi peer-to-peer antara dua user
- Log muncul sekali saat koneksi terbentuk

#### **SFU Mode (Ion-SFU):**
- Dua koneksi: PUBLISH dan SUBSCRIBE
- PUBLISH: Upload media ke SFU
- SUBSCRIBE: Download media dari SFU
- Log muncul dua kali (untuk masing-masing koneksi)

## Troubleshooting

### Jika tidak ada log yang muncul:
1. Pastikan connection berhasil (ICE state = connected/completed)
2. Buka Console sebelum join room
3. Check apakah ada error di console

### Jika selalu menggunakan TURN (relay):
- Check firewall blocking UDP
- Check NAT type (Symmetric NAT memerlukan TURN)
- Verify STUN server accessible

### Jika connection failed:
- Check TURN credentials valid
- Check TURN server running dan accessible
- Check ICE servers configuration di `.env`

## Environment Variables Terkait

```bash
# STUN Server
STUN_SERVER_URL=stun:202.155.91.241:3478

# TURN Server
TURN_SERVER_URL=turn:202.155.91.241:3478
TURN_SERVER_USERNAME=your_username
TURN_SERVER_CREDENTIAL=your_password

# TURN Alternative Ports
TURN_SERVER_URL_ALT=turn:202.155.91.241:80

# Force TURN (for testing)
FORCE_TURN=false

# Mode
WEBRTC_MODE=mesh  # or 'sfu'
ION_SFU_ENABLED=false
```

## Testing Scenarios

### Scenario 1: Test STUN Only
```bash
# Disable TURN temporarily
TURN_SERVER_URL=
```
Expected: Connection uses `srflx` (STUN) or `host`

### Scenario 2: Force TURN
```bash
FORCE_TURN=true
```
Expected: Connection always uses `relay` (TURN)

### Scenario 3: SFU Mode
```bash
WEBRTC_MODE=sfu
ION_SFU_ENABLED=true
```
Expected: Two sets of logs (PUBLISH + SUBSCRIBE)

---

**Dibuat pada:** 3 Februari 2026
**Mode:** Mesh P2P & Ion-SFU
**Browser Support:** Chrome, Firefox, Edge, Safari
