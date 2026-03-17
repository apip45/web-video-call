# 🔧 Setup & Instalasi - Video Call Website

## Prerequisite

### System Requirements
- **Node.js**: v16+ (preferably v18 LTS)
- **npm**: v8+ or yarn
- **MongoDB**: Atlas (cloud) atau local v5.0+
- **Git**: For version control
- **dotenv**: Environment variable management

### Browser Support
| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 70+ | ✅ Full support |
| Firefox | 78+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 79+ | ✅ Full support |
| Mobile Chrome | Latest | ✅ Full support |
| Mobile Safari | iOS 14+ | ✅ Full support |

---

## 🚀 Installation Steps

### 1. Clone Repository
```bash
cd c:\Users\umria\Documents\code\Full-Stack\wcl
git clone <repository-url>
cd web-video-call
```

### 2. Install Dependencies
```bash
npm install
# atau jika menggunakan yarn
yarn install
```

Packages yang akan diinstall:
- **bcryptjs** - Password hashing
- **connect-mongo** - MongoDB session store
- **dotenv** - Environment variables
- **ejs** - Template engine
- **express** - Web framework
- **express-session** - Session middleware
- **jsonwebtoken** - JWT authentication
- **mongoose** - MongoDB ORM
- **socket.io** - Real-time communication
- **uuid** - ID generation
- **nodemon** - Auto-reload (dev only)

### 3. Setup MongoDB

#### Option A: MongoDB Atlas (Cloud - Recommended)
```bash
1. Register di https://www.mongodb.com/cloud/atlas
2. Create cluster (Free tier available)
3. Get connection string:
   mongodb+srv://username:password@cluster.mongodb.net/
4. Whitelist IP address Anda (atau allow all)
5. Copy connection string
```

#### Option B: Local MongoDB
```bash
# Install MongoDB
# Windows: Download dari https://www.mongodb.com/try/download/community
# macOS: brew install mongodb-community
# Linux: sudo apt-get install -y mongodb

# Start service
net start MongoDB        # Windows
brew services start mongodb-community  # macOS
sudo systemctl start mongod  # Linux

# Test connection
mongo --version
```

### 4. Environment Configuration

Create `.env` file di root directory:
```env
# =======================
# SERVER CONFIGURATION
# =======================
NODE_ENV=development
PORT=3000

# =======================
# DATABASE
# =======================
MONGODB_URI=mongodb+srv://your_username:your_password@cluster.mongodb.net/

# =======================
# SESSION
# =======================
SESSION_SECRET=your-secret-key-min-32-chars-change-in-production

# =======================
# WEBRTC CONFIGURATION
# =======================
WEBRTC_MODE=mesh                    # 'mesh' atau 'sfu'

# SFU Configuration (jika ION_SFU_ENABLED=true)
ION_SFU_ENABLED=false
ION_SFU_SERVER_URL=wss://sfu.yourdomain.com/ws
SFU_SERVER_IP=203.0.113.1

# =======================
# STUN/TURN SERVERS
# =======================
STUN_SERVER_URL=stun:stun.l.google.com:19302

# TURN Server (gunakan Coturn untuk produksi)
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=turnuser
TURN_PASSWORD=turnpassword
TURN_SERVER_PROTOCOL=tcp              # atau 'udp'

# =======================
# FALLBACK
# =======================
WEBRTC_FALLBACK_TO_MESH=true         # Fallback ke mesh jika SFU gagal
```

**⚠️ PENTING**: Jangan commit `.env` file! Gunakan `.env.example`:
```bash
cp .env .env.example
# Edit .env.example dan hapus values sensitif
git add .env.example
```

### 5. Run Development Server

```bash
# Development mode (dengan auto-reload)
npm run dev

# atau langsung
nodemon src/server.js

# Output yang diharapkan:
# [DB] ✅ MongoDB Connected: cluster.mongodb.net
# [Server] 🚀 Server running on http://localhost:3000
```

### 6. Test Application

Open browser: `http://localhost:3000`
```
1. Register akun baru
   - Username: testuser1
   - Email: test1@example.com
   - Password: password123

2. Create room
2. Open second browser/incognito
   - Register: testuser2
   - Join room yang sama
   
3. ✅ Video call harus berfungsi
```

---

## 🛠️ Development Setup

### Recommended VS Code Extensions
```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "mongodb.mongodb-vscode",
    "gruntfuggly.todo-tree"
  ]
}
```

### Package.json Scripts
```json
{
  "scripts": {
    "start": "node src/server.js",           // Production
    "dev": "nodemon src/server.js",         // Development
    "test": "jest --coverage",              // Unit tests (future)
    "lint": "eslint src/",                  // Linting (future)
    "format": "prettier --write ."          // Code formatting (future)
  }
}
```

### Development Workflow

```bash
# Terminal 1: Backend server
npm run dev

# Terminal 2: Open browser
# Automatically refreshes saat ada code changes (nodemon)

# Terminal 3: Monitor MongoDB (optional)
mongosh --uri "mongodb+srv://..."
```

### Debug Logging

Saat development, lihat console output:
```
[DB] ✅ MongoDB Connected: ...
[Socket] 🔌 Connection authorized (session): testuser
[Socket] ✅ Connected: testuser (socket-id)
[Room] 📝 Creating room: abc123
[WebRTC] 🎯 Mode: MESH
[WebRTC] 🔧 Handler initialized
```

---

## 📊 Database Setup Detailed

### Create Collections & Indexes

Mongoose akan auto-create collections, tapi untuk optimization:

```javascript
// src/config/database.js sudah handle ini, tapi referensi:

// Users collection
db.users.createIndex({ username: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { sparse: true, unique: true })

// Rooms collection
db.rooms.createIndex({ roomId: 1 }, { unique: true })
db.rooms.createIndex({ createdBy: 1 })
db.rooms.createIndex({ lastActivity: 1 })

// Sessions collection (auto-managed oleh connect-mongo)
db.sessions.createIndex({ 'session.lastActivity': 1 }, { expireAfterSeconds: 7200 })

// Stats collection
db.stats.createIndex({ roomId: 1 })
db.stats.createIndex({ userId: 1 })
```

---

## 🔌 Network Requirements

### Ports & Firewall

| Port | Protocol | Purpose | Direction |
|------|----------|---------|-----------|
| 3000 | TCP | HTTP/WebSocket | Inbound |
| 50000-57000 | UDP | WebRTC media | Both |
| 19302 | UDP | Google STUN | Outbound |
| 3478 | TCP/UDP | TURN server | Both |

### Firewall Rules (iptables example)
```bash
# Allow HTTP/WebSocket
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT

# Allow WebRTC media (range)
sudo iptables -A INPUT -p udp --dport 50000:57000 -j ACCEPT

# Save rules
sudo netfilter-persistent save
```

---

## 🧪 Testing Checklist

### Local Testing
- [ ] Register 2 pengguna berbeda
- [ ] Create room dari user 1
- [ ] User 2 join room yang sama
- [ ] Video call berfungsi
- [ ] Audio mute/unmute works
- [ ] Camera on/off works
- [ ] Screen share works (beta)
- [ ] Stats panel shows connection quality
- [ ] Fullscreen mode works
- [ ] End call properly cleans up

### Network Testing (Multi-device)
```bash
# 1. Get local IP
ipconfig                    # Windows
# atau lihat ip address di network settings

# 2. Replace localhost dengan IP
http://192.168.1.100:3000

# 3. Test dari:
- Desktop browser
- Mobile Chrome/Safari
- Different network (jika ada)
```

### Performance Testing

```bash
# Monitor memory usage
node --max-old-space-size=2048 src/server.js

# Monitor CPU
npm run dev           # Lihat CPU usage di Task Manager

# Load testing (untuk SFU mode)
# Gunakan tool seperti Apache JMeter atau Locust
```

---

## 🚨 Troubleshooting Setup

### Issue: EADDRINUSE - Port 3000 already in use
```bash
# Linux/macOS
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: MongoDB Connection Timeout
```bash
# Check MongoDB Atlas:
1. IP Whitelist - add 0.0.0.0/0 atau specific IP
2. Network Access - enable
3. Connection string - verify username & password
4. Test koneksi manual:
   mongo mongodb+srv://user:pass@cluster.mongodb.net/test
```

### Issue: WebRTC no connection (P2P fails)
```bash
# Possible causes:
1. STUN server not reachable
   - Test: telnet stun.l.google.com 19302
2. Firewall blocking UDP ports
3. NAT issues without TURN server

# Solution:
- Setup TURN server (Coturn)
- atau switch ke SFU mode
```

### Issue: Socket.IO connection refused
```bash
# Check CORS configuration (src/server.js):
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://192.168.1.100:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

# Jika development, set origin: true untuk test
```

### Issue: Camera/Mic permission denied
```javascript
// Browser security - user harus approve
// Tidak bisa di-override dari code

// Fallback:
navigator.mediaDevices.getUserMedia()
  .catch(err => {
    if (err.name === 'NotAllowedError') {
      console.log('User denied permission');
    }
  });
```

---

## 📦 Production Deployment Preview

> Detailed di [08-DEPLOYMENT.md](08-DEPLOYMENT.md)

Quick checklist:
- [ ] NODE_ENV=production di server
- [ ] Generate secure SESSION_SECRET
- [ ] SSL Certificate (HTTPS required untuk getUserMedia)
- [ ] TURN server setup (untuk NAT traversal)
- [ ] MongoDB backup & replication
- [ ] Nginx reverse proxy
- [ ] PM2 process manager
- [ ] Environment variables di server

---

## 🔗 Useful Resources

### Documentation
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.IO Guide](https://socket.io/docs/v4/)
- [Express.js Documentation](https://expressjs.com/)
- [Mongoose ODM](https://mongoosejs.com/)

### Icons & Assets
- [Font Awesome Icons](https://fontawesome.com/) - UI icons
- [W3.CSS](https://www.w3schools.com/w3css/) - CSS framework

### Tools untuk Testing
- [netcat](http://netcat.sourceforge.net/) - Network testing
- [Wireshark](https://www.wireshark.org/) - Packet analyzer
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - Browser debugging

---

## ✅ Next Steps

1. ✅ Installation complete
2. 📖 Read [03-DATABASE_MODELS.md](03-DATABASE_MODELS.md) untuk understand data structure
3. 🔌 Explore [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md) untuk signaling events
4. 🎥 Dive into [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md)

---

**Last Updated**: March 17, 2025
**Version**: 1.0.0
