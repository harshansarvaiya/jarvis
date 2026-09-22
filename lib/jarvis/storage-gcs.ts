import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const BUCKET_NAME = process.env.GCS_VAULT_BUCKET || 'jarvis-vault-harshan-sovereign';

export interface GcsVaultResult {
  success: boolean;
  bucketUrl?: string;
  bytesUploaded?: number;
  error?: string;
}

export class SovereignGcsVault {
  private bucketName: string;

  constructor(bucketName = BUCKET_NAME) {
    this.bucketName = bucketName;
  }

  /**
   * Uploads any file or raw JSON content directly to the Sovereign GCS Bucket.
   * Completely programmatic with ZERO manual file creation required.
   */
  async uploadObject(destinationName: string, contentOrFilePath: string | Record<string, any>): Promise<GcsVaultResult> {
    try {
      let tempFileToClean: string | null = null;
      let sourcePath = '';

      if (typeof contentOrFilePath === 'string' && fs.existsSync(contentOrFilePath)) {
        sourcePath = contentOrFilePath;
      } else {
        const tempDir = path.join(process.cwd(), 'data', 'vault');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        tempFileToClean = path.join(tempDir, `tmp_${Date.now()}_${path.basename(destinationName)}`);
        const payload = typeof contentOrFilePath === 'string' ? contentOrFilePath : JSON.stringify(contentOrFilePath, null, 2);
        fs.writeFileSync(tempFileToClean, payload, 'utf-8');
        sourcePath = tempFileToClean;
      }

      const gcsUri = `gs://${this.bucketName}/${destinationName}`;
      await execAsync(`gcloud storage cp "${sourcePath}" "${gcsUri}"`);

      const stats = fs.statSync(sourcePath);
      if (tempFileToClean && fs.existsSync(tempFileToClean)) {
        fs.unlinkSync(tempFileToClean);
      }

      return {
        success: true,
        bucketUrl: gcsUri,
        bytesUploaded: stats.size,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'GCS upload failed',
      };
    }
  }

  /**
   * Lists all vault backups and archives in the bucket.
   */
  async listObjects(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`gcloud storage ls gs://${this.bucketName}/`);
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

export const sovereignGcsVault = new SovereignGcsVault();
