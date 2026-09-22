import fs from 'fs';
import path from 'path';
import { executeGoogleDriveMCP } from '../lib/jarvis/mcp';
import { getStorage } from '../lib/jarvis/storage';

export async function syncVaultToGoogleDrive(targetFolderId?: string): Promise<{ success: boolean; fileId?: string; error?: string }> {
  console.log('🔒 Initiating Sovereign Vault Backup to Google Drive...');

  try {
    // 1. Gather all private chat records, trajectories, and profiles
    const dataDir = path.join(process.cwd(), 'data');
    const privateVault: Record<string, any> = {
      exportedAt: new Date().toISOString(),
      owner: 'Harshan Sarvaiya',
      compliance: 'Directive 01 (Guardian Protocol) Sovereign Privacy Vault',
      data: {},
    };

    // Upstash Chat History
    try {
      const liveChats = await getStorage().getChatHistory(500);
      privateVault.data.upstashChatHistory = liveChats;
    } catch {}

    // Local Private Files
    const filesToVault = [
      'sir-profile.json',
      'jarvis-chats.json',
      'autonomous_log.json',
      'jarvis-state.json',
    ];

    for (const f of filesToVault) {
      const p = path.join(dataDir, f);
      if (fs.existsSync(p)) {
        try {
          privateVault.data[f] = JSON.parse(fs.readFileSync(p, 'utf-8'));
        } catch {
          privateVault.data[f] = fs.readFileSync(p, 'utf-8');
        }
      }
    }

    // Trajectories if available
    const trajPath = path.join(dataDir, 'trajectories', 'trajectories.jsonl');
    if (fs.existsSync(trajPath)) {
      try {
        const lines = fs.readFileSync(trajPath, 'utf-8').trim().split('\n');
        privateVault.data.trajectoriesCount = lines.length;
        privateVault.data.trajectoriesSample = lines.slice(-50).map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return l;
          }
        });
      } catch {}
    }

    // 2. Locate Shared Drive Folder
    let folderId = targetFolderId;
    if (!folderId) {
      const listRes = await executeGoogleDriveMCP('list_files', {
        query: 'mimeType = "application/vnd.google-apps.folder" and trashed = false',
      });
      const folders = listRes.output?.files || [];
      if (folders.length > 0) {
        folderId = folders[0].id;
        console.log(`📁 Detected shared Google Drive folder: "${folders[0].name}" (${folderId})`);
      }
    }

    if (!folderId) {
      return {
        success: false,
        error: 'No shared Google Drive folder found. Please create a folder in Google Drive (e.g. "JARVIS Vault") and share it with jarvis-vertex@antigravity-cloud-runner.iam.gserviceaccount.com as Editor.',
      };
    }

    // 3. Check if an existing vault file already exists in the folder
    const listInside = await executeGoogleDriveMCP('list_files', { folderId });
    const existingFiles = listInside.output?.files || [];
    const targetFile = existingFiles.find((f: any) => f.name.toLowerCase().includes('vault') || f.name.toLowerCase().includes('chat') || f.name.toLowerCase().includes('history')) || existingFiles[0];

    const fileName = `JARVIS_Private_Vault_${new Date().toISOString().slice(0, 10)}.json`;
    const payload = JSON.stringify(privateVault, null, 2);

    if (targetFile?.id) {
      console.log(`📝 Existing vault destination detected: "${targetFile.name}" (${targetFile.id}). Updating directly...`);
      const updateRes = await executeGoogleDriveMCP('update_file', {
        fileId: targetFile.id,
        content: payload,
        mimeType: 'application/json',
      });

      if (!updateRes.success) {
        return {
          success: false,
          error: updateRes.error || 'Failed to update vault file in Google Drive.',
        };
      }

      console.log(`✅ Sovereign Vault successfully synced to Google Drive file: "${targetFile.name}" (ID: ${targetFile.id})`);
      return {
        success: true,
        fileId: targetFile.id,
      };
    }

    // Attempt creation of new file
    const uploadRes = await executeGoogleDriveMCP('create_file', {
      name: fileName,
      content: payload,
      mimeType: 'application/json',
      folderId,
    });

    if (!uploadRes.success) {
      return {
        success: false,
        error: `${uploadRes.error}. (Tip: In Google Drive, inside "JARVIS Vault", create a blank file named "vault.json" or a blank Google Doc so your user quota applies, then rerun the sync!)`,
      };
    }

    console.log(`✅ Sovereign Vault successfully created in Google Drive: "${fileName}" (ID: ${uploadRes.output?.id})`);
    return {
      success: true,
      fileId: uploadRes.output?.id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Unknown vault sync failure',
    };
  }
}

// Direct CLI execution check
if (require.main === module) {
  syncVaultToGoogleDrive().then((res) => {
    console.log('Result:', res);
    process.exit(res.success ? 0 : 1);
  });
}
