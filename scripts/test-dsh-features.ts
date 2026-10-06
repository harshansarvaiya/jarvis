/**
 * Automated Verification Script for DeepSeek Harness-Inspired Features:
 * 1. Text Spill Subsystem (dsh-spill)
 * 2. Loop Hygiene Guard (repeat-tool-reminder)
 * 3. Workspace Deliverables & Diff Recorder (deliverables / tool-present)
 * 4. PTC Runtime Execution (ptc-runtime)
 */

import { createSpillIfNeeded, readSpill, saveTextSpill } from '../lib/jarvis/spill';
import { LoopHygieneGuard } from '../lib/jarvis/loop-guard';
import { captureWorkspaceBaseline, computeWorkspaceChanges, presentDeliverables } from '../lib/jarvis/deliverables';
import { executePtcScript } from '../lib/jarvis/ptc-runtime';
import { executeJarvisTool } from '../lib/jarvis/tools';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING DEEPSEEK HARNESS-INSPIRED ARCHITECTURAL SUBSYSTEMS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, details || '');
      failed++;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Text Spill Subsystem
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST SUITE 1: Text Spill Subsystem ---');
  const smallText = 'Hello Sir, this is short text that fits in context.';
  const smallCheck = createSpillIfNeeded(smallText, 200, 10);
  assert(!smallCheck.isSpilled, 'Small text is NOT spilled');

  const largeArray = Array.from({ length: 150 }, (_, i) => `Line ${i + 1}: Trace event timestamp=${Date.now()} status=OK data=sample`);
  const largeText = largeArray.join('\n');
  const largeCheck = createSpillIfNeeded(largeText, 500, 50, { sourceTool: 'test_tool' });

  assert(largeCheck.isSpilled, 'Large text is spilled to disk');
  assert(!!largeCheck.spillRef, 'SpillRef generated');
  assert(largeCheck.spillRef?.totalLines === 150, 'SpillRef records 150 lines');
  assert(largeCheck.content.includes('SPILL OVERFLOW'), 'Spill preview shows overflow indicator');

  if (largeCheck.spillRef) {
    const sliceRes = readSpill(largeCheck.spillRef.spillId, { startLine: 10, endLine: 15 });
    assert(sliceRes.success, 'readSpill slice succeeded');
    assert(!!sliceRes.data?.includes('10: Line 10:'), 'readSpill slice contains Line 10');
    assert(!!sliceRes.data?.includes('15: Line 15:'), 'readSpill slice contains Line 15');

    const searchRes = readSpill(largeCheck.spillRef.spillId, { searchPattern: 'Line 42' });
    assert(searchRes.success, 'readSpill pattern search succeeded');
    assert(!!searchRes.data?.includes('42: Line 42:'), 'readSpill found Line 42');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Loop Hygiene Guard
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 2: Loop Hygiene Guard ---');
  const guard = new LoopHygieneGuard();

  const call1 = guard.inspectProposedCall('cloud_execute_command', { command: 'git status' });
  assert(call1.actionToTake === 'ALLOW', 'Call 1 allowed');

  const call2 = guard.inspectProposedCall('cloud_execute_command', { command: 'git status' });
  assert(call2.actionToTake === 'WARN', 'Call 2 warned (consecutive repeat)');
  assert(call2.advisoryGuidance?.includes('LOOP HYGIENE ADVISORY') || false, 'Advisory guidance generated');

  const call3 = guard.inspectProposedCall('cloud_execute_command', { command: 'git status' });
  assert(call3.actionToTake === 'INTERCEPT', 'Call 3 intercepted (3rd identical call)');
  assert(call3.interceptionMessage?.includes('LOOP HYGIENE GUARD INTERCEPTION') || false, 'Interception message returned');

  guard.reset();
  const callAfterReset = guard.inspectProposedCall('cloud_execute_command', { command: 'git status' });
  assert(callAfterReset.actionToTake === 'ALLOW', 'Guard reset restores ALLOW state');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Workspace Deliverables & Diff Recorder
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 3: Workspace Deliverables & Diff Recorder ---');
  const baseline = await captureWorkspaceBaseline();
  assert(!!baseline.headCommit, 'Workspace baseline captured HEAD commit');

  const changes = await computeWorkspaceChanges(baseline);
  assert(typeof changes.changedFilesCount === 'number', 'Workspace changes computed');

  const presResult = await presentDeliverables([
    {
      path: 'lib/jarvis/spill.ts',
      title: 'Context Spill Subsystem',
      description: 'Prevents context bloat by offloading oversized logs to scratch disk.',
      category: 'FEATURE',
    },
    {
      path: 'lib/jarvis/loop-guard.ts',
      title: 'Loop Hygiene Guard',
      description: 'Intercepts deterministic retry loops and cyclic agent thrashing.',
      category: 'FEATURE',
    },
  ], 'turn-test-1');

  assert(presResult.success, 'presentDeliverables succeeded');
  assert(presResult.formattedCard.includes('Verified Deliverables Manifest'), 'Deliverables manifest card formatted');
  assert(presResult.formattedCard.includes('Context Spill Subsystem'), 'Card includes deliverable titles');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: PTC Runtime Execution
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 4: PTC Runtime Engine ---');
  const ptcScript = `
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const files = fs.readdirSync('lib/jarvis').filter(f => f.endsWith('.ts'));
    return {
      appName: pkg.name,
      jarvisModuleCount: files.length,
      sampleFile: files[0]
    };
  `;

  const ptcResult = await executePtcScript({
    script: ptcScript,
    intent: 'Inspect package.json and count jarvis modules in a single programmatic step',
  });

  assert(ptcResult.success, 'executePtcScript succeeded');
  assert(ptcResult.returnValue?.appName === 'jarvis-mark-2', 'PTC returned parsed JSON return value');
  assert(typeof ptcResult.returnValue?.jarvisModuleCount === 'number', 'PTC counted files correctly');
  assert(ptcResult.executionDurationMs < 5000, 'PTC executed quickly');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Integrated Tool Dispatcher (executeJarvisTool)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST SUITE 5: Tool Dispatcher Integration ---');
  const spillToolRes = await executeJarvisTool('read_spill', {
    spillId: largeCheck.spillRef?.spillId || 'invalid',
    startLine: 1,
    maxLines: 5,
  });
  assert(spillToolRes.success, 'executeJarvisTool("read_spill") succeeded');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
