import { NextRequest, NextResponse } from 'next/server';
import {
  getPortfolioState,
  evaluateOpenPositions,
  generateAlphaSignalsForUniverse,
  executePaperOrder,
  closePositionManually,
  toggleEmergencyHalt,
  resetPortfolio,
  fetchLiveQuote,
  MONITORED_UNIVERSE,
  RISK_CONFIG,
} from '@/lib/jarvis/quant-engine';
import { verifySessionToken, verifyMobileBearerToken } from '@/lib/jarvis/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const portfolio = await getPortfolioState();

    // Fetch live quotes for monitored universe in parallel
    const quotes = await Promise.all(
      MONITORED_UNIVERSE.map(async (sym) => {
        const q = await fetchLiveQuote(sym);
        return q || { symbol: sym, price: 0, change24hPct: 0 };
      })
    );

    return NextResponse.json({
      success: true,
      portfolio,
      quotes,
      riskConfig: RISK_CONFIG,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve quant trading portfolio' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cookieToken = req.cookies.get('jarvis_session')?.value;

    const isBearerValid = authHeader ? verifyMobileBearerToken(authHeader) : false;
    const isSessionValid = cookieToken ? await verifySessionToken(cookieToken) : false;

    // Sentry: Only reject if explicit invalid auth header is supplied
    if (authHeader && !isBearerValid && !isSessionValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || 'evaluate';

    switch (action) {
      case 'scan': {
        const signals = await generateAlphaSignalsForUniverse();
        return NextResponse.json({
          success: true,
          signalsCount: signals.length,
          signals,
        });
      }

      case 'order': {
        const { symbol, direction, strategy, customStopLoss, customTakeProfit } = body;
        if (!symbol || !direction) {
          return NextResponse.json(
            { success: false, error: 'symbol and direction (LONG/SHORT) are required' },
            { status: 400 }
          );
        }

        const res = await executePaperOrder({
          symbol: symbol.toUpperCase(),
          direction: direction.toUpperCase(),
          strategy: strategy || 'MANUAL',
          customStopLoss: customStopLoss ? Number(customStopLoss) : undefined,
          customTakeProfit: customTakeProfit ? Number(customTakeProfit) : undefined,
        });

        if (!res.success) {
          return NextResponse.json({ success: false, error: res.error }, { status: 400 });
        }

        const portfolio = await getPortfolioState();
        return NextResponse.json({
          success: true,
          message: `Paper order executed for ${symbol} (${direction})`,
          position: res.position,
          portfolio,
        });
      }

      case 'close': {
        const { positionId } = body;
        if (!positionId) {
          return NextResponse.json({ success: false, error: 'positionId is required' }, { status: 400 });
        }

        const res = await closePositionManually(positionId);
        if (!res.success) {
          return NextResponse.json({ success: false, error: res.error }, { status: 400 });
        }

        const portfolio = await getPortfolioState();
        return NextResponse.json({
          success: true,
          message: `Position ${positionId} closed. Realized PnL: $${res.tradeLog?.realizedPnl}`,
          tradeLog: res.tradeLog,
          portfolio,
        });
      }

      case 'evaluate': {
        const evalRes = await evaluateOpenPositions();
        return NextResponse.json({
          success: true,
          closedCount: evalRes.closedPositions.length,
          closedPositions: evalRes.closedPositions,
          circuitBreakerTripped: evalRes.circuitBreakerTripped,
          portfolio: evalRes.portfolio,
        });
      }

      case 'halt': {
        const { reason } = body;
        const portfolio = await toggleEmergencyHalt(true, reason || 'Manual emergency circuit breaker via API');
        return NextResponse.json({
          success: true,
          message: 'Trading halted. Emergency Circuit Breaker engaged.',
          portfolio,
        });
      }

      case 'resume': {
        const portfolio = await toggleEmergencyHalt(false);
        return NextResponse.json({
          success: true,
          message: 'Trading resumed. Risk sentry nominal.',
          portfolio,
        });
      }

      case 'reset': {
        const portfolio = await resetPortfolio();
        return NextResponse.json({
          success: true,
          message: 'Paper trading portfolio reset to clean $100,000.00 USD state.',
          portfolio,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Trading action failed' },
      { status: 500 }
    );
  }
}
