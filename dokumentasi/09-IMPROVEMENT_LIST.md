# 🧭 Improvement List - Web & Mobile Readiness

Dokumen ini berisi daftar perbaikan yang perlu dituntaskan supaya backend, signaling, dan dokumentasi benar-benar konsisten untuk web browser dan apps Android.

## Prioritas Tinggi

1. Samakan schema room antara API dan model.
   - `src/models/Room.js` memakai `createdBy`
   - `src/routes/api.js` masih mengirim `host`
   - Kontrak final harus konsisten memakai `createdBy` sebagai field kepemilikan room

2. Selaraskan endpoint REST API dengan dokumentasi.
   - Implementasi aktual memakai `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/room/create`, dan `/api/room/:roomId`
   - Dokumentasi lama masih menuliskan bentuk lain seperti `/api/rooms`

3. Tegaskan autentikasi ganda untuk Socket.IO.
   - Web: session cookie
   - Mobile: JWT di `socket.handshake.auth.token`
   - Jangan jadikan `req.session.userId` sebagai satu-satunya asumsi client

4. Pisahkan dokumentasi source of truth dari dokumentasi historis.
   - Dokumen lama bisa tetap ada untuk referensi
   - Tapi kontrak final harus jadi acuan utama untuk implementasi baru

## Prioritas Menengah

5. Tambahkan endpoint logout JWT bila diperlukan untuk mobile.
   - Saat ini logout web ada
   - Untuk mobile, token expiry masih menjadi mekanisme utama

6. Tambahkan endpoint list room jika memang dibutuhkan oleh mobile.
   - Sekarang API baru mencakup create dan detail room
   - Untuk layar daftar room di Android, endpoint list lebih praktis

7. Perjelas dukungan versi payload Socket.IO.
   - Field seperti `roomId`, `targetSocketId`, `userRole`, dan `senderSocketId` harus didokumentasikan sebagai kontrak stabil

## Prioritas Rendah

8. Rapikan istilah di dokumentasi.
   - Gunakan `mobile app` atau `Android app`, bukan campur dengan istilah browser-centric
   - Gunakan istilah `REST contract` untuk endpoint yang dipakai lintas platform

9. Tambahkan contoh request/response yang siap dipakai client.
   - Contoh curl untuk backend
   - Contoh snippet `fetch` untuk web
   - Contoh snippet `dio` atau `http` untuk Flutter

## Risiko yang Masih Ada

- Endpoint room create di kode saat ini perlu perbaikan schema agar tidak memakai field yang tidak ada di model.
- Dokumentasi signaling lama masih valid sebagai konsep, tetapi perlu dirujuk ke kontrak final ini untuk payload yang benar.
- Jika nanti mode SFU dipakai penuh, perlu kontrak tambahan untuk join SFU room dan relay transport.