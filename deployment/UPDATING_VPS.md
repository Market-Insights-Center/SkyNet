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

## 3. Initial Setup / Hard Restart
Use this if the process is missing or broken.

```bash
# 1. Go to backend directory (CRITICAL: uvicorn needs to find main.py here)
cd /var/www/marketinsights/backend

# 2. Delete old process if exists
pm2 delete mic-backend

# 3. Start new process with correct path
pm2 start "./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000" --name mic-backend
pm2 save
```

---

## 4. Troubleshooting & Status

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

 ### [Errno 98] Address already in use
If logs show this error, it means another process (like the systemd service) is holding onto port 8000.

**Fix:**
```bash
# 1. Stop conflicting services
systemctl stop mic-backend
systemctl disable mic-backend

# 2. Kill port 8000
fuser -k -9 8000/tcp

# 3. Restart PM2
pm2 restart mic-backend
```
