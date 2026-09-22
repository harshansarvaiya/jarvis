---
name: "home-assistant-android-tv"
description: "Autonomous playbook for secure remote control of Android TV via Home Assistant and Cloudflare Tunnel."
author: "J.A.R.V.I.S. Autonomous Evolution"
version: "1.0.0"
triggers: ["android tv","home assistant","smart tv","control tv","turn off tv","turn on tv"]
source: "custom"
createdAt: "2026-09-22T06:11:13.921Z"
updatedAt: "2026-09-22T06:11:13.921Z"
---

# Home Assistant & Android TV Secure Control Playbook

## Architecture Overview
- Cloud-to-Local Bridge: Cloudflare Tunnel with scoped Service Token (mTLS/Header auth).
- Local Hub: Home Assistant (HA OS or Core in Docker) on local LAN.
- TV Integration: Home Assistant `androidtv_remote` or `google_cast` integration.
- Remote REST API: `POST /api/services/media_player/...` or `POST /api/services/remote/...` with Long-Lived Access Token.

## Required Environment Variables
- `HASS_URL`: Secured Cloudflare Tunnel URL (e.g. `https://ha.yourdomain.com`).
- `HASS_TOKEN`: Home Assistant Long-Lived Access Token.
- `HASS_CF_CLIENT_ID`: Cloudflare Access Service Token Client ID.
- `HASS_CF_CLIENT_SECRET`: Cloudflare Access Service Token Client Secret.
- `ANDROID_TV_ENTITY_ID`: Target media player entity (e.g. `media_player.android_tv`).

## Step 1: Local Home Assistant Android TV Pairing
1. In Home Assistant UI: Settings -> Devices & Services -> Add Integration -> "Android TV Remote".
2. Enter the local IP of your Android TV.
3. Accept the pairing PIN on the TV screen.
4. Note the entity ID: `media_player.living_room_tv` and `remote.living_room_tv`.

## Step 2: Cloudflare Zero Trust Tunnel Setup
1. In Cloudflare Zero Trust dashboard: Networks -> Tunnels -> Create Tunnel `ha-gateway`.
2. Map Public Hostname: `ha.yourdomain.com` -> `HTTP://localhost:8123` (or HA local IP).
3. Access Policy: Create Service Auth Application with Service Tokens.
4. Add tokens to J.A.R.V.I.S. environment.

## Step 3: Available Command Endpoints
- **Power**: `media_player.toggle`, `media_player.turn_on`, `media_player.turn_off`
- **Volume**: `media_player.volume_set`, `media_player.volume_mute`, `media_player.volume_up`, `media_player.volume_down`
- **Playback**: `media_player.media_play`, `media_player.media_pause`, `media_player.media_stop`
- **Navigation & Remote Keys**: `remote.send_command` (e.g., `HOME`, `BACK`, `DPAD_UP`, `DPAD_DOWN`, `DPAD_CENTER`, `MENU`)
- **App Launching**: `remote.send_command` with app deep links (e.g., `https://www.youtube.com`, `netflix://`, `spotify://`)
