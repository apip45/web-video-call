# 📚 API Reference - Quick Lookup Guide

## Ringkasan Semua Endpoints dan Methods

---

## 🔐 Authentication Endpoints

### **POST /auth/register**
Register akun baru

```
Request:
POST /auth/register
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123",
  "name": "John Doe"
}

Response: 201 Created
{
  "user": {
    "_id": "user123",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2025-03-17T10:00:00Z"
  },
  "token": "jwt_token_here"
}
```

---

### **POST /auth/login**
Login dengan email dan password

```
Request:
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response: 200 OK
{
  "user": {
    "_id": "user123",
    "email": "john@example.com",
    "name": "John Doe"
  },
  "token": "jwt_token_here"
}

Error: 401 Unauthorized
{
  "error": "Invalid email or password"
}
```

---

### **POST /auth/logout**
Logout dan invalidate token

```
Request:
POST /auth/logout
Authorization: Bearer jwt_token_here

Response: 200 OK
{
  "message": "Logged out successfully"
}
```

---

### **POST /auth/refresh**
Refresh JWT token

```
Request:
POST /auth/refresh
Content-Type: application/json

{
  "token": "jwt_token_here"
}

Response: 200 OK
{
  "token": "new_jwt_token_here",
  "expiresIn": 86400
}
```

---

### **GET /auth/me**
Get current user profile

```
Request:
GET /auth/me
Authorization: Bearer jwt_token_here

Response: 200 OK
{
  "_id": "user123",
  "email": "john@example.com",
  "name": "John Doe",
  "role": "user",
  "createdAt": "2025-03-17T10:00:00Z"
}
```

---

## 🏠 Room Endpoints

### **POST /rooms**
Create new room

```
Request:
POST /rooms
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "name": "Team Meeting Room",
  "description": "For daily standup",
  "maxParticipants": 50
}

Response: 201 Created
{
  "_id": "room123",
  "name": "Team Meeting Room",
  "description": "For daily standup",
  "createdBy": "user123",
  "maxParticipants": 50,
  "currentParticipants": 1,
  "createdAt": "2025-03-17T10:00:00Z"
}
```

---

### **GET /rooms**
Get all rooms created by user

```
Request:
GET /rooms
Authorization: Bearer jwt_token_here

Response: 200 OK
{
  "rooms": [
    {
      "_id": "room123",
      "name": "Team Meeting Room",
      "currentParticipants": 5,
      "maxParticipants": 50,
      "isLocked": false,
      "createdAt": "2025-03-17T10:00:00Z"
    }
  ]
}
```

---

### **GET /rooms/:roomId**
Get room details

```
Request:
GET /rooms/room123
Authorization: Bearer jwt_token_here

Response: 200 OK
{
  "_id": "room123",
  "name": "Team Meeting Room",
  "description": "For daily standup",
  "createdBy": "user123",
  "maxParticipants": 50,
  "currentParticipants": 5,
  "participants": [
    {
      "userId": "user456",
      "userName": "Jane Smith",
      "joinedAt": "2025-03-17T10:05:00Z"
    }
  ],
  "isLocked": false,
  "createdAt": "2025-03-17T10:00:00Z"
}
```

---

### **PUT /rooms/:roomId**
Update room settings

```
Request:
PUT /rooms/room123
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "name": "Updated Room Name",
  "maxParticipants": 100,
  "isLocked": true
}

Response: 200 OK
{
  "message": "Room updated successfully",
  "room": { ... }
}
```

---

### **DELETE /rooms/:roomId**
Delete room

```
Request:
DELETE /rooms/room123
Authorization: Bearer jwt_token_here

Response: 200 OK
{
  "message": "Room deleted successfully"
}
```

---

### **POST /rooms/:roomId/join**
Join room

```
Request:
POST /rooms/room123/join
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "deviceInfo": {
    "userAgent": "Flutter/WebRTC",
    "type": "mobile"
  }
}

Response: 200 OK
{
  "roomId": "room123",
  "userId": "user456",
  "socketId": "socket_id_here",
  "existingPeers": ["user123", "user789"],
  "server": {
    "signalingUrl": "wss://api.example.com"
  }
}
```

---

### **POST /rooms/:roomId/leave**
Leave room

```
Request:
POST /rooms/room123/leave
Authorization: Bearer jwt_token_here

Response: 200 OK
{
  "message": "Left room successfully",
  "roomId": "room123"
}
```

---

## 📊 Statistics Endpoints

### **GET /stats/room/:roomId**
Get room statistics

```
Request:
GET /stats/room/room123
Authorization: Bearer jwt_token_here

Response: 200 OK
{
  "roomId": "room123",
  "totalParticipants": 10,
  "currentParticipants": 5,
  "averageSessionDuration": "2h 45m",
  "peakParticipants": 12,
  "createdAt": "2025-03-17T10:00:00Z",
  "averageQualityScore": 4.5
}
```

---

### **POST /stats/record**
Record call statistics

```
Request:
POST /stats/record
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "roomId": "room123",
  "peerId": "peer456",
  "stats": {
    "fps": 30,
    "bitrate": 1500,
    "latency": 45,
    "packetsLost": 0,
    "cpuUsage": 35,
    "memoryUsage": 256,
    "timestamp": 1710754800000
  }
}

Response: 201 Created
{
  "message": "Statistics recorded successfully"
}
```

---

### **GET /stats/user/:userId**
Get user call statistics

```
Request:
GET /stats/user/user123
Authorization: Bearer jwt_token_here

Response: 200 OK
{
  "userId": "user123",
  "totalCalls": 45,
  "totalDuration": "50h 30m",
  "averageQuality": {
    "fps": 28.5,
    "bitrate": 1450,
    "latency": 52
  },
  "device": "mobile",
  "browser": "Chrome"
}
```

---

## 🎥 WebRTC Signaling Endpoints

### **POST /webrtc/offer**
Send WebRTC offer (via REST fallback)

```
Request:
POST /webrtc/offer
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "to": "peer456",
  "from": "user123",
  "roomId": "room123",
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- ... (full SDP)"
  }
}

Response: 200 OK
{
  "message": "Offer sent successfully"
}
```

---

### **POST /webrtc/answer**
Send WebRTC answer

```
Request:
POST /webrtc/answer
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "to": "peer456",
  "from": "user123",
  "roomId": "room123",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- ... (full SDP)"
  }
}

Response: 200 OK
{
  "message": "Answer sent successfully"
}
```

---

## 👨‍💼 Admin Endpoints

### **GET /admin/rooms-stats**
Get statistics for all rooms (Admin only)

```
Request:
GET /admin/rooms-stats
Authorization: Bearer jwt_token_here (Admin token)

Response: 200 OK
[
  {
    "roomId": "room123",
    "name": "Team Meeting",
    "createdBy": "user123",
    "participantCount": 5,
    "maxParticipants": 50,
    "duration": "1h 30m",
    "isActive": true
  }
]
```

---

### **POST /admin/rooms/:roomId/participants/:userId/control**
Control participant features

```
Request:
POST /admin/rooms/room123/participants/user456/control
Authorization: Bearer jwt_token_here (Admin token)
Content-Type: application/json

{
  "cameraAllowed": false,
  "audioAllowed": true,
  "screenShareAllowed": false,
  "chatAllowed": true
}

Response: 200 OK
{
  "message": "Participant controls updated"
}
```

---

### **POST /admin/rooms/:roomId/participants/:userId/kick**
Remove participant from room

```
Request:
POST /admin/rooms/room123/participants/user456/kick
Authorization: Bearer jwt_token_here (Admin token)

Response: 200 OK
{
  "message": "User kicked from room"
}
```

---

### **POST /admin/rooms/:roomId/mute-all-audio**
Mute all participants

```
Request:
POST /admin/rooms/room123/mute-all-audio
Authorization: Bearer jwt_token_here (Admin token)

Response: 200 OK
{
  "message": "All participants muted"
}
```

---

### **POST /admin/rooms/:roomId/lock**
Lock room (prevent new joins)

```
Request:
POST /admin/rooms/room123/lock
Authorization: Bearer jwt_token_here (Admin token)

Response: 200 OK
{
  "message": "Room locked"
}
```

---

### **POST /admin/rooms/:roomId/unlock**
Unlock room

```
Request:
POST /admin/rooms/room123/unlock
Authorization: Bearer jwt_token_here (Admin token)

Response: 200 OK
{
  "message": "Room unlocked"
}
```

---

### **GET /admin/stats**
Get overall admin statistics

```
Request:
GET /admin/stats
Authorization: Bearer jwt_token_here (Admin token)

Response: 200 OK
{
  "totalRooms": 150,
  "activeRooms": 24,
  "totalUsers": 500,
  "activeUsers": 120,
  "ongoingCalls": 45,
  "totalCallHours": 12500,
  "averageCallDuration": "45m",
  "peakConcurrentUsers": 200
}
```

---

## 📝 Settings Endpoints

### **GET /settings/preferences**
Get user preferences

```
Request:
GET /settings/preferences
Authorization: Bearer jwt_token_here

Response: 200 OK
{
  "theme": "dark",
  "language": "en",
  "notificationsEnabled": true,
  "autoJoinEnabled": false,
  "videoQualityPreference": "high",
  "audioInput": "default",
  "audioOutput": "speaker"
}
```

---

### **PUT /settings/preferences**
Update user preferences

```
Request:
PUT /settings/preferences
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "theme": "light",
  "videoQualityPreference": "medium",
  "notificationsEnabled": true
}

Response: 200 OK
{
  "message": "Preferences updated successfully"
}
```

---

## 🔄 Socket.IO Event Quick Reference

| Event | Direction | Purpose |
|-------|-----------|---------|
| `connect` | Server→Client | Connection established |
| `joinRoom` | Client→Server | Request to join room |
| `existingPeers` | Server→Client | List of peers in room |
| `userJoined` | Server→Clients | New user joined |
| `userLeft` | Server→Clients | User left room |
| `offer` | Client→Server→Client | WebRTC offer |
| `answer` | Client→Server→Client | WebRTC answer |
| `iceCandidate` | Client→Server→Client | ICE candidate |
| `callStats` | Client→Server | Call quality statistics |
| `admin:muteAudio` | Admin→Server→Client | Mute user audio |
| `admin:disableCamera` | Admin→Server→Client | Disable user camera |
| `screenShareStart` | Client→Server→Clients | User started sharing |
| `chatMessage` | Client→Server→Clients | Chat message |

---

## 🔒 Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Verify JWT token |
| 403 | Forbidden | Check user permissions |
| 404 | Not Found | Verify resource ID |
| 409 | Conflict | Room already exists / User already in room |
| 429 | Too Many Requests | Wait before retrying |
| 500 | Server Error | Check server logs |
| 503 | Service Unavailable | Server is down, retry later |

---

## 📦 Common Response Headers

```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
X-Request-ID: <unique_request_id>
X-Response-Time: <milliseconds>
```

---

## 🧪 Testing with cURL

### **Login**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### **Create Room**
```bash
curl -X POST http://localhost:3000/rooms \
  -H "Authorization: Bearer jwt_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Room",
    "maxParticipants": 50
  }'
```

### **Join Room**
```bash
curl -X POST http://localhost:3000/rooms/room123/join \
  -H "Authorization: Bearer jwt_token_here" \
  -H "Content-Type: application/json"
```

---

## 🔗 References

- **API Base URL**: `http://api.example.com` (HTTP) / `wss://api.example.com` (WebSocket)
- **Socket.IO Namespace**: `/` (default)
- **API Documentation**: See `04-API_INTEGRATION.md`
- **Socket Events**: See `06-WEBSOCKET_EVENTS.md`

---

**Last Updated**: March 17, 2025
**API Version**: v1.0
**Status**: Complete Reference

