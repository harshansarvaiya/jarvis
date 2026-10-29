/**
 * J.A.R.V.I.S. Mark II — Project A.R.C. Google Cloud Storage Stager
 * 
 * Uploads local distillation training datasets to the Sovereign GCS Bucket
 * using direct REST API authentication (pure zero-dependency cloud-native).
 * 
 * Target Bucket: gs://jarvis-vault-harshan-sovereign/distill/
 */

import fs from 'fs';
import path from 'path';
import { getVertexAccessToken } from '../../lib/jarvis/vertex';

const BUCKET_NAME = process.env.GCS_VAULT_BUCKET || 'jarvis-vault-harshan-sovereign';
const EXPORT_DIR = path.resolve(process.cwd(), 'data', 'distill', 'export');

export interface StagingResult {
  success: boolean;
  trainUri?: string;
  valUri?: string;
  manifestUri?: string;
  error?: string;
}

async function uploadToGcs(remotePath: string, localFilePath: string, token: string): Promise<string> {
  const fileBuffer = fs.readFileSync(localFilePath);
  const fileName = path.basename(remotePath);
  const contentType = fileName.endsWith('.jsonl') ? 'application/x-ndjson' : 'application/json';

  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(remotePath)}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length.toString(),
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload ${remotePath} to GCS (${response.status}): ${errorText}`);
  }

  return `gs://${BUCKET_NAME}/${remotePath}`;
}

export async function stageDistillationDatasets(tag: string = 'latest'): Promise<StagingResult> {
  console.log('================================================================');
  console.log('☁️ Project A.R.C. — Staging Training Datasets to Sovereign GCS');
  console.log('================================================================');
  console.log(`• Destination Bucket: gs://${BUCKET_NAME}/distill/${tag}/`);

  const token = await getVertexAccessToken();
  if (!token) {
    return { success: false, error: 'Failed to acquire Google Cloud authentication bearer token.' };
  }

  const trainFile = path.join(EXPORT_DIR, 'train_master_arc.jsonl');
  const valFile = path.join(EXPORT_DIR, 'val_master_arc.jsonl');
  const manifestFile = path.join(EXPORT_DIR, 'dataset_manifest.json');

  if (!fs.existsSync(trainFile)) {
    return { success: false, error: `Train dataset not found at ${trainFile}. Run generator first.` };
  }

  try {
    process.stdout.write('⏳ Uploading train_master_arc.jsonl... ');
    const trainUri = await uploadToGcs(`distill/${tag}/train_master_arc.jsonl`, trainFile, token);
    console.log(`✅ (${trainUri})`);

    let valUri: string | undefined;
    if (fs.existsSync(valFile)) {
      process.stdout.write('⏳ Uploading val_master_arc.jsonl... ');
      valUri = await uploadToGcs(`distill/${tag}/val_master_arc.jsonl`, valFile, token);
      console.log(`✅ (${valUri})`);
    }

    let manifestUri: string | undefined;
    if (fs.existsSync(manifestFile)) {
      process.stdout.write('⏳ Uploading dataset_manifest.json... ');
      manifestUri = await uploadToGcs(`distill/${tag}/dataset_manifest.json`, manifestFile, token);
      console.log(`✅ (${manifestUri})`);
    }

    console.log('\n🎉 Datasets Staged in Google Cloud Storage Successfully!');
    console.log(`• Primary Training Target: ${trainUri}\n`);

    return {
      success: true,
      trainUri,
      valUri,
      manifestUri,
    };
  } catch (err: any) {
    console.error('\n❌ Staging error:', err.message);
    return { success: false, error: err.message };
  }
}

if (require.main === module) {
  stageDistillationDatasets().then(res => {
    if (!res.success) process.exit(1);
  });
}
