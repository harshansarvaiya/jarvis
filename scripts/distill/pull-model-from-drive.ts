/**
 * J.A.R.V.I.S. Mark II — Project A.R.C. Sovereign Model Importer
 * 
 * Streams distilled GGUF weights directly from Sir's Google Drive ("JARVIS Vault")
 * to the Cloud Runner VM's local models directory (data/models/jarvis-sovereign-1.gguf).
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { GoogleAuth } from 'google-auth-library';

const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/home/harshans279/.gcp/jarvis-vertex.json';
const VAULT_FOLDER_ID = '1lYxUQjwSkZeBl2wpqq4Neh2PSvqFKA6l';
const TARGET_DIR = path.resolve(process.cwd(), 'data', 'models');
const TARGET_FILE = path.join(TARGET_DIR, 'jarvis-sovereign-1.gguf');

async function getDriveAuthToken(): Promise<string> {
  const auth = new GoogleAuth({
    keyFilename: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  if (!token) throw new Error('Could not acquire Google Drive access token');
  return token;
}

interface DriveFile {
  id: string;
  name: string;
  size?: string;
  mimeType: string;
}

async function searchGgufFiles(token: string, folderId: string): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,mimeType)&supportsAllDrives=true`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive list failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { files: DriveFile[] };
  const found: DriveFile[] = [];

  for (const f of data.files || []) {
    if (f.name.endsWith('.gguf') || f.name.includes('gguf')) {
      found.push(f);
    } else if (f.mimeType === 'application/vnd.google-apps.folder') {
      // Recurse into subfolders
      const sub = await searchGgufFiles(token, f.id);
      found.push(...sub);
    }
  }

  return found;
}

async function downloadFile(token: string, fileId: string, destPath: string, totalBytes?: number) {
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  console.log(`⬇️ Initiating stream download from Drive (fileId: ${fileId})...`);

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`Download failed (${res.status}): ${err}`);
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const fileStream = fs.createWriteStream(destPath);

  let downloadedBytes = 0;
  let lastReportTime = Date.now();
  const readable = (res.body as any);

  readable.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    const now = Date.now();
    if (now - lastReportTime > 2000) {
      lastReportTime = now;
      const mb = (downloadedBytes / (1024 * 1024)).toFixed(1);
      const totalMb = totalBytes ? (totalBytes / (1024 * 1024)).toFixed(1) : '?';
      const pct = totalBytes ? ((downloadedBytes / totalBytes) * 100).toFixed(1) + '%' : '';
      console.log(`📦 Download progress: ${mb} MB / ${totalMb} MB ${pct}`);
    }
  });

  await pipeline(readable, fileStream);
  console.log(`✅ Model successfully written to ${destPath} (${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB)`);
}

export async function pullSovereignModel(explicitFileId?: string) {
  console.log('================================================================');
  console.log('🛡️ Project A.R.C. — Sovereign Model Deployment Pipeline');
  console.log('================================================================');

  const token = await getDriveAuthToken();
  let targetFile: DriveFile | null = null;

  if (explicitFileId) {
    console.log(`🔍 Inspecting explicit file ID: ${explicitFileId}`);
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${explicitFileId}?fields=id,name,size,mimeType&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (metaRes.ok) {
      targetFile = (await metaRes.json()) as DriveFile;
    } else {
      console.error('❌ Could not fetch file metadata for ID:', explicitFileId);
    }
  }

  if (!targetFile) {
    console.log(`🔍 Scanning "JARVIS Vault" (folder: ${VAULT_FOLDER_ID}) for .gguf weights...`);
    const ggufFiles = await searchGgufFiles(token, VAULT_FOLDER_ID);

    if (ggufFiles.length === 0) {
      console.log('⚠️ No .gguf model files detected inside "JARVIS Vault" folder.');
      console.log('👉 ACTION REQUIRED: In your Google Drive, move the "jarvis_sovereign_1_gguf" folder');
      console.log('   (or the .gguf file inside it) into your shared "JARVIS Vault" folder.');
      return false;
    }

    targetFile = ggufFiles[0];
    console.log(`🎯 Located Sovereign model weights: "${targetFile.name}" (ID: ${targetFile.id}, Size: ${targetFile.size || 'unknown'} bytes)`);
  }

  const expectedBytes = targetFile.size ? parseInt(targetFile.size, 10) : undefined;
  await downloadFile(token, targetFile.id, TARGET_FILE, expectedBytes);
  return true;
}

if (require.main === module) {
  const explicitId = process.argv[2];
  pullSovereignModel(explicitId).then((success) => {
    process.exit(success ? 0 : 1);
  });
}
