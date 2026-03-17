# 📖 INDEX & PANDUAN LENGKAP DOKUMENTASI

## 📑 Table of Contents

Dokumentasi ini terdiri dari **8 file komprehensif** yang mencakup semua aspek aplikasi video call website:

| No. | File | Fokus | Audience |
|-----|------|-------|----------|
| 1 | [01-OVERVIEW.md](01-OVERVIEW.md) | Arsitektur & Teknologi | Everyone |
| 2 | [02-SETUP.md](02-SETUP.md) | Installation & Local Dev | Developers |
| 3 | [03-DATABASE_MODELS.md](03-DATABASE_MODELS.md) | Data Structure & Schema | Backend Dev |
| 4 | [04-API_ENDPOINTS.md](04-API_ENDPOINTS.md) | REST API Reference | Mobile Dev |
| 5 | [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md) | Real-time Signaling | All Devs |
| 6 | [06-FRONTEND_ARCHITECTURE.md](06-FRONTEND_ARCHITECTURE.md) | UI & JavaScript | Frontend Dev |
| 7 | [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md) | Media & P2P | WebRTC Dev |
| 8 | [08-DEPLOYMENT.md](08-DEPLOYMENT.md) | Production Setup | DevOps/Admin |

---

## 🚀 Quick Start Guide for Different Roles

### 👨‍💻 Backend Developer (Node.js)

**Reading Order**:
1. Start: [01-OVERVIEW.md](01-OVERVIEW.md) - Understand architecture
2. Setup: [02-SETUP.md](02-SETUP.md) - Getting started
3. Database: [03-DATABASE_MODELS.md](03-DATABASE_MODELS.md) - Data models
4. Server: [04-API_ENDPOINTS.md](04-API_ENDPOINTS.md) - API design
5. Signaling: [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md) - Real-time events

**Key Tasks**:
- ✅ Understand room & user model
- ✅ Learn Socket.IO event flow
- ✅ Study WebRTC signaling process
- ✅ Implement API endpoints correctly
- ✅ Handle connection state changes

---

### 🎨 Frontend Developer (JavaScript)

**Reading Order**:
1. Overview: [01-OVERVIEW.md](01-OVERVIEW.md)
2. Setup: [02-SETUP.md](02-SETUP.md)
3. Frontend: [06-FRONTEND_ARCHITECTURE.md](06-FRONTEND_ARCHITECTURE.md) ⭐
4. WebRTC: [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md)
5. Signaling: [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md)

**Key Tasks**:
- ✅ Understand DOM structure & caching
- ✅ Handle media streams (camera/mic)
- ✅ Manage peer connections
- ✅ Implement control UI
- ✅ Display stats & quality indicators

---

### 📱 Mobile Developer (Flutter/React Native)

**Reading Order**:
1. Overview: [01-OVERVIEW.md](01-OVERVIEW.md) - Architecture
2. API: [04-API_ENDPOINTS.md](04-API_ENDPOINTS.md) ⭐ - REST endpoints
3. Signaling: [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md) ⭐ - Socket events
4. WebRTC: [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md) - Media

**Key Tasks**:
- ✅ Implement REST API client
- ✅ Create Socket.IO connection (JWT auth)
- ✅ Handle WebRTC peer connection
- ✅ Request native camera/microphone
- ✅ Manage audio output (speaker vs earpiece)

---

### 🛠️ DevOps/System Administrator

**Reading Order**:
1. Overview: [01-OVERVIEW.md](01-OVERVIEW.md)
2. Deployment: [08-DEPLOYMENT.md](08-DEPLOYMENT.md) ⭐
3. Setup: [02-SETUP.md](02-SETUP.md) - Requirements

**Key Tasks**:
- ✅ Setup production server
- ✅ Configure SSL/TLS
- ✅ Setup database replica
- ✅ Configure reverse proxy
- ✅ Setup monitoring & alerts
- ✅ Implement backup strategy

---

### 👨‍💼 Project Manager / Product Owner

**Reading Order**:
1. [01-OVERVIEW.md](01-OVERVIEW.md) - High-level architecture
2. [08-DEPLOYMENT.md](08-DEPLOYMENT.md) - Scalability info

**Focus Areas**:
- Understand core features
- Know technology stack
- Understand scalability limits
- Review security checkpoints

---

## 🎯 Common Scenarios

### Scenario 1: Adding a New API Endpoint

**Steps**:
1. Read: [04-API_ENDPOINTS.md](04-API_ENDPOINTS.md) - Response format
2. Read: [03-DATABASE_MODELS.md](03-DATABASE_MODELS.md) - Data structure
3. Edit: `src/routes/api.js` - Add route
4. Edit: `src/models/*.js` - Add query if needed
5. Test: Use cURL examples from [04-API_ENDPOINTS.md](04-API_ENDPOINTS.md)

---

### Scenario 2: Implementing Video Quality Control

**Steps**:
1. Read: [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md) - Bitrate limiting section
2. Edit: `public/js/webrtc.js` - Add setBitrate() method
3. Edit: `public/js/room.js` - Add quality selector UI
4. Test: Monitor bitrate in stats panel

**Code Example**:
```javascript
// In room.js
qualitySelect.addEventListener('change', (e) => {
  const maxKbps = parseInt(e.target.value);
  webrtc.setBitrate(maxKbps);
});
```

---

### Scenario 3: Adding Admin Control Feature

**Steps**:
1. Read: [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md) - Admin events section
2. Edit: `src/socket/socketHandler.js` - Add event handler
3. Edit: `public/js/room.js` - Add UI button
4. Edit: `src/views/room.ejs` - Add button if admin
5. Test: Login as admin user

**Event Flow**:
```
Admin clicks button
    ↓
room.js: socket.emit('admin-disable-camera')
    ↓
socketHandler.js: guards check, forward to user
    ↓
User receives: socket.on('admin-camera-disabled')
    ↓
User's webrtc.disableCameraTrack()
```

---

### Scenario 4: Switching from Mesh to SFU Mode

**Steps**:
1. Read: [01-OVERVIEW.md](01-OVERVIEW.md) - Dual mode section
2. Read: [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md) - SFU section
3. Setup: Install & run Ion-SFU server
4. Edit: `.env` - Set `WEBRTC_MODE=sfu`
5. Edit: `src/config/webrtc.js` - Update SFU URL
6. Test: Check connection in browser console

---

### Scenario 5: Debugging Connection Issues

**Diagnostics Steps**:

1. **Check STUN/TURN**:
   - See [01-OVERVIEW.md](01-OVERVIEW.md) - ICE Servers section
   - Test with: `telnet stun.l.google.com 19302`

2. **Check Socket.IO**:
   - Browser DevTools → Network → WS
   - Look for `/socket.io/?EIO=...` connection
   - Check [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md) for expected events

3. **Check WebRTC State**:
   - Open browser console
   - Look for `[WebRTC]` logs
   - Check `peerConnection.iceConnectionState`

4. **Check Firewall**:
   - See [02-SETUP.md](02-SETUP.md) - Network Requirements
   - Open ports: 3000 (HTTP), 50000-57000 (UDP), 3478 (TURN)

---

## 🔍 Key Concepts Summary

### Authentication Flow

```
Web Browser:
  User fills login form → POST /auth/login → Session created → Stored in MongoDB

Mobile App:
  User calls /api/auth/login → JWT token returned → Store in secure storage
  Socket.IO connect with: { auth: { token } }
```

---

### WebRTC Call Flow

```
1. getUserMedia()        → Get camera/mic
2. createPeerConnection()→ Setup connection
3. addTracks()           → Add media to connection
4. createOffer()         → Generate SDP offer
5. setLocalDescription() → Send our capabilities
6. emit('offer')         → Send via Socket.IO
7. receive('offer')      → Get peer's offer
8. createAnswer()        → Generate response
9. emit('answer')        → Send via Socket.IO
10. Exchange ICE candidates via Socket.IO
11. ✅ Connected!        → Video/audio flowing
```

---

### Database Models Relationship

```
User (many) ──┐
              ├──→ Room (one)
              │
              └──→ Session (many)

Room (one) ────→ Participants (array of users)

Stats (one) ────→ User, Room (references)

Settings (global) ──→ System-wide configuration
```

---

## 📚 Detailed Sections by Topic

### 🔐 Security

**Files**: [02-SETUP.md](02-SETUP.md), [08-DEPLOYMENT.md](08-DEPLOYMENT.md)

Topics covered:
- Password hashing with bcryptjs
- Session management & TTL
- JWT token validation
- HTTPS/SSL requirement
- CORS configuration
- Admin control guards

**Action Items**:
- [ ] Generate strong SESSION_SECRET
- [ ] Keep API keys in .env only
- [ ] Enable HTTPS in production
- [ ] Setup firewall rules
- [ ] Regular security audits

---

### ⚡ Performance

**Files**: [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md), [08-DEPLOYMENT.md](08-DEPLOYMENT.md)

Topics covered:
- Bitrate limiting
- Codec selection
- Memory management
- DOM caching
- Database indexing
- Load balancing

**Benchmarks**:
- Time to first video: < 3 seconds
- Latency: 50-200ms
- CPU per connection: < 30%
- Memory per connection: < 100MB

---

### 🔧 Troubleshooting

**Common Issues**:

| Problem | Solution | Reference |
|---------|----------|-----------|
| No camera access | Check HTTPS, browser permissions | [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md#11-cleanup--disconnection) |
| Black remote video | Check ICE candidates, firewall | [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md#4-ice-candidate-handling) |
| Audio routing wrong | Mobile app limitation, use native | [06-FRONTEND_ARCHITECTURE.md](06-FRONTEND_ARCHITECTURE.md#️-audio-output-control-mobile) |
| Port already in use | Kill process on port 3000 | [02-SETUP.md](02-SETUP.md#troubleshooting-setup) |
| Connection timeout | Setup TURN server | [08-DEPLOYMENT.md](08-DEPLOYMENT.md#6-turn-server-for-mesh-mode) |

---

## 🛠️ Building Flutter App - Key Differences

Since anda akan membuat versi Flutter, perhatikan:

### 1. **Authentication** (Sama)
- Use `/api/auth/login` & `/api/auth/register`
- Store JWT token securely (secure_storage package)
- Include token di setiap API request

### 2. **WebRTC Setup** (Similar)
- Use `flutter_webrtc` package
- Same PeerConnection setup (RTCPeerConnection)
- Same offer/answer/ICE candidate flow

### 3. **Socket.IO** (Same)
- Use `socket_io_client` package
- Same events: join-room, offer, answer, ice-candidate
- Same authentication: pass JWT in handshake auth

### 4. **Media Handling** (Different - Native)
```dart
// Don't use HTML5 video element
// Use: RTCVideoView from flutter_webrtc
RTCVideoView(
  _remoteRenderer,
  objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
)
```

### 5. **Permissions** (Native)
```dart
// Request camera/mic permissions
import 'package:permission_handler/permission_handler.dart';

await Permission.camera.request();
await Permission.microphone.request();
```

### 6. **Audio Output** (Full Control - Advantage!)
```dart
// Flutter can control speaker vs earpiece!
await webRTC.selectAudioOutput(AudioOutput.speaker);
await webRTC.selectAudioOutput(AudioOutput.earpiece);
```

### 7. **Background Handling** (Important)
```dart
// Handle app lifecycle: pause/resume
@override
void didChangeAppLifecycleState(AppLifecycleState state) {
  if (state == AppLifecycleState.paused) {
    // Pause video transmission
    webrtc.pauseVideo();
  } else if (state == AppLifecycleState.resumed) {
    // Resume
    webrtc.resumeVideo();
  }
}
```

### 8. **Video Rendering** (Different)
```dart
// Web: HTML video element
// Flutter: RTCVideoView widget

// Mobile advantage: Can show video while app in background (via native)
```

---

## 🎓 Learning Path

### Week 1: Fundamentals
- [ ] Read [01-OVERVIEW.md](01-OVERVIEW.md)
- [ ] Run local setup [02-SETUP.md](02-SETUP.md)
- [ ] Make first video call

### Week 2: Understanding Code
- [ ] Study [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md)
- [ ] Trace offer/answer flow
- [ ] Add debugging logs

### Week 3: Features
- [ ] Implement admin controls
- [ ] Add quality selector
- [ ] Test screen sharing

### Week 4: Mobile
- [ ] Design Flutter app UI
- [ ] Implement WebRTC connection
- [ ] Test Socket.IO integration

### Week 5: Production
- [ ] Setup staging server
- [ ] Configure monitoring
- [ ] Load test
- [ ] Deploy to production

---

## 📞 Support & References

### Internal Documentation

This documentation covers:
- ✅ System architecture
- ✅ API documentation
- ✅ WebRTC implementation
- ✅ Deployment guide
- ✅ Troubleshooting

### External Resources

- [WebRTC MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Express.js Guide](https://expressjs.com/)
- [Mongoose ORM](https://mongoosejs.com/)
- [Flutter WebRTC](https://pub.dev/packages/flutter_webrtc)

---

## 📝 Notes untuk Pembuat Aplikasi Mobile

### Checklist Before Starting Flutter App

- [ ] Understand all 8 documentation files
- [ ] Familiarize with REST API endpoints
- [ ] Understand Socket.IO event flow
- [ ] Know WebRTC signaling sequence
- [ ] Test website version thoroughly
- [ ] Setup development environment (Flutter SDK)
- [ ] Review firebase/google services setup
- [ ] Plan push notification strategy

### Most Important Files to Reference

1. **API Reference**: [04-API_ENDPOINTS.md](04-API_ENDPOINTS.md)
   - Used for: Login, Register, Room creation, Profile fetch

2. **Socket Events**: [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md)
   - Used for: Real-time signaling (offer/answer/ICE)

3. **WebRTC Deep Dive**: [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md)
   - Used for: Media stream handling, peer connection management

4. **Frontend Architecture**: [06-FRONTEND_ARCHITECTURE.md](06-FRONTEND_ARCHITECTURE.md)
   - Reference for: UI flow, state management, error handling

---

## ✅ Completion Checklist

- [x] Overview & architecture documented
- [x] Setup & installation guide created
- [x] Database models documented
- [x] API endpoints documented
- [x] Socket.IO events documented
- [x] Frontend architecture documented
- [x] WebRTC implementation documented
- [x] Deployment guide created
- [x] This index & guide completed

---

**Total Documentation**: ~10,000+ lines
**Coverage**: 100% of website application
**Last Updated**: March 17, 2025
**Version**: 1.0.0

---

## 📊 Quick Reference Card

### Technology Stack
```
Frontend:  HTML5, CSS3, Vanilla JavaScript, Socket.IO Client
Backend:   Node.js, Express.js, Socket.IO
Database:  MongoDB (Atlas or self-hosted)
Real-time: Socket.IO (WebSocket)
Media:     WebRTC (P2P or SFU via Ion-SFU)
Auth:      Session (Web) + JWT (Mobile)
```

### Port Numbers
```
3000:      App server
3478:      TURN server (UDP/TCP)
19302:     Google STUN
27017:     MongoDB (if local)
```

### Key URLs
```
http://localhost:3000       - Development
https://yourdomain.com      - Production
MongoDB Atlas              - Database (cloud)
Ion-SFU server            - Media relay (optional)
```

### Important Environment Variables
```
NODE_ENV, MONGODB_URI, SESSION_SECRET
WEBRTC_MODE, TURN_SERVER_URL
STUN_SERVER_URL
```

---

**Selamat belajar dan semoga dokumentasi ini membantu dalam membuat versi mobile aplikasi! 🚀**

