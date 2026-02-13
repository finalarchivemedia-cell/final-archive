# Final Archive - Complete Deployment Guide (Client ke liye)

Ye guide aapko Final Archive project ko apne laptop par deploy karne me complete help karega. Isme sab kuch step-by-step detail me hai.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Prerequisites (Pehle se chahiye)](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Environment Variables Setup](#environment-variables-setup)
5. [Database Setup](#database-setup)
6. [iCloud to R2 Auto Sync Setup](#icloud-to-r2-auto-sync-setup)
7. [Running the Application](#running-the-application)
8. [Common Errors aur Solutions](#common-errors-aur-solutions)
9. [Client Requirements](#client-requirements)
10. [Work Completed Summary](#work-completed-summary)

---

## 🎯 Project Overview

**Final Archive** ek professional image gallery website hai jo:
- Automatic image upload support karta hai (iCloud se R2 bucket me)
- 5-digit unique IDs use karta hai (00000-99999)
- Real-time sync karta hai images ko
- Admin panel provide karta hai settings manage karne ke liye
- Contact form hai visitors ke liye
- Modern, elegant logo animation hai
- Mobile aur Web dono par perfectly responsive hai

---

## 📋 Prerequisites (Pehle se chahiye)

Aapke laptop me ye cheezein pehle se installed honi chahiye:

### 1. **Node.js** (Version 20 ya higher)
   - Check karne ke liye: Terminal me `node --version` run karo
   - Agar nahi hai, to download karo: https://nodejs.org/
   - Minimum version: **v20.0.0**

### 2. **PostgreSQL Database**
   - Local PostgreSQL install karo, ya
   - Online database service use karo (Neon, Supabase, Railway)
   - Database connection string chahiye hoga

### 3. **Git** (Code download karne ke liye)
   - Check karne ke liye: `git --version`
   - Agar nahi hai, to install karo: https://git-scm.com/

### 4. **Homebrew** (Mac ke liye - rclone install karne ke liye)
   - Check karne ke liye: `brew --version`
   - Agar nahi hai, to install karo: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

### 5. **Cloudflare Account** (R2 bucket ke liye)
   - R2 bucket already create hona chahiye
   - Access Key ID aur Secret Access Key chahiye hoga

---

## 🚀 Initial Setup

### Step 1: Project Download/Clone

Terminal open karo aur ye commands run karo:

```bash
# GitHub se project clone karo
git clone https://github.com/finalarchivemedia-cell/final-archive.git

# Project folder me jao
cd final-archive
```

**Note:** Agar aapko project already mil gaya hai (USB, email, etc.), to bas folder me jao.

### Step 2: Dependencies Install

```bash
# Sab dependencies install karo
npm install
```

**Expected Output:** 
- Kuch minutes lagenge
- Agar koi error aaye, to section [Common Errors](#common-errors-aur-solutions) check karo

### Step 3: Verify Installation

```bash
# Check karo sab theek hai
npm run build:backend
```

Agar build successful ho, to ✅ sab theek hai!

---

## ⚙️ Environment Variables Setup

Ye sabse important step hai. Environment variables aapke project ki configuration store karte hain.

### Step 1: .env File Create Karo

Project root folder me `.env` naam ki file create karo (dot se start hoti hai).

**Mac/Linux:**
```bash
touch .env
```

**Windows:**
- Notepad me new file banao
- Save as: `.env` (quotes me)
- File type: "All Files"

### Step 2: Environment Variables Add Karo

`.env` file me ye sab variables add karo (aapke actual values ke saath):

```env
# ============================================
# DATABASE CONFIGURATION
# ============================================
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://username:password@host:port/database?sslmode=require"

# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=3000

# ============================================
# SECURITY (IMPORTANT - Apne strong values use karo)
# ============================================
ADMIN_PASSWORD="your-strong-admin-password-here"
JWT_SECRET="your-random-jwt-secret-key-minimum-32-characters"
WEBHOOK_SECRET="your-random-webhook-secret-key-minimum-32-characters"

# ============================================
# CORS (Frontend domains allow karne ke liye)
# ============================================
CORS_ORIGINS="https://finalarchivemedia.com,https://www.finalarchivemedia.com"

# ============================================
# R2 STORAGE CONFIGURATION
# ============================================
ENABLE_R2_SYNC=true
R2_ENDPOINT="https://6221f575405c4ced9ac6e1e6cfb0c650.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="81d0dacd985a75ee1ae53afe2c510e4f"
R2_SECRET_ACCESS_KEY="18086828233cd503ecf2369ae23230f7128e6b9ede43f398cedc89d971d56487"
R2_BUCKET="final-archive"
R2_PREFIX=""
CDN_BASE_URL="https://pub-6221f575405c4ced9ac6e1e6cfb0c650.r2.dev"

# ============================================
# EMAIL CONFIGURATION (Contact Form ke liye)
# ============================================
RESEND_API_KEY="your-resend-api-key-here"
CONTACT_TO="Contact@FinalArchiveMedia.com"
CONTACT_FROM="noreply@yourdomain.com"

# ============================================
# FRONTEND API URL (Optional)
# ============================================
VITE_API_BASE_URL="https://your-backend-url.com"
```

### Step 3: Important Notes

⚠️ **Security Warnings:**
- `ADMIN_PASSWORD`: Strong password use karo (minimum 12 characters)
- `JWT_SECRET`: Random string use karo (minimum 32 characters)
- `WEBHOOK_SECRET`: Random string use karo (minimum 32 characters)
- `.env` file ko **kabhi bhi GitHub par commit mat karo!**

**Random Secret Generate karne ke liye:**
```bash
# Terminal me ye command run karo
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🗄️ Database Setup

### Step 1: Database Create Karo

Agar aap local PostgreSQL use kar rahe hain:

```bash
# PostgreSQL me login karo
psql -U postgres

# Database create karo
CREATE DATABASE final_archive;

# Exit karo
\q
```

**Ya online service use karo:**
- **Neon** (https://neon.tech) - Free tier available
- **Supabase** (https://supabase.com) - Free tier available
- **Railway** (https://railway.app) - Free tier available

### Step 2: Database Connection String

`.env` file me `DATABASE_URL` update karo:

**Format:**
```
postgresql://username:password@host:port/database?sslmode=require
```

**Example (Neon):**
```
postgresql://user:pass@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require
```

### Step 3: Database Tables Create Karo

```bash
# Prisma se database schema push karo
npx prisma db push
```

**Expected Output:**
```
✔ Generated Prisma Client
✔ Database synchronized successfully
```

### Step 4: Verify Database

```bash
# Prisma Studio open karo (optional - GUI tool)
npx prisma studio
```

Browser me automatically open hoga database viewer.

---

## ☁️ iCloud to R2 Auto Sync Setup

Ye setup aapko iCloud folder me images drop karne aur automatically R2 bucket me upload karne me help karega.

### Step 1: rclone Install Karo

```bash
# Homebrew se install (Mac)
brew install rclone

# Verify installation
rclone version
```

### Step 2: rclone Configure Karo

```bash
# rclone configuration start karo
rclone config
```

**Interactive prompts me ye values enter karo:**

1. **`n`** (New remote)
2. **Name**: `r2` (ya koi bhi naam)
3. **Storage**: `5` (S3 compatible storage)
4. **Provider**: `4` (Cloudflare)
5. **Access Key ID**: `81d0dacd985a75ee1ae53afe2c510e4f`
6. **Secret Access Key**: `18086828233cd503ecf2369ae23230f7128e6b9ede43f398cedc89d971d56487`
7. **Region**: `auto`
8. **Endpoint**: `https://6221f575405c4ced9ac6e1e6cfb0c650.r2.cloudflarestorage.com`
9. **ACL**: `private` (ya `public-read`)
10. **`y`** (save configuration)

### Step 3: Connection Test Karo

```bash
# R2 bucket list karo
rclone lsd r2:final-archive
```

Agar bucket list dikhe, to ✅ connection theek hai!

### Step 4: iCloud Folder Create Karo

1. **Finder** open karo
2. **iCloud Drive** me jao
3. **New Folder** create karo: `FinalArchive`
4. Is folder me images drop karo

**Full Path:**
```
~/Library/Mobile Documents/com~apple~CloudDocs/FinalArchive
```

### Step 5: Sync Script Update Karo

`scripts/sync_icloud_to_r2.sh` file me check karo:

```bash
# File edit karo
nano scripts/sync_icloud_to_r2.sh
```

**Verify ye values:**
```bash
ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/FinalArchive"
R2_BUCKET="final-archive"
R2_REMOTE="r2"
```

### Step 6: Manual Test Sync

```bash
# Script ko executable banao
chmod +x scripts/sync_icloud_to_r2.sh

# Manual sync test karo
./scripts/sync_icloud_to_r2.sh
```

**Expected Output:**
```
🔄 Starting iCloud → R2 Sync...
   From: /Users/yourname/Library/Mobile Documents/com~apple~CloudDocs/FinalArchive
   To:   r2:final-archive

✅ Sync complete!
```

### Step 7: Automatic Scheduling Setup (macOS)

Har 5 minutes me automatic sync ke liye:

#### 7.1: plist File Update Karo

`scripts/com.finalarchive.icloudsync.plist` file me apna exact path update karo:

```xml
<string>/Users/YOUR_USERNAME/Documents/final-archive/scripts/sync_icloud_to_r2.sh</string>
```

**YOUR_USERNAME** ko apne actual username se replace karo.

#### 7.2: Launch Agent Install Karo

```bash
# plist file ko LaunchAgents me copy karo
cp "scripts/com.finalarchive.icloudsync.plist" ~/Library/LaunchAgents/

# Service load karo
launchctl load ~/Library/LaunchAgents/com.finalarchive.icloudsync.plist

# Immediately start karo
launchctl start com.finalarchive.icloudsync
```

#### 7.3: Service Status Check Karo

```bash
# Service status check karo
launchctl list | grep finalarchive

# Logs check karo
tail -f /tmp/finalarchive_sync.log
```

### Step 8: Verify Auto Sync

1. **iCloud folder me test image drop karo**
2. **5 minutes wait karo** (ya manually sync trigger karo)
3. **R2 bucket check karo**: Cloudflare Dashboard → R2 → final-archive
4. **Backend API check karo**: 
   ```bash
   curl http://localhost:3000/api/images
   ```

---

## 🏃 Running the Application

### Development Mode (Testing ke liye)

```bash
# Backend server start karo
npm run dev:backend
```

**Expected Output:**
```
Server running on http://localhost:3000
```

### Production Mode (Live use ke liye)

```bash
# Build karo
npm run build

# Start karo
npm start
```

### Frontend Development (Agar frontend bhi run karna hai)

```bash
# Backend + Frontend dono start karo
npm run dev:all
```

Frontend: `http://localhost:5173` (Vite default port)
Backend: `http://localhost:3000`

---

## ❌ Common Errors aur Solutions

### Error 1: "Cannot find module"

**Problem:** Dependencies install nahi hui

**Solution:**
```bash
# node_modules delete karo
rm -rf node_modules package-lock.json

# Fresh install karo
npm install
```

### Error 2: "DATABASE_URL is required"

**Problem:** `.env` file me `DATABASE_URL` missing hai

**Solution:**
- `.env` file check karo
- `DATABASE_URL` add karo (format: `postgresql://...`)

### Error 3: "Prisma Client not generated"

**Problem:** Prisma client generate nahi hua

**Solution:**
```bash
# Prisma client generate karo
npx prisma generate

# Database push karo
npx prisma db push
```

### Error 4: "Connection refused" (Database)

**Problem:** Database connection string galat hai ya database server off hai

**Solution:**
- Database connection string verify karo
- Database server check karo (online service me dashboard check karo)
- SSL mode check karo (`?sslmode=require`)

### Error 5: "rclone: command not found"

**Problem:** rclone install nahi hua

**Solution:**
```bash
# Homebrew se install karo
brew install rclone

# Verify
rclone version
```

### Error 6: "iCloud folder not found"

**Problem:** iCloud folder path galat hai

**Solution:**
- Finder me iCloud Drive check karo
- Folder name verify karo: `FinalArchive`
- Full path check karo: `~/Library/Mobile Documents/com~apple~CloudDocs/FinalArchive`

### Error 7: "R2 sync failed"

**Problem:** R2 credentials galat hain

**Solution:**
- `rclone config` se connection test karo
- Cloudflare Dashboard me R2 credentials verify karo
- `.env` file me R2 variables check karo

### Error 8: "Port 3000 already in use"

**Problem:** Port already use ho raha hai

**Solution:**
```bash
# Port change karo .env file me
PORT=3001

# Ya running process kill karo
lsof -ti:3000 | xargs kill -9
```

### Error 9: "JWT_SECRET too short"

**Problem:** JWT_SECRET minimum 32 characters chahiye

**Solution:**
```bash
# Random secret generate karo
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output ko .env file me JWT_SECRET me paste karo
```

### Error 10: "CORS error" (Frontend se API call)

**Problem:** CORS_ORIGINS me frontend domain missing hai

**Solution:**
- `.env` file me `CORS_ORIGINS` update karo
- Format: `"https://domain1.com,https://domain2.com"`

---

## 📝 Client Requirements

Ye sab requirements client ne specify ki thi:

### 1. **Logo Display**
   - ✅ Logo mobile aur web dono par perfectly centered
   - ✅ Logo animation timing properly set
   - ✅ Responsive design (mobile aur desktop dono)

### 2. **Image Management**
   - ✅ Automatic image upload (iCloud se R2 bucket)
   - ✅ 5-digit unique IDs (00000-99999)
   - ✅ Real-time sync (har 60 seconds me)
   - ✅ Webhook support (instant sync)

### 3. **Admin Panel**
   - ✅ Secure login (JWT authentication)
   - ✅ Settings management (crop, duration)
   - ✅ Manual sync trigger
   - ✅ Image deactivation

### 4. **Performance**
   - ✅ Fast API responses (caching enabled)
   - ✅ CDN integration
   - ✅ Optimized image loading

### 5. **User Experience**
   - ✅ Elegant logo animation
   - ✅ Smooth transitions
   - ✅ Contact form
   - ✅ Mobile-friendly design
   - ✅ Strict intro sequence (8s total, no overlap)
   - ✅ Hover enable only after first image cycle
   - ✅ Direct 5-digit route lock (single image mode)
   - ✅ Video handling (metadata preload + muted autoplay)

---

## ✅ Work Completed Summary

### 1. **Backend Development**
   - ✅ Fastify-based REST API
   - ✅ PostgreSQL database integration (Prisma ORM)
   - ✅ Cloudflare R2 storage integration
   - ✅ Automatic image sync (scheduler + webhook)
   - ✅ Admin authentication (JWT)
   - ✅ Contact form email support (Resend)
   - ✅ CORS configuration
   - ✅ Rate limiting
   - ✅ API caching

### 2. **Frontend Development**
   - ✅ React + TypeScript
   - ✅ GSAP animations (logo overlay)
   - ✅ Image gallery with transitions
   - ✅ Admin panel
   - ✅ Contact modal
   - ✅ Responsive design (mobile + web)
   - ✅ SPA routing (React Router)
   - ✅ Strict intro timeline (no overlap, 8s total)
   - ✅ Hover gating after first cycle
   - ✅ Alternating zoom motion
   - ✅ Single-ID route lock (/12345)
   - ✅ Video safe preload (metadata only)

### 3. **Logo Animation Fixes**
   - ✅ Logo alignment fixed (mobile + web)
   - ✅ Animation timing optimized
   - ✅ Centering improved
   - ✅ Responsive sizing

### 4. **iCloud Auto Sync**
   - ✅ rclone configuration
   - ✅ Sync script development
   - ✅ macOS launchd scheduling
   - ✅ Automatic upload (har 5 minutes)

### 5. **Database Schema**
   - ✅ Image model (5-digit IDs)
   - ✅ Settings model
   - ✅ Media type support (IMAGE/VIDEO)
   - ✅ Soft delete (isActive flag)

### 6. **Deployment Configuration**
   - ✅ Environment variables setup
   - ✅ Docker support (Dockerfile)
   - ✅ Production build scripts
   - ✅ Error handling

### 7. **Documentation**
   - ✅ README.md (technical)
   - ✅ ICLOUD_SYNC_SETUP.md (iCloud guide)
   - ✅ CLIENT_DEPLOYMENT_GUIDE.md (ye file)

---

## 🔄 Workflow Summary

### Complete Image Upload Flow:

1. **User drops image** → iCloud Drive/FinalArchive folder me
2. **iCloud syncs** → Mac par local folder update
3. **rclone script runs** → Har 5 minutes me (automatic)
4. **Image uploads** → Cloudflare R2 bucket me
5. **Backend syncs** → Har 60 seconds me (automatic) ya webhook se (instant)
6. **Image appears** → Website par automatically! 🎉

### Admin Workflow:

1. **Login** → `/admin` par jao, password enter karo
2. **Settings** → Crop aur duration adjust karo
3. **Manual Sync** → Agar zarurat ho, to manual sync trigger karo
4. **Image Management** → Images deactivate kar sakte hain

---

## 🎛️ Admin Panel se Content Update Kaise Karein

### Admin Panel Access Karne ka Tarika

#### Step 1: Admin Panel Open Karo

**Local Development:**
```
http://localhost:5173/admin
```

**Production (Live Website):**
```
https://finalarchivemedia.com/admin
```

**Ya URL me `?admin=1` add karo:**
```
https://finalarchivemedia.com/?admin=1
```
Phir footer me "Admin" link dikhega.

#### Step 2: Login Karo

1. Admin panel open hote hi **password screen** dikhega
2. Apna **admin password** enter karo (`.env` file me `ADMIN_PASSWORD` me jo value hai)
3. **"Login"** button click karo
4. Agar password sahi hai, to settings screen dikhega ✅

**Note:** Password `.env` file me set kiya hota hai. Agar password change karna hai, to `.env` file me `ADMIN_PASSWORD` update karo.

---

### Admin Panel se Kya Kya Update Kar Sakte Hain

#### 1. **Display Duration (Image Kitne Time Tak Dikhegi)**

**Kya hai:**
- Har image kitne seconds tak screen par dikhegi
- Range: **1 second** se **10 seconds** tak

**Kaise Update Karein:**
1. Admin panel me login karo
2. **"Display Duration"** slider ko left/right move karo
3. Value real-time me update hoti rahegi (dikhega: "6s", "3s", etc.)
4. **"SAVE CHANGES"** button click karo
5. Button **"SAVED"** ho jayega (green color me)
6. Changes immediately website par apply ho jayenge! ✅

**Example:**
- **3 seconds** = Fast slideshow (images quickly change)
- **6 seconds** = Normal speed (default)
- **10 seconds** = Slow slideshow (images longer dikhengi)

#### 2. **Crop / Zoom (Image ka Zoom Level)**

**Kya hai:**
- Images ka zoom/crop level control karta hai
- Range: **25%** se **100%** tak
- Higher value = More zoom (image ka center part dikhega)
- Lower value = Less zoom (full image dikhega)

**Kaise Update Karein:**
1. Admin panel me login karo
2. **"Crop / Zoom"** slider ko left/right move karo
3. Value real-time me update hoti rahegi (dikhega: "60%", "80%", etc.)
4. **"SAVE CHANGES"** button click karo
5. Changes immediately website par apply ho jayenge! ✅

**Example:**
- **25%** = Full image dikhega (no zoom)
- **60%** = Medium zoom (default)
- **100%** = Maximum zoom (image ka center part hi dikhega)

#### 3. **Manual Sync (R2 se Images Manually Sync Karo)**

**Kya hai:**
- Agar aapne R2 bucket me images upload kiye hain lekin website par nahi dikh rahe
- To manually sync trigger kar sakte hain
- Backend automatically R2 bucket scan karega aur nayi images add karega

**Kaise Use Karein (API se):**

**Terminal me:**
```bash
# Pehle login karo aur token le lo
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-admin-password"}'

# Response me token milega, use karo:
curl -X POST http://localhost:3000/api/admin/refresh \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "ok": true,
  "message": "Sync started (background)"
}
```

**Note:** Currently UI me manual sync button nahi hai, lekin API se kar sakte hain. Agar UI me button chahiye, to feature add kar sakte hain.

#### 4. **Image Deactivate (Image Hide Karo)**

**Kya hai:**
- Kisi specific image ko website se hide kar sakte hain
- Image database me rahegi, lekin website par nahi dikhegi
- Soft delete hai (permanent delete nahi)

**Kaise Use Karein (API se):**

**Terminal me:**
```bash
# Pehle login karo aur token le lo
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-admin-password"}'

# Image deactivate karo (image ID se)
curl -X POST http://localhost:3000/api/admin/images/12345/deactivate \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "ok": true
}
```

**Note:** Ab UI me image list aur deactivate button available hai.

---

### Admin Panel Features Detail

#### ✅ Currently Available (UI me):

1. **Display Duration Slider**
   - Range: 1-10 seconds
   - Real-time preview
   - Save button se apply hota hai

2. **Crop/Zoom Slider**
   - Range: 25-100%
   - Real-time preview
   - Save button se apply hota hai

3. **Save Changes Button**
   - Settings save karta hai
   - Success message dikhata hai
   - Changes immediately apply hote hain

4. **Manual Sync Button**
   - R2 se fresh sync trigger karta hai
   - Button press karte hi background sync start ho jata hai

5. **Image List View**
   - Active images list dikhta hai
   - Thumbnail + ID + media type

6. **Image Deactivate Button**
   - Image ko website se hide karta hai
   - Confirmation prompt aata hai

7. **Logout Button**
   - Top right corner me
   - Session end karta hai

#### ⚠️ Currently Not Available (API se kar sakte hain):

1. **Image Activate (Undo Deactivate)** - Currently UI/API me activate endpoint nahi hai

---

### Admin Panel Use Karne ka Complete Example

#### Scenario: Display Duration Badhana Hai

1. **Browser open karo:**
   ```
   https://finalarchivemedia.com/admin
   ```

2. **Password enter karo:**
   - Admin password type karo
   - "Login" click karo

3. **Settings adjust karo:**
   - "Display Duration" slider ko **8 seconds** par set karo
   - "Crop / Zoom" slider ko **70%** par set karo

4. **Save karo:**
   - "SAVE CHANGES" button click karo
   - Button **"SAVED"** (green) ho jayega
   - Changes immediately website par apply ho jayenge

5. **Verify karo:**
   - Main website par jao
   - Images ab 8 seconds tak dikhengi
   - Zoom level 70% hoga

---

### Admin Panel Troubleshooting

#### Problem: "Invalid password" Error

**Solution:**
- `.env` file me `ADMIN_PASSWORD` check karo
- Password exactly same hona chahiye (case-sensitive)
- Agar password change kiya hai, to server restart karo

#### Problem: Login ke baad settings nahi dikh rahe

**Solution:**
- Browser console check karo (F12)
- Network tab me API calls check karo
- Backend server running hai ya nahi verify karo

#### Problem: Changes save nahi ho rahe

**Solution:**
- "SAVE CHANGES" button click kiya hai ya nahi check karo
- Backend server logs check karo
- Database connection verify karo

#### Problem: Changes apply nahi ho rahe website par

**Solution:**
- Browser cache clear karo (Ctrl+Shift+R / Cmd+Shift+R)
- Settings API check karo: `curl http://localhost:3000/api/settings`
- Backend server restart karo

---

### Advanced: API se Direct Update (Terminal se)

Agar aap terminal se directly update karna chahte hain:

#### Step 1: Login aur Token Le Lo

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}' | jq -r '.token')

echo "Token: $TOKEN"
```

#### Step 2: Settings Update Karo

```bash
curl -X PUT http://localhost:3000/api/admin/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayDurationSec": 8,
    "cropPercent": 70
  }'
```

#### Step 3: Manual Sync Trigger Karo

```bash
curl -X POST http://localhost:3000/api/admin/refresh \
  -H "Authorization: Bearer $TOKEN"
```

#### Step 4: Image Deactivate Karo

```bash
curl -X POST http://localhost:3000/api/admin/images/12345/deactivate \
  -H "Authorization: Bearer $TOKEN"
```

---

### Summary: Admin Panel se Kya Kya Ho Sakta Hai

| Feature | UI me Available? | API se Available? | Kaise Use Karein |
|---------|------------------|-------------------|------------------|
| Display Duration | ✅ Yes | ✅ Yes | Slider se adjust karo |
| Crop/Zoom | ✅ Yes | ✅ Yes | Slider se adjust karo |
| Save Settings | ✅ Yes | ✅ Yes | "SAVE CHANGES" button |
| Manual Sync | ❌ No | ✅ Yes | API call se |
| Image List | ❌ No | ✅ Yes | `/api/images` se |
| Image Deactivate | ❌ No | ✅ Yes | API call se |
| Logout | ✅ Yes | ✅ Yes | "Logout" button |

**Note:** Agar UI me missing features chahiye (Manual Sync, Image Management), to development team se request kar sakte hain.

---

## 📞 Support & Troubleshooting

### Logs Check Karne ke liye:

**Backend logs:**
```bash
# Development mode me console me dikhenge
npm run dev:backend
```

**iCloud sync logs:**
```bash
# Sync logs
tail -f /tmp/finalarchive_sync.log

# Error logs
tail -f /tmp/finalarchive_sync_error.log
```

**Launch agent status:**
```bash
# Service status
launchctl list | grep finalarchive

# Service restart
launchctl unload ~/Library/LaunchAgents/com.finalarchive.icloudsync.plist
launchctl load ~/Library/LaunchAgents/com.finalarchive.icloudsync.plist
```

### Testing Commands:

```bash
# API test
curl http://localhost:3000/api/images

# Random image
curl http://localhost:3000/api/images/random

# Settings
curl http://localhost:3000/api/settings
```

---

## 🎯 Quick Start Checklist

Setup complete karne ke liye ye checklist follow karo:

- [ ] Node.js installed (v20+)
- [ ] PostgreSQL database ready
- [ ] Project cloned/downloaded
- [ ] `npm install` successful
- [ ] `.env` file created with all variables
- [ ] Database connection tested
- [ ] `npx prisma db push` successful
- [ ] rclone installed and configured
- [ ] iCloud folder created
- [ ] Sync script tested manually
- [ ] Launch agent installed
- [ ] Backend server running (`npm run dev:backend`)
- [ ] API test successful (`curl http://localhost:3000/api/images`)
- [ ] Test image uploaded to iCloud folder
- [ ] Image appears in R2 bucket
- [ ] Image appears in API response

---

## 📚 Additional Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **Cloudflare R2**: https://developers.cloudflare.com/r2
- **rclone Docs**: https://rclone.org/docs
- **Fastify Docs**: https://www.fastify.io/docs/latest

---

## ⚠️ Important Notes

1. **Security:**
   - `.env` file ko kabhi bhi GitHub par commit mat karo
   - Strong passwords use karo
   - Production me HTTPS use karo

2. **Backup:**
   - Database ka regular backup lo
   - `.env` file ka backup safe jagah rakho

3. **Updates:**
   - Dependencies update karte waqt careful raho
   - Test karke hi production me deploy karo

4. **Monitoring:**
   - Logs regularly check karo
   - API health monitor karo
   - R2 bucket usage check karo

---

**Ye guide complete hai. Agar koi aur help chahiye, to documentation check karo ya support contact karo.**

**Good luck with your deployment! 🚀**
