"""
J.A.R.V.I.S. Mark II — Sovereign Model Substrate (Project A.R.C. / V.I.S.)
Modal Serverless GPU Runner (NVIDIA T4 / L4)
Exposes OpenAI-compatible endpoints with auto-scaling to zero ($0 idle).
"""

import os
import subprocess
import modal

app = modal.App("vis-sovereign-core")

# Persistent volume containing our 1.9 GB GGUF model
vault_volume = modal.Volume.from_name("jarvis-vault")
VAULT_MOUNT = "/vault"
DEFAULT_MODEL_PATH = f"{VAULT_MOUNT}/models/jarvis-sovereign-1.gguf"

# Container image with CUDA 12.4 runtime and precompiled llama-cpp-python
image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-runtime-ubuntu22.04", add_python="3.11")
    .pip_install(
        "llama-cpp-python[server]",
        extra_index_url="https://abetlen.github.io/llama-cpp-python/whl/cu124",
    )
    .pip_install(
        "fastapi",
        "uvicorn",
        "pydantic",
        "sse-starlette",
        "starlette-context",
    )
)


@app.function(
    image=image,
    gpu="T4",  # Highly cost-efficient NVIDIA T4 (16GB VRAM)
    volumes={VAULT_MOUNT: vault_volume},
    timeout=300,
    scaledown_window=120,  # Auto-scales to zero after 2 minutes of idle -> $0 cost
)
@modal.web_server(8000, startup_timeout=120)
def serve():
    """
    Spawns llama-cpp-python OpenAI-compatible API server on port 8000.
    Modal maps this port automatically to a secure public HTTPS endpoint.
    """
    model_path = DEFAULT_MODEL_PATH
    if not os.path.exists(model_path):
        for root, _, files in os.walk(VAULT_MOUNT):
            for f in files:
                if f.endswith(".gguf"):
                    model_path = os.path.join(root, f)
                    break
            if os.path.exists(model_path):
                break

    print(f"[V.I.S. GPU SUBSTRATE] Resolved model path: {model_path} (exists={os.path.exists(model_path)})")

    cmd = [
        "python3",
        "-m",
        "llama_cpp.server",
        "--model",
        model_path,
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--n_gpu_layers",
        "-1",  # Offload all layers to GPU VRAM
        "--n_ctx",
        "16384",  # 16k context window enabled by Q4 KV Cache & FlashAttention
        "--flash_attn",
        "True",  # FlashAttention-2 integration
        "--type_k",
        "2",  # GGML_TYPE_Q4_0 (4-bit quantized Key Cache)
        "--type_v",
        "2",  # GGML_TYPE_Q4_0 (4-bit quantized Value Cache)
        "--model_alias",
        "jarvis-sovereign-1",
    ]
    print(f"[V.I.S. GPU SUBSTRATE] Launching server: {' '.join(cmd)}")
    subprocess.Popen(cmd)
