# 📘 API Contract Final - Web & Android

Dokumen ini adalah kontrak REST API yang disarankan sebagai acuan utama untuk web browser, Android app, dan client lain.

## Prinsip Kontrak

- Web browser boleh memakai session cookie untuk route tradisional.
- Mobile app wajib memakai JWT untuk `/api/*` dan Socket.IO auth.
- Semua response API harus JSON.
- Field dan nama endpoint di dokumen ini harus dianggap sebagai source of truth.

## Base URL

- Development: `http://localhost:3000`
- Production: `https://your-domain.tld`

## Authentication Model

### Web Session

- Dipakai oleh route tradisional seperti `/login`, `/register`, `/room/*`, dan `/admin/*`
- Session disimpan di MongoDB via `connect-mongo`
- Cocok untuk browser karena cookie dikirim otomatis

### JWT Mobile

- Dipakai oleh `/api/*`
- Token dikirim di header `Authorization: Bearer <token>`
- Token juga dipakai saat Socket.IO connect melalui `socket.handshake.auth.token`

## Authentication Endpoints

### POST `/api/auth/register`

Membuat user baru untuk mobile atau external client.

Request:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

Success 201:
```json
{
  "message": "Registrasi berhasil",
  "token": "<jwt>",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "johndoe",
    "role": "user"
  }
}
```

### POST `/api/auth/login`

Login user dan mengembalikan JWT.

Request:
```json
{
  "username": "johndoe",
  "password": "password123"
}
```

Success 200:
```json
{
  "message": "Login berhasil",
  "token": "<jwt>",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "johndoe",
    "role": "user"
  }
}
```

### GET `/api/auth/me`

Mengambil profil user aktif dari JWT.

Headers:
```http
Authorization: Bearer <token>
```

Success 200:
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

## Room Endpoints

### POST `/api/room/create`

Membuat room baru.

Headers:
```http
Authorization: Bearer <token>
```

Request:
```json
{
  "name": "Meeting Room"
}
```

Success 201:
```json
{
  "message": "Room berhasil dibuat",
  "room": {
    "id": "<mongo-id>",
    "roomId": "ABC12345",
    "name": "Meeting Room",
    "createdBy": "507f1f77bcf86cd799439011",
    "isActive": true,
    "createdAt": "2026-06-30T00:00:00.000Z"
  }
}
```

Catatan:
- Kontrak final memakai `createdBy`
- Jangan pakai field `host` di kontrak karena tidak dipakai oleh schema final

### GET `/api/room/:roomId`

Mengambil detail room dan participant aktif.

Headers:
```http
Authorization: Bearer <token>
```

Success 200:
```json
{
  "room": {
    "id": "<mongo-id>",
    "roomId": "ABC12345",
    "name": "Meeting Room",
    "createdBy": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "displayName": "John Doe"
    },
    "isActive": true,
    "participants": [],
    "createdAt": "2026-06-30T00:00:00.000Z"
  }
}
```

## Recommended Extra Endpoints

Jika nanti dibutuhkan untuk mobile app, ini endpoint yang sebaiknya ditambahkan:

### GET `/api/rooms`

Daftar room aktif untuk dashboard mobile.

### DELETE `/api/room/:roomId`

Tutup room dari client yang berwenang.

### POST `/api/auth/logout`

Logout versi mobile untuk mencatat sesi terakhir, walaupun JWT tetap akan expire alami.

## Status Kode Standar

- `200` OK
- `201` Created
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `500` Internal Server Error

## Field Naming Rules

- Gunakan `roomId`, bukan `room_id`
- Gunakan `createdBy`, bukan `host`
- Gunakan `displayName` sebagai nama tampilan
- Gunakan `userRole` untuk payload signaling

## Client Requirements

- Web client harus menyimpan session cookie secara otomatis.
- Android client harus menyimpan JWT secara aman.
- Socket.IO client harus mengirim token saat koneksi awal.