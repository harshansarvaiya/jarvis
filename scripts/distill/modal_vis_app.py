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
MODEL_DIR = "/models"
MODEL_FILENAME = "jarvis-sovereign-1.gguf"
MODEL_PATH = f"{MODEL_DIR}/{MODEL_FILENAME}"

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
    volumes={MODEL_DIR: vault_volume},
    timeout=300,
    container_idle_timeout=120,  # Auto-scales to zero after 2 minutes of idle -> $0 cost
)
@modal.web_server(port=8000, startup_timeout=60)
def serve():
    """
    Spawns llama-cpp-python OpenAI-compatible API server on port 8000.
    Modal maps this port automatically to a secure public HTTPS endpoint.
    """
    cmd = [
        "python3",
        "-m",
        "llama_cpp.server",
        "--model",
        MODEL_PATH,
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--n_gpu_layers",
        "-1",  # Offload all layers to GPU VRAM
        "--n_ctx",
        "8192",  # 8k context window
        "--alias",
        "jarvis-sovereign-1",
    ]
    print(f"[V.I.S. GPU SUBSTRATE] Launching server: {' '.join(cmd)}")
    subprocess.Popen(cmd)
