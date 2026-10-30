"""
J.A.R.V.I.S. Mark II — Sovereign Model Substrate (Project A.R.C. / V.I.S.)
Modal Serverless GPU Runner (NVIDIA T4 / L4)
Exposes OpenAI-compatible endpoints with auto-scaling to zero ($0 idle).
"""

import os
import subprocess
import modal

app = modal.App("vis-sovereign-core")

# Persistent volume containing our GGUF models
vault_volume = modal.Volume.from_name("jarvis-vault")
VAULT_MOUNT = "/vault"
V3_MODEL_PATH = f"{VAULT_MOUNT}/models/jarvis-sovereign-3.gguf"
V2_MODEL_PATH = f"{VAULT_MOUNT}/models/jarvis-sovereign-2_gguf/Llama-3.2-3B-Instruct.Q4_K_M.gguf"
V1_MODEL_PATH = f"{VAULT_MOUNT}/models/jarvis-sovereign-1.gguf"

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
    gpu="A100-80GB",  # High-capacity 80GB NVIDIA A100 GPU for 70B parameter serving
    volumes={VAULT_MOUNT: vault_volume},
    timeout=600,
    scaledown_window=180,  # Auto-scales to zero after 3 minutes of idle -> $0 cost
)
@modal.web_server(8000, startup_timeout=300)
def serve():
    """
    Spawns llama-cpp-python OpenAI-compatible API server on port 8000.
    Modal maps this port automatically to a secure public HTTPS endpoint.
    """
    model_path = V3_MODEL_PATH if os.path.exists(V3_MODEL_PATH) else (
        V2_MODEL_PATH if os.path.exists(V2_MODEL_PATH) else V1_MODEL_PATH
    )
    if not os.path.exists(model_path):
        for root, _, files in os.walk(VAULT_MOUNT):
            for f in files:
                if f.endswith(".gguf") and ("70B" in f or "sovereign-3" in f):
                    model_path = os.path.join(root, f)
                    break
            if os.path.exists(model_path):
                break

    print(f"[V.I.S. GPU SUBSTRATE v3-70B] Resolved model path: {model_path} (exists={os.path.exists(model_path)})")

    model_alias = "jarvis-sovereign-3" if "sovereign-3" in model_path or "70B" in model_path else "jarvis-sovereign-2"

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
        "-1",  # Offload all 80 transformer layers to A100-80GB VRAM
        "--n_ctx",
        "16384",  # 16k context window enabled by Q4 KV Cache & FlashAttention
        "--flash_attn",
        "True",  # FlashAttention-2 integration
        "--type_k",
        "2",  # GGML_TYPE_Q4_0 (4-bit quantized Key Cache)
        "--type_v",
        "2",  # GGML_TYPE_Q4_0 (4-bit quantized Value Cache)
        "--model_alias",
        model_alias,
    ]
    print(f"[V.I.S. GPU SUBSTRATE v3-70B] Launching server: {' '.join(cmd)}")
    subprocess.Popen(cmd)
