# Updating SkyNet on VPS

## 1. Quick Update (Standard)
Run this when you've made code changes.

```bash
# 1. Pull changes
cd /var/www/marketinsights
git pull

# 2. Rebuild Frontend (If changes were made to src/)
npm run build

# 3. Restart Backend (If changes were made to backend/)
pm2 restart mic-backend
```

---

## 2. Detailed Update (Dependencies Changed)
Run this if you added new packages to `requirements.txt` or `package.json`.

```bash
cd /var/www/marketinsights
git pull

# Frontend Dependencies
npm install
npm run build

# Backend Dependencies
cd backend
source venv/bin/activate
pip install -r requirements.txt
pm2 restart mic-backend
```

---

## 3. Troubleshooting & Status

### Check if Backend is Running
```bash
pm2 status
```
*Look for 'online' status for mic-backend.*

### View Real-time Application Logs
```bash
pm2 logs mic-backend
```
*Shows Python print statements and errors. Press `Ctrl+C` to exit.*

### Check Web Server (Nginx)
```bash
systemctl status nginx
```
*If failed, check errors:*
```bash
journalctl -xeu nginx
# or
tail -n 20 /var/log/nginx/error.log
```

### [Errno 98] Address already in use
If logs show this error, it means another process (like the systemd service) is holding onto port 8000.

**Fix:**
```bash
# 1. Stop the conflicting systemd service (if running)
systemctl stop mic-backend
systemctl disable mic-backend

# 2. Kill any lingering process on port 8000
fuser -k 8000/tcp

# 3. Restart PM2
pm2 restart mic-backend
```
