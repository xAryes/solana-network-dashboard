import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  useNetworkStats,
  useRecentBlocks,
  useSupplyInfo,
  useValidatorInfo,
  useRecentTransactions,
  useInflationInfo,
  useClusterInfo,
  useBlockProduction,
  useLeaderSchedule,
  useTopValidators,
  useValidatorNames,
  useNetworkHistory,
  useValidatorLocations,
  formatCU,
  formatNumber,
  getSolscanUrl,
  SOLANA_LIMITS,
  getProgramInfo,
  getTxCategory,
  CATEGORY_COLORS,
} from './hooks/useSolanaData';
import type { SlotData, LeaderScheduleInfo, ValidatorMetadata, EpochNetworkStats, EnhancedTransaction, BlockProductionInfo, NetworkStats, SupplyInfo, ValidatorInfo, InflationInfo, ClusterInfo, NetworkHistoryData } from './hooks/useSolanaData';
import type { TransactionInfo } from './hooks/useSolanaData';
import { fetchEnhancedTransactions } from './hooks/useSolanaData';

// Generate a gradient color based on pubkey for avatar fallback
function getAvatarGradient(pubkey: string): string {
  const hash = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hash * 7) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 40%))`;
}

// Country code to flag emoji mapping
const COUNTRY_FLAGS: Record<string, string> = {
  'US': '🇺🇸', 'USA': '🇺🇸', 'United States': '🇺🇸',
  'DE': '🇩🇪', 'Germany': '🇩🇪',
  'NL': '🇳🇱', 'Netherlands': '🇳🇱',
  'GB': '🇬🇧', 'UK': '🇬🇧', 'United Kingdom': '🇬🇧',
  'FR': '🇫🇷', 'France': '🇫🇷',
  'JP': '🇯🇵', 'Japan': '🇯🇵',
  'SG': '🇸🇬', 'Singapore': '🇸🇬',
  'CA': '🇨🇦', 'Canada': '🇨🇦',
  'AU': '🇦🇺', 'Australia': '🇦🇺',
  'FI': '🇫🇮', 'Finland': '🇫🇮',
  'CH': '🇨🇭', 'Switzerland': '🇨🇭',
  'IE': '🇮🇪', 'Ireland': '🇮🇪',
  'HK': '🇭🇰', 'Hong Kong': '🇭🇰',
  'KR': '🇰🇷', 'South Korea': '🇰🇷',
  'PL': '🇵🇱', 'Poland': '🇵🇱',
  'UA': '🇺🇦', 'Ukraine': '🇺🇦',
  'RU': '🇷🇺', 'Russia': '🇷🇺',
  'IN': '🇮🇳', 'India': '🇮🇳',
  'BR': '🇧🇷', 'Brazil': '🇧🇷',
};

function formatLocation(location?: string): string {
  if (!location) return '🌐';
  // Try to extract country and add flag
  for (const [code, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (location.includes(code) || location.toLowerCase().includes(code.toLowerCase())) {
      // Extract city if available
      const parts = location.split(',');
      if (parts.length > 1) {
        return `${flag} ${parts[0].trim()}`;
      }
      return flag;
    }
  }
  return `🌐 ${location.split(',')[0] || ''}`.trim();
}

// Page definitions for routing
const PAGES = [
  { path: '/', label: 'Dashboard', icon: '◉' },
  { path: '/explorer', label: 'Explorer', icon: '⊞' },
  { path: '/failures', label: 'Failures', icon: '✕' },
  { path: '/validators', label: 'Validators', icon: '⬡' },
];

function App() {
  const { stats, isLoading, error: statsError } = useNetworkStats();
  const { blocks } = useRecentBlocks(4);
  const { supply } = useSupplyInfo();
  const { validators } = useValidatorInfo();
  const { transactions } = useRecentTransactions(blocks);
  const { inflation } = useInflationInfo();
  const { cluster } = useClusterInfo();
  const { production } = useBlockProduction();
  const { schedule: leaderSchedule } = useLeaderSchedule(stats?.currentSlot || 0);

  const { validatorInfo: topValidators } = useTopValidators(0);
  const { getName: getValidatorName, getMetadata: getValidatorMetadata } = useValidatorNames();
  const networkHistory = useNetworkHistory(5);
  const { locations: validatorLocations } = useValidatorLocations();
  // Failure accumulation — lifted to App level so data persists across page navigation
  const processedSlotsRef = useRef<Set<number>>(new Set());
  const accProgramFailuresRef = useRef<Map<string, number>>(new Map());
  const accProgramTotalsRef = useRef<Map<string, number>>(new Map());
  const accPayerFailuresRef = useRef<Map<string, number>>(new Map());
  const accTotalBlocksRef = useRef(0);
  const accTotalTxsRef = useRef(0);
  const sessionStartRef = useRef<string>(new Date().toLocaleTimeString());
  const [failureRefreshCounter, setFailureRefreshCounter] = useState(0);

  // Accumulate failure data across block refreshes (session-persistent)
  useEffect(() => {
    for (const block of blocks) {
      if (!block.transactions || processedSlotsRef.current.has(block.slot)) continue;
      processedSlotsRef.current.add(block.slot);
      accTotalBlocksRef.current++;

      for (const tx of block.transactions) {
        accTotalTxsRef.current++;
        for (const prog of tx.programs) {
          const info = getProgramInfo(prog);
          if (info.category !== 'core') {
            accProgramTotalsRef.current.set(prog, (accProgramTotalsRef.current.get(prog) || 0) + 1);
          }
        }
        if (!tx.success) {
          for (const prog of tx.programs) {
            const info = getProgramInfo(prog);
            if (info.category !== 'core') {
              accProgramFailuresRef.current.set(prog, (accProgramFailuresRef.current.get(prog) || 0) + 1);
            }
          }
          if (tx.feePayer) {
            accPayerFailuresRef.current.set(tx.feePayer, (accPayerFailuresRef.current.get(tx.feePayer) || 0) + 1);
          }
        }
      }
    }
    setFailureRefreshCounter(c => c + 1);
  }, [blocks]);

  // Derive accumulated program rates + top payers from refs
  const failureAccumulation = useMemo(() => {
    void failureRefreshCounter;
    const programRates = Array.from(accProgramFailuresRef.current.entries())
      .map(([prog, failCount]) => {
        const total = accProgramTotalsRef.current.get(prog) || failCount;
        return { prog, failCount, total, rate: (failCount / total) * 100 };
      })
      .sort((a, b) => b.failCount - a.failCount);

    const topPayers = Array.from(accPayerFailuresRef.current.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      programRates,
      topPayers,
      totalBlocks: accTotalBlocksRef.current,
      totalTxs: accTotalTxsRef.current,
      sessionStart: sessionStartRef.current,
    };
  }, [failureRefreshCounter]);

  const location = useLocation();

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        {statsError ? (
          <>
            <div className="w-16 h-16 flex items-center justify-center rounded-full border-2 border-[var(--error)]/40">
              <span className="text-2xl text-[var(--error)]">!</span>
            </div>
            <div className="text-center">
              <div className="text-[var(--error)] font-medium">Connection Failed</div>
              <div className="text-[var(--text-muted)] text-sm mt-1">{statsError}</div>
              <div className="text-[var(--text-tertiary)] text-xs mt-2">Retrying automatically every 2s...</div>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <div className="w-16 h-16 border-2 border-[var(--border-secondary)] rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-[var(--accent)] rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <div className="text-[var(--text-secondary)] font-medium">Connecting to Solana</div>
              <div className="text-[var(--text-muted)] text-sm mt-1">Fetching mainnet data...</div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)]/50 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 bg-[var(--bg-primary)]/70 backdrop-blur-xl z-30" style={{ WebkitBackdropFilter: 'blur(20px) saturate(180%)', backdropFilter: 'blur(20px) saturate(180%)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Left side */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <NavLink to="/" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <span className="text-sm sm:text-base font-semibold text-[var(--text-primary)] tracking-tight">sol<span className="text-[var(--accent)]">.</span>watch</span>
            </NavLink>
            <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--text-secondary)] ml-1">
              <span className="status-dot live relative pulse-ring" />
              <span>Mainnet</span>
            </div>
            <span className="hidden sm:inline text-[var(--text-tertiary)] text-[10px]">•</span>
            <span className="hidden sm:inline text-[10px] text-[var(--text-muted)]">
              by <a href="https://github.com/xAryes" target="_blank" rel="noopener noreferrer"
                className="text-[var(--accent-secondary)] hover:underline">xAryes</a>
            </span>
          </div>

          {/* Center - Page Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {PAGES.map(page => (
              <NavLink
                key={page.path}
                to={page.path}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`
                }
                end={page.path === '/'}
              >
                <span>{page.icon}</span>
                <span>{page.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-2">
              <div className="px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                <span className="text-[10px] text-[var(--text-muted)]">Slot </span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">{stats.currentSlot.toLocaleString()}</span>
              </div>
              <div className="px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                <span className="text-[10px] text-[var(--text-muted)]">E</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">{stats.epochInfo.epoch}</span>
                <span className="text-[10px] text-[var(--accent)] ml-1">{stats.epochInfo.epochProgress.toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[var(--accent-tertiary)]/10 border border-[var(--accent-tertiary)]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-tertiary)] animate-pulse" />
              <span className="text-xs sm:text-sm text-[var(--accent-tertiary)] font-mono font-medium">
                {stats.tps.toLocaleString()} <span className="hidden sm:inline">TPS</span>
              </span>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex justify-center mt-1.5">
          <a href="https://x.com/chainhera" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-[10px]" title="Follow on X">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span>@chainhera</span>
          </a>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 md:hidden">
        <div className="bg-[var(--bg-primary)]/95 backdrop-blur-md border-t border-[var(--border-primary)]">
          <div className="flex items-center justify-around px-2 py-2">
            {PAGES.map(page => (
              <NavLink
                key={page.path}
                to={page.path}
                end={page.path === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                    isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`w-1.5 h-1.5 rounded-full transition-all ${isActive ? 'bg-[var(--accent)] scale-125' : 'bg-[var(--text-muted)]'}`} />
                    <span className="text-[9px] font-medium">{page.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content - Routed Pages */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 mb-16 md:mb-0">
        <Routes>
          <Route path="/" element={
            <DashboardPage
              stats={stats}
              supply={supply}
              validators={validators}
              inflation={inflation}
              cluster={cluster}
              production={production}
              leaderSchedule={leaderSchedule}
              getValidatorName={getValidatorName}
              getValidatorMetadata={getValidatorMetadata}
              networkHistory={networkHistory}
            />
          } />
          <Route path="/explorer" element={
            <ExplorerPage
              blocks={blocks}
              transactions={transactions}
              getValidatorName={getValidatorName}
              networkHistory={networkHistory}
            />
          } />
          <Route path="/failures" element={
            <FailuresPage
              blocks={blocks}
              networkHistory={networkHistory}
              failureAccumulation={failureAccumulation}
            />
          } />
          <Route path="/validators" element={
            <ValidatorsPage
              topValidators={topValidators}
              getValidatorName={getValidatorName}
              getValidatorMetadata={getValidatorMetadata}
              production={production}
              validatorLocations={validatorLocations}
              currentSlot={stats?.currentSlot || 0}
            />
          } />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-primary)] px-4 sm:px-6 py-6 mt-8 mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto">
          {/* Category Legend - only show on Explorer page */}
          {location.pathname === '/explorer' && (
            <div className="mb-4 pb-4 border-b border-[var(--border-primary)]">
              <div className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Transaction Categories</div>
              <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1.5 text-[10px] sm:text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS.dex }} />
                  <span className="text-[var(--text-tertiary)]">DEX</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS.perps }} />
                  <span className="text-[var(--text-tertiary)]">Perps</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS.lending }} />
                  <span className="text-[var(--text-tertiary)]">Lending</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS.staking }} />
                  <span className="text-[var(--text-tertiary)]">Staking</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS.oracle }} />
                  <span className="text-[var(--text-tertiary)]">Oracle</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS.nft }} />
                  <span className="text-[var(--text-tertiary)]">NFT</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS.core }} />
                  <span className="text-[var(--text-tertiary)]">Core</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS.vote }} />
                  <span className="text-[var(--text-tertiary)]">Vote</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[var(--error)]" />
                  <span className="text-[var(--text-tertiary)]">Failed</span>
                </span>
              </div>
            </div>
          )}

          {/* Dashboard Legend + Credits */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[10px] sm:text-xs text-[var(--text-muted)]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              <span className="hidden sm:inline">Real-time Solana mainnet data via Helius Premium RPC + Enhanced APIs</span>
              <span className="sm:hidden">Powered by Helius</span>
            </div>
            <div className="flex items-center flex-wrap gap-x-3 sm:gap-x-4 gap-y-1">
              <span>Data refreshes every ~4 blocks (~1.6s)</span>
              <span className="text-[var(--text-tertiary)]">•</span>
              <span>Epoch data via <a href="https://solanacompass.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-secondary)] hover:underline">Solana Compass</a></span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================
// PAGE COMPONENTS
// ============================================

function DashboardPage({ stats, supply, validators, inflation, cluster, production, leaderSchedule, getValidatorName, getValidatorMetadata, networkHistory }: {
  stats: NetworkStats;
  supply: SupplyInfo | null;
  validators: ValidatorInfo | null;
  inflation: InflationInfo | null;
  cluster: ClusterInfo | null;
  production: BlockProductionInfo | null;
  leaderSchedule: LeaderScheduleInfo | null;
  getValidatorName: (pubkey: string) => string | null;
  getValidatorMetadata: (pubkey: string) => ValidatorMetadata | null;
  networkHistory: NetworkHistoryData;
}) {
  return (
    <>
      {/* Network Overview */}
      <section className="mb-8 sm:mb-10">
        <SectionHeader title="Network Overview" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
          <StatCard label="Current Slot" value={stats.currentSlot.toLocaleString()} subtext="live" accent />
          <StatCard label="Block Height" value={stats.blockHeight.toLocaleString()} subtext="cumulative" />
          <StatCard label="TPS" value={stats.tps.toLocaleString()} subtext="current rate" color="green" />
          <StatCard label="Avg Slot Time" value={`${stats.avgSlotTime}ms`} subtext={`target 400ms • ${stats.avgSlotTime > 500 ? 'slow' : 'normal'}`} />
          <StatCard label="Epoch" value={`${stats.epochInfo.epoch}`} subtext={`${stats.epochInfo.epochProgress.toFixed(1)}% complete`} />
          <StatCard
            label="Time to Epoch End"
            value={formatTimeRemaining((stats.epochInfo.slotsInEpoch - stats.epochInfo.slotIndex) * 0.4)}
            subtext="estimated"
          />
        </div>
        <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
          <span className="text-xs text-[var(--text-muted)]">Total Network Transactions <span className="text-[var(--text-tertiary)]">(all-time count)</span></span>
          <span className="font-mono text-sm text-[var(--accent-secondary)]">
            {stats.transactionCount ? stats.transactionCount.toLocaleString() : '—'}
          </span>
        </div>
      </section>

      {/* Epoch Progress */}
      <section className="mb-8 sm:mb-10">
        {(() => {
          const remainingSlots = stats.epochInfo.slotsInEpoch - stats.epochInfo.slotIndex;
          const remainingSeconds = remainingSlots * 0.4;
          const estimatedEnd = new Date(Date.now() + remainingSeconds * 1000);
          return (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-2 sm:mb-3">
                <span className="text-xs sm:text-sm text-[var(--text-secondary)]">Epoch {stats.epochInfo.epoch} Progress</span>
                <span className="text-[10px] sm:text-sm text-[var(--text-tertiary)] font-mono">
                  {stats.epochInfo.slotIndex.toLocaleString()} / {stats.epochInfo.slotsInEpoch.toLocaleString()} slots
                </span>
              </div>
              <div className="h-2 sm:h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full progress-animated transition-all duration-500"
                  style={{ width: `${stats.epochInfo.epochProgress}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                <span className="text-[var(--text-muted)]">{stats.epochInfo.epochProgress.toFixed(2)}% complete</span>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-[var(--text-muted)]">
                    <span className="font-mono text-[var(--accent)]">{formatTimeRemaining(remainingSeconds)}</span> remaining
                  </span>
                  <span className="hidden sm:inline text-[var(--text-tertiary)]">•</span>
                  <span className="hidden sm:inline text-[var(--text-muted)]" title={estimatedEnd.toLocaleString()}>
                    ends ~<span className="font-mono text-[var(--text-secondary)]">{estimatedEnd.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} {estimatedEnd.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </div>
              </div>
            </>
          );
        })()}
      </section>

      {/* Epoch Summary */}
      <EpochSummaryCards data={networkHistory} />

      {/* Validators & Network */}
      <section className="mb-8 sm:mb-10">
        <SectionHeader title="Validators & Network" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
          <StatCard
            label="Active Validators"
            value={validators ? validators.activeValidators.toLocaleString() : '—'}
            subtext="count"
            accent
          />
          <StatCard
            label="Delinquent"
            value={validators ? validators.delinquentValidators.toLocaleString() : '—'}
            subtext={validators ? `${((validators.delinquentValidators / validators.totalValidators) * 100).toFixed(1)}% of total` : 'count'}
          />
          <StatCard
            label="Total Stake"
            value={validators ? formatNumber(validators.totalStake) : '—'}
            subtext="SOL total"
          />
          <StatCard
            label="Cluster Nodes"
            value={cluster ? cluster.totalNodes.toLocaleString() : '—'}
            subtext={cluster ? `count • ${cluster.rpcNodes} RPC` : 'count'}
          />
          <StatCard
            label="Skip Rate"
            value={production ? `${production.skipRate.toFixed(2)}%` : '—'}
            subtext={production ? `${formatNumber(production.totalSlotsSkipped)} skipped this epoch` : undefined}
            color={production && production.skipRate > 5 ? undefined : 'green'}
          />
          <StatCard
            label="Blocks Produced"
            value={production ? formatNumber(production.totalBlocksProduced) : '—'}
            subtext="count, this epoch"
          />
        </div>
      </section>

      {/* Supply & Economics */}
      <section className="mb-8 sm:mb-10">
        <SectionHeader title="Supply & Economics" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
          <StatCard label="Total Supply" value={supply ? formatNumber(supply.total) : '—'} subtext="SOL total" accent />
          <StatCard label="Circulating" value={supply ? formatNumber(supply.circulating) : '—'} subtext="SOL in circulation" />
          <StatCard label="Non-Circulating" value={supply ? formatNumber(supply.nonCirculating) : '—'} subtext="SOL locked" />
          <StatCard
            label="Circulating %"
            value={supply ? `${((supply.circulating / supply.total) * 100).toFixed(1)}%` : '—'}
            subtext="of total supply"
            color="green"
          />
          <StatCard
            label="Inflation Rate"
            value={inflation ? `${inflation.total.toFixed(2)}%` : '—'}
            subtext="annual"
            color="blue"
          />
          <StatCard
            label="Validator APY"
            value={inflation ? `${inflation.validator.toFixed(2)}%` : '—'}
            subtext="staking yield"
            color="green"
          />
        </div>
      </section>

      {/* Leader Rotation */}
      <section className="mb-8 sm:mb-10">
        <SectionHeader title="Leader Rotation" subtitle="Upcoming block producers" />
        <LeaderSchedulePanel
          leaderSchedule={leaderSchedule}
          currentSlot={stats.currentSlot}
          getValidatorName={getValidatorName}
          getValidatorMetadata={getValidatorMetadata}
          validatorCount={validators?.activeValidators || 0}
        />
      </section>

      {/* Network Limits Reference */}
      <NetworkLimitsSection />
    </>
  );
}

function ExplorerPage({ blocks, transactions, getValidatorName, networkHistory }: {
  blocks: SlotData[];
  transactions: TransactionInfo[];
  getValidatorName: (pubkey: string) => string | null;
  networkHistory: NetworkHistoryData;
}) {
  return (
    <>
      <EpochDetailedAnalytics data={networkHistory} />
      <AnalyticsSection blocks={blocks} transactions={transactions} />
      <BlockDeepDive blocks={blocks} getValidatorName={getValidatorName} />
    </>
  );
}

type FailureAccumulation = {
  programRates: Array<{ prog: string; failCount: number; total: number; rate: number }>;
  topPayers: Array<[string, number]>;
  totalBlocks: number;
  totalTxs: number;
  sessionStart: string;
};

function FailuresPage({ blocks, networkHistory, failureAccumulation }: {
  blocks: SlotData[];
  networkHistory: { currentEpoch: EpochNetworkStats | null; previousEpochs: EpochNetworkStats[]; isLoading: boolean; error: string | null };
  failureAccumulation: FailureAccumulation;
}) {
  return (
    <FailedTransactionsAnalysis
      blocks={blocks}
      networkHistory={networkHistory}
      accumulated={failureAccumulation}
    />
  );
}

function ValidatorsPage({ topValidators, getValidatorName, getValidatorMetadata, production, validatorLocations, currentSlot }: {
  topValidators: ReturnType<typeof useTopValidators>['validatorInfo'];
  getValidatorName: (pubkey: string) => string | null;
  getValidatorMetadata: (pubkey: string) => ValidatorMetadata | null;
  production: BlockProductionInfo | null;
  validatorLocations: { locations: Array<{ identity: string; voteAccount: string; name: string | null; lat: number; lng: number; city: string; country: string; stake: number; version: string }>; byCountry: Map<string, number>; byContinent: Map<string, number> } | null;
  currentSlot: number;
}) {
  return (
    <>
      <TopValidatorsSection
        validatorInfo={topValidators}
        getValidatorName={getValidatorName}
        getValidatorMetadata={getValidatorMetadata}
        production={production}
        currentSlot={currentSlot}
      />
      <ValidatorGeography validatorLocations={validatorLocations} />
    </>
  );
}

// ============================================
// SHARED COMPONENTS
// ============================================

function SectionHeader({ title, subtitle, noMargin }: { title: string; subtitle?: string; noMargin?: boolean }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 ${noMargin ? '' : 'mb-3 sm:mb-4'}`}>
      <h2 className="text-xs sm:text-sm text-[var(--text-secondary)] uppercase tracking-wider font-semibold">{title}</h2>
      {subtitle && <span className="text-[10px] sm:text-xs text-[var(--text-muted)]">{subtitle}</span>}
    </div>
  );
}

function StatCard({ label, value, subtext, accent, color }: { label: string; value: string; subtext?: string; accent?: boolean; color?: 'purple' | 'green' | 'blue' }) {
  const colorClass = color === 'green' ? 'text-[var(--accent-tertiary)]'
    : color === 'blue' ? 'text-[var(--accent-secondary)]'
    : accent ? 'text-[var(--accent)]'
    : 'text-[var(--text-primary)]';

  const borderColor = color === 'green' ? 'border-l-[var(--accent-tertiary)]'
    : color === 'blue' ? 'border-l-[var(--accent-secondary)]'
    : accent ? 'border-l-[var(--accent)]'
    : 'border-l-transparent';

  return (
    <div className={`card p-4 stat-card border-l-2 ${borderColor}`}>
      <div className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1 truncate">{label}</div>
      <div className={`text-base sm:text-lg font-mono ${colorClass} truncate`}>{value}</div>
      {subtext && <div className="text-[10px] sm:text-xs text-[var(--text-tertiary)] mt-1 truncate">{subtext}</div>}
    </div>
  );
}

function LimitCard({ label, value, subtext, highlight }: { label: string; value: string; subtext?: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col py-2 px-3 rounded ${highlight ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30' : 'bg-[var(--bg-secondary)]'}`}>
      <div className="flex justify-between items-center">
        <span className="text-[var(--text-muted)] text-xs">{label}</span>
        <span className={`font-mono ${highlight ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>{value}</span>
      </div>
      {subtext && <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{subtext}</span>}
    </div>
  );
}

function formatTimeRemaining(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

// CU Distribution analysis
const CU_CATEGORIES = [
  { name: 'Micro', range: '< 5k', min: 0, max: 5000, color: 'var(--text-tertiary)', description: 'Simple transfers, memo' },
  { name: 'Light', range: '5k-50k', min: 5000, max: 50000, color: 'var(--accent-tertiary)', description: 'Token transfers, basic ops' },
  { name: 'Medium', range: '50k-200k', min: 50000, max: 200000, color: 'var(--accent-secondary)', description: 'Simple swaps, staking' },
  { name: 'Heavy', range: '200k-500k', min: 200000, max: 500000, color: 'var(--accent)', description: 'Complex DeFi, multi-hop' },
  { name: 'Compute', range: '> 500k', min: 500000, max: Infinity, color: 'var(--warning)', description: 'Heavy compute, liquidations' },
];

// Shared formatting helpers for epoch analytics
const formatSOL = (lamports: number) => {
  const sol = lamports / 1e9;
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}k`;
  if (sol >= 1) return sol.toFixed(1);
  if (sol >= 0.01) return sol.toFixed(2);
  if (sol >= 0.0001) return sol.toFixed(4);
  if (lamports >= 1000) return `${(lamports / 1000).toFixed(1)}k L`;
  if (lamports >= 1) return `${Math.round(lamports)} L`;
  return '< 1 L';
};

const formatCompact = (num: number) => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(0)}k`;
  return num.toLocaleString();
};

const getTrend = (values: number[]) => {
  if (values.length < 2) return { direction: 'flat' as const, pct: 0 };
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (prev === 0) return { direction: 'flat' as const, pct: 0 };
  const pct = ((last - prev) / prev) * 100;
  return { direction: pct > 1 ? 'up' as const : pct < -1 ? 'down' as const : 'flat' as const, pct };
};

const TrendBadge = ({ values, invert = false }: { values: number[]; invert?: boolean }) => {
  const { direction, pct } = getTrend(values);
  if (direction === 'flat') return <span className="text-[10px] text-[var(--text-muted)]">--</span>;
  const isGood = invert ? direction === 'down' : direction === 'up';
  return (
    <span className={`text-[10px] font-mono ${isGood ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
      {direction === 'up' ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
};

// Validator health score computation
type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';
type HealthResult = { score: number; grade: HealthGrade; skipScore: number; commissionScore: number; livenessScore: number; voteScore: number };

function computeHealthScore(
  v: { commission: number; lastVote: number; delinquent: boolean; nodePubkey: string },
  production: BlockProductionInfo | null,
  currentSlot: number
): HealthResult {
  // Skip rate (40%): 0% → 100pts, >10% → 0pts
  let skipScore = 100;
  const prod = production?.byIdentity?.[v.nodePubkey];
  if (prod) {
    const [slots, produced] = prod;
    const skipRate = slots > 0 ? ((slots - produced) / slots) * 100 : 0;
    skipScore = Math.max(0, Math.min(100, 100 - (skipRate / 10) * 100));
  }

  // Commission (20%): 0% → 100pts, ≥10% → 0pts
  const commissionScore = Math.max(0, Math.min(100, 100 - (v.commission / 10) * 100));

  // Liveness (20%): active → 100, delinquent → 0
  const livenessScore = v.delinquent ? 0 : 100;

  // Vote recency (20%): <128 slots behind → 100, degrades to 0 at 512+
  const slotsBehind = currentSlot - v.lastVote;
  const voteScore = slotsBehind < 128 ? 100 : slotsBehind >= 512 ? 0 : Math.max(0, 100 - ((slotsBehind - 128) / (512 - 128)) * 100);

  const score = Math.round(skipScore * 0.4 + commissionScore * 0.2 + livenessScore * 0.2 + voteScore * 0.2);
  const grade: HealthGrade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  return { score, grade, skipScore: Math.round(skipScore), commissionScore: Math.round(commissionScore), livenessScore: Math.round(livenessScore), voteScore: Math.round(voteScore) };
}

const GRADE_COLORS: Record<HealthGrade, string> = {
  A: 'var(--success)',
  B: 'var(--accent-secondary)',
  C: 'var(--warning)',
  D: 'var(--accent)',
  F: 'var(--error)',
};

function HealthGauge({ score, grade, size = 48 }: { score: number; grade: HealthGrade; size?: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = GRADE_COLORS[grade];
  const isCompact = size <= 32;

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      {/* Background ring */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth={3} />
      {/* Score ring */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
      />
      {/* Score number */}
      <text
        x={size / 2} y={isCompact ? size / 2 + 1 : size / 2 - 2}
        textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={isCompact ? 10 : 13} fontFamily="monospace" fontWeight="600"
      >
        {score}
      </text>
      {/* Grade letter (only on larger gauge) */}
      {!isCompact && (
        <text
          x={size / 2} y={size / 2 + 12}
          textAnchor="middle" dominantBaseline="central"
          fill="var(--text-muted)" fontSize={8} fontFamily="monospace"
        >
          {grade}
        </text>
      )}
    </svg>
  );
}

type EpochAnalyticsData = { currentEpoch: EpochNetworkStats | null; previousEpochs: EpochNetworkStats[]; isLoading: boolean; error: string | null };

// Epoch Summary Cards - top-level overview for Dashboard
function EpochSummaryCards({ data }: { data: EpochAnalyticsData }) {
  if (data.isLoading) {
    return (
      <section id="epoch" className="mb-10">
        <SectionHeader title="Epoch Analytics" subtitle="Loading..." />
        <div className="card p-6">
          <div className="flex items-center justify-center py-12 gap-3">
            <div className="spinner" />
            <span className="text-[var(--text-muted)]">Fetching epoch data from Solana Compass...</span>
          </div>
        </div>
      </section>
    );
  }

  if (data.error || !data.currentEpoch) return null;

  const current = data.currentEpoch;
  const allEpochs = [current, ...data.previousEpochs];
  const reversed = allEpochs.slice().reverse();

  const maxTx = Math.max(...allEpochs.map(e => e.totalTransactions));
  const maxFees = Math.max(...allEpochs.map(e => e.totalFees));
  const maxJito = Math.max(...allEpochs.map(e => e.jitoTips));
  const totalFeesAndTips = current.totalFees + current.jitoTips;

  return (
    <section id="epoch" className="mb-10">
      <SectionHeader title="Epoch Analytics" subtitle={`Epoch ${current.epoch} • ${allEpochs.length} epochs • Solana Compass`} />
      <div className="text-[10px] text-[var(--text-tertiary)] mb-4 -mt-2 flex items-center gap-2 flex-wrap">
        <span>Each epoch spans ~2-3 days (432,000 slots).</span>
        <span className="text-[var(--border-secondary)]">|</span>
        <span>Epoch {current.epoch} progress: {current.totalTransactions > 0 ? formatCompact(current.totalTransactions) : '—'} transactions processed.</span>
      </div>

      {/* Row 1: Main Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Transactions */}
        <div className="card p-4 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Transactions <span className="normal-case text-[var(--text-tertiary)]">(this epoch)</span></div>
              <div className="text-xl font-mono font-bold text-[var(--text-primary)]">{formatCompact(current.totalTransactions)}</div>
            </div>
            <TrendBadge values={reversed.map(e => e.totalTransactions)} />
          </div>
          <div className="space-y-0.5 text-[10px] mb-2">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Non-vote <span className="text-[var(--text-tertiary)]">(user txs)</span></span>
              <span className="font-mono text-[var(--text-secondary)]">{formatCompact(current.nonVoteTransactions)} <span className="text-[var(--text-muted)]">({current.totalTransactions > 0 ? ((current.nonVoteTransactions / current.totalTransactions) * 100).toFixed(0) : 0}%)</span></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Vote <span className="text-[var(--text-tertiary)]">(consensus)</span></span>
              <span className="font-mono text-[var(--text-tertiary)]">{formatCompact(current.voteTransactions)} <span className="text-[var(--text-muted)]">({current.totalTransactions > 0 ? ((current.voteTransactions / current.totalTransactions) * 100).toFixed(0) : 0}%)</span></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Failed</span>
              <span className="font-mono text-[var(--error)]">{formatCompact(current.failedTx)} <span className="text-[var(--text-muted)]">({(100 - current.successRate).toFixed(1)}%)</span></span>
            </div>
          </div>
          <div className="flex gap-1.5 mt-auto pt-2">
            {reversed.map((e, i) => (
              <div key={e.epoch} className="flex-1 rounded-sm group relative cursor-default" style={{ height: '32px', background: 'var(--bg-tertiary)' }}>
                {i === reversed.length - 1 && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />}
                <div className="w-full rounded-sm" style={{ height: `${(e.totalTransactions / maxTx) * 100}%`, marginTop: `${100 - (e.totalTransactions / maxTx) * 100}%`, background: i === reversed.length - 1 ? 'var(--accent)' : 'var(--text-tertiary)', opacity: i === reversed.length - 1 ? 0.9 : 0.4 + (i / reversed.length) * 0.6 }} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30 pointer-events-none">
                  <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded px-2 py-1.5 shadow-xl text-[9px] whitespace-nowrap">
                    <div className="font-medium text-[var(--text-primary)] mb-1">Epoch {e.epoch}</div>
                    <div className="space-y-0.5 text-[var(--text-muted)]">
                      <div className="flex justify-between gap-3">Total <span className="font-mono text-[var(--text-primary)]">{formatCompact(e.totalTransactions)}</span></div>
                      <div className="flex justify-between gap-3">Non-vote <span className="font-mono text-[var(--text-secondary)]">{formatCompact(e.nonVoteTransactions)}</span></div>
                      <div className="flex justify-between gap-3">Vote <span className="font-mono text-[var(--text-tertiary)]">{formatCompact(e.voteTransactions)}</span></div>
                      <div className="flex justify-between gap-3">Success <span className="font-mono text-[var(--success)]">{e.successRate.toFixed(1)}%</span></div>
                      <div className="flex justify-between gap-3">Failed <span className="font-mono text-[var(--error)]">{formatCompact(e.failedTx)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fees */}
        <div className="card p-4 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Total Fees <span className="normal-case text-[var(--text-tertiary)]">(sum)</span></div>
              <div className="text-xl font-mono font-bold text-[var(--accent)]">{formatSOL(current.totalFees)} <span className="text-xs font-normal text-[var(--text-muted)]">SOL</span></div>
            </div>
            <TrendBadge values={reversed.map(e => e.totalFees)} />
          </div>
          <div className="space-y-0.5 text-[10px] mb-2">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Base</span>
              <span className="font-mono text-[var(--text-tertiary)]">{formatSOL(current.baseFees)} <span className="text-[var(--text-muted)]">({totalFeesAndTips > 0 ? ((current.baseFees / totalFeesAndTips) * 100).toFixed(0) : 0}%)</span></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Priority</span>
              <span className="font-mono text-[var(--accent)]">{formatSOL(current.priorityFees)} <span className="text-[var(--text-muted)]">({totalFeesAndTips > 0 ? ((current.priorityFees / totalFeesAndTips) * 100).toFixed(0) : 0}%)</span></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Jito tips</span>
              <span className="font-mono text-[var(--accent-tertiary)]">{formatSOL(current.jitoTips)} <span className="text-[var(--text-muted)]">({totalFeesAndTips > 0 ? ((current.jitoTips / totalFeesAndTips) * 100).toFixed(0) : 0}%)</span></span>
            </div>
            <div className="flex items-center justify-between pt-0.5 border-t border-[var(--border-primary)]">
              <span className="text-[var(--text-muted)]">Avg/TX</span>
              <span className="font-mono text-[var(--text-secondary)]">{current.totalTransactions > 0 ? formatSOL(current.totalFees / current.totalTransactions) : '0'}</span>
            </div>
          </div>
          <div className="flex gap-1.5 mt-auto pt-2">
            {reversed.map((e, i) => {
              return (
                <div key={e.epoch} className="flex-1 rounded-sm group relative cursor-default" style={{ height: '32px', background: 'var(--bg-tertiary)' }}>
                  {i === reversed.length - 1 && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />}
                  <div className="w-full rounded-sm" style={{ height: `${(e.totalFees / maxFees) * 100}%`, marginTop: `${100 - (e.totalFees / maxFees) * 100}%`, background: i === reversed.length - 1 ? 'var(--accent)' : 'var(--accent-secondary)', opacity: i === reversed.length - 1 ? 0.9 : 0.4 + (i / reversed.length) * 0.6 }} />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30 pointer-events-none">
                    <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded px-2 py-1.5 shadow-xl text-[9px] whitespace-nowrap">
                      <div className="font-medium text-[var(--text-primary)] mb-1">Epoch {e.epoch}</div>
                      <div className="space-y-0.5 text-[var(--text-muted)]">
                        <div className="flex justify-between gap-3">Total <span className="font-mono text-[var(--accent)]">{formatSOL(e.totalFees)}</span></div>
                        <div className="flex justify-between gap-3">Base <span className="font-mono text-[var(--text-tertiary)]">{formatSOL(e.baseFees)}</span></div>
                        <div className="flex justify-between gap-3">Priority <span className="font-mono text-[var(--accent)]">{formatSOL(e.priorityFees)}</span></div>
                        <div className="flex justify-between gap-3">Jito <span className="font-mono text-[var(--accent-tertiary)]">{formatSOL(e.jitoTips)}</span></div>
                        <div className="flex justify-between gap-3 pt-0.5 border-t border-[var(--border-primary)]">Avg/TX <span className="font-mono text-[var(--text-secondary)]">{e.totalTransactions > 0 ? formatSOL(e.totalFees / e.totalTransactions) : '—'}</span></div>
                        <div className="flex justify-between gap-3">P/B ratio <span className="font-mono text-[var(--text-secondary)]">{e.avgFeeRatio.toFixed(1)}x</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Jito */}
        <div className="card p-4 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Jito MEV <span className="normal-case text-[var(--text-tertiary)]">(tips for tx ordering)</span></div>
              <div className="text-xl font-mono font-bold text-[var(--accent-tertiary)]">{formatSOL(current.jitoTips)} <span className="text-xs font-normal text-[var(--text-muted)]">SOL</span></div>
            </div>
            <TrendBadge values={reversed.map(e => e.jitoTips)} />
          </div>
          <div className="flex items-center gap-2 text-[10px] mb-2">
            <span className="text-[var(--text-muted)]">TXs</span>
            <span className="font-mono text-[var(--text-secondary)]">{formatCompact(current.jitoTransactions)}</span>
            <span className="text-[var(--text-muted)]">Avg</span>
            <span className="font-mono text-[var(--text-tertiary)]">{formatSOL(current.avgJitoTip)}</span>
          </div>
          <div className="flex gap-1.5 mt-auto pt-2">
            {reversed.map((e, i) => (
              <div key={e.epoch} className="flex-1 rounded-sm group relative cursor-default" style={{ height: '32px', background: 'var(--bg-tertiary)' }}>
                {i === reversed.length - 1 && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent-tertiary)' }} />}
                <div className="w-full rounded-sm" style={{ height: `${maxJito > 0 ? (e.jitoTips / maxJito) * 100 : 0}%`, marginTop: `${maxJito > 0 ? 100 - (e.jitoTips / maxJito) * 100 : 100}%`, background: 'var(--accent-tertiary)', opacity: i === reversed.length - 1 ? 0.9 : 0.4 + (i / reversed.length) * 0.6 }} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30 pointer-events-none">
                  <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded px-2 py-1.5 shadow-xl text-[9px] whitespace-nowrap">
                    <div className="font-medium text-[var(--text-primary)] mb-1">Epoch {e.epoch}</div>
                    <div className="space-y-0.5 text-[var(--text-muted)]">
                      <div className="flex justify-between gap-3">Total tips <span className="font-mono text-[var(--accent-tertiary)]">{formatSOL(e.jitoTips)} SOL</span></div>
                      <div className="flex justify-between gap-3">Jito TXs <span className="font-mono text-[var(--text-secondary)]">{formatCompact(e.jitoTransactions)}</span></div>
                      <div className="flex justify-between gap-3">Avg tip <span className="font-mono text-[var(--text-secondary)]">{formatSOL(e.avgJitoTip)}</span></div>
                      <div className="flex justify-between gap-3">Median tip <span className="font-mono text-[var(--text-tertiary)]">{formatSOL(e.medianJitoTip)}</span></div>
                      <div className="flex justify-between gap-3">Adoption <span className="font-mono text-[var(--accent-tertiary)]">{e.totalTransactions > 0 ? ((e.jitoTransactions / e.totalTransactions) * 100).toFixed(1) : 0}%</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compute & Efficiency */}
        {(() => {
          const cuFillPct = (current.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100;
          const wastedCUPerBlock = SOLANA_LIMITS.BLOCK_CU_LIMIT - current.avgCUPerBlock;
          const activeBlocks = current.totalSlots - current.skippedSlots;
          const totalWastedCU = wastedCUPerBlock * activeBlocks;
          const maxCUFill = Math.max(...allEpochs.map(e => e.avgCUPerBlock));
          return (
            <div className="card p-4 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Block Efficiency <span className="normal-case text-[var(--text-tertiary)]">(compute)</span></div>
                  <div className="text-xl font-mono font-bold" style={{ color: cuFillPct > 60 ? 'var(--warning)' : 'var(--success)' }}>{cuFillPct.toFixed(1)}% <span className="text-xs font-normal text-[var(--text-muted)]">CU fill</span></div>
                </div>
                <TrendBadge values={reversed.map(e => e.avgCUPerBlock)} />
              </div>
              <div className="space-y-0.5 text-[10px] mb-2">
                <div className="flex justify-between cursor-default" title={`${formatCU(current.avgCUPerBlock)} of ${formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT)} max`}>
                  <span className="text-[var(--text-muted)]">Avg CU/Block</span>
                  <span className="font-mono text-[var(--text-secondary)]">{formatCU(current.avgCUPerBlock)} <span className="text-[var(--text-muted)]">/ {formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT)}</span></span>
                </div>
                <div className="flex justify-between cursor-default" title="Unused compute capacity per block on average">
                  <span className="text-[var(--text-muted)]">Wasted CU/Block</span>
                  <span className="font-mono text-[var(--warning)]">{formatCU(wastedCUPerBlock)} <span className="text-[var(--text-muted)]">({(100 - cuFillPct).toFixed(1)}%)</span></span>
                </div>
                <div className="flex justify-between cursor-default" title="Total wasted compute units across all blocks in epoch">
                  <span className="text-[var(--text-muted)]">Total Wasted</span>
                  <span className="font-mono text-[var(--text-tertiary)]">{formatCompact(totalWastedCU)} CU</span>
                </div>
                <div className="flex justify-between cursor-default" title={`${current.packedSlots.toLocaleString()} of ${activeBlocks.toLocaleString()} blocks were >80% full`}>
                  <span className="text-[var(--text-muted)]">Packed Blocks <span className="text-[var(--text-tertiary)]">(&gt;80%)</span></span>
                  <span className="font-mono text-[var(--text-secondary)]">{formatCompact(current.packedSlots)} <span className="text-[var(--text-muted)]">({activeBlocks > 0 ? ((current.packedSlots / activeBlocks) * 100).toFixed(1) : 0}%)</span></span>
                </div>
              </div>
              {/* CU fill per epoch bar chart */}
              <div className="flex gap-1.5 mt-auto pt-2">
                {reversed.map((e, i) => {
                  const fill = (e.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100;
                  return (
                    <div key={e.epoch} className="flex-1 rounded-sm group relative cursor-default" style={{ height: '32px', background: 'var(--bg-tertiary)' }}>
                      {i === reversed.length - 1 && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: fill > 60 ? 'var(--warning)' : 'var(--success)' }} />}
                      <div className="w-full rounded-sm" style={{ height: `${maxCUFill > 0 ? (e.avgCUPerBlock / maxCUFill) * 100 : 0}%`, marginTop: `${maxCUFill > 0 ? 100 - (e.avgCUPerBlock / maxCUFill) * 100 : 100}%`, background: fill > 60 ? 'var(--warning)' : 'var(--success)', opacity: i === reversed.length - 1 ? 0.9 : 0.4 + (i / reversed.length) * 0.6 }} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30 pointer-events-none">
                        <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded px-2 py-1.5 shadow-xl text-[9px] whitespace-nowrap">
                          <div className="font-medium text-[var(--text-primary)] mb-1">Epoch {e.epoch}</div>
                          <div className="space-y-0.5 text-[var(--text-muted)]">
                            <div className="flex justify-between gap-3">CU Fill <span className="font-mono text-[var(--text-primary)]">{((e.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100).toFixed(1)}%</span></div>
                            <div className="flex justify-between gap-3">Avg CU/Block <span className="font-mono text-[var(--text-secondary)]">{formatCU(e.avgCUPerBlock)}</span></div>
                            <div className="flex justify-between gap-3">Wasted/Block <span className="font-mono text-[var(--warning)]">{formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT - e.avgCUPerBlock)}</span></div>
                            <div className="flex justify-between gap-3">Packed <span className="font-mono text-[var(--text-secondary)]">{formatCompact(e.packedSlots)}</span></div>
                            <div className="flex justify-between gap-3">Skip Rate <span className="font-mono text-[var(--text-tertiary)]">{e.skipRate.toFixed(2)}%</span></div>
                            <div className="flex justify-between gap-3">Success <span className="font-mono text-[var(--success)]">{e.successRate.toFixed(1)}%</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

    </section>
  );
}

// Epoch Detailed Analytics - Fee breakdown, CU efficiency, epoch table (for Explorer page)
function EpochDetailedAnalytics({ data }: { data: EpochAnalyticsData }) {
  if (data.isLoading || data.error || !data.currentEpoch) return null;

  const current = data.currentEpoch;
  const allEpochs = [current, ...data.previousEpochs];
  const totalFeesAndTips = current.totalFees + current.jitoTips;

  return (
    <section className="mb-8 sm:mb-10">
      <SectionHeader title="Epoch Deep Dive" subtitle={`Epoch ${current.epoch} • Fees, Compute & History`} />

      {/* Fee Breakdown */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-[var(--text-muted)] uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            Fee Breakdown
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
            <span>Epoch {current.epoch}</span>
            <span className="text-[var(--border-secondary)]">|</span>
            <span>{formatCompact(current.totalTransactions)} TXs</span>
          </div>
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)] mb-4">
          Where SOL goes: base fees (protocol, fixed), priority fees (user-set, for faster inclusion), and Jito tips (MEV, for tx ordering).
        </div>

        {/* 3 fee type cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]" />
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Base Fees</span>
            </div>
            <div className="font-mono text-lg text-[var(--text-secondary)]">{formatSOL(current.baseFees)} <span className="text-xs text-[var(--text-muted)]">SOL</span></div>
            <div className="text-[10px] text-[var(--text-tertiary)]">{totalFeesAndTips > 0 ? ((current.baseFees / totalFeesAndTips) * 100).toFixed(1) : 0}% of total revenue</div>
            <div className="mt-2 pt-2 border-t border-[var(--border-primary)] space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Rate</span><span className="font-mono text-[var(--text-tertiary)]">5,000 lamports/sig</span></div>
              <div className="flex justify-between" title="Base fees are burned (removed from supply)"><span className="text-[var(--text-muted)]">Destination</span><span className="text-[var(--warning)]">Burned</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Per TX avg</span><span className="font-mono text-[var(--text-tertiary)]">{current.totalTransactions > 0 ? formatSOL(current.baseFees / current.totalTransactions) : '—'}</span></div>
            </div>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Priority Fees</span>
            </div>
            <div className="font-mono text-lg text-[var(--accent)]">{formatSOL(current.priorityFees)} <span className="text-xs text-[var(--text-muted)]">SOL</span></div>
            <div className="text-[10px] text-[var(--text-tertiary)]">{totalFeesAndTips > 0 ? ((current.priorityFees / totalFeesAndTips) * 100).toFixed(1) : 0}% of total revenue</div>
            <div className="mt-2 pt-2 border-t border-[var(--border-primary)] space-y-0.5 text-[10px]">
              <div className="flex justify-between" title="How much more users pay beyond the base fee on average"><span className="text-[var(--text-muted)]">P/B ratio</span><span className="font-mono text-[var(--accent)]">{current.avgFeeRatio.toFixed(1)}x base</span></div>
              <div className="flex justify-between" title="Priority fees go to the block producer (validator)"><span className="text-[var(--text-muted)]">Destination</span><span className="text-[var(--accent-tertiary)]">Validator</span></div>
              <div className="flex justify-between" title={`${formatSOL(current.totalFees)} SOL / ${formatCompact(current.totalTransactions)} TXs`}><span className="text-[var(--text-muted)]">Avg fee/TX</span><span className="font-mono text-[var(--text-secondary)]">{current.totalTransactions > 0 ? formatSOL(current.totalFees / current.totalTransactions) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Priority/non-vote</span><span className="font-mono text-[var(--text-secondary)]">{current.nonVoteTransactions > 0 ? formatSOL(current.priorityFees / current.nonVoteTransactions) : '—'}</span></div>
            </div>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-tertiary)]" />
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Jito MEV Tips</span>
            </div>
            <div className="font-mono text-lg text-[var(--accent-tertiary)]">{formatSOL(current.jitoTips)} <span className="text-xs text-[var(--text-muted)]">SOL</span></div>
            <div className="text-[10px] text-[var(--text-tertiary)]">{totalFeesAndTips > 0 ? ((current.jitoTips / totalFeesAndTips) * 100).toFixed(1) : 0}% of total revenue</div>
            <div className="mt-2 pt-2 border-t border-[var(--border-primary)] space-y-0.5 text-[10px]">
              <div className="flex justify-between" title={`Average: ${formatSOL(current.avgJitoTip)} SOL`}><span className="text-[var(--text-muted)]">Median tip</span><span className="font-mono text-[var(--accent-tertiary)]">{formatSOL(current.medianJitoTip)} SOL</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Avg tip</span><span className="font-mono text-[var(--accent-tertiary)]">{formatSOL(current.avgJitoTip)} SOL</span></div>
              <div className="flex justify-between" title={`${current.jitoTransactions.toLocaleString()} of ${current.totalTransactions.toLocaleString()} TXs use Jito`}><span className="text-[var(--text-muted)]">Adoption</span><span className="font-mono text-[var(--accent-tertiary)]">{current.totalTransactions > 0 ? ((current.jitoTransactions / current.totalTransactions) * 100).toFixed(1) : 0}%</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Jito TXs</span><span className="font-mono text-[var(--text-secondary)]">{formatCompact(current.jitoTransactions)}</span></div>
            </div>
          </div>
        </div>

        {/* Per-epoch fee comparison */}
        {allEpochs.length > 1 && (
          <div className="border-t border-[var(--border-primary)] pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Fee Trend by Epoch <span className="normal-case text-[var(--text-tertiary)]">(total = protocol fees + Jito tips)</span></div>
              <div className="flex items-center gap-3 text-[9px] text-[var(--text-muted)]">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]" />Base</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--accent)]" />Priority</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--accent-tertiary)]" />Jito</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {allEpochs.map((e, i) => {
                const eTotal = e.baseFees + e.priorityFees + e.jitoTips;
                const maxEpochFees = Math.max(...allEpochs.map(ep => ep.baseFees + ep.priorityFees + ep.jitoTips)) || 1;
                return (
                  <div key={e.epoch} className={`flex items-center gap-3 text-[10px] group cursor-default ${i === 0 ? '' : 'opacity-70 hover:opacity-100'}`} title={`Base: ${eTotal > 0 ? ((e.baseFees / eTotal) * 100).toFixed(0) : 0}% | Priority: ${eTotal > 0 ? ((e.priorityFees / eTotal) * 100).toFixed(0) : 0}% | Jito: ${eTotal > 0 ? ((e.jitoTips / eTotal) * 100).toFixed(0) : 0}%`}>
                    <span className={`font-mono w-10 flex-shrink-0 ${i === 0 ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>{e.epoch}{i === 0 ? '*' : ''}</span>
                    <div className="flex-1 h-5 flex rounded overflow-hidden bg-[var(--bg-tertiary)]" style={{ maxWidth: `${(eTotal / maxEpochFees) * 100}%` }}>
                      <div className="h-full" style={{ width: `${eTotal > 0 ? (e.baseFees / eTotal) * 100 : 0}%`, background: 'var(--text-tertiary)' }} />
                      <div className="h-full" style={{ width: `${eTotal > 0 ? (e.priorityFees / eTotal) * 100 : 0}%`, background: 'var(--accent)' }} />
                      <div className="h-full" style={{ width: `${eTotal > 0 ? (e.jitoTips / eTotal) * 100 : 0}%`, background: 'var(--accent-tertiary)' }} />
                    </div>
                    <span className="font-mono w-14 text-right flex-shrink-0 text-[var(--text-tertiary)]">{formatSOL(e.totalFees)}</span>
                    <span className="font-mono w-14 text-right flex-shrink-0 text-[var(--accent-tertiary)]">{formatSOL(e.jitoTips)}</span>
                    <span className="font-mono w-14 text-right flex-shrink-0 text-[var(--text-muted)]">{formatSOL(eTotal)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-4 mt-2 text-[9px] text-[var(--text-muted)]">
              <span>* current epoch</span>
              <span className="text-[var(--text-tertiary)]">|</span>
              <span>Fees</span>
              <span className="text-[var(--accent-tertiary)]">Tips</span>
              <span className="text-[var(--text-muted)]">Total</span>
            </div>
          </div>
        )}
      </div>

      {/* Compute & Block Efficiency */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-[var(--text-muted)] uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
            Compute & Block Efficiency
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
            <span>{allEpochs.length} epochs</span>
            <span className="text-[var(--border-secondary)]">|</span>
            <span>Block limit: {formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT)}</span>
          </div>
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)] mb-4">
          How efficiently is block space being used? Avg CU fill per block, wasted compute capacity, and packed block rates across epochs.
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
              <span className="text-[10px] text-[var(--text-muted)] uppercase">CU Utilization</span>
            </div>
            <div className="font-mono text-lg" style={{ color: (current.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT * 100) > 60 ? 'var(--warning)' : 'var(--success)' }}>{(current.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">{formatCU(current.avgCUPerBlock)} avg CU/block</div>
            <div className="mt-2 pt-2 border-t border-[var(--border-primary)]">
              <div className="h-2 rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, current.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT * 100)}%`, background: (current.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT * 100) > 60 ? 'var(--warning)' : 'var(--success)' }} />
              </div>
              <div className="flex justify-between mt-0.5 text-[9px] text-[var(--text-muted)]">
                <span>0</span>
                <span>{formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT)}</span>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Wasted Compute</span>
            </div>
            {(() => {
              const wastedPerBlock = SOLANA_LIMITS.BLOCK_CU_LIMIT - current.avgCUPerBlock;
              const activeBlocks = current.totalSlots - current.skippedSlots;
              const totalWasted = wastedPerBlock * activeBlocks;
              return (
                <>
                  <div className="font-mono text-lg text-[var(--warning)]">{formatCU(wastedPerBlock)}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">wasted CU/block avg</div>
                  <div className="mt-2 pt-2 border-t border-[var(--border-primary)] space-y-0.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Total wasted</span><span className="font-mono text-[var(--text-tertiary)]">{formatCompact(totalWasted)} CU</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Active blocks</span><span className="font-mono text-[var(--text-secondary)]">{formatCompact(activeBlocks)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Waste rate</span><span className="font-mono text-[var(--warning)]">{(100 - current.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT * 100).toFixed(1)}%</span></div>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-secondary)]" />
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Network Health</span>
            </div>
            <div className="font-mono text-lg text-[var(--success)]">{current.successRate.toFixed(1)}% <span className="text-xs text-[var(--text-muted)]">success</span></div>
            <div className="text-[10px] text-[var(--text-tertiary)]">{current.avgBlockTime.toFixed(0)}ms avg block time</div>
            <div className="mt-2 pt-2 border-t border-[var(--border-primary)] space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Skip rate</span><span className={`font-mono ${current.skipRate > 5 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>{current.skipRate.toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Median block time</span><span className="font-mono text-[var(--text-secondary)]">{current.medianBlockTime.toFixed(0)}ms</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Failed TXs</span><span className="font-mono text-[var(--error)]">{formatCompact(current.failedTx)}</span></div>
            </div>
          </div>
        </div>

        {/* Per-epoch CU comparison */}
        {allEpochs.length > 1 && (
          <div className="border-t border-[var(--border-primary)] pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-[var(--text-muted)] uppercase">CU Fill Rate by Epoch</div>
              <div className="flex items-center gap-3 text-[9px] text-[var(--text-muted)]">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--success)]" />Used</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--bg-tertiary)]" />Wasted</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {allEpochs.map((e, i) => {
                const fillPct = (e.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100;
                const activeBlocksE = e.totalSlots - e.skippedSlots;
                const packedPct = activeBlocksE > 0 ? (e.packedSlots / activeBlocksE) * 100 : 0;
                return (
                  <div key={e.epoch} className={`flex items-center gap-3 text-[10px] group cursor-default relative ${i === 0 ? '' : 'opacity-70 hover:opacity-100'}`}>
                    <span className={`font-mono w-10 flex-shrink-0 ${i === 0 ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>{e.epoch}{i === 0 ? '*' : ''}</span>
                    <div className="flex-1 h-5 rounded overflow-hidden bg-[var(--bg-tertiary)]">
                      <div className="h-full rounded" style={{ width: `${fillPct}%`, background: fillPct > 60 ? 'var(--warning)' : 'var(--success)', opacity: 0.8 }} />
                    </div>
                    <span className="font-mono w-12 text-right flex-shrink-0" style={{ color: fillPct > 60 ? 'var(--warning)' : 'var(--success)' }}>{fillPct.toFixed(1)}%</span>
                    <span className="font-mono w-16 text-right flex-shrink-0 text-[var(--text-tertiary)]">{formatCU(e.avgCUPerBlock)}</span>
                    <span className="font-mono w-12 text-right flex-shrink-0 text-[var(--text-muted)]" title={`${formatCompact(e.packedSlots)} packed blocks`}>{packedPct.toFixed(0)}% pk</span>
                    {/* Hover tooltip */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block z-30 pointer-events-none">
                      <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded px-2.5 py-2 shadow-xl text-[9px] whitespace-nowrap">
                        <div className="font-medium text-[var(--text-primary)] mb-1.5">Epoch {e.epoch}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[var(--text-muted)]">
                          <span>Total TXs</span><span className="font-mono text-[var(--text-primary)] text-right">{formatCompact(e.totalTransactions)}</span>
                          <span>Non-vote</span><span className="font-mono text-[var(--text-secondary)] text-right">{formatCompact(e.nonVoteTransactions)}</span>
                          <span>Failed</span><span className="font-mono text-[var(--error)] text-right">{formatCompact(e.failedTx)}</span>
                          <span>Success rate</span><span className="font-mono text-[var(--success)] text-right">{e.successRate.toFixed(1)}%</span>
                          <span className="pt-0.5 border-t border-[var(--border-primary)]">Avg block time</span><span className="font-mono text-[var(--text-secondary)] text-right pt-0.5 border-t border-[var(--border-primary)]">{e.avgBlockTime.toFixed(0)}ms</span>
                          <span>Skip rate</span><span className="font-mono text-[var(--warning)] text-right">{e.skipRate.toFixed(2)}%</span>
                          <span className="pt-0.5 border-t border-[var(--border-primary)]">Total fees</span><span className="font-mono text-[var(--accent)] text-right pt-0.5 border-t border-[var(--border-primary)]">{formatSOL(e.totalFees)} SOL</span>
                          <span>Priority fees</span><span className="font-mono text-[var(--accent)] text-right">{formatSOL(e.priorityFees)} SOL</span>
                          <span>Jito tips</span><span className="font-mono text-[var(--accent-tertiary)] text-right">{formatSOL(e.jitoTips)} SOL</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-4 mt-2 text-[9px] text-[var(--text-muted)]">
              <span>* current epoch</span>
              <span className="text-[var(--border-secondary)]">|</span>
              <span>Fill %</span>
              <span className="text-[var(--text-tertiary)]">Avg CU</span>
              <span className="text-[var(--text-muted)]">Packed %</span>
            </div>
          </div>
        )}
      </div>

    </section>
  );
}

// Compact Real-Time Analytics Section
function AnalyticsSection({
  blocks,
  transactions,
}: {
  blocks: SlotData[];
  transactions: TransactionInfo[];
}) {
  const feeStats = useMemo(() => {
    if (transactions.length === 0) return null;
    const fees = transactions.map(tx => tx.fee);
    const sorted = [...fees].sort((a, b) => a - b);
    const total = fees.reduce((a, b) => a + b, 0);
    return {
      total: total / 1e9,
      avg: (total / fees.length) / 1e9,
      median: sorted[Math.floor(sorted.length / 2)] / 1e9,
      min: sorted[0] / 1e9,
      max: sorted[sorted.length - 1] / 1e9,
      count: fees.length,
    };
  }, [transactions]);

  const blockEfficiency = useMemo(() => {
    if (blocks.length === 0) return null;
    const cuUsages = blocks.map(b => (b.totalCU || 0) / SOLANA_LIMITS.BLOCK_CU_LIMIT * 100);
    const avgCU = cuUsages.reduce((a, b) => a + b, 0) / cuUsages.length;
    const avgTx = blocks.reduce((s, b) => s + b.txCount, 0) / blocks.length;
    return { avgCU, maxCU: Math.max(...cuUsages), avgTx };
  }, [blocks]);

  const cuDistribution = useMemo(() => {
    if (transactions.length === 0) return [];
    return CU_CATEGORIES.map(cat => ({
      ...cat,
      count: transactions.filter(tx => tx.computeUnits >= cat.min && tx.computeUnits < cat.max).length,
      percent: (transactions.filter(tx => tx.computeUnits >= cat.min && tx.computeUnits < cat.max).length / transactions.length) * 100,
    }));
  }, [transactions]);

  const feePercentiles = useMemo(() => {
    if (transactions.length === 0) return null;
    const fees = transactions.map(tx => tx.fee).sort((a, b) => a - b);
    const p = (pct: number) => fees[Math.floor(fees.length * pct / 100)] || 0;
    const baseFee = 5000;
    const buckets = [
      { name: 'Base Only', max: baseFee * 1.1, count: 0, color: '#6b7280', desc: '5,000 L' },
      { name: 'Low', max: baseFee * 2, count: 0, color: '#4ade80', desc: '<10k L' },
      { name: 'Medium', max: baseFee * 10, count: 0, color: '#60a5fa', desc: '<50k L' },
      { name: 'High', max: baseFee * 100, count: 0, color: '#f59e0b', desc: '<500k L' },
      { name: 'Urgent', max: Infinity, count: 0, color: '#ef4444', desc: '500k+ L' },
    ];
    for (const tx of transactions) {
      for (const b of buckets) { if (tx.fee <= b.max) { b.count++; break; } }
    }
    return { p25: p(25) / 1e9, p50: p(50) / 1e9, p75: p(75) / 1e9, p90: p(90) / 1e9, p99: p(99) / 1e9, buckets };
  }, [transactions]);

  const estimatedSeconds = blocks.length * 0.4;

  return (
    <section id="analytics" className="mb-10">
      <SectionHeader title="Real-Time Analytics" subtitle={`Last ${blocks.length} blocks • ${transactions.length.toLocaleString()} transactions • ~${estimatedSeconds.toFixed(0)}s of activity`} />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Card 1: Fee Analysis + TX Patterns */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            Fee Analysis
          </div>

          {!feeStats && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-[var(--text-muted)]">
              <div className="spinner" style={{ width: 16, height: 16 }} />
              Loading fee data...
            </div>
          )}
          {feeStats && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Total Fees <span className="text-[var(--text-tertiary)]">(sum)</span></div>
                  <div className="font-mono text-sm text-[var(--accent)]">{feeStats.total.toFixed(4)} <span className="text-[9px] text-[var(--text-muted)]">SOL</span></div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Avg Fee <span className="text-[var(--text-tertiary)]">(per tx)</span></div>
                  <div className="font-mono text-sm text-[var(--text-secondary)]">{feeStats.avg.toFixed(6)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Median Fee <span className="text-[var(--text-tertiary)]">(p50)</span></div>
                  <div className="font-mono text-sm text-[var(--text-secondary)]">{feeStats.median.toFixed(6)}</div>
                </div>
              </div>

              {/* Fee range */}
              <div>
                <div className="flex justify-between text-[9px] text-[var(--text-muted)] mb-0.5">
                  <span>{feeStats.min.toFixed(6)}</span>
                  <span>{feeStats.max.toFixed(6)}</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full relative">
                  <div className="absolute h-full bg-[var(--accent)]/20 rounded-full w-full" />
                  <div className="absolute h-full w-0.5 bg-[var(--accent)]" style={{ left: `${((feeStats.median - feeStats.min) / (feeStats.max - feeStats.min || 1)) * 100}%` }} title="Median" />
                </div>
              </div>

              {/* Priority distribution */}
              {feePercentiles && (
                <div className="pt-2 border-t border-[var(--border-primary)]">
                  <div className="flex gap-2 text-[10px] mb-2">
                    {['p25', 'p50', 'p75', 'p90', 'p99'].map(k => (
                      <div key={k} className="flex-1 bg-[var(--bg-secondary)] rounded px-1.5 py-1 text-center">
                        <div className="text-[var(--text-muted)]">{k}</div>
                        <div className="font-mono text-[var(--text-secondary)] text-[9px]">{(feePercentiles[k as keyof typeof feePercentiles] as number).toFixed(6)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {feePercentiles.buckets.map(b => {
                      const pct = transactions.length > 0 ? (b.count / transactions.length) * 100 : 0;
                      return (
                        <div key={b.name} className="flex items-center gap-1.5 text-[10px]" title={`${b.name}: up to ${b.desc} (lamports)`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                          <span className="text-[var(--text-muted)] w-14">{b.name}</span>
                          <span className="text-[var(--text-tertiary)] w-10 text-[9px]">{b.desc}</span>
                          <div className="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: b.color, opacity: 0.8 }} />
                          </div>
                          <span className="font-mono text-[var(--text-tertiary)] w-6 text-right">{b.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Card 2: CU Distribution + Block Efficiency */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-secondary)]" />
            Compute & Block Efficiency
          </div>

          {/* CU distribution */}
          {cuDistribution.length === 0 && !blockEfficiency && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-[var(--text-muted)]">
              <div className="spinner" style={{ width: 16, height: 16 }} />
              Loading block data...
            </div>
          )}
          {cuDistribution.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {cuDistribution.map(cat => (
                <div key={cat.name} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-[10px] text-[var(--text-muted)] w-12">{cat.name}</span>
                  <span className="text-[9px] text-[var(--text-tertiary)] w-12">{cat.range}</span>
                  <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] w-12 text-right">{cat.count} <span className="text-[8px]">({cat.percent.toFixed(0)}%)</span></span>
                </div>
              ))}
            </div>
          )}

          {/* Block efficiency */}
          {blockEfficiency && (
            <div className="pt-3 border-t border-[var(--border-primary)]">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Avg CU Fill <span className="text-[var(--text-tertiary)]">(per block)</span></div>
                  <div className="font-mono text-sm text-[var(--accent-secondary)]">{blockEfficiency.avgCU.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Peak Fill <span className="text-[var(--text-tertiary)]">(max)</span></div>
                  <div className="font-mono text-sm text-[var(--text-secondary)]">{blockEfficiency.maxCU.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Avg TX/Block <span className="text-[var(--text-tertiary)]">(mean)</span></div>
                  <div className="font-mono text-sm text-[var(--text-secondary)]">{Math.round(blockEfficiency.avgTx)}</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[9px] text-[var(--text-muted)] mb-0.5">
                  <span>Capacity Used</span>
                  <span>{(100 - blockEfficiency.avgCU).toFixed(1)}% available</span>
                </div>
                <div className="h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent-secondary)] rounded-full" style={{ width: `${blockEfficiency.avgCU}%` }} />
                </div>
                <div className="flex justify-between text-[9px] mt-0.5">
                  <span className="text-[var(--accent-secondary)]">{formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT * blockEfficiency.avgCU / 100)}</span>
                  <span className="text-[var(--text-muted)]">{formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT * (100 - blockEfficiency.avgCU) / 100)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Leader Schedule Panel - Simple data-focused view of upcoming block producers
function LeaderSchedulePanel({
  leaderSchedule,
  currentSlot,
  getValidatorName,
  getValidatorMetadata,
}: {
  leaderSchedule: LeaderScheduleInfo | null;
  currentSlot: number;
  getValidatorName: (pubkey: string) => string | null;
  getValidatorMetadata: (pubkey: string) => ValidatorMetadata | null;
  validatorCount?: number;
}) {
  // Track leader transitions for animation (hooks MUST be before early return)
  const prevLeaderSlotRef = useRef<number | null>(null);
  const prevLeaderPubkeyRef = useRef<string | null>(null);
  const [consecutiveCount, setConsecutiveCount] = useState(1);
  const [totalBlocksProduced, setTotalBlocksProduced] = useState(0);
  const transitionKeyRef = useRef(0);

  const currentLeaderSlot = leaderSchedule?.upcomingLeaders?.[0]?.slot ?? null;
  const currentLeaderPubkey = leaderSchedule?.upcomingLeaders?.[0]?.leader ?? null;

  useEffect(() => {
    if (currentLeaderSlot !== null && currentLeaderSlot !== prevLeaderSlotRef.current) {
      if (prevLeaderSlotRef.current !== null) {
        setTotalBlocksProduced(n => n + 1);
        if (currentLeaderPubkey === prevLeaderPubkeyRef.current) {
          setConsecutiveCount(c => c + 1);
        } else {
          setConsecutiveCount(1);
        }
        transitionKeyRef.current += 1;
      }
      prevLeaderSlotRef.current = currentLeaderSlot;
      prevLeaderPubkeyRef.current = currentLeaderPubkey;
    }
  }, [currentLeaderSlot, currentLeaderPubkey]);


  if (!leaderSchedule) {
    return (
      <div className="card p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />
          <div className="text-[var(--text-muted)] text-sm">Loading leader schedule...</div>
        </div>
      </div>
    );
  }

  // Get leaders with names and metadata
  const leaders = leaderSchedule.upcomingLeaders.slice(0, 12).map(entry => {
    const metadata = getValidatorMetadata(entry.leader);
    return {
      ...entry,
      name: metadata?.name || getValidatorName(entry.leader) || entry.leader.slice(0, 8) + '...',
      shortName: (metadata?.name || getValidatorName(entry.leader) || entry.leader).slice(0, 12),
      logo: metadata?.logo,
      location: metadata?.location,
    };
  });

  const currentLeader = leaders[0];
  const upcomingLeaders = leaders.slice(1);
  const estimateTime = (relativeSlot: number) => {
    const seconds = (relativeSlot * 0.4);
    if (seconds < 60) return `~${Math.round(seconds)}s`;
    return `~${(seconds / 60).toFixed(1)}m`;
  };

  // Avatar helper
  const Avatar = ({ pubkey, logo, name, size, className: cls }: { pubkey: string; logo?: string; name: string; size: number; className?: string }) => (
    <div className={`relative flex-shrink-0 ${cls || ''}`}>
      {logo ? (
        <img
          src={logo}
          alt={name}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
        />
      ) : null}
      <div
        className={`rounded-full flex items-center justify-center text-white font-bold ${logo ? 'hidden' : ''}`}
        style={{ width: size, height: size, fontSize: Math.max(8, size / 3), background: getAvatarGradient(pubkey) }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    </div>
  );

  return (
    <div className="card p-4">
      {/* Current Leader — clean horizontal row */}
      {currentLeader && (
        <div
          key={`current-${transitionKeyRef.current}`}
          className="flex items-center gap-3"
          style={{ animation: transitionKeyRef.current > 0 ? 'leaderCardEnter 0.2s cubic-bezier(0.22, 1, 0.36, 1) both' : undefined }}
        >
          <div className="relative flex-shrink-0">
            <Avatar pubkey={currentLeader.leader} logo={currentLeader.logo} name={currentLeader.name} size={44} />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--accent-tertiary)] flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </span>
            {consecutiveCount > 1 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-[var(--accent)] flex items-center justify-center text-[9px] font-bold text-white px-1" style={{ animation: 'leaderCardEnter 0.15s ease-out both' }}>
                x{consecutiveCount}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{currentLeader.name}</span>
              {currentLeader.location && <span className="text-[10px] text-[var(--text-tertiary)]">{formatLocation(currentLeader.location)}</span>}
              {totalBlocksProduced > 0 && <span className="text-[9px] text-[var(--text-muted)] font-mono">#{totalBlocksProduced}</span>}
            </div>
            {/* 4-slot progress bar */}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => {
                  const slotInSequence = currentSlot - currentLeader.slot;
                  const done = i < slotInSequence;
                  const active = i === slotInSequence;
                  return (
                    <div key={i} className="w-6 h-1.5 rounded-full transition-all duration-300" style={{
                      backgroundColor: done || active ? 'var(--accent-tertiary)' : 'var(--bg-tertiary)',
                      opacity: done ? 1 : active ? 0.6 : 0.25,
                    }} />
                  );
                })}
              </div>
              <span className="text-[9px] text-[var(--text-muted)] font-mono">{Math.min(4, Math.max(0, currentSlot - currentLeader.slot))}/4</span>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Leaders — horizontal strip */}
      {upcomingLeaders.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pt-3 mt-3 border-t border-[var(--border-primary)]/40" style={{ scrollbarWidth: 'none' }}>
          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider flex-shrink-0 font-medium">Next</span>
          {upcomingLeaders.map((leader, idx) => (
            <div
              key={`future-${leader.slot}`}
              className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-md bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] transition-colors"
              style={{ animation: transitionKeyRef.current > 0 ? `rowSlideIn 0.15s ease-out ${idx * 0.02}s both` : undefined }}
            >
              <Avatar pubkey={leader.leader} logo={leader.logo} name={leader.name} size={20} />
              <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-[80px]">{leader.shortName}</span>
              <span className="text-[9px] text-[var(--text-muted)] font-mono">{estimateTime(leader.relativeSlot)}</span>
            </div>
          ))}
        </div>
      )}

      {!currentLeader && upcomingLeaders.length === 0 && (
        <div className="text-center text-sm text-[var(--text-muted)] py-4">Loading upcoming leaders...</div>
      )}
    </div>
  );
}

// Network Health Section - Visual health indicators
// Failed Transactions Analysis
function FailedTransactionsAnalysis({ blocks, networkHistory, accumulated }: {
  blocks: SlotData[];
  networkHistory: { currentEpoch: EpochNetworkStats | null; previousEpochs: EpochNetworkStats[]; isLoading: boolean; error: string | null };
  accumulated: FailureAccumulation;
}) {

  const analysis = useMemo(() => {
    const failedTxs: Array<{
      signature: string;
      slot: number;
      programs: string[];
      cu: number;
      fee: number;
      category: string;
      feePayer: string;
    }> = [];

    const failuresByCategory = new Map<string, number>();
    let totalFailed = 0;
    let totalTxs = 0;
    let wastedCU = 0;
    let wastedFees = 0;
    let totalCU = 0;
    let totalFees = 0;

    for (const block of blocks) {
      if (!block.transactions) continue;

      for (const tx of block.transactions) {
        totalTxs++;
        totalCU += tx.computeUnits;
        totalFees += tx.fee;

        if (!tx.success) {
          totalFailed++;
          wastedCU += tx.computeUnits;
          wastedFees += tx.fee;
          const category = getTxCategory(tx.programs);
          failuresByCategory.set(category, (failuresByCategory.get(category) || 0) + 1);

          if (failedTxs.length < 15) {
            failedTxs.push({
              signature: tx.signature,
              slot: block.slot,
              programs: tx.programs,
              cu: tx.computeUnits,
              fee: tx.fee,
              category,
              feePayer: tx.feePayer,
            });
          }
        }
      }

    }

    const categoryBreakdown = Array.from(failuresByCategory.entries())
      .sort((a, b) => b[1] - a[1]);

    return {
      failedTxs,
      totalFailed,
      totalTxs,
      failureRate: totalTxs > 0 ? (totalFailed / totalTxs) * 100 : 0,
      categoryBreakdown,
      wastedCU,
      wastedFees,
      totalCU,
      totalFees,
    };
  }, [blocks]);

  const historicalBaseline = useMemo(() => {
    if (networkHistory.isLoading || !networkHistory.currentEpoch) return null;
    const allEpochs = [networkHistory.currentEpoch, ...networkHistory.previousEpochs];
    const reversed = allEpochs.slice().reverse(); // oldest first for chart
    const failureRates = allEpochs.map(e => 100 - e.successRate);
    const avgFailureRate = failureRates.reduce((s, r) => s + r, 0) / failureRates.length;
    const currentFailureRate = 100 - networkHistory.currentEpoch.successRate;
    const maxFailureRate = Math.max(...failureRates, 0.1);
    const formatNum = (n: number) => {
      if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
      if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
      if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
      return n.toLocaleString();
    };
    return {
      allEpochs: reversed,
      avgFailureRate,
      currentFailureRate,
      currentFailedTx: networkHistory.currentEpoch.failedTx,
      currentTotalTx: networkHistory.currentEpoch.totalTransactions,
      maxFailureRate,
      epochCount: allEpochs.length,
      formatNum,
    };
  }, [networkHistory]);


  if (blocks.length === 0) {
    return (
      <section id="failures" className="mb-10">
        <SectionHeader title="Failed Transactions" subtitle="Loading blocks..." />
        <div className="card p-8 flex items-center justify-center gap-3 text-[var(--text-muted)]">
          <div className="spinner" />
          <span>Fetching block data...</span>
        </div>
      </section>
    );
  }

  if (analysis.totalFailed === 0) {
    return (
      <section id="failures" className="mb-10">
        <SectionHeader title="Failed Transactions" subtitle={`Last ${blocks.length} blocks • ${analysis.totalTxs.toLocaleString()} total transactions`} />
        <div className="card p-6 text-center">
          <div className="text-4xl mb-2">✓</div>
          <div className="text-[var(--success)] font-medium">No Failed Transactions</div>
          <div className="text-sm text-[var(--text-muted)]">
            All {analysis.totalTxs.toLocaleString()} transactions in the last {blocks.length} blocks succeeded
          </div>
        </div>
      </section>
    );
  }

  const slotRange = blocks.length > 0
    ? { min: Math.min(...blocks.map(b => b.slot)), max: Math.max(...blocks.map(b => b.slot)) }
    : null;

  return (
    <section id="failures" className="mb-10">
      <SectionHeader title="Failed Transactions" subtitle={`Real-time analysis • ${analysis.totalTxs.toLocaleString()} transactions scanned`} />

      {/* Historical Baseline */}
      {historicalBaseline && (() => {
        const hb = historicalBaseline;
        const delta = analysis.failureRate - hb.avgFailureRate;
        const isAbove = delta > 0;
        return (
          <div className="card p-4 mb-4 animate-section">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-secondary)]" />
              Historical Baseline <span className="normal-case text-[var(--text-tertiary)]">(epoch-level context)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
              {/* Left: stat cards */}
              <div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5">
                    <div className="text-[9px] text-[var(--text-muted)] uppercase mb-1">Epoch Avg Failure Rate</div>
                    <div className="text-lg font-mono text-[var(--text-primary)]">{hb.avgFailureRate.toFixed(2)}%</div>
                    <div className="text-[9px] text-[var(--text-tertiary)]">across {hb.epochCount} epochs</div>
                  </div>
                  <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5">
                    <div className="text-[9px] text-[var(--text-muted)] uppercase mb-1">Current Epoch</div>
                    <div className="text-lg font-mono" style={{ color: hb.currentFailureRate > hb.avgFailureRate ? 'var(--error)' : 'var(--success)' }}>{hb.currentFailureRate.toFixed(2)}%</div>
                    <div className="text-[9px] text-[var(--text-tertiary)]">failure rate</div>
                  </div>
                  <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5">
                    <div className="text-[9px] text-[var(--text-muted)] uppercase mb-1">Failed TXs (Epoch)</div>
                    <div className="text-lg font-mono text-[var(--error)]">{hb.formatNum(hb.currentFailedTx)}</div>
                    <div className="text-[9px] text-[var(--text-tertiary)]">of {hb.formatNum(hb.currentTotalTx)} total</div>
                  </div>
                </div>
                {/* Comparison callout */}
                <div className="text-xs px-2.5 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                  <span className="text-[var(--text-muted)]">Live failure rate </span>
                  <span className="font-mono text-[var(--text-primary)]">{analysis.failureRate.toFixed(2)}%</span>
                  <span className="text-[var(--text-muted)]"> is </span>
                  <span className="font-mono" style={{ color: isAbove ? 'var(--error)' : 'var(--success)' }}>{Math.abs(delta).toFixed(2)}pp {isAbove ? 'above' : 'below'}</span>
                  <span className="text-[var(--text-muted)]"> the epoch average — </span>
                  <span style={{ color: isAbove ? 'var(--error)' : 'var(--success)' }}>{isAbove ? 'Higher than usual' : 'Within normal range'}</span>
                </div>
              </div>
              {/* Right: failure rate sparkline */}
              <div className="flex flex-col items-center min-w-[120px]">
                <div className="text-[9px] text-[var(--text-muted)] uppercase mb-1.5">Failure Rate Trend</div>
                <div className="flex items-end gap-1 h-[60px]">
                  {hb.allEpochs.map((e, i) => {
                    const rate = 100 - e.successRate;
                    const heightPct = (rate / hb.maxFailureRate) * 100;
                    const isCurrent = i === hb.allEpochs.length - 1;
                    return (
                      <div key={e.epoch} className="flex-1 min-w-[14px] group relative cursor-default flex items-end" style={{ height: '60px' }}>
                        <div className="w-full rounded-sm" style={{ height: `${Math.max(heightPct, 2)}%`, background: isCurrent ? 'var(--error)' : 'var(--text-tertiary)', opacity: isCurrent ? 1 : 0.3 + (i / hb.allEpochs.length) * 0.5 }} />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30 pointer-events-none">
                          <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded px-2 py-1.5 shadow-xl text-[9px] whitespace-nowrap">
                            <div className="font-medium text-[var(--text-primary)] mb-1">Epoch {e.epoch}</div>
                            <div className="space-y-0.5 text-[var(--text-muted)]">
                              <div className="flex justify-between gap-3">Failure Rate <span className="font-mono text-[var(--error)]">{rate.toFixed(2)}%</span></div>
                              <div className="flex justify-between gap-3">Failed <span className="font-mono text-[var(--text-primary)]">{hb.formatNum(e.failedTx)}</span></div>
                              <div className="flex justify-between gap-3">Total <span className="font-mono text-[var(--text-secondary)]">{hb.formatNum(e.totalTransactions)}</span></div>
                              <div className="flex justify-between gap-3">Success <span className="font-mono text-[var(--success)]">{e.successRate.toFixed(1)}%</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Data scope context banner */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 mb-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[var(--text-muted)] uppercase font-medium">Live Snapshot</span>
        </div>
        <span className="text-[var(--text-muted)]">Blocks: <span className="font-mono text-[var(--text-secondary)]">{blocks.length}</span></span>
        {slotRange && (
          <span className="text-[var(--text-muted)]">Slots: <span className="font-mono text-[var(--text-secondary)]">{slotRange.min.toLocaleString()}–{slotRange.max.toLocaleString()}</span></span>
        )}
        <span className="text-[var(--text-muted)]">TXs scanned: <span className="font-mono text-[var(--text-secondary)]">{analysis.totalTxs.toLocaleString()}</span></span>
        <span className="text-[var(--text-muted)]">Refresh: <span className="font-mono text-[var(--text-secondary)]">~2s</span></span>
        <span className="text-[var(--text-tertiary)]">This is a narrow real-time window, not historical data.</span>
      </div>

      {/* Row 1: Overview + Cost of Failures */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Failure Overview */}
        <div className="card p-4 animate-section">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--error)]" />
            Failure Overview
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-3xl font-mono text-[var(--error)]">{analysis.totalFailed}</div>
            <div>
              <div className="text-sm text-[var(--text-secondary)]">Failed TXs <span className="text-[var(--text-tertiary)] text-xs">(count)</span></div>
              <div className="text-xs text-[var(--text-muted)]">of {analysis.totalTxs.toLocaleString()} total ({analysis.failureRate.toFixed(2)}% failure rate)</div>
              {historicalBaseline && (() => {
                const delta = analysis.failureRate - historicalBaseline.avgFailureRate;
                const isAbove = delta > 0;
                return (
                  <div className="text-[10px] mt-0.5">
                    <span className="font-mono" style={{ color: isAbove ? 'var(--error)' : 'var(--success)' }}>{isAbove ? '+' : ''}{delta.toFixed(2)}pp</span>
                    <span className="text-[var(--text-tertiary)]"> vs epoch avg ({historicalBaseline.avgFailureRate.toFixed(2)}%)</span>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-3">
            <div className="h-full bg-[var(--error)] rounded-full" style={{ width: `${Math.min(100, analysis.failureRate * 10)}%` }} />
          </div>

          <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1.5">Failures by Category <span className="normal-case text-[var(--text-tertiary)]">(tx type)</span></div>
          <div className="space-y-1">
            {analysis.categoryBreakdown.map(([cat, count]) => {
              const pct = analysis.totalFailed > 0 ? (count / analysis.totalFailed) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                  <span className="text-[var(--text-secondary)] capitalize w-14">{cat}</span>
                  <div className="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--error)]/60" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[var(--text-muted)] w-14 text-right">{count} <span className="text-[var(--text-tertiary)]">({pct.toFixed(0)}%)</span></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost of Failures */}
        <div className="card p-4 animate-section" style={{ animationDelay: '0.1s' }}>
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
            Cost of Failures <span className="normal-case text-[var(--text-tertiary)]">(wasted resources)</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3" title="Compute units consumed by failed transactions that produced no useful result">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Wasted CU</div>
              <div className="font-mono text-lg text-[var(--warning)]">{formatCU(analysis.wastedCU)}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                {((analysis.wastedCU / (SOLANA_LIMITS.BLOCK_CU_LIMIT * blocks.length)) * 100).toFixed(2)}% of block capacity
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3" title="Fees paid for transactions that ultimately failed - still charged to the sender">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Burned Fees</div>
              <div className="font-mono text-lg text-[var(--warning)]">{(analysis.wastedFees / 1e9).toFixed(6)} <span className="text-xs text-[var(--text-muted)]">SOL</span></div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                still charged to senders
              </div>
            </div>
          </div>

          {/* CU waste proportion bar */}
          <div className="mb-3">
            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">CU Distribution (useful vs wasted)</div>
            <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex progress-animated">
              <div className="h-full bg-[var(--success)]/60 transition-all duration-700" style={{ width: `${analysis.totalCU > 0 ? ((analysis.totalCU - analysis.wastedCU) / analysis.totalCU) * 100 : 100}%` }} title={`Useful: ${formatCU(analysis.totalCU - analysis.wastedCU)}`} />
              <div className="h-full bg-[var(--error)]/80 transition-all duration-700" style={{ width: `${analysis.totalCU > 0 ? (analysis.wastedCU / analysis.totalCU) * 100 : 0}%` }} title={`Wasted: ${formatCU(analysis.wastedCU)}`} />
            </div>
            <div className="flex justify-between text-[9px] mt-0.5">
              <span className="text-[var(--success)]">{analysis.totalCU > 0 ? (((analysis.totalCU - analysis.wastedCU) / analysis.totalCU) * 100).toFixed(1) : '100'}% useful</span>
              <span className="text-[var(--error)]">{analysis.totalCU > 0 ? ((analysis.wastedCU / analysis.totalCU) * 100).toFixed(1) : '0'}% wasted</span>
            </div>
          </div>

          {/* Fee waste proportion bar */}
          <div className="mb-3">
            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Fees (successful vs burned)</div>
            <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex">
              <div className="h-full bg-[var(--accent)]/60" style={{ width: `${analysis.totalFees > 0 ? ((analysis.totalFees - analysis.wastedFees) / analysis.totalFees) * 100 : 100}%` }} />
              <div className="h-full bg-[var(--error)]/80" style={{ width: `${analysis.totalFees > 0 ? (analysis.wastedFees / analysis.totalFees) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between text-[9px] mt-0.5">
              <span className="text-[var(--accent)]">{analysis.totalFees > 0 ? (((analysis.totalFees - analysis.wastedFees) / analysis.totalFees) * 100).toFixed(1) : '100'}% for successful TXs</span>
              <span className="text-[var(--error)]">{analysis.totalFees > 0 ? ((analysis.wastedFees / analysis.totalFees) * 100).toFixed(1) : '0'}% burned</span>
            </div>
          </div>

          <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1.5">Avg per Failed TX</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">CU used</span>
              <span className="font-mono text-[var(--text-secondary)]">{analysis.totalFailed > 0 ? formatCU(Math.round(analysis.wastedCU / analysis.totalFailed)) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Fee paid</span>
              <span className="font-mono text-[var(--text-secondary)]">{analysis.totalFailed > 0 ? Math.round(analysis.wastedFees / analysis.totalFailed).toLocaleString() : '—'} <span className="text-[var(--text-tertiary)]">lamports</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* All Failing Programs (full width) — accumulated across session */}
      <div className="card p-4 mb-4 animate-section">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--error)] live-dot" />
            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-medium">All Failing Programs</span>
            <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">{accumulated.programRates.length}</span>
          </div>
          <span className="text-[9px] text-[var(--text-tertiary)]">
            {accumulated.totalBlocks} blocks since {accumulated.sessionStart} ({accumulated.totalTxs.toLocaleString()} txs)
          </span>
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)] mb-3">
          Accumulated across this session: every program with at least one failure since page load.
          Bar = relative failure count. Count = failed/total calls. Rate = failure %.
        </div>

        {/* Column labels */}
        {accumulated.programRates.length > 0 && (
          <div className="flex items-center gap-2.5 px-2 mb-1.5 text-[9px] text-[var(--text-muted)] uppercase tracking-wide">
            <span className="w-5 flex-shrink-0 text-right">#</span>
            <span className="w-28 flex-shrink-0">Program</span>
            <span className="flex-1">Failure count <span className="normal-case text-[var(--text-tertiary)]">(relative to #1)</span></span>
            <span className="w-16 text-right flex-shrink-0">Failed/Total</span>
            <span className="w-14 text-center flex-shrink-0">Fail Rate</span>
          </div>
        )}

        {accumulated.programRates.length > 0 ? (
          <div className="max-h-[420px] overflow-y-auto pr-1 space-y-px">
            {accumulated.programRates.map(({ prog, failCount, total, rate }, idx) => {
              const info = getProgramInfo(prog);
              const maxFails = accumulated.programRates[0]?.failCount || 1;
              const barWidth = Math.max(3, (failCount / maxFails) * 100);

              // Rate severity badge
              const rateBadge = rate > 50
                ? { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--error)' }
                : rate > 20
                  ? { bg: 'rgba(245, 158, 11, 0.12)', text: 'var(--warning)' }
                  : { bg: 'rgba(196, 181, 253, 0.1)', text: 'var(--text-muted)' };

              return (
                <div
                  key={prog}
                  className="program-row flex items-center gap-2.5 py-2 px-2 rounded-lg animate-row"
                  style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                >
                  <span className={`text-[10px] w-5 text-right flex-shrink-0 font-mono ${idx < 3 ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
                    {idx + 1}
                  </span>
                  <a
                    href={getSolscanUrl('account', prog)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 w-28 flex-shrink-0 group/link"
                    title={`${info.name}\n${prog}\n${failCount} failures / ${total} total calls (${rate.toFixed(1)}%)`}
                  >
                    <span className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ backgroundColor: info.color }} />
                    <span className="text-[11px] text-[var(--text-secondary)] truncate group-hover/link:text-[var(--accent-secondary)] group-hover/link:underline">
                      {info.name}
                    </span>
                  </a>

                  {/* Bar */}
                  <div className="flex-1 h-6 rounded-md overflow-hidden relative bg-[var(--bg-tertiary)]/30">
                    <div
                      className="h-full rounded-md animate-bar"
                      style={{
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${info.color}cc 0%, ${info.color}40 100%)`,
                        animationDelay: `${Math.min(idx * 40, 400)}ms`,
                      }}
                    />
                    {barWidth > 14 && (
                      <span className="absolute inset-y-0 left-2.5 flex items-center text-[10px] font-mono font-semibold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {failCount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Count */}
                  <div className="w-16 flex-shrink-0 text-right">
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">{failCount}</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">/{total}</span>
                  </div>

                  {/* Rate badge */}
                  <span
                    className="text-[10px] font-mono w-14 text-center flex-shrink-0 py-0.5 rounded"
                    style={{ backgroundColor: rateBadge.bg, color: rateBadge.text }}
                  >
                    {rate.toFixed(1)}%
                  </span>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-[var(--text-muted)] py-6 text-sm">No program-specific failures detected</div>
        )}
        {accumulated.programRates.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[9px] text-[var(--text-tertiary)]">
              <div>
                <span className="text-[var(--text-muted)] uppercase font-medium">High rate (&gt;50%)</span>
                <span className="block mt-0.5">Likely a program bug, expired parameters, or misconfigured slippage. Users are consistently sending invalid transactions.</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] uppercase font-medium">Medium rate (20-50%)</span>
                <span className="block mt-0.5">Often DEX arbitrage bots or liquidation bots that intentionally spam transactions expecting most to fail.</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] uppercase font-medium">Low rate (&lt;20%)</span>
                <span className="block mt-0.5">Normal failure rate. Common causes: stale prices, race conditions between users, or insufficient balance.</span>
              </div>
            </div>
            <div className="mt-2 text-[9px] text-[var(--text-muted)]">
              Bar colors match each program&apos;s category (green = DEX, orange = perps, teal = lending, pink = NFT, blue = staking). Accumulated across {accumulated.totalBlocks} blocks this session via Helius RPC.
            </div>
          </div>
        )}
      </div>

      {/* Row 3: Top Failing Wallets (full width) */}
      <div className="card p-4 animate-section" style={{ animationDelay: '0.15s' }}>
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          Top Failing Wallets <span className="normal-case text-[var(--text-tertiary)]">(session total)</span>
        </div>
        {accumulated.topPayers.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {accumulated.topPayers.map(([payer, count], idx) => {
              const maxCount = accumulated.topPayers[0]?.[1] || 1;
              const barPct = (count / maxCount) * 100;
              return (
                <div key={payer}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-muted)] w-4">{idx + 1}.</span>
                      <a
                        href={getSolscanUrl('account', payer)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-[var(--accent-secondary)] hover:underline"
                      >
                        {payer.slice(0, 6)}...{payer.slice(-4)}
                      </a>
                    </div>
                    <span className="text-xs font-mono text-[var(--error)]">{count}</span>
                  </div>
                  <div className="ml-6 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--accent)]/50" style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-[var(--text-muted)] py-4 text-sm">No fee payer data available</div>
        )}
        {accumulated.topPayers.length > 0 && (
          <div className="mt-3 pt-2 border-t border-[var(--border-primary)] text-[9px] text-[var(--text-tertiary)]">
            Wallets sending the most failing transactions this session ({accumulated.totalBlocks} blocks since {accumulated.sessionStart}). Often bots or arbitrage programs.
          </div>
        )}
      </div>
    </section>
  );
}

// Block Deep Dive - Detailed block analysis with bar chart visualization
function BlockDeepDive({ blocks, getValidatorName }: { blocks: SlotData[]; getValidatorName: (pubkey: string) => string | null }) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [showVotes, setShowVotes] = useState(false);
  const [hoveredTx, setHoveredTx] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [searchSlot, setSearchSlot] = useState('');
  const [pausedBlocks, setPausedBlocks] = useState<SlotData[]>([]);
  const [enhancedTxMap, setEnhancedTxMap] = useState<Map<string, EnhancedTransaction>>(new Map());
  const enhancedFetchedSlotRef = useRef<number | null>(null);
  const [selectedTx, setSelectedTx] = useState<number | null>(null);

  // Use paused blocks when paused, otherwise live blocks
  const displayBlocks = isPaused ? pausedBlocks : blocks;

  // When pausing, capture current blocks
  const handlePauseToggle = () => {
    if (!isPaused) {
      setPausedBlocks([...blocks]);
    }
    setIsPaused(!isPaused);
  };

  // Search for a specific slot
  const handleSearch = () => {
    const slot = parseInt(searchSlot, 10);
    if (!isNaN(slot)) {
      setSelectedSlot(slot);
    }
  };

  const selectedBlock = useMemo(() => {
    if (!selectedSlot) return displayBlocks[0];
    return displayBlocks.find(b => b.slot === selectedSlot) || displayBlocks[0];
  }, [displayBlocks, selectedSlot]);

  // Fetch Helius enhanced transaction data for selected block
  useEffect(() => {
    if (!selectedBlock?.transactions || selectedBlock.slot === enhancedFetchedSlotRef.current) return;
    enhancedFetchedSlotRef.current = selectedBlock.slot;

    const nonVoteSigs = selectedBlock.transactions
      .filter(tx => !tx.programs.includes('Vote111111111111111111111111111111111111111'))
      .slice(0, 100)
      .map(tx => tx.signature);

    if (nonVoteSigs.length === 0) return;

    fetchEnhancedTransactions(nonVoteSigs).then(enhanced => {
      if (enhanced.length > 0) {
        const map = new Map<string, EnhancedTransaction>();
        for (const etx of enhanced) {
          if (etx.signature) map.set(etx.signature, etx);
        }
        setEnhancedTxMap(map);
      }
    });
  }, [selectedBlock]);

  const { analysis, blockStats, txsForChart, maxCU, feePercentileMap, medianFeePositionPct, medianFeeValue } = useMemo(() => {
    if (!selectedBlock?.transactions) {
      return { analysis: null, blockStats: null, txsForChart: [], maxCU: 0, feePercentileMap: new Map<string, number>(), medianFeePositionPct: 50, medianFeeValue: 0 };
    }

    const txs = selectedBlock.transactions;
    const total = txs.length;

    // Separate vote and non-vote transactions
    const voteTxs = txs.filter(tx => tx.programs.includes('Vote111111111111111111111111111111111111111'));
    const nonVoteTxs = txs.filter(tx => !tx.programs.includes('Vote111111111111111111111111111111111111111'));

    // Success/failed counts
    const successTxs = txs.filter(tx => tx.success);
    const failedTxs = txs.filter(tx => !tx.success);

    // Fee calculations
    const BASE_FEE_PER_SIG = 5000; // 5000 lamports per signature
    const totalFees = txs.reduce((sum, tx) => sum + tx.fee, 0);
    const nonVoteFees = nonVoteTxs.map(tx => tx.fee).sort((a, b) => a - b);
    const getPercentile = (arr: number[], p: number) => arr[Math.floor(arr.length * p / 100)] || 0;

    // Base fees = 5000 lamports per signature
    const totalBaseFees = txs.reduce((sum, tx) => sum + (tx.numSignatures || 1) * BASE_FEE_PER_SIG, 0);
    const nonVoteBaseFees = nonVoteTxs.reduce((sum, tx) => sum + (tx.numSignatures || 1) * BASE_FEE_PER_SIG, 0);

    // Priority fees = total - base
    const totalPriorityFees = Math.max(0, totalFees - totalBaseFees);
    const nonVotePriorityFees = nonVoteTxs.reduce((sum, tx) => {
      const baseFee = (tx.numSignatures || 1) * BASE_FEE_PER_SIG;
      return sum + Math.max(0, tx.fee - baseFee);
    }, 0);

    // Jito tips
    const totalJitoTips = txs.reduce((sum, tx) => sum + (tx.jitoTip || 0), 0);
    const nonVoteJitoTips = nonVoteTxs.reduce((sum, tx) => sum + (tx.jitoTip || 0), 0);
    const jitoTxCount = txs.filter(tx => (tx.jitoTip || 0) > 0).length;

    // CU calculations
    const totalCU = txs.reduce((sum, tx) => sum + tx.computeUnits, 0);
    const voteCU = voteTxs.reduce((sum, tx) => sum + tx.computeUnits, 0);
    const nonVoteCU = nonVoteTxs.reduce((sum, tx) => sum + tx.computeUnits, 0);
    const jitoCU = txs.filter(tx => (tx.jitoTip || 0) > 0).reduce((sum, tx) => sum + tx.computeUnits, 0);
    const nonVoteCUs = nonVoteTxs.map(tx => tx.computeUnits).sort((a, b) => a - b);

    // Jito bundle detection: count non-vote Jito txs as % of non-vote
    const jitoNonVoteCount = nonVoteTxs.filter(tx => (tx.jitoTip || 0) > 0).length;
    const jitoNonVotePercent = nonVoteTxs.length > 0 ? (jitoNonVoteCount / nonVoteTxs.length) * 100 : 0;

    // Jito tip stats (non-vote only, for distribution)
    const jitoTips = nonVoteTxs.filter(tx => (tx.jitoTip || 0) > 0).map(tx => tx.jitoTip);
    const jitoTipsSorted = [...jitoTips].sort((a, b) => a - b);

    // Priority fee stats (non-vote only)
    const nonVotePriorityFeeArr = nonVoteTxs.map(tx => {
      const baseFee = (tx.numSignatures || 1) * BASE_FEE_PER_SIG;
      return Math.max(0, tx.fee - baseFee);
    }).sort((a, b) => a - b);

    // Block statistics
    const stats = {
      total,
      nonVote: nonVoteTxs.length,
      vote: voteTxs.length,
      success: successTxs.length,
      failed: failedTxs.length,
      nonVotePercent: total > 0 ? (nonVoteTxs.length / total) * 100 : 0,
      votePercent: total > 0 ? (voteTxs.length / total) * 100 : 0,
      successPercent: total > 0 ? (successTxs.length / total) * 100 : 0,
      failedPercent: total > 0 ? (failedTxs.length / total) * 100 : 0,
      totalFees,
      baseFees: totalBaseFees,
      priorityFees: totalPriorityFees,
      jitoTips: totalJitoTips,
      nonVoteBaseFees,
      nonVotePriorityFees,
      nonVoteJitoTips,
      jitoTxCount,
      jitoNonVoteCount,
      jitoNonVotePercent,
      avgFee: nonVoteTxs.length > 0 ? nonVoteFees.reduce((a, b) => a + b, 0) / nonVoteFees.length : 0,
      p50Fee: getPercentile(nonVoteFees, 50),
      p99Fee: getPercentile(nonVoteFees, 99),
      maxFee: nonVoteFees[nonVoteFees.length - 1] || 0,
      avgPriorityFee: nonVotePriorityFeeArr.length > 0 ? nonVotePriorityFeeArr.reduce((a, b) => a + b, 0) / nonVotePriorityFeeArr.length : 0,
      p50PriorityFee: getPercentile(nonVotePriorityFeeArr, 50),
      p99PriorityFee: getPercentile(nonVotePriorityFeeArr, 99),
      maxPriorityFee: nonVotePriorityFeeArr[nonVotePriorityFeeArr.length - 1] || 0,
      avgJitoTip: jitoTipsSorted.length > 0 ? jitoTipsSorted.reduce((a, b) => a + b, 0) / jitoTipsSorted.length : 0,
      p50JitoTip: getPercentile(jitoTipsSorted, 50),
      p99JitoTip: getPercentile(jitoTipsSorted, 99),
      maxJitoTip: jitoTipsSorted[jitoTipsSorted.length - 1] || 0,
      totalCU,
      blockUtilization: (totalCU / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100,
      nonVoteCU,
      voteCU,
      jitoCU,
      nonVoteCUPercent: totalCU > 0 ? (nonVoteCU / totalCU) * 100 : 0,
      voteCUPercent: totalCU > 0 ? (voteCU / totalCU) * 100 : 0,
      jitoCUPercent: totalCU > 0 ? (jitoCU / totalCU) * 100 : 0,
      avgCU: nonVoteTxs.length > 0 ? nonVoteCU / nonVoteTxs.length : 0,
      p50CU: getPercentile(nonVoteCUs, 50),
      p99CU: getPercentile(nonVoteCUs, 99),
      maxCUVal: nonVoteCUs[nonVoteCUs.length - 1] || 0,
    };

    // Filter for chart display
    const filteredTxs = showVotes ? txs : nonVoteTxs;

    // Find max CU for scaling
    const maxComputeUnits = Math.max(...filteredTxs.map(tx => tx.computeUnits), 1);

    // Precompute fee percentiles for non-vote TXs (for fee rank in tooltip & median marker)
    const nonVoteFeesSorted = [...nonVoteTxs].sort((a, b) => a.fee - b.fee);
    const feePercentileMap = new Map<string, number>();
    for (let fi = 0; fi < nonVoteFeesSorted.length; fi++) {
      const pctile = nonVoteFeesSorted.length > 1 ? ((fi + 1) / nonVoteFeesSorted.length) * 100 : 50;
      feePercentileMap.set(nonVoteFeesSorted[fi].signature, pctile);
    }
    const medianFeeIndex = Math.floor(nonVoteTxs.length / 2);
    // Find where the median-fee TX sits in original (position-ordered) non-vote list
    const medianFeeTx = nonVoteFeesSorted[medianFeeIndex];
    const medianFeePositionPct = medianFeeTx && nonVoteTxs.length > 0
      ? (nonVoteTxs.indexOf(medianFeeTx) / nonVoteTxs.length) * 100
      : 50;
    const medianFeeValue = medianFeeTx?.fee ?? 0;

    return {
      analysis: { total },
      blockStats: stats,
      txsForChart: filteredTxs,
      maxCU: maxComputeUnits,
      feePercentileMap,
      medianFeePositionPct,
      medianFeeValue,
    };
  }, [selectedBlock, showVotes]);

  // Compute chart summary stats — must be before any conditional return to keep hook order stable
  const chartSummary = useMemo(() => {
    if (!txsForChart.length) return null;
    const success = txsForChart.filter(tx => tx.success).length;
    const failed = txsForChart.filter(tx => !tx.success).length;
    const jito = txsForChart.filter(tx => (tx.jitoTip || 0) > 0).length;
    const vote = txsForChart.filter(tx => tx.programs.includes('Vote111111111111111111111111111111111111111')).length;
    const totalCU = txsForChart.reduce((s, tx) => s + tx.computeUnits, 0);
    const totalFees = txsForChart.reduce((s, tx) => s + tx.fee, 0);

    // Top categories by count (exclude vote)
    const catCounts = new Map<string, number>();
    for (const tx of txsForChart) {
      const cat = getTxCategory(tx.programs);
      if (cat !== 'vote') catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    }
    const topCategories = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { success, failed, jito, vote, totalCU, totalFees, topCategories };
  }, [txsForChart]);

  // Fee by position — 20 buckets of non-vote txs, average priority fee + jito tip per bucket
  const feeByPosition = useMemo(() => {
    if (!selectedBlock?.transactions) return null;
    const nonVoteTxs = selectedBlock.transactions.filter(
      tx => !tx.programs.includes('Vote111111111111111111111111111111111111111')
    );
    if (nonVoteTxs.length === 0) return null;
    const BUCKETS = 20;
    const bucketSize = Math.ceil(nonVoteTxs.length / BUCKETS);
    const buckets: { start: number; end: number; avgPriority: number; avgJito: number; count: number }[] = [];
    let maxVal = 0;
    for (let b = 0; b < BUCKETS; b++) {
      const start = b * bucketSize;
      const end = Math.min(start + bucketSize, nonVoteTxs.length);
      if (start >= nonVoteTxs.length) break;
      const slice = nonVoteTxs.slice(start, end);
      const avgPriority = slice.reduce((s, tx) => s + tx.priorityFee, 0) / slice.length;
      const avgJito = slice.reduce((s, tx) => s + tx.jitoTip, 0) / slice.length;
      const total = avgPriority + avgJito;
      if (total > maxVal) maxVal = total;
      buckets.push({ start: start + 1, end, avgPriority, avgJito, count: slice.length });
    }
    return { buckets, maxVal };
  }, [selectedBlock]);

  // Per-block program breakdown — top 15 programs by tx count (non-vote, excludes ComputeBudget)
  const programBreakdown = useMemo(() => {
    if (!selectedBlock?.transactions) return null;
    const COMPUTE_BUDGET_ID = 'ComputeBudget111111111111111111111111111111';
    const VOTE_ID = 'Vote111111111111111111111111111111111111111';
    const nonVoteTxs = selectedBlock.transactions.filter(tx => !tx.programs.includes(VOTE_ID));
    const programMap = new Map<string, { count: number; cu: number; fees: number }>();
    for (const tx of nonVoteTxs) {
      for (const pid of tx.programs) {
        if (pid === COMPUTE_BUDGET_ID || pid === VOTE_ID) continue;
        const entry = programMap.get(pid) || { count: 0, cu: 0, fees: 0 };
        entry.count++;
        entry.cu += tx.computeUnits;
        entry.fees += tx.fee;
        programMap.set(pid, entry);
      }
    }
    const sorted = Array.from(programMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);
    const maxCount = sorted.length > 0 ? sorted[0][1].count : 1;
    return { programs: sorted, maxCount, totalNonVote: nonVoteTxs.length };
  }, [selectedBlock]);

  if (!selectedBlock || !analysis || !blockStats) {
    return (
      <section id="deepdive" className="mb-10">
        <SectionHeader title="Block Explorer" subtitle="Loading blocks..." />
        <div className="card p-8 flex items-center justify-center gap-3 text-[var(--text-muted)]">
          <div className="spinner" />
          <span>Fetching block data from Helius RPC...</span>
        </div>
      </section>
    );
  }

  // Color helper for transactions
  const getTxColor = (tx: { success: boolean; programs: string[]; jitoTip?: number }) => {
    if (!tx.success) return '#ef4444';
    if ((tx.jitoTip || 0) > 0) return '#a78bfa'; // Jito purple
    const cat = getTxCategory(tx.programs);
    if (cat === 'vote') return '#6b7280';
    return CATEGORY_COLORS[cat] || '#22c55e';
  };

  return (
    <section id="deepdive" className="mb-10">
      <SectionHeader title="Block Explorer" subtitle={`Last ${displayBlocks.length} blocks • click to inspect • hover txs for Helius enriched data`} />

      {/* Block Queue Pipeline */}
      <div className="card p-4 sm:p-6 mb-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Block Queue</div>
            <button
              onClick={handlePauseToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isPaused
                  ? 'bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/30'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:border-[var(--text-muted)]'
              }`}
            >
              {isPaused ? (
                <>
                  <span className="text-sm">▶</span>
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <span className="text-sm">⏸</span>
                  <span>Pause</span>
                </>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Search slot */}
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Search slot..."
                value={searchSlot}
                onChange={(e) => setSearchSlot(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-xs font-mono w-32 focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                onClick={handleSearch}
                className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs hover:border-[var(--text-muted)]"
              >
                🔍
              </button>
            </div>
            {/* Status indicator */}
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-[var(--warning)]' : 'bg-[var(--accent)] animate-pulse'}`} />
              <span>{isPaused ? 'Paused' : 'Live'}</span>
            </div>
          </div>
        </div>

        {/* Blocks in queue - clean grid layout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {displayBlocks.map((block) => {
            const isSelected = block.slot === selectedBlock.slot;
            const cuPercent = block.totalCU ? (block.totalCU / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100 : 0;
            const successRate = block.successRate ?? 100;

            const cuColor = cuPercent > 95 ? 'var(--error)' : cuPercent > 80 ? 'var(--warning)' : cuPercent > 50 ? 'var(--accent)' : 'var(--success)';
            const nonVoteCount = block.transactions ? block.transactions.filter(tx => !tx.programs.includes('Vote111111111111111111111111111111111111111')).length : null;
            const failPercent = 100 - successRate;

            return (
              <button
                key={block.slot}
                onClick={() => { setSelectedSlot(block.slot); setSelectedTx(null); }}
                className={`relative group transition-all duration-200 ${
                  isSelected ? 'z-10' : ''
                }`}
              >
                {/* Block card */}
                <div className={`rounded-xl border transition-all overflow-hidden ${
                  isSelected
                    ? 'bg-[var(--bg-secondary)] border-[var(--border-secondary)] shadow-md'
                    : 'bg-[var(--bg-secondary)]/50 border-[var(--border-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:shadow-sm'
                }`} style={{ borderLeftWidth: '3px', borderLeftColor: isSelected ? 'var(--accent)' : cuColor, ...(isSelected ? { borderTopColor: 'var(--accent)', borderTopWidth: '2px' } : {}) }}>
                  {/* Block header */}
                  <div className={`px-3 py-2 border-b ${
                    isSelected ? 'border-[var(--accent)]/20' : 'border-[var(--border-primary)]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">Block</div>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                    </div>
                    <div className={`font-mono text-sm ${
                      isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                    }`}>
                      {block.slot.toLocaleString()}
                    </div>
                  </div>

                  {/* Block stats */}
                  <div className="px-3 py-2 space-y-1.5">
                    {/* TX count with non-vote */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)]">TXs</span>
                      <span className="font-mono text-xs text-[var(--text-secondary)]">
                        {block.txCount}
                        {nonVoteCount !== null && <span className="text-[var(--text-tertiary)] text-[9px] ml-1">({nonVoteCount} nv)</span>}
                      </span>
                    </div>

                    {/* CU fill bar */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-[var(--text-muted)]">CU</span>
                        <span className="font-mono text-[10px]" style={{ color: cuColor }}>{cuPercent.toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, cuPercent)}%`,
                            backgroundColor: cuColor
                          }}
                        />
                      </div>
                    </div>

                    {/* Success rate with micro bar */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--text-muted)]">Success</span>
                        <span className={`font-mono text-[10px] ${
                          successRate < 95 ? 'text-[var(--warning)]' : 'text-[var(--success)]'
                        }`}>
                          {successRate.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden flex bg-[var(--bg-tertiary)] mt-0.5">
                        <div className="h-full bg-[var(--success)]" style={{ width: `${successRate}%` }} />
                        {failPercent > 0 && <div className="h-full bg-[var(--error)]" style={{ width: `${failPercent}%` }} />}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Block Info Header Strip */}
      <div className="card px-4 py-3 mb-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Slot</span>
            <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{selectedBlock.slot.toLocaleString()}</span>
          </div>
          <div className="w-px h-4 bg-[var(--border-primary)]" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Time</span>
            <span className="font-mono text-xs text-[var(--text-secondary)]">
              {selectedBlock.blockTime ? new Date(selectedBlock.blockTime * 1000).toLocaleString() : 'N/A'}
            </span>
          </div>
          <div className="w-px h-4 bg-[var(--border-primary)]" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Hash</span>
            <a
              href={getSolscanUrl('block', selectedBlock.slot)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-[var(--accent-secondary)] hover:underline truncate"
            >
              {selectedBlock.blockhash?.slice(0, 8)}...{selectedBlock.blockhash?.slice(-6)}
            </a>
          </div>
          {selectedBlock.leader && (
            <>
              <div className="w-px h-4 bg-[var(--border-primary)]" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Leader</span>
                <a
                  href={getSolscanUrl('account', selectedBlock.leader)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[var(--accent-secondary)] hover:underline"
                  title={selectedBlock.leader}
                >
                  {getValidatorName(selectedBlock.leader) || `${selectedBlock.leader.slice(0, 8)}...${selectedBlock.leader.slice(-6)}`}
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detailed Block Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* TRANSACTIONS */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 font-semibold">Transactions</div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-muted)]">Total</span>
              <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{blockStats.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-muted)]">Non-Vote</span>
              <span className="font-mono text-xs text-[var(--text-primary)]">{blockStats.nonVote.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-muted)]">Vote</span>
              <span className="font-mono text-xs text-[var(--text-secondary)]">{blockStats.vote.toLocaleString()}</span>
            </div>
            {/* Vote/Non-Vote composition bar */}
            <div className="pt-1">
              <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-tertiary)]">
                <div className="h-full bg-[var(--accent-secondary)]" style={{ width: `${blockStats.nonVotePercent}%` }} />
                <div className="h-full bg-[var(--text-muted)]" style={{ width: `${blockStats.votePercent}%` }} />
              </div>
              <div className="flex justify-between text-[9px] mt-0.5">
                <span className="text-[var(--accent-secondary)]">Non-Vote <span className="font-mono">{blockStats.nonVotePercent.toFixed(1)}%</span></span>
                <span className="text-[var(--text-muted)]">Vote <span className="font-mono">{blockStats.votePercent.toFixed(1)}%</span></span>
              </div>
            </div>
            <div className="border-t border-[var(--border-primary)] my-1 pt-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--text-muted)]">Success</span>
                <span className="font-mono text-xs text-[var(--success)]">{blockStats.success.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-[var(--text-muted)]">Failed</span>
                <span className="font-mono text-xs text-[var(--error)]">{blockStats.failed.toLocaleString()}</span>
              </div>
              {/* Success/Failed composition bar */}
              <div className="pt-1">
                <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-tertiary)]">
                  <div className="h-full bg-[var(--success)]" style={{ width: `${blockStats.successPercent}%` }} />
                  <div className="h-full bg-[var(--error)]" style={{ width: `${blockStats.failedPercent}%` }} />
                </div>
                <div className="flex justify-between text-[9px] mt-0.5">
                  <span className="text-[var(--success)]">Success <span className="font-mono">{blockStats.successPercent.toFixed(1)}%</span></span>
                  <span className="text-[var(--error)]">Failed <span className="font-mono">{blockStats.failedPercent.toFixed(1)}%</span></span>
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--border-primary)] my-1 pt-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--text-muted)]">Jito Bundles</span>
                <span className="font-mono text-xs text-[var(--accent-tertiary)]">
                  {blockStats.jitoTxCount.toLocaleString()} <span className="text-[var(--text-tertiary)]">({blockStats.jitoNonVotePercent.toFixed(1)}%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FEES */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 font-semibold">Fees</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Total</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">{(blockStats.totalFees / 1e9).toFixed(6)} SOL</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Base Fees</span>
              <span className="font-mono text-sm text-[var(--text-secondary)]">{(blockStats.baseFees / 1e9).toFixed(6)} SOL</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Priority Fees</span>
              <span className="font-mono text-sm text-[var(--accent)]">{(blockStats.priorityFees / 1e9).toFixed(6)} SOL</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Jito Tips</span>
              <span className="font-mono text-sm text-[var(--accent-tertiary)]">
                {blockStats.jitoTips > 0 ? `${(blockStats.jitoTips / 1e9).toFixed(6)} SOL` : '—'}
                {blockStats.jitoTxCount > 0 && <span className="text-[var(--text-tertiary)] ml-1">({blockStats.jitoTxCount} tx)</span>}
              </span>
            </div>
            {/* Fee composition bar */}
            <div className="border-t border-[var(--border-primary)] my-2 pt-2">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">Fee Composition</div>
              <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-tertiary)]">
                {blockStats.totalFees > 0 && (
                  <>
                    <div className="h-full bg-[var(--text-muted)]" style={{ width: `${(blockStats.baseFees / blockStats.totalFees) * 100}%` }} title={`Base: ${((blockStats.baseFees / blockStats.totalFees) * 100).toFixed(1)}%`} />
                    <div className="h-full bg-[var(--accent)]" style={{ width: `${(blockStats.priorityFees / blockStats.totalFees) * 100}%` }} title={`Priority: ${((blockStats.priorityFees / blockStats.totalFees) * 100).toFixed(1)}%`} />
                    <div className="h-full bg-[var(--accent-tertiary)]" style={{ width: `${(blockStats.jitoTips / blockStats.totalFees) * 100}%` }} title={`Jito: ${((blockStats.jitoTips / blockStats.totalFees) * 100).toFixed(1)}%`} />
                  </>
                )}
              </div>
              <div className="flex justify-between text-[9px] mt-1">
                <span className="text-[var(--text-muted)]">Base <span className="font-mono">{((blockStats.baseFees / (blockStats.totalFees || 1)) * 100).toFixed(1)}%</span></span>
                <span className="text-[var(--accent)]">Priority <span className="font-mono">{((blockStats.priorityFees / (blockStats.totalFees || 1)) * 100).toFixed(1)}%</span></span>
                <span className="text-[var(--accent-tertiary)]">Jito <span className="font-mono">{((blockStats.jitoTips / (blockStats.totalFees || 1)) * 100).toFixed(1)}%</span></span>
              </div>
            </div>
            {/* Priority fee + Jito tip distribution */}
            <div className="border-t border-[var(--border-primary)] my-2 pt-2 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--text-muted)] w-20 shrink-0">Priority Fee</span>
                <span className="text-[var(--text-tertiary)]">avg:</span>
                <span className="font-mono text-[var(--text-secondary)]">{formatNumber(Math.round(blockStats.avgPriorityFee))}</span>
                <span className="text-[var(--text-muted)]">L</span>
                <span className="text-[var(--text-tertiary)]">p50:</span>
                <span className="font-mono text-[var(--text-secondary)]">{blockStats.p50PriorityFee.toLocaleString()}</span>
                <span className="text-[var(--text-muted)]">L</span>
                <span className="text-[var(--text-tertiary)]">max:</span>
                <span className="font-mono text-[var(--text-secondary)]">{(blockStats.maxPriorityFee / 1e9).toFixed(3)} SOL</span>
              </div>
              {blockStats.jitoTxCount > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--text-muted)] w-20 shrink-0">Jito Tip</span>
                  <span className="text-[var(--text-tertiary)]">avg:</span>
                  <span className="font-mono text-[var(--accent-tertiary)]">{(blockStats.avgJitoTip / 1e9).toFixed(6)} SOL</span>
                  <span className="text-[var(--text-tertiary)]">p50:</span>
                  <span className="font-mono text-[var(--accent-tertiary)]">{(blockStats.p50JitoTip / 1e9).toFixed(6)} SOL</span>
                  <span className="text-[var(--text-tertiary)]">max:</span>
                  <span className="font-mono text-[var(--accent-tertiary)]">{(blockStats.maxJitoTip / 1e9).toFixed(6)} SOL</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COMPUTE UNITS */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 font-semibold">Compute Units</div>
          <div className="space-y-1.5">
            {/* Utilization gauge */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs text-[var(--text-muted)]">Block Utilization</span>
                <span className="font-mono text-sm font-semibold" style={{
                  color: blockStats.blockUtilization > 80 ? 'var(--warning)' : blockStats.blockUtilization > 50 ? 'var(--accent)' : 'var(--success)'
                }}>{blockStats.blockUtilization.toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, blockStats.blockUtilization)}%`,
                    backgroundColor: blockStats.blockUtilization > 80 ? 'var(--warning)' : blockStats.blockUtilization > 50 ? 'var(--accent)' : 'var(--success)'
                  }}
                />
              </div>
              <div className="text-[9px] font-mono text-[var(--text-tertiary)] mt-0.5">{formatCU(blockStats.totalCU)} / {formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT)}</div>
            </div>
            <div className="border-t border-[var(--border-primary)] my-1 pt-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--text-muted)]">Non-Vote</span>
                <span className="font-mono text-xs text-[var(--text-primary)]">{formatCU(blockStats.nonVoteCU)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-[var(--text-muted)]">Vote</span>
                <span className="font-mono text-xs text-[var(--text-secondary)]">{formatCU(blockStats.voteCU)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-[var(--text-muted)]">Jito</span>
                <span className="font-mono text-xs text-[var(--accent-tertiary)]">{formatCU(blockStats.jitoCU)}</span>
              </div>
              {/* CU composition stacked bar */}
              <div className="pt-1.5">
                <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-tertiary)]">
                  {blockStats.totalCU > 0 && (
                    <>
                      <div className="h-full bg-[var(--accent-secondary)]" style={{ width: `${blockStats.nonVoteCUPercent}%` }} />
                      <div className="h-full bg-[var(--text-muted)]" style={{ width: `${blockStats.voteCUPercent}%` }} />
                      <div className="h-full bg-[var(--accent-tertiary)]" style={{ width: `${blockStats.jitoCUPercent}%` }} />
                    </>
                  )}
                </div>
                <div className="flex justify-between text-[9px] mt-0.5">
                  <span className="text-[var(--accent-secondary)]">Non-Vote <span className="font-mono">{blockStats.nonVoteCUPercent.toFixed(1)}%</span></span>
                  <span className="text-[var(--text-muted)]">Vote <span className="font-mono">{blockStats.voteCUPercent.toFixed(1)}%</span></span>
                  <span className="text-[var(--accent-tertiary)]">Jito <span className="font-mono">{blockStats.jitoCUPercent.toFixed(1)}%</span></span>
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--border-primary)] my-1 pt-1.5">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1.5">CU/Tx <span className="normal-case text-[var(--text-tertiary)]">(non-vote)</span></div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="text-[var(--text-tertiary)]">avg:</span>
                <span className="font-mono text-[var(--text-secondary)]">{formatNumber(Math.round(blockStats.avgCU))}</span>
                <span className="text-[var(--text-tertiary)]">p50:</span>
                <span className="font-mono text-[var(--text-secondary)]">{formatNumber(blockStats.p50CU)}</span>
                <span className="text-[var(--text-tertiary)]">p99:</span>
                <span className="font-mono text-[var(--text-secondary)]">{formatNumber(blockStats.p99CU)}</span>
                <span className="text-[var(--text-tertiary)]">max:</span>
                <span className="font-mono text-[var(--text-secondary)]">{formatNumber(blockStats.maxCUVal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Visualization */}
      <div className="card p-4 overflow-visible">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Transaction Visualization</div>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Each bar = 1 tx &bull; height = CU consumed &bull; color = status &amp; type</div>
          </div>
          <button
            onClick={() => setShowVotes(!showVotes)}
            className="flex items-center gap-2 text-xs cursor-pointer select-none"
          >
            <div className={`w-7 h-3.5 rounded-full transition-colors ${showVotes ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'}`}>
              <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${showVotes ? 'translate-x-3.5' : ''}`} />
            </div>
            <span className="text-[var(--text-muted)]">Votes</span>
          </button>
        </div>

        {/* Summary stats bar */}
        {chartSummary && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 pb-2 border-b border-[var(--border-primary)] text-[10px]">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-[var(--text-muted)]">Success</span>
              <span className="font-mono text-[var(--text-secondary)]">{chartSummary.success.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
              <span className="text-[var(--text-muted)]">Failed</span>
              <span className="font-mono text-[var(--error)]">{chartSummary.failed.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
              <span className="text-[var(--text-muted)]">Jito</span>
              <span className="font-mono text-[var(--text-secondary)]">{chartSummary.jito.toLocaleString()}</span>
            </div>
            {showVotes && (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6b7280]" />
                <span className="text-[var(--text-muted)]">Vote</span>
                <span className="font-mono text-[var(--text-secondary)]">{chartSummary.vote.toLocaleString()}</span>
              </div>
            )}
            <span className="w-px h-2.5 bg-[var(--border-secondary)]" />
            <span className="text-[var(--text-muted)]">CU <span className="font-mono text-[var(--text-secondary)]">{formatCU(chartSummary.totalCU)}</span></span>
            <span className="text-[var(--text-muted)]">Fees <span className="font-mono text-[var(--text-secondary)]">{(chartSummary.totalFees / 1e9).toFixed(4)} SOL</span></span>
            <span className="w-px h-2.5 bg-[var(--border-secondary)]" />
            <span className="font-mono text-[var(--text-muted)]">{txsForChart.length.toLocaleString()} {showVotes ? 'total' : 'non-vote'} txs</span>
          </div>
        )}

        {/* Chart area */}
        {(() => {
          // Log scale Y-axis: compute tick values
          const logMax = Math.log10(Math.max(maxCU, 10));
          const logTicks: number[] = [];
          for (let e = Math.floor(logMax); e >= 0; e--) {
            logTicks.push(Math.pow(10, e));
          }
          // Ensure max value is included at top
          if (logTicks[0] < maxCU) logTicks.unshift(maxCU);
          const logScale = (val: number) => val <= 1 ? 0 : (Math.log10(val) / logMax) * 100;

          return (
        <div className="relative rounded-lg p-3 overflow-visible" style={{ background: 'linear-gradient(180deg, var(--bg-secondary) 0%, color-mix(in srgb, var(--bg-primary) 85%, black) 100%)' }}>
          {/* Y-axis - log scale */}
          <div className="absolute left-3 top-3 bottom-8 w-10 text-[9px] font-mono text-[var(--text-muted)]">
            {logTicks.map((tick, i) => (
              <span key={i} className="absolute right-0" style={{ bottom: `${logScale(tick)}%`, transform: 'translateY(50%)' }}>
                {formatCU(tick)}
              </span>
            ))}
          </div>

          {/* Grid lines - log scale (dotted, subtle) */}
          <div className="absolute left-14 right-3 top-3 bottom-8 pointer-events-none">
            {logTicks.map((tick, i) => (
              <div
                key={i}
                className="absolute left-0 right-0"
                style={{ bottom: `${logScale(tick)}%`, borderTop: '1px dotted', borderColor: 'var(--border-primary)', opacity: 0.5 }}
              />
            ))}
          </div>

          {/* Bar chart - full width visualization */}
          <div className="ml-14 mr-3 h-80 relative overflow-visible">
            {/* Median fee marker */}
            <div
              className="absolute top-0 bottom-0 z-10 pointer-events-none"
              style={{ left: `${medianFeePositionPct}%` }}
            >
              <div className="absolute inset-y-0 w-px border-l border-dashed border-[var(--warning)]/50" />
              <div className="absolute -top-4 -translate-x-1/2 text-[8px] font-mono text-[var(--warning)]/70 whitespace-nowrap">
                median fee ({medianFeeValue.toLocaleString()} L)
              </div>
            </div>

            {/* Bars container - using CSS grid for even distribution */}
            <div
              className="absolute inset-0 overflow-x-clip overflow-y-visible"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(txsForChart.length, 2000)}, 1fr)`,
                gap: txsForChart.length > 800 ? '0px' : txsForChart.length > 300 ? '0.25px' : txsForChart.length > 100 ? '0.5px' : '1px',
                alignItems: 'end',
              }}
            >
              {txsForChart.slice(0, 2000).map((tx, i) => {
                const heightPercent = logScale(tx.computeUnits);
                const color = getTxColor(tx);
                const isHovered = hoveredTx === i;
                const category = getTxCategory(tx.programs);
                // Calculate position for smart tooltip placement
                const totalTxs = Math.min(txsForChart.length, 2000);
                const positionPercent = (i / totalTxs) * 100;
                const isLeftEdge = positionPercent < 20;
                const isRightEdge = positionPercent > 80;

                // CU-based opacity: efficiency = used / requested
                const cuEfficiency = tx.cuRequested > 0 ? tx.computeUnits / tx.cuRequested : 0.5;
                const efficiencyOpacity = 0.4 + Math.min(1, cuEfficiency / 0.8) * 0.45; // 0.4 (low eff) to 0.85 (high eff)

                const isSelected = selectedTx === i;

                return (
                  <div
                    key={tx.signature}
                    className={`relative transition-all duration-100 cursor-pointer ${
                      isHovered ? 'z-20' : ''
                    }`}
                    style={{
                      height: `${Math.max(2, heightPercent)}%`,
                      backgroundColor: color,
                      opacity: isSelected ? 1 : isHovered ? 1 : efficiencyOpacity,
                      filter: isHovered ? 'brightness(1.3) drop-shadow(0 0 3px currentColor)' : undefined,
                      transformOrigin: 'bottom center',
                      borderRadius: txsForChart.length < 100 ? '4px 4px 0 0' : txsForChart.length < 500 ? '2px 2px 0 0' : '1px 1px 0 0',
                      minWidth: '1px',
                      boxShadow: isSelected ? `0 0 6px ${color}` : '0 1px 0 rgba(0,0,0,0.3)',
                    }}
                    onClick={(e) => { e.preventDefault(); setSelectedTx(isSelected ? null : i); if (!isSelected && !isPaused) { setPausedBlocks([...blocks]); setIsPaused(true); } }}
                    onMouseEnter={() => setHoveredTx(i)}
                    onMouseLeave={() => setHoveredTx(null)}
                  >
                    {/* Hover tooltip — quick preview */}
                    {isHovered && (() => {
                      const enhanced = enhancedTxMap.get(tx.signature);
                      return (
                        <div
                          className="absolute z-50 pointer-events-none"
                          style={{
                            bottom: '100%',
                            marginBottom: '4px',
                            left: isLeftEdge ? '0' : undefined,
                            right: isRightEdge ? '0' : undefined,
                            transform: (!isLeftEdge && !isRightEdge) ? 'translateX(-50%)' : undefined,
                            ...((!isLeftEdge && !isRightEdge) ? { left: '50%' } : {}),
                          }}
                        >
                          <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded-lg px-2.5 py-2 shadow-xl text-[9px]" style={{ minWidth: '260px', maxWidth: '320px', whiteSpace: 'normal' }}>
                            {/* Row 1: Position, Status, Type */}
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="font-mono font-bold text-[var(--text-primary)]">#{i + 1}</span>
                              <span className={`px-1 rounded text-[8px] font-medium ${
                                tx.success ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--error)]/20 text-[var(--error)]'
                              }`}>{tx.success ? 'OK' : 'FAIL'}</span>
                              {enhanced ? (
                                <>
                                  <span className="text-[var(--accent)] font-medium">{enhanced.type?.replace(/_/g, ' ')}</span>
                                  {enhanced.source && <span className="text-[var(--text-tertiary)]">via {enhanced.source}</span>}
                                </>
                              ) : (
                                <span className="text-[var(--text-secondary)] capitalize">{category}</span>
                              )}
                            </div>
                            {/* Helius description */}
                            {enhanced?.description && (
                              <div className="text-[8px] text-[var(--text-secondary)] mb-1.5 leading-tight">
                                {enhanced.description.length > 120 ? enhanced.description.slice(0, 120) + '...' : enhanced.description}
                              </div>
                            )}
                            {/* Error message for failed txs */}
                            {!tx.success && tx.errorMsg && (
                              <div className="text-[8px] text-[var(--error)] bg-[var(--error)]/10 rounded px-1.5 py-0.5 mb-1.5 font-mono truncate">{tx.errorMsg.length > 80 ? tx.errorMsg.slice(0, 80) + '...' : tx.errorMsg}</div>
                            )}
                            {/* Programs row */}
                            {(() => {
                              const VOTE_ID = 'Vote111111111111111111111111111111111111111';
                              const CB_ID = 'ComputeBudget111111111111111111111111111111';
                              const progs = tx.programs.filter(p => p !== VOTE_ID && p !== CB_ID);
                              if (progs.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1 mb-1.5">
                                  {progs.slice(0, 4).map(pid => {
                                    const p = getProgramInfo(pid);
                                    return <span key={pid} className="text-[8px] px-1 py-0.5 rounded bg-[var(--bg-tertiary)]" style={{ color: p.color }}>{p.name}</span>;
                                  })}
                                  {progs.length > 4 && <span className="text-[8px] text-[var(--text-muted)]">+{progs.length - 4}</span>}
                                </div>
                              );
                            })()}
                            {/* Stats grid */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[var(--text-muted)]">
                              <div>Fee <span className="font-mono text-[var(--text-primary)] ml-1">{tx.fee.toLocaleString()}</span> L</div>
                              <div>CU <span className="font-mono text-[var(--text-secondary)] ml-1">{formatCU(tx.computeUnits)}<span className="text-[var(--text-tertiary)]">/{formatCU(tx.cuRequested)}</span></span></div>
                              <div>Priority <span className="font-mono text-[var(--accent)] ml-1">{tx.priorityFee.toLocaleString()}</span> L</div>
                              <div>Accts <span className="font-mono text-[var(--text-secondary)] ml-1">{tx.accountCount}{tx.lutCount > 0 ? <span className="text-[var(--accent-secondary)]"> +{tx.lutCount}LUT</span> : ''}</span></div>
                              {tx.jitoTip > 0 && <div>Jito <span className="font-mono text-[var(--accent-tertiary)] ml-1">{tx.jitoTip.toLocaleString()}</span> L</div>}
                              {tx.cuPrice > 0 && <div>Price <span className="font-mono text-[var(--text-secondary)] ml-1">{tx.cuPrice.toLocaleString()}</span> µL</div>}
                            </div>
                            {/* Fee rank */}
                            {(() => {
                              const pctile = feePercentileMap.get(tx.signature);
                              if (pctile === undefined) return null;
                              const rank = 100 - pctile;
                              const label = rank <= 5 ? `top ${rank.toFixed(0)}%` : rank <= 30 ? `top ${rank.toFixed(0)}%` : rank <= 70 ? `mid ${rank.toFixed(0)}%` : `bottom ${(100 - rank).toFixed(0)}%`;
                              const color = rank <= 30 ? 'var(--success)' : rank <= 70 ? 'var(--warning)' : 'var(--error)';
                              return (
                                <div className="mt-1 pt-1 border-t border-[var(--border-primary)] text-[8px]">
                                  <span className="text-[var(--text-muted)]">Fee rank: </span>
                                  <span className="font-mono font-medium" style={{ color }}>{label}</span>
                                  <span className="text-[var(--text-tertiary)]"> in block</span>
                                </div>
                              );
                            })()}
                            {/* Balance changes preview */}
                            {tx.balanceChanges.length > 0 && (
                              <div className="mt-1.5 pt-1.5 border-t border-[var(--border-primary)]">
                                <div className="text-[8px] text-[var(--text-muted)] uppercase mb-0.5">SOL Changes</div>
                                {tx.balanceChanges.slice(0, 3).map((bc, j) => (
                                  <div key={j} className="flex items-center justify-between text-[8px]">
                                    <span className="font-mono text-[var(--text-tertiary)] truncate" style={{ maxWidth: '100px' }}>{bc.account.slice(0, 6)}...{bc.account.slice(-4)}</span>
                                    <span className={`font-mono ${bc.change > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{bc.change > 0 ? '+' : ''}{(bc.change / 1e9).toFixed(4)} SOL</span>
                                  </div>
                                ))}
                                {tx.balanceChanges.length > 3 && <div className="text-[8px] text-[var(--text-muted)]">+{tx.balanceChanges.length - 3} more</div>}
                              </div>
                            )}
                            {/* Token changes preview */}
                            {tx.tokenBalanceChanges.length > 0 && (
                              <div className="mt-1 pt-1 border-t border-[var(--border-primary)]">
                                <div className="text-[8px] text-[var(--text-muted)] uppercase mb-0.5">Token Changes</div>
                                {tx.tokenBalanceChanges.slice(0, 2).map((tc, j) => (
                                  <div key={j} className="flex items-center justify-between text-[8px]">
                                    <span className="font-mono text-[var(--text-tertiary)] truncate" style={{ maxWidth: '80px' }}>{tc.mint.slice(0, 6)}...</span>
                                    <span className={`font-mono ${tc.change > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{tc.change > 0 ? '+' : ''}{(tc.change / Math.pow(10, tc.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                  </div>
                                ))}
                                {tx.tokenBalanceChanges.length > 2 && <div className="text-[8px] text-[var(--text-muted)]">+{tx.tokenBalanceChanges.length - 2} more</div>}
                              </div>
                            )}
                            {/* Footer */}
                            <div className="mt-1.5 pt-1 border-t border-[var(--border-primary)] flex items-center justify-between">
                              <span className="text-[8px] text-[var(--text-tertiary)] font-mono">{tx.signature.slice(0, 10)}...</span>
                              <span className="text-[8px] text-[var(--accent)]/70">click to expand</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis labels with block position markers */}
          <div className="ml-14 mr-3 relative mt-1">
            {/* Tick lines at 1/3 and 2/3 */}
            <div className="absolute w-px h-2 bg-[var(--border-secondary)]" style={{ left: '33.3%', top: 0 }} />
            <div className="absolute w-px h-2 bg-[var(--border-secondary)]" style={{ left: '66.6%', top: 0 }} />
            <div className="flex items-center text-[9px] text-[var(--text-muted)] font-mono pt-1" style={{ position: 'relative' }}>
              <span className="absolute left-0">0</span>
              <span className="absolute text-[var(--text-tertiary)]" style={{ left: '33.3%', transform: 'translateX(-50%)' }}>1/3</span>
              <span className="absolute text-[var(--warning)]/60" style={{ left: '50%', transform: 'translateX(-50%)' }}>median</span>
              <span className="absolute text-[var(--text-tertiary)]" style={{ left: '66.6%', transform: 'translateX(-50%)' }}>2/3</span>
              <span className="absolute right-0">{txsForChart.length.toLocaleString()}</span>
            </div>
            <div style={{ height: 14 }} />
          </div>
        </div>
          );
        })()}

        {/* Legend - Top program categories with counts */}
        {chartSummary && chartSummary.topCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-[var(--border-primary)]">
            <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mr-1">Programs</span>
            {chartSummary.topCategories.map(([cat, count]) => {
              const pct = txsForChart.length > 0 ? (count / txsForChart.length * 100) : 0;
              return (
                <div
                  key={cat}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[9px]"
                >
                  <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] || '#64748b' }} />
                  <span className="text-[var(--text-secondary)] capitalize">{cat}</span>
                  <span className="font-mono text-[var(--text-muted)]">{count}</span>
                  <span className="text-[var(--text-tertiary)]">({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Transaction Breakdown Panel */}
        {selectedTx !== null && txsForChart[selectedTx] && (() => {
          const tx = txsForChart[selectedTx];
          const enhanced = enhancedTxMap.get(tx.signature);
          const category = getTxCategory(tx.programs);
          const cuEfficiency = tx.cuRequested > 0 ? ((tx.computeUnits / tx.cuRequested) * 100) : 0;
          const cuWasted = Math.max(0, tx.cuRequested - tx.computeUnits);
          const baseFee = (tx.numSignatures || 1) * 5000;
          const totalCost = tx.fee + tx.jitoTip;

          return (
            <div className="mt-3 pt-3 border-t border-[var(--border-secondary)]">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">TX #{selectedTx + 1}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    tx.success ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--error)]/15 text-[var(--error)]'
                  }`}>{tx.success ? 'Success' : 'Failed'}</span>
                  {enhanced ? (
                    <>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-medium">{enhanced.type?.replace(/_/g, ' ')}</span>
                      {enhanced.source && <span className="text-[9px] text-[var(--text-tertiary)]">via {enhanced.source}</span>}
                    </>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] capitalize">{category}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={getSolscanUrl('tx', tx.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] px-2.5 py-1 rounded-md bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)]/20 transition-colors font-medium"
                  >
                    View on Solscan
                  </a>
                  <button
                    onClick={() => setSelectedTx(null)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm px-1 py-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Efficiency Score */}
              {(() => {
                const cuEff = tx.cuRequested > 0 ? (tx.computeUnits / tx.cuRequested) : 0;
                const feePctile = feePercentileMap.get(tx.signature) ?? 50;
                const feeCompetitiveness = feePctile / 100; // higher = more competitive fee
                const successScore = tx.success ? 1 : 0;
                const score = Math.round((cuEff * 0.6 + feeCompetitiveness * 0.2 + successScore * 0.2) * 100);
                const verdict = score >= 75 ? 'Efficient' : score >= 50 ? 'Moderate' : score >= 30 ? 'Wasteful' : 'Overpaying';
                const verdictColor = score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--error)';
                const feeRank = 100 - feePctile;
                return (
                  <div className="mb-3 bg-[var(--bg-secondary)]/50 rounded-lg p-3 border border-[var(--border-primary)] flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold font-mono" style={{ color: verdictColor }}>{score}</div>
                      <div className="text-[9px] font-medium" style={{ color: verdictColor }}>{verdict}</div>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2 text-[9px]">
                      <div>
                        <div className="text-[var(--text-muted)] uppercase text-[8px]">CU Efficiency</div>
                        <div className="font-mono text-[var(--text-secondary)]">{(cuEff * 100).toFixed(1)}%</div>
                        <div className="h-1 bg-[var(--bg-tertiary)] rounded-full mt-0.5">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, cuEff * 100)}%`, backgroundColor: cuEff > 0.8 ? 'var(--success)' : cuEff > 0.5 ? 'var(--warning)' : 'var(--error)' }} />
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)] uppercase text-[8px]">Fee Rank</div>
                        <div className="font-mono" style={{ color: feeRank <= 30 ? 'var(--success)' : feeRank <= 70 ? 'var(--warning)' : 'var(--error)' }}>top {feeRank.toFixed(0)}%</div>
                        <div className="h-1 bg-[var(--bg-tertiary)] rounded-full mt-0.5">
                          <div className="h-full rounded-full" style={{ width: `${100 - feeRank}%`, backgroundColor: feeRank <= 30 ? 'var(--success)' : feeRank <= 70 ? 'var(--warning)' : 'var(--error)' }} />
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)] uppercase text-[8px]">Status</div>
                        <div className={`font-mono ${tx.success ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{tx.success ? 'Success' : 'Failed'}</div>
                        <div className="h-1 bg-[var(--bg-tertiary)] rounded-full mt-0.5">
                          <div className="h-full rounded-full" style={{ width: tx.success ? '100%' : '0%', backgroundColor: 'var(--success)' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Helius description */}
              {enhanced?.description && (
                <div className="text-[10px] text-[var(--text-secondary)] mb-3 leading-relaxed bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 border border-[var(--border-primary)]">
                  {enhanced.description}
                </div>
              )}

              {/* Two-column layout: left = fees & costs, right = compute & accounts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {/* Left: Fee Breakdown */}
                <div className="bg-[var(--bg-secondary)]/50 rounded-lg p-3 border border-[var(--border-primary)]">
                  <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mb-2 font-semibold">Fee Breakdown</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-muted)]">Base Fee</span>
                      <span className="font-mono text-[10px] text-[var(--text-secondary)]">{baseFee.toLocaleString()} L</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-muted)]">Priority Fee</span>
                      <span className="font-mono text-[10px] text-[var(--accent)]">{tx.priorityFee.toLocaleString()} L</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-muted)]">Jito Tip</span>
                      <span className="font-mono text-[10px] text-[var(--accent-tertiary)]">{tx.jitoTip > 0 ? `${tx.jitoTip.toLocaleString()} L` : '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-muted)]">CU Price</span>
                      <span className="font-mono text-[10px] text-[var(--text-secondary)]">{tx.cuPrice > 0 ? `${tx.cuPrice.toLocaleString()} µL/CU` : '—'}</span>
                    </div>
                    {/* Fee composition mini-bar */}
                    <div className="pt-1.5 border-t border-[var(--border-primary)]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-[var(--text-muted)]">Total Cost</span>
                        <span className="font-mono text-xs text-[var(--text-primary)] font-medium">{totalCost.toLocaleString()} L <span className="text-[9px] text-[var(--text-tertiary)]">({(totalCost / 1e9).toFixed(6)} SOL)</span></span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-tertiary)]">
                        {totalCost > 0 && (
                          <>
                            <div className="h-full bg-[var(--text-muted)]" style={{ width: `${(baseFee / totalCost) * 100}%` }} title={`Base: ${((baseFee / totalCost) * 100).toFixed(1)}%`} />
                            <div className="h-full bg-[var(--accent)]" style={{ width: `${(tx.priorityFee / totalCost) * 100}%` }} title={`Priority: ${((tx.priorityFee / totalCost) * 100).toFixed(1)}%`} />
                            {tx.jitoTip > 0 && <div className="h-full bg-[var(--accent-tertiary)]" style={{ width: `${(tx.jitoTip / totalCost) * 100}%` }} title={`Jito: ${((tx.jitoTip / totalCost) * 100).toFixed(1)}%`} />}
                          </>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-[8px]">
                        <span className="text-[var(--text-muted)]">Base</span>
                        <span className="text-[var(--accent)]">Priority</span>
                        {tx.jitoTip > 0 && <span className="text-[var(--accent-tertiary)]">Jito</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Compute & Accounts */}
                <div className="bg-[var(--bg-secondary)]/50 rounded-lg p-3 border border-[var(--border-primary)]">
                  <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mb-2 font-semibold">Compute & Accounts</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-muted)]">CU Used</span>
                      <span className="font-mono text-[10px] text-[var(--text-primary)]">{formatCU(tx.computeUnits)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-muted)]">CU Requested</span>
                      <span className="font-mono text-[10px] text-[var(--text-secondary)]">{formatCU(tx.cuRequested)}</span>
                    </div>
                    {/* CU efficiency bar */}
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] text-[var(--text-muted)]">Efficiency</span>
                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden w-16">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(100, cuEfficiency)}%`,
                            backgroundColor: cuEfficiency > 80 ? 'var(--success)' : cuEfficiency > 50 ? 'var(--warning)' : 'var(--error)',
                          }} />
                        </div>
                        <span className={`font-mono text-[10px] ${cuEfficiency > 80 ? 'text-[var(--success)]' : cuEfficiency > 50 ? 'text-[var(--warning)]' : 'text-[var(--error)]'}`}>{cuEfficiency.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-muted)]">CU Wasted</span>
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{formatCU(cuWasted)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-[var(--border-primary)]">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-[var(--text-muted)]">Accounts</span>
                        <span className="font-mono text-[10px] text-[var(--text-primary)]">{tx.accountCount}{tx.lutCount > 0 && <span className="text-[var(--accent-secondary)]"> ({tx.lutCount} via LUT)</span>}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-muted)]">Signatures</span>
                      <span className="font-mono text-[10px] text-[var(--text-secondary)]">{tx.numSignatures}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-muted)]">SOL Movement</span>
                      <span className="font-mono text-[10px] text-[var(--accent-secondary)]">{Math.abs(tx.solMovement) > 0 ? `${(Math.abs(tx.solMovement) / 1e9).toFixed(6)} SOL` : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}
      </div>

      {/* Fee by Position — vertical bars below the 3-col grid */}
      {feeByPosition && feeByPosition.buckets.length > 0 && (
        <div className="card p-4 mt-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              Fee by Position
              <span className="normal-case text-[var(--text-tertiary)] text-[10px]">(avg fee per tx-position bucket)</span>
            </div>
            <div className="flex items-center gap-3 text-[9px] text-[var(--text-muted)]">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-sm bg-[var(--accent)]" />
                Priority
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-sm bg-[var(--accent-tertiary)]" />
                Jito
              </div>
            </div>
          </div>
          <div className="relative h-36">
            {/* Y-axis label */}
            <div className="absolute left-0 top-0 text-[8px] font-mono text-[var(--text-muted)]">{formatNumber(Math.round(feeByPosition.maxVal))} L</div>
            {/* Bars */}
            <div className="absolute left-10 right-0 top-0 bottom-4 flex items-end gap-px">
              {feeByPosition.buckets.map((bucket, i) => {
                const total = bucket.avgPriority + bucket.avgJito;
                const heightPct = feeByPosition.maxVal > 0 ? (total / feeByPosition.maxVal) * 100 : 0;
                const priorityPct = total > 0 ? (bucket.avgPriority / total) * 100 : 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-stretch group relative cursor-default" style={{ height: '100%' }}>
                    <div className="flex-1" />
                    <div className="flex flex-col rounded-t-sm overflow-hidden" style={{ height: `${Math.max(heightPct, 1)}%` }}>
                      <div className="flex-1 bg-[var(--accent-tertiary)]" style={{ height: `${100 - priorityPct}%` }} />
                      <div className="flex-1 bg-[var(--accent)]" style={{ height: `${priorityPct}%` }} />
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30 pointer-events-none">
                      <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded px-2 py-1.5 shadow-xl text-[9px] whitespace-nowrap">
                        <div className="font-medium text-[var(--text-primary)] mb-0.5">Position {bucket.start}–{bucket.end}</div>
                        <div className="text-[var(--text-muted)]">Priority: <span className="font-mono text-[var(--accent)]">{formatNumber(Math.round(bucket.avgPriority))} L</span></div>
                        <div className="text-[var(--text-muted)]">Jito: <span className="font-mono text-[var(--accent-tertiary)]">{formatNumber(Math.round(bucket.avgJito))} L</span></div>
                        <div className="text-[var(--text-muted)]">Total: <span className="font-mono text-[var(--text-primary)]">{formatNumber(Math.round(total))} L</span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* X-axis labels */}
            <div className="absolute left-10 right-0 bottom-0 flex justify-between text-[8px] font-mono text-[var(--text-muted)]">
              <span>1st</span>
              <span className="text-[var(--text-tertiary)]">1/3</span>
              <span className="text-[var(--text-tertiary)]">2/3</span>
              <span>Last</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1 text-[9px] text-[var(--text-tertiary)]">
            <span>Early in block (high priority)</span>
            <span>Tx position →</span>
            <span>Late in block (lower priority)</span>
          </div>
        </div>
      )}

      {/* Program Activity — full-width with fee & CU details */}
      <div className="card p-4 mt-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Program Activity</div>
          {programBreakdown && (
            <span className="text-[10px] text-[var(--text-tertiary)]">{programBreakdown.totalNonVote} non-vote txs</span>
          )}
        </div>
        {programBreakdown && programBreakdown.programs.length > 0 ? (
          <>
            {/* Column headers */}
            <div className="flex items-center gap-2 px-1 mb-1.5 text-[9px] text-[var(--text-muted)] uppercase tracking-wide">
              <span className="w-24 shrink-0">Program</span>
              <span className="flex-1">TX Count</span>
              <span className="w-12 text-right shrink-0">TXs</span>
              <span className="w-12 text-right shrink-0">Share</span>
              <span className="w-16 text-right shrink-0">Avg Fee</span>
              <span className="w-16 text-right shrink-0">Total CU</span>
            </div>
            <div className="space-y-1">
              {programBreakdown.programs.map(([pid, data]) => {
                const info = getProgramInfo(pid);
                const pct = programBreakdown.totalNonVote > 0 ? (data.count / programBreakdown.totalNonVote) * 100 : 0;
                const barPct = (data.count / programBreakdown.maxCount) * 100;
                const avgFee = data.count > 0 ? Math.round(data.fees / data.count) : 0;
                return (
                  <div key={pid} className="flex items-center gap-2 py-0.5 rounded hover:bg-[var(--bg-secondary)]/50">
                    <div className="flex items-center gap-1.5 w-24 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                      <a
                        href={getSolscanUrl('account', pid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] truncate"
                        title={pid}
                      >
                        {info.name}
                      </a>
                    </div>
                    <div className="flex-1 h-2.5 bg-[var(--bg-tertiary)] rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm transition-all" style={{ width: `${barPct}%`, backgroundColor: info.color, opacity: 0.6 }} />
                    </div>
                    <span className="text-[9px] font-mono text-[var(--text-secondary)] w-12 text-right shrink-0">{data.count}</span>
                    <span className="text-[9px] font-mono text-[var(--text-tertiary)] w-12 text-right shrink-0">{pct.toFixed(1)}%</span>
                    <span className="text-[9px] font-mono text-[var(--text-tertiary)] w-16 text-right shrink-0">{formatNumber(avgFee)} L</span>
                    <span className="text-[9px] font-mono text-[var(--text-tertiary)] w-16 text-right shrink-0">{formatCU(data.cu)}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-xs text-[var(--text-muted)] text-center py-4">No program data</div>
        )}
      </div>

    </section>
  );
}

// Top Validators Section
const PAGE_SIZE = 15;
function TopValidatorsSection({ validatorInfo, getValidatorName, getValidatorMetadata, production, currentSlot }: { validatorInfo: ReturnType<typeof useTopValidators>['validatorInfo']; getValidatorName: (pubkey: string) => string | null; getValidatorMetadata: (pubkey: string) => ValidatorMetadata | null; production?: BlockProductionInfo | null; currentSlot: number }) {
  const [page, setPage] = useState(0);
  const [expandedValidator, setExpandedValidator] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Aggregate stats across all validators
  const aggregateStats = useMemo(() => {
    if (!validatorInfo) return null;
    const { validators, totalStake } = validatorInfo;
    const total = validators.length;

    // Health grade distribution
    const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const healthScores: number[] = [];
    // Skip rate buckets
    const skipBuckets = { low: 0, medium: 0, high: 0, critical: 0 }; // <2%, 2-5%, 5-10%, >10%
    // Commission buckets
    const commBuckets = { zero: 0, low: 0, medium: 0, high: 0 }; // 0%, 1-5%, 5-10%, >10%
    // Stake concentration — top 10 / top 33 / rest
    let top10Stake = 0, top33Stake = 0;

    for (let i = 0; i < validators.length; i++) {
      const v = validators[i];
      const h = computeHealthScore(v, production ?? null, currentSlot);
      grades[h.grade]++;
      healthScores.push(h.score);

      // Skip rate
      const prod = production?.byIdentity?.[v.nodePubkey];
      if (prod) {
        const [slots, produced] = prod;
        const skip = slots > 0 ? ((slots - produced) / slots) * 100 : 0;
        if (skip < 2) skipBuckets.low++;
        else if (skip < 5) skipBuckets.medium++;
        else if (skip < 10) skipBuckets.high++;
        else skipBuckets.critical++;
      } else {
        skipBuckets.low++; // no data = assume ok
      }

      // Commission
      if (v.commission === 0) commBuckets.zero++;
      else if (v.commission <= 5) commBuckets.low++;
      else if (v.commission <= 10) commBuckets.medium++;
      else commBuckets.high++;

      // Stake concentration
      if (i < 10) top10Stake += v.activatedStake;
      if (i < 33) top33Stake += v.activatedStake;
    }

    const avgScore = healthScores.length > 0 ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) : 0;

    return { total, grades, avgScore, skipBuckets, commBuckets, top10Stake, top33Stake, totalStake };
  }, [validatorInfo, production, currentSlot]);

  if (!validatorInfo) return null;

  const { validators, totalStake, avgCommission } = validatorInfo;
  const delinquentCount = validators.filter(v => v.delinquent).length;

  const filteredValidators = useMemo(() => {
    if (!searchQuery.trim()) return validators;
    const q = searchQuery.toLowerCase();
    return validators.filter(v => {
      const name = getValidatorName(v.votePubkey)?.toLowerCase() || '';
      const meta = getValidatorMetadata(v.votePubkey);
      const metaName = meta?.name?.toLowerCase() || '';
      return name.includes(q) || metaName.includes(q) || v.votePubkey.toLowerCase().includes(q) || v.nodePubkey.toLowerCase().includes(q);
    });
  }, [validators, searchQuery, getValidatorName, getValidatorMetadata]);

  const totalPages = Math.ceil(filteredValidators.length / PAGE_SIZE);
  const safePageNum = Math.min(page, Math.max(0, totalPages - 1));
  const pageStart = safePageNum * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredValidators.length);
  const pageValidators = filteredValidators.slice(pageStart, pageEnd);

  // Stacked bar helper
  const StackedBar = ({ segments, height = 8 }: { segments: Array<{ value: number; color: string; label: string }>; height?: number }) => {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) return null;
    return (
      <div className="flex rounded-full overflow-hidden" style={{ height }}>
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <div
            key={i}
            title={`${seg.label}: ${seg.value} (${((seg.value / total) * 100).toFixed(1)}%)`}
            className="transition-all duration-300 first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }}
          />
        ))}
      </div>
    );
  };

  return (
    <section className="mb-10">
      <SectionHeader title="Validators" subtitle={`${validators.length} total • ranked by stake`} />

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total Network Stake" value={formatNumber(totalStake)} subtext="SOL (sum)" accent />
        <StatCard label="Active Validators" value={(validators.length - delinquentCount).toLocaleString()} subtext={`of ${validators.length} total`} />
        <StatCard label="Avg Commission" value={`${avgCommission.toFixed(1)}%`} subtext="across all validators" />
        <StatCard label="Delinquent" value={delinquentCount.toString()} subtext={`${((delinquentCount / validators.length) * 100).toFixed(1)}% of validators`} color={delinquentCount === 0 ? 'green' : undefined} />
      </div>

      {/* Aggregate Health Overview — Stacked Bars */}
      {aggregateStats && (
        <div className="card p-4 mb-4">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-3">Network Health Overview</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Health Grade Distribution */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-[var(--text-tertiary)]">Health Grades</span>
                <span className="text-[10px] font-mono text-[var(--text-secondary)]">avg {aggregateStats.avgScore}</span>
              </div>
              <StackedBar segments={[
                { value: aggregateStats.grades.A, color: 'var(--success)', label: `A (${aggregateStats.grades.A})` },
                { value: aggregateStats.grades.B, color: 'var(--accent-secondary)', label: `B (${aggregateStats.grades.B})` },
                { value: aggregateStats.grades.C, color: 'var(--warning)', label: `C (${aggregateStats.grades.C})` },
                { value: aggregateStats.grades.D, color: 'var(--accent)', label: `D (${aggregateStats.grades.D})` },
                { value: aggregateStats.grades.F, color: 'var(--error)', label: `F (${aggregateStats.grades.F})` },
              ]} />
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {[
                  { grade: 'A', count: aggregateStats.grades.A, color: 'var(--success)' },
                  { grade: 'B', count: aggregateStats.grades.B, color: 'var(--accent-secondary)' },
                  { grade: 'C', count: aggregateStats.grades.C, color: 'var(--warning)' },
                  { grade: 'D', count: aggregateStats.grades.D, color: 'var(--accent)' },
                  { grade: 'F', count: aggregateStats.grades.F, color: 'var(--error)' },
                ].filter(g => g.count > 0).map(g => (
                  <span key={g.grade} className="flex items-center gap-1 text-[9px]">
                    <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: g.color }} />
                    <span className="text-[var(--text-muted)]">{g.grade}</span>
                    <span className="font-mono text-[var(--text-tertiary)]">{g.count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Skip Rate Distribution */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-[var(--text-tertiary)]">Skip Rate Distribution</span>
              </div>
              <StackedBar segments={[
                { value: aggregateStats.skipBuckets.low, color: 'var(--success)', label: `<2% (${aggregateStats.skipBuckets.low})` },
                { value: aggregateStats.skipBuckets.medium, color: 'var(--accent-secondary)', label: `2-5% (${aggregateStats.skipBuckets.medium})` },
                { value: aggregateStats.skipBuckets.high, color: 'var(--warning)', label: `5-10% (${aggregateStats.skipBuckets.high})` },
                { value: aggregateStats.skipBuckets.critical, color: 'var(--error)', label: `>10% (${aggregateStats.skipBuckets.critical})` },
              ]} />
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {[
                  { label: '<2%', count: aggregateStats.skipBuckets.low, color: 'var(--success)' },
                  { label: '2-5%', count: aggregateStats.skipBuckets.medium, color: 'var(--accent-secondary)' },
                  { label: '5-10%', count: aggregateStats.skipBuckets.high, color: 'var(--warning)' },
                  { label: '>10%', count: aggregateStats.skipBuckets.critical, color: 'var(--error)' },
                ].filter(s => s.count > 0).map(s => (
                  <span key={s.label} className="flex items-center gap-1 text-[9px]">
                    <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="text-[var(--text-muted)]">{s.label}</span>
                    <span className="font-mono text-[var(--text-tertiary)]">{s.count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Commission Distribution */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-[var(--text-tertiary)]">Commission Distribution</span>
              </div>
              <StackedBar segments={[
                { value: aggregateStats.commBuckets.zero, color: 'var(--success)', label: `0% (${aggregateStats.commBuckets.zero})` },
                { value: aggregateStats.commBuckets.low, color: 'var(--accent-secondary)', label: `1-5% (${aggregateStats.commBuckets.low})` },
                { value: aggregateStats.commBuckets.medium, color: 'var(--warning)', label: `5-10% (${aggregateStats.commBuckets.medium})` },
                { value: aggregateStats.commBuckets.high, color: 'var(--error)', label: `>10% (${aggregateStats.commBuckets.high})` },
              ]} />
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {[
                  { label: '0%', count: aggregateStats.commBuckets.zero, color: 'var(--success)' },
                  { label: '1-5%', count: aggregateStats.commBuckets.low, color: 'var(--accent-secondary)' },
                  { label: '5-10%', count: aggregateStats.commBuckets.medium, color: 'var(--warning)' },
                  { label: '>10%', count: aggregateStats.commBuckets.high, color: 'var(--error)' },
                ].filter(s => s.count > 0).map(s => (
                  <span key={s.label} className="flex items-center gap-1 text-[9px]">
                    <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="text-[var(--text-muted)]">{s.label}</span>
                    <span className="font-mono text-[var(--text-tertiary)]">{s.count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Stake Concentration */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-[var(--text-tertiary)]">Stake Concentration</span>
              </div>
              <StackedBar segments={[
                { value: aggregateStats.top10Stake, color: 'var(--accent)', label: `Top 10: ${((aggregateStats.top10Stake / aggregateStats.totalStake) * 100).toFixed(1)}%` },
                { value: aggregateStats.top33Stake - aggregateStats.top10Stake, color: 'var(--accent-secondary)', label: `#11-33: ${(((aggregateStats.top33Stake - aggregateStats.top10Stake) / aggregateStats.totalStake) * 100).toFixed(1)}%` },
                { value: aggregateStats.totalStake - aggregateStats.top33Stake, color: 'var(--bg-tertiary)', label: `Rest: ${(((aggregateStats.totalStake - aggregateStats.top33Stake) / aggregateStats.totalStake) * 100).toFixed(1)}%` },
              ]} />
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-[9px]">
                  <span className="w-1.5 h-1.5 rounded-sm bg-[var(--accent)]" />
                  <span className="text-[var(--text-muted)]">Top 10</span>
                  <span className="font-mono text-[var(--text-tertiary)]">{((aggregateStats.top10Stake / aggregateStats.totalStake) * 100).toFixed(1)}%</span>
                </span>
                <span className="flex items-center gap-1 text-[9px]">
                  <span className="w-1.5 h-1.5 rounded-sm bg-[var(--accent-secondary)]" />
                  <span className="text-[var(--text-muted)]">#11–33</span>
                  <span className="font-mono text-[var(--text-tertiary)]">{(((aggregateStats.top33Stake - aggregateStats.top10Stake) / aggregateStats.totalStake) * 100).toFixed(1)}%</span>
                </span>
                <span className="flex items-center gap-1 text-[9px]">
                  <span className="w-1.5 h-1.5 rounded-sm bg-[var(--bg-tertiary)]" />
                  <span className="text-[var(--text-muted)]">Rest</span>
                  <span className="font-mono text-[var(--text-tertiary)]">{(((aggregateStats.totalStake - aggregateStats.top33Stake) / aggregateStats.totalStake) * 100).toFixed(1)}%</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validators Table */}
      <div className="card overflow-hidden">
        {/* Pagination Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/30 gap-3">
          <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
            {searchQuery ? `${filteredValidators.length} of ${validators.length}` : `${pageStart + 1}–${pageEnd} of ${validators.length}`}
          </span>
          <input
            type="text"
            placeholder="Search validator..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
            className="flex-1 max-w-[200px] px-2.5 py-1 text-xs rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-secondary)]/50 transition-colors"
          />
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={page === 0} className="px-2 py-1 text-xs rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed" title="First page">««</button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 text-xs rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed">«</button>
            {Array.from({ length: totalPages }, (_, i) => {
              if (totalPages <= 7 || Math.abs(i - page) <= 2 || i === 0 || i === totalPages - 1) {
                return <button key={i} onClick={() => setPage(i)} className={`min-w-[28px] px-1.5 py-1 text-xs rounded font-mono ${i === page ? 'bg-[var(--accent)]/20 text-[var(--accent)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>{i + 1}</button>;
              }
              if (i === 1 && page > 3) return <span key={i} className="px-1 text-xs text-[var(--text-muted)]">...</span>;
              if (i === totalPages - 2 && page < totalPages - 4) return <span key={i} className="px-1 text-xs text-[var(--text-muted)]">...</span>;
              return null;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="px-2 py-1 text-xs rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed">»</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} className="px-2 py-1 text-xs rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed" title="Last page">»»</button>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-left text-xs text-[var(--text-muted)] uppercase">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Validator</th>
              <th className="px-4 py-3 font-medium text-center">Health</th>
              <th className="px-4 py-3 font-medium text-right">Stake (SOL)</th>
              <th className="px-4 py-3 font-medium text-right">Share</th>
              <th className="px-4 py-3 font-medium text-right">Commission</th>
              <th className="px-4 py-3 font-medium text-right">Skip Rate</th>
              <th className="px-4 py-3 font-medium text-right">Last Vote</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageValidators.map((v, i) => {
              const stakePercent = (v.activatedStake / totalStake) * 100;
              const name = getValidatorName(v.votePubkey) || getValidatorName(v.nodePubkey);
              const metadata = getValidatorMetadata(v.votePubkey) || getValidatorMetadata(v.nodePubkey);
              const rank = pageStart + i + 1;
              const h = computeHealthScore(v, production ?? null, currentSlot);
              const isExpanded = expandedValidator === v.votePubkey;
              const prod = production?.byIdentity?.[v.nodePubkey];
              const skipRate = prod ? (prod[0] > 0 ? ((prod[0] - prod[1]) / prod[0]) * 100 : 0) : null;

              return (
                <Fragment key={v.votePubkey}>
                <tr
                  className={`border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-hover)] ${isExpanded ? 'bg-[var(--bg-secondary)]/30' : ''}`}
                >
                  <td className="px-4 py-2.5 text-sm text-[var(--text-muted)]">{rank}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {metadata?.logo ? (
                        <img src={metadata.logo} alt="" className="w-7 h-7 rounded-full flex-shrink-0 bg-[var(--bg-tertiary)]" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-7 h-7 rounded-full flex-shrink-0 bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] text-[var(--text-muted)]">{(name || v.votePubkey).charAt(0).toUpperCase()}</div>
                      )}
                      <div className="flex flex-col min-w-0">
                        {name ? (
                          <>
                            <a href={getSolscanUrl('account', v.votePubkey)} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] hover:underline truncate max-w-[200px]">{name}</a>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">{v.votePubkey.slice(0, 8)}...{v.votePubkey.slice(-4)}</span>
                          </>
                        ) : (
                          <a href={getSolscanUrl('account', v.votePubkey)} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-[var(--accent-secondary)] hover:underline">{v.votePubkey.slice(0, 8)}...{v.votePubkey.slice(-4)}</a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div
                      className="relative inline-flex cursor-pointer group"
                      onClick={(e) => { e.stopPropagation(); setExpandedValidator(isExpanded ? null : v.votePubkey); }}
                    >
                      <HealthGauge score={h.score} grade={h.grade} size={32} />
                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-40 pointer-events-none">
                        <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded-lg px-3 py-2 shadow-xl text-[9px] whitespace-nowrap">
                          <div className="font-medium text-[var(--text-primary)] mb-1">Health Score: <span style={{ color: GRADE_COLORS[h.grade] }}>{h.score} ({h.grade})</span></div>
                          <div className="space-y-0.5 text-[var(--text-muted)]">
                            <div>Skip rate (40%): <span className="font-mono" style={{ color: h.skipScore >= 80 ? 'var(--success)' : h.skipScore >= 50 ? 'var(--warning)' : 'var(--error)' }}>{h.skipScore}</span></div>
                            <div>Commission (20%): <span className="font-mono" style={{ color: h.commissionScore >= 80 ? 'var(--success)' : h.commissionScore >= 50 ? 'var(--warning)' : 'var(--error)' }}>{h.commissionScore}</span></div>
                            <div>Liveness (20%): <span className="font-mono" style={{ color: h.livenessScore >= 80 ? 'var(--success)' : 'var(--error)' }}>{h.livenessScore}</span></div>
                            <div>Vote recency (20%): <span className="font-mono" style={{ color: h.voteScore >= 80 ? 'var(--success)' : h.voteScore >= 50 ? 'var(--warning)' : 'var(--error)' }}>{h.voteScore}</span></div>
                          </div>
                          <div className="mt-1 pt-1 border-t border-[var(--border-primary)] text-[8px] text-[var(--text-tertiary)]">Click to expand breakdown</div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-secondary)]">{formatNumber(v.activatedStake)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, stakePercent * 10)}%` }} />
                      </div>
                      <span className="font-mono text-xs text-[var(--text-muted)] w-12 text-right">{stakePercent.toFixed(2)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm">
                    <span className={v.commission > 10 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}>{v.commission}%</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {skipRate !== null ? (
                      <span className={skipRate > 10 ? 'text-[var(--warning)]' : skipRate > 5 ? 'text-[var(--text-secondary)]' : 'text-[var(--success)]'}>{skipRate.toFixed(1)}%</span>
                    ) : <span className="text-[var(--text-muted)]">--</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--text-muted)]">{v.lastVote.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${v.delinquent ? 'bg-[var(--error)]/20 text-[var(--error)]' : 'bg-[var(--success)]/20 text-[var(--success)]'}`}>{v.delinquent ? 'Delinquent' : 'Active'}</span>
                  </td>
                </tr>
                {/* Expanded health breakdown row */}
                {isExpanded && (
                  <tr key={`${v.votePubkey}-detail`} className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/20">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Skip Rate', score: h.skipScore, weight: '40%', detail: skipRate !== null ? `${skipRate.toFixed(2)}% skipped` : 'No data', desc: '0% skip = 100pts, >10% = 0pts' },
                          { label: 'Commission', score: h.commissionScore, weight: '20%', detail: `${v.commission}% commission`, desc: '0% = 100pts, >=10% = 0pts' },
                          { label: 'Liveness', score: h.livenessScore, weight: '20%', detail: v.delinquent ? 'Delinquent' : 'Active', desc: 'Active = 100pts, delinquent = 0pts' },
                          { label: 'Vote Recency', score: h.voteScore, weight: '20%', detail: `${(currentSlot - v.lastVote).toLocaleString()} slots behind`, desc: '<128 slots = 100pts, >512 = 0pts' },
                        ].map(item => (
                          <div key={item.label} className="flex items-start gap-2.5">
                            <div className="flex-shrink-0 mt-0.5">
                              <HealthGauge score={item.score} grade={item.score >= 90 ? 'A' : item.score >= 75 ? 'B' : item.score >= 60 ? 'C' : item.score >= 40 ? 'D' : 'F'} size={36} />
                            </div>
                            <div>
                              <div className="text-[10px] text-[var(--text-secondary)] font-medium">{item.label} <span className="text-[var(--text-muted)]">({item.weight})</span></div>
                              <div className="text-[10px] font-mono text-[var(--text-tertiary)]">{item.detail}</div>
                              <div className="text-[8px] text-[var(--text-muted)] mt-0.5">{item.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Network Limits Section - Comprehensive CU reference post-SIMD upgrades
function NetworkLimitsSection() {
  return (
    <section id="limits" className="pt-6 border-t border-[var(--border-primary)]">
      <SectionHeader title="Network Limits & Compute Units" subtitle="Post-SIMD upgrades" />

      {/* Core Protocol Limits */}
      <div className="mb-6">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Protocol Limits</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
          <LimitCard label="Block CU Limit" value={`${SOLANA_LIMITS.BLOCK_CU_LIMIT / 1e6}M`} highlight />
          <LimitCard label="TX Max CU" value={`${SOLANA_LIMITS.TX_MAX_CU / 1e6}M`} />
          <LimitCard label="TX Default CU" value={`${SOLANA_LIMITS.TX_DEFAULT_CU / 1e3}k`} />
          <LimitCard label="Target Slot Time" value={`${SOLANA_LIMITS.SLOT_TIME_MS}ms`} />
          <LimitCard label="Slots per Epoch" value="432,000" />
          <LimitCard label="Epoch Duration" value="~2-3 days" />
        </div>
      </div>

      {/* Per-Account Limits (SIMD-83 / SIMD-110) */}
      <div className="mb-6">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Per-Account Write Locks <span className="text-[var(--accent-secondary)]">(SIMD-83)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <LimitCard label="Max CU per Account" value="12M" subtext="per block" />
          <LimitCard label="Write Lock Limit" value="12M CU" subtext="single account" />
          <LimitCard label="Read Lock" value="Unlimited" subtext="no CU limit" />
          <LimitCard label="Account Throughput" value="~30 TXs" subtext="heavy ops/account" />
        </div>
      </div>

      {/* Transaction Size Limits */}
      <div className="mb-6">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Transaction Limits</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
          <LimitCard label="Max TX Size" value="1,232" subtext="bytes" />
          <LimitCard label="Max Accounts" value="64" subtext="per TX" />
          <LimitCard label="Max Instructions" value="~40" subtext="practical limit" />
          <LimitCard label="Signature Limit" value="127" subtext="per TX" />
          <LimitCard label="Base Fee" value="5,000" subtext="lamports" />
          <LimitCard label="Priority Fee" value="variable" subtext="per CU" />
        </div>
      </div>

      {/* Compute Unit Costs by Operation */}
      <div className="card p-4">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4">
          CU Costs by Operation Type
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Basic Operations */}
          <div>
            <div className="text-xs text-[var(--accent-tertiary)] font-medium mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-tertiary)]" />
              Basic Operations
            </div>
            <div className="space-y-1.5 text-xs">
              <CUCostRow op="SOL Transfer" cu="~300-450" />
              <CUCostRow op="SPL Token Transfer" cu="~2,000-4,500" />
              <CUCostRow op="Token-2022 Transfer" cu="~4,000-8,000" />
              <CUCostRow op="Create ATA" cu="~4,500" />
              <CUCostRow op="Close Account" cu="~2,000" />
              <CUCostRow op="Memo Instruction" cu="~100-500" />
            </div>
          </div>

          {/* DeFi Operations */}
          <div>
            <div className="text-xs text-[var(--success)] font-medium mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
              DeFi / DEX
            </div>
            <div className="space-y-1.5 text-xs">
              <CUCostRow op="Jupiter Swap (simple)" cu="~80,000-150,000" />
              <CUCostRow op="Jupiter Swap (multi-hop)" cu="~200,000-400,000" />
              <CUCostRow op="Raydium AMM Swap" cu="~50,000-100,000" />
              <CUCostRow op="Raydium CLMM Swap" cu="~80,000-150,000" />
              <CUCostRow op="Orca Whirlpool Swap" cu="~60,000-120,000" />
              <CUCostRow op="Meteora DLMM Swap" cu="~100,000-200,000" />
              <CUCostRow op="Openbook/Phoenix Limit" cu="~30,000-60,000" />
            </div>
          </div>

          {/* Lending & Perps */}
          <div>
            <div className="text-xs text-[var(--accent-secondary)] font-medium mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-secondary)]" />
              Lending & Perps
            </div>
            <div className="space-y-1.5 text-xs">
              <CUCostRow op="Marginfi Deposit" cu="~50,000-80,000" />
              <CUCostRow op="Marginfi Borrow" cu="~60,000-100,000" />
              <CUCostRow op="Kamino Lend Supply" cu="~80,000-120,000" />
              <CUCostRow op="Solend Deposit" cu="~40,000-70,000" />
              <CUCostRow op="Drift Open Position" cu="~200,000-350,000" />
              <CUCostRow op="Drift Liquidation" cu="~400,000-800,000" />
              <CUCostRow op="Zeta Trade" cu="~150,000-300,000" />
            </div>
          </div>

          {/* Staking Operations */}
          <div>
            <div className="text-xs text-[#3b82f6] font-medium mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
              Staking
            </div>
            <div className="space-y-1.5 text-xs">
              <CUCostRow op="Create Stake Account" cu="~3,000-5,000" />
              <CUCostRow op="Delegate Stake" cu="~3,000-5,000" />
              <CUCostRow op="Deactivate Stake" cu="~2,000-3,000" />
              <CUCostRow op="Withdraw Stake" cu="~3,000-5,000" />
              <CUCostRow op="Marinade Stake" cu="~30,000-60,000" />
              <CUCostRow op="Jito Stake SOL" cu="~40,000-80,000" />
              <CUCostRow op="LST Unstake" cu="~50,000-100,000" />
            </div>
          </div>

          {/* NFT Operations */}
          <div>
            <div className="text-xs text-[#f472b6] font-medium mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f472b6]" />
              NFT & Metaplex
            </div>
            <div className="space-y-1.5 text-xs">
              <CUCostRow op="NFT Mint (simple)" cu="~50,000-80,000" />
              <CUCostRow op="NFT Mint (collection)" cu="~80,000-150,000" />
              <CUCostRow op="cNFT Mint" cu="~20,000-40,000" />
              <CUCostRow op="NFT Transfer" cu="~20,000-40,000" />
              <CUCostRow op="Tensor Buy/Sell" cu="~100,000-200,000" />
              <CUCostRow op="Magic Eden Trade" cu="~100,000-180,000" />
              <CUCostRow op="Update Metadata" cu="~30,000-60,000" />
            </div>
          </div>

          {/* Infrastructure */}
          <div>
            <div className="text-xs text-[#a855f7] font-medium mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#a855f7]" />
              Infrastructure
            </div>
            <div className="space-y-1.5 text-xs">
              <CUCostRow op="Pyth Price Update" cu="~5,000-15,000" />
              <CUCostRow op="Switchboard Update" cu="~10,000-30,000" />
              <CUCostRow op="Vote Transaction" cu="~2,000-3,000" />
              <CUCostRow op="Compute Budget Set" cu="~150" />
              <CUCostRow op="Priority Fee Set" cu="~150" />
              <CUCostRow op="Address Lookup Table" cu="~2,000-4,000" />
            </div>
          </div>
        </div>

        {/* SIMD Upgrade Notes */}
        <div className="mt-6 pt-4 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Recent SIMD Upgrades
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div className="bg-[var(--bg-secondary)] rounded p-3">
              <div className="font-medium text-[var(--text-secondary)] mb-1">SIMD-83: Writable Account Limits</div>
              <div className="text-[var(--text-muted)]">
                12M CU cap per writable account per block. Prevents single hot accounts from consuming all block space.
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded p-3">
              <div className="font-medium text-[var(--text-secondary)] mb-1">SIMD-110: Compute Budget</div>
              <div className="text-[var(--text-muted)]">
                More granular CU pricing and improved compute budget instruction handling for better fee estimation.
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded p-3">
              <div className="font-medium text-[var(--text-secondary)] mb-1">Block CU: 48M → 60M</div>
              <div className="text-[var(--text-muted)]">
                Block compute limit increased from 48M to 60M CU, enabling ~25% more throughput per block.
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded p-3">
              <div className="font-medium text-[var(--text-secondary)] mb-1">TX Max: 1.4M CU</div>
              <div className="text-[var(--text-muted)]">
                Single transaction can request up to 1.4M compute units. Default is 200k if not specified.
              </div>
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
            CU Optimization Tips
          </div>
          <div className="grid md:grid-cols-3 gap-3 text-xs text-[var(--text-muted)]">
            <div className="flex items-start gap-2">
              <span className="text-[var(--accent-tertiary)]">→</span>
              <span>Always set compute budget to avoid overpaying. Use <code className="text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1 rounded">setComputeUnitLimit</code></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--accent-tertiary)]">→</span>
              <span>Simulate transactions first to get accurate CU consumption</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--accent-tertiary)]">→</span>
              <span>Use Address Lookup Tables (ALTs) to fit more accounts in a TX</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--accent-tertiary)]">→</span>
              <span>Priority fees are per CU - lower CU = lower total priority fee cost</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--accent-tertiary)]">→</span>
              <span>Hot accounts may hit 12M CU/block limit during congestion</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--accent-tertiary)]">→</span>
              <span>cNFTs use ~80% less CU than traditional NFT mints</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Validator Geographic Distribution
function ValidatorGeography({ validatorLocations }: {
  validatorLocations: { locations: Array<{ identity: string; voteAccount: string; name: string | null; lat: number; lng: number; city: string; country: string; stake: number; version: string }>; byCountry: Map<string, number>; byContinent: Map<string, number> } | null;
}) {
  if (!validatorLocations) return null;

  const { byCountry, byContinent } = validatorLocations;
  const totalValidators = validatorLocations.locations.length;

  // Top 10 countries sorted by count
  const topCountries = Array.from(byCountry.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxCountryCount = topCountries[0]?.[1] || 1;

  // Continents sorted by count
  const continents = Array.from(byContinent.entries())
    .sort((a, b) => b[1] - a[1]);
  const totalContinentCount = continents.reduce((s, [, c]) => s + c, 0);

  const continentColors: Record<string, string> = {
    'North America': 'var(--accent)',
    'Europe': 'var(--accent-secondary)',
    'Asia': 'var(--accent-tertiary)',
    'South America': 'var(--warning)',
    'Oceania': 'var(--success)',
    'Africa': '#f472b6',
    'Other': 'var(--text-tertiary)',
  };

  return (
    <section className="mb-10">
      <SectionHeader title="Geographic Distribution" subtitle={`${totalValidators} nodes indexed (active + inactive)`} />

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Countries */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            Top Countries
          </div>
          <div className="space-y-1.5">
            {topCountries.map(([country, count], idx) => {
              const pct = (count / totalValidators) * 100;
              const flag = COUNTRY_FLAGS[country] || '';
              return (
                <div key={country} className="flex items-center gap-2 text-xs">
                  <span className="text-[10px] text-[var(--text-muted)] w-4 text-right">{idx + 1}</span>
                  <span className="w-20 flex-shrink-0 truncate text-[var(--text-secondary)]">{flag} {country}</span>
                  <div className="flex-1 h-4 bg-[var(--bg-tertiary)] rounded overflow-hidden">
                    <div className="h-full rounded bg-[var(--accent)]/60" style={{ width: `${(count / maxCountryCount) * 100}%` }} />
                  </div>
                  <span className="font-mono text-[var(--text-tertiary)] w-10 text-right">{count}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Continent Distribution */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-secondary)]" />
            By Continent
          </div>
          {/* Stacked bar */}
          <div className="h-8 rounded-lg overflow-hidden flex mb-3">
            {continents.map(([continent, count]) => {
              const pct = (count / totalContinentCount) * 100;
              return (
                <div
                  key={continent}
                  className="h-full group relative cursor-default"
                  style={{ width: `${pct}%`, background: continentColors[continent] || 'var(--text-tertiary)', opacity: 0.7 }}
                  title={`${continent}: ${count} (${pct.toFixed(1)}%)`}
                >
                  {pct > 8 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5">
            {continents.map(([continent, count]) => {
              const pct = (count / totalContinentCount) * 100;
              return (
                <div key={continent} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: continentColors[continent] || 'var(--text-tertiary)' }} />
                  <span className="text-[var(--text-secondary)] w-28 flex-shrink-0">{continent}</span>
                  <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: continentColors[continent] || 'var(--text-tertiary)' }} />
                  </div>
                  <span className="font-mono text-[var(--text-tertiary)] w-10 text-right">{count}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// Helper component for CU cost rows
function CUCostRow({ op, cu }: { op: string; cu: string }) {
  return (
    <div className="flex justify-between items-center py-1 px-2 bg-[var(--bg-secondary)] rounded">
      <span className="text-[var(--text-muted)]">{op}</span>
      <span className="font-mono text-[var(--text-tertiary)]">{cu}</span>
    </div>
  );
}

export default App;
