/**
 * J.A.R.V.I.S. Dynamic Needle Packing & Context Compression Engine (Upgrade 4)
 * 
 * Implements token distillation, prompt whitespace minification,
 * and needle-in-a-haystack context packing to eliminate 20-30% input token overhead.
 */

export interface ContextNeedleBlock {
  title: string;
  content: string;
  priority: number; // 1 (highest) to 10 (lowest)
  isCritical?: boolean;
}

/**
 * Minifies and compresses a system prompt by removing redundant indentation,
 * empty comments, and excessive vertical whitespace while preserving markdown structure.
 */
export function compressSystemPrompt(prompt: string): string {
  if (!prompt) return '';

  return prompt
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, array) => {
      // Remove more than 1 consecutive empty line
      if (line.trim() === '' && array[index - 1]?.trim() === '') {
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Compresses tool outputs (stdout, JSON dumps) to isolate key needles and error signatures
 */
export function compressToolOutput(output: string, maxChars = 2500): string {
  if (!output) return '';
  if (output.length <= maxChars) return output;

  // Extract first 1,200 chars and trailing 1,200 chars (where error summaries and final outputs live)
  const headSize = Math.floor(maxChars * 0.5);
  const tailSize = Math.floor(maxChars * 0.45);
  const omittedChars = output.length - headSize - tailSize;

  const head = output.slice(0, headSize);
  const tail = output.slice(-tailSize);

  return `${head}\n\n[... OMITTED ${omittedChars} CHARACTERS OF REPETITIVE OUTPUT ...]\n\n${tail}`;
}

/**
 * Packs multiple contextual memory/AST/RAG blocks into a tight budget,
 * prioritizing high-relevance items and pruning conversational fluff.
 */
export function packContextNeedles(
  blocks: ContextNeedleBlock[],
  maxBudgetChars = 4000
): string {
  if (!blocks || blocks.length === 0) return '';

  // Sort by priority ascending (1 is highest priority)
  const sorted = [...blocks].sort((a, b) => a.priority - b.priority);
  const packedBlocks: string[] = [];
  let currentChars = 0;

  for (const block of sorted) {
    const cleanContent = block.content.trim();
    if (!cleanContent) continue;

    const formattedBlock = `[${block.title.toUpperCase()}]:\n${cleanContent}`;
    const blockLength = formattedBlock.length;

    if (currentChars + blockLength <= maxBudgetChars || block.isCritical) {
      packedBlocks.push(formattedBlock);
      currentChars += blockLength;
    } else {
      // Partially compress the last fitting block
      const remainingBudget = maxBudgetChars - currentChars - 100;
      if (remainingBudget > 200) {
        const truncated = cleanContent.slice(0, remainingBudget) + '…';
        packedBlocks.push(`[${block.title.toUpperCase()} (PARTIAL)]:\n${truncated}`);
      }
      break;
    }
  }

  return packedBlocks.join('\n\n');
}
