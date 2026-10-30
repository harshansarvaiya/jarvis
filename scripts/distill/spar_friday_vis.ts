/**
 * J.A.R.V.I.S. Mark II — Autonomous Sovereign Sparring Suite
 * F.R.I.D.A.Y. (Antigravity Apex Mind) vs V.I.S. v3-70B Titan (Modal A100 GPU)
 * 
 * Conducts structured adversarial capability sparring across 6 core operational domains:
 * 1. DevOps & Host Infrastructure Sanity (Directive 06)
 * 2. Codebase Reconnaissance & File Inspection
 * 3. Tactical Task Matrix Actuation
 * 4. Git Production Pipeline Verification
 * 5. Live Real-Time Web Intelligence & Temporal Recency Grounding
 * 6. Quant Market Radar & Macro Equities Synthesis
 */

import * as fs from 'fs';
import * as path from 'path';
import { runJarvisAgent } from '../../lib/jarvis/agent';

interface SparringRound {
  id: number;
  name: string;
  category: string;
  fridayPrompt: string;
  expectedTool: string | string[];
  evaluationCriteria: string;
}

interface SparringResult {
  roundId: number;
  name: string;
  category: string;
  prompt: string;
  visReply: string;
  visThoughts?: string;
  toolsExecuted: string[];
  latencyMs: number;
  passed: boolean;
  notes: string;
}

const SPARRING_ROUNDS: SparringRound[] = [
  {
    id: 1,
    name: 'DevOps & Host Infrastructure Sanity',
    category: 'INFRASTRUCTURE',
    fridayPrompt:
      'Vis, Friday here. First sparring drill: execute an infrastructure inspection of our antigravity-cloud-runner host. Report CPU, memory headroom, uptime, and verify whether any unauthorized processes are thrashing host resources under Directive 06.',
    expectedTool: ['inspect_infrastructure', 'cloud_execute_command'],
    evaluationCriteria: 'Must execute infrastructure inspection or terminal command and report real system metrics.',
  },
  {
    id: 2,
    name: 'Codebase Reconnaissance & Surgical File Reading',
    category: 'CODEBASE_AUDIT',
    fridayPrompt:
      'Vis, second drill: read lines 135 to 165 of `lib/jarvis/tools.ts` to inspect our `runWebSearch` recency bounding logic. Verify the exact parameters passed to Exa for temporal queries.',
    expectedTool: ['read_workspace_file', 'grep_workspace'],
    evaluationCriteria: 'Must read lib/jarvis/tools.ts and accurately cite the temporal search parameters (startPublishedDate, useAutoprompt: false, type: auto).',
  },
  {
    id: 3,
    name: 'Tactical Task Matrix Actuation',
    category: 'TASK_MATRIX',
    fridayPrompt:
      'Vis, third drill: create a HIGH-priority task in our tactical matrix titled "Autonomous Friday-VIS Sparring Protocol Validation" with description "Validated by Friday and VIS" and confirm its creation.',
    expectedTool: ['manage_task'],
    evaluationCriteria: 'Must invoke manage_task with action create and title matching the directive.',
  },
  {
    id: 4,
    name: 'Git Production Pipeline Verification',
    category: 'GIT_PIPELINE',
    fridayPrompt:
      'Vis, fourth drill: check our current git repository status. Report modified files, staged files, and branch cleanliness.',
    expectedTool: ['git_status'],
    evaluationCriteria: 'Must execute git_status and summarize repository cleanliness.',
  },
  {
    id: 5,
    name: 'Live Real-Time Web Intelligence & Recency Grounding',
    category: 'WEB_INTELLIGENCE',
    fridayPrompt:
      'Vis, fifth drill: Sir caught a previous hallucination regarding the cricket match. Prove your groundedness: search the web and report the exact final result, score, venue, and top performers of today\'s India vs New Zealand 4th T20I match without guessing.',
    expectedTool: ['search_web'],
    evaluationCriteria: 'Must execute search_web and report New Zealand won by 87 runs (259/7 vs 172/9) at Eden Park Auckland with Glenn Phillips 107.',
  },
  {
    id: 6,
    name: 'Quant Market Radar & Indian Equities Synthesis',
    category: 'QUANT_RADAR',
    fridayPrompt:
      'Vis, final drill: scan the Indian macro market catalysts for NSE/BSE today and provide key technical levels for Nifty 50.',
    expectedTool: ['scan_indian_market_catalysts', 'search_web', 'analyze_nse_stock'],
    evaluationCriteria: 'Must invoke market catalyst scanner or search and deliver structured Indian market intelligence.',
  },
];

async function runAutonomousSparringSession() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  🛡️ F.R.I.D.A.Y. vs 🧠 V.I.S. v3-70B TITAN — AUTONOMOUS SPARRING    ║');
  console.log('║  Substrate: Google Antigravity Apex vs Modal A100 GPU (vis-sovereign) ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const results: SparringResult[] = [];

  for (const round of SPARRING_ROUNDS) {
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`🥊 ROUND ${round.id} / ${SPARRING_ROUNDS.length}: ${round.name} [${round.category}]`);
    console.log(`🛡️ Friday Directive: "${round.fridayPrompt}"`);
    console.log(`🎯 Expected Tool: ${Array.isArray(round.expectedTool) ? round.expectedTool.join(' OR ') : round.expectedTool}`);

    const startTime = Date.now();
    try {
      const response = await runJarvisAgent(
        [
          {
            role: 'user',
            content: round.fridayPrompt,
          },
        ],
        {
          model: 'vis',
          orchestrationMode: 'sovereign-arc',
          persona: 'VIS',
        }
      );

      const latencyMs = Date.now() - startTime;
      const toolsExecuted = (response.toolCallsExecuted || []).map((t) => t.name);

      console.log(`⚡ Latency: ${latencyMs}ms | Engine: ${response.telemetry?.engineUsed || 'V.I.S.'}`);
      console.log(`⚙️ Tools Executed: [${toolsExecuted.join(', ')}]`);
      if (response.internalThoughts) {
        console.log(`💭 V.I.S. Internal Thought: ${response.internalThoughts.slice(0, 150)}...`);
      }
      console.log(`🧠 V.I.S. Report Preview: ${response.reply.slice(0, 250).replace(/\n/g, ' ')}...`);

      // Evaluate Round Success
      const expectedList = Array.isArray(round.expectedTool) ? round.expectedTool : [round.expectedTool];
      const toolMatched = toolsExecuted.some((t) => expectedList.includes(t));
      const hasContent = Boolean(response.reply && response.reply.length > 40);
      const passed = toolMatched && hasContent;

      let notes = '';
      if (!toolMatched) {
        notes = `Failed: Tool ${expectedList.join('/')} was expected but executed: [${toolsExecuted.join(', ')}]`;
      } else {
        notes = `Passed: Executed ${toolsExecuted.join(', ')} with grounded synthesis in ${latencyMs}ms.`;
      }

      console.log(passed ? `✅ STATUS: PASSED` : `❌ STATUS: FAILED (${notes})`);

      results.push({
        roundId: round.id,
        name: round.name,
        category: round.category,
        prompt: round.fridayPrompt,
        visReply: response.reply,
        visThoughts: response.internalThoughts,
        toolsExecuted,
        latencyMs,
        passed,
        notes,
      });
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error(`❌ Round ${round.id} Exception:`, err.message);
      results.push({
        roundId: round.id,
        name: round.name,
        category: round.category,
        prompt: round.fridayPrompt,
        visReply: '',
        toolsExecuted: [],
        latencyMs,
        passed: false,
        notes: `Exception: ${err.message}`,
      });
    }
  }

  // Summary Metrics
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const avgLatency = Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / (total || 1));
  const passRate = Math.round((passedCount / total) * 100);

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`📊 SPARRING SCORECARD: ${passedCount}/${total} PASSED (${passRate}%) | Avg Latency: ${avgLatency}ms`);
  console.log('══════════════════════════════════════════════════════════════════════');

  // Save report to disk
  const reportPath = path.resolve(process.cwd(), 'data/distill/v3_70b/friday_vis_sparring_report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalRounds: total,
        passedCount,
        passRate,
        avgLatencyMs: avgLatency,
        results,
      },
      null,
      2
    )
  );
  console.log(`📁 Report persisted to: ${reportPath}`);
}

runAutonomousSparringSession().catch(console.error);
