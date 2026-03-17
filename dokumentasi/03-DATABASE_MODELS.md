# 💾 Database Models & Schema

## Overview

MongoDB database untuk aplikasi video call mempunyai **4 collection utama**:

1. **users** - User accounts & credentials
2. **rooms** - Video call rooms
3. **stats** - Call statistics & performance metrics
4. **settings** - Global system configuration

---

## 📊 Collection: Users

### Schema Definition

```javascript
{
  _id: ObjectId,                    // MongoDB auto-generated
  username: String,                 // Unique, 3-20 chars, lowercase
  email: String,                    // Optional, unique if provided
  password: String,                 // bcryptjs hashed, never raw
  role: String,                     // 'admin' or 'user' (default: 'user')
  displayName: String,              // For UI display
  isOnline: Boolean,                // Real-time status
  lastActive: Date,                 // When user was last active
  createdAt: Date,                  // Auto-timestamp
  updatedAt: Date                   // Auto-timestamp
}
```

### Validation Rules

```
username:
  - Required
  - Unique (case-insensitive) 
  - 3-20 characters
  - Pattern: alphanumeric + underscore
  - Example: john_doe, user123

email:
  - Optional
  - Unique if provided (sparse index)
  - Valid email format
  - Lowercase storage
  - Example: user@example.com

password:
  - Required
  - Minimum 6 characters
  - Hashed with bcryptjs (salt: 10 rounds)
  - Never returned in API responses

role:
  - Enum: ['admin', 'user']
  - Default: 'user'
  - Used for access control

displayName:
  - Optional
  - Max 50 characters
  - Falls back to username if not set
  - Used in video call UI
```

### Indexes

```javascript
// src/models/User.js

// Primary unique indexes
db.users.createIndex({ username: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { sparse: true, unique: true })

// For faster queries
db.users.createIndex({ isOnline: 1 })
db.users.createIndex({ lastActive: 1 })
db.users.createIndex({ createdAt: -1 })
```

### Methods

```javascript
// Compare password for login
user.comparePassword(candidatePassword)
  → Returns: Promise<Boolean>

// Virtual: fallback display name
user.name
  → Returns: displayName || username

// Query by username (case-insensitive)
User.findOne({ username: username.toLowerCase() })
```

### Example Documents

```javascript
// Admin user
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  username: "admin",
  email: "admin@example.com",
  password: "$2a$10$...",           // hashed
  role: "admin",
  displayName: "Administrator",
  isOnline: true,
  lastActive: ISODate("2025-03-17T10:30:00.000Z"),
  createdAt: ISODate("2025-03-01T00:00:00.000Z"),
  updatedAt: ISODate("2025-03-17T10:30:00.000Z")
}

// Regular user
{
  _id: ObjectId("507f1f77bcf86cd799439012"),
  username: "testuser",
  email: null,
  password: "$2a$10$...",
  role: "user",
  displayName: "Test User",
  isOnline: false,
  lastActive: ISODate("2025-03-17T09:45:00.000Z"),
  createdAt: ISODate("2025-03-10T14:20:00.000Z"),
  updatedAt: ISODate("2025-03-17T09:45:00.000Z")
}
```

---

## 🎙️ Collection: Rooms

### Schema Definition

```javascript
{
  _id: ObjectId,                    // MongoDB auto-generated
  roomId: String,                   // Unique, URL-friendly ID (8 chars)
  name: String,                     // Room display name
  createdBy: ObjectId,              // Ref to User._id (creator)
  participants: [                   // Array of active participants
    {
      user: ObjectId,               // Ref to User._id
      role: String,                 // 'admin' or 'user'
      socketId: String,             // Current Socket.IO connection ID
      joinedAt: Date,               // When user joined
      isMuted: Boolean,             // Display state (user perspective)
      isCameraOff: Boolean,         // Display state (user perspective)
      actualCameraOn: Boolean       // Actual device state (admin sees real)
    }
  ],
  isActive: Boolean,                // Default: true
  maxParticipants: Number,          // Default: 2 (1-vs-1)
  isExamMode: Boolean,              // Admin monitoring enabled?
  lastActivity: Date,               // For auto-cleanup
  createdAt: Date,
  updatedAt: Date
}
```

### Validation Rules

```
roomId:
  - Required
  - Unique
  - 8-character alphanumeric
  - Auto-generated via uuid
  - Example: "a1b2c3d4"

name:
  - Optional
  - Max 50 characters
  - Default: "Room {roomId}"

createdBy:
  - Required
  - Must reference valid User._id
  - Creator becomes admin automatically

participants[]:
  - Array max length: maxParticipants (default: 2)
  - Contains at least 1 (creator) when created
  - socketId updated when user reconnects
  - actualCameraOn: true even if isCameraOff (for exam mode)

maxParticipants:
  - Default: 2 (for 1-vs-1 calls)
  - Could be extended for group calls future

isExamMode:
  - Boolean flag
  - When true: admin can override user's camera/audio
  - Controls visibility of admin controls

lastActivity:
  - Updated on every participant action
  - Used for auto-deletion of stale rooms
```

### Indexes

```javascript
// Lookups
db.rooms.createIndex({ roomId: 1 }, { unique: true })
db.rooms.createIndex({ createdBy: 1 })

// For active room queries
db.rooms.createIndex({ isActive: 1 })
db.rooms.createIndex({ lastActivity: 1 })

// Auto-delete old inactive rooms (TTL index)
db.rooms.createIndex(
  { lastActivity: 1 }, 
  { expireAfterSeconds: 86400 }  // 24 hours
)
```

### Methods

```javascript
// Check if room is full
room.isFull()
  → Returns: Boolean

// Add participant to room
room.addParticipant(userId, socketId, userRole)
  → Returns: Boolean (false if room full)
  → Updates: participants, lastActivity

// Remove participant from room
room.removeParticipant(socketId)
  → Returns: Participant object (removed) or null
  → Updates: participants, lastActivity

// Get the other participant
room.getOtherParticipant(socketId)
  → Returns: Participant object or null
```

### Example Documents

```javascript
// New room (just created, creator not joined yet)
{
  _id: ObjectId("607f1f77bcf86cd799439013"),
  roomId: "abc12345",
  name: "Interview Room",
  createdBy: ObjectId("507f1f77bcf86cd799439011"),
  participants: [],
  isActive: true,
  maxParticipants: 2,
  isExamMode: false,
  lastActivity: ISODate("2025-03-17T10:30:00.000Z"),
  createdAt: ISODate("2025-03-17T10:30:00.000Z"),
  updatedAt: ISODate("2025-03-17T10:30:00.000Z")
}

// Active room (2 participants in call)
{
  _id: ObjectId("607f1f77bcf86cd799439014"),
  roomId: "xyz98765",
  name: "Team Meeting",
  createdBy: ObjectId("507f1f77bcf86cd799439011"),
  participants: [
    {
      user: ObjectId("507f1f77bcf86cd799439011"),
      role: "admin",
      socketId: "/socket.io#abc123xyz",
      joinedAt: ISODate("2025-03-17T10:30:00.000Z"),
      isMuted: false,
      isCameraOff: false,
      actualCameraOn: true
    },
    {
      user: ObjectId("507f1f77bcf86cd799439012"),
      role: "user",
      socketId: "/socket.io#def456uvw",
      joinedAt: ISODate("2025-03-17T10:31:00.000Z"),
      isMuted: false,
      isCameraOff: false,
      actualCameraOn: true
    }
  ],
  isActive: true,
  maxParticipants: 2,
  isExamMode: false,
  lastActivity: ISODate("2025-03-17T10:35:00.000Z"),
  createdAt: ISODate("2025-03-17T10:30:00.000Z"),
  updatedAt: ISODate("2025-03-17T10:35:00.000Z")
}

// Exam mode (admin monitoring)
{
  _id: ObjectId("607f1f77bcf86cd799439015"),
  roomId: "exam5678",
  name: "Online Exam",
  createdBy: ObjectId("507f1f77bcf86cd799439011"),
  participants: [
    {
      user: ObjectId("507f1f77bcf86cd799439011"),
      role: "admin",
      socketId: "...",
      joinedAt: ISODate("..."),
      isMuted: false,
      isCameraOff: false,
      actualCameraOn: true
    },
    {
      user: ObjectId("507f1f77bcf86cd799439012"),
      role: "user",
      socketId: "...",
      joinedAt: ISODate("..."),
      isMuted: false,
      isCameraOff: true,              // User's display state
      actualCameraOn: true            // But actually still on (admin sees real)
    }
  ],
  isActive: true,
  maxParticipants: 2,
  isExamMode: true,                  // Admin override enabled
  lastActivity: ISODate("..."),
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

---

## 📈 Collection: Stats

### Schema Definition

```javascript
{
  _id: ObjectId,
  roomId: String,                   // Reference to room
  userId: ObjectId,                 // Reference to user
  username: String,                 // Cached for performance
  sessionId: String,                // Unique per call session
  connectionType: String,           // 'mesh' or 'sfu'
  duration: Number,                 // Total seconds
  bitrateSent: Number,              // Average Kbps
  bitrateReceived: Number,          // Average Kbps
  packetLoss: Number,               // Percentage (0-100)
  latency: Number,                  // Round-trip time in ms
  stats: Object,                    // Raw WebRTC stats object
  startTime: Date,                  // When call started
  endTime: Date,                    // When call ended
  createdAt: Date
}
```

### Stored Object: stats

```javascript
stats: {
  // Video metrics
  video: {
    sentBitrate: Number,          // Kbps
    receivedBitrate: Number,      // Kbps
    sentBytes: Number,
    receivedBytes: Number,
    framesSent: Number,
    framesReceived: Number,
    frameWidth: Number,
    frameHeight: Number,
    framerate: Number            // FPS
  },
  
  // Audio metrics
  audio: {
    sentBitrate: Number,
    receivedBitrate: Number,
    sentBytes: Number,
    receivedBytes: Number,
    audioLevel: Number            // 0-100
  },
  
  // Connection metrics
  connection: {
    currentRoundTripTime: Number, // milliseconds
    availableOutgoingBitrate: Number,
    availableIncomingBitrate: Number,
    connectionState: String,      // 'connected', 'failed', etc
    iceConnectionState: String,   // 'connected', 'completed'
    selectedCandidatePairChanges: Number
  }
}
```

### Indexes

```javascript
db.stats.createIndex({ roomId: 1 })
db.stats.createIndex({ userId: 1 })
db.stats.createIndex({ sessionId: 1 }, { unique: true })
db.stats.createIndex({ startTime: -1 })
db.stats.createIndex({ createdAt: -1 })

// TTL: Keep stats for 90 days
db.stats.createIndex(
  { createdAt: 1 }, 
  { expireAfterSeconds: 7776000 }  // 90 days
)
```

### Example Document

```javascript
{
  _id: ObjectId("607f1f77bcf86cd799439016"),
  roomId: "abc12345",
  userId: ObjectId("507f1f77bcf86cd799439011"),
  username: "testuser",
  sessionId: "sess_a1b2c3d4e5f6",
  connectionType: "mesh",
  duration: 300,                    // 5 minutes
  bitrateSent: 1200,                // Kbps average
  bitrateReceived: 1150,            // Kbps average
  packetLoss: 0.5,                  // % packets lost
  latency: 45,                      // ms
  stats: {
    video: {
      sentBitrate: 1200,
      receivedBitrate: 1150,
      framesSent: 150,
      framesReceived: 150,
      frameWidth: 1280,
      frameHeight: 720,
      framerate: 30
    },
    audio: {
      sentBitrate: 20,
      receivedBitrate: 20,
      audioLevel: 65
    },
    connection: {
      currentRoundTripTime: 0.045,
      availableOutgoingBitrate: 2500000
    }
  },
  startTime: ISODate("2025-03-17T10:30:00.000Z"),
  endTime: ISODate("2025-03-17T10:35:00.000Z"),
  createdAt: ISODate("2025-03-17T10:35:01.000Z")
}
```

---

## ⚙️ Collection: Settings

### Schema Definition

```javascript
{
  _id: ObjectId,
  key: String,                      // Setting name (unique)
  value: Boolean | String | Number, // Setting value
  description: String,              // For documentation
  category: String,                 // 'security', 'performance', etc
  updatedAt: Date
}
```

### Predefined Settings

```javascript
// Admin Control (default: true)
{
  _id: ObjectId("..."),
  key: "adminControlEnabled",
  value: true,
  description: "Allow admins to control user camera/audio",
  category: "admin",
  updatedAt: ISODate("2025-03-17T10:00:00.000Z")
}

// Video Quality
{
  _id: ObjectId("..."),
  key: "defaultVideoBitrate",
  value: 1500,
  description: "Default max bitrate in Kbps",
  category: "performance",
  updatedAt: ISODate("...")
}

{
  _id: ObjectId("..."),
  key: "defaultVideoResolution",
  value: "720p",
  description: "Default video resolution",
  category: "performance",
  updatedAt: ISODate("...")
}

// WebRTC Mode
{
  _id: ObjectId("..."),
  key: "webrtcMode",
  value: "mesh",
  description: "WebRTC mode: 'mesh' or 'sfu'",
  category: "webrtc",
  updatedAt: ISODate("...")
}
```

### Methods

```javascript
// Get setting value
Settings.getAdminControlEnabled()
  → Returns: Promise<Boolean>

// Update setting
Settings.setSetting(key, value)
  → Returns: Promise<Document>

// Get all settings
Settings.find({})
  → Returns: Promise<Array>
```

---

## 📊 Relationships Diagram

```
     User (1)
      |
      | createdBy
      v
    Room (1)
      |
      |------- participants[] (array of refs) --------> User (many)
      |
      |--- lastActivity --- (for TTL cleanup)
      |
      +--- roomId --- Query Index
      
      
     Stats (1)
      |
      |--- userId -------> User (1)
      |--- roomId -------> Room (1)
      |--- sessionId --- Unique per call
      
      
   Settings (Global)
      |
      +--- adminControlEnabled
      +--- defaultVideoQuality
      +--- webrtcMode
```

---

## 🔍 Query Examples

### User Queries

```javascript
// Find by username (login)
User.findOne({ username: username.toLowerCase() })

// Find online users
User.find({ isOnline: true })

// Update last active
User.updateOne(
  { _id: userId },
  { lastActive: new Date() }
)
```

### Room Queries

```javascript
// Find room by roomId
Room.findOne({ roomId: roomId })

// Find active rooms for user
Room.find({
  isActive: true,
  $or: [
    { createdBy: userId },
    { 'participants.user': userId }
  ]
})

// Add participant
Room.updateOne(
  { _id: roomId },
  { 
    $push: { participants: newParticipant },
    $set: { lastActivity: new Date() }
  }
)

// Remove participant
Room.updateOne(
  { _id: roomId },
  { 
    $pull: { participants: { socketId: socketId } },
    $set: { lastActivity: new Date() }
  }
)
```

### Stats Queries

```javascript
// Get call history for user
Stats.find({ userId: userId })
  .sort({ startTime: -1 })
  .limit(20)

// Get stats for room
Stats.find({ roomId: roomId })
  .sort({ startTime: -1 })

// Average stats for user
Stats.aggregate([
  { $match: { userId: userId } },
  {
    $group: {
      _id: null,
      avgDuration: { $avg: '$duration' },
      avgBitrate: { $avg: '$bitrateSent' },
      totalCalls: { $sum: 1 }
    }
  }
])
```

---

## 🔐 Data Validation

### Mongoose Validation

```javascript
// Username validation
username: {
  type: String,
  required: [true, 'Username required'],
  unique: true,
  trim: true,
  lowercase: true,
  minlength: [3, 'Min 3 chars'],
  maxlength: [20, 'Max 20 chars'],
  match: [/^[a-z0-9_]+$/, 'Alphanumeric + underscore only']
}

// Email validation
email: {
  type: String,
  sparse: true,
  unique: true,
  lowercase: true,
  match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(.\w{2,3})+$/, 'Valid email']
}

// Password validation
password: {
  type: String,
  required: [true, 'Password required'],
  minlength: [6, 'Min 6 chars'],
  select: false  // Don't return in queries by default
}
```

---

## 🔄 Collection Lifecycle

### User Lifecycle

```
Register
  ├─ Validate input
  ├─ Hash password
  ├─ Create user doc
  └─ Return user info (no password)

Login
  ├─ Find user
  ├─ Compare password
  ├─ Create session/token
  └─ Return auth token

Update
  ├─ Validate new data
  ├─ Update doc
  └─ Return updated user

Delete (optional)
  ├─ Delete user doc
  ├─ Delete related rooms?
  └─ Delete related stats?
```

### Room Lifecycle

```
Create
  ├─ Generate roomId
  ├─ Set creator as owner
  ├─ Create room doc
  └─ Return room info

Join
  ├─ Validate room exists
  ├─ Check not full
  ├─ Add participant
  └─ Update lastActivity

Call (in progress)
  ├─ Both participants connected
  ├─ Media flowing
  ├─ Collect stats

Leave/End
  ├─ Remove participant
  ├─ Save stats
  ├─ If room empty → mark inactive
  └─ (TTL index deletes after 24h)
```

---

## 📈 Performance Considerations

### Index Strategy

```
 Frequently queried fields:
  ✅ roomId (unique)
  ✅ createdBy (list rooms)
  ✅ participants.user (find user's rooms)
  ✅ isActive (active rooms only)
  
 Moderate frequency:
  ✅ userId (stats)
  ✅ startTime (sort by date)
```

### Data Size Estimation

```
Per User:
  ~300 bytes (minimal data)
  
Per Room:
  ~500 bytes (basic info)
  + ~100 bytes per participant (usually 2)
  ≈ 700 bytes per room

Per Stat Record:
  ~1 KB (includes raw stats object)

Examples:
  - 1,000 users: ~300 KB
  - 500 active rooms: ~350 KB
  - 10,000 historical stats: ~10 MB
  - Total monthly storage: ~500 MB (rough estimate)
```

---

## 🛡️ Data Security

### Password Handling

```javascript
// Input: Plain text password
// Storage: bcryptjs hashed (salt: 10 rounds)
// Never: Return password in API responses
// Compare: Use comparePassword() method
```

### PII Protection

```javascript
// Sensitive fields:
- password (hashed)
- email (optional, masked in some contexts)
- JWT tokens (short-lived, 7 days)

// Safe to display:
- username
- displayName
- role
```

---

## Next Steps

- 📖 Read [01-OVERVIEW.md](01-OVERVIEW.md) for architecture
- 🔌 Check [04-API_ENDPOINTS.md](04-API_ENDPOINTS.md) for data formats
- 📡 See [05-SOCKET_EVENTS.md](05-SOCKET_EVENTS.md) for real-time updates

---

**Last Updated**: March 17, 2025
**Version**: 1.0.0
