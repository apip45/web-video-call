# 📊 Contoh Output Console Debugging

## Mode Mesh P2P - Menggunakan TURN Server

### Saat Peer Connection Dibuat:
```
[WebRTC] 🔗 Creating peer connection...
[WebRTC] 🌐 ICE Servers Configuration:
[WebRTC]   Server 1:
[WebRTC]     🔵 STUN: stun:202.155.91.241:3478
[WebRTC]   Server 2:
[WebRTC]     🟢 TURN: turn:202.155.91.241:3478
[WebRTC]       Username: myuser
[WebRTC]   Server 3:
[WebRTC]     🟢 TURN: turn:202.155.91.241:3478?transport=tcp
[WebRTC]       Username: myuser
[WebRTC]   Server 4:
[WebRTC]     🔵 STUN: stun:stun.l.google.com:19302
[WebRTC] ✅ Peer connection created
```

### Saat Connection Berhasil:
```
[WebRTC] 🔄 ICE connection state: connected
[WebRTC] ✅ Connection established
══════════════════════════════════════════════════
[WebRTC] 🎯 ACTIVE ICE CONNECTION DETAILS:
══════════════════════════════════════════════════
[WebRTC] 📍 Local Candidate:
[WebRTC]   Type: relay
[WebRTC]   Protocol: udp
[WebRTC]   Address: 202.155.91.241:3478
[WebRTC]   🟢 Using TURN Server (Relay)
[WebRTC]   TURN Server: udp
[WebRTC]   Server URLs: turn:202.155.91.241:3478
[WebRTC] 📍 Remote Candidate:
[WebRTC]   Type: relay
[WebRTC]   Protocol: udp
[WebRTC]   Address: 202.155.91.241:54321
[WebRTC] 📊 Connection Statistics:
[WebRTC]   Bytes Sent: 156789
[WebRTC]   Bytes Received: 234567
[WebRTC]   RTT (Round Trip Time): 42.15 ms
══════════════════════════════════════════════════
```

---

## Mode Mesh P2P - Menggunakan STUN (Direct P2P)

### Saat Connection Berhasil:
```
[WebRTC] 🔄 ICE connection state: connected
[WebRTC] ✅ Connection established
══════════════════════════════════════════════════
[WebRTC] 🎯 ACTIVE ICE CONNECTION DETAILS:
══════════════════════════════════════════════════
[WebRTC] 📍 Local Candidate:
[WebRTC]   Type: srflx
[WebRTC]   Protocol: udp
[WebRTC]   Address: 180.242.xxx.xxx:54321
[WebRTC]   🔵 Using STUN Server (Server Reflexive)
[WebRTC]   Connection: Via public internet (NAT traversal)
[WebRTC] 📍 Remote Candidate:
[WebRTC]   Type: srflx
[WebRTC]   Protocol: udp
[WebRTC]   Address: 120.188.xxx.xxx:43210
[WebRTC] 📊 Connection Statistics:
[WebRTC]   Bytes Sent: 123456
[WebRTC]   Bytes Received: 234567
[WebRTC]   RTT (Round Trip Time): 28.45 ms
══════════════════════════════════════════════════
```

---

## Mode Mesh P2P - Local Network (Tanpa STUN/TURN)

### Saat Connection Berhasil:
```
[WebRTC] 🔄 ICE connection state: connected
[WebRTC] ✅ Connection established
══════════════════════════════════════════════════
[WebRTC] 🎯 ACTIVE ICE CONNECTION DETAILS:
══════════════════════════════════════════════════
[WebRTC] 📍 Local Candidate:
[WebRTC]   Type: host
[WebRTC]   Protocol: udp
[WebRTC]   Address: 192.168.1.100:51234
[WebRTC]   🟡 Using Local Network (Direct Connection)
[WebRTC]   Connection: Peer-to-peer without STUN/TURN
[WebRTC] 📍 Remote Candidate:
[WebRTC]   Type: host
[WebRTC]   Protocol: udp
[WebRTC]   Address: 192.168.1.101:52345
[WebRTC] 📊 Connection Statistics:
[WebRTC]   Bytes Sent: 89012
[WebRTC]   Bytes Received: 123456
[WebRTC]   RTT (Round Trip Time): 2.15 ms
══════════════════════════════════════════════════
```

---

## Mode SFU (Ion-SFU) - PUBLISH Connection

### Saat Publish Connection Dibuat:
```
[IonSFU] 📤 Publishing local stream...
[IonSFU] 🌐 Publish Connection - ICE Servers Configuration:
[IonSFU]   Server 1:
[IonSFU]     🔵 STUN: stun:202.155.91.241:3478
[IonSFU]   Server 2:
[IonSFU]     🔵 STUN: stun:stun.l.google.com:19302
```

### Saat Publish Connection Berhasil:
```
[IonSFU] 🔄 Publish ICE state: connected
══════════════════════════════════════════════════
[IonSFU] 🎯 ACTIVE ICE PUBLISH CONNECTION DETAILS:
══════════════════════════════════════════════════
[IonSFU] 📍 Local Candidate:
[IonSFU]   Type: srflx
[IonSFU]   Protocol: udp
[IonSFU]   Address: 180.242.xxx.xxx:54321
[IonSFU]   🔵 Using STUN Server (Server Reflexive)
[IonSFU]   Connection: Via public internet (NAT traversal)
[IonSFU] 📍 Remote Candidate (SFU):
[IonSFU]   Type: host
[IonSFU]   Protocol: udp
[IonSFU]   Address: 202.155.91.241:5000
[IonSFU] 📊 Connection Statistics:
[IonSFU]   Bytes Sent: 234567
[IonSFU]   Bytes Received: 1234
[IonSFU]   RTT (Round Trip Time): 35.67 ms
══════════════════════════════════════════════════
```

---

## Mode SFU (Ion-SFU) - SUBSCRIBE Connection

### Saat Subscribe Connection Berhasil:
```
[IonSFU] 🔄 Subscribe ICE state: connected
══════════════════════════════════════════════════
[IonSFU] 🎯 ACTIVE ICE SUBSCRIBE CONNECTION DETAILS:
══════════════════════════════════════════════════
[IonSFU] 📍 Local Candidate:
[IonSFU]   Type: host
[IonSFU]   Protocol: udp
[IonSFU]   Address: 192.168.1.100:51234
[IonSFU]   🟡 Using Local Network (Direct to SFU)
[IonSFU]   Connection: Direct without STUN/TURN
[IonSFU] 📍 Remote Candidate (SFU):
[IonSFU]   Type: host
[IonSFU]   Protocol: udp
[IonSFU]   Address: 202.155.91.241:5001
[IonSFU] 📊 Connection Statistics:
[IonSFU]   Bytes Sent: 2345
[IonSFU]   Bytes Received: 345678
[IonSFU]   RTT (Round Trip Time): 38.12 ms
══════════════════════════════════════════════════
```

---

## Interpretasi Hasil

### ✅ **Optimal**: Local Network (host to host)
- **RTT**: < 5ms
- **Skenario**: Kedua user dalam jaringan yang sama (WiFi/LAN)
- **Bandwidth**: Tidak menggunakan internet bandwidth
- **Server**: Tidak perlu STUN/TURN

### ✅ **Baik**: STUN (srflx to srflx)
- **RTT**: 20-50ms (tergantung jarak geografis)
- **Skenario**: NAT bisa di-traverse, koneksi langsung peer-to-peer
- **Bandwidth**: Efisien, langsung antar peer
- **Server**: Hanya perlu STUN untuk discovery

### ⚠️ **Reliable tapi Konsumsi Server**: TURN (relay)
- **RTT**: 30-100ms (tergantung TURN server location)
- **Skenario**: Symmetric NAT, firewall ketat, atau gagal P2P
- **Bandwidth**: Semua traffic melalui TURN server (double bandwidth)
- **Server**: Perlu TURN server dengan bandwidth tinggi

### 🔍 **Debug Tips**:

1. **Jika selalu `relay` (TURN)**:
   - Provider mungkin pakai Symmetric NAT (Tri, Indosat sering begini)
   - Check firewall tidak blokir UDP
   - Normal untuk mobile operator Indonesia

2. **Jika `srflx` (STUN)**:
   - Koneksi optimal untuk internet biasa
   - NAT type: Full-cone, Restricted-cone, Port-restricted

3. **Jika `host`**:
   - Best case scenario (same network)
   - Atau keduanya punya public IP

4. **RTT tinggi (>100ms)**:
   - TURN server jauh dari user
   - Network congestion
   - Consider deploy TURN server lebih dekat ke user
