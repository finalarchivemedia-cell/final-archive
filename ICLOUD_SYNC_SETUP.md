# iCloud → R2 Automatic Sync Setup Guide

Ye guide aapko iCloud se Cloudflare R2 me automatic image sync setup karne me help karega.

---

## 📋 Prerequisites

1. **rclone installed** (Mac par)
2. **R2 credentials** (already have: Access Key ID & Secret Access Key)
3. **iCloud Drive folder** (where you'll drop images)

---

## 🔧 Step 1: Install rclone

```bash
# Homebrew se install (recommended)
brew install rclone

# Verify installation
rclone version
```

---

## 🔧 Step 2: Configure rclone for R2

Terminal me ye command run karo:

```bash
rclone config
```

Phir ye steps follow karo (interactive prompts):

1. **`n`** (New remote)
2. **Name**: `r2` (ya koi bhi naam)
3. **Storage**: `5` (S3)
4. **Provider**: `4` (Cloudflare)
5. **Access Key ID**: `81d0dacd985a75ee1ae53afe2c510e4f`
6. **Secret Access Key**: `18086828233cd503ecf2369ae23230f7128e6b9ede43f398cedc89d971d56487`
7. **Region**: `auto`
8. **Endpoint**: `https://6221f575405c4ced9ac6e1e6cfb0c650.r2.cloudflarestorage.com`
9. **ACL**: `private` (ya `public-read`)
10. **`y`** (save configuration)

**Test connection:**
```bash
rclone lsd r2:final-archive
```

Agar bucket list dikhe, to connection theek hai! ✅

---

## 📁 Step 3: Create iCloud Folder

1. **Finder** open karo
2. **iCloud Drive** me jao
3. **New Folder** create karo: `FinalArchive`
4. Is folder me images drop karo

**Path:**
```
~/Library/Mobile Documents/com~apple~CloudDocs/FinalArchive
```

---

## 🚀 Step 4: Manual Test Sync

Pehle manually test karo:

```bash
cd "/Users/mac/Documents/SQUARE SPACE /final-archive"
chmod +x scripts/sync_icloud_to_r2.sh
./scripts/sync_icloud_to_r2.sh
```

Agar sync successful ho, to next step par jao.

---

## ⏰ Step 5: Automatic Scheduling (macOS launchd)

Mac par automatic sync setup karo (har 5 minutes me):

### 5.1: Update plist file path

`scripts/com.finalarchive.icloudsync.plist` file me apna exact path update karo:

```xml
<string>/Users/mac/Documents/SQUARE SPACE /final-archive/scripts/sync_icloud_to_r2.sh</string>
```

### 5.2: Install launchd service

```bash
# Copy plist to LaunchAgents
cp "scripts/com.finalarchive.icloudsync.plist" ~/Library/LaunchAgents/

# Load the service
launchctl load ~/Library/LaunchAgents/com.finalarchive.icloudsync.plist

# Start immediately
launchctl start com.finalarchive.icloudsync
```

### 5.3: Verify it's running

```bash
# Check status
launchctl list | grep finalarchive

# Check logs
tail -f /tmp/finalarchive_sync.log
```

---

## ✅ Step 6: Verify Everything Works

1. **iCloud folder me test image drop karo**
2. **5 minutes wait karo** (ya manually sync trigger karo)
3. **R2 bucket check karo**: Cloudflare Dashboard → R2 → final-archive
4. **API check karo**: 
   ```bash
   curl https://final-archive-production.up.railway.app/api/images
   ```

---

## 🔄 How It Works

1. **You drop image** → iCloud folder me
2. **iCloud syncs** → Mac par local folder update hota hai
3. **rclone script runs** → Har 5 minutes me (automatic)
4. **Images upload** → R2 bucket me
5. **Backend syncs** → Har 60 seconds me (automatic)
6. **Images appear** → Website par automatically! 🎉

---

## 🛠️ Troubleshooting

### Sync nahi ho raha?

```bash
# Check rclone connection
rclone lsd r2:final-archive

# Check iCloud folder path
ls -la "$HOME/Library/Mobile Documents/com~apple~CloudDocs/FinalArchive"

# Manual sync test
./scripts/sync_icloud_to_r2.sh
```

### Launchd service nahi chala?

```bash
# Check logs
cat /tmp/finalarchive_sync.log
cat /tmp/finalarchive_sync_error.log

# Reload service
launchctl unload ~/Library/LaunchAgents/com.finalarchive.icloudsync.plist
launchctl load ~/Library/LaunchAgents/com.finalarchive.icloudsync.plist
```

### Images R2 me hain but website par nahi dikh rahe?

1. **Backend sync check karo**: Railway logs me "R2 Sync" messages
2. **Manual sync trigger karo**: Admin panel se ya API se
3. **API check karo**: `curl https://final-archive-production.up.railway.app/api/images`

---

## 📝 Configuration Options

### Sync frequency change karna?

`scripts/com.finalarchive.icloudsync.plist` me:

```xml
<key>StartInterval</key>
<integer>300</integer>  <!-- 300 = 5 minutes, 60 = 1 minute -->
```

Phir reload karo:
```bash
launchctl unload ~/Library/LaunchAgents/com.finalarchive.icloudsync.plist
launchctl load ~/Library/LaunchAgents/com.finalarchive.icloudsync.plist
```

### R2 subfolder use karna?

`scripts/sync_icloud_to_r2.sh` me:

```bash
R2_PREFIX="media"  # Images will go to r2:final-archive/media/
```

---

## 🎯 Summary

✅ **rclone installed** → R2 connection configured  
✅ **iCloud folder** → FinalArchive created  
✅ **Sync script** → Ready to use  
✅ **Automatic scheduling** → launchd service running  
✅ **Drop images** → They appear automatically! 🚀

---

## 📞 Support

Agar koi issue aaye:
1. Check logs: `/tmp/finalarchive_sync.log`
2. Manual test: `./scripts/sync_icloud_to_r2.sh`
3. R2 connection: `rclone lsd r2:final-archive`
