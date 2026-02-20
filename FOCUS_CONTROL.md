# Remote Camera Focus Control

Fitur yang memungkinkan **admin mengontrol fokus kamera** perangkat user secara remote (real-time) melalui WebRTC + Socket.IO.

---

## Daftar Isi

1. [Ringkasan Fitur](#ringkasan-fitur)
2. [Dukungan Browser](#dukungan-browser)
3. [Arsitektur & Alur Data](#arsitektur--alur-data)
4. [Socket Events Reference](#socket-events-reference)
5. [File yang Dimodifikasi](#file-yang-dimodifikasi)
6. [API Internal](#api-internal)
7. [Cara Penggunaan (Admin)](#cara-penggunaan-admin)
8. [Error Handling & Graceful Degradation](#error-handling--graceful-degradation)
9. [State Management](#state-management)

---

## Ringkasan Fitur

| Fitur | Deskripsi |
|---|---|
| **Focus Mode Toggle** | Admin dapat memilih Auto atau Manual focus |
| **Focus Distance Slider** | Kontrol jarak fokus (Near → Far) dengan range sesuai kemampuan perangkat user |
| **Point of Interest (POI)** | Admin klik di video lawan bicara → kamera user fokus ke titik tersebut |
| **Capability Detection** | Sistem otomatis mendeteksi apakah kamera user mendukung manual focus |
| **Graceful Degradation** | Jika browser/kamera tidak support → panel menampilkan pesan info, tidak error |
| **No user notification** | Semua perintah fokus diterapkan silently ke user tanpa pop-up notifikasi |

---

## Dukungan Browser

| Browser | Focus Mode | Focus Distance | Point of Interest |
|---|---|---|---|
| Chrome Desktop (≥ 90) | ✅ | ✅ (jika kamera support) | ✅ (jika kamera support) |
| Chrome Android (≥ 90) | ✅ | ✅ | ✅ |
| Firefox | ❌ | ❌ | ❌ |
| Safari | ❌ | ❌ | ❌ |

> **Catatan:** Dukungan bergantung pada **sistem operasi + driver kamera**, bukan hanya browser. Kamera virtual (OBS, dll) biasanya tidak mendukung `focusMode`.

---

## Arsitektur & Alur Data

```
ADMIN (Browser)                SERVER (Node.js/Socket.IO)          USER (Browser/Android)
─────────────────              ────────────────────────────        ──────────────────────

[Buka Focus Panel]
       │
       ├─ emit: request-focus-capabilities ──────────────────────► forward ke user participant
       │                                                                    │
       │                                                     [getFocusCapabilities()]
       │                                                                    │
       ◄─ focus-capabilities-response ◄──────────────────────────── emit: focus-capabilities-response
       │
[updateFocusPanelUI()]
       │
[Pilih Manual + geser slider]
       │
       ├─ emit: set-focus ──────────────────────────────────────── validate → emit: focus-command
       │                                                                    │
       │                                                        [applyFocus(mode, distance)]
       │
[Aktifkan POI + klik video]
       │
       ├─ emit: set-point-of-interest ─────────────────────────── validate → emit: poi-command
                                                                           │
                                                               [setPointOfInterest(x, y)]
```

---

## Socket Events Reference

### Client → Server

| Event | Payload | Hanya dari | Deskripsi |
|---|---|---|---|
| `request-focus-capabilities` | `{ roomId }` | admin | Minta capabilities kamera user |
| `focus-capabilities-response` | `{ roomId, capabilities }` | user | Kirim capabilities ke server (diteruskan ke admin) |
| `set-focus` | `{ roomId, targetSocketId, focusMode, focusDistance? }` | admin | Set mode/jarak fokus user |
| `set-point-of-interest` | `{ roomId, targetSocketId, x, y }` | admin | Set titik fokus (normalised 0–1) |

### Server → Client

| Event | Payload | Diterima oleh | Deskripsi |
|---|---|---|---|
| `request-focus-capabilities` | `{ requesterSocketId }` | user | Permintaan dari admin |
| `focus-capabilities-response` | `{ capabilities, senderSocketId }` | admin | Hasil capabilities dari user |
| `focus-command` | `{ focusMode, focusDistance? }` | user | Perintah ubah fokus |
| `poi-command` | `{ x, y }` | user | Perintah ubah titik fokus |

### Validasi Server (socketHandler.js)

Setiap event divalidasi sebelum diteruskan:

- `request-focus-capabilities` — hanya dari role `admin`, room harus aktif
- `focus-capabilities-response` — sender harus role `user` di room yang sama
- `set-focus` — hanya dari `admin`, `roomId`/`targetSocketId`/`focusMode` wajib ada, target harus role `user` di room yang sama
- `set-point-of-interest` — seperti `set-focus`, ditambah validasi `x`/`y` berupa number dalam range 0–1

---

## File yang Dimodifikasi

### `src/socket/socketHandler.js`

Ditambahkan 4 socket handler baru di bagian **FOCUS CONTROL** (sebelum blok RECONNECT REQUEST):

```
request-focus-capabilities  → forward ke user participant
focus-capabilities-response → forward ke admin participant (+ validasi sender = user)
set-focus                   → forward focus-command ke target (+ room validation)
set-point-of-interest       → forward poi-command ke target (+ coord validation)
```

---

### `public/js/webrtc.js`

Ditambahkan 3 method baru di class WebRTCClient (bagian **CAMERA FOCUS CONTROL**):

#### `getFocusCapabilities() → Object`

Membaca capabilities kamera lokal. Aman dipanggil kapan saja — selalu return object.

```js
// Return jika tidak support:
{ supported: false, reason: 'api_not_supported' | 'no_stream' | 'no_track' | 'manual_not_supported' | 'error' }

// Return jika support:
{
  supported: true,
  focusModes: ['continuous', 'manual'],     // mode yang tersedia
  focusDistance: { min, max, step } | null, // null jika kamera tidak expose
  pointOfInterest: true | false,
  currentFocusMode: 'continuous',           // setting saat ini
  currentFocusDistance: 0.5                 // (opsional)
}
```

#### `async applyFocus(settings) → { success, error? }`

```js
// settings: { focusMode: 'auto'|'manual', focusDistance?: number }
await webrtc.applyFocus({ focusMode: 'manual', focusDistance: 0.3 });
```

Guard: validasi `settings` tidak null/undefined sebelum akses properti.

#### `async setPointOfInterest(x, y) → { success, error? }`

```js
// x, y: normalised float 0.0–1.0
await webrtc.setPointOfInterest(0.5, 0.3);
```

Guard: validasi `x`/`y` adalah number, tidak NaN, dalam range [0,1].

---

### `public/css/room.css`

Ditambahkan style baru di akhir file:

| Selector | Fungsi |
|---|---|
| `.focus-panel` | Panel overlay, sama posisi dengan `.quality-panel`, z-index 16 |
| `.focus-panel-header` / `.focus-panel-body` | Layout panel |
| `.focus-mode-toggle` / `.focus-mode-btn` | Toggle Auto/Manual |
| `.focus-mode-btn.active` | State aktif (highlight) |
| `.focus-poi-btn` / `.focus-poi-btn.active` | Tombol POI, glow biru saat aktif |
| `.focus-poi-hint` | Info box biru saat POI aktif |
| `.focus-unsupported` | Warning box amber jika tidak support |
| `.focus-refresh-btn` | Tombol refresh capabilities |
| `.remote-video-wrapper.poi-active` | Cursor crosshair saat POI mode |
| `.remote-video-wrapper.poi-active::before` | Badge "🎯 Klik untuk fokus" |
| `.focus-indicator` | Kotak animasi di posisi klik |
| `.focus-indicator.animating` | Animasi `focus-shrink` (64px→32px→fade, 1.1s) |

---

### `src/views/room.ejs`

**Perubahan di dalam blok `<% if (isAdmin) { %>`:**

1. **Focus Panel HTML** (`id="focusPanel"`) — ditempatkan setelah Quality Panel:
   - `#focusUnsupported` — tampil saat tidak support / belum diquery
   - `#focusControls` — tampil saat support (default `display:none`)
   - `#focusModeAuto` / `#focusModeManual` — toggle buttons
   - `#focusDistanceSlider` — range input (`oninput` + `onchange`)
   - `#focusDistanceValue` — display nilai slider
   - `#poiToggle` (`display:none` by default, tampil hanya jika kamera support POI)
   - `#poiBtnText` / `#poiHint`
   - Tombol "Refresh Kapabilitas"

2. **Focus button** di `controls-right` (`id="focusBtn"`) — crosshair SVG icon

3. **`onclick="handleRemoteVideoClick(event)"`** — ditambahkan pada `#remoteVideoWrapper`

---

### `public/js/room.js`

#### Socket Listeners (di `initSocket()`)

```js
socket.on('request-focus-capabilities', handleFocusCapabilitiesRequest); // client
socket.on('focus-command', handleFocusCommand);                           // client
socket.on('poi-command', handlePOICommand);                               // client
socket.on('focus-capabilities-response', handleFocusCapabilitiesResponse); // admin
```

#### State Variables

```js
let adminFocusCapabilities = null;  // Object dari getFocusCapabilities(), atau null
let adminFocusMode = 'auto';        // 'auto' | 'manual'
let adminFocusDistance = 0.5;       // Nilai slider saat ini
let adminPOIActive = false;         // Apakah mode klik-POI aktif
```

#### Fungsi — Client Side (non-admin)

| Fungsi | Deskripsi |
|---|---|
| `handleFocusCapabilitiesRequest()` | Dipanggil saat event diterima, emit capabilities balik ke server |
| `handleFocusCommand(data)` | Validasi `data.focusMode`, panggil `webrtc.applyFocus()` |
| `handlePOICommand(data)` | Validasi `data.x`/`data.y`, panggil `webrtc.setPointOfInterest()` |

#### Fungsi — Admin Side

| Fungsi | Deskripsi |
|---|---|
| `handleFocusCapabilitiesResponse(data)` | Simpan ke `adminFocusCapabilities`, update UI |
| `window.requestFocusCapabilities()` | Emit `request-focus-capabilities` ke server |
| `updateFocusPanelUI()` | Sync semua elemen UI dengan state saat ini |
| `window.toggleFocusPanel()` | Buka/tutup panel. Tutup panel lain, deactivate POI saat tutup |
| `window.setAdminFocusMode(mode)` | Kirim `set-focus`, update UI, matikan POI jika switch ke auto |
| `window.onFocusDistanceChange()` | Update tampilan nilai slider (live, tanpa emit) |
| `window.applyFocusDistance()` | Emit `set-focus` dengan jarak saat ini (dipanggil di `onchange`) |
| `window.toggleAdminPOI()` | Toggle mode POI |
| `activatePOI()` | Set `adminPOIActive = true`, tambah class `poi-active`, pastikan mode manual |
| `deactivatePOI()` | Set `adminPOIActive = false`, hapus class `poi-active`, hapus indicator |
| `window.handleRemoteVideoClick(event)` | Hitung koordinat normalised, panggil `showFocusIndicator` + emit |
| `showFocusIndicator(clientX, clientY)` | Buat/reuse `#focusIndicator`, posisikan, restart animasi |

#### Cleanup

- `handleUserLeft()` — reset `adminFocusCapabilities = null`, deactivate POI, update UI
- `window.endCall()` — deactivate POI, tutup panel, reset `adminFocusCapabilities`

---

## Cara Penggunaan (Admin)

### 1. Buka Panel
Klik tombol 🎯 di controls bar (kanan). Panel focus terbuka otomatis.

Jika user sudah terhubung, sistem langsung request capabilities kamera user.

### 2. Cek Dukungan
- **"Client tidak support manual focus"** → kamera user tidak mendukung (Firefox, kamera virtual, dll). Panel tetap tampil, bisa klik "Refresh Kapabilitas" untuk cek ulang.
- **Kontrol tampil** → kamera user mendukung manual focus.

### 3. Ubah Focus Mode
- **Auto** (default) — kamera user kembali ke continuous/auto focus
- **Manual** — aktifkan kontrol jarak fokus dan POI

### 4. Atur Jarak Fokus
1. Pastikan mode **Manual** aktif (slider akan enabled)
2. Geser slider ke posisi yang diinginkan (Near ↔ Far)
3. Lepas slider → perintah dikirim ke kamera user

> Range slider otomatis disesuaikan dengan kemampuan kamera user (misal device Android tertentu: 0–10, bukan 0–1).

### 5. Point of Interest (Tap-to-Focus)
1. Klik tombol **POI: OFF** → berubah jadi **POI: ON**
2. Kursor berubah menjadi crosshair di area video
3. Klik di bagian video yang ingin difokuskan
4. Muncul animasi kotak fokus di titik klik
5. Kamera user fokus ke titik tersebut

> POI otomatis mengaktifkan mode Manual jika belum aktif.

---

## Error Handling & Graceful Degradation

### Semua level error di-handle tanpa crash:

| Level | Skenario | Handling |
|---|---|---|
| **Browser API** | `getCapabilities` tidak ada | `{ supported: false, reason: 'api_not_supported' }` |
| **Track** | Tidak ada video track | `{ supported: false, reason: 'no_track' }` |
| **applyConstraints** | Constraint ditolak browser | `try/catch` → `{ success: false, error: '...' }`, log warning |
| **Socket null** | Socket belum/sudah disconnect | Guard `if (!socket) return` sebelum semua emit |
| **Data null** | Event diterima tanpa payload | Guard `if (!data || !data.focusMode) return` |
| **Koordinat invalid** | x/y bukan number atau di luar [0,1] | Ditolak di server (socketHandler) **dan** di webrtc.js |
| **Target tidak valid** | `targetSocketId` bukan user di room yang sama | Server menolak tanpa mengirim command |
| **Room tidak ada** | Room sudah tidak aktif | Server menolak semua perintah focus |
| **User disconnect** | User keluar saat POI aktif | `handleUserLeft` → deactivatePOI + reset state |

### Tidak ada pop-up notifikasi ke user
Semua perintah focus (`focus-command`, `poi-command`) diterapkan **silently** di sisi user — tidak ada `showToast()` di handler client. Log tetap muncul di console browser user untuk debugging.

---

## State Management

```
adminFocusCapabilities
├── null                    → belum di-query / user disconnect
└── { supported: false }    → browser/kamera tidak support
└── { supported: true, ... } → capabilities diisi dari kamera user

adminFocusMode: 'auto' | 'manual'
  └── Reset ke 'auto' hanya saat: user disconnect (handleUserLeft)

adminFocusDistance: number
  └── Diinisialisasi dari currentFocusDistance kamera user
  └── Hanya di-reset jika nilai di luar range kamera (tidak di-reset tiap updateFocusPanelUI)

adminPOIActive: boolean
  └── Dimatikan saat: panel ditutup, mode switch ke 'auto', user disconnect, endCall()
```

---

## Commit Summary

```
feat: add remote camera focus control for admin

- socketHandler.js: 4 new socket handlers (request-focus-capabilities,
  focus-capabilities-response, set-focus, set-point-of-interest) with
  full room + role validation on every command
- webrtc.js: getFocusCapabilities(), applyFocus(), setPointOfInterest()
  with input validation and try/catch on all constraint calls
- room.css: focus panel styles, POI crosshair cursor, focus-shrink animation
- room.ejs: focus panel HTML, focus button in controls, POI onclick on video
- room.js: full admin + client handler layer, state vars, cleanup in
  handleUserLeft() and endCall(); no toast notifications to user side
```
