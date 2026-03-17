# 🚀 Deployment & Production Setup

## Pre-Deployment Checklist

- [ ] Code reviewed and tested locally
- [ ] All dependencies installed
- [ ] Environment variables configured
- [ ] Database backups configured
- [ ] SSL/TLS certificate obtained
- [ ] TURN server setup (if using Mesh mode)
- [ ] Monitoring & logging configured
- [ ] Load testing completed
- [ ] Disaster recovery plan ready

---

## 1. Server Requirements

### Minimum Specifications (Single Server)

```
CPU:    2 cores @ 2 GHz
RAM:    2 GB minimum (4 GB recommended)
Storage: 20 GB SSD
Network: 100 Mbps outbound dedicated
OS:     Ubuntu 20.04 LTS atau CentOS 8+
```

### Recommended Production (Scalable)

```
Load Balancer:
  - 1 core, 1 GB RAM
  - Nginx/HAProxy

App Servers (per region):
  - 4 cores, 8 GB RAM
  - 3-5 instances recommended

Database:
  - MongoDB Atlas (managed)
  - Or self-hosted replica set

TURN Server:
  - 2 cores, 2 GB RAM
  - Coturn (open source)
  - Per 1000 users: +1 instance

CDN:
  - CloudFlare or AWS CloudFront
  - Static assets caching
```

---

## 2. SSL/TLS Certificate

**Required**: HTTPS is necessary for:
- getUserMedia() (camera/mic access)
- ServiceWorker (future)
- Secure WebSocket (WSS)

### Using Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Verify
sudo certbot renew --dry-run
```

### Certificate Path
```
/etc/letsencrypt/live/yourdomain.com/
├── cert.pem          # Certificate
├── chain.pem         # Chain
├── fullchain.pem     # Full chain
└── privkey.pem       # Private key
```

---

## 3. Application Server Setup

### Production Start Script

Create `start-production.sh`:

```bash
#!/bin/bash

# Load environment
export NODE_ENV=production
export PORT=3000

# MongoDB Atlas URI from .env
source .env

# Install dependencies
npm install --production

# Run migrations (if any)
# npm run migrate

# Start with PM2
pm2 start src/server.js \
  --name "video-call-app" \
  --instances max \
  --exec-mode cluster \
  --max-memory-restart 500M \
  --node-args="--max-old-space-size=1024" \
  --env NODE_ENV=production \
  --env PORT=3000

# Show status
pm2 status

# Save PM2 startup
pm2 startup systemd -u www-data --hp /home/www-data
pm2 save
```

### Install PM2 (Process Manager)

```bash
npm install -g pm2

# Start app
pm2 start src/server.js --name "videocall"

# Auto-start on server reboot
pm2 startup
pm2 save

# Monitor
pm2 logs
pm2 monit
```

### Systemd Service File

`/etc/systemd/system/video-call.service`:
```ini
[Unit]
Description=Video Call Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/app/web-video-call
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

Environment="NODE_ENV=production"
Environment="PORT=3000"

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable video-call
sudo systemctl start video-call
sudo systemctl status video-call
```

---

## 4. Reverse Proxy (Nginx)

### Nginx Configuration

`/etc/nginx/sites-available/video-call`:

```nginx
upstream app {
    least_conn;  # Load balancing strategy
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern configuration (Mozilla)
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # HSTS Header (force HTTPS)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # General Settings
    client_max_body_size 50M;
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;

    # Static Files (Cache)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://app;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API Endpoints (No Cache)
    location /api/ {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # App Routes
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Disable access to admin folder from outside
    location /admin {
        proxy_pass http://app;
        allow 192.168.1.0/24;      # Internal network only
        deny all;
    }

    # Error Pages
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

### Enable Nginx Site

```bash
sudo ln -s /etc/nginx/sites-available/video-call /etc/nginx/sites-enabled/
sudo nginx -t                    # Test config
sudo systemctl restart nginx
```

---

## 5. Database Configuration

### MongoDB Atlas (Cloud - Recommended)

```bash
# Create cluster at https://www.mongodb.com/cloud/atlas
# Get connection string

MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/webrtc_app?retryWrites=true&w=majority

# Connection string parameters
?retryWrites=true         # Auto-retry on connection failure
&w=majority              # Wait for write acknowledgement from majority
&maxPoolSize=50          # Connection pool size
&serverSelectionTimeoutMS=5000
```

### MongoDB Self-hosted Replica Set

For production failover:

```bash
# Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start service
sudo systemctl start mongod
sudo systemctl enable mongod

# Initialize Replica Set
mongosh
  rs.initiate()
  rs.status()
```

---

## 6. TURN Server (For Mesh Mode)

### Coturn Setup

```bash
# Install Coturn
sudo apt-get install coturn

# Enable it
sudo nano /etc/default/coturn
# Set: TURNSERVER_ENABLED=1

# Configure
sudo nano /etc/coturn/turnserver.conf
```

**turnserver.conf** (key settings):
```
# Listening ports
listening-port=3478
listening-ip=0.0.0.0
relay-ip=<PUBLIC_IP>   # Your server's public IP

# Credentials
user=turnuser:turnpass
realm=yourdomain.com

# Performance
max-bps=1000000        # 1 Mbps per connection
bps-capacity=0         # Unlimited total
max-allocate-lifetime=600   # 10 minutes

# Logging
log-file=/var/log/coturn/turnserver.log
verbose

# Certificate (if TURNS protocol)
cert=/etc/letsencrypt/live/yourdomain.com/cert.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

**Start Coturn**:
```bash
sudo systemctl restart coturn
sudo systemctl enable coturn

# Test TURN server
turnutils_uclient -v -n 10000 -u turnuser -w turnpass -e turn.yourdomain.com
```

**Add to WebRTC config** (src/config/webrtc.js):
```javascript
const iceServersForMesh = [
  {
    urls: ['stun:stun.l.google.com:19302'],
  },
  {
    urls: ['turn:yourdomain.com:3478'],
    username: 'turnuser',
    credential: 'turnpass'
  }
];
```

---

## 7. Environment Variables (Production)

`/app/web-video-call/.env`:
```env
# ======================
# PRODUCTION SETTINGS
# ======================
NODE_ENV=production
PORT=3000

# ======================
# DATABASE
# ======================
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/webrtc_app?retryWrites=true&w=majority

# ======================
# SESSION
# ======================
SESSION_SECRET=your-very-secure-random-string-at-least-32-chars

# ======================
# WEBRTC
# ======================
WEBRTC_MODE=mesh              # or sfu (recommended for production)
ION_SFU_ENABLED=false
ION_SFU_SERVER_URL=wss://sfu.yourdomain.com/ws
SFU_SERVER_IP=xxx.xxx.xxx.xxx

# ======================
# STUN/TURN
# ======================
STUN_SERVER_URL=stun:stun.l.google.com:19302
TURN_SERVER_URL=turn:yourdomain.com:3478
TURN_USERNAME=turnuser
TURN_PASSWORD=turnpass
WEBRTC_FALLBACK_TO_MESH=true

# ======================
# SECURITY
# ======================
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

**Secure in production**:
```bash
# Don't commit .env
echo ".env" >> .gitignore

# Use proper access permissions
chmod 600 .env

# Or use Docker secrets / Kubernetes secrets
```

---

## 8. Monitoring & Logging

### Application Logging

Use structured logging:

```javascript
// src/utils/logger.js
const logger = {
  info: (msg, data) => {
    console.log(`[INFO] ${new Date().toISOString()} ${msg}`, data);
  },
  error: (msg, error) => {
    console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, error);
  },
  warn: (msg, data) => {
    console.warn(`[WARN] ${new Date().toISOString()} ${msg}`, data);
  }
};

module.exports = logger;
```

### Monitoring Tools

```bash
# PM2 Dashboard (Web)
pm2 web                        # Access http://localhost:9615

# System Monitoring
sudo apt-get install htop
htop                           # Monitor CPU/Memory

# Nginx Monitoring
curl http://localhost/nginx_status

# MongoDB Monitoring
mongosh admin
  db.serverStatus()
```

### Error Tracking (Optional)

```
npm install sentry/node

import * as Sentry from "@sentry/node";

Sentry.init({ dsn: "https://xxxxx@sentry.io/xxxxx" });
```

---

## 9. Backup Strategy

### MongoDB Backup

```bash
# Manual backup
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/" \
  --archive=backup-$(date +%Y%m%d).archive

# Restore
mongorestore --archive=backup-20250317.archive

# Automated daily backup (cron)
0 2 * * * /usr/local/bin/backup-mongo.sh
```

**backup-mongo.sh**:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/mongodb

mkdir -p $BACKUP_DIR

mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/" \
  --archive=$BACKUP_DIR/backup_$DATE.archive

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.archive" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/backup_$DATE.archive s3://my-backups/
```

---

## 10. Performance Optimization

### Code Level

```javascript
// Compress responses
app.use(compression());

// helmet untuk security headers
const helmet = require('helmet');
app.use(helmet());

// rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api', limiter);
```

### CDN for Static Assets

```nginx
# Nginx: Serve static from CDN
location ~* \.(js|css|png|jpg|jpeg|gif)$ {
  # This can be a CloudFlare CDN URL
  rewrite ^/(.*)$ https://cdn.yourdomain.com/$1 permanent;
}
```

---

## 11. Load Testing

### Apache JMeter

```bash
# Install
sudo apt-get install jmeter

# Create test plan
# 1. Thread Group: 100 concurrent users
# 2. HTTP Request: /api/rooms
# 3. Response Time assertion
# 4. View Results Tree

# Run
jmeter -n -t test-plan.jmx -l results.csv
```

### Expected Load

```
Single Server Capacity
  - Concurrent users: ~500-1000
  - Concurrent calls: ~50-100
  - CPU usage: < 70%
  - Memory: < 80%
  - Bandwidth: < 80%

With Load Balancer (3 servers)
  - Concurrent users: ~1500-3000
  - Concurrent calls: ~150-300
```

---

## 12. Disaster Recovery

### Failover Strategy

```
Production Setup:
├── Primary App Server (Active)
├── Secondary App Server (Standby)
├── Load Balancer (Health Check)
└── Database Replica Set (Auto-failover)
```

### Health Check Endpoints

```javascript
// src/routes/health.js
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    services: {
      database: await checkDB(),
      socket: require('socket.io').status || 'ok'
    }
  };
  
  res.json(health);
});
```

### Nginx Health Check

```nginx
upstream app {
  server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
  server 127.0.0.1:3001 max_fails=3 fail_timeout=10s;
}
```

---

## 13. Security Checklist

- [ ] HTTPS/TLS enabled
- [ ] HSTS headers set
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] SQL injection protection (Mongoose prevents)
- [ ] CSRF tokens on forms
- [ ] Password hashing (bcryptjs)
- [ ] Session secrets strong (>32 chars)
- [ ] Environment variables secured
- [ ] Dependencies updated regularly
- [ ] Firewall rules configured
- [ ] DDoS protection (Cloudflare, AWS Shield)
- [ ] Regular security audits

---

## 14. Rollback Plan

```bash
# Keep previous version running
pm2 start src/server-backup.js --name "videocall-backup"

# If deploy fails
pm2 restart videocall-backup

# Keep database backups
# Restore if needed:
mongorestore --archive=backup-20250316.archive
```

---

## 15. Monitoring Dashboard

Recommended tools:
- **PM2 Plus** - Node.js monitoring
- **Grafana** - Metrics visualization
- **DataDog** - Full observability
- **New Relic** - APM monitoring
- **CloudFlare Analytics** - Web analytics

---

## Quick Deployment Checklist

```bash
# 1. SSH to server
ssh user@server-ip

# 2. Clone app
git clone https://github.com/yourrepo/web-video-call.git /app
cd /app

# 3. Setup environment
cp .env.example .env
# Edit .env with production values

# 4. Install & build
npm install --production
npm run build        # If applicable

# 5. Start with PM2
pm2 start src/server.js --name videocall
pm2 save

# 6. Setup reverse proxy
sudo cp nginx.conf /etc/nginx/sites-available/videocall
sudo ln -s /etc/nginx/sites-available/videocall /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 7. Verify
curl https://yourdomain.com/health
pm2 logs
```

---

## Troubleshooting Production

### App not starting
```bash
# Check logs
pm2 logs videocall

# Check port
netstat -tlnp | grep 3000

# Check DB
mongosh "<MONGODB_URI>"
```

### High memory usage
```bash
# Check memory
pm2 monit

# Restart with memory limit
pm2 restart videocall --max-memory-restart 500M
```

### Socket.IO connection issues
```bash
# Check WebSocket
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://yourdomain.com/socket.io/
```

---

## 📚 Additional Resources

- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [MongoDB Deployment](https://docs.mongodb.com/manual/administration/deploy-sharded-cluster/)

---

## ✅ After Deployment

- [ ] Run smoke tests
- [ ] Monitor logs for errors
- [ ] Test video call from multiple devices
- [ ] Verify SSL certificate
- [ ] Check CORS headers
- [ ] Test admin features
- [ ] Monitor database performance
- [ ] Verify backups working
- [ ] Document any custom configurations
- [ ] Setup alerts for critical errors

---

**Last Updated**: March 17, 2025
**Version**: 1.0.0
