# 🚀 Instalasi Ion-SFU di Ubuntu Server 24.04 (Native - No Docker)

Panduan lengkap setup **Ion-SFU** (Selective Forwarding Unit) untuk WebRTC video call di VPS Ubuntu Server 24.04 dengan RAM 1GB **tanpa Docker**.

> **✨ Keuntungan Native Install:**
> - Lebih ringan (~20MB RAM vs ~50MB dengan Docker)
> - Direct system access untuk debugging
> - Integrasi mudah dengan Caddy reverse proxy
> - Support STUN/TURN existing dari Coturn

> **📌 Version Info:**
> - Menggunakan **master branch** (latest stable dari GitHub)
> - Build dari source dengan Go 1.21+
> - Include 3 jenis signaling server: **allrpc** (recommended), json-rpc, grpc
> - Production-ready untuk VPS 1GB RAM
>
> **⚠️ CRITICAL BUG WARNING:**
> Ion-SFU memiliki bug pada konfigurasi `ballast` di `sfu.toml`. Nilai non-zero akan menyebabkan
> fatal memory allocation error (contoh: ballast=40MB → allocate 2.5TB → instant crash!).
> **SOLUTION: Set `ballast = 0` di semua konfigurasi!** (sudah diperbaiki di dokumentasi ini)

---

## 📋 Table of Contents

- [Requirements](#-requirements)
- [Persiapan VPS](#-persiapan-vps)
- [Install Go Language](#-install-go-language)
- [Install Ion-SFU dari Source](#-install-ion-sfu-dari-source)
- [Konfigurasi Ion-SFU](#-konfigurasi-ion-sfu)
- [Setup Systemd Service](#-setup-systemd-service)
- [Konfigurasi Caddy Reverse Proxy](#-konfigurasi-caddy-reverse-proxy)
- [Konfigurasi Firewall](#-konfigurasi-firewall)
- [Testing & Verification](#-testing--verification)
- [Production Deployment](#-production-deployment)
- [Monitoring & Maintenance](#-monitoring--maintenance)
- [Troubleshooting](#-troubleshooting)

---

## 📦 Requirements

### Hardware Minimum (VPS)
- **RAM**: 1GB (native install hanya butuh ~500MB total)
- **CPU**: 1 vCPU (shared OK)
- **Storage**: 5GB SSD (native install lebih hemat)
- **Bandwidth**: 100 Mbps unmetered (untuk 25 concurrent users)

### Software Requirements
- **OS**: Ubuntu Server 24.04 LTS
- **Go**: 1.21+ (akan diinstall)
- **Caddy**: v2.x (untuk domain & reverse proxy)
- **Public IP**: Wajib (tidak bisa di belakang NAT)
- **Domain**: Optional tapi recommended (untuk WSS)

### Network Requirements
- Port **7000** (WebSocket signaling - akan di-proxy Caddy)
- Port **50051** (gRPC API - internal atau di-proxy)
- Port **5000-5050** (WebRTC UDP - direct access)
- Port **80/443** (Caddy - HTTP/HTTPS)

### Optional (Jika pakai Coturn existing)
- Coturn STUN/TURN server sudah running
- Domain untuk TURN (misal: `turn.yourdomain.com`)

---

## 🔧 Persiapan VPS

### 1. Login ke VPS & Update System

```bash
# Login via SSH
ssh root@YOUR_VPS_IP

# Update package list
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git nano net-tools htop
```

### 2. Setup Non-Root User (Optional tapi Recommended)

```bash
# Buat user baru
adduser webrtc

# Tambahkan ke sudo group
usermod -aG sudo webrtc

# Switch ke user baru
su - webrtc
```

### 3. Configure System Limits untuk WebRTC

```bash
# Edit system limits
sudo nano /etc/security/limits.conf
```

Tambahkan di akhir file:

```
# WebRTC optimization
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
```

Apply changes:

```bash
# Reboot untuk apply limits
sudo reboot

# Setelah reboot, verify
ulimit -n
# Output should be: 65536
```

### 4. Optimize Network Settings

```bash
# Edit sysctl
sudo nano /etc/sysctl.conf
```

Tambahkan:

```
# Network optimization untuk WebRTC
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.udp_mem = 65536 131072 262144
net.core.netdev_max_backlog = 5000

# Disable IPv6 jika tidak dipakai (optional)
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
```

Apply sysctl settings:

```bash
sudo sysctl -p
```

---

## � Install Go Language

Ion-SFU ditulis dalam Go, jadi kita perlu install Go terlebih dahulu.

### 1. Download & Install Go

```bash
# Download Go 1.21.x (sesuaikan dengan versi terbaru)
cd /tmp
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz

# Verify download (optional)
sha256sum go1.21.6.linux-amd64.tar.gz

# Remove old Go installation (if any)
sudo rm -rf /usr/local/go

# Extract to /usr/local
sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz

# Clean up
rm go1.21.6.linux-amd64.tar.gz
```

### 2. Setup Go Environment

```bash
# Add Go to PATH
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
echo 'export GOPATH=$HOME/go' >> ~/.bashrc
echo 'export PATH=$PATH:$GOPATH/bin' >> ~/.bashrc

# Apply changes
source ~/.bashrc

# Verify installation
go version
# Output: go version go1.21.6 linux/amd64
```

### 3. Install Build Dependencies

```bash
# Install required packages untuk build
sudo apt install -y build-essential pkg-config
```

---

## 🎯 Setup Ion-SFU

### 1. Clone Project Repository

```bash
# Navigate to home directory
cd ~

# C📦 Install Ion-SFU dari Source

### 1. Clone Ion-SFU Repository

```bash
# Navigate to home directory
cd ~

# Clone Ion-SFU official repository
git clone https://github.com/pion/ion-sfu.git
cd ion-sfu

# Ion-SFU menggunakan master branch (bukan main)
git checkout master
git pull origin master

# Verify Go modules
go mod download
```

### 2. Build Ion-SFU Binary

```bash
# Check struktur yang tersedia
ls cmd/
# Output: signal/ (atau sfu/ atau server/)

# Main branch biasanya punya cmd/signal/json-rpc atau cmd/server
# Build signaling server dengan SFU embedded
cd ~/ion-sfu

# Ion-SFU master branch punya 3 jenis signaling server:
# 1. allrpc (JSON-RPC + gRPC) - RECOMMENDED ⭐
# 2. json-rpc (WebSocket only) - Simple
# 3. grpc (gRPC only) - Backend integration

echo "Building Ion-SFU signaling server..."

# Build allrpc (all-in-one: JSON-RPC + gRPC)
go build -o ion-sfu-signal cmd/signal/allrpc/main.go

# Alternative builds (uncomment jika ingin gunakan yang lain):
# go build -o ion-sfu-signal cmd/signal/json-rpc/main.go  # WebSocket only
# go build -o ion-sfu-signal cmd/signal/grpc/main.go      # gRPC only

# Verify binary
if [ -f "ion-sfu-signal" ]; then
    echo "✅ Build successful!"
    ls -lh ion-sfu-signal
    ./ion-sfu-signal --help 2>&1 | head -5
else
    echo "❌ Build failed!"
    echo "Available signaling servers:"
    ls cmd/signal/
    exit 1
fi

# Move binary to system path
sudo cp ion-sfu-signal /usr/local/bin/
sudo chmod +x /usr/local/bin/ion-sfu-signal

# Verify installation
which ion-sfu-signal
# Output: /usr/local/bin/ion-sfu-signal

# Test run (optional)
ion-sfu-signal --help
```

### 3. Create Configuration Directory

```bash
# Create directory untuk config & data
sudo mkdir -p /etc/ion-sfu
sudo mkdir -p /var/lib/ion-sfu
sudo mkdir -p /var/log/ion-sfu

# Set ownership (jika pakai non-root user)
sudo chown -R $USER:$USER /etc/ion-sfu
sudo chown -R $USER:$USER /var/lib/ion-sfu
sudo chown -R $USER:$USER /var/log/ion-sfu
```

---

## ⚙️ Konfigurasi Ion-SFU

> **⚠️ PENTING - Ion-SFU (master branch):**  
> Ion-SFU master branch punya **3 jenis signaling server**:
> - ✅ **allrpc** (JSON-RPC + gRPC) - All-in-one, paling flexible ⭐
> - ✅ **json-rpc** (WebSocket) - Simple, untuk web client
> - ✅ **grpc** (gRPC) - Untuk backend integration
>
> **Setup ini akan:**
> 1. Build Ion-SFU dengan signaling server **allrpc** (recommended)
> 2. Run sebagai single service (ion-sfu-signal)
> 3. Config via /etc/ion-sfu/sfu.toml
> 4. Ready untuk production dengan Caddy reverse proxy
> 5. Support WebSocket (untuk web) dan gRPC (untuk backend)
>
> Config di bawah adalah untuk **Ion-SFU + allrpc signaling** all-in-one.

### 1. Create Ion-SFU Configuration

```bash
# Copy base config dari repository
cp ~/ion-sfu/config.toml /etc/ion-sfu/sfu.toml

# Edit configuration
sudo nano /etc/ion-sfu/sfu.toml
```

**⚠️ PENTING: Customize config berikut!**

```toml

[sfu]
# Ballast untuk optimize GC (10% dari available memory)
ballast = 41943040  # 40MB

[router]
# Bandwidth limits (optimized untuk Indonesia)
maxbandwidth = 1000000  # 1 Mbps per track
maxpackettrack = 300

[router.rtp]
# Buffer size
maxbuffer = 500

[webrtc]
sudo nano /etc/ion-sfu/sfu.toml
```

**⚠️ PENTING: Ganti sesuai setup kamu!**

```toml
# =============================================================================
# ION-SFU CONFIGURATION - Native Install (No Docker)
# Branch: master (Latest Stable)
# Signaling: allrpc (JSON-RPC + gRPC)
# Optimized untuk VPS 1GB RAM + Caddy + Coturn Integration
# =============================================================================
#
# NOTE: Copy dari ~/ion-sfu/config.toml sebagai base
# Lalu customize sesuai kebutuhan di bawah
# =============================================================================

[sfu]
# ⚠️ CRITICAL: Ballast MUST be 0 or commented out!
# Bug in Ion-SFU: non-zero ballast causes fatal memory allocation error
# Example: ballast = 41943040 will try to allocate 2.5TB memory → instant crash
ballast = 0  # DISABLED - Let Go runtime manage memory automatically

[router]
# Bandwidth limits (optimized untuk Indonesia)
maxbandwidth = 1500000  # 1.5 Mbps per track
maxpackettrack = 500

[router.rtp]
# Buffer size (balance antara memory & quality)
maxbuffer = 1000  # Increased untuk handle packet loss di Indo

[webrtc]
# ICE configuration
iceportrange = [5000, 5200]  # ~100 concurrent users max

# =============================================================================
# STUN/TURN CONFIGURATION
# Prioritas: VPS IP → Coturn STUN/TURN → Google STUN fallback
# =============================================================================

# STUN 1: VPS Public IP (fastest, lowest latency)
[[webrtc.iceserver]]
urls = ["stun:202.155.91.241:3478"]  # ⚠️ GANTI dengan PUBLIC IP VPS kamu!

# STUN 2: Coturn domain (jika ada)
[[webrtc.iceserver]]
urls = ["stun:turn.mikan.my.id:3478"]  # ⚠️ GANTI dengan DOMAIN Coturn kamu!

# STUN 3: Google STUN sebagai fallback
[[webrtc.iceserver]]
urls = ["stun:stun.l.google.com:19302"]

# TURN 1: Coturn TURN UDP/TCP (optional, sebagai fallback ekstrim)
[[webrtc.iceserver]]
urls = ["turn:turn.mikan.my.id:3478"]  # ⚠️ GANTI!
username = "admin"  # ⚠️ GANTI dengan username Coturn kamu!
credential = "rahasia123"  # ⚠️ GANTI dengan password Coturn kamu!

# TURN 2: Coturn TURNS (TLS) - jika Coturn support TLS
[[webrtc.iceserver]]
urls = ["turns:turn.mikan.my.id:5349"]  # ⚠️ GANTI!
username = "admin"  # ⚠️ GANTI!
credential = "rahasia123"  # ⚠️ GANTI!

[webrtc.timeouts]
# Extended timeouts untuk jaringan selular Indonesia (Tri, XL, dll)
failed = 30  # Wait 30s before marking connection as failed

# Network settings
[webrtc.candidates]
# Ic� Setup Systemd Service

Agar Ion-SFU auto-start dan dapat dimonitor dengan systemctl.

### 1. Create Systemd Service File
 (jika belum)
sudo ufw enable

# Allow SSH (PENTING! Jangan sampai locked out)
sudo ufw allow 22/tcp

# Allow HTTP & HTTPS (untuk Caddy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow WebRTC UDP ports (direct client access)
sudo ufw allow 5000:5050/udp

# Coturn ports (jika pakai Coturn existing)
# sudo ufw allow 3478/tcp    # TURN TCP
# sudo ufw allow 3478/udp    # STUN & TURN UDP
# sudo ufw allow 5349/tcp    # TURNS (TLS)
# sudo ufw allow 49152:65535/udp  # TURN relay ports (jika pakai)

# Check status
sudo ufw status verbose
```

**⚠️ CATATAN:**
- Port **7000** (WebSocket) TIDAK perlu dibuka karena di-proxy oleh Caddy
- Port **50051** (gRPC) TIDAK perlu dibuka jika hanya internal
- Port **5000-5050** (UDP) WAJIB dibuka untuk WebRTC media
- Port Coturn dibuka jika kamu pakai Coturn sebagai fallback TURN

### Verify Firewall Rules

```bash
sudo ufw status numbered

# Output should show:
# [ 1] 22/tcp         ALLOW IN    Anywhere
# [ 2] 80/tcp         ALLOW IN    Anywhere
# [ 3] 443/tcp        ALLOW IN    Anywhere
# [ 4] 5000:5050/udp  ALLOW IN    Anywhere
# (+ CStart Ion-SFU Service

Service sudah di-setup di langkah sebelumnya. Berikut cara manage service:

### 1. Service Management

```bash
# Start Ion-SFU
sudo systemctl start ion-sfu

# Stop Ion-SFU
sudo systemctl stop ion-sfu

# Restart Ion-SFU
sudo systemctl restart ion-sfu

# Check status
sudo systemctl status ion-sfu

# View logs (follow)
sudo journalctl -u ion-sfu -f

# View logs (last 100 lines)
sudo journalctl -u ion-sfu -n 100

# Should see (allrpc signaling output):
# [INFO] Config loaded from /etc/ion-sfu/sfu.toml
# [INFO] JSON-RPC server listening on :7000
# [INFO] gRPC server listening on :50051
# [INFO] WebRTC UDP ports: 5000-5050
```

### 2. Verify Service Running

```bash
# Check if service is active
sudo systemctl is-active ion-sfu
# Output: active

# Check process
ps aux | grep ion-sfu

# Check listening ports
sudo netstat -tulpn | grep ion-sfu

# Should show:
# Ion-SFU listening on configured ports (check sfu.toml)
```

### 3. Check Resource Usage (Native)

```bash
# Check memory usage
ps aux | grep ion-sfu | grep -v grep
# RSS column shows memory usage (~20-40MB idle, native install!)

# Or use htop for real-time monitoring
htop -p $(pgrep ion-sfu)

# Compare dengan Docker: ~50% lebih hemat!
sudo systemctl enable ion-sfu

# Start the service
sudo systemctl start ion-sfu

# Check status
sudo systemctl status ion-sfu

# Should show "active (running)"
```

### 4. Verify Service

```bash
# Check if service is running
sudo systemctl is-active ion-sfu
# Output: active

# Check logs
sudo journalctl -u ion-sfu -f

# Should see:
# [INFO] Ion-SFU signal server started on 127.0.0.1:7000
# [INFO] WebRTC ports: 5000-5050
```

---

## 🌐 Konfigurasi Caddy Reverse Proxy

Integrasi Ion-SFU dengan Caddy untuk domain & SSL/TLS.

### 1. Install Caddy (jika belum)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt updWebSocket Connection

```bash
# Install websocat untuk testing WebSocket
sudo apt install -y websocat

# Test WebSocket connection (via Caddy SSL)
websocat wss://sfu.yourdomain.com/ws

# Atau test local (tanpa SSL)
websocat ws://127.0.0.1:7000/ws

# Should connect without errors
# Press Ctrl+C to exit
```

### 2. Test STUN Server (Coturn kamu)

```bash
# Install stun client (jika belum)
sudo apt install -y stun-client

# Test Coturn STUN kamu
stun turn.yourdomain.com -p 3478

# Should return your public IP
```

### 3. Check Service Logs

```bash
# Check Ion-SFU logs
sudo journalctl -u ion-sfu -n 100

# Should see:
# [INFO] Ion-SFU signal server started on 127.0.0.1:7000
# [INFO] WebRTC ports: 5000-5050

# Check Caddy logs
sudo journalctl -u caddy -n 50

# Should see successful reverse proxy logs
```

### 4. Test from Client (Browser)

Buat file test HTML dan serve via Caddy:

```bash
# Create test file
sudo nano /var/www/html/test-sfu.html
```

```html
<!DOCTYPE html>
<html>
<head>
    <title>Ion-SFU Connection Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        button { padding: 10px 20px; font-size: 16px; }
        #result { 
            background: #f0f0f0; 
            padding: 15px; 
            margin-top: 20px;
            border-radius: 5px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .success { color: green; font-weight: bold; }
        .error { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <h1>🎯 Ion-SFU Connection Test</h1>
    <p>Test koneksi ke SFU server via WSS (Caddy proxy)</p>
    
    <button onclick="testConnection()">🚀 Test Connection</button>
    <button onclick="testSTUN()">📡 Test STUN</button>
    
    <div id="result">Click button untuk test...</div>
    
    <script>
        const SFU_WSS_URL = 'wss://sfu.yourdomain.com/ws';  // GANTI!
        const STUN_SERVERS = [
            'stun:turn.yourdomain.com:3478',  // Coturn STUN kamu
            'stun:stun.l.google.com:19302'    // Google fallback
        ];
        
        async function testConnection() {
            const result = document.getElementById('result');
            result.innerHTML = '⏳ Testing WebSocket connection to SFU...\n';
            
            try {
                // Test WebSocket connection
                const ws = new WebSocket(SFU_WSS_URL);
                
                ws.onopen = () => {
                    result.innerHTML += '<span class="success">✅ WebSocket connected!</span>\n';
                    result.innerHTML += `URL: ${SFU_WSS_URL}\n`;
                    ws.close();
                };
                
                ws.onerror = (err) => {
                    result.innerHTML += '<span class="error">❌ WebSocket error!</span>\n';
                    result.innerHTML += `Error: ${err}\n`;
                };
                
            } catch(err) {
                result.innerHTML += '<span class="error">❌ Connection failed!</span>\n';
                result.innerHTML += `Error: ${err.message}\n`;
            }
        }
        
        async function testSTUN() {
            const result = document.getElementById('result');
            result.innerHTML = '⏳ Testing STUN servers & ICE gathering...\n';
            
            const config = {
                iceServers: STUN_SERVERS.map(url => ({ urls: url }))
            };
            
            try {
                const pc = new RTCPeerConnection(config);
                
                // Create dummy data channel
                pc.createDataChannel('test');
                
                // Create offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                
                result.innerHTML += '⏳ Gathering ICE candidates...\n\n';
                
                // Wait for ICE gathering
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('ICE gathering timeout'));
                    }, 10000);
                    
                    pc.onicegatheringstatechange = () => {
                        if (pc.iceGatheringState === 'complete') {
                            clearTimeout(timeout);
                            resolve();
                        }
                    };
                });
                
                // Parse candidates
                const candidates = pc.localDescription.sdp
                    .split('\n')
                    .filter(line => line.startsWith('a=candidate'));
                
                result.innerHTML += '<span class="success">✅ ICE gathering complete!</span>\n';
                result.innerHTML += `\nTotal candidates: ${candidates.length}\n\n`;
                result.innerHTML += 'Candidates:\n' + candidates.join('\n');
                
                // Determine if STUN working
                const hasServerReflexive = candidates.some(c => c.includes('typ srflx'));
                if (hasServerReflexive) {
                    result.innerHTML += '\n\n<span class="success">✅ STUN servers working!</span>';
                } else {
                    result.innerHTML += '\n\n<span class="error">⚠️ No server reflexive candidates (STUN may not be working)</span>';
                }
                
                pc.close();
                
            } catch(err) {
                result.innerHTML += '<span class="error">❌ STUN test failed!</span>\n';
                result.innerHTML += `Error: ${err.message}\n`;
            }
        }
    </script>
</body>
</html>
```

**Test di browser:**
```bash
# Open in browser:
https://yourdomain.com/test-sfu.html

# Klik "Test Connection" untuk test WebSocket
# Klik "Test STUN" untuk test ICE gathering
# Reload Caddy
sudo systemctl reload caddy

# Check status
sudo systemctl status caddy

# Check logs
sudo journalctl -u caddy -f
```

### 4. Verify SSL Certificate

```bash
# Caddy akan otomatis request Let's Encrypt certificate
# Check logs untuk certificate generation
sudo journalctl -u caddy | grep certificate

# Test HTTPS
curl -I https://sfu.yourdomain.com/health
# Should return 200 OK dengan SSL certificate valid
```

---

## �e lite mode untuk hemat resource
icelite = true

# NAT 1:1 mapping - GANTI DENGAN PUBLIC IP VPS KAMU
# Uncomment jika VPS di belakang NAT
# nat1to1ips = ["103.123.45.67"]

[webrtc.sdpsemantics]
sdpsemantics = "unified-plan-with-fallback"

[router.video]
# Max layers untuk simulcast
maxlayers = 2

[log]
# Log level: debug, info, warn, error
level = "info"
# Log file path
# file = "/var/log/ion-sfu/sfu.log"

[turn]
# Disable TURN di SFU (pakai Coturn external)
enabled = false

[nack]
# NACK untuk handle packet loss
enabled = true

# =============================================================================
# NOTE: Ion-SFU v1.0.x tidak punya built-in signaling server
# Anda perlu implement signaling server sendiri (WebSocket/gRPC)
# Atau gunakan ion-app-web sebagai reference implementation
# Config di atas adalah untuk SFU core functionality
# =============================================================================
```

### 2. Get Configuration Values

```bash
# Get VPS public IP
curl -4 ifconfig.me
# Output: 103.123.45.67 (contoh)

# Jika kamu sudah punya Coturn, catat:
# - Domain/IP Coturn: turn.yourdomain.com
# - STUN port: 3478 (default)
# - TURN port: 3478 (UDP/TCP)
# - TURNS port: 5349 (TLS)
# - Username & credential (jika pakai static auth)
```

### 3. Edit Configuration

```bash
sudo nano /etc/ion-sfu/sfu.toml

# Ganti nilai berikut:
# 1. nat1to1ips = ["YOUR_VPS_PUBLIC_IP"]  # Uncomment & ganti IP
# 2. urls = ["stun:turn.yourdomain.com:3478"]  # Ganti dengan Coturn domain kamu
# 3. TURN credentials (jika pakai Coturn sebagai fallback)
```

### 4. Validate Configuration

```bash
# Test config syntax (test run Ion-SFU manually)
# ⚠️ IMPORTANT: Must include -gaddr and -jaddr parameters!
ion-sfu-signal -c /etc/ion-sfu/sfu.toml -gaddr :50051 -jaddr :7000 -v 5

# Jika sukses, akan show:
# [2026-01-21 11:50:14.127] [INFO] [main.go:82] => Config file loaded file=/etc/ion-sfu/sfu.toml v=0
# [2026-01-21 11:50:14.127] [INFO] [server.go:74] => JsonRPC Listening addr=http://:7000 v=0
# [2026-01-21 11:50:14.131] INFO default: [wrapped.go:210] wrappered grpc listening :50051
# [2026-01-21 11:50:14.132] INFO default: [wrapped.go:129] Using websockets
# [2026-01-21 11:50:14.133] INFO default: [wrapped.go:188] Starting gRPC/gRPC-Web combo server
#
# Jika error "out of memory" atau "runtime: out of memory":
# → Check ballast value di sfu.toml, MUST be 0!
#
# Press Ctrl+C untuk stop test

# Alternative: check config file syntax only
cat /etc/ion-sfu/sfu.toml | grep -E '^\[|^ballast' | head -30

# Verify ballast is 0 or commented out
grep "^ballast" /etc/ion-sfu/sfu.toml
# Should output: ballast = 0
# Or nothing (commented out)
```0/udp

# Allow STUN (optional)
sudo ufw allow 3478/udp

# Check status
sudo ufw status verbose
```

### Verify Firewall Rules

```bash
sudo ufw status numbered

# Output should show:
# [ 1] 22/tcp         ALLOW IN    Anywhere
# [ 2] 80/tcp         ALLOW IN    Anywhere
# [ 3] 443/tcp        ALLOW IN    Anywhere
# [ 4] 50051/tcp      ALLOW IN    Anywhere
# [ 5] 5000:5050/udp  ALLOW IN    Anywhere
# [ 6] 3478/udp       ALLOW IN    Anywhere
```

---

## 🚀 Deploy Ion-SFU

### 1. Start Ion-SFU Container

```bash
# Navigate to project directory
cd ~/web-video-call

# Pull image
docker compose -f docker-compose.sfu.yml pull

# Start in detached mode
docker compose -f docker-compose.sfu.yml up -d

# Check logs
docker compose -f docker-compose.sfu.yml logs -f ion-sfu
```

### 2. Verify Container Running

```bash
# Check container status
docker ps
Verify Auto-Restart on Boot

```bash
# Systemd service sudah di-enable
# Verify dengan reboot VPS:
sudo reboot

# Setelah reboot, check service auto-start
sudo systemctl status ion-sfu

# Should be "active (running)" automatically
```

### 2. Setup Logrotate

```bash
# Create logrotate config untuk Ion-SFU
sudo nano /etc/logrotate.d/ion-sfu
```

```
/var/log/ion-sfu/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload ion-sfu > /dev/null 2>&1 || true
    endscript
}
```

```bash
# Test logrotate
sudo logrotate -f /etc/logrotate.d/ion-sfu

# Verify
ls -lh /var/log/ion-sfu/
## ✅ Testing & Verification

### 1. Test gRPC Connection

```bash
# Install grpcurl untuk testing
sudo apt install -y grpcurl

# Test gRPC endpoint
grpcurl -plaintext YOUR_VPS_IP:50051 list

# Should return service list without errors
```

### 2. Test STUN Server

```bash
# Install stun client
sudo apt install -y stun-client

# Test STUN
stun YOUR_VPS_IP -p 3478

# Should return your public IP
```

### 3. Check Logs

```bash
# Check Ion-SFU logs
docker logs ion-sfu

# Should see:
# [INFO] Ion-SFU started
# [INFO] gRPC server listening on :50051
# [INFO] WebRTC ports: 5000-5050
```
service status
sudo systemctl status ion-sfu

# Check resource usage (RAM)
ps aux | grep ion-sfu | grep -v grep

# Check logs (last 50 lines)
sudo journalctl -u ion-sfu -n 50

# Check disk usage
df -h

# Check network connections
sudo netstat -tulpn | grep ion-sfu
```

### Weekly Maintenance

```bash
# Check for system updates
sudo apt update && sudo apt list --upgradable

# Update system (jika perlu)
sudo apt upgrade -y

# Check system resources
free -h
htop

# Check log size
du -sh /var/log/ion-sfu/

# Rotate logs manual (jika perlu)
sudo logrotate -f /etc/logrotate.d/ion-sfu                { urls: 'stun:stun.l.google.com:19302' }
                ]
            };
            
            try {
                const pc = new RTCPeerConnection(config);
                
                // Get local media
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                stream.getTracks().forEach(track => pc.addTrack(track, stream));
                
                // Create offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
      Service Status:"
systemctl is-active ion-sfu
echo ""

echo "Resource Usage:"
ps aux | grep ion-sfu | grep -v grep | awk '{print "CPU: "$3"% | RAM: "$4"% | RSS: "$6" KB"}'
echo ""

echo "Memory Details:"
free -h
echo ""

echo "Recent Logs (Errors only):"
journalctl -u ion-sfu -n 100 --no-pager | grep -i error
echo ""

echo "Network Connections:"
sudo netstat -tulpn | grep -E '(7000|5000)'
echo ""

echo "Caddy Proxy Status:"
systemctl is-active caddy
echo ""

echo "Disk Usage:"
df -h / | tail -1 | awk '{print "Used: "$3" / "$2" ("$5")"}'
echo ""

echo "Active WebRTC Sessions (approx):"
sudo netstat -an | grep -E ':(5000|5001|5002|5003|5004|5005)' | grep ESTABLISHED | wc -l
```

---

## 🏭 Production Deployment

### 1. Setup Auto-Restart on Failure

```bash
# Docker compose sudah set restart: unless-stopped
# Verify dengan reboot VPS:
sudo reboot

# Setelah reboot, check container auto-start
docker ps
```

### 2. Setup Logrotate

```bash
# Docker logs sudah di-limit di docker-compose.yml
# Verify dengan:
docker inspect ion-sfu | grep -A 5 "LogConfig"
```

### 3. Enable Monitoring

Install monitoring tools:

```bash
# Install htop untuk monitoring real-time
sudo apt install -y htop

# Install netdata untuk web-based monitoring (optional)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access netdata: http://YOUR_VPS_IP:19999
```

### 4. Setup Backup Script

```bash
# Create backup script
nano ~/backup-ion-sfu.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup configuration
tar -czf $BACKUP_DIR/ion-sfu-config-$DATE.tar.gz \
    ~/web-video-call/ion-sfu-config.toml \
    ~/web-video-call/docker-compose.sfu.yml

# Keep only last 7 backups
cd $BACKUP_DIR
ls -t ion-sfu-config-*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup completed: $DATE"
```

Make executable and schedule:

```bash
chmod +x ~/backup-ion-sfu.sh

# Add to crontab (backup setiap hari jam 2 pagi)
crontab -e

# Add line:
0 2 * * * /root/backup-ion-sfu.sh >> /var/log/ion-sfu-backup.log 2>&1
```

---

## 📊 Monitoring & Maintenance

### Daily Monitoring

```bash
# Check container status
docker ps -a

# Check resource usage
docker stats --no-stream ion-sfu

# Check logs (last 50 lines)
docker logs --tail 50 ion-sfu

# Check disk usage
df -h
```

### Weekly Maintenance

```bash
# Check for Docker updates
sudo apt update && sudo apt list --upgradable | grep docker

# Clean unused Docker resources
docker system prune -f

# Check system resources
free -h
htop
```

### Performance Monitoring

Create monitoring script:

```bash
nano ~/monitor-ion-sfu.sh
```

```bash
#!/bin/bash

echo "=== Ion-SFU Status ==="
echo "Time: $(date)"
echo ""

echo "Container Status:"
docker ps | grep ion-sfu
echo ""

echo "Resource Usage:"
docker stats --no-stream ion-sfu
echo ""

echo "Rece~/monitor-ion-sfu.sh >> /var/log/ion-sfu-monitor.log 2>&1

# View monitoring logs
tail -f /var/log/ion-sfu-monitor.log
docker logs --tail 100 ion-sfu 2>&1 | grep -i error
echo ""

echo "System Resources:"
free -h
echo ""

echo "Network Connections:"
sudo netstat -tulpn | grep -E '(50051|5000|3478)'
```

```bash
chmod +x ~/moService Won't Start

```bash
# Check service status
sudo systemctl status ion-sfu

# Check logs untuk error detail
sudo journalctl -u ion-sfu -n 100

# Common issues:
# 1. Port already in use
sudo netstat -tulpn | grep -E '(7000|5000)'

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:7000)

# 2. Permission issues
sudo chown -R www-data:www-data /etc/ion-sfu
sudo chown -R www-data:www-data /var/log/ion-sfu

# 3. Config syntax error - test config
ion-sfu-signal -c /etc/ion-sfu/sfu.toml

# Restart service
sudo systemctl restart ion-sfu
```

### Problem: High Memory Usage

```bash
# Check memory
ps aux | grep ion-sfu | grep -v grep

# If > 200MB, check concurrent connections
sudo journalctl -u ion-sfu | grep -i "peer"

# Check resource limits
systemctl show ion-sfu | grep Memory

# Restart to clear memory
sudo systemctl restart ion-sfu
```

### Problem: Build Failed / Wrong Path

```bash
# Ion-SFU master branch memiliki struktur standard
cd ~/ion-sfu

# Check what's available
ls -la cmd/signal/
# Output: allrpc  grpc  json-rpc

# Build options:

# Option 1: allrpc (RECOMMENDED - support JSON-RPC + gRPC)
go build -o ion-sfu-signal cmd/signal/allrpc/main.go

# Option 2: json-rpc only (WebSocket untuk web client)
go build -o ion-sfu-signal cmd/signal/json-rpc/main.go

# Option 3: grpc only (untuk backend integration)
go build -o ion-sfu-signal cmd/signal/grpc/main.go

# If build fails, check dependencies
go clean
go mod tidy
go mod download
# Try again

# Verify build
ls -lh ion-sfu-signal
./ion-sfu-signal --help
```

### Problem: WebSocket Connection Failed (via Caddy)

```bash
# 1. Check Caddy status
sudo systemctl status caddy

# 2. Check Caddy logs
sudo journalctl -u caddy -n 50

# 3. Test WebSocket local (bypass Caddy)
websocat ws://127.0.0.1:7000/ws

# 4. Test WebSocket via Caddy
websocat wss://sfu.yourdomain.com/ws

# 5. Verify Caddy config
sudo caddy validate --config /etc/caddy/Caddyfile

# 6. Check SSL certificate
curl -I https://sfu.yourdomain.com/health
```

### Problem: Clients Can't Connect to SFU

```bash
# 1. Check firewall UDP ports
sudo ufw status | grep 5000

# 2. Check UDP ports listening
sudo netstat -ulpn | grep ion-sfu

# 3. Check logs for errors
sudo journalctl -u ion-sfu | grep -i error

# 4. Verify NAT configuration
sudo nano /etc/ion-sfu/sfu.toml
# Pastikan nat1to1ips diset dengan public IP yang benar

# 5. Test dari client browser (use test HTML above)
# Check browser console untuk WebRTC errors

# 6. Verify client config (.env):
# WEBRTC_MODE=sfu
# ION_SFU_ENABLED=true
# ION_SFU_SERVER_URL=wss://sfu.yourdomain.com/ws
# SFU_SERVER_IP=YOUR_VPS/etc/ion-sfu/sfu.toml:
# [router.rtp]
# maxbuffer = 1000  # Increase if packet loss

# Restart after config change
sudo systemctl restart ion-sfu
```

### Problem: Coturn STUN/TURN Not Working

```bash
# Test Coturn STUN directly
stun turn.yourdomain.com -p 3478

# Test Coturn TURN (requires credentials)
# Use test HTML browser tool above
=== Service Management ===
sudo systemctl start ion-sfu      # Start
sudo systemctl stop ion-sfu       # Stop
sudo systemctl restart ion-sfu    # Restart
sudo systemctl status ion-sfu     # Status
sudo systemctl enable ion-sfu     # Enable auto-start
sudo systemctl disable ion-sfu    # Disable auto-start

# === Logs ===
sudo journalctl -u ion-sfu -f                    # Follow logs
sudo journalctl -u ion-sfu -n 100                # Last 100 lines
sudo journalctl -u ion-sfu --since "1 hour ago"  # Last 1 hour
sudo journalctl -u ion-sfu | grep -i error       # Errors only
tail -f /var/log/ion-sfu/output.log              # Output log
tail -f /var/log/ion-sfu/error.log               # Error log

# === Resource Monitoring ===
ps aux | grep ion-sfu                 # Process info
htop -p $(pgrep ion-sfu)              # Interactive monitor
sudo netstat -tulpn | grep ion-sfu    # Network connections
free -h                                # Memory usage
df -h                                  # Disk usage

# === Configuration ===
sudo nano /etc/ion-sfu/sfu.toml                      # Edit config
ion-sfu-signal -c /etc/ion-sfu/sfu.toml             # Test run / validate
sudo systemctl restart ion-sfu                       # Apply changes

# === Caddy Management ===
sudo systemctl restart caddy           # Restart Caddy
sudo systemctl reload caddy            # Reload config
sudo caddy validate --config /etc/caddy/Caddyfile  # Validate
sudo journalctl -u caddy -f            # Caddy logs

# === Update Ion-SFU ===
cd ~/ion-environment variables di `.env`:
     ```bash
     WEBRTC_MODE=sfu
     ION_SFU_ENABLED=true
     ION_SFU_SERVER_URL=wss://sfu.yourdomain.com/ws
     SFU_SERVER_IP=YOUR_VPS_PUBLIC_IP
     ```

2. **SSL/TLS sudah ready** ✅
   - Caddy sudah handle SSL auto via Let's Encrypt
   - WebSocket via WSS (secure)
   - No manual certificate management needed!

3. **Monitoring Production**
   - Use monitoring script di atas
   - Setup alerting (email/Telegram) via cron
   - Monitor bandwidth dengan `vnstat` atau `iftop`
   - Track concurrent users via logs

4. **Performance Tuning**
   - Adjust bitrate limits di `/etc/ion-sfu/sfu.toml`
   - Optimize video resolution di client config
   - Enable/disable simulcast berdasarkan needs
   - Monitor & adjust `maxbuffer` untuk packet loss

5. **Optional: Coturn Integration**
   - Jika client tetap gagal connect (extreme NAT)
   - Uncomment TURN config di `/etc/ion-sfu/sfu.toml`
   - Add Coturn credentials
   - Test dengan browser tool
# Adjust buffer size in ion-sfu-config.toml:
# [router.rtp]
# maxbuffer = 1000  # Increase if packet loss

# Restart after config change
docker compose -f docker-compose.sfu.yml restart
```

---

## 📝 Useful Commands

```bash
# Start Ion-SFU
docker compose -f docker-compose.sfu.yml up -d

# Stop Ion-SFU
docker compose -f docker-compose.sfu.yml down
Go Language**: https://go.dev/
- **Caddy Server**: https://caddyserver.com/docs/
- **WebRTC Glossary**: https://webrtcglossary.com/
- **Systemd Guide**: https://www.freedesktop.org/software/systemd/man/systemd.service.html

---

## 🆘 Support

Jika mengalami masalah:

1. Check service: `sudo systemctl status ion-sfu`
2. Check logs: `sudo journalctl -u ion-sfu -n 100`
3. Verify config: pastikan domain & IP benar di `/etc/ion-sfu/sfu.toml`
4. Test WebSocket: `websocat wss://sfu.yourdomain.com/ws`
5. Check firewall: `sudo ufw status verbose`
6. Test STUN: gunakan browser test HTML di atas
7. Monitor resource: `ps aux | grep
docker exec -it ion-sfu sh

# Update Ion-SFU image
docker compose -f docker-compose.sfu.yml pull
docker compose -f docker-compose.sfu.yml up -d

# Clean up
docker system prune -af --volumes
```

---

## 🎓 Next Steps

1. **Integrate dengan aplikasi kamu**
   - Update [src/config/webrtc.js](src/config/webrtc.js)
   - Set `WEBRTC_MODE=sfu` di `.env`
   - Set `SFU_SERVER_IP` dengan IP VPS kamu

2. **Setup SSL/TLS**
   - Install Nginx reverse proxy
### System Requirements
- [ ] VPS Ubuntu 24.04 dengan Public IP
- [ ] RAM minimal 1GB (500MB available)
- [ ] Domain pointing ke VPS (A record)

### Software Installation
- [ ] Go 1.21+ terinstall: `go version`
- [ ] Ion-SFU binary di `/usr/local/bin/`
- [ ] Caddy terinstall: `caddy version`

### Configuration
- [ ] `/etc/ion-sfu/sfu.toml` configured dengan:
  - [ ] `nat1to1ips` = Public IP VPS
  - [ ] `[[webrtc.stun]]` = Coturn domain/IP
  - [ ] `[[webrtc.turn]]` = Coturn credentials (optional)
- [ ] `/etc/caddy/Caddyfile` configured:
  - [ ] Domain `sfu.yourdomain.com`
  - [ ] Reverse proxy ke `127.0.0.1:7000`
  - [ ] SSL auto via Let's Encrypt

### Services
- [ ] Systemd service: `sudo systemctl status ion-sfu`
- [ ] Auto-start enabled: `sudo systemctl is-enabled ion-sfu`
- [ ] Caddy running: `sudo systemctl status caddy`

### Firewall
- [ ] Port 80/443 (HTTP/HTTPS) open
- [ ] Port 5000-5050/udp (WebRTC) open
- [ ] Port 7000 NOT exposed (proxied by Caddy)

### Testing
- [ ] WebSocket: `websocat wss://sfu.yourdomain.com/ws`
- [ ] STUN: `stun turn.yourdomain.com -p 3478`
- [ ] Browser test: gunakan test HTML sukses
- [ ] SSL certificate valid (auto dari Let's Encrypt)

### Production Ready
- [ ] Logrotate configured
- [ ] Monitoring script setup
- [ ] Backup script enabled (cron)
- [ ] Resource monitoring active

### Client Integration
- [ ] `.env` file updated:
  - [ ] `WEBRTC_MODE=sfu`
  - [ ] `ION_SFU_ENABLED=true`
  - [ ] `ION_SFU_SERVER_URL=wss://sfu.yourdomain.com/ws`
- [ ] `src/config/webrtc.js` updated untuk SFU mode

---

## 🎊 Congratulations!

Ion-SFU sudah running native di VPS 1GB RAM kamu dengan:
- ✅ **~20-40MB RAM usage** (idle) - 50% lebih hemat dari Docker!
- ✅ **Caddy reverse proxy** dengan SSL auto
- ✅ **Coturn integration** untuk STUN/TURN fallback
- ✅ **Production-ready** dengan systemd, logrotate, monitoring

**Happy Streaming! 🎉**

---

## 💡 Tips Optimization VPS 1GB RAM

```bash
# Total memory allocation target:
# - System: ~200MB
# - Ion-SFU: ~40MB idle, ~200MB peak (25 users)
# - Caddy: ~20MB
# - Coturn: ~50MB (jika pakai)
# - Node.js app: ~150-200MB
# - Available: ~100-200MB buffer
# = Total: ~900MB used (safe!)

# Monitor real-time
watch -n 2 free -h

# Jika memory mendekati limit, adjust Ion-SFU config:
sudo nano /etc/ion-sfu/sfu.toml
# Reduce: maxbandwidth, maxpackettrack, maxbuffer, maxlayers
```

---

## ⚠️ IMPORTANT: Signaling Server

**Ion-SFU v1.0.x adalah SFU core saja**, tidak include signaling server built-in.

Anda perlu:
1. **Implement signaling server sendiri** (WebSocket/Socket.io)
2. **Atau gunakan ion-app-web** sebagai reference: https://github.com/pion/ion-app-web
3. **Atau integrate dengan aplikasi Node.js existing** kamu

Signaling server bertugas:
- Handle WebSocket connections dari client
- Forward offer/answer/ICE candidates
- Communicate dengan Ion-SFU via gRPC

Contoh sederhana akan ditambahkan di dokumentasi terpisah.
---

## 📚 Resources

- **Ion-SFU GitHub**: https://github.com/pion/ion-sfu
- **Pion WebRTC**: https://github.com/pion/webrtc
- **Docker Docs**: https://docs.docker.com/
- **WebRTC Glossary**: https://webrtcglossary.com/

---

## 🆘 Support

Jika mengalami masalah:

1. Check logs: `docker logs ion-sfu`
2. Verify konfigurasi: pastikan IP public benar
3. Test connectivity: gunakan test HTML di atas
4. Check firewall: `sudo ufw status`
5. Review resource: `docker stats ion-sfu`

---

## ✅ Checklist Setup

- [ ] VPS dengan Ubuntu 24.04 & Public IP
- [ ] Docker & Docker Compose terinstall
- [ ] Firewall configured (ports 50051, 5000-5050, 3478)
- [ ] ion-sfu-config.toml dengan IP public correct
- [ ] docker-compose.sfu.yml configured
- [ ] Container running: `docker ps`
- [ ] gRPC accessible: `grpcurl test`
- [ ] STUN working: `stun test`
- [ ] Client test berhasil connect
- [ ] Monitoring setup
- [ ] Backup script enabled

**Happy Streaming! 🎉**
