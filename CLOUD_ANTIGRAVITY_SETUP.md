# 24/7 Cloud Antigravity Setup Guide
## Running Antigravity from Your Phone (Zero Local PC Dependency)

This guide walks you through deploying the headless **Antigravity CLI daemon (`agy remote-control`)** on a **100% Free Forever Google Cloud (GCP) `e2-micro` VM**. Once configured, Antigravity runs 24/7 in the cloud, accessible from your phone anytime via [https://antigravity.google/](https://antigravity.google/) even when your personal laptop is powered off.

---

## Phase 1: Launch the Free VM on Google Cloud (2 minutes)

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. In the search bar at the top, type **VM Instances** (under Compute Engine) and select it.
3. Click **Create Instance**:
   - **Name**: `antigravity-cloud-runner` (or any nickname)
   - **Region**: Select one of the **Always Free** regions:
     - `us-central1` (Iowa) — *Recommended*
     - `us-east1` (South Carolina)
     - `us-west1` (Oregon)
   - **Machine Configuration**:
     - Series: **E2**
     - Machine type: **e2-micro** (2 vCPU, 1 GB memory — *Free Tier eligible*)
   - **Boot disk** (Click *Change*):
     - Operating System: **Ubuntu**
     - Version: **Ubuntu 24.04 LTS x86/64**
     - Boot disk type: **Standard persistent disk**
     - Size: **30 GB** (*Free Tier includes up to 30 GB standard disk per month*)
4. Click **Create** at the bottom. Your VM will spin up within 30 seconds.

---

## Phase 2: Connect via In-Browser SSH (30 seconds)

1. In the Compute Engine VM list, click the **SSH** button next to your new instance (`antigravity-cloud-runner`).
2. A browser terminal window will open automatically connected to your cloud VM.

---

## Phase 3: Install & Authenticate Antigravity CLI (2 minutes)

Copy and paste the following commands into your SSH terminal:

```bash
# 1. Update package list & install curl
sudo apt update && sudo apt install -y curl

# 2. Download and install official Antigravity CLI
curl -fsSL https://antigravity.google/cli/install.sh | bash

# 3. Add to PATH and refresh shell
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 4. Authenticate with Google
agy
```

### Headless Sign-In Flow:
- Because the VM is headless, `agy` will print an authorization link:
  `https://antigravity.google/device?...`
- Copy that link, open it in your browser (on your phone or computer), and sign in with the **same Google Account** you want to use on your phone.
- Once authenticated, type `/exit` (or press `Ctrl+D`) to return to the shell.

---

## Phase 4: Start the 24/7 Remote Control Daemon (1 minute)

To keep Antigravity running permanently in the background even when you close the SSH window:

```bash
# Start the remote control daemon in the background
nohup agy remote-control start > ~/agy-daemon.log 2>&1 &
```

To verify it is running:
```bash
tail -n 20 ~/agy-daemon.log
```
You should see:
`[Remote Control] Daemon started. Connected to Antigravity Cloud Gateway.`

---

## Phase 5: Connect from Your Phone (Instant)

1. On your phone's browser (Safari on iPhone, Chrome on Android), go to:
   👉 **[https://antigravity.google/](https://antigravity.google/)**
2. Sign in with the **same Google Account**.
3. You will see **`antigravity-cloud-runner`** listed with a green status indicator (**Online 24/7**).
4. Tap into the instance to start a new chat, execute terminal commands, review implementation plans, or inspect artifacts!

### Optional: Install as Native App (PWA) with Push Notifications
- **iPhone (iOS)**: Tap the **Share** button in Safari ➔ Tap **Add to Home Screen**.
- **Android**: Tap the three-dot menu in Chrome ➔ Tap **Install App** / **Add to Home screen**.
- Allow **Notifications**: Antigravity will proactively alert your phone whenever a coding task finishes or requires your review!

---

## Summary of Costs & Cloud Specs

| Resource | Value | Cost |
|---|---|---|
| **Instance Type** | `e2-micro` (2 vCPU, 1 GB RAM) | **$0.00 / month (Always Free)** |
| **Storage** | 30 GB Standard Persistent Disk | **$0.00 / month (Always Free)** |
| **Uptime** | 24 hours / 7 days / 365 days | **Always On** |
| **Local Laptop Dependency** | Laptop powered off, asleep, or travel | **0% dependency** |
