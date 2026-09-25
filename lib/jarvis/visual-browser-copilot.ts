/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. — "Ghost in the Machine" Autonomous Visual Browser Copilot
 * 
 * Stage 6 Sovereign Capability (Vector 3):
 * 1. Takes a high-level operational browser mission from Sir.
 * 2. Launches headless Playwright Chromium on the GCP Runner VM.
 * 3. Autonomous Vision-Action Loop:
 *    - Captures high-res viewport screenshot.
 *    - Extracts interactive DOM nodes (buttons, inputs, links, forms).
 *    - Gemini 3.8 / 3.7 Strategic Mind visually inspects the screen and formulates next micro-actions
 *      (CLICK, TYPE, PRESS_KEY, SCROLL, NAVIGATE, COMPLETE).
 * 4. Dispatches the verified visual screenshot directly to Sir's Telegram channel with an executive briefing.
 * 
 * Enforces Directive 01 (Guardian Protocol), Directive 04 (Sovereign Loyalty), and Directive 06 (Zero-Thrashing).
 */

import { callVertexAIGenerate, isVertexAIAvailable } from './vertex';
import { telegramGateway } from './telegram';

export interface VisualBrowserMissionRequest {
  initialUrl: string;
  goal: string;
  maxSteps?: number;
  sendTelegramScreenshot?: boolean;
}

export interface VisualBrowserStepAction {
  step: number;
  action: 'CLICK' | 'TYPE' | 'PRESS_KEY' | 'SCROLL' | 'NAVIGATE' | 'COMPLETE';
  selector?: string;
  textToType?: string;
  key?: string;
  scrollDirection?: 'DOWN' | 'UP';
  urlToNavigate?: string;
  rationale: string;
}

export interface VisualBrowserMissionResult {
  success: boolean;
  goal: string;
  finalUrl: string;
  pageTitle: string;
  stepsExecuted: number;
  findings: string;
  screenshotBase64?: string;
  telegramDispatched: boolean;
  executionTimeMs: number;
  error?: string;
}

/**
 * Extracts interactive elements from current page DOM
 */
async function extractInteractiveElements(page: any): Promise<Array<{ index: number; tag: string; text: string; selector: string; ariaLabel?: string }>> {
  try {
    return await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="link"], [role="searchbox"]')
      );

      const items: Array<{ index: number; tag: string; text: string; selector: string; ariaLabel?: string }> = [];
      let idx = 0;

      for (const el of candidates) {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        // Skip invisible or collapsed elements
        if (rect.width === 0 || rect.height === 0 || htmlEl.style.display === 'none' || htmlEl.style.visibility === 'hidden') {
          continue;
        }

        const tag = htmlEl.tagName.toLowerCase();
        const text = (htmlEl.innerText || (htmlEl as HTMLInputElement).value || (htmlEl as HTMLInputElement).placeholder || '').trim().slice(0, 80);
        const ariaLabel = htmlEl.getAttribute('aria-label') || undefined;

        let selector = '';
        if (htmlEl.id) {
          selector = `#${htmlEl.id}`;
        } else if (htmlEl.getAttribute('name')) {
          selector = `${tag}[name="${htmlEl.getAttribute('name')}"]`;
        } else if (htmlEl.getAttribute('data-testid')) {
          selector = `[data-testid="${htmlEl.getAttribute('data-testid')}"]`;
        } else if (text && tag === 'button') {
          selector = `button:has-text("${text.slice(0, 30)}")`;
        } else if (text && tag === 'a') {
          selector = `a:has-text("${text.slice(0, 30)}")`;
        } else {
          selector = tag;
        }

        items.push({ index: idx++, tag, text, selector, ariaLabel });
        if (items.length >= 35) break; // Limit payload
      }

      return items;
    });
  } catch {
    return [];
  }
}

/**
 * Executes an autonomous visual browser mission
 */
export async function executeVisualBrowserMission(
  request: VisualBrowserMissionRequest
): Promise<VisualBrowserMissionResult> {
  const startTime = Date.now();
  const maxSteps = Math.min(request.maxSteps || 6, 8); // Safe bound (Directive 06)
  const sendTelegram = request.sendTelegramScreenshot !== false; // Default true

  console.log(`[Visual Browser Copilot] 👻 Launching mission: "${request.goal}" at ${request.initialUrl}...`);

  let chromium: any;
  try {
    const pw = await import(/* webpackIgnore: true */ 'playwright-chromium');
    chromium = pw.chromium;
  } catch (err: any) {
    throw new Error(`Playwright Chromium is unavailable on this substrate: ${err.message}`);
  }

  // Launch lightweight headless browser instance (Directive 06: Zero Thrashing)
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
    ],
  });

  let lastScreenshotBuffer: Buffer | null = null;
  let finalFindings = '';
  let stepsCount = 0;
  let finalTitle = '';
  let finalUrl = request.initialUrl;

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 JARVIS-Copilot',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    // Initial navigation
    console.log(`[Visual Browser Copilot] 🌐 Navigating to ${request.initialUrl}...`);
    await page.goto(request.initialUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500); // Allow hydration

    while (stepsCount < maxSteps) {
      stepsCount++;
      finalUrl = page.url();
      finalTitle = await page.title();

      console.log(`[Visual Browser Copilot] 📸 Step ${stepsCount}/${maxSteps}: Inspecting viewport (${finalTitle})...`);

      // 1. Capture high-res viewport screenshot
      const currentScreenshot = await page.screenshot({ fullPage: false });
      lastScreenshotBuffer = currentScreenshot;
      const base64Screenshot = currentScreenshot.toString('base64');

      // 2. Extract clickable DOM candidates
      const interactiveElements = await extractInteractiveElements(page);

      // 3. Consult Gemini 3.8 / 3.7 Strategic Mind (Vision + Multimodal Multiturn Reasoning)
      const promptText = `You are F.R.I.D.A.Y., Staff Visual Browser Copilot.
You are autonomously piloting a headless browser session to accomplish Sir's mission.

### MISSION OBJECTIVE:
"${request.goal}"

### CURRENT STATE:
- Step: ${stepsCount} of ${maxSteps}
- Current URL: ${finalUrl}
- Page Title: ${finalTitle}

### VISIBLE INTERACTIVE DOM ELEMENTS:
${interactiveElements.map((el) => `[#${el.index}] <${el.tag}> "${el.text}" ${el.ariaLabel ? `(aria: "${el.ariaLabel}")` : ''} -> selector: \`${el.selector}\``).join('\n')}

### INSTRUCTIONS:
Visually inspect the attached screenshot of the webpage and determine the next optimal action.
If the objective is satisfied, or the necessary information is visible on screen, output action "COMPLETE" with your detailed findings.

Output strictly valid JSON matching this schema:
{
  "action": "CLICK" | "TYPE" | "PRESS_KEY" | "SCROLL" | "NAVIGATE" | "COMPLETE",
  "selector": "CSS selector to click or fill (if applicable)",
  "textToType": "string to type (if action is TYPE)",
  "key": "Enter" | "Escape" | "ArrowDown" (if action is PRESS_KEY),
  "scrollDirection": "DOWN" | "UP" (if action is SCROLL),
  "urlToNavigate": "URL string (if action is NAVIGATE)",
  "findings": "Detailed findings and answer for Sir (REQUIRED if COMPLETE)",
  "rationale": "1 sentence explanation of why you chose this step"
}
Output ONLY the JSON object. Zero markdown conversational fluff.`;

      const aiRes = await callVertexAIGenerate({
        model: 'gemini-3.7-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Screenshot,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 1024 },
        },
        signal: AbortSignal.timeout(30000),
      });

      let plan: any = null;
      if (aiRes.ok) {
        const data = await aiRes.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        try {
          plan = JSON.parse(cleanJson);
        } catch (parseErr) {
          console.warn('[Visual Browser Copilot] Plan JSON parse warning:', parseErr);
        }
      }

      if (!plan || !plan.action) {
        console.warn('[Visual Browser Copilot] ⚠️ No deterministic action from vision core. Concluding mission.');
        finalFindings = `Inspected ${finalUrl} (${finalTitle}). Visual capture complete.`;
        break;
      }

      console.log(`[Visual Browser Copilot] ⚡ Step ${stepsCount} Decision: [${plan.action}] - ${plan.rationale}`);

      // 4. Execute Planned Micro-Action
      if (plan.action === 'COMPLETE') {
        finalFindings = plan.findings || plan.rationale || 'Mission objective achieved.';
        break;
      } else if (plan.action === 'CLICK' && plan.selector) {
        try {
          await page.click(plan.selector, { timeout: 6000 });
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await page.waitForTimeout(1000);
        } catch (clickErr: any) {
          console.warn(`[Visual Browser Copilot] Click on "${plan.selector}" failed:`, clickErr.message);
        }
      } else if (plan.action === 'TYPE' && plan.selector && plan.textToType) {
        try {
          await page.fill(plan.selector, plan.textToType, { timeout: 6000 });
          await page.waitForTimeout(500);
        } catch (typeErr: any) {
          console.warn(`[Visual Browser Copilot] Fill on "${plan.selector}" failed:`, typeErr.message);
        }
      } else if (plan.action === 'PRESS_KEY' && plan.key) {
        try {
          await page.keyboard.press(plan.key);
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await page.waitForTimeout(1200);
        } catch {}
      } else if (plan.action === 'SCROLL') {
        const delta = plan.scrollDirection === 'UP' ? -600 : 600;
        await page.mouse.wheel(0, delta);
        await page.waitForTimeout(800);
      } else if (plan.action === 'NAVIGATE' && plan.urlToNavigate) {
        await page.goto(plan.urlToNavigate, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);
      }
    }

    if (!finalFindings) {
      finalFindings = `Executed ${stepsCount} browser steps across ${finalUrl}. Review screenshot for visual evidence.`;
    }

    // Capture final verified state
    lastScreenshotBuffer = await page.screenshot({ fullPage: false });

    // 5. Dispatch Live Screenshot to Telegram Channel
    let telegramDispatched = false;
    if (sendTelegram && lastScreenshotBuffer) {
      try {
        const authChatId = process.env.TELEGRAM_AUTHORIZED_CHAT_ID || '864360540';
        const caption =
          `👻 *[GHOST IN THE MACHINE — VISUAL BROWSER COPILOT]*\n\n` +
          `🎯 **Mission**: _${request.goal}_\n` +
          `🌐 **URL**: \`${finalUrl}\`\n` +
          `📑 **Title**: *${finalTitle}*\n` +
          `⚙️ **Steps**: ${stepsCount} actions executed\n\n` +
          `🔍 **Findings**:\n${finalFindings.slice(0, 700)}`;

        telegramDispatched = await telegramGateway.sendPhoto(authChatId, lastScreenshotBuffer, {
          caption,
          parseMode: 'Markdown',
        });
        console.log(`[Visual Browser Copilot] 📱 Real screenshot photo dispatched to Telegram chat ${authChatId}`);
      } catch (tgErr) {
        console.warn('[Visual Browser Copilot] Telegram photo dispatch warning:', tgErr);
      }
    }

    return {
      success: true,
      goal: request.goal,
      finalUrl,
      pageTitle: finalTitle,
      stepsExecuted: stepsCount,
      findings: finalFindings,
      screenshotBase64: lastScreenshotBuffer ? `data:image/png;base64,${lastScreenshotBuffer.toString('base64').slice(0, 100)}...` : undefined,
      telegramDispatched,
      executionTimeMs: Date.now() - startTime,
    };
  } finally {
    await browser.close().catch(() => {});
    console.log(`[Visual Browser Copilot] 🔒 Browser instance safely closed.`);
  }
}
