# 🚀 Instalasi Ion-SFU di Ubuntu Server 24.04 (Native - No Docker)

Panduan lengkap setup **Ion-SFU** (Selective Forwarding Unit) untuk WebRTC video call di VPS Ubuntu Server 24.04 dengan RAM 1GB **tanpa Docker**.

> **✨ Keuntungan Native Install:**
> - Lebih ringan (~20-40MB RAM idle vs ~50-80MB dengan Docker)
> - Direct system access untuk debugging
> - Integrasi mudah dengan Caddy reverse proxy
> - Support STUN/TURN existing dari Coturn
> - Hemat ~50% memory overhead dibanding Docker

> **📌 Version Info:**
> - Menggunakan **master branch** (latest stable dari GitHub)
> - Build dari source dengan Go 1.21+
> - Signaling server: **allrpc** (support JSON-RPC WebSocket + gRPC)
> - Production-tested untuk VPS 1GB RAM
>
> **⚠️ CRITICAL BUG WARNING:**
> Ion-SFU memiliki bug pada konfigurasi `ballast` di `sfu.toml`. Nilai non-zero akan menyebabkan
> fatal memory allocation error (contoh: ballast=40MB → tries to allocate 2.5TB → instant crash!).
> 
> **SOLUTION: Set `ballast = 0` di semua konfigurasi!** (sudah diperbaiki di dokumentasi ini)

---

## 📋 Table of Contents

- [Requirements](#-requirements)
- [Persiapan VPS](#-persiapan-vps)
- [Install Go Language](#-install-go-language)
- [Install Ion-SFU dari Source](#-install-ion-sfu-dari-source)
- [Konfigurasi Ion-SFU](#️-konfigurasi-ion-sfu)
- [Setup Systemd Service](#-setup-systemd-service)
- [Konfigurasi Caddy Reverse Proxy](#-konfigurasi-caddy-reverse-proxy)
- [Konfigurasi Firewall](#-konfigurasi-firewall)
- [Testing & Verification](#-testing--verification)
- [Production Deployment](#-production-deployment)
- [Monitoring & Maintenance](#-monitoring--maintenance)
- [Troubleshooting](#-troubleshooting)
- [Useful Commands](#-useful-commands)
- [Checklist Setup](#-checklist-setup)

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
- **Caddy**: v2.x (untuk domain & SSL reverse proxy)
- **Public IP**: Wajib (tidak bisa di belakang NAT)
- **Domain**: Optional tapi recommended (untuk WSS secure WebSocket)

### Network Requirements
- Port **7000** (WebSocket signaling - akan di-proxy Caddy, tidak perlu exposed)
- Port **50051** (gRPC API - internal, tidak perlu exposed)
- Port **5000-5200** (WebRTC UDP - direct access wajib)
- Port **80/443** (Caddy - HTTP/HTTPS)

### Optional (Jika pakai Coturn existing)
- Coturn STUN/TURN server sudah running
- Domain untuk TURN (misal: `turn.yourdomain.com`)
- Credentials (username/password untuk TURN)

---

## 🔧 Persiapan VPS

### 1. Login ke VPS & Update System

```bash
# Login via SSH
ssh root@YOUR_VPS_IP

# Update package list
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git nano net-tools htop build-essential pkg-config
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

## 🐹 Install Go Language

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

---

## 📦 Install Ion-SFU dari Source

### 1. Clone Ion-SFU Repository

```bash
# Navigate to home directory
cd ~

# Clone Ion-SFU official repository
git clone https://github.com/pion/ion-sfu.git
cd ion-sfu

# ⚠️ IMPORTANT: Ion-SFU uses "master" branch (NOT "main")
git checkout master
git pull origin master

# Verify branch
git branch
# Should show: * master

# Verify Go modules
go mod download
```

### 2. Build Ion-SFU Binary

Ion-SFU master branch memiliki 3 jenis signaling server:
1. **allrpc** (JSON-RPC + gRPC) - **RECOMMENDED** ⭐ All-in-one, paling flexible
2. **json-rpc** (WebSocket only) - Simple, untuk web client saja
3. **grpc** (gRPC only) - Untuk backend integration

```bash
# Verify available signaling servers
ls cmd/signal/
# Output: allrpc  grpc  json-rpc

echo "Building Ion-SFU signaling server (allrpc)..."

# Build allrpc (all-in-one: JSON-RPC + gRPC) - RECOMMENDED
go build -o ion-sfu-signal cmd/signal/allrpc/main.go

# Alternative builds (uncomment jika ingin gunakan yang lain):
# go build -o ion-sfu-signal cmd/signal/json-rpc/main.go  # WebSocket only
# go build -o ion-sfu-signal cmd/signal/grpc/main.go      # gRPC only

# Verify binary
if [ -f "ion-sfu-signal" ]; then
    echo "✅ Build successful!"
    ls -lh ion-sfu-signal
    file ion-sfu-signal
else
    echo "❌ Build failed!"
    echo "Available signaling servers:"
    ls -la cmd/signal/
    exit 1
fi
```

### 3. Install Binary to System Path

```bash
# Move binary to system path
sudo cp ion-sfu-signal /usr/local/bin/
sudo chmod +x /usr/local/bin/ion-sfu-signal

# Verify installation
which ion-sfu-signal
# Output: /usr/local/bin/ion-sfu-signal

# Test run (should show usage help or version)
ion-sfu-signal --help 2>&1 | head -10
```

### 4. Create Configuration Directory

```bash
# Create directory untuk config & data
sudo mkdir -p /etc/ion-sfu
sudo mkdir -p /var/lib/ion-sfu
sudo mkdir -p /var/log/ion-sfu

# Set ownership (adjust user sesuai setup)
sudo chown -R webrtc:webrtc /etc/ion-sfu
sudo chown -R webrtc:webrtc /var/lib/ion-sfu
sudo chown -R webrtc:webrtc /var/log/ion-sfu

# Verify directories
ls -ld /etc/ion-sfu /var/lib/ion-sfu /var/log/ion-sfu
```

---

## ⚙️ Konfigurasi Ion-SFU

### 1. Get Public IP & Domain Info

```bash
# Get VPS public IP
curl -4 ifconfig.me
# Output: 202.155.91.241 (example - catat ini!)

# Jika kamu sudah punya Coturn, catat:
# - Domain/IP Coturn: turn.mikan.my.id (example)
# - STUN port: 3478 (default)
# - TURN port: 3478 (UDP/TCP)
# - TURNS port: 5349 (TLS)
# - Username & credential (jika pakai static auth)
```

### 2. Create Ion-SFU Configuration

```bash
# Copy base config dari repository sebagai template
cp ~/ion-sfu/config.toml /etc/ion-sfu/sfu.toml

# Edit configuration
nano /etc/ion-sfu/sfu.toml
```

**⚠️ PENTING: Ganti dengan konfigurasi berikut!**

```toml
# =============================================================================
# ION-SFU CONFIGURATION - Native Install (No Docker)
# Branch: master (Latest Stable)
# Signaling: allrpc (JSON-RPC + gRPC)
# Optimized untuk VPS 1GB RAM + Caddy + Coturn Integration
# Location: /etc/ion-sfu/sfu.toml
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
maxbuffer = 1000  # Increased untuk handle packet loss di Indonesia

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
# Use lite mode untuk hemat resource
icelite = true

# NAT 1:1 mapping - UNCOMMENT dan ganti jika VPS di belakang NAT
# (biasanya tidak perlu jika VPS direct public IP)
# nat1to1ips = ["202.155.91.241"]

# SDP semantics
[webrtc.sdpsemantics]
type = "unified-plan"

[router.video]
# Max layers untuk simulcast
maxlayers = 2

[log]
# Log level: debug, info, warn, error
level = "info"
```

**Simpan file dengan Ctrl+O, Enter, Ctrl+X**

### 3. Validate Configuration

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

# Verify ballast is 0 or commented out
grep "^ballast" /etc/ion-sfu/sfu.toml
# Should output: ballast = 0
# Or nothing (commented out)
```

---

## 🔧 Setup Systemd Service

Agar Ion-SFU auto-start dan dapat dimonitor dengan systemctl.

### 1. Create Systemd Service File

```bash
# Create systemd service file
sudo nano /etc/systemd/system/ion-sfu.service
```

**Copy configuration berikut:**

```ini
[Unit]
Description=Ion-SFU Media Server (Native - allrpc signaling)
After=network.target
Documentation=https://github.com/pion/ion-sfu

[Service]
Type=simple
User=webrtc
Group=webrtc
WorkingDirectory=/var/lib/ion-sfu

# ⚠️ CRITICAL: ion-sfu-signal (allrpc) requires -gaddr and -jaddr parameters!
# -c : Config file path
# -gaddr : gRPC server address (default :50051)
# -jaddr : JSON-RPC WebSocket address (default :7000)
# -v : Verbosity level (0=info, 1=debug, 2=trace)
ExecStart=/usr/local/bin/ion-sfu-signal -c /etc/ion-sfu/sfu.toml -gaddr :50051 -jaddr :7000 -v 2

# Logs
StandardOutput=append:/var/log/ion-sfu/output.log
StandardError=append:/var/log/ion-sfu/error.log

# Restart policy
Restart=always
RestartSec=5
StartLimitBurst=5
StartLimitIntervalSec=60

# Resource limits (untuk VPS 1GB RAM)
MemoryLimit=256M
CPUQuota=50%

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/ion-sfu /var/log/ion-sfu

[Install]
WantedBy=multi-user.target
```

**Simpan dengan Ctrl+O, Enter, Ctrl+X**

### 2. Enable & Start Service

```bash
# Reload systemd daemon
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable ion-sfu

# Start the service
sudo systemctl start ion-sfu

# Check status
sudo systemctl status ion-sfu

# Should show: "active (running)" in green
```

### 3. Verify Service Running

```bash
# Check if service is active
sudo systemctl is-active ion-sfu
# Output: active

# Check logs (live)
sudo journalctl -u ion-sfu -f

# Should see:
# [INFO] Config file loaded file=/etc/ion-sfu/sfu.toml
# [INFO] JsonRPC Listening addr=http://:7000
# INFO: wrappered grpc listening :50051

# Press Ctrl+C to stop following logs

# Check listening ports
sudo netstat -tulpn | grep ion-sfu

# Should show:
# tcp6  0  0 :::7000    :::*   LISTEN   <pid>/ion-sfu-signal
# tcp6  0  0 :::50051   :::*   LISTEN   <pid>/ion-sfu-signal

# Check resource usage
ps aux | grep ion-sfu | grep -v grep
# RSS column shows memory usage (~20-40MB idle)
```

---

## 🌐 Konfigurasi Caddy Reverse Proxy

Integrasi Ion-SFU dengan Caddy untuk domain & SSL/TLS otomatis.

### 1. Install Caddy (jika belum)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Verify installation
caddy version
```

### 2. Configure Caddy untuk Ion-SFU

```bash
# Edit Caddyfile
sudo nano /etc/caddy/Caddyfile
```

**Tambahkan konfigurasi untuk Ion-SFU:**

```caddyfile
# Ion-SFU WebSocket endpoint
sfu.mikan.my.id {  # ⚠️ GANTI dengan domain kamu!
    # WebSocket untuk signaling (JSON-RPC via WebSocket)
    # Path /ws diperlukan oleh client untuk connect ke Ion-SFU
    reverse_proxy /ws localhost:7000 {
        # WebSocket headers
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        
        # Optimize untuk WebSocket long-lived connections
        transport http {
            dial_timeout 10s
            read_timeout 300s  # 5 minutes untuk WebSocket
            write_timeout 300s
        }
    }

    # gRPC endpoint (optional, jika butuh external gRPC access)
    # Biasanya gRPC hanya untuk backend internal, tidak perlu di-expose
    # Uncomment jika butuh akses gRPC dari luar
    # reverse_proxy /grpc.* localhost:50051 {
    #     transport http {
    #         versions h2c
    #     }
    # }

    # Health check endpoint
    handle /health {
        respond "Ion-SFU Proxy OK" 200
    }

    # API endpoint (optional)
    handle /api/* {
        reverse_proxy localhost:50051
    }

    # Logs
    log {
        output file /var/log/caddy/sfu.log {
            roll_size 10mb
            roll_keep 5
        }
        format console
    }

    # TLS akan auto via Let's Encrypt (pastikan domain sudah pointing ke VPS)
    # Caddy otomatis request certificate untuk sfu.mikan.my.id
}

# Optional: Redirect root domain ke dokumentasi atau dashboard
# mikan.my.id {
#     redir https://sfu.mikan.my.id{uri} permanent
# }
```

**Simpan dengan Ctrl+O, Enter, Ctrl+X**

### 3. Validate & Reload Caddy

```bash
# Validate config syntax
sudo caddy validate --config /etc/caddy/Caddyfile

# Output should be:
# Valid configuration

# If error, check the error message and fix

# Reload Caddy (apply new config without downtime)
sudo systemctl reload caddy

# Check status
sudo systemctl status caddy

# Check logs untuk SSL certificate generation
sudo journalctl -u caddy -f

# Should see:
# [INFO] Certificate obtained successfully
# [INFO] https://sfu.mikan.my.id

# Press Ctrl+C to stop following logs
```

### 4. Test Caddy Proxy

```bash
# Test health endpoint
curl https://sfu.mikan.my.id/health
# Output: Ion-SFU Proxy OK

# Test SSL certificate
curl -I https://sfu.mikan.my.id/health
# Should show: HTTP/2 200
#              server: Caddy
#              (no SSL errors)
```

---

## 🔥 Konfigurasi Firewall

Configure UFW firewall untuk allow traffic yang diperlukan.

```bash
# Enable UFW (jika belum)
sudo ufw enable

# Allow SSH (PENTING! Jangan sampai locked out)
sudo ufw allow 22/tcp

# Allow HTTP & HTTPS (untuk Caddy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow WebRTC UDP ports (direct client access)
# ⚠️ CRITICAL: Port range harus match dengan iceportrange di sfu.toml!
sudo ufw allow 5000:5200/udp

# Coturn ports (jika pakai Coturn existing di VPS yang sama)
# Uncomment jika Coturn di server yang sama
# sudo ufw allow 3478/tcp    # TURN TCP
# sudo ufw allow 3478/udp    # STUN & TURN UDP
# sudo ufw allow 5349/tcp    # TURNS (TLS)

# Check status
sudo ufw status verbose
```

**⚠️ CATATAN PENTING:**
- Port **7000** (WebSocket) **TIDAK** perlu dibuka karena di-proxy oleh Caddy
- Port **50051** (gRPC) **TIDAK** perlu dibuka jika hanya internal
- Port **5000-5200** (UDP) **WAJIB** dibuka untuk WebRTC media
- Port Coturn hanya dibuka jika Coturn di server yang sama

### Verify Firewall Rules

```bash
sudo ufw status numbered

# Output should show:
# [ 1] 22/tcp         ALLOW IN    Anywhere
# [ 2] 80/tcp         ALLOW IN    Anywhere
# [ 3] 443/tcp        ALLOW IN    Anywhere
# [ 4] 5000:5200/udp  ALLOW IN    Anywhere
```

---

## ✅ Testing & Verification

### 1. Test WebSocket Connection

```bash
# Install websocat untuk testing WebSocket
sudo apt install -y websocat

# Test WebSocket connection (via Caddy SSL)
websocat wss://sfu.mikan.my.id/ws

# Should connect without errors
# You'll see cursor waiting for input (WebSocket connected)
# Press Ctrl+C to exit

# Atau test local (tanpa SSL)
websocat ws://127.0.0.1:7000/ws
```

### 2. Test STUN Server

```bash
# Install stun client (jika belum)
sudo apt install -y stun-client

# Test Coturn STUN kamu
stun turn.mikan.my.id -p 3478

# Should return your public IP address
```

### 3. Check Service Logs

```bash
# Check Ion-SFU logs
sudo journalctl -u ion-sfu -n 100

# Should see:
# [INFO] Config file loaded
# [INFO] JsonRPC Listening addr=http://:7000
# INFO: wrappered grpc listening :50051

# Check Caddy logs
sudo journalctl -u caddy -n 50

# Should see successful reverse proxy logs
```

### 4. Test from Client (Browser)

Buat file test HTML untuk test dari browser:

```bash
# Create test file
sudo mkdir -p /var/www/html
sudo nano /var/www/html/test-sfu.html
```

```html
<!DOCTYPE html>
<html>
<head>
    <title>Ion-SFU Connection Test</title>
    <meta charset="UTF-8">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
            max-width: 900px;
            margin: 0 auto;
        }
        button { 
            padding: 10px 20px; 
            font-size: 16px;
            margin: 5px;
            cursor: pointer;
        }
        #result { 
            background: #f0f0f0; 
            padding: 15px; 
            margin-top: 20px;
            border-radius: 5px;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: monospace;
            max-height: 500px;
            overflow-y: auto;
        }
        .success { color: green; font-weight: bold; }
        .error { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <h1>🎯 Ion-SFU Connection Test</h1>
    <p>Test koneksi ke SFU server via WSS (Caddy proxy)</p>
    
    <button onclick="testConnection()">🚀 Test WebSocket Connection</button>
    <button onclick="testSTUN()">📡 Test STUN & ICE Gathering</button>
    
    <div id="result">Click button untuk test...</div>
    
    <script>
        const SFU_WSS_URL = 'wss://sfu.mikan.my.id/ws';  // ⚠️ GANTI dengan domain kamu!
        const STUN_SERVERS = [
            'stun:202.155.91.241:3478',  // VPS IP - GANTI!
            'stun:turn.mikan.my.id:3478',  // Coturn STUN - GANTI!
            'stun:stun.l.google.com:19302'    // Google fallback
        ];
        
        async function testConnection() {
            const result = document.getElementById('result');
            result.innerHTML = '⏳ Testing WebSocket connection to SFU...\n';
            result.innerHTML += `URL: ${SFU_WSS_URL}\n\n`;
            
            try {
                // Test WebSocket connection
                const ws = new WebSocket(SFU_WSS_URL);
                
                ws.onopen = () => {
                    result.innerHTML += '<span class="success">✅ WebSocket connected successfully!</span>\n';
                    result.innerHTML += `Connection established to: ${SFU_WSS_URL}\n`;
                    result.innerHTML += `Ready state: ${ws.readyState} (OPEN)\n`;
                    
                    // Close connection after test
                    setTimeout(() => {
                        ws.close();
                        result.innerHTML += '\n🔚 Test completed - connection closed\n';
                    }, 2000);
                };
                
                ws.onerror = (err) => {
                    result.innerHTML += '<span class="error">❌ WebSocket error!</span>\n';
                    result.innerHTML += `Error: ${JSON.stringify(err)}\n`;
                    result.innerHTML += '\n📋 Troubleshooting:\n';
                    result.innerHTML += '1. Check if Ion-SFU service is running\n';
                    result.innerHTML += '2. Check Caddy configuration\n';
                    result.innerHTML += '3. Check domain DNS points to VPS\n';
                    result.innerHTML += '4. Check firewall allows port 80/443\n';
                };
                
                ws.onclose = (event) => {
                    if (!event.wasClean) {
                        result.innerHTML += '<span class="error">⚠️ Connection closed unexpectedly!</span>\n';
                        result.innerHTML += `Code: ${event.code}, Reason: ${event.reason || 'N/A'}\n`;
                    }
                };
                
            } catch(err) {
                result.innerHTML += '<span class="error">❌ Connection failed!</span>\n';
                result.innerHTML += `Error: ${err.message}\n`;
            }
        }
        
        async function testSTUN() {
            const result = document.getElementById('result');
            result.innerHTML = '⏳ Testing STUN servers & ICE gathering...\n';
            result.innerHTML += 'This will test if your STUN servers are reachable.\n\n';
            
            const config = {
                iceServers: STUN_SERVERS.map(url => ({ urls: url }))
            };
            
            try {
                const pc = new RTCPeerConnection(config);
                
                result.innerHTML += '📋 ICE Servers configured:\n';
                STUN_SERVERS.forEach(url => {
                    result.innerHTML += `  - ${url}\n`;
                });
                result.innerHTML += '\n';
                
                // Create dummy data channel
                pc.createDataChannel('test');
                
                // Create offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                
                result.innerHTML += '⏳ Gathering ICE candidates...\n\n';
                
                // Collect candidates
                const candidates = [];
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        candidates.push(event.candidate);
                        result.innerHTML += `.`;
                    }
                };
                
                // Wait for ICE gathering
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('ICE gathering timeout (10s)'));
                    }, 10000);
                    
                    pc.onicegatheringstatechange = () => {
                        if (pc.iceGatheringState === 'complete') {
                            clearTimeout(timeout);
                            resolve();
                        }
                    };
                });
                
                result.innerHTML += '\n\n<span class="success">✅ ICE gathering complete!</span>\n';
                result.innerHTML += `\nTotal candidates gathered: ${candidates.length}\n\n`;
                
                // Parse and categorize candidates
                const types = {
                    host: [],
                    srflx: [],  // Server reflexive (via STUN)
                    relay: []   // Relayed (via TURN)
                };
                
                candidates.forEach(c => {
                    if (c.candidate.includes('typ host')) types.host.push(c);
                    if (c.candidate.includes('typ srflx')) types.srflx.push(c);
                    if (c.candidate.includes('typ relay')) types.relay.push(c);
                });
                
                result.innerHTML += '📊 Candidate Types:\n';
                result.innerHTML += `  Host candidates: ${types.host.length}\n`;
                result.innerHTML += `  Server Reflexive (STUN): ${types.srflx.length}\n`;
                result.innerHTML += `  Relayed (TURN): ${types.relay.length}\n\n`;
                
                // Show candidates details
                result.innerHTML += '🔍 Candidate Details:\n\n';
                candidates.forEach((c, i) => {
                    result.innerHTML += `[${i+1}] ${c.candidate}\n`;
                });
                
                // Verify STUN working
                if (types.srflx.length > 0) {
                    result.innerHTML += '\n<span class="success">✅ STUN servers are working!</span>\n';
                    result.innerHTML += `Successfully obtained ${types.srflx.length} server reflexive candidates.\n`;
                } else {
                    result.innerHTML += '\n<span class="error">⚠️ No server reflexive candidates!</span>\n';
                    result.innerHTML += 'STUN servers may not be reachable or configured correctly.\n';
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
# Jika Caddy sudah serve /var/www/html, akses:
# https://yourdomain.com/test-sfu.html

# Atau serve manual dengan Python:
cd /var/www/html
python3 -m http.server 8080

# Lalu buka di browser:
# http://YOUR_VPS_IP:8080/test-sfu.html

# Klik "Test WebSocket Connection" untuk test WebSocket
# Klik "Test STUN & ICE Gathering" untuk test ICE gathering
```

---

## 🏭 Production Deployment

### 1. Verify Auto-Restart on Boot

```bash
# Systemd service sudah di-enable
# Verify dengan reboot VPS:
sudo reboot

# Setelah reboot (tunggu 1-2 menit), SSH kembali dan check:
sudo systemctl status ion-sfu

# Should be "active (running)" automatically
# Jika tidak running, check logs:
sudo journalctl -u ion-sfu -n 50
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
    create 0640 webrtc webrtc
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
```

### 3. Enable Monitoring

Create monitoring script:

```bash
# Create monitoring script
nano ~/monitor-ion-sfu.sh
```

```bash
#!/bin/bash

echo "=== Ion-SFU Status ==="
echo "Time: $(date)"
echo ""

echo "Service Status:"
systemctl is-active ion-sfu
echo ""

echo "Resource Usage:"
ps aux | grep ion-sfu | grep -v grep | awk '{print "CPU: "$3"% | RAM: "$4"% | RSS: "$6" KB"}'
echo ""

echo "Memory Details:"
free -h
echo ""

echo "Recent Errors (last 100 lines):"
journalctl -u ion-sfu -n 100 --no-pager | grep -i error | tail -10
echo ""

echo "Network Connections:"
sudo netstat -tulpn | grep -E '(7000|50051|5000)' | head -5
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

```bash
# Make executable
chmod +x ~/monitor-ion-sfu.sh

# Run monitor
~/monitor-ion-sfu.sh

# Setup cron untuk monitoring otomatis (every 5 minutes)
crontab -e

# Add line:
*/5 * * * * ~/monitor-ion-sfu.sh >> /var/log/ion-sfu-monitor.log 2>&1

# View monitoring logs
tail -f /var/log/ion-sfu-monitor.log
```

### 4. Setup Backup Script

```bash
# Create backup script
nano ~/backup-ion-sfu.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/home/webrtc/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup configuration
tar -czf $BACKUP_DIR/ion-sfu-config-$DATE.tar.gz \
    /etc/ion-sfu/sfu.toml \
    /etc/systemd/system/ion-sfu.service \
    /etc/caddy/Caddyfile

# Keep only last 7 backups
cd $BACKUP_DIR
ls -t ion-sfu-config-*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup completed: $DATE"
ls -lh $BACKUP_DIR/ion-sfu-config-$DATE.tar.gz
```

```bash
# Make executable
chmod +x ~/backup-ion-sfu.sh

# Add to crontab (backup setiap hari jam 2 pagi)
crontab -e

# Add line:
0 2 * * * ~/backup-ion-sfu.sh >> /var/log/ion-sfu-backup.log 2>&1
```

---

## 📊 Monitoring & Maintenance

### Daily Monitoring

```bash
# Check service status
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
sudo logrotate -f /etc/logrotate.d/ion-sfu
```

### Performance Monitoring

```bash
# Real-time resource monitoring
watch -n 2 'ps aux | grep ion-sfu | grep -v grep'

# Network monitoring
watch -n 2 'sudo netstat -an | grep -E ":(5000|7000|50051)" | wc -l'

# Memory trend
watch -n 5 'free -h | grep Mem'
```

---

## 🔧 Troubleshooting

### Problem: Service Won't Start / Crashes Immediately

```bash
# Check service status
sudo systemctl status ion-sfu

# Check logs untuk error detail
sudo journalctl -u ion-sfu -n 100

# ⚠️ MOST COMMON ISSUE: Ballast Memory Allocation Bug
# Symptom: "fatal error: runtime: out of memory" di logs
# Symptom: "trying to allocate 2560GB" atau similar huge number
# 
# Cause: Non-zero ballast value in sfu.toml triggers memory allocation bug
# Example: ballast = 41943040 (40MB) → tries to allocate 2.5TB!
#
# Solution:
sudo nano /etc/ion-sfu/sfu.toml
# Find: ballast = 41943040 (or any non-zero value)
# Change to: ballast = 0
# Or comment out: # ballast = 41943040

# Save and restart
sudo systemctl restart ion-sfu
sudo systemctl status ion-sfu
# Should now start successfully!

# Other common issues:

# 1. Port already in use
sudo netstat -tulpn | grep -E '(7000|50051|5000)'

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:7000)
sudo kill -9 $(sudo lsof -t -i:50051)

# 2. Permission issues
sudo chown -R webrtc:webrtc /etc/ion-sfu
sudo chown -R webrtc:webrtc /var/lib/ion-sfu
sudo chown -R webrtc:webrtc /var/log/ion-sfu

# 3. Missing command line parameters
# Symptom: Service starts but WebSocket/gRPC not listening
# Solution: Ensure systemd service has -gaddr and -jaddr parameters
sudo nano /etc/systemd/system/ion-sfu.service
# Verify ExecStart line:
# ExecStart=/usr/local/bin/ion-sfu-signal -c /etc/ion-sfu/sfu.toml -gaddr :50051 -jaddr :7000 -v 2

sudo systemctl daemon-reload
sudo systemctl restart ion-sfu

# 4. Config file not found or syntax error
# Test config file manually:
ion-sfu-signal -c /etc/ion-sfu/sfu.toml -gaddr :50051 -jaddr :7000 -v 5
# Should show:
# [INFO] Config file loaded file=/etc/ion-sfu/sfu.toml
# [INFO] JsonRPC Listening addr=http://:7000
# INFO: wrappered grpc listening :50051
# (Press Ctrl+C to stop)

# 5. Binary not executable
sudo chmod +x /usr/local/bin/ion-sfu-signal

# Final check after fixes
sudo systemctl restart ion-sfu
sudo systemctl status ion-sfu
sudo journalctl -u ion-sfu -f
```

### Problem: High Memory Usage

```bash
# Check memory
ps aux | grep ion-sfu | grep -v grep

# If > 200MB idle (tanpa load), ada masalah
# Check concurrent connections
sudo journalctl -u ion-sfu | grep -i "peer\|connection" | tail -20

# Check resource limits
systemctl show ion-sfu | grep Memory

# Adjust memory limit jika perlu
sudo nano /etc/systemd/system/ion-sfu.service
# Modify: MemoryLimit=256M (sesuai kebutuhan)

sudo systemctl daemon-reload
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
# Try build again

# Verify build
ls -lh ion-sfu-signal
file ion-sfu-signal
./ion-sfu-signal --help 2>&1 | head -5
```

### Problem: WebSocket Connection Failed (via Caddy)

```bash
# 1. Check Caddy status
sudo systemctl status caddy

# 2. Check Caddy logs
sudo journalctl -u caddy -n 50

# 3. Test WebSocket local (bypass Caddy)
websocat ws://127.0.0.1:7000/ws
# Should connect

# 4. Test WebSocket via Caddy
websocat wss://sfu.mikan.my.id/ws
# Should also connect

# 5. Verify Caddy config
sudo caddy validate --config /etc/caddy/Caddyfile

# 6. Check SSL certificate
curl -I https://sfu.mikan.my.id/health

# 7. Verify domain DNS
dig +short sfu.mikan.my.id
# Should return VPS public IP

# 8. Check firewall
sudo ufw status | grep -E '80|443'

# 9. Restart Caddy
sudo systemctl restart caddy
```

### Problem: Clients Can't Connect to SFU

```bash
# 1. Check firewall UDP ports
sudo ufw status | grep 5000

# 2. Check UDP ports listening
sudo netstat -ulpn | grep ion-sfu

# 3. Check logs for errors
sudo journalctl -u ion-sfu | grep -i error

# 4. Verify public IP configuration
sudo nano /etc/ion-sfu/sfu.toml
# Check [[webrtc.iceserver]] urls includes correct public IP

# 5. Test dari client browser (use test HTML above)
# Check browser console untuk WebRTC errors

# 6. Verify client config (.env):
# WEBRTC_MODE=sfu
# ION_SFU_ENABLED=true
# ION_SFU_SERVER_URL=wss://sfu.mikan.my.id/ws
# SFU_SERVER_IP=202.155.91.241

# 7. Test STUN dari client network
# Use browser test tool above
```

### Problem: Poor Video Quality / Packet Loss

```bash
# Adjust buffer size in sfu.toml:
sudo nano /etc/ion-sfu/sfu.toml

# Find and increase:
# [router.rtp]
# maxbuffer = 1500  # Increase if packet loss

# Also check:
# [router]
# maxbandwidth = 2000000  # Increase bandwidth limit

# Restart after config change
sudo systemctl restart ion-sfu

# Monitor packet loss
sudo journalctl -u ion-sfu -f | grep -i "loss\|drop"
```

### Problem: Coturn STUN/TURN Not Working

```bash
# Test Coturn STUN directly
stun turn.mikan.my.id -p 3478

# Should return public IP
# If fails, check Coturn service:
sudo systemctl status coturn

# Test TURN (requires credentials)
# Use test HTML browser tool above

# Verify Coturn credentials in sfu.toml:
grep -A 2 "turn:" /etc/ion-sfu/sfu.toml
# Should show correct username & credential
```

---

## 📝 Useful Commands

```bash
# === Service Management ===
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
ion-sfu-signal -c /etc/ion-sfu/sfu.toml -gaddr :50051 -jaddr :7000 -v 5   # Test run
sudo systemctl restart ion-sfu                       # Apply changes

# === Caddy Management ===
sudo systemctl restart caddy           # Restart Caddy
sudo systemctl reload caddy            # Reload config
sudo caddy validate --config /etc/caddy/Caddyfile  # Validate
sudo journalctl -u caddy -f            # Caddy logs

# === Update Ion-SFU ===
cd ~/ion-sfu
git pull origin master                 # Update source
go build -o ion-sfu-signal cmd/signal/allrpc/main.go  # Rebuild
sudo cp ion-sfu-signal /usr/local/bin/  # Install
sudo systemctl restart ion-sfu         # Restart service

# === Firewall ===
sudo ufw status verbose                # Check firewall
sudo ufw allow 5000:5200/udp           # Allow WebRTC ports
sudo ufw delete allow 5000:5200/udp    # Remove rule

# === Debug ===
sudo strace -p $(pgrep ion-sfu)        # System call trace
sudo lsof -p $(pgrep ion-sfu)          # Open files
sudo tcpdump -i any port 7000          # Capture WebSocket traffic
```

---

## ✅ Checklist Setup (Production Ready)

### System Requirements
- [ ] VPS Ubuntu 24.04 dengan Public IP: _____________
- [ ] RAM minimal 1GB (free memory check): `free -h`
- [ ] Domain sudah pointing ke VPS: `dig +short sfu.yourdomain.com`
- [ ] User non-root created: `webrtc`

### Software Installation
- [ ] Go 1.21+ terinstall: `go version` → should show `go1.21.x`
- [ ] Ion-SFU source cloned: `~/ion-sfu/` exists
- [ ] Ion-SFU binary built: `ls -lh ~/ion-sfu/ion-sfu-signal`
- [ ] Binary installed: `which ion-sfu-signal` → `/usr/local/bin/ion-sfu-signal`
- [ ] Caddy terinstall: `caddy version`

### Configuration Files
- [ ] `/etc/ion-sfu/sfu.toml` exists and configured:
  - [ ] ⚠️ **CRITICAL**: `ballast = 0` (MUST be zero or commented!)
  - [ ] `iceportrange = [5000, 5200]` (untuk ~100 users)
  - [ ] `[[webrtc.iceserver]]` urls pertama = VPS Public IP: `stun:202.155.91.241:3478`
  - [ ] `[[webrtc.iceserver]]` urls kedua = Coturn domain (jika ada)
  - [ ] `[[webrtc.iceserver]]` TURN configured dengan username/credential (optional)
  - [ ] `[webrtc.timeouts]` failed = 30 (untuk Indo mobile network)
  
- [ ] `/etc/caddy/Caddyfile` configured:
  - [ ] Domain `sfu.mikan.my.id` (ganti dengan domain kamu)
  - [ ] `reverse_proxy /ws localhost:7000` untuk WebSocket
  - [ ] Health check endpoint: `handle /health`
  - [ ] Logs configured: `/var/log/caddy/sfu.log`
  
- [ ] `/etc/systemd/system/ion-sfu.service` configured:
  - [ ] User = `webrtc` (atau user non-root kamu)
  - [ ] ⚠️ **ExecStart includes parameters**: `-c /etc/ion-sfu/sfu.toml -gaddr :50051 -jaddr :7000 -v 2`
  - [ ] MemoryLimit = 256M, CPUQuota = 50%
  - [ ] Logs: StandardOutput & StandardError ke `/var/log/ion-sfu/`

### Services Running
- [ ] Ion-SFU service active: `sudo systemctl status ion-sfu` → **active (running)**
- [ ] Auto-start enabled: `sudo systemctl is-enabled ion-sfu` → **enabled**
- [ ] Caddy running: `sudo systemctl status caddy` → **active (running)**
- [ ] No errors in logs: `sudo journalctl -u ion-sfu -n 50` → should show:
  - `[INFO] Config file loaded`
  - `[INFO] JsonRPC Listening addr=http://:7000`
  - `INFO: wrappered grpc listening :50051`

### Network & Firewall
- [ ] Firewall enabled: `sudo ufw status` → **active**
- [ ] Port 80/443 open (HTTP/HTTPS): `sudo ufw status | grep -E '80|443'`
- [ ] Port 5000-5200/udp open (WebRTC): `sudo ufw status | grep 5000:5200`
- [ ] Port 7000 NOT exposed publicly (internal, proxied by Caddy)
- [ ] Port 50051 NOT exposed publicly (internal gRPC)
- [ ] Ports listening correctly: `sudo netstat -tulpn | grep -E '(7000|50051)'`

### SSL/TLS Certificate
- [ ] Caddy auto-generated Let's Encrypt cert: `sudo journalctl -u caddy | grep certificate`
- [ ] SSL working: `curl -I https://sfu.mikan.my.id/health` → **HTTP/2 200**
- [ ] No SSL errors in browser when accessing domain

### Testing Connectivity
- [ ] Manual test run successful: 
  ```bash
  ion-sfu-signal -c /etc/ion-sfu/sfu.toml -gaddr :50051 -jaddr :7000 -v 5
  ```
- [ ] Health endpoint: `curl https://sfu.mikan.my.id/health` → **Ion-SFU Proxy OK**
- [ ] WebSocket test: `websocat wss://sfu.mikan.my.id/ws` → connects without error
- [ ] STUN test: `stun turn.mikan.my.id -p 3478` → returns public IP
- [ ] Browser ICE test: gunakan test HTML → gathers srflx candidates

### Production Optimization
- [ ] Logrotate configured: `/etc/logrotate.d/ion-sfu` exists
- [ ] Log rotation tested: `sudo logrotate -f /etc/logrotate.d/ion-sfu`
- [ ] Monitoring script created: `~/monitor-ion-sfu.sh` exists
- [ ] Backup script enabled: `crontab -l | grep backup`
- [ ] Resource monitoring: `ps aux | grep ion-sfu` → RSS < 100MB idle

### Client Integration (Node.js App)
- [ ] `.env` file updated:
  - [ ] `WEBRTC_MODE=sfu`
  - [ ] `ION_SFU_ENABLED=true`
  - [ ] `ION_SFU_SERVER_URL=wss://sfu.mikan.my.id/ws`
  - [ ] `SFU_SERVER_IP=202.155.91.241` (VPS public IP)
- [ ] `src/config/webrtc.js` updated untuk SFU mode
- [ ] Client WebRTC code updated untuk connect via WebSocket

### Post-Deployment Verification
- [ ] Service survives reboot: `sudo reboot` → check auto-start
- [ ] Memory usage stable: `watch -n 5 'ps aux | grep ion-sfu'`
- [ ] No memory leaks: monitor untuk 24 jam
- [ ] Actual video call test dari Indonesian mobile network (especially Tri)
- [ ] Load test: 10+ concurrent users without crash

---

## 🎊 Congratulations!

Ion-SFU sudah running native di VPS 1GB RAM kamu dengan:
- ✅ **~20-40MB RAM usage** (idle) - 50% lebih hemat dari Docker!
- ✅ **Caddy reverse proxy** dengan SSL auto via Let's Encrypt
- ✅ **Coturn integration** untuk STUN/TURN fallback
- ✅ **Production-ready** dengan systemd, logrotate, monitoring
- ✅ **Secure WebSocket** (WSS) untuk signaling

**Keuntungan SFU dibanding Mesh P2P + TURN:**
- ✅ **95-99% success rate** on Indonesian mobile networks (vs 30-50% with TURN)
- ✅ **Client only makes outbound connections** → Symmetric NAT bukan masalah!
- ✅ **Lower client upload bandwidth** → 1x to server vs Nx to all peers
- ✅ **Better scalability** → Server handle forwarding, not client
- ✅ **Reliable on Tri/XL/Indosat** → No more connection failures!

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
# Example: maxbandwidth = 1000000 (1 Mbps instead of 1.5 Mbps)
```

---

## 📚 Resources

- **Ion-SFU GitHub**: https://github.com/pion/ion-sfu
- **Pion WebRTC**: https://github.com/pion/webrtc
- **Ion Examples**: https://github.com/pion/ion-app-web
- **Go Language**: https://go.dev/
- **Caddy Server**: https://caddyserver.com/docs/
- **WebRTC Glossary**: https://webrtcglossary.com/
- **Systemd Guide**: https://www.freedesktop.org/software/systemd/man/systemd.service.html

---

## 🆘 Support

Jika mengalami masalah:

1. ✅ Check service: `sudo systemctl status ion-sfu`
2. ✅ Check logs: `sudo journalctl -u ion-sfu -n 100`
3. ✅ Verify config ballast=0: `grep ballast /etc/ion-sfu/sfu.toml`
4. ✅ Test manual run: `ion-sfu-signal -c /etc/ion-sfu/sfu.toml -gaddr :50051 -jaddr :7000 -v 5`
5. ✅ Test WebSocket: `websocat wss://sfu.mikan.my.id/ws`
6. ✅ Check firewall: `sudo ufw status verbose`
7. ✅ Test STUN: gunakan browser test HTML
8. ✅ Monitor resource: `ps aux | grep ion-sfu`

**Most Common Issues:**
- 🔥 **Ballast Bug**: Non-zero ballast → instant crash. Solution: `ballast = 0`
- 🔥 **Missing Parameters**: Systemd service must have `-gaddr :50051 -jaddr :7000`
- 🔥 **Firewall**: UDP ports 5000-5200 must be open
- 🔥 **Domain DNS**: Must point to VPS public IP

---

**Version:** 1.0 (2026-01-21)  
**Tested on:** Ubuntu Server 24.04 LTS, VPS 1GB RAM, Ion-SFU master branch  
**Status:** Production-tested ✅
