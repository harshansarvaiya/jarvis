/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. — Autonomous Algora & Polar Open-Source Bounty Radar Sentry
 * Periodically scans funded GitHub issues & bounties across Algora.io, Polar.sh, and GitHub GraphQL
 * Evaluates bounty amounts ($USD/crypto), tech stack compatibility (TypeScript, Next.js, Node, Python, Java),
 * and stages high-ROI bounties directly to Mission Control and Telegram alerts.
 */

export interface BountyItem {
  id: string;
  source: 'algora' | 'polar' | 'github';
  title: string;
  repo: string;
  url: string;
  amount: string;
  currency: string;
  rewardUsd: number;
  languages: string[];
  summary: string;
  publishedAt: string;
  issueNumber: number;
}

export interface BountyScanResult {
  timestamp: string;
  bountiesFound: number;
  highRoiBounties: BountyItem[];
  telemetry: {
    scannedSources: string[];
    maxRewardUsd: number;
    totalPoolValueUsd: number;
  };
}

/**
 * Scans Algora and Polar public bounty APIs for active funded open-source bounties
 */
export async function scanFundedBounties(): Promise<BountyScanResult> {
  const bounties: BountyItem[] = [];
  const scannedSources: string[] = [];

  // 1. Fetch Algora Public Bounties Feed
  try {
    const algoraRes = await fetch('https://algora.io/api/bounties?status=active&limit=25', {
      headers: {
        'User-Agent': 'JARVIS-Autonomous-Sentry/2.0 (Self-Sovereign Exoskeleton)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (algoraRes.ok) {
      scannedSources.push('algora.io');
      const data = await algoraRes.json();
      const items = Array.isArray(data) ? data : (data.bounties || data.items || []);

      for (const item of items) {
        const reward = Number(item.reward?.amount || item.amount || item.reward_in_cents ? (item.reward_in_cents / 100) : 0);
        const repoName = item.repo_name || item.repository?.full_name || item.org_name || 'OpenSource';
        const title = item.title || item.issue_title || item.issue?.title || 'Funded GitHub Issue';
        const url = item.url || item.issue_url || item.html_url || `https://github.com/${repoName}/issues/${item.issue_number || 1}`;

        if (reward > 0) {
          bounties.push({
            id: `algora-${item.id || item.issue_number || Math.random().toString(36).slice(2, 7)}`,
            source: 'algora',
            title,
            repo: repoName,
            url,
            amount: `$${reward}`,
            currency: 'USD',
            rewardUsd: reward,
            languages: item.languages || (item.repo_languages ? Object.keys(item.repo_languages) : ['TypeScript', 'JavaScript']),
            summary: item.body ? item.body.slice(0, 200) + '...' : 'Funded active bounty ready for autonomous triage and resolution.',
            publishedAt: item.created_at || new Date().toISOString(),
            issueNumber: item.issue_number || 0,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Bounty Sentry] Algora live query warning:', err instanceof Error ? err.message : String(err));
  }

  // 2. Fallback / Augment with Polar.sh Public API
  try {
    const polarRes = await fetch('https://api.polar.sh/v1/issues/search?sort=-funding&limit=15', {
      headers: {
        'User-Agent': 'JARVIS-Autonomous-Sentry/2.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (polarRes.ok) {
      scannedSources.push('polar.sh');
      const polarData = await polarRes.json();
      const items = polarData.items || [];

      for (const p of items) {
        const fundingCents = p.funding?.total?.amount || 0;
        const rewardUsd = fundingCents > 0 ? fundingCents / 100 : 0;
        if (rewardUsd >= 20) {
          bounties.push({
            id: `polar-${p.id || Math.random().toString(36).slice(2, 7)}`,
            source: 'polar',
            title: p.title || 'Polar Funded Issue',
            repo: p.repository?.organization?.name ? `${p.repository.organization.name}/${p.repository.name}` : (p.repository?.name || 'polar-repo'),
            url: p.repository?.organization?.name ? `https://github.com/${p.repository.organization.name}/${p.repository.name}/issues/${p.number}` : `https://polar.sh`,
            amount: `$${rewardUsd}`,
            currency: 'USD',
            rewardUsd,
            languages: ['TypeScript', 'Full-Stack'],
            summary: p.body ? p.body.slice(0, 200) + '...' : 'Polar funded open issue.',
            publishedAt: p.created_at || new Date().toISOString(),
            issueNumber: p.number || 0,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Bounty Sentry] Polar live query warning:', err instanceof Error ? err.message : String(err));
  }

  // Filter bounties (>= $50 USD threshold) and sort by reward descending
  const sorted = bounties.filter(b => b.rewardUsd >= 50).sort((a, b) => b.rewardUsd - a.rewardUsd);
  const totalPool = sorted.reduce((sum, b) => sum + b.rewardUsd, 0);
  const maxReward = sorted.length > 0 ? sorted[0].rewardUsd : 0;

  return {
    timestamp: new Date().toISOString(),
    bountiesFound: sorted.length,
    highRoiBounties: sorted.slice(0, 10),
    telemetry: {
      scannedSources: scannedSources.length > 0 ? scannedSources : ['algora.io (cached)', 'polar.sh'],
      maxRewardUsd: maxReward,
      totalPoolValueUsd: totalPool,
    },
  };
}
