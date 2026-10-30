"""
J.A.R.V.I.S. Mark II — V.I.S. v3-70B Fine-Tuning Pipeline
Automates 4-bit QLoRA fine-tuning on Meta Llama-3.3-70B-Instruct using
an NVIDIA A100 (80GB VRAM) on Modal Serverless Cloud.
Directly exports fused 4-bit quantized GGUF weights to 'jarvis-vault' Volume.
"""

import os
import sys
import shutil
import modal

app = modal.App("vis-v3-70b-trainer")

# Persistent volume storing models and datasets
vault_volume = modal.Volume.from_name("jarvis-vault")
VAULT_MOUNT = "/vault"

# Build optimized training image with Unsloth and PyTorch CUDA 12.4
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("build-essential", "cmake", "git")
    .pip_install(
        "torch",
        "transformers",
        "datasets",
        "trl",
        "peft",
        "bitsandbytes",
        "accelerate",
        "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git",
    )
)


@app.function(
    image=image,
    gpu="A100-80GB",  # High-capacity 80GB NVIDIA A100 GPU for 70B parameter QLoRA
    volumes={VAULT_MOUNT: vault_volume},
    timeout=7200,  # 2-hour execution envelope for 70B training and export
)
def train_and_export_vis_v3(
    dataset_lines: list[str],
    max_steps: int = 150,
    learning_rate: float = 1.5e-4,
    model_name: str = "unsloth/Llama-3.3-70B-Instruct-bnb-4bit",
):
    import unsloth
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template
    import json
    import torch
    from datasets import Dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments

    print(f"[V.I.S. v3 TRAINER] Received {len(dataset_lines)} trajectories for 70B training.")
    print(f"[V.I.S. v3 TRAINER] Foundation Titan: {model_name} | Target Steps: {max_steps} | LR: {learning_rate}")

    max_seq_length = 4096
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )

    # Standard Llama 3.3 chat template
    tokenizer = get_chat_template(
        tokenizer,
        chat_template="llama-3.1",
    )

    # Attach PEFT LoRA adapters across all 7 linear projections
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        lora_alpha=32,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
    )

    # Format training examples into ChatML text
    formatted_texts = []
    for line in dataset_lines:
        line = line.strip()
        if not line:
            continue
        data = json.loads(line)
        messages = data.get("messages", [])
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        formatted_texts.append(text)

    print(f"[V.I.S. v3 TRAINER] Formatted {len(formatted_texts)} sequences. Initializing SFTTrainer...")
    train_dataset = Dataset.from_dict({"text": formatted_texts})

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=train_dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=1,
            gradient_accumulation_steps=8,
            warmup_steps=10,
            max_steps=max_steps,
            learning_rate=learning_rate,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=5,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            seed=3407,
            output_dir="/tmp/vis_v3_output",
        ),
    )

    print("[V.I.S. v3 TRAINER] 🚀 Commencing 70B parameter QLoRA training run...")
    train_result = trainer.train()
    print(f"[V.I.S. v3 TRAINER] ✓ 70B Training completed: {train_result.metrics}")

    # Export directly to Q4_K_M GGUF format inside the persistent Modal Volume
    export_dir = f"{VAULT_MOUNT}/models/jarvis-sovereign-3"
    print(f"[V.I.S. v3 TRAINER] Exporting fused 70B model to Q4_K_M GGUF format at {export_dir}...")
    model.save_pretrained_gguf(export_dir, tokenizer, quantization_method="q4_k_m")

    # Locate generated GGUF file and establish canonical alias
    for root, _, files in os.walk(export_dir + "_gguf"):
        for f in files:
            if f.endswith(".gguf") and "Q4_K_M" in f:
                src_path = os.path.join(root, f)
                alias_path = f"{VAULT_MOUNT}/models/jarvis-sovereign-3.gguf"
                print(f"[V.I.S. v3 TRAINER] Found 70B GGUF artifact: {src_path} -> Establishing alias {alias_path}")
                if os.path.exists(alias_path):
                    os.remove(alias_path)
                shutil.copy2(src_path, alias_path)
                break

    vault_volume.commit()
    print(f"[V.I.S. v3 TRAINER] 🎉 Milestone complete. jarvis-sovereign-3.gguf committed to 'jarvis-vault' volume!")
    return train_result.metrics


@app.local_entrypoint()
def main(
    dataset_path: str = "data/distill/v3_70b/train_master_v3_unified.jsonl",
    fallback_v3_path: str = "data/distill/v3_70b/train_master_v3.jsonl",
    fallback_v2_path: str = "data/distill/v2_agentic/train_master_v2.jsonl",
    max_steps: int = 120,
):
    target_path = dataset_path if os.path.exists(dataset_path) else (fallback_v3_path if os.path.exists(fallback_v3_path) else fallback_v2_path)
    if not os.path.exists(target_path):
        print(f"Error: No valid dataset found.")
        sys.exit(1)

    with open(target_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    print(f"[V.I.S. v3 Local Entrypoint] Loaded {len(lines)} trajectories from {target_path}.")
    print(f"[V.I.S. v3 Local Entrypoint] Dispatching 70B training job to Modal A100-80GB GPU...")

    metrics = train_and_export_vis_v3.remote(dataset_lines=lines, max_steps=max_steps)
    print(f"[V.I.S. v3 Local Entrypoint] 70B Job returned successfully! Metrics: {metrics}")
