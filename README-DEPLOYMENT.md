# LAMA Browser - Quick Deployment Guide

## ✅ Build Complete

Your application has been successfully built and is ready for deployment!

**Build location:** `browser-ui/dist/`
**Preview running at:** http://localhost:4173/

---

## 🚀 Quick Deploy Options

### Option 1: Local Preview (Current)

Preview server is **already running**:
```bash
# Access at:
http://localhost:4173/

# To restart preview:
npm run preview
```

### Option 2: Deploy to Web Server

#### Automated Deployment (Recommended)

```bash
# Edit the script to set your server details
nano deploy.sh

# Then run:
./deploy.sh user@yourserver.com /var/www/lama.one
```

#### Manual Deployment

```bash
# 1. Build
npm run build

# 2. Copy to server
scp -r browser-ui/dist/* user@yourserver.com:/var/www/lama.one/

# 3. Set permissions
ssh user@yourserver.com
sudo chown -R www-data:www-data /var/www/lama.one
sudo chmod -R 755 /var/www/lama.one
```

---

## 📋 Complete Documentation

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for:
- ✅ Nginx configuration
- ✅ Apache configuration
- ✅ SSL/TLS setup (Let's Encrypt)
- ✅ Security headers
- ✅ CORS configuration
- ✅ Performance optimization
- ✅ Troubleshooting guide

---

## 🔧 What's Included in This Build

### NEW Features ✨
- **Worker-specific SettingsStore** - Proper ONE.core storage abstraction
- **IndexedDB-backed settings** - Platform-correct storage for Web Workers
- **Fixed branding** - Updated from "edda" to "lama.one"
- **Proper platform injection** - Uses ONE.core's `setPlatformForSs()`

### Architecture
```
UI Thread (SettingsView)
  ↓ workerClient.send('storage:setItem')
Web Worker
  ↓ ONE.core SettingsStore
  ↓ WorkerSettingsStore (injected)
IndexedDB (persistent storage)
```

---

## ✅ Deployment Checklist

Before deploying to production:

- [x] Build completed successfully
- [x] Local preview tested
- [ ] Configure web server (nginx/apache)
- [ ] Set up SSL/TLS certificates
- [ ] Configure DNS records
- [ ] Test production deployment
- [ ] Verify Web Worker loads
- [ ] Check browser console for errors
- [ ] Test SettingsStore functionality

---

## 🐛 Known Issues

**WebSocket connection to commserver.refinio.net fails:**
- This is expected - external infrastructure
- App works offline, WebSocket is for P2P connections
- Configure your own commserver or use relay server

---

## 📞 Quick Help

**Preview won't start?**
```bash
npm run build
npm run preview
```

**Build fails?**
```bash
cd browser-ui
npm install
cd ..
npm run build
```

**Deploy script fails?**
- Check SSH access: `ssh user@yourserver.com`
- Check server path exists
- Verify permissions

---

## 🎯 Next Steps

1. **Test the preview:** http://localhost:4173/
2. **Read full deployment guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
3. **Configure your web server**
4. **Run deployment script:** `./deploy.sh`

---

**Questions?** Check `DEPLOYMENT.md` for detailed documentation.
