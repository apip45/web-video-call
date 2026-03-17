# 📱 DOKUMENTASI APLIKASI VIDEO CALL - VERSI WEBSITE

## Ringkasan Eksekutif

Aplikasi Website Video Call adalah aplikasi **1-vs-1 video call realtime** yang dibangun dengan teknologi modern seperti **WebRTC**, **Socket.IO**, dan **Express.js**. Aplikasi ini mendukung dual mode untuk komunikasi video:
- **Mesh P2P Mode**: Direct peer-to-peer connection antar pengguna
- **SFU Mode**: Menggunakan Ion-SFU (Selective Forwarding Unit) untuk relay traffic

---

## 🏗️ Arsitektur Sistem

### Diagram Alur Tingkat Tinggi

```
┌─────────────────────────────────────────────────────────────┐
│                     WEB BROWSER CLIENT                      │
│  ┌─────────────────┐           ┌──────────────────────┐    │
│  │  Room.js        │           │  WebRTC Handler      │    │
│  │  (Controller)   │◄──────►   │  (P2P/SFU Manager)   │    │
│  └─────────────────┘           └──────────────────────┘    │
│           │                              │                  │
│           ▼                              ▼                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │      Socket.IO Client                              │   │
│  │  (Real-time signaling & media status update)       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
         │ HTTP/WebSocket
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS SERVER                        │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Socket.IO       │  │  REST API        │                │
│  │  (Signaling)     │  │  (Mobile/Web)    │                │
│  └──────────────────┘  └──────────────────┘                │
│           │                     │                           │
│  ┌────────────────────────────────────────────┐            │
│  │  Routes: Auth, Room, Admin, API            │            │
│  └────────────────────────────────────────────┘            │
│  ┌────────────────────────────────────────────┐            │
│  │  Middleware: Authentication, Session       │            │
│  └────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    MONGODB DATABASE                         │
│  ┌──────────┐ ┌────────┐ ┌──────┐ ┌────────┐              │
│  │  Users   │ │ Rooms  │ │Stats │ │Setting │              │
│  └──────────┘ └────────┘ └──────┘ └────────┘              │
└─────────────────────────────────────────────────────────────┘

        ┌─────────────────────────────────────┐
        │  OPTIONAL: Ion-SFU Server          │
        │  (WebSocket relay untuk video)     │
        └─────────────────────────────────────┘
```

### Flow Koneksi Video Call

```
User A Join Room          User B Join Room
    │                          │
    ▼                          ▼
┌──────────────────────────────────────────┐
│  Socket.IO: join-room event              │
│  - Room ID, User Info, Is Initiator      │
└──────────────────────────────────────────┘
    │
    ├─ User A: create WebRTC Peer Connection
    │           + add local media tracks
    │
    └─ Server: notify User B [user-joined]
       User B: create WebRTC Peer Connection
               + add local media tracks
               
User A: create Offer            User B: receive Offer
    ▼                                ▼
Socket.emit('offer')  ────────► Socket.on('offer')
    │                            + create Answer
    │                            │
    └────────────────────────────┘ 
        Socket.emit('answer')
        │
        ├─► Socket.on('answer')
        │    + set remote description
        │
        └─► ICE Candidates exchange via Socket.IO
            │
            ▼
      ✅ CONNECTED: Video/Audio flowing
```

---

## 🛠️ Tech Stack

| Layer | Technology | Deskripsi |
|-------|-----------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | UI rendering, DOM manipulation |
| **Real-time** | Socket.IO | Signaling & bidirectional communication |
| **Video** | WebRTC | P2P video/audio streaming |
| **SFU** | Ion-SFU (optional) | Video relay untuk NAT traversal |
| **Backend** | Node.js + Express.js | Server logic, API endpoints |
| **Database** | MongoDB | User, Room, Settings, Stats storage |
| **Auth** | Session (Web) + JWT (Mobile) | User authentication |
| **iceServers** | STUN/TURN (Coturn) | NAT/Firewall traversal |

---

## 📊 Fitur Utama

### User-side Features
- ✅ **Authentication**: Register, Login, Logout
- ✅ **Video Call**: 1-vs-1 crystal clear video
- ✅ **Audio Controls**: Mute/Unmute microphone
- ✅ **Camera Controls**: On/Off, Switch front/back
- ✅ **Screen Share**: Share desktop/window (beta)
- ✅ **Full Screen**: Maximize video view
- ✅ **Call Stats**: View connection quality & bandwidth
- ✅ **Responsive UI**: Works on desktop & mobile browsers

### Admin Features
- 🔒 **Monitor Users**: See all active users & rooms
- 🔒 **Camera Control**: Disable user's camera (exam mode)
- 🔒 **Audio Control**: Mute user's microphone
- 🔒 **Force Rejoin**: Kick user from room
- 🔒 **Blank Remote**: Hide remote video visually
- 🔒 **System Settings**: Control admin features globally

---

## 📦 Project Structure

```
web-video-call/
├── src/
│   ├── server.js                      # Entry point, Express setup
│   ├── config/
│   │   ├── database.js                # MongoDB connection
│   │   └── webrtc.js                  # ICE servers & SFU config
│   ├── models/
│   │   ├── User.js                    # User schema (username, role, etc)
│   │   ├── Room.js                    # Room schema (participants, etc)
│   │   ├── Stats.js                   # Call statistics storage
│   │   └── Settings.js                # Global system settings
│   ├── routes/
│   │   ├── auth.js                    # Login, Register, Logout
│   │   ├── room.js                    # Room management
│   │   ├── admin.js                   # Admin dashboard
│   │   └── api.js                     # REST API for mobile
│   ├── middleware/
│   │   └── auth.js                    # Authentication checks
│   ├── socket/
│   │   └── socketHandler.js           # Socket.IO event handlers
│   └── views/                         # EJS templates
│       ├── layout.ejs
│       ├── home.ejs
│       ├── room.ejs
│       └── admin/
├── public/
│   ├── js/
│   │   ├── room.js                    # Main room controller
│   │   ├── webrtc.js                  # WebRTC handler class
│   │   ├── ionSFUClient.js            # Ion-SFU client (SFU mode)
│   │   ├── theme.js                   # Dark/Light mode
│   │   ├── videoQualityPresets.js     # Video quality settings
│   │   └── theme.js
│   └── css/
│       ├── style.css
│       ├── room.css
│       └── admin.css
├── dokumentasi/                       # Dokumentasi lengkap
└── package.json                       # Dependencies
```

---

## 🔐 Authentication System

### Web Browser (Session-based)
```
Browser Login Form
   ↓
POST /auth/login
   ↓ Validate credentials, Hash password compare
Server: Create Session
   ↓ Store in MongoDB (connect-mongo)
Server: Set-Cookie (sessionId)
   ↓
Browser: Auto-send sessionId per request
```

### Mobile App (JWT-based)
```
Mobile: Register/Login via API
   ↓
POST /api/auth/login
   ↓ Validate, Generate JWT Token
Server: Return { token, user }
   ↓
Mobile: Store token in memory/secure storage
Socket.IO handshake: Send { auth: { token } }
```

### Socket.IO Middleware Authentication
```
Socket connection attempt
   ↓
Check: socket.request.session.userId (Web)
    OR socket.handshake.auth.token (Mobile)
   ↓
If valid: socket.userId, socket.username set
If invalid: Emit error, reject connection
```

---

## 🌐 Dual Mode WebRTC

### Mode 1: Mesh P2P (Direct Connection)
**Keuntungan**:
- Low latency
- Minimal bandwidth usage on server
- Full end-to-end encryption potential

**Kerugian**:
- NAT/Firewall issues tanpa TURN server
- Higher bandwidth per user (2x for both directions)

**When to use**: 
- Local network (same IP range)
- With TURN server configured
- Low user count

### Mode 2: SFU (Ion-SFU Relay)
**Keuntungan**:
- Works behind any NAT/Firewall
- Server controls bandwidth
- Can extend to group calls easily

**Kerugian**:
- Higher server resource usage
- Slightly higher latency
- Requires Ion-SFU setup

**When to use**:
- Production deployment
- Unreliable network conditions
- Admin control required

**Configuration**:
```env
WEBRTC_MODE=sfu                          # or 'mesh'
ION_SFU_ENABLED=true
ION_SFU_SERVER_URL=wss://sfu.example.com/ws
SFU_SERVER_IP=203.0.113.1
```

---

## 💾 Database Schema

### User Collection
```javascript
{
  _id: ObjectId,
  username: String,              // Unique, 3-20 chars
  email: String,                 // Optional
  password: String,              // bcrypt hashed
  role: 'admin' | 'user',        // Default: 'user'
  displayName: String,           // For UI
  isOnline: Boolean,             // Real-time status
  lastActive: Date,              // Timestamp
  createdAt: Date,
  updatedAt: Date
}
```

### Room Collection
```javascript
{
  _id: ObjectId,
  roomId: String,                // Unique, URL-friendly
  name: String,                  // Room name
  createdBy: ObjectId,           // Ref to User
  participants: [
    {
      user: ObjectId,            // Ref to User
      role: 'admin' | 'user',
      socketId: String,
      joinedAt: Date,
      isMuted: Boolean,          // Remote display state
      isCameraOff: Boolean,       // Remote display state
      actualCameraOn: Boolean     // Actual device state
    }
  ],
  isActive: Boolean,             // Default: true
  maxParticipants: Number,       // Default: 2
  isExamMode: Boolean,           // Admin control enabled
  lastActivity: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Stats Collection
```javascript
{
  _id: ObjectId,
  roomId: String,
  userId: ObjectId,
  username: String,
  sessionId: String,
  connectionType: 'mesh' | 'sfu',
  duration: Number,              // Seconds
  bitrateSent: Number,           // Kbps average
  bitrateReceived: Number,       // Kbps average
  packetLoss: Number,            // Percentage
  latency: Number,               // ms
  stats: Object,                 // Raw WebRTC stats
  startTime: Date,
  endTime: Date,
  createdAt: Date
}
```

### Settings Collection
```javascript
{
  _id: ObjectId,
  key: String,                   // e.g., "adminControlEnabled"
  value: Boolean | String,
  description: String,
  updatedAt: Date
}
```

---

## 🔄 Data Flow

### Saat User Bergabung Room

```
1. User buka browser → /room/:roomId
2. Server: Validasi user authenticated
3. Server: Load room data, render room.ejs
4. Client: Socket.IO connect dengan session/JWT
5. Client: getUserMedia() → request camera/mic
6. Client: emit('join-room') dengan room ID & user info
   
7. Server: Terima join-room event
   - Validasi room & user
   - Update room.participants
   - Set socket.userId, socket.username
   - Emit 'user-joined' ke user lain
   
8. Client (Initiator): Receive user-joined
   - Create WebRTCHandler
   - Create Peer Connection
   - Add local media tracks
   - Emit 'offer' → Server
   
9. Server: Forward 'offer' to other participant
   
10. Client (Receiver): Get offer
    - Create WebRTCHandler
    - Create Peer Connection
    - Add local media tracks
    - Set remoteDescription (offer)
    - Emit 'answer' → Server
    
11. Server: Forward 'answer' to initiator
    
12. Client (Initiator): Get answer
    - Set remoteDescription (answer)
    
13. Both: Exchange ICE candidates via Socket.IO
    
14. ✅ PeerConnection established
    - Remote stream received
    - Video/Audio flowing
    - Stats monitoring starts
```

---

## 🚀 Key Technologies Explanation

### Socket.IO
- **Purpose**: Real-time bidirectional communication
- **Usage**: WebRTC signaling (offer/answer/ICE), media status sync, notifications
- **Benefits**: Fallback to HTTP polling, automatic reconnection

### WebRTC
- **Purpose**: P2P video/audio streaming
- **Components**:
  - **Offer/Answer**: Session description exchange
  - **ICE Candidates**: Network address candidates
  - **Media Tracks**: Audio & Video streams
  - **PeerConnection**: Manages entire connection

### MongoDB Atlas
- **Purpose**: Persistent data storage
- **TTL Index**: Auto-delete old sessions
- **Indexes**: Fast queries on roomId, userId

### Express.js
- **Purpose**: HTTP server, route handling
- **Middleware**: Authentication, session management
- **View Engine**: EJS templates untuk rendering

---

## 🔗 External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18.2 | Web framework |
| socket.io | ^4.6.1 | Real-time communication |
| mongoose | ^8.0.3 | MongoDB ODM |
| bcryptjs | ^2.4.3 | Password hashing |
| jsonwebtoken | ^9.0.3 | JWT auth (mobile) |
| ejs | ^3.1.9 | Template engine |
| express-session | ^1.17.3 | Session management |
| connect-mongo | ^5.1.0 | MongoDB session store |
| dotenv | ^16.3.1 | Environment variables |
| uuid | ^9.0.0 | Generate unique IDs |

---

## 🌍 Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/

# Session
SESSION_SECRET=your-super-secret-key-change-in-production

# WebRTC
WEBRTC_MODE=mesh                                  # or sfu
ION_SFU_ENABLED=false
ION_SFU_SERVER_URL=wss://sfu.example.com/ws
SFU_SERVER_IP=

# STUN/TURN Servers
STUN_SERVER_URL=stun:stun.l.google.com:19302
TURN_SERVER_URL=turn:your-turn.example.com:3478
TURN_USERNAME=username
TURN_PASSWORD=password
```

---

## 📝 Next Section

Lanjut ke file berikutnya untuk detail setup, instalasi, dan deployment:
- [02-SETUP.md](02-SETUP.md) - Setup lokal & requirement
- [03-DATABASE_MODELS.md](03-DATABASE_MODELS.md) - Detail schema
- [04-API_ENDPOINTS.md](04-API_ENDPOINTS.md) - Semua API REST
- [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md) - Socket.IO events
- [06-FRONTEND_ARCHITECTURE.md](06-FRONTEND_ARCHITECTURE.md) - Client-side detail
- [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md) - WebRTC deep dive
- [08-DEPLOYMENT.md](08-DEPLOYMENT.md) - Production deployment

---

**Last Updated**: March 17, 2025
**Version**: 1.0.0
