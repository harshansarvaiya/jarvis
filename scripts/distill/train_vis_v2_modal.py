"""
J.A.R.V.I.S. Mark II — V.I.S. v2 Fine-Tuning Pipeline (Unsloth on Modal Serverless GPU)
Automates QLoRA training on Meta Llama-3.2-3B-Instruct and directly exports
4-bit quantized GGUF weights into the persistent 'jarvis-vault' Modal Volume.
"""

import os
import sys
import modal

app = modal.App("vis-trainer")

# Persistent volume storing models and datasets
vault_volume = modal.Volume.from_name("jarvis-vault")
VAULT_MOUNT = "/vault"

# Build optimized training image with Unsloth and PyTorch CUDA 12.4
image = (
    modal.Image.debian_slim(python_version="3.10")
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
    gpu="A10G",  # Fast 24GB NVIDIA A10G GPU for efficient QLoRA
    volumes={VAULT_MOUNT: vault_volume},
    timeout=3600,  # 1 hour maximum execution budget
)
def train_and_export_vis_v2(
    dataset_lines: list[str],
    max_steps: int = 120,
    learning_rate: float = 2e-4,
    model_name: str = "unsloth/Llama-3.2-3B-Instruct-bnb-4bit",
):
    import json
    import torch
    from datasets import Dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template

    print(f"[V.I.S. TRAINER] Received {len(dataset_lines)} trajectories for training.")
    print(f"[V.I.S. TRAINER] Base Model: {model_name} | Target Steps: {max_steps} | LR: {learning_rate}")

    max_seq_length = 4096
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )

    # Configure standard Llama-3 chat template
    tokenizer = get_chat_template(
        tokenizer,
        chat_template="llama-3.1",
    )

    # Attach PEFT LoRA adapters
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

    # Format training examples into formatted ChatML text
    formatted_texts = []
    for line in dataset_lines:
        line = line.strip()
        if not line:
            continue
        data = json.loads(line)
        messages = data.get("messages", [])
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        formatted_texts.append(text)

    print(f"[V.I.S. TRAINER] Formatted {len(formatted_texts)} sequences. Initializing SFTTrainer...")
    train_dataset = Dataset.from_dict({"text": formatted_texts})

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            warmup_ratio=0.05,
            max_steps=max_steps,
            learning_rate=learning_rate,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=5,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            seed=3407,
            output_dir="/tmp/vis_output",
        ),
    )

    print("[V.I.S. TRAINER] 🚀 Commencing QLoRA training run...")
    train_result = trainer.train()
    print(f"[V.I.S. TRAINER] ✓ Training completed: {train_result.metrics}")

    # Export directly to GGUF inside the persistent Modal Volume
    export_dir = f"{VAULT_MOUNT}/models/jarvis-sovereign-2"
    print(f"[V.I.S. TRAINER] Exporting fused model directly to Q4_K_M GGUF format at {export_dir}...")
    model.save_pretrained_gguf(export_dir, tokenizer, quantization_method="q4_k_m")

    # Locate generated GGUF file and establish standard alias
    for root, _, files in os.walk(export_dir):
        for f in files:
            if f.endswith(".gguf"):
                src_path = os.path.join(root, f)
                alias_path = f"{VAULT_MOUNT}/models/jarvis-sovereign-2.gguf"
                print(f"[V.I.S. TRAINER] Found GGUF artifact: {src_path} -> Linking to {alias_path}")
                if os.path.exists(alias_path):
                    os.remove(alias_path)
                os.link(src_path, alias_path) if hasattr(os, "link") else None
                break

    vault_volume.commit()
    print(f"[V.I.S. TRAINER] 🎉 Milestone complete. jarvis-sovereign-2.gguf committed to 'jarvis-vault' volume!")
    return train_result.metrics


@app.local_entrypoint()
def main(dataset_path: str = "data/distill/v2_agentic/train_master_v2.jsonl", max_steps: int = 80):
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset file not found at {dataset_path}")
        sys.exit(1)

    with open(dataset_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    print(f"[V.I.S. Local Entrypoint] Loaded {len(lines)} trajectories from {dataset_path}.")
    print(f"[V.I.S. Local Entrypoint] Dispatching serverless training job to Modal A10G GPU...")

    metrics = train_and_export_vis_v2.remote(dataset_lines=lines, max_steps=max_steps)
    print(f"[V.I.S. Local Entrypoint] Job returned successfully! Metrics: {metrics}")
