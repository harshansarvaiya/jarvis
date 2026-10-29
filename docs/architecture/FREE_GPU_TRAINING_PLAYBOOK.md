# ⚡ J.A.R.V.I.S. Mark II — Free Cloud GPU Training Playbook (Path 2)
## 100% Free Distillation Execution via Google Colab & Kaggle

> [!IMPORTANT]
> **Cost**: **$0.00** (Zero credit card or billing accounts required)  
> **Hardware**: Free NVIDIA T4 GPU (16GB VRAM)  
> **Runtime**: ~35–45 minutes using Unsloth 4-bit acceleration  
> **Target Output**: `jarvis-sovereign-1-Q4_K_M.gguf` (Runs locally in Ollama / llama.cpp)

---

## 🚀 Option 1: 1-Click Google Colab (Fastest)

### Step 1: Open the Notebook in Google Colab
Click the badge below to open our pre-configured notebook directly from GitHub:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/harshans279/jarvis/blob/main/scripts/distill/train_arc_colab.ipynb)

*(Direct URL: `https://colab.research.google.com/github/harshans279/jarvis/blob/main/scripts/distill/train_arc_colab.ipynb`)*

### Step 2: Set Runtime to GPU
1. In Colab, go to **Runtime > Change runtime type**.
2. Under **Hardware accelerator**, select **T4 GPU**.
3. Click **Save**.

### Step 3: Run the Cells
1. **Cell 1 & 2**: Installs Unsloth and PyTorch dependencies (~2 minutes).
2. **Cell 3**: Downloads `unsloth/Llama-3.2-3B-Instruct` in 4-bit NF4 with LoRA adapters ($r=64$).
3. **Cell 4**: Prompts you to upload `train_master_arc.jsonl` (the 1.5MB dataset file).
4. **Cell 5**: Trains the model on your 1,017 samples using SFTTrainer (~30 minutes).
5. **Cell 6**: Tests local inference with Sir's persona.
6. **Cell 7 & 8**: Exports the model as a `Q4_K_M` GGUF file and saves it directly to your Google Drive or local download!

---

## 🏆 Option 2: Google Kaggle (Up to 30 Hours/Week Free GPU)

If you prefer Kaggle (which allows background execution without browser disconnects):

1. Go to **[Kaggle Notebooks](https://www.kaggle.com/code)** and click **"New Notebook"**.
2. In the right-hand panel under **Settings**:
   - Turn **Internet** to **ON**.
   - Change **Accelerator** to **GPU T4 x2**.
3. In the first code cell, paste and run:
   ```bash
   !git clone https://github.com/harshans279/jarvis.git
   %cd jarvis
   !pip install --upgrade --no-cache-dir "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
   !pip install --upgrade --no-deps "xformers<0.0.29" "trl<0.9.0" peft accelerate bitsandbytes
   !cp data/distill/export/train_master_arc.jsonl .
   !python3 scripts/distill/kaggle_train.py
   ```
4. Click **Run All** (or **Save Version > Save & Run All (Commit)** to let it run in the cloud background).
5. Once complete, download `jarvis_sovereign_1_gguf/` from the Kaggle Output tab.

---

## 💻 Running Your Finished Model Locally in Ollama

Once you download your `jarvis-sovereign-1-Q4_K_M.gguf` file to your laptop:

1. Create a file named `Modelfile`:
   ```dockerfile
   FROM ./jarvis-sovereign-1-Q4_K_M.gguf

   TEMPLATE """{{ if .System }}<|im_start|>system
   {{ .System }}<|im_end|>
   {{ end }}{{ if .Prompt }}<|im_start|>user
   {{ .Prompt }}<|im_end|>
   {{ end }}<|im_start|>assistant
   {{ .Response }}<|im_end|>"""

   PARAMETER stop "<|im_start|>"
   PARAMETER stop "<|im_end|>"
   PARAMETER temperature 0.3
   ```

2. Register and run it:
   ```bash
   ollama create jarvis -f Modelfile
   ollama run jarvis "Jarvis, report status."
   ```

You now possess a **100% sovereign, air-gapped 3-billion-parameter personal cognitive exoskeleton** running locally at 110+ tokens/second with zero external API dependencies!
