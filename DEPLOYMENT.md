# LAMA Browser Deployment Guide

## Option 1: Local Preview (Development/Testing)

**Current Status:** ✅ Running at http://localhost:4173/

The preview server is currently running with the production build.

```bash
# Start preview server
npm run preview

# Build and preview
npm run build && npm run preview
```

---

## Option 3: Deploy to Web Server (Production)

### Build Output Location
```
/Users/gecko/src/lama/lama.browser/browser-ui/dist/
```

### Build Contents
- `index.html` - Entry point
- `assets/` - JavaScript bundles, CSS, and source maps
- `lama-icon.png` - Application icon

### Deployment Steps

#### 1. Build for Production
```bash
cd /Users/gecko/src/lama/lama.browser
npm run build
```

#### 2. Copy to Web Server
```bash
# Copy entire dist folder to your web server
rsync -avz browser-ui/dist/ user@yourserver.com:/var/www/lama.one/

# Or use SCP
scp -r browser-ui/dist/* user@yourserver.com:/var/www/lama.one/

# Or create a tarball for transfer
cd browser-ui
tar -czf lama-browser-dist.tar.gz dist/
```

---

## Web Server Configuration

### Nginx Configuration

Create `/etc/nginx/sites-available/lama.one`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name lama.one www.lama.one;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name lama.one www.lama.one;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/lama.one/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lama.one/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Document root
    root /var/www/lama.one;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # CORS headers (if needed for API access)
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Web Worker with correct MIME type
    location ~ \.worker\.js$ {
        add_header Content-Type "application/javascript";
        add_header Cache-Control "no-cache";
    }

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/lama.one /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### Apache Configuration

Create `/etc/apache2/sites-available/lama.one.conf`:

```apache
<VirtualHost *:80>
    ServerName lama.one
    ServerAlias www.lama.one

    # Redirect HTTP to HTTPS
    Redirect permanent / https://lama.one/
</VirtualHost>

<VirtualHost *:443>
    ServerName lama.one
    ServerAlias www.lama.one

    DocumentRoot /var/www/lama.one

    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/lama.one/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/lama.one/privkey.pem

    # Security headers
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"

    # CORS headers (if needed)
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"

    # Compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/javascript application/json
    </IfModule>

    # Cache static assets
    <Directory /var/www/lama.one/assets>
        Header set Cache-Control "public, max-age=31536000, immutable"
    </Directory>

    # SPA routing
    <Directory /var/www/lama.one>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # Rewrite rules for SPA
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Deny access to hidden files
    <DirectoryMatch "^\.|\/\.">
        Require all denied
    </DirectoryMatch>
</VirtualHost>
```

Enable the site:
```bash
sudo a2ensite lama.one
sudo a2enmod ssl rewrite headers deflate
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

## SSL/TLS Setup (Let's Encrypt)

### Install Certbot
```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# For Apache
sudo apt install certbot python3-certbot-apache
```

### Obtain SSL Certificate
```bash
# For Nginx
sudo certbot --nginx -d lama.one -d www.lama.one

# For Apache
sudo certbot --apache -d lama.one -d www.lama.one
```

### Auto-renewal
```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Certbot auto-renewal is set up via systemd timer
sudo systemctl status certbot.timer
```

---

## Deployment Script

Create `deploy.sh` in `/Users/gecko/src/lama/lama.browser/`:

```bash
#!/bin/bash
set -e

# Configuration
REMOTE_HOST="user@yourserver.com"
REMOTE_PATH="/var/www/lama.one"
BUILD_DIR="browser-ui/dist"

echo "🔨 Building LAMA Browser..."
npm run build

echo "📦 Creating deployment package..."
cd browser-ui
tar -czf ../lama-browser-dist.tar.gz dist/
cd ..

echo "🚀 Deploying to $REMOTE_HOST:$REMOTE_PATH..."
scp lama-browser-dist.tar.gz $REMOTE_HOST:/tmp/

echo "📂 Extracting on remote server..."
ssh $REMOTE_HOST << 'EOF'
    cd /tmp
    sudo rm -rf /var/www/lama.one.backup
    sudo mv /var/www/lama.one /var/www/lama.one.backup 2>/dev/null || true
    sudo mkdir -p /var/www/lama.one
    sudo tar -xzf lama-browser-dist.tar.gz -C /var/www/lama.one --strip-components=1
    sudo chown -R www-data:www-data /var/www/lama.one
    sudo chmod -R 755 /var/www/lama.one
    rm /tmp/lama-browser-dist.tar.gz
EOF

echo "✅ Deployment complete!"
echo "🌐 Visit https://lama.one"

# Cleanup local tarball
rm lama-browser-dist.tar.gz
```

Make it executable:
```bash
chmod +x deploy.sh
```

---

## Quick Deployment Checklist

- [ ] Build production bundle: `npm run build`
- [ ] Verify build output in `browser-ui/dist/`
- [ ] Copy files to web server
- [ ] Configure web server (nginx/apache)
- [ ] Set up SSL/TLS certificates
- [ ] Configure DNS records (A/AAAA records pointing to your server)
- [ ] Test HTTPS access
- [ ] Verify Web Worker loads correctly
- [ ] Check browser console for errors
- [ ] Test ONE.core initialization
- [ ] Verify SettingsStore functionality

---

## Monitoring & Troubleshooting

### Check Web Server Logs
```bash
# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Apache
sudo tail -f /var/log/apache2/access.log
sudo tail -f /var/log/apache2/error.log
```

### Browser Console Checks
1. Open Developer Tools (F12)
2. Check Console for errors
3. Check Network tab for failed requests
4. Verify Web Worker loads: `[Worker] ONE.core browser platform loaded`
5. Verify SettingsStore injection: `[Worker] Injected worker-specific SettingsStore`

### Common Issues

**Issue: Web Worker fails to load**
- Check MIME type is `application/javascript`
- Verify CORS headers are set correctly
- Check browser console for detailed error

**Issue: Routing not working (404 on refresh)**
- Ensure SPA routing is configured in nginx/apache
- Verify `try_files` or `RewriteRule` directives

**Issue: Assets not loading**
- Check file permissions: `chmod -R 755 /var/www/lama.one`
- Verify ownership: `chown -R www-data:www-data /var/www/lama.one`
- Check paths in browser DevTools Network tab

---

## Performance Optimization

### Enable HTTP/2
Already configured in the nginx example above.

### Enable Brotli Compression (Optional)
```bash
# Install nginx brotli module
sudo apt install libnginx-mod-http-brotli

# Add to nginx config
brotli on;
brotli_types text/plain text/css text/xml text/javascript application/javascript application/json;
```

### CDN Setup (Optional)
Consider using Cloudflare for:
- DDoS protection
- Global CDN
- Free SSL
- Caching static assets

---

## Rollback Procedure

If deployment fails:
```bash
ssh user@yourserver.com
sudo rm -rf /var/www/lama.one
sudo mv /var/www/lama.one.backup /var/www/lama.one
sudo systemctl reload nginx  # or apache2
```
