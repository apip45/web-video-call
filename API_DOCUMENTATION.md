# 📱 API Documentation - Mobile App Integration

## Overview
REST API endpoints untuk aplikasi mobile Flutter. Server sekarang mendukung dua tipe autentikasi:
- **Session-based** (untuk web browser)
- **JWT-based** (untuk mobile app)

Base URL: `https://calls.mikan.my.id`

---

## Authentication

### Register (Mobile)
**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (201):**
```json
{
  "message": "Registrasi berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "johndoe",
    "role": "user"
  }
}
```

**Error Responses:**
- `400` - Username atau email sudah digunakan
- `400` - Password minimal 6 karakter
- `500` - Server error

---

### Login (Mobile)
**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "message": "Login berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "johndoe",
    "role": "user"
  }
}
```

**Error Responses:**
- `401` - Username atau password salah
- `500` - Server error

---

### Get Current User
**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "johndoe",
    "role": "user",
    "isOnline": true
  }
}
```

**Error Responses:**
- `401` - Token tidak ditemukan
- `403` - Token tidak valid
- `404` - User tidak ditemukan

---

## Room Management

### Create Room
**Endpoint:** `POST /api/room/create`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Meeting Room"
}
```

**Success Response (201):**
```json
{
  "message": "Room berhasil dibuat",
  "room": {
    "id": "507f1f77bcf86cd799439011",
    "roomId": "ABC12345",
    "name": "Meeting Room",
    "host": "507f1f77bcf86cd799439011",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `401` - Token tidak valid
- `500` - Server error

---

### Get Room Info
**Endpoint:** `GET /api/room/:roomId`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "room": {
    "id": "507f1f77bcf86cd799439011",
    "roomId": "ABC12345",
    "name": "Meeting Room",
    "host": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "displayName": "John Doe"
    },
    "isActive": true,
    "participants": [
      {
        "user": "507f1f77bcf86cd799439011",
        "socketId": "abc123",
        "role": "user",
        "joinedAt": "2024-01-15T10:35:00.000Z"
      }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `401` - Token tidak valid
- `404` - Room tidak ditemukan
- `500` - Server error

---

## WebRTC Signaling (Socket.IO)

### Connection
**URL:** `wss://calls.mikan.my.id`

**Authentication:**
```dart
IO.io(
  'https://calls.mikan.my.id',
  IO.OptionBuilder()
    .setAuth({'token': 'JWT_TOKEN_HERE'})
    .setTransports(['websocket'])
    .build()
);
```

### Events

#### Client → Server

**join-room**
```json
{
  "roomId": "ABC12345",
  "userId": "507f1f77bcf86cd799439011",
  "username": "johndoe"
}
```

**offer**
```json
{
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- ..."
  },
  "targetSocketId": "abc123"
}
```

**answer**
```json
{
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- ..."
  },
  "targetSocketId": "abc123"
}
```

**ice-candidate**
```json
{
  "candidate": {
    "candidate": "candidate:...",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  },
  "targetSocketId": "abc123"
}
```

#### Server → Client

**user-joined**
```json
{
  "socketId": "abc123",
  "username": "janedoe",
  "role": "user"
}
```

**user-left**
```json
{
  "socketId": "abc123"
}
```

**offer**
```json
{
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- ..."
  },
  "senderSocketId": "abc123"
}
```

**answer**
```json
{
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- ..."
  },
  "senderSocketId": "abc123"
}
```

**ice-candidate**
```json
{
  "candidate": {
    "candidate": "candidate:...",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  },
  "senderSocketId": "abc123"
}
```

---

## Cross-Platform Communication

### Web ↔️ Mobile
Server sekarang mendukung komunikasi antara:
- **Web client** (session-based auth) ↔️ **Mobile app** (JWT-based auth)
- **Mobile app** ↔️ **Mobile app**
- **Web client** ↔️ **Web client**

Semua menggunakan Socket.IO untuk WebRTC signaling dan TURN/STUN servers yang sama:
- TURN: `turn.mikan.my.id:3478` (UDP)
- TURN: `turn.mikan.my.id:80` (TCP)
- TURN: `turn.mikan.my.id:5349` (TLS)
- STUN: `stun.l.google.com:19302`

---

## Error Handling

Semua API endpoints menggunakan format error response yang konsisten:

```json
{
  "message": "Deskripsi error"
}
```

HTTP Status Codes:
- `200` - OK
- `201` - Created
- `400` - Bad Request (validasi error)
- `401` - Unauthorized (token tidak ada)
- `403` - Forbidden (token tidak valid)
- `404` - Not Found
- `500` - Internal Server Error

---

## Testing

### Test Login
```bash
curl -X POST https://calls.mikan.my.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Test Create Room
```bash
curl -X POST https://calls.mikan.my.id/api/room/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"name":"Test Room"}'
```

---

## Implementation Notes

### JWT Token
- Token expires in 7 days
- Token contains: `userId`, `username`, `role`
- Secret key: `process.env.SESSION_SECRET`

### Socket.IO Authentication
Server memeriksa autentikasi dalam urutan:
1. Session cookie (web)
2. JWT token in `auth.token` (mobile)

Jika keduanya tidak ada, koneksi ditolak.

### Security
- Passwords di-hash dengan bcryptjs
- JWT tokens menggunakan HS256 algorithm
- HTTPS untuk production
- WebSocket secure (wss://) untuk production
