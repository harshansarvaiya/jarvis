/**
 * Test Harness for Dual-Citizen Shared State Bus (Concept 1)
 */

import {
  publishStateEvent,
  getRecentStateEvents,
  onStateEvent,
  StateBusEvent,
} from '../lib/jarvis/state-bus';

async function main() {
  console.log('--- [STATE BUS HARNESS TEST INITIALIZED] ---');

  let localEventReceived = false;
  const unsubscribe = onStateEvent((ev: StateBusEvent) => {
    console.log(`[TEST IN-MEMORY LISTENER] Captured Event: [${ev.source.toUpperCase()}] ${ev.title}`);
    localEventReceived = true;
  });

  const testEvent = await publishStateEvent({
    type: 'agent:action',
    source: 'friday',
    channel: 'antigravity',
    title: 'Dual-Citizen State Bus Live Integration Test',
    detail: 'Simulated atomic mutation from F.R.I.D.A.Y. Apex Mind',
    payload: { testId: 'harness-001', success: true },
  });

  console.log(`[TEST PUBLISH] Dispatched event ID: ${testEvent.id}`);

  // Fetch recent events from stream
  const recent = await getRecentStateEvents(5);
  console.log(`[TEST RETRIEVE] Found ${recent.length} recent events.`);
  const match = recent.find((e) => e.id === testEvent.id);

  if (!match) {
    throw new Error('Test event not found in retrieved stream!');
  }
  console.log(`[TEST VERIFY] Found matching event in persistent stream: ${match.title}`);

  if (!localEventReceived) {
    throw new Error('In-memory listener did not fire!');
  }
  console.log('[TEST VERIFY] In-memory listener fired successfully.');

  unsubscribe();
  console.log('--- [STATE BUS HARNESS PASSED 100% CLEAN] ---');
}

main().catch((err) => {
  console.error('State bus test failed:', err);
  process.exit(1);
});
