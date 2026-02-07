# 🔧 Troubleshooting Login Error

## Error: "FormatUnexpected character"

Error ini terjadi karena server mengembalikan **HTML response** alih-alih **JSON response**.

### Penyebab Umum:

1. **Server Backend Tidak Berjalan** ❌
   - Server harus running di `https://calls.mikan.my.id`
   - Atau jika lokal: `http://localhost:3000`

2. **URL Endpoint Salah** ❌
   - Cek `lib/core/constants/api_constants.dart`
   - Pastikan `baseUrl` benar

3. **Server Mengembalikan Error Page** ❌
   - Server crash atau endpoint tidak tersedia
   - Cek logs server backend

### Solusi:

#### 1. Pastikan Server Backend Running:

```bash
cd "C:/Users/umria/Documents/code/Full-Stack/wcl/web-video-call"
npm start
```

**Pastikan muncul:**
```
Server running on port 3000
✓ Connected to MongoDB
✓ WebRTC Mode: sfu
✓ Ion-SFU: ENABLED
```

#### 2. Test Server dengan Browser/Postman:

**Test endpoint login:**
```
POST https://calls.mikan.my.id/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "testpass"
}
```

**Expected Response:**
```json
{
  "token": "...",
  "user": {...}
}
```

**Jika response HTML:** Server ada masalah!

#### 3. Untuk Testing Lokal (Emulator):

Edit `lib/core/constants/api_constants.dart`:

```dart
// Untuk emulator Android
static const String baseUrl = 'http://10.0.2.2:3000';

// Untuk device fisik (ganti dengan IP komputer)
static const String baseUrl = 'http://192.168.1.100:3000';
```

#### 4. Check Logs di Console:

Sekarang ada debug logs yang akan muncul:
- 🔵 Request URL
- 🔵 Response status code  
- 🔵 Response body (first 200 chars)
- ❌ Error details

**Lihat di console saat login untuk info lebih detail!**

### Error Handling Telah Diperbaiki:

✅ Better error messages
✅ HTML response detection
✅ Network error handling
✅ Debug logging
✅ User-friendly error messages

---

## Quick Check:

1. ✅ Server backend running?
2. ✅ URL di `api_constants.dart` benar?
3. ✅ Koneksi internet aktif?
4. ✅ Firewall tidak block port?
5. ✅ Check console logs untuk detail error

---

## Jika Masih Error:

### Cek Response di Logs:

Setelah mencoba login, cek console output:

```
🔵 Login request to: https://calls.mikan.my.id/auth/login
🔵 Response status: 200 atau 404 atau 500
🔵 Response body: <!DOCTYPE html> ← INI MASALAH!
```

**Jika melihat `<!DOCTYPE html>`:** Server mengembalikan HTML error page.

**Solusi:** Fix server backend atau ganti URL ke server yang working.

---

## Testing dengan Server Lokal:

### 1. Start Backend:
```bash
npm start
```

### 2. Update API URL:
```dart
static const String baseUrl = 'http://10.0.2.2:3000';
```

### 3. Test Login:
```
Username: testuser (atau register dulu)
Password: password123
```

---

## Sekarang Coba Lagi:

```bash
flutter run
```

Cek console logs untuk debug info! 🚀
