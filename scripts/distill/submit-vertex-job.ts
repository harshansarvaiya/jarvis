/**
 * J.A.R.V.I.S. Mark II — Project A.R.C. Vertex AI Custom Training Job Launcher
 * 
 * Programmatically submits a serverless GPU training job to Google Cloud Vertex AI
 * drawing 100% from GCP credits on project antigravity-cloud-runner.
 * 
 * Machine Spec: g2-standard-8 (1x NVIDIA L4 24GB VRAM GPU) | SPOT Instance Strategy
 * Cost Profile: ~$1.20/hr * 2.5h = ~$3.00 total (billed to GCP Credits)
 */

import fs from 'fs';
import path from 'path';
import { getVertexAccessToken } from '../../lib/jarvis/vertex';
import { stageDistillationDatasets } from './stage-gcs';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'antigravity-cloud-runner';
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const BUCKET_NAME = process.env.GCS_VAULT_BUCKET || 'jarvis-vault-harshan-sovereign';

export interface VertexJobConfig {
  acceleratorType?: 'NVIDIA_L4' | 'NVIDIA_TESLA_A100';
  machineType?: string;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  useSpot?: boolean;
}

export async function submitVertexCustomJob(config: VertexJobConfig = {}) {
  console.log('================================================================');
  console.log('🚀 Project A.R.C. — Launching Vertex AI Sovereign Distillation Job');
  console.log('================================================================');
  console.log(`• Target GCP Project:  ${PROJECT_ID}`);
  console.log(`• Region:              ${LOCATION}`);
  console.log(`• Machine Spec:        ${config.machineType || 'g2-standard-8'} (1x ${config.acceleratorType || 'NVIDIA_L4'})`);
  console.log(`• Execution Strategy:  ${config.useSpot !== false ? 'SPOT (60% Credit Discount)' : 'STANDARD'}\n`);

  // 1. Stage datasets to GCS first
  const stagingResult = await stageDistillationDatasets('latest');
  if (!stagingResult.success) {
    throw new Error(`Dataset staging failed: ${stagingResult.error}`);
  }

  // 2. Upload the training script itself to GCS so the container can execute it
  const trainScriptPath = path.resolve(process.cwd(), 'scripts', 'distill', 'train_arc.py');
  if (!fs.existsSync(trainScriptPath)) {
    throw new Error(`train_arc.py not found at ${trainScriptPath}`);
  }

  const token = await getVertexAccessToken();
  if (!token) {
    throw new Error('Failed to obtain Google Cloud authentication token.');
  }

  console.log('⏳ Staging train_arc.py script to GCS...');
  const scriptBuffer = fs.readFileSync(trainScriptPath);
  const scriptUploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=distill%2Flatest%2Ftrain_arc.py`;
  
  const scriptUploadRes = await fetch(scriptUploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/x-python',
      'Content-Length': scriptBuffer.length.toString(),
    },
    body: scriptBuffer,
  });

  if (!scriptUploadRes.ok) {
    throw new Error(`Failed to upload train_arc.py to GCS: ${await scriptUploadRes.text()}`);
  }
  console.log(`✅ Script staged at gs://${BUCKET_NAME}/distill/latest/train_arc.py\n`);

  // 3. Assemble Vertex AI CustomJob payload
  const accelerator = config.acceleratorType || 'NVIDIA_L4';
  const machine = config.machineType || (accelerator === 'NVIDIA_TESLA_A100' ? 'a2-highgpu-1g' : 'g2-standard-8');
  const jobName = `jarvis-arc-distill-${Date.now()}`;

  const containerCommands = [
    '/bin/bash',
    '-c',
    `set -e
echo "=== Initializing Sovereign GPU Container ==="
nvidia-smi
pip install --upgrade pip
pip install --upgrade transformers datasets peft accelerate bitsandbytes huggingface_hub
mkdir -p /workspace && cd /workspace
echo "=== Downloading Staged Datasets and Engine from GCS ==="
gcloud storage cp gs://${BUCKET_NAME}/distill/latest/* .
ls -la
echo "=== Commencing Training Harness ==="
python3 train_arc.py \\
  --base_model meta-llama/Llama-3.2-3B-Instruct \\
  --train_file train_master_arc.jsonl \\
  --val_file val_master_arc.jsonl \\
  --output_dir ./output_adapters \\
  --epochs ${config.epochs || 3} \\
  --batch_size ${config.batchSize || 4} \\
  --learning_rate ${config.learningRate || 2e-4}
echo "=== Exporting Adapters to Sovereign GCS ==="
gcloud storage cp -r ./output_adapters/* gs://${BUCKET_NAME}/models/arc-sovereign-1/
echo "=== Vertex AI Distillation Complete ==="`
  ];

  const customJobPayload: any = {
    displayName: jobName,
    jobSpec: {
      workerPoolSpecs: [
        {
          machineSpec: {
            machineType: machine,
            acceleratorType: accelerator,
            acceleratorCount: 1,
          },
          replicaCount: 1,
          containerSpec: {
            imageUri: 'us-docker.pkg.dev/deeplearning-platform-release/gcr.io/pytorch-gpu.2-4.py311',
            command: [containerCommands[0], containerCommands[1]],
            args: [containerCommands[2]],
          },
        },
      ],
      scheduling: {
        timeout: '14400s', // 4 hours maximum safety cutoff
        restartJobOnWorkerRestart: false,
      },
    },
  };

  if (config.useSpot !== false) {
    customJobPayload.jobSpec.scheduling.strategy = 'SPOT';
  }

  // 4. Submit to Vertex AI REST API
  const vertexEndpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/customJobs`;
  console.log(`⏳ Submitting CustomJob [${jobName}] to Vertex AI...`);

  const response = await fetch(vertexEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customJobPayload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error('❌ Vertex AI Job Submission Failed:');
    console.error(`Status: ${response.status}`);
    console.error(`Response: ${responseText}`);
    return {
      success: false,
      status: response.status,
      error: responseText,
    };
  }

  const jobData = JSON.parse(responseText);
  console.log('\n🎉 Vertex AI Training Job Successfully Dispatched!');
  console.log(`• Job Resource Name: ${jobData.name}`);
  console.log(`• State:             ${jobData.state}`);
  console.log(`• Console URL:       https://console.cloud.google.com/vertex-ai/training/custom-jobs?project=${PROJECT_ID}\n`);

  return {
    success: true,
    jobName: jobData.name,
    displayName: jobName,
    state: jobData.state,
  };
}

export async function checkVertexJobStatus(jobResourceName: string) {
  const token = await getVertexAccessToken();
  if (!token) throw new Error('No token');

  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/${jobResourceName}`;
  const res = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Status check failed: ${await res.text()}`);
  return await res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const useA100 = args.includes('--a100');
  const epochs = args.includes('--epochs') ? parseInt(args[args.indexOf('--epochs') + 1], 10) : 3;

  await submitVertexCustomJob({
    acceleratorType: useA100 ? 'NVIDIA_TESLA_A100' : 'NVIDIA_L4',
    epochs,
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal launcher error:', err);
    process.exit(1);
  });
}
