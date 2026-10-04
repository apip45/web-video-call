# Web Video Call 1 vs 1

Website video call modern, mobile-first, stabil, dan rapi.
Menggunakan WebRTC untuk media dan Socket.IO untuk signaling.

## 🚀 Features

- ✅ Login dengan role (Admin / User)
- ✅ Video call 1 vs 1 (max 2 user per room)
- ✅ Mute / Unmute microphone
- ✅ Camera on / off
- ✅ Switch camera (front/back) - Mobile
- ✅ Switch audio output (speaker/earpiece) - Mobile
- ✅ Indikator mute & camera off
- ✅ Fullscreen video lawan bicara
- ✅ Picture-in-Picture untuk video sendiri (draggable)
- ✅ Stream layar via OBS (WHIP → MediaMTX → WHEP, dengan audio)
- ✅ Auto reconnect WebRTC (max 5x)
- ✅ Dark & Light mode
- ✅ Mobile-first design

## 📦 Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: EJS, Vanilla JavaScript
- **Real-time**: Socket.IO
- **Media**: WebRTC (mesh/SFU)
- **Streaming**: OBS (WHIP) → MediaMTX → WHEP (lihat [MEDIAMTX_SETUP.md](MEDIAMTX_SETUP.md))
- **Database**: MongoDB Atlas
- **Session**: Express Session + connect-mongo
- **TURN Server**: CoTURN (external)

## 🛠️ Installation

### 1. Clone & Install Dependencies

```bash
cd web-video-call
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` ke `.env` dan isi dengan konfigurasi Anda:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/videocall?retryWrites=true&w=majority

# Session Secret (generate random string)
SESSION_SECRET=your-super-secret-session-key-change-this

# TURN Server Configuration (CoTURN)
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_SERVER_USERNAME=turnuser
TURN_SERVER_CREDENTIAL=turnpassword

# STUN Server (optional)
STUN_SERVER_URL=stun:stun.l.google.com:19302

# MediaMTX (fitur Stream/OBS) - lihat MEDIAMTX_SETUP.md
MEDIAMTX_ENABLED=false
MEDIAMTX_PUBLIC_URL=https://media.mikan.my.id
MEDIAMTX_API_URL=http://127.0.0.1:9997
MEDIAMTX_PATH_PREFIX=room-
MEDIAMTX_AUTH_SECRET=change-me-mediamtx-auth-secret
MEDIAMTX_HOOK_SECRET=change-me-mediamtx-hook-secret
MEDIAMTX_TOKEN_TTL=7200
```

### 3. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### 4. Access the App

Buka browser dan akses:
```
http://localhost:3000
```

## 👤 Default Admin Account

Akun admin default akan dibuat otomatis:

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Penting**: Ganti password admin segera setelah deploy!

## 📁 Project Structure

```
web-video-call/
├── public/
│   ├── css/
│   │   ├── style.css       # Main styles
│   │   └── room.css        # Video call room styles
│   └── js/
│       ├── theme.js        # Dark/Light mode toggle
│       ├── webrtc.js       # WebRTC handler class
│       └── room.js         # Room controller
├── src/
│   ├── config/
│   │   ├── database.js     # MongoDB connection
│   │   └── webrtc.js       # ICE servers config
│   ├── middleware/
│   │   └── auth.js         # Authentication middleware
│   ├── models/
│   │   ├── User.js         # User schema
│   │   └── Room.js         # Room schema
│   ├── routes/
│   │   ├── auth.js         # Login, register, logout
│   │   └── room.js         # Room management
│   ├── socket/
│   │   └── socketHandler.js # WebRTC signaling
│   ├── views/
│   │   ├── login.ejs
│   │   ├── register.ejs
│   │   ├── home.ejs
│   │   ├── room.ejs
│   │   └── error.ejs
│   └── server.js           # Main server entry
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 🔧 TURN Server Setup

Aplikasi ini membutuhkan TURN server untuk koneksi yang reliable (melewati NAT/firewall).

### Menggunakan CoTURN

1. Install CoTURN di server Anda
2. Konfigurasi `/etc/turnserver.conf`:

```conf
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=your-secret-key
realm=your-domain.com
```

3. Update `.env` dengan kredensial TURN server

### Alternatif: Menggunakan TURN Service

Anda juga bisa menggunakan layanan TURN berbayar seperti:
- Twilio TURN
- Xirsys
- Metered TURN

## 📱 Mobile Optimization

Aplikasi ini dioptimasi untuk mobile:

- Touch-friendly controls
- Safe area padding untuk iPhone X+
- Landscape mode support
- Camera switch untuk front/back camera
- Audio output toggle (speaker/earpiece)
- Draggable PIP video

## 🔒 Security Considerations

1. **Session Secret**: Gunakan random string yang kuat
2. **HTTPS**: Wajib untuk WebRTC di production
3. **Password Hashing**: Menggunakan bcrypt dengan salt 10 rounds
4. **Admin Password**: Ganti password default segera

## 📝 API Endpoints

### Authentication
- `GET /login` - Halaman login
- `POST /login` - Proses login
- `GET /register` - Halaman register
- `POST /register` - Proses register
- `GET /logout` - Logout

### Room
- `GET /` - Dashboard (list rooms)
- `POST /room/create` - Buat room baru
- `GET /room/:roomId` - Masuk ke room
- `DELETE /room/:roomId` - Hapus room (creator/admin only)

## 🔌 Socket Events

### Client → Server
- `join-room` - Join room
- `offer` - Send WebRTC offer
- `answer` - Send WebRTC answer
- `ice-candidate` - Send ICE candidate
- `media-status` - Update mic/camera status
- `screen-share-status` - Update status share screen (browser)
- `stream-session-status` - Aktif/mati sesi stream OBS (MediaMTX)
- `leave-room` - Leave room
- `reconnect-request` - Request reconnection

### Server → Client
- `room-joined` - Room join success
- `room-full` - Room is full
- `user-joined` - New user joined
- `user-left` - User left
- `offer` - Receive offer
- `answer` - Receive answer
- `ice-candidate` - Receive ICE candidate
- `media-status` - Receive remote media status
- `screen-share-status` - Receive remote screen share status
- `stream-session-status` - Peer mengaktifkan/mematikan sesi stream
- `stream-available` - Stream OBS live (mulai tonton WHEP)
- `stream-unavailable` - Stream OBS berakhir
- `reconnect-peer` - Reconnection request
- `error` - Error message

## 🐛 Troubleshooting

### Kamera/Mikrofon tidak berfungsi
- Pastikan browser memiliki izin akses kamera/mikrofon
- Gunakan HTTPS (WebRTC membutuhkan secure context)
- Cek apakah kamera digunakan aplikasi lain

### Video call tidak terhubung
- Pastikan TURN server berjalan dan terkonfigurasi dengan benar
- Cek firewall tidak memblokir port TURN (3478)
- Lihat console log untuk error detail

### Connection terputus terus
- Cek koneksi internet
- Aplikasi akan mencoba reconnect otomatis (max 5x)
- Jika gagal, akan redirect ke home

## 📄 License

MIT License
