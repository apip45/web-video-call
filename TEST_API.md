# 🧪 Quick API Test Script

## Test 1: Login Admin (Default User)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

Expected: `{"message":"Login berhasil","token":"eyJ...","user":{...}}`

---

## Test 2: Register New User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"testuser\",\"email\":\"test@example.com\",\"password\":\"test123\"}"
```

Expected: `{"message":"Registrasi berhasil","token":"eyJ...","user":{...}}`

---

## Test 3: Create Room (Replace TOKEN with actual token from login)
```bash
curl -X POST http://localhost:3000/api/room/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d "{\"name\":\"Test Room\"}"
```

Expected: `{"message":"Room berhasil dibuat","room":{...}}`

---

## Test 4: Get Room Info (Replace ROOM_ID and TOKEN)
```bash
curl -X GET http://localhost:3000/api/room/ROOM_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected: `{"room":{...}}`

---

## Test 5: Get Current User (Replace TOKEN)
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected: `{"user":{...}}`

---

## For Production Server (calls.mikan.my.id)
Replace `http://localhost:3000` dengan `https://calls.mikan.my.id`

Example:
```bash
curl -X POST https://calls.mikan.my.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```
