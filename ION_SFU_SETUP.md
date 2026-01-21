# 🚀 Instalasi Ion-SFU di Ubuntu Server 24.04

Panduan lengkap setup **Ion-SFU** (Selective Forwarding Unit) untuk WebRTC video call di VPS Ubuntu Server 24.04 dengan RAM 1GB.

---

## 📋 Table of Contents

- [Requirements](#-requirements)
- [Persiapan VPS](#-persiapan-vps)
- [Install Docker & Docker Compose](#-install-docker--docker-compose)
- [Setup Ion-SFU](#-setup-ion-sfu)
- [Konfigurasi Firewall](#-konfigurasi-firewall)
- [Testing & Verification](#-testing--verification)
- [Production Deployment](#-production-deployment)
- [Monitoring & Maintenance](#-monitoring--maintenance)
- [Troubleshooting](#-troubleshooting)

---

## 📦 Requirements

### Hardware Minimum (VPS)
- **RAM**: 1GB (recommended 2GB untuk 50+ users)
- **CPU**: 1 vCPU (shared OK)
- **Storage**: 10GB SSD
- **Bandwidth**: 100 Mbps unmetered (untuk 25 concurrent users)

### Software Requirements
- **OS**: Ubuntu Server 24.04 LTS
- **Docker**: 24.x atau lebih baru
- **Docker Compose**: v2.x
- **Public IP**: Wajib (tidak bisa di belakang NAT)

### Network Requirements
- Port **50051** (gRPC API)
- Port **5000-5050** (WebRTC UDP)
- Port **3478** (STUN - optional)

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

## 🐳 Install Docker & Docker Compose

### 1. Install Docker

```bash
# Remove old Docker versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Setup Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
# Output: Docker version 24.x.x

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Configure Docker (Non-Root User)

```bash
# Add current user to docker group
sudo usermod -aG docker $USER

# Apply group changes (logout & login, atau:)
newgrp docker

# Test Docker without sudo
docker run hello-world
# Should work without sudo!
```

### 3. Install Docker Compose V2

```bash
# Docker Compose V2 sudah include dengan Docker Engine
docker compose version
# Output: Docker Compose version v2.x.x
```

---

## 🎯 Setup Ion-SFU

### 1. Clone Project Repository

```bash
# Navigate to home directory
cd ~

# Clone your project (sesuaikan dengan repository kamu)
git clone https://github.com/YOUR_USERNAME/web-video-call.git
cd web-video-call

# Atau jika manual upload
mkdir -p ~/web-video-call
cd ~/web-video-call
```

### 2. Create Docker Compose File

```bash
nano docker-compose.sfu.yml
```

Paste konfigurasi berikut:

```yaml
version: '3.8'

services:
  # Ion-SFU - Lightweight WebRTC SFU
  ion-sfu:
    image: pionwebrtc/ion-sfu:v1.12.4
    container_name: ion-sfu
    restart: unless-stopped
    
    # Resource limits untuk VPS 1GB RAM
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.5'
        reservations:
          memory: 64M
    
    ports:
      # gRPC API
      - "50051:50051"
      # WebRTC UDP ports
      - "5000-5050:5000-5050/udp"
      # STUN (optional)
      - "3478:3478/udp"
    
    volumes:
      - ./ion-sfu-config.toml:/configs/sfu.toml:ro
      - ion-sfu-data:/data
    
    environment:
      - SFU_CONFIG_FILE=/configs/sfu.toml
      # Go runtime optimization
      - GOGC=50
      - GOMEMLIMIT=200MiB
    
    networks:
      - webrtc-network
    
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  ion-sfu-data:
    driver: local

networks:
  webrtc-network:
    driver: bridge
```

### 3. Create Ion-SFU Configuration

```bash
nano ion-sfu-config.toml
```

**⚠️ PENTING: Ganti `YOUR_VPS_PUBLIC_IP` dengan IP VPS kamu!**

```toml
# =============================================================================
# ION-SFU CONFIGURATION - OPTIMIZED FOR 1GB RAM VPS
# =============================================================================

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
# ICE configuration
icetimeout = 25
iceportrange = [5000, 5050]
icecandidatetimeout = 10

# STUN servers - GANTI DENGAN IP VPS KAMU!
[[webrtc.stun]]
urls = ["stun:YOUR_VPS_PUBLIC_IP:3478"]

# Google STUN sebagai fallback
[[webrtc.stun]]
urls = ["stun:stun.l.google.com:19302"]

# Network settings
[webrtc.candidates]
icelite = true

# GANTI DENGAN PUBLIC IP VPS KAMU jika di belakang NAT
# nat1to1ips = ["YOUR_VPS_PUBLIC_IP"]

[webrtc.sdpsemantics]
sdpsemantics = "unified-plan-with-fallback"

[router.video]
maxlayers = 2

[log]
level = "info"

[turn]
enabled = false

[nack]
enabled = true
```

### 4. Get Your VPS Public IP

```bash
# Check public IP
curl -4 ifconfig.me
# atau
curl -4 icanhazip.com

# Simpan IP ini dan ganti di ion-sfu-config.toml!
```

Edit konfigurasi:

```bash
nano ion-sfu-config.toml

# Ganti semua "YOUR_VPS_PUBLIC_IP" dengan IP VPS kamu
# Contoh: 103.123.45.67
```

---

## 🔥 Konfigurasi Firewall

### UFW (Ubuntu Firewall)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (PENTING! Jangan sampai locked out)
sudo ufw allow 22/tcp

# Allow HTTP & HTTPS (untuk web app)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Ion-SFU gRPC
sudo ufw allow 50051/tcp

# Allow WebRTC UDP ports
sudo ufw allow 5000:5050/udp

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

# Should show:
# CONTAINER ID   IMAGE                              STATUS    PORTS
# xxx            pionwebrtc/ion-sfu:v1.12.4        Up        0.0.0.0:50051->50051/tcp, ...
```

### 3. Check Resource Usage

```bash
# Real-time stats
docker stats ion-sfu

# Should show ~30-50MB RAM usage when idle
```

---

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

### 4. Test from Client (Browser)

Buat file test HTML sederhana:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Ion-SFU Test</title>
</head>
<body>
    <h1>Ion-SFU Connection Test</h1>
    <button onclick="testConnection()">Test Connection</button>
    <pre id="result"></pre>
    
    <script>
        async function testConnection() {
            const result = document.getElementById('result');
            result.textContent = 'Testing...';
            
            const config = {
                iceServers: [
                    { urls: 'stun:YOUR_VPS_IP:3478' },
                    { urls: 'stun:stun.l.google.com:19302' }
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
                
                // Wait for ICE gathering
                await new Promise(resolve => {
                    pc.onicegatheringstatechange = () => {
                        if (pc.iceGatheringState === 'complete') resolve();
                    };
                });
                
                result.textContent = 'SUCCESS!\n\nICE Candidates:\n' + 
                    JSON.stringify(pc.localDescription, null, 2);
                
            } catch(err) {
                result.textContent = 'ERROR: ' + err.message;
            }
        }
    </script>
</body>
</html>
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

echo "Recent Logs (Errors only):"
docker logs --tail 100 ion-sfu 2>&1 | grep -i error
echo ""

echo "System Resources:"
free -h
echo ""

echo "Network Connections:"
sudo netstat -tulpn | grep -E '(50051|5000|3478)'
```

```bash
chmod +x ~/monitor-ion-sfu.sh

# Run manual
~/monitor-ion-sfu.sh

# Or schedule hourly check
crontab -e
# Add:
0 * * * * /root/monitor-ion-sfu.sh >> /var/log/ion-sfu-monitor.log 2>&1
```

---

## 🔍 Troubleshooting

### Problem: Container Won't Start

```bash
# Check logs
docker logs ion-sfu

# Common issues:
# 1. Port already in use
sudo netstat -tulpn | grep -E '(50051|5000)'

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:50051)

# 2. Permission issues
sudo chown -R $USER:$USER ~/web-video-call

# Restart container
docker compose -f docker-compose.sfu.yml restart
```

### Problem: High Memory Usage

```bash
# Check memory
docker stats ion-sfu

# If > 300MB, check concurrent connections
docker logs ion-sfu | grep -i "peer"

# Restart to clear memory
docker compose -f docker-compose.sfu.yml restart ion-sfu
```

### Problem: WebRTC Connection Failed

```bash
# 1. Verify firewall
sudo ufw status

# 2. Test STUN
stun YOUR_VPS_IP -p 3478

# 3. Check NAT configuration
nano ion-sfu-config.toml
# Ensure nat1to1ips is set correctly

# 4. Verify public IP in config matches actual IP
curl -4 ifconfig.me
```

### Problem: Clients Can't Connect

```bash
# 1. Check gRPC is accessible
grpcurl -plaintext YOUR_VPS_IP:50051 list

# 2. Check UDP ports are open
sudo netstat -ulpn | grep docker

# 3. Check logs for errors
docker logs ion-sfu | grep -i error

# 4. Verify client is using correct server URL in .env:
# ION_SFU_ENABLED=true
# SFU_SERVER_IP=YOUR_ACTUAL_VPS_IP
```

### Problem: Packet Loss / Quality Issues

```bash
# Check network stats
sudo ethtool eth0 | grep -E '(Speed|Duplex)'

# Check packet drops
netstat -i

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

# Restart Ion-SFU
docker compose -f docker-compose.sfu.yml restart

# View logs (follow)
docker compose -f docker-compose.sfu.yml logs -f

# View logs (last 100 lines)
docker logs --tail 100 ion-sfu

# Check resource usage
docker stats ion-sfu

# Enter container shell
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
   - Setup Let's Encrypt certificate
   - Enable HTTPS untuk web app

3. **Monitoring Production**
   - Setup alerting (email/Telegram)
   - Monitor bandwidth usage
   - Track concurrent users

4. **Performance Tuning**
   - Adjust bitrate limits berdasarkan usage
   - Optimize video resolution
   - Enable/disable simulcast

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
