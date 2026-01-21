# Setup Coturn untuk Fix Masalah Tri/Indosat

## Masalah yang Sering Terjadi

**Gejala:** Salah satu user bisa lihat/dengar, tapi yang lain tidak (one-way audio/video)

**Penyebab:**
- Provider seluler (Tri, Indosat, dll) menggunakan **Symmetric NAT** (CGNAT)
- STUN server tidak cukup untuk menembus NAT jenis ini
- Butuh **TURN server** untuk relay traffic

## Install Coturn di VPS

### 1. Install Coturn

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install coturn

# Enable service
sudo systemctl enable coturn
```

### 2. Konfigurasi Coturn

Edit file `/etc/turnserver.conf`:

```bash
sudo nano /etc/turnserver.conf
```

**Konfigurasi Minimal (Recommended):**

```conf
# Listening port
listening-port=3478
tls-listening-port=5349

# External IP (ganti dengan IP VPS Anda)
external-ip=YOUR_VPS_IP

# Relay IP (sama dengan external-ip)
relay-ip=YOUR_VPS_IP

# Realm (domain Anda)
realm=yourdomain.com

# Server name
server-name=yourdomain.com

# Credentials
# Gunakan static user untuk simplicity
user=username:password

# Untuk long-term credentials (lebih aman)
# lt-cred-mech

# Database untuk user management (optional)
# userdb=/var/lib/turn/turndb

# Logging
log-file=/var/log/turnserver/turnserver.log
verbose

# Security
fingerprint
no-multicast-peers

# Performance untuk Tri/Indosat
min-port=49152
max-port=65535

# Quota (optional, untuk limit bandwidth)
# max-bps=1000000
# total-quota=100
# user-quota=10

# Allow specific origins (optional)
# allowed-peer-ip=0.0.0.0-255.255.255.255
```

**Konfigurasi untuk NAT Ketat (Tri/Indosat):**

Tambahkan ini di `/etc/turnserver.conf`:

```conf
# Aggressive settings untuk Symmetric NAT
no-tcp-relay
no-udp-relay=false
stale-nonce=600

# Multiple listening ports (fallback)
alt-listening-port=80
alt-tls-listening-port=443

# Mobility support
mobility
```

### 3. Buka Firewall

```bash
# UFW
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp

# iptables (jika tidak pakai UFW)
sudo iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5349 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 5349 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT
```

### 4. Start Coturn

```bash
# Edit default config
sudo nano /etc/default/coturn

# Uncomment line:
TURNSERVER_ENABLED=1

# Restart service
sudo systemctl restart coturn
sudo systemctl status coturn

# Check logs
sudo tail -f /var/log/turnserver/turnserver.log
```

### 5. Test Coturn

Gunakan tool online:
- https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
- Masukkan TURN credentials Anda
- Pastikan muncul `relay` candidates

## Konfigurasi di .env

Setelah Coturn jalan, update `.env`:

```bash
# TURN Server (UDP - primary)
TURN_SERVER_URL=turn:YOUR_VPS_IP:3478
TURN_SERVER_USERNAME=username
TURN_SERVER_CREDENTIAL=password

# TURN Server (TCP - fallback)
# Otomatis ditambahkan dengan ?transport=tcp

# TURN Alternate Port (untuk NAT ketat)
TURN_SERVER_URL_ALT=turn:YOUR_VPS_IP:80

# TURNS (TLS) untuk firewall ketat
TURNS_SERVER_URL=turns:YOUR_VPS_IP:5349
TURNS_SERVER_USERNAME=username
TURNS_SERVER_CREDENTIAL=password

# Force semua koneksi lewat TURN (untuk testing Tri)
# FORCE_TURN=true
```

## Troubleshooting

### 1. Check Coturn Running

```bash
sudo netstat -tulpn | grep turnserver
# Harus ada port 3478, 5349
```

### 2. Test dengan turnutils

```bash
# Install tools
sudo apt-get install coturn-utils

# Test TURN server
turnutils-uclient -v -u username -w password YOUR_VPS_IP
```

### 3. Check Logs

```bash
sudo tail -f /var/log/turnserver/turnserver.log
```

**Log yang bagus:**
```
session ... created with relay ...
session ... allocated
```

**Log bermasalah:**
```
401 Unauthorized
403 Forbidden
```

### 4. One-Way Audio/Video

**Jika masih one-way setelah setup TURN:**

1. **Pastikan kedua port range terbuka:**
   ```bash
   sudo ufw allow 49152:65535/udp
   ```

2. **Check ICE candidates di browser console:**
   - Harus ada `typ relay` untuk kedua peer
   - Jika hanya satu yang dapat relay → firewall masalah

3. **Force TURN mode:**
   ```bash
   # .env
   FORCE_TURN=true
   ```

4. **Check asymmetric routing:**
   - Pastikan VPS tidak ada masalah dengan provider
   - Test ping dari kedua peer ke VPS

### 5. Tri Specific Issues

**Tri menggunakan CGNAT sangat ketat:**

1. **Multiple TURN ports:**
   ```conf
   # /etc/turnserver.conf
   listening-port=3478
   alt-listening-port=80
   alt-listening-port=8080
   ```

2. **Aggressive gathering:**
   ```javascript
   // Di webrtc.js
   iceCandidatePoolSize: 10
   ```

3. **TCP fallback:**
   TURN TCP otomatis enabled di konfigurasi

## Tips Optimasi

### 1. SSL Certificate untuk TURNS

```bash
# Gunakan Let's Encrypt
sudo apt-get install certbot
sudo certbot certonly --standalone -d yourdomain.com

# Update turnserver.conf
cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### 2. Monitoring

```bash
# Check active sessions
sudo turnserver -v

# Watch logs realtime
watch -n 1 'sudo ss -tunap | grep turnserver'
```

### 3. Rate Limiting

Untuk prevent abuse:

```conf
# /etc/turnserver.conf
max-bps=500000
total-quota=100
user-quota=10
```

## Alternative: Public TURN Services

Jika tidak mau setup sendiri, gunakan service:

### 1. Metered Video (Free Tier)

```bash
TURN_SERVER_URL=turn:a.relay.metered.ca:80
TURN_SERVER_USERNAME=your_username
TURN_SERVER_CREDENTIAL=your_password
```

### 2. Xirsys (Free Tier)

```bash
TURN_SERVER_URL=turn:your.xirsys.com:80
TURN_SERVER_USERNAME=your_username
TURN_SERVER_CREDENTIAL=your_password
```

### 3. Twilio TURN (Berbayar, Reliable)

```bash
TURN_SERVER_URL=turn:global.turn.twilio.com:3478
TURN_SERVER_USERNAME=your_username
TURN_SERVER_CREDENTIAL=your_password
```

## Verifikasi Berhasil

**Cek di browser console:**

1. Buka Developer Tools → Console
2. Lihat log ICE candidates
3. Harus ada: `candidate:... typ relay ...`
4. Kedua peer harus mendapat relay candidates

**Test dengan Tri:**
- User 1: Tri 4G
- User 2: WiFi/provider lain
- Kedua harus bisa audio/video two-way

---

**Support:** Jika masih bermasalah, kirim log:
```bash
sudo tail -n 100 /var/log/turnserver/turnserver.log
```
