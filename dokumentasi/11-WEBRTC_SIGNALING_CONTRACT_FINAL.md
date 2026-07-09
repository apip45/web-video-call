# 📡 WebRTC Signaling Contract Final

Dokumen ini adalah kontrak final untuk Socket.IO dan signaling WebRTC. Tujuannya agar web browser dan Android app memakai payload yang sama.

## Prinsip Umum

- Socket.IO hanya dipakai untuk signaling, status media, dan kontrol admin.
- Audio/video tidak lewat server; media tetap lewat WebRTC peer-to-peer atau SFU jika mode SFU aktif.
- Web client boleh auth dengan session.
- Mobile client wajib auth dengan JWT.

## Socket Authentication

### Web

- Server membaca `socket.request.session.userId`
- Jika ada, socket dianggap autentikasi session

### Mobile

- Server membaca `socket.handshake.auth.token`
- Token diverifikasi dengan JWT secret
- Jika valid, socket dianggap autentikasi JWT

## Connection Contract

### Client connect

Web:
```javascript
io('https://your-domain.tld', {
  withCredentials: true
});
```

Mobile:
```javascript
io('https://your-domain.tld', {
  auth: { token: '<jwt>' }
});
```

## Core Events

### `join-room`

Client -> Server

Payload:
```json
{
  "roomId": "ABC12345"
}
```

Rules:
- Client harus sudah terautentikasi sebelum join room
- Server menentukan identitas dari session/JWT, bukan dari payload client
- Payload tidak perlu membawa `username`, `displayName`, atau `userRole`

### `room-joined`

Server -> Client

Payload:
```json
{
  "roomId": "ABC12345",
  "participantCount": 1,
  "isInitiator": true,
  "userRole": "user",
  "isAdmin": false,
  "existingParticipant": null
}
```

### `user-joined`

Server -> Other participant

Payload:
```json
{
  "socketId": "<socket-id>",
  "username": "johndoe",
  "userRole": "user",
  "participantCount": 2
}
```

## WebRTC Signaling Events

### `offer`

Client -> Server -> Peer

Payload:
```json
{
  "roomId": "ABC12345",
  "offer": {},
  "targetSocketId": "<socket-id>"
}
```

Forwarded payload:
```json
{
  "offer": {},
  "senderSocketId": "<socket-id>",
  "senderUsername": "johndoe",
  "senderRole": "user"
}
```

### `answer`

Client -> Server -> Peer

Payload:
```json
{
  "roomId": "ABC12345",
  "answer": {},
  "targetSocketId": "<socket-id>"
}
```

### `ice-candidate`

Client -> Server -> Peer

Payload:
```json
{
  "roomId": "ABC12345",
  "candidate": {},
  "targetSocketId": "<socket-id>"
}
```

## Media Status Events

### `media-status`

Client -> Server

Payload:
```json
{
  "roomId": "ABC12345",
  "isMuted": false,
  "isCameraHidden": false,
  "isCameraTrackEnabled": true
}
```

Use:
- Update room participant state
- Sinkronisasi UI lawan bicara
- Monitoring admin

## Admin Control Events

### `set-camera-enabled`

Admin -> Server -> User

### `set-audio-enabled`

Admin -> Server -> User

### `set-focus`

Admin -> Server -> User

### `ring`

Admin -> Server -> User

Semua event admin harus melalui validasi role admin dan guard admin control system.

## Disconnect Contract

### `disconnect`

Server membersihkan participant socket, memperbarui room state, dan mengirim notifikasi ke peer jika perlu.

## Payload Rules

- Gunakan `roomId` untuk identifikasi ruang.
- Gunakan `targetSocketId` untuk tujuan forwarding.
- Gunakan `senderSocketId` saat server meneruskan event.
- Jangan mengandalkan user identity dari payload client jika identity bisa diambil dari auth context.

## Compatibility Notes

- Kontrak ini aman untuk web dan Android selama client mampu mengirim JWT saat connect.
- Browser-specific object seperti `req.session.userId` tidak boleh dipakai sebagai satu-satunya asumsi di client mobile.
- Untuk SFU mode, event signaling tetap sama; yang berubah hanya jalur media.