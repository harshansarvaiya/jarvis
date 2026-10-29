#!/usr/bin/env bash
set -e

MODEL_PATH="/home/harshans279/jarvis/data/models/jarvis-sovereign-1.gguf"
PORT=${PORT:-8080}
THREADS=${THREADS:-2}
CTX=${CTX:-2048}

if [ ! -f "$MODEL_PATH" ]; then
  echo "❌ Model weights not found at $MODEL_PATH."
  echo "Please run: npx tsx scripts/distill/pull-model-from-drive.ts"
  exit 1
fi

echo "🚀 Starting J.A.R.V.I.S. Sovereign-1 C++ Inference Engine..."
echo "• Model: $MODEL_PATH"
echo "• Endpoint: http://127.0.0.1:$PORT/v1"
echo "• CPU Threads: $THREADS | Context Window: $CTX"

exec /home/harshans279/jarvis/bin/llama-server \
  -m "$MODEL_PATH" \
  -c "$CTX" \
  -t "$THREADS" \
  --port "$PORT" \
  --host 127.0.0.1 \
  --alias "jarvis-sovereign-1"
