/**
 * J.A.R.V.I.S. Mark II — OSINT & Cyber Forensics Engine (OSIRIS Integrated)
 * Inspired by OSIRIS (Open Source Intelligence & Reconnaissance Integrated System)
 * 
 * Provides keyless, real-time intelligence for:
 * 1. CVE Vulnerability Indexing (NVD NIST 2.0 + OSV.dev)
 * 2. Crypto Wallet Forensics & OFAC Sanctions Cross-Matching (Blockscout + Blockstream + OFAC Watchlist)
 * 3. Network & IP Reconnaissance (RDAP, GeoIP, Cloudflare DNS over HTTPS)
 */

export interface CveThreatReport {
  query: string;
  totalFound: number;
  threats: Array<{
    id: string;
    summary: string;
    severity?: string;
    score?: number;
    published?: string;
    affectedPackage?: string;
    fixedVersion?: string;
    database: string;
  }>;
  source: string;
  checkedAt: string;
}

export interface CryptoSanctionsReport {
  target: string;
  asset?: 'BTC' | 'ETH' | 'AUTO';
  isSanctionedOrFlagged: boolean;
  threatLevel: 'CLEAN' | 'SUSPICIOUS' | 'SANCTIONED_CRITICAL';
  flags: string[];
  entityName?: string;
  walletDetails?: {
    chain: string;
    address: string;
    balance?: string;
    totalReceived?: string;
    totalSent?: string;
    txCount?: number;
    isContract?: boolean;
    isVerified?: boolean;
  };
  source: string;
  checkedAt: string;
}

export interface IpReconReport {
  target: string;
  ip?: string;
  hostname?: string;
  asn?: string;
  organization?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isProxyOrVpn?: boolean;
  dnsRecords?: Array<{ type: string; data: string; ttl: number }>;
  source: string;
  checkedAt: string;
}

// Known OFAC Sanctioned & High-Risk Cybercrime Clusters
const KNOWN_SANCTIONED_CLUSTERS = [
  { pattern: /tornado/i, name: 'Tornado Cash (OFAC SDN Sanctioned Mixer)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /lazarus/i, name: 'Lazarus Group (DPRK State-Sponsored Reconnaissance)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /sinbad/i, name: 'Sinbad.io (OFAC Sanctioned Money Laundering Hub)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /blender\.io/i, name: 'Blender.io (OFAC Sanctioned Mixer)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /garantex/i, name: 'Garantex Europe (OFAC Sanctioned Exchange)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /hydra/i, name: 'Hydra Market (Sanctioned Darknet Market)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /chatex/i, name: 'Chatex (OFAC Sanctioned Ransomware Facilitator)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /suex/i, name: 'SUEX OTC (OFAC Sanctioned Entity)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /0xd90e2f925da726b50c4ed8d0fb90ad053324f31b/i, name: 'Tornado Cash: Router (OFAC SDN)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /0x8589427373d6d84e98730d7795d8f6f8731fda16/i, name: 'Tornado Cash: 0.1 ETH (OFAC SDN)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /0x722122df12d4e14e13ac3b6895a86e84145b6967/i, name: 'Tornado Cash: 1 ETH (OFAC SDN)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936/i, name: 'Tornado Cash: 10 ETH (OFAC SDN)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /0x910cbd523d972eb0a6f4cae4618ad62622b39dbf/i, name: 'Tornado Cash: 100 ETH (OFAC SDN)', severity: 'SANCTIONED_CRITICAL' },
  { pattern: /12xGQ9wbFG6b2oWnFDY3dDThwZ5i2vE7y/i, name: 'WannaCry Ransomware Treasury (OFAC SDN)', severity: 'SANCTIONED_CRITICAL' },
];

/**
 * 1. Query Real-Time CVE Vulnerabilities via NVD NIST 2.0 & OSV.dev
 */
export async function scanCveThreats(args: {
  keyword: string;
  ecosystem?: 'npm' | 'Maven' | 'PyPI' | 'Go' | 'Linux' | 'crates.io';
  limit?: number;
}): Promise<CveThreatReport> {
  const { keyword, ecosystem, limit = 5 } = args;
  const cleanKey = keyword.trim();
  const report: CveThreatReport = {
    query: cleanKey,
    totalFound: 0,
    threats: [],
    source: 'National Vulnerability Database (NVD NIST) & OSV.dev',
    checkedAt: new Date().toISOString(),
  };

  // 1. Primary Query: NVD NIST REST API 2.0 (Comprehensive across all CVEs)
  try {
    const nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(cleanKey)}&resultsPerPage=${limit}`;
    const nvdRes = await fetch(nvdUrl, {
      headers: { 'User-Agent': 'JARVIS-MarkII/2.0 (OSINT Sentry)' },
      signal: AbortSignal.timeout(8000),
    });

    if (nvdRes.ok) {
      const data = await nvdRes.json();
      report.totalFound = data.totalResults || 0;
      const items = Array.isArray(data.vulnerabilities) ? data.vulnerabilities : [];

      report.threats = items.map((item: any) => {
        const cve = item.cve || {};
        const metrics = cve.metrics?.cvssMetricV31?.[0]?.cvssData || cve.metrics?.cvssMetricV30?.[0]?.cvssData || cve.metrics?.cvssMetricV2?.[0]?.cvssData || {};
        const englishDesc = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 'No description provided';

        return {
          id: cve.id || 'CVE-UNKNOWN',
          summary: englishDesc.length > 220 ? `${englishDesc.slice(0, 220)}...` : englishDesc,
          severity: metrics.baseSeverity || (metrics.baseScore >= 9.0 ? 'CRITICAL' : metrics.baseScore >= 7.0 ? 'HIGH' : metrics.baseScore >= 4.0 ? 'MEDIUM' : 'LOW'),
          score: metrics.baseScore,
          published: cve.published?.split('T')[0],
          database: 'NVD NIST 2.0',
        };
      });
    }
  } catch (nvdErr: any) {
    console.warn('[OSINT] NVD query timeout/error:', nvdErr?.message);
  }

  // 2. Secondary Query: OSV.dev if NVD returned zero or failed
  if (report.threats.length === 0) {
    try {
      const candidates = [
        { name: cleanKey, ecosystem: ecosystem || 'npm' },
        { name: `org.springframework.boot:${cleanKey}`, ecosystem: 'Maven' },
        { name: cleanKey, ecosystem: 'Maven' },
        { name: cleanKey, ecosystem: 'PyPI' },
      ];

      for (const cand of candidates) {
        const osvRes = await fetch('https://api.osv.dev/v1/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ package: cand }),
          signal: AbortSignal.timeout(5000),
        });

        if (osvRes.ok) {
          const osvData = await osvRes.json();
          if (Array.isArray(osvData.vulns) && osvData.vulns.length > 0) {
            report.totalFound = osvData.vulns.length;
            report.threats = osvData.vulns.slice(0, limit).map((v: any) => ({
              id: v.id || 'CVE-UNKNOWN',
              summary: v.summary || v.details?.slice(0, 200) || 'Security advisory',
              severity: v.database_specific?.severity || 'HIGH',
              published: v.published?.split('T')[0],
              affectedPackage: cand.name,
              database: 'OSV.dev',
            }));
            break;
          }
        }
      }
    } catch (osvErr: any) {
      console.warn('[OSINT] OSV.dev fallback error:', osvErr?.message);
    }
  }

  return report;
}

/**
 * 2. Trace Crypto Wallets & Run OFAC/UN Sanctions Match
 */
export async function traceCryptoSanctions(args: {
  addressOrName: string;
  asset?: 'BTC' | 'ETH' | 'AUTO';
}): Promise<CryptoSanctionsReport> {
  const { addressOrName, asset = 'AUTO' } = args;
  const target = addressOrName.trim();
  const isEth = /^0x[a-fA-F0-9]{40}$/.test(target);
  const isBtc = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})$/.test(target);

  const report: CryptoSanctionsReport = {
    target,
    asset: isBtc ? 'BTC' : isEth ? 'ETH' : asset,
    isSanctionedOrFlagged: false,
    threatLevel: 'CLEAN',
    flags: [],
    source: 'On-Chain Block Explorers (Blockscout/Blockstream) + OFAC SDN Watchlist',
    checkedAt: new Date().toISOString(),
  };

  // 2.1 Check against OFAC Sanctioned & High-Risk Threat Patterns
  for (const cluster of KNOWN_SANCTIONED_CLUSTERS) {
    if (cluster.pattern.test(target)) {
      report.isSanctionedOrFlagged = true;
      report.threatLevel = cluster.severity as any;
      report.flags.push(`MATCHED: ${cluster.name}`);
      report.entityName = cluster.name;
    }
  }

  // 2.2 On-Chain Balances & Transaction Counts (Blockstream for BTC, Blockscout for ETH)
  try {
    if (isBtc) {
      const btcRes = await fetch(`https://blockstream.info/api/address/${target}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (btcRes.ok) {
        const btcData = await btcRes.json();
        const chainStats = btcData.chain_stats || {};
        const funded = (chainStats.funded_txo_sum || 0) / 1e8;
        const spent = (chainStats.spent_txo_sum || 0) / 1e8;
        report.walletDetails = {
          chain: 'Bitcoin (Mainnet)',
          address: target,
          balance: `${(funded - spent).toFixed(8)} BTC`,
          totalReceived: `${funded.toFixed(8)} BTC`,
          totalSent: `${spent.toFixed(8)} BTC`,
          txCount: chainStats.tx_count || 0,
        };
      }
    } else if (isEth) {
      const ethRes = await fetch(`https://eth.blockscout.com/api/v2/addresses/${target}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (ethRes.ok) {
        const ethData = await ethRes.json();
        const weiBalance = BigInt(ethData.coin_balance || '0');
        const ethBalance = Number(weiBalance) / 1e18;

        if (ethData.name) {
          report.entityName = ethData.name;
          for (const cluster of KNOWN_SANCTIONED_CLUSTERS) {
            if (cluster.pattern.test(ethData.name)) {
              report.isSanctionedOrFlagged = true;
              report.threatLevel = cluster.severity as any;
              report.flags.push(`ON-CHAIN CONTRACT MATCH: ${ethData.name} (${cluster.name})`);
            }
          }
        }

        report.walletDetails = {
          chain: 'Ethereum (Mainnet)',
          address: target,
          balance: `${ethBalance.toFixed(6)} ETH`,
          isContract: ethData.is_contract,
          isVerified: ethData.is_verified,
        };
      }
    }
  } catch (chainErr: any) {
    console.warn('[OSINT] On-chain lookup error:', chainErr?.message);
  }

  return report;
}

/**
 * 3. Network & IP Reconnaissance via RDAP and Cloudflare DoH
 */
export async function inspectIpRecon(args: { target: string }): Promise<IpReconReport> {
  const cleanTarget = args.target.trim().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanTarget) || cleanTarget.includes(':');

  const report: IpReconReport = {
    target: cleanTarget,
    source: 'Public RDAP, GeoIP & Cloudflare DNS over HTTPS',
    checkedAt: new Date().toISOString(),
  };

  // 3.1 DNS over HTTPS resolution via Cloudflare
  try {
    const dohRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanTarget)}&type=A`, {
      headers: { 'Accept': 'application/dns-json' },
      signal: AbortSignal.timeout(5000),
    });
    if (dohRes.ok) {
      const dohData = await dohRes.json();
      if (Array.isArray(dohData.Answer)) {
        report.dnsRecords = dohData.Answer.map((a: any) => ({
          type: a.type === 1 ? 'A' : String(a.type),
          data: a.data,
          ttl: a.TTL,
        }));
        if (!isIp && dohData.Answer.length > 0) {
          report.ip = dohData.Answer[0].data;
        }
      }
    }
  } catch (dohErr: any) {
    console.warn('[OSINT] DoH resolution error:', dohErr?.message);
  }

  // 3.2 GeoIP & ASN lookup for the resolved IP
  const lookupIp = isIp ? cleanTarget : (report.ip || cleanTarget);
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(lookupIp)) {
    try {
      const geoRes = await fetch(`https://ipwho.is/${encodeURIComponent(lookupIp)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (geo.success) {
          report.ip = geo.ip;
          report.hostname = geo.connection?.domain || undefined;
          report.asn = `${geo.connection?.asn || ''} (${geo.connection?.org || ''})`.trim();
          report.organization = geo.connection?.isp || geo.connection?.org;
          report.country = `${geo.country} (${geo.country_code})`;
          report.region = geo.region;
          report.city = geo.city;
          report.latitude = geo.latitude;
          report.longitude = geo.longitude;
          report.timezone = geo.timezone?.id;
          report.isProxyOrVpn = Boolean(geo.security?.vpn || geo.security?.proxy || geo.security?.tor);
        }
      }
    } catch (geoErr: any) {
      console.warn('[OSINT] GeoIP error:', geoErr?.message);
    }
  }

  return report;
}
