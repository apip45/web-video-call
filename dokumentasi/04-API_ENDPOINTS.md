# 🔌 API Endpoints & REST Routes

## Overview

Aplikasi ini menyediakan **dua layer komunikasi**:

1. **HTTP REST API** (`/api/*`) - Untuk mobile app & external integration
2. **Socket.IO** - Untuk real-time signaling (browser & mobile)
3. **Traditional Routes** (`/auth/*`, `/room/*`, `/admin/*`) - Untuk web browser

---

## Base URL

```
Development: http://localhost:3000
Production:  https://yourdomain.com
```

---

## 🔐 Authentication

### Web (Session-based)
All traditional routes automatically authenticated via Express Session.

### Mobile (JWT-based)
```
Header: Authorization: Bearer <token>
```

JWT Token diperoleh dari `/api/auth/login` atau `/api/auth/register`
- **Expires**: 7 days
- **Payload**: { userId, username, role }

---

## 📋 REST API Endpoints (`/api/*)

### Authentication

#### POST `/api/auth/register`
Register pengguna baru

**Request**:
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

**Response** (201 Created):
```json
{
  "message": "Registrasi berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser",
    "email": "test@example.com",
    "displayName": "testuser",
    "role": "user"
  }
}
```

**Error** (400 Bad Request):
```json
{
  "message": "Username sudah digunakan"
}
```

**Validation Rules**:
- Username: 3-20 chars, alphanumeric
- Email: Valid email format
- Password: Min 6 chars

---

#### POST `/api/auth/login`
Login dengan credentials

**Request**:
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "message": "Login berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser",
    "email": "test@example.com",
    "displayName": "testuser",
    "role": "user"
  }
}
```

**Error** (401 Unauthorized):
```json
{
  "message": "Username atau password salah"
}
```

---

#### POST `/api/auth/logout`
Logout & invalidate token (mobile)

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "message": "Logout berhasil"
}
```

---

### Rooms

#### GET `/api/rooms`
Get all active rooms (with pagination)

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "roomId": "abc123",
      "name": "Room 1",
      "participants": 2,
      "maxParticipants": 2,
      "createdBy": {
        "id": "xyz789",
        "username": "admin",
        "displayName": "Admin User"
      },
      "createdAt": "2025-03-17T10:30:00Z",
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5
  }
}
```

---

#### POST `/api/rooms/create`
Create room baru

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "Interview Room"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "roomId": "abc123",
    "name": "Interview Room",
    "participants": 0,
    "maxParticipants": 2,
    "createdBy": "507f1f77bcf86cd799439011",
    "isActive": true,
    "createdAt": "2025-03-17T10:30:00Z"
  }
}
```

---

#### GET `/api/rooms/:roomId`
Get detail room specific

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "roomId": "abc123",
    "name": "Interview Room",
    "isExamMode": false,
    "participants": [
      {
        "userId": "507f1f77bcf86cd799439011",
        "username": "user1",
        "displayName": "User One",
        "role": "admin",
        "joinedAt": "2025-03-17T10:30:00Z",
        "isMuted": false,
        "isCameraOff": false
      },
      {
        "userId": "507f1f77bcf86cd799439012",
        "username": "user2",
        "displayName": "User Two",
        "role": "user",
        "joinedAt": "2025-03-17T10:31:00Z",
        "isMuted": false,
        "isCameraOff": false
      }
    ],
    "createdAt": "2025-03-17T10:30:00Z"
  }
}
```

---

#### DELETE `/api/rooms/:roomId`
Delete/End room (creator only)

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Room deleted successfully"
}
```

---

### User Profile

#### GET `/api/user/profile`
Get current user profile

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser",
    "email": "test@example.com",
    "displayName": "Test User",
    "role": "user",
    "isOnline": true,
    "lastActive": "2025-03-17T10:30:00Z"
  }
}
```

---

#### PUT `/api/user/profile`
Update user profile

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "displayName": "John Doe",
  "email": "newEmail@example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Profile updated",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser",
    "email": "newEmail@example.com",
    "displayName": "John Doe",
    "role": "user"
  }
}
```

---

#### PUT `/api/user/password`
Change password

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "oldPassword": "oldpass123",
  "newPassword": "newpass456"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error** (400 Bad Request):
```json
{
  "success": false,
  "message": "Old password is incorrect"
}
```

---

### Statistics

#### GET `/api/stats/room/:roomId`
Get room call statistics

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "roomId": "abc123",
    "totalCalls": 15,
    "totalDuration": 3600,        // seconds
    "averageDuration": 240,       // seconds
    "participantStats": [
      {
        "username": "user1",
        "callCount": 10,
        "totalTime": 2400,        // seconds
        "averageTime": 240
      }
    ]
  }
}
```

---

#### GET `/api/stats/user/calls`
Get user's call history

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `limit` (optional): Default 20
- `skip` (optional): Default 0

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "stat_001",
      "roomId": "abc123",
      "roomName": "Interview Room",
      "otherUser": "user2",
      "connectionType": "mesh",
      "duration": 300,              // seconds
      "bitrateSent": 1200,          // Kbps average
      "bitrateReceived": 1150,      // Kbps average
      "packetLoss": 0.5,            // percentage
      "latency": 45,                // ms
      "startTime": "2025-03-17T10:30:00Z",
      "endTime": "2025-03-17T10:35:00Z"
    }
  ]
}
```

---

## 🌐 Traditional Routes (Web Browser)

### Authentication Routes

#### GET `/`
Halaman login (jika belum authenticated)

#### POST `/auth/register`
Register user baru

**Request Form Data**:
```
username=testuser
email=test@example.com
password=password123
```

**Redirect**: `/` (success) atau form refresh (error)

---

#### POST `/auth/login`
Submit login

**Request Form Data**:
```
username=testuser
password=password123
```

**Redirect**: `/` (Dashboard) atau form refresh (error)

---

#### GET `/auth/logout`
Logout current user

**Redirect**: `/`

---

### Room Routes

#### GET `/`
Dashboard - show active rooms

**Requires**: Authentication

**Renders**: home.ejs

---

#### POST `/room/create`
Create room baru

**Request Form Data**:
```
name=My Room
```

**Redirect**: `/room/:roomId` (newly created room)

---

#### GET `/room/:roomId`
Video call room interface

**Requires**: Authentication

**Renders**: room.ejs

**Passes to Template**:
```javascript
ROOM_DATA = {
  roomId: "abc123",
  userId: "507f1f77bcf86cd799439011",
  username: "testuser",
  userRole: "admin",
  displayName: "Test User",
  iceServers: [...],
  webrtcMode: "mesh",
  ionSFUConfig: {...},
  videoSettings: {...}
}
```

---

### Admin Routes

#### GET `/admin`
Admin dashboard

**Requires**: Admin role

**Renders**: admin/dashboard.ejs

---

#### GET `/admin/users`
Manage users

**Requires**: Admin role

**Renders**: admin/users.ejs

---

#### GET `/admin/rooms`
Manage rooms

**Requires**: Admin role

**Renders**: admin/rooms.ejs

---

#### GET `/admin/stats`
View statistics

**Requires**: Admin role

**Renders**: admin/stats.ejs

---

#### PUT `/admin/settings`
Update system settings

**Requires**: Admin role

**Request JSON**:
```json
{
  "key": "adminControlEnabled",
  "value": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Setting updated"
}
```

---

## 🔄 Error Response Format

All API responses follow consistent error format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common HTTP Status Codes

| Code | Meaning | Scenario |
|------|---------|----------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Server Error | Internal error |

---

## 📊 Response Pagination

Endpoints dengan banyak data support pagination:

```
GET /api/rooms?page=2&limit=10
```

Response:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## 🧪 Testing API dengan cURL

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'

# Get rooms (dengan token)
curl -X GET http://localhost:3000/api/rooms \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Create room
curl -X POST http://localhost:3000/api/rooms/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Room"
  }'
```

---

## 🔗 Rate Limiting (Future)

Recommendation untuk production:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,    // 15 minutes
  max: 100                       // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 📚 API Client Implementation Example

### JavaScript/Fetch
```javascript
class APIClient {
  constructor(token) {
    this.baseURL = 'http://localhost:3000/api';
    this.token = token;
  }

  async request(method, endpoint, data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      }
    };

    if (data) options.body = JSON.stringify(data);

    const response = await fetch(`${this.baseURL}${endpoint}`, options);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async register(username, email, password) {
    return this.request('POST', '/auth/register', {
      username, email, password
    });
  }

  async login(username, password) {
    return this.request('POST', '/auth/login', {
      username, password
    });
  }

  async getRooms(page = 1) {
    return this.request('GET', `/rooms?page=${page}`);
  }

  async createRoom(name) {
    return this.request('POST', '/rooms/create', { name });
  }
}

// Usage
const api = new APIClient('your-token-here');
const rooms = await api.getRooms();
```

---

## 🌐 CORS Configuration

Current CORS settings (src/server.js):
```javascript
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false 
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

**For production**, set proper origin:
```javascript
cors: {
  origin: [
    'https://yourdomain.com',
    'https://app.yourdomain.com'
  ],
  methods: ['GET', 'POST'],
  credentials: true
}
```

---

## 📝 Next Steps

- 📖 Read [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md) untuk real-time signaling
- 🎥 Check [07-WEBRTC_IMPLEMENTATION.md](07-WEBRTC_IMPLEMENTATION.md) untuk media details

---

**Last Updated**: March 17, 2025
**Version**: 1.0.0
