# 📡 Setup MediaMTX untuk Fitur "Stream" (OBS → WHIP → WHEP)

Panduan lengkap instalasi **MediaMTX** sebagai pengganti/alternatif share screen
dengan kualitas audio yang benar. Streamer memakai **OBS Studio** (WHIP), viewer
menonton lewat web app memakai **WHEP** (WebRTC) — audio (Opus) ikut terkirim.

> **Referensi resmi:** [mediamtx.org/docs](https://mediamtx.org/docs/kickoff/introduction)
> - Publish OBS: https://mediamtx.org/docs/publish/obs-studio
> - Read WebRTC/WHEP: https://mediamtx.org/docs/read/webrtc
> - Authentication: https://mediamtx.org/docs/features/authentication
> - Hooks: https://mediamtx.org/docs/features/hooks

---

## 📋 Arsitektur

```
┌────────────┐  WHIP (H264+Opus)   ┌──────────────────────┐   WHEP    ┌──────────────┐
│ OBS Studio │ ──────────────────► │ MediaMTX             │ ────────► │ Web App Room │
│  (streamer)│   https://media...  │ media.mikan.my.id    │  WebRTC   │  (viewer)    │
└────────────┘                     │  path: room-<roomId> │           └──────────────┘
                                   └───────┬──────────────┘
                                           │ runOnAvailable / runOnUnavailable
                                           ▼
                              Node.js /api/mediamtx/hook → Socket.IO → room
```

- Path MediaMTX = `room-<roomId>` (satu stream per room).
- Token publish/read dibuat Node (HMAC) dan diverifikasi MediaMTX lewat
  `authHTTPAddress` → `POST /api/mediamtx/auth`.
- Saat OBS mulai/berhenti, MediaMTX memanggil hook ke Node agar semua client
  di room otomatis mulai/berhenti menonton.

**Catatan penting:** gunakan **WHIP** (bukan RTMP). RTMP memakai audio AAC yang
tidak bisa dibaca WHEP tanpa transcode. WHIP dari OBS sudah H264 + Opus sehingga
langsung kompatibel.

---

## 📦 Requirements

- VPS Ubuntu (existing: `202.155.91.241`) dengan Caddy + Coturn + Node app
- RAM: MediaMTX hanya ~20–30 MB, aman di VPS 1 GB
- Domain: `media.mikan.my.id` (A record ke IP VPS)
- OBS Studio **v30+** (WHIP output native)
- Firewall: port **8189/udp + 8189/tcp** harus terbuka (media WebRTC)

---

## 🔧 1. Instalasi MediaMTX (Native Binary)

```bash
# Cek versi terbaru di https://github.com/bluenviron/mediamtx/releases
cd /tmp
VERSION=v1.15.0   # ⚠️ ganti dengan versi terbaru
wget https://github.com/bluenviron/mediamtx/releases/download/${VERSION}/mediamtx_${VERSION}_linux_amd64.tar.gz

mkdir -p /tmp/mediamtx && tar -xzf mediamtx_${VERSION}_linux_amd64.tar.gz -C /tmp/mediamtx
sudo install -m 755 /tmp/mediamtx/mediamtx /usr/local/bin/mediamtx

# Direktori config & log
sudo mkdir -p /etc/mediamtx /var/log/mediamtx
sudo useradd -r -s /usr/sbin/nologin mediamtx 2>/dev/null || true
sudo install -m 644 /tmp/mediamtx/mediamtx.yml /etc/mediamtx/mediamtx.yml
```

### Systemd service

```bash
sudo nano /etc/systemd/system/mediamtx.service
```

```ini
[Unit]
Description=MediaMTX Media Server (WHIP/WHEP)
After=network.target

[Service]
Type=simple
User=mediamtx
Group=mediamtx
WorkingDirectory=/etc/mediamtx
ExecStart=/usr/local/bin/mediamtx /etc/mediamtx/mediamtx.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mediamtx
sudo systemctl status mediamtx
```

---

## ⚙️ 2. Konfigurasi `/etc/mediamtx/mediamtx.yml`

```yaml
###############################################
# MediaMTX - Stream feature (OBS WHIP -> WHEP)
# VPS: 202.155.91.241 / media.mikan.my.id
###############################################

logLevel: info

# Control API hanya localhost (dipakai Node untuk cek status)
api: yes
apiAddress: 127.0.0.1:9997

# Protokol yang tidak dipakai dimatikan
rtsp: no
rtmp: no
hls: no
srt: no
playback: no
moq: no

# WebRTC (WHIP publish + WHEP read)
webrtc: yes
webrtcAddress: 127.0.0.1:8889      # di-proxy Caddy (HTTPS 443)
webrtcEncryption: no               # TLS ditangani Caddy
webrtcAllowOrigins: ['*']          # batasi ke domain web app jika perlu
webrtcLocalUDPAddress: :8189       # WAJIB dibuka di firewall
webrtcLocalTCPAddress: :8189       # fallback bila UDP diblokir
webrtcAdditionalHosts: [202.155.91.241, media.mikan.my.id]
webrtcICEServers2:
  - url: stun:stun.l.google.com:19302
  # Coturn existing (ganti sesuai kredensial COTURN_SETUP.md kamu)
  # Jika Coturn memakai use-auth-secret: username = AUTH_SECRET
  - url: turn:turn.mikan.my.id:3478?transport=tcp
    username: AUTH_SECRET
    password: GANTI_DENGAN_STATIC_AUTH_SECRET_COTURN

###############################################
# Autentikasi: verifikasi ke Node app
###############################################
authMethod: http
authHTTPAddress: http://127.0.0.1:3000/api/mediamtx/auth
authHTTPExclude:
  - action: api
  - action: metrics
  - action: pprof

###############################################
# Hook: beri tahu Node saat stream live/berhenti
###############################################
pathDefaults:
  runOnAvailable: 'curl -s "http://127.0.0.1:3000/api/mediamtx/hook?event=available&path=$MTX_PATH&secret=GANTI_HOOK_SECRET"'
  runOnAvailableRestart: no
  runOnUnavailable: 'curl -s "http://127.0.0.1:3000/api/mediamtx/hook?event=unavailable&path=$MTX_PATH&secret=GANTI_HOOK_SECRET"'
  runOnUnavailableRestart: no

paths:
  all_others:
```

> `GANTI_HOOK_SECRET` harus **sama** dengan `MEDIAMTX_HOOK_SECRET` di `.env` Node.
> `pathDefaults.runOnAvailable` dieksekusi MediaMTX saat stream mulai tersedia.
> Pada MediaMTX versi lama (sebelum v1.9) nama hook adalah `runOnReady` /
> `runOnNotReady` — ganti nama key jika memakai versi lama.

Reload setelah mengubah config:

```bash
sudo systemctl restart mediamtx
sudo journalctl -u mediamtx -f
```

---

## 🌐 3. DNS + Caddy Reverse Proxy

DNS: `media.mikan.my.id` → `202.155.91.241`

Tambahkan ke `/etc/caddy/Caddyfile` (existing Ion-SFU):

```caddyfile
media.mikan.my.id {
    reverse_proxy 127.0.0.1:8889 {
        transport http {
            read_timeout 300s
            write_timeout 300s
        }
    }

    log {
        output file /var/log/caddy/media.log {
            roll_size 10mb
            roll_keep 5
        }
        format console
    }
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy

# Test
curl -I https://media.mikan.my.id
```

---

## 🔥 4. Firewall

```bash
sudo ufw allow 8189/udp   # media WebRTC (ICE UDP)
sudo ufw allow 8189/tcp   # fallback ICE TCP
sudo ufw status verbose
```

Port `8889` (HTTP WebRTC) dan `9997` (API) **tidak** perlu dibuka — hanya lokal
dan di-proxy Caddy.

---

## 🖥️ 5. Konfigurasi OBS Studio

1. Buka panel **Stream** di web app room → klik **Aktifkan Sesi Stream**.
2. Salin **WHIP Server** dan **Bearer Token** dari panel.
3. Di OBS: **Settings → Stream**
   - Service: `WHIP`
   - Server: `https://media.mikan.my.id/room-<roomId>/whip`
   - Bearer Token: tempel token publish
4. **Settings → Output** (mode Advanced):
   - Encoder: `x264` / `NVENC H.264` (jangan H265/AV1 untuk kompatibilitas browser)
   - **B-frames: 0** (wajib; browser WebRTC tidak mendukung B-frame)
   - Keyframe Interval: `1–2 s`
   - Rate Control: `CBR`, bitrate sesuai bandwidth (mis. 2500–6000 kbps)
   - Audio: `Opus` 48 kHz, 128–160 kbps (bukan AAC)
5. **Start Streaming** di OBS → status di panel web berubah menjadi **LIVE**,
   viewer otomatis mulai menonton.

> Mikrofon web otomatis dimatikan sementara saat stream live agar audio tidak
> dobel (OBS yang menjadi sumber audio: mic + desktop audio).

---

## 🔐 6. Konfigurasi Node App (`.env`)

```env
MEDIAMTX_ENABLED=true
MEDIAMTX_PUBLIC_URL=https://media.mikan.my.id
MEDIAMTX_API_URL=http://127.0.0.1:9997
MEDIAMTX_PATH_PREFIX=room-
MEDIAMTX_AUTH_SECRET=<random-string-panjang>   # generate: openssl rand -hex 32
MEDIAMTX_HOOK_SECRET=<random-string-panjang>
MEDIAMTX_TOKEN_TTL=7200
```

Endpoint internal yang dipakai MediaMTX:

| Endpoint | Method | Fungsi |
| --- | --- | --- |
| `/api/mediamtx/auth` | POST | Validasi token publish/read (dipanggil MediaMTX) |
| `/api/mediamtx/hook` | GET | Notifikasi stream available/unavailable (loopback + secret) |
| `/api/mediamtx/status/:roomId` | GET | Status live untuk UI (session/JWT) |

---

## ✅ 7. Testing

```bash
# Service jalan
sudo systemctl status mediamtx

# API lokal hidup
curl -s http://127.0.0.1:9997/v3/paths/list

# Tanpa publisher: stream belum live
curl -s http://127.0.0.1:9997/v3/paths/get/room-test

# Publish manual dengan FFmpeg (opsional, butuh codec Opus + Authorization Bearer)
# ffmpeg -re -i sample.mp4 -c:v libx264 -bf 0 -c:a libopus -f whip \
#   -headers "Authorization: Bearer <publishToken>" \
#   "http://127.0.0.1:8889/room-test/whip"

# Status dari Node (login session browser atau JWT)
# GET /api/mediamtx/status/<roomId> → { live: true, readers: n }
```

Checklist end-to-end:

- [ ] OBS WHIP start → panel web menampilkan **LIVE**
- [ ] Viewer otomatis menonton (video + audio)
- [ ] Audio tidak dobel (mic web di-suppress saat live)
- [ ] OBS stop → viewer kembali ke kamera P2P
- [ ] Reload halaman viewer saat live → tetap bisa menonton (`streamLive` di `room-joined`)
- [ ] Token expired/diubah → OBS gagal publish (401)
- [ ] 2 room berbeda bisa stream paralel
- [ ] Viewer di jaringan NAT ketat (Tri/Indosat) → koneksi via TURN

---

## 🐛 Troubleshooting

| Gejala | Penyebab / Solusi |
| --- | --- |
| OBS gagal connect (401) | Token beda dengan `MEDIAMTX_AUTH_SECRET`; minta token baru dari panel web |
| OBS gagal connect (409) | Path sudah dipakai publisher lain — hanya 1 publisher per path |
| Video hitam tanpa audio | Encoder audio bukan Opus (mis. AAC dari RTMP). Gunakan WHIP |
| Video tidak play di browser | H264 memakai B-frame; set B-frames = 0 / `bf=0` |
| Viewer tidak auto menonton | Cek `runOnAvailable` hook: `journalctl -u mediamtx`; pastikan `MEDIAMTX_HOOK_SECRET` sama |
| Koneksi WebRTC gagal di mobile | Buka 8189/udp + 8189/tcp; pastikan `webrtcAdditionalHosts` berisi IP publik; cek TURN |
| `api error` di `/status` | Control API tidak jalan / `apiAddress` beda — pastikan `api: yes` |
| Stream jalan tapi Node tidak tahu | `curl` hook tidak terpasang / secret salah; cek log Node `[MediaMTX]` |

Log berguna:

```bash
sudo journalctl -u mediamtx -n 100
sudo journalctl -u mediamtx -f | grep -i "auth\|error"
tail -f /var/log/mediamtx/mediamtx.log   # jika logDestinations file diaktifkan
```

---

## 🔒 Catatan Keamanan

- `MEDIAMTX_AUTH_SECRET` & `MEDIAMTX_HOOK_SECRET`: random panjang, jangan commit ke git.
- Token terikat ke `action` + `path` + masa berlaku (default 2 jam).
- Hook hanya menerima request dari loopback + secret.
- Control API (`9997`) dan WebRTC HTTP (`8889`) **jangan** di-expose publik.
- Batasi `webrtcAllowOrigins` ke domain web app bila memungkinkan.
- Publik hanya bisa publish ke path room dengan token publish (dibuat server).
