#!/usr/bin/env python3
"""
J.A.R.V.I.S. Mark II — Project A.R.C.
Kaggle GPU Runner Script (100% Free 30hrs/week T4 GPU)

Usage in Kaggle Notebook:
1. Turn on GPU accelerator (Settings -> Accelerator -> GPU T4 x2)
2. Run: !python3 kaggle_train.py --train_file train_master_arc.jsonl
"""

import os
import sys
import torch
from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments

def main():
    print("==================================================================")
    print("⚡ J.A.R.V.I.S. Mark II — Kaggle Free GPU Distillation Runner")
    print("==================================================================")
    
    device_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    print(f"• Active GPU: {device_name}")
    print(f"• Target Lineage: unsloth/Llama-3.2-3B-Instruct")

    max_seq_length = 2048
    load_in_4bit = True

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = "unsloth/Llama-3.2-3B-Instruct",
        max_seq_length = max_seq_length,
        dtype = None,
        load_in_4bit = load_in_4bit,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r = 64,
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha = 128,
        lora_dropout = 0,
        bias = "none",
        use_gradient_checkpointing = "unsloth",
        random_state = 3407,
    )

    train_file = "train_master_arc.jsonl"
    if not os.path.exists(train_file):
        print(f"❌ Error: {train_file} not found in working directory.")
        return

    dataset = load_dataset("json", data_files={"train": train_file})

    def formatting_prompts_func(examples):
        convos = examples["messages"]
        texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in convos]
        return { "text" : texts }

    formatted_dataset = dataset["train"].map(formatting_prompts_func, batched = True)

    trainer = SFTTrainer(
        model = model,
        tokenizer = tokenizer,
        train_dataset = formatted_dataset,
        dataset_text_field = "text",
        max_seq_length = max_seq_length,
        dataset_num_proc = 2,
        packing = False,
        args = TrainingArguments(
            per_device_train_batch_size = 4,
            gradient_accumulation_steps = 4,
            warmup_steps = 10,
            max_steps = 300,
            learning_rate = 2e-4,
            fp16 = not torch.cuda.is_bf16_supported(),
            bf16 = torch.cuda.is_bf16_supported(),
            logging_steps = 20,
            optim = "adamw_8bit",
            weight_decay = 0.01,
            lr_scheduler_type = "linear",
            seed = 3407,
            output_dir = "outputs",
        ),
    )

    print("🚀 Commencing Distillation Training...")
    trainer.train()

    print("💾 Exporting 4-bit GGUF for local deployment...")
    model.save_pretrained_gguf("jarvis_sovereign_1_gguf", tokenizer, quantization_method = "q4_k_m")
    print("✅ Model trained and exported to GGUF format successfully!")

if __name__ == "__main__":
    main()
