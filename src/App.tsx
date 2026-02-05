import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  useLiveTransactions,
  useTopValidators,
  useValidatorNames,
  formatCU,
  formatNumber,
  getSolscanUrl,
  truncateSig,
  SOLANA_LIMITS,
  getProgramInfo,
  getTxCategory,
  CATEGORY_COLORS,
} from './hooks/useSolanaData';
import type { SlotData, LiveTransaction, LeaderScheduleInfo, ValidatorMetadata } from './hooks/useSolanaData';

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

// Section definitions for navigation - streamlined for better UX
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: '◉' },
  { id: 'health', label: 'Health', icon: '♥' },
  { id: 'validators', label: 'Validators', icon: '⬡' },
  { id: 'globe', label: 'Leaders', icon: '◎' },
  { id: 'blocks', label: 'Blocks', icon: '▦' },
  { id: 'analytics', label: 'Analytics', icon: '◈' },
  { id: 'live', label: 'Live', icon: '⚡' },
  { id: 'deepdive', label: 'Explorer', icon: '⊞' },
  { id: 'programs', label: 'Programs', icon: '◇' },
];

function App() {
  const { stats, isLoading } = useNetworkStats();
  const { blocks } = useRecentBlocks(4);
  const { supply } = useSupplyInfo();
  const { validators } = useValidatorInfo();
  const { transactions } = useRecentTransactions(blocks);
  const { inflation } = useInflationInfo();
  const { cluster } = useClusterInfo();
  const { production } = useBlockProduction();
  const { schedule: leaderSchedule } = useLeaderSchedule(stats?.currentSlot || 0);
  const { transactions: liveTxs, isConnected: wsConnected } = useLiveTransactions(30);
  const { validatorInfo: topValidators } = useTopValidators(15);
  const { getName: getValidatorName, getMetadata: getValidatorMetadata } = useValidatorNames();

  // Active section tracking for navigation
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Scroll spy to track active section
  useEffect(() => {
    const handleScroll = () => {
      const sections = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean);
      const scrollPos = window.scrollY + 150;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPos) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Calculate block averages
  const avgTxPerBlock = blocks.length > 0
    ? Math.round(blocks.reduce((sum, b) => sum + b.txCount, 0) / blocks.length)
    : 0;
  const avgCuPercent = blocks.length > 0
    ? (blocks.reduce((sum, b) => sum + (b.totalCU || 0), 0) / blocks.length / SOLANA_LIMITS.BLOCK_CU_LIMIT * 100)
    : 0;
  const avgSuccessRate = blocks.length > 0
    ? blocks.reduce((sum, b) => sum + (b.successRate || 100), 0) / blocks.length
    : 100;
  const totalFees = blocks.reduce((sum, b) => sum + (b.totalFees || 0), 0);

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="relative">
          {/* Outer ring */}
          <div className="w-16 h-16 border-2 border-[var(--border-secondary)] rounded-full" />
          {/* Spinning ring */}
          <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-[var(--accent)] rounded-full animate-spin" />
          {/* Inner dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <div className="text-[var(--text-secondary)] font-medium">Connecting to Solana</div>
          <div className="text-[var(--text-muted)] text-sm mt-1">Fetching mainnet data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)] px-4 sm:px-6 py-3 sm:py-4 sticky top-0 bg-[var(--bg-primary)]/95 backdrop-blur-md z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Left side */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold gradient-text whitespace-nowrap">Solana Network</h1>
            <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span className="status-dot live relative pulse-ring" />
              <span>Mainnet</span>
            </div>
          </div>

          {/* Center - Key metrics */}
          <div className="hidden md:flex items-center gap-3">
            <div className="px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
              <span className="text-[10px] text-[var(--text-muted)]">Slot </span>
              <span className="text-xs font-mono text-[var(--text-secondary)]">{stats.currentSlot.toLocaleString()}</span>
            </div>
            <div className="px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
              <span className="text-[10px] text-[var(--text-muted)]">Epoch </span>
              <span className="text-xs font-mono text-[var(--text-secondary)]">{stats.epochInfo.epoch}</span>
              <span className="text-[10px] text-[var(--accent)] ml-1">{stats.epochInfo.epochProgress.toFixed(0)}%</span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[var(--accent-tertiary)]/10 border border-[var(--accent-tertiary)]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-tertiary)] animate-pulse" />
              <span className="text-xs sm:text-sm text-[var(--accent-tertiary)] font-mono font-medium">
                {stats.tps.toLocaleString()} <span className="hidden sm:inline">TPS</span>
              </span>
            </div>
            <a
              href="https://github.com/xAryes"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-secondary)] transition-colors"
            >
              <span>by</span>
              <span className="font-medium text-[var(--text-secondary)]">xAryes</span>
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 lg:hidden">
        <div className={`bg-[var(--bg-primary)]/95 backdrop-blur-md border-t border-[var(--border-primary)] transition-all duration-300 ${
          mobileNavOpen ? 'rounded-t-2xl' : ''
        }`}>
          {/* Expand/collapse button */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="w-full flex items-center justify-center py-2 text-[var(--text-muted)]"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--border-secondary)]" />
          </button>

          {/* Expanded navigation grid */}
          {mobileNavOpen && (
            <div className="px-4 pb-4 pt-2 grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      scrollToSection(section.id);
                      setMobileNavOpen(false);
                    }}
                    className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]'
                    }`}
                  >
                    <span className="text-base">{section.icon}</span>
                    <span className="text-xs font-medium">{section.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick nav bar when collapsed */}
          {!mobileNavOpen && (
            <div className="flex items-center justify-around px-2 pb-3">
              {SECTIONS.slice(0, 5).map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                      isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full transition-all ${isActive ? 'bg-[var(--accent)] scale-125' : 'bg-[var(--text-muted)]'}`} />
                    <span className="text-[9px] font-medium">{section.label.split(' ')[0]}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setMobileNavOpen(true)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg text-[var(--text-muted)]"
              >
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />
                  <div className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />
                  <div className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />
                </div>
                <span className="text-[9px] font-medium">More</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content - Centered with responsive padding */}
      <main ref={mainRef} className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Network Overview */}
        <section id="overview" className="mb-8 sm:mb-10">
          <SectionHeader title="Network Overview" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            <StatCard label="Current Slot" value={stats.currentSlot.toLocaleString()} accent />
            <StatCard label="Block Height" value={stats.blockHeight.toLocaleString()} />
            <StatCard label="TPS" value={stats.tps.toLocaleString()} color="green" />
            <StatCard label="Slot Time" value={`${stats.avgSlotTime}ms`} subtext={stats.avgSlotTime > 500 ? 'Slow' : 'Normal'} />
            <StatCard label="Epoch" value={`${stats.epochInfo.epoch}`} subtext={`${stats.epochInfo.epochProgress.toFixed(1)}%`} />
            <StatCard
              label="Time to Epoch"
              value={formatTimeRemaining((stats.epochInfo.slotsInEpoch - stats.epochInfo.slotIndex) * 0.4)}
            />
          </div>
          {/* Total transactions row */}
          <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
            <span className="text-xs text-[var(--text-muted)]">Total Network Transactions</span>
            <span className="font-mono text-sm text-[var(--accent-secondary)]">
              {stats.transactionCount ? stats.transactionCount.toLocaleString() : '—'}
            </span>
          </div>
        </section>

        {/* Epoch Progress */}
        <section className="mb-8 sm:mb-10">
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
          <div className="mt-1 text-right">
            <span className="text-[10px] text-[var(--text-muted)]">{stats.epochInfo.epochProgress.toFixed(2)}% complete</span>
          </div>
        </section>

        {/* Network Health */}
        <NetworkHealthSection
          tps={stats.tps}
          avgSlotTime={stats.avgSlotTime}
          skipRate={production?.skipRate || 0}
          successRate={avgSuccessRate}
          cuPercent={avgCuPercent}
        />

        {/* Validators & Network */}
        <section id="validators" className="mb-8 sm:mb-10">
          <SectionHeader title="Validators & Network" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            <StatCard
              label="Active Validators"
              value={validators ? validators.activeValidators.toLocaleString() : '—'}
              accent
            />
            <StatCard
              label="Delinquent"
              value={validators ? validators.delinquentValidators.toLocaleString() : '—'}
              subtext={validators ? `${((validators.delinquentValidators / validators.totalValidators) * 100).toFixed(1)}%` : undefined}
            />
            <StatCard
              label="Total Stake"
              value={validators ? formatNumber(validators.totalStake) : '—'}
              subtext="SOL"
            />
            <StatCard
              label="Cluster Nodes"
              value={cluster ? cluster.totalNodes.toLocaleString() : '—'}
              subtext={cluster ? `${cluster.rpcNodes} RPC` : undefined}
            />
            <StatCard
              label="Skip Rate"
              value={production ? `${production.skipRate.toFixed(2)}%` : '—'}
              subtext={production ? `${formatNumber(production.totalSlotsSkipped)} skipped` : undefined}
              color={production && production.skipRate > 5 ? undefined : 'green'}
            />
            <StatCard
              label="Blocks Produced"
              value={production ? formatNumber(production.totalBlocksProduced) : '—'}
              subtext="this epoch"
            />
          </div>
        </section>

        {/* Supply & Economics */}
        <section className="mb-8 sm:mb-10">
          <SectionHeader title="Supply & Economics" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            <StatCard label="Total Supply" value={supply ? formatNumber(supply.total) : '—'} subtext="SOL" accent />
            <StatCard label="Circulating" value={supply ? formatNumber(supply.circulating) : '—'} subtext="SOL" />
            <StatCard label="Non-Circulating" value={supply ? formatNumber(supply.nonCirculating) : '—'} subtext="SOL" />
            <StatCard
              label="Circulating %"
              value={supply ? `${((supply.circulating / supply.total) * 100).toFixed(1)}%` : '—'}
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

        {/* Leader Rotation Map */}
        <section id="globe" className="mb-8 sm:mb-10">
          <SectionHeader title="Leader Rotation" subtitle="Upcoming block producers" />
          <LeaderSchedulePanel
            leaderSchedule={leaderSchedule}
            currentSlot={stats.currentSlot}
            getValidatorName={getValidatorName}
            getValidatorMetadata={getValidatorMetadata}
            validatorCount={validators?.activeValidators || 0}
          />
        </section>

        {/* Block Performance */}
        <section id="blocks" className="mb-8 sm:mb-10">
          <SectionHeader title="Block Performance" subtitle={`Last ${blocks.length} blocks`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            <StatCard label="Avg TX/Block" value={avgTxPerBlock.toLocaleString()} />
            <StatCard label="Avg CU Usage" value={`${avgCuPercent.toFixed(1)}%`} />
            <StatCard label="Avg Success Rate" value={`${avgSuccessRate.toFixed(1)}%`} color="green" />
            <StatCard label="Total Fees" value={formatNumber(totalFees / 1e9)} subtext="SOL" />
            <StatCard label="CU Limit" value={`${SOLANA_LIMITS.BLOCK_CU_LIMIT / 1e6}M`} subtext="per block" />
            <StatCard label="Target Slot" value={`${SOLANA_LIMITS.SLOT_TIME_MS}ms`} />
          </div>
        </section>

        {/* In-House Analytics */}
        <AnalyticsSection blocks={blocks} transactions={transactions} />

        {/* Leader Schedule */}
        <LeaderScheduleSection schedule={leaderSchedule} getValidatorName={getValidatorName} />

        {/* Live Transaction Stream */}
        <LiveTransactionStream transactions={liveTxs} isConnected={wsConnected} />

        {/* CU Distribution */}
        <CUDistribution transactions={transactions} />

        {/* Failed Transactions Analysis */}
        <FailedTransactionsAnalysis blocks={blocks} />

        {/* Block Deep Dive */}
        <BlockDeepDive blocks={blocks} />

        {/* Two Column Layout: Blocks & Transactions */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-10">
          {/* Recent Blocks */}
          <section>
            <SectionHeader title="Recent Blocks" />
            <div className="card overflow-hidden">
              <div className="responsive-table">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)] text-left text-[10px] sm:text-xs text-[var(--text-muted)] uppercase">
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium">Slot</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-right">TXs</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-right">CU %</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-right">Success</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((block) => {
                      const cuPercent = block.totalCU ? (block.totalCU / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100 : 0;
                      const isHighCU = cuPercent > 70;
                      return (
                        <tr key={block.slot} className="border-b border-[var(--border-primary)] last:border-0 table-row-hover">
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                            <a
                              href={getSolscanUrl('block', block.slot)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs sm:text-sm text-[var(--accent-secondary)] hover:underline"
                            >
                              {block.slot.toLocaleString()}
                            </a>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-right font-mono text-xs sm:text-sm text-[var(--text-secondary)]">
                            {block.txCount.toLocaleString()}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                              <div className="w-10 sm:w-12 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full progress-animated"
                                  style={{
                                    width: `${Math.min(100, cuPercent)}%`,
                                    backgroundColor: isHighCU ? 'var(--warning)' : 'var(--text-tertiary)'
                                  }}
                                />
                              </div>
                              <span className={`font-mono text-[10px] sm:text-xs w-7 sm:w-8 text-right ${isHighCU ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>
                                {cuPercent.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-right font-mono text-xs sm:text-sm">
                            <span className={(block.successRate ?? 100) < 95 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}>
                              {(block.successRate ?? 100).toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Recent Transactions */}
          <section>
            <SectionHeader title="Recent Transactions" />
            <div className="card overflow-hidden">
              <div className="responsive-table">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)] text-left text-[10px] sm:text-xs text-[var(--text-muted)] uppercase">
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium">Signature</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-right">CU</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-right">Fee</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length > 0 ? transactions.slice(0, 8).map((tx) => (
                      <tr key={tx.signature} className="border-b border-[var(--border-primary)] last:border-0 table-row-hover">
                        <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                          <a
                            href={getSolscanUrl('tx', tx.signature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs sm:text-sm text-[var(--accent-secondary)] hover:underline"
                          >
                            {truncateSig(tx.signature)}
                          </a>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-right font-mono text-xs sm:text-sm text-[var(--text-secondary)]">
                          {formatCU(tx.computeUnits)}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-right font-mono text-xs sm:text-sm text-[var(--text-secondary)]">
                          {(tx.fee / 1e9).toFixed(6)}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium ${
                            tx.success ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--error)]/20 text-[var(--error)]'
                          }`}>
                            {tx.success ? '✓' : '✗'}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                          <div className="skeleton h-4 w-32 mx-auto mb-2" />
                          <div className="skeleton h-3 w-24 mx-auto" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        {/* Top Programs - Real Data */}
        <TopProgramsSection blocks={blocks} />

        {/* Top Validators */}
        <TopValidatorsSection validatorInfo={topValidators} getValidatorName={getValidatorName} />

        {/* Network Limits Reference */}
        <NetworkLimitsSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-primary)] px-4 sm:px-6 py-6 mt-8 mb-20 lg:mb-0">
        <div className="max-w-7xl mx-auto">
          {/* Category Legend */}
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

          {/* Dashboard Legend + Credits */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[10px] sm:text-xs text-[var(--text-muted)]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              <span className="hidden sm:inline">Real-time Solana mainnet data via Helius RPC</span>
              <span className="sm:inline">Powered by Helius RPC</span>
              <span className="hidden sm:inline text-[var(--text-tertiary)]">•</span>
              <span className="flex items-center gap-1">
                Made with <span className="text-[var(--error)]">♥</span> by
                <a
                  href="https://github.com/xAryes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-secondary)] hover:underline ml-1"
                >
                  xAryes
                </a>
              </span>
            </div>
            <div className="flex items-center flex-wrap gap-x-3 sm:gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                <span>Key metrics</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-tertiary)]" />
                <span>Health</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-secondary)]" />
                <span>Links</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                <span>Warning</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

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
interface TransactionInfo {
  signature: string;
  success: boolean;
  fee: number;
  computeUnits: number;
  slot: number;
}

const CU_CATEGORIES = [
  { name: 'Micro', range: '< 5k', min: 0, max: 5000, color: 'var(--text-tertiary)', description: 'Simple transfers, memo' },
  { name: 'Light', range: '5k-50k', min: 5000, max: 50000, color: 'var(--accent-tertiary)', description: 'Token transfers, basic ops' },
  { name: 'Medium', range: '50k-200k', min: 50000, max: 200000, color: 'var(--accent-secondary)', description: 'Simple swaps, staking' },
  { name: 'Heavy', range: '200k-500k', min: 200000, max: 500000, color: 'var(--accent)', description: 'Complex DeFi, multi-hop' },
  { name: 'Compute', range: '> 500k', min: 500000, max: Infinity, color: 'var(--warning)', description: 'Heavy compute, liquidations' },
];

function CUDistribution({ transactions }: { transactions: TransactionInfo[] }) {
  if (transactions.length === 0) {
    return null;
  }

  // Categorize transactions
  const categories = CU_CATEGORIES.map(cat => ({
    ...cat,
    count: transactions.filter(tx => tx.computeUnits >= cat.min && tx.computeUnits < cat.max).length,
    totalCU: transactions.filter(tx => tx.computeUnits >= cat.min && tx.computeUnits < cat.max)
      .reduce((sum, tx) => sum + tx.computeUnits, 0),
  }));

  const totalTx = transactions.length;
  const totalCU = transactions.reduce((sum, tx) => sum + tx.computeUnits, 0);
  const avgCU = totalTx > 0 ? totalCU / totalTx : 0;
  const maxCU = Math.max(...transactions.map(tx => tx.computeUnits));
  const minCU = Math.min(...transactions.map(tx => tx.computeUnits));

  return (
    <section id="compute" className="mb-10">
      <SectionHeader title="Compute Unit Distribution" subtitle={`${totalTx} transactions analyzed`} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Avg CU/TX" value={formatCU(avgCU)} color="green" />
        <StatCard label="Min CU" value={formatCU(minCU)} />
        <StatCard label="Max CU" value={formatCU(maxCU)} />
        <StatCard label="Total CU" value={formatCU(totalCU)} />
      </div>

      {/* Distribution bars */}
      <div className="card p-4">
        <div className="space-y-3">
          {categories.map(cat => {
            const percent = totalTx > 0 ? (cat.count / totalTx) * 100 : 0;

            return (
              <div key={cat.name} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm text-[var(--text-secondary)] font-medium w-16">{cat.name}</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">{cat.range}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-[var(--text-tertiary)] w-20 text-right">{cat.count} txs ({percent.toFixed(0)}%)</span>
                    <span className="text-[var(--text-muted)] w-24 text-right">{formatCU(cat.totalCU)} CU</span>
                  </div>
                </div>

                {/* TX count bar */}
                <div className="flex gap-2 items-center">
                  <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${percent}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>

                {/* Description on hover */}
                <div className="text-xs text-[var(--text-muted)] mt-1 opacity-60">
                  {cat.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* Typical CU requirements reference */}
        <div className="mt-6 pt-4 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Typical CU Requirements</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">SOL Transfer</span>
              <span className="font-mono text-[var(--text-tertiary)]">~450</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Token Transfer</span>
              <span className="font-mono text-[var(--text-tertiary)]">~3k</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Jupiter Swap</span>
              <span className="font-mono text-[var(--text-tertiary)]">~80-300k</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">NFT Mint</span>
              <span className="font-mono text-[var(--text-tertiary)]">~50-150k</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Stake Account</span>
              <span className="font-mono text-[var(--text-tertiary)]">~5k</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Raydium Swap</span>
              <span className="font-mono text-[var(--text-tertiary)]">~50-100k</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Margin Trade</span>
              <span className="font-mono text-[var(--text-tertiary)]">~200-400k</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Liquidation</span>
              <span className="font-mono text-[var(--text-tertiary)]">~300-800k</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// In-House Analytics Section - Deep network analysis
function AnalyticsSection({
  blocks,
  transactions,
}: {
  blocks: SlotData[];
  transactions: TransactionInfo[];
}) {
  // Fee Analysis
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

  // Transaction Success/Failure Patterns
  const successPatterns = useMemo(() => {
    const successful = transactions.filter(tx => tx.success);
    const failed = transactions.filter(tx => !tx.success);

    const successCUAvg = successful.length > 0
      ? successful.reduce((sum, tx) => sum + tx.computeUnits, 0) / successful.length
      : 0;
    const failedCUAvg = failed.length > 0
      ? failed.reduce((sum, tx) => sum + tx.computeUnits, 0) / failed.length
      : 0;

    return {
      successCount: successful.length,
      failedCount: failed.length,
      successRate: transactions.length > 0 ? (successful.length / transactions.length) * 100 : 100,
      successCUAvg,
      failedCUAvg,
    };
  }, [transactions]);

  // Block Efficiency Analysis
  const blockEfficiency = useMemo(() => {
    if (blocks.length === 0) return null;

    const cuUsages = blocks.map(b => (b.totalCU || 0) / SOLANA_LIMITS.BLOCK_CU_LIMIT * 100);
    const avgCU = cuUsages.reduce((a, b) => a + b, 0) / cuUsages.length;
    const maxCU = Math.max(...cuUsages);

    const txCounts = blocks.map(b => b.txCount);
    const avgTx = txCounts.reduce((a, b) => a + b, 0) / txCounts.length;

    const wastedCU = blocks.reduce((sum, b) => {
      const used = b.totalCU || 0;
      return sum + (SOLANA_LIMITS.BLOCK_CU_LIMIT - used);
    }, 0);

    return {
      avgCU,
      maxCU,
      avgTx,
      wastedCU,
      wastedPercent: (wastedCU / (SOLANA_LIMITS.BLOCK_CU_LIMIT * blocks.length)) * 100,
    };
  }, [blocks]);

  // Fee distribution by percentiles
  const feePercentiles = useMemo(() => {
    if (transactions.length === 0) return null;

    const fees = transactions.map(tx => tx.fee).sort((a, b) => a - b);
    const getPercentile = (p: number) => fees[Math.floor(fees.length * p / 100)] || 0;

    // Fee buckets for distribution
    const baseFee = 5000; // 5000 lamports = 0.000005 SOL
    const buckets = [
      { name: 'Base Only', max: baseFee * 1.1, count: 0 },
      { name: 'Low Priority', max: baseFee * 2, count: 0 },
      { name: 'Medium Priority', max: baseFee * 10, count: 0 },
      { name: 'High Priority', max: baseFee * 100, count: 0 },
      { name: 'Urgent', max: Infinity, count: 0 },
    ];

    for (const tx of transactions) {
      for (const bucket of buckets) {
        if (tx.fee <= bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    return {
      p10: getPercentile(10) / 1e9,
      p25: getPercentile(25) / 1e9,
      p50: getPercentile(50) / 1e9,
      p75: getPercentile(75) / 1e9,
      p90: getPercentile(90) / 1e9,
      p99: getPercentile(99) / 1e9,
      buckets,
    };
  }, [transactions]);

  return (
    <section id="analytics" className="mb-10">
      <SectionHeader title="Network Analytics" subtitle="In-depth analysis" />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Fee Analysis Card */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            Fee Analysis
          </div>

          {feeStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Total Fees</div>
                  <div className="font-mono text-lg text-[var(--accent)]">{feeStats.total.toFixed(4)}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">SOL</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Avg Fee</div>
                  <div className="font-mono text-sm text-[var(--text-secondary)]">{feeStats.avg.toFixed(6)}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">SOL/tx</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Median Fee</div>
                  <div className="font-mono text-sm text-[var(--text-secondary)]">{feeStats.median.toFixed(6)}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">SOL/tx</div>
                </div>
              </div>

              {/* Fee Range Bar */}
              <div>
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                  <span>Min: {feeStats.min.toFixed(6)}</span>
                  <span>Max: {feeStats.max.toFixed(6)}</span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden relative">
                  <div
                    className="absolute h-full bg-[var(--accent)]/30 rounded-full"
                    style={{
                      left: '0%',
                      width: '100%'
                    }}
                  />
                  <div
                    className="absolute h-full w-1 bg-[var(--accent)]"
                    style={{
                      left: `${((feeStats.median - feeStats.min) / (feeStats.max - feeStats.min || 1)) * 100}%`
                    }}
                    title="Median"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--text-muted)]">Loading fee data...</div>
          )}
        </div>

        {/* Success/Failure Patterns */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
            Transaction Patterns
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-mono text-[var(--success)]">{successPatterns.successRate.toFixed(1)}%</span>
                  <span className="text-[10px] text-[var(--text-muted)]">success</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--success)] rounded-full"
                    style={{ width: `${successPatterns.successRate}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[var(--text-muted)]">Passed</div>
                  <div className="font-mono text-[var(--success)]">{successPatterns.successCount}</div>
                </div>
                <div>
                  <div className="text-[var(--text-muted)]">Failed</div>
                  <div className="font-mono text-[var(--error)]">{successPatterns.failedCount}</div>
                </div>
              </div>
            </div>

            {/* CU comparison */}
            <div className="pt-3 border-t border-[var(--border-primary)]">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">Avg CU by Status</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                  <span className="text-[var(--text-muted)]">Success:</span>
                  <span className="font-mono text-[var(--text-secondary)]">{formatCU(successPatterns.successCUAvg)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)]" />
                  <span className="text-[var(--text-muted)]">Failed:</span>
                  <span className="font-mono text-[var(--text-secondary)]">{formatCU(successPatterns.failedCUAvg)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Block Efficiency */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-secondary)]" />
            Block Efficiency
          </div>

          {blockEfficiency ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Avg CU Fill</div>
                  <div className="font-mono text-lg text-[var(--accent-secondary)]">{blockEfficiency.avgCU.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Peak Fill</div>
                  <div className="font-mono text-sm text-[var(--text-secondary)]">{blockEfficiency.maxCU.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Avg TX/Block</div>
                  <div className="font-mono text-sm text-[var(--text-secondary)]">{Math.round(blockEfficiency.avgTx)}</div>
                </div>
              </div>

              {/* Capacity utilization visual */}
              <div>
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                  <span>Block Capacity Utilization</span>
                  <span>{blockEfficiency.wastedPercent.toFixed(1)}% unused</span>
                </div>
                <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-[var(--accent-secondary)]"
                    style={{ width: `${blockEfficiency.avgCU}%` }}
                  />
                  <div
                    className="h-full bg-[var(--bg-tertiary)]"
                    style={{ width: `${100 - blockEfficiency.avgCU}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] mt-1">
                  <span className="text-[var(--accent-secondary)]">Used: {formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT * blockEfficiency.avgCU / 100)}</span>
                  <span className="text-[var(--text-muted)]">Available: {formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT * (100 - blockEfficiency.avgCU) / 100)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--text-muted)]">Loading block data...</div>
          )}
        </div>

        {/* Fee Breakdown */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
            Fee Breakdown
          </div>

          {feePercentiles ? (
            <div className="space-y-4">
              {/* Percentile distribution */}
              <div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">Fee Percentiles (SOL)</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-[var(--bg-secondary)] rounded p-2">
                    <div className="text-[var(--text-muted)]">p25</div>
                    <div className="font-mono text-[var(--text-secondary)]">{feePercentiles.p25.toFixed(6)}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2">
                    <div className="text-[var(--text-muted)]">p50</div>
                    <div className="font-mono text-[var(--accent)]">{feePercentiles.p50.toFixed(6)}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2">
                    <div className="text-[var(--text-muted)]">p75</div>
                    <div className="font-mono text-[var(--text-secondary)]">{feePercentiles.p75.toFixed(6)}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2">
                    <div className="text-[var(--text-muted)]">p90</div>
                    <div className="font-mono text-[var(--warning)]">{feePercentiles.p90.toFixed(6)}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2">
                    <div className="text-[var(--text-muted)]">p99</div>
                    <div className="font-mono text-[var(--error)]">{feePercentiles.p99.toFixed(6)}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2">
                    <div className="text-[var(--text-muted)]">Spread</div>
                    <div className="font-mono text-[var(--text-secondary)]">{((feePercentiles.p90 - feePercentiles.p10) * 1e9).toFixed(0)}λ</div>
                  </div>
                </div>
              </div>

              {/* Priority distribution */}
              <div className="pt-3 border-t border-[var(--border-primary)]">
                <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">Priority Distribution</div>
                <div className="space-y-1.5">
                  {feePercentiles.buckets.map((bucket) => {
                    const percentage = transactions.length > 0 ? (bucket.count / transactions.length) * 100 : 0;
                    const colors: Record<string, string> = {
                      'Base Only': '#6b7280',
                      'Low Priority': '#4ade80',
                      'Medium Priority': '#60a5fa',
                      'High Priority': '#f59e0b',
                      'Urgent': '#ef4444',
                    };
                    return (
                      <div key={bucket.name} className="flex items-center gap-2 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[bucket.name] }} />
                        <span className="text-[var(--text-muted)] w-24">{bucket.name}</span>
                        <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${percentage}%`, backgroundColor: colors[bucket.name], opacity: 0.8 }}
                          />
                        </div>
                        <span className="font-mono text-[var(--text-muted)] w-8 text-right">{bucket.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--text-muted)]">Loading fee data...</div>
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
  validatorCount,
}: {
  leaderSchedule: LeaderScheduleInfo | null;
  currentSlot: number;
  getValidatorName: (pubkey: string) => string | null;
  getValidatorMetadata: (pubkey: string) => ValidatorMetadata | null;
  validatorCount: number;
}) {
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

  return (
    <div className="card p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Leader - Hero */}
        <div className="lg:col-span-1">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Current Leader</div>
          {currentLeader ? (
            <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--accent-tertiary)]/20 to-transparent border border-[var(--accent-tertiary)]/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  {currentLeader.logo ? (
                    <img
                      src={currentLeader.logo}
                      alt={currentLeader.name}
                      className="w-12 h-12 rounded-full border-2 border-[var(--accent-tertiary)] object-cover shadow-lg"
                      onError={(e) => {
                        // Fallback to gradient on error
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 border-[var(--accent-tertiary)] text-white font-bold text-lg shadow-lg ${currentLeader.logo ? 'hidden' : ''}`}
                    style={{ background: getAvatarGradient(currentLeader.leader) }}
                  >
                    {currentLeader.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent-tertiary)] flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[var(--text-primary)] truncate">{currentLeader.name}</div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>Producing blocks now</span>
                    <span className="text-[var(--text-tertiary)]">{formatLocation(currentLeader.location)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Slot</span>
                <span className="font-mono text-[var(--accent-tertiary)]">{currentLeader.slot.toLocaleString()}</span>
              </div>
              {/* Progress indicator - 4 slots per leader */}
              <div className="mt-3 flex gap-1">
                {[...Array(4)].map((_, i) => {
                  const slotInSequence = currentSlot - currentLeader.slot;
                  const isCompleted = i < slotInSequence;
                  const isCurrent = i === slotInSequence;
                  return (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                        isCompleted
                          ? 'bg-[var(--accent-tertiary)]'
                          : isCurrent
                          ? 'bg-[var(--accent-tertiary)] animate-pulse'
                          : 'bg-[var(--bg-tertiary)]'
                      }`}
                    />
                  );
                })}
              </div>
              <div className="mt-1 text-[10px] text-[var(--text-muted)] text-center">
                Slot {Math.min(4, Math.max(1, currentSlot - currentLeader.slot + 1))} of 4
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] text-center text-sm text-[var(--text-muted)]">
              Loading...
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
              <div className="text-xl font-mono font-bold text-[var(--accent)]">{currentSlot.toLocaleString()}</div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Current Slot</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
              <div className="text-xl font-mono font-bold text-[var(--text-secondary)]">{validatorCount.toLocaleString()}</div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Validators</div>
            </div>
          </div>
        </div>

        {/* Upcoming Leaders - Full Schedule */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Upcoming Leaders</div>
            <div className="text-xs text-[var(--text-tertiary)] font-mono">{leaders.length} scheduled</div>
          </div>

          {/* Leaders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {upcomingLeaders.map((leader) => (
              <div
                key={leader.slot}
                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="relative w-8 h-8 flex-shrink-0">
                  {leader.logo ? (
                    <img
                      src={leader.logo}
                      alt={leader.name}
                      className="w-8 h-8 rounded-full object-cover shadow"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow ${leader.logo ? 'hidden' : ''}`}
                    style={{ background: getAvatarGradient(leader.leader) }}
                  >
                    {leader.shortName.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-secondary)] truncate">{leader.shortName}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{formatLocation(leader.location)}</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono">
                    Slot {leader.slot.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-[var(--accent-secondary)]">+{leader.relativeSlot}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">slots</div>
                </div>
              </div>
            ))}
          </div>

          {upcomingLeaders.length === 0 && (
            <div className="text-center text-sm text-[var(--text-muted)] py-8">
              Loading upcoming leaders...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Network Health Section - Visual health indicators
function NetworkHealthSection({
  tps,
  avgSlotTime,
  skipRate,
  successRate,
  cuPercent,
}: {
  tps: number;
  avgSlotTime: number;
  skipRate: number;
  successRate: number;
  cuPercent: number;
}) {
  // Calculate health scores (0-100)
  const tpsHealth = Math.min(100, (tps / 5000) * 100); // 5000 TPS = 100%
  const slotTimeHealth = Math.max(0, 100 - Math.abs(avgSlotTime - 400) / 4); // 400ms ideal
  const skipRateHealth = Math.max(0, 100 - skipRate * 10); // <10% skip rate = healthy
  const successHealth = successRate; // Direct percentage
  const cuHealth = cuPercent < 80 ? 100 : Math.max(0, 100 - (cuPercent - 80) * 5); // <80% = healthy

  const overallHealth = (tpsHealth + slotTimeHealth + skipRateHealth + successHealth + cuHealth) / 5;

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Healthy';
    if (score >= 50) return 'Degraded';
    return 'Critical';
  };

  return (
    <section id="health" className="mb-10">
      <SectionHeader title="Network Health" subtitle="Real-time status" />
      <div className="card p-4 sm:p-6">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
          {/* Overall Health - Large */}
          <div className="col-span-3 sm:col-span-2 flex items-center gap-3 sm:gap-4 p-3 sm:p-0 rounded-xl sm:rounded-none bg-[var(--bg-secondary)] sm:bg-transparent">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke="var(--bg-tertiary)"
                  strokeWidth="3"
                />
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke={getHealthColor(overallHealth)}
                  strokeWidth="3"
                  strokeDasharray={`${overallHealth} ${100 - overallHealth}`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base sm:text-lg font-mono font-bold" style={{ color: getHealthColor(overallHealth) }}>
                  {Math.round(overallHealth)}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: getHealthColor(overallHealth) }}>
                {getHealthLabel(overallHealth)}
              </div>
              <div className="text-[10px] sm:text-xs text-[var(--text-muted)]">Overall Network Health</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${overallHealth >= 80 ? 'bg-[var(--success)] animate-pulse' : overallHealth >= 50 ? 'bg-[var(--warning)]' : 'bg-[var(--error)]'}`} />
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {overallHealth >= 80 ? 'All systems operational' : overallHealth >= 50 ? 'Some degradation' : 'Issues detected'}
                </span>
              </div>
            </div>
          </div>

          {/* Individual Metrics */}
          <HealthMetric label="TPS" value={tps.toLocaleString()} score={tpsHealth} />
          <HealthMetric label="Slot Time" value={`${avgSlotTime}ms`} score={slotTimeHealth} />
          <HealthMetric label="Skip Rate" value={`${skipRate.toFixed(2)}%`} score={skipRateHealth} />
          <HealthMetric label="TX Success" value={`${successRate.toFixed(1)}%`} score={successHealth} />
        </div>
      </div>
    </section>
  );
}

// Health metric mini-card
function HealthMetric({ label, value, score }: { label: string; value: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'var(--success)';
    if (s >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className="flex flex-col items-center text-center p-2 sm:p-0 rounded-lg sm:rounded-none bg-[var(--bg-secondary)]/50 sm:bg-transparent">
      <div className="w-9 h-9 sm:w-10 sm:h-10 relative mb-1">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="var(--bg-tertiary)" strokeWidth="4" />
          <circle
            cx="18" cy="18" r="14"
            fill="none"
            stroke={getColor(score)}
            strokeWidth="4"
            strokeDasharray={`${score * 0.88} 88`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
      </div>
      <div className="text-[10px] sm:text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-xs sm:text-sm font-mono" style={{ color: getColor(score) }}>{value}</div>
    </div>
  );
}

// Top Programs Section - Real data from blocks
function TopProgramsSection({ blocks }: { blocks: SlotData[] }) {
  const programStats = useMemo(() => {
    const stats = new Map<string, { count: number; cu: number; fees: number; success: number; total: number }>();

    for (const block of blocks) {
      if (!block.transactions) continue;

      for (const tx of block.transactions) {
        for (const prog of tx.programs) {
          const info = getProgramInfo(prog);
          // Skip core/system programs
          if (info.category === 'core' || info.category === 'vote') continue;

          const stat = stats.get(prog) || { count: 0, cu: 0, fees: 0, success: 0, total: 0 };
          stat.count++;
          stat.total++;
          stat.cu += tx.computeUnits;
          stat.fees += tx.fee;
          if (tx.success) stat.success++;
          stats.set(prog, stat);
        }
      }
    }

    // Sort by count
    return Array.from(stats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
  }, [blocks]);

  if (programStats.length === 0) {
    return (
      <section id="programs" className="mb-10">
        <SectionHeader title="Top Programs" subtitle="By transaction count" />
        <div className="card p-8 text-center text-[var(--text-muted)]">
          Loading program data from recent blocks...
        </div>
      </section>
    );
  }

  const maxCount = programStats[0]?.[1].count || 1;

  return (
    <section id="programs" className="mb-10">
      <SectionHeader title="Top Programs" subtitle={`From last ${blocks.length} blocks`} />
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-left text-xs text-[var(--text-muted)] uppercase">
              <th className="px-4 py-3 font-medium">Program</th>
              <th className="px-4 py-3 font-medium">Activity</th>
              <th className="px-4 py-3 font-medium text-right">TXs</th>
              <th className="px-4 py-3 font-medium text-right">CU Used</th>
              <th className="px-4 py-3 font-medium text-right">Success</th>
            </tr>
          </thead>
          <tbody>
            {programStats.map(([prog, stat]) => {
              const info = getProgramInfo(prog);
              const successRate = stat.total > 0 ? (stat.success / stat.total) * 100 : 100;
              const barWidth = (stat.count / maxCount) * 100;

              return (
                <tr
                  key={prog}
                  className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: info.color }}
                      />
                      <a
                        href={getSolscanUrl('account', prog)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] hover:underline truncate max-w-[180px]"
                      >
                        {info.name}
                      </a>
                      <span className="text-[10px] text-[var(--text-muted)] capitalize">
                        ({info.category})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 w-32">
                    <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barWidth}%`, backgroundColor: info.color }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-secondary)]">
                    {stat.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-muted)]">
                    {formatCU(stat.cu)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm">
                    <span className={successRate < 95 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}>
                      {successRate.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Failed Transactions Analysis
function FailedTransactionsAnalysis({ blocks }: { blocks: SlotData[] }) {
  const analysis = useMemo(() => {
    const failedTxs: Array<{
      signature: string;
      slot: number;
      programs: string[];
      cu: number;
      fee: number;
      category: string;
    }> = [];

    const failuresByCategory = new Map<string, number>();
    const failuresByProgram = new Map<string, number>();
    let totalFailed = 0;
    let totalTxs = 0;

    for (const block of blocks) {
      if (!block.transactions) continue;

      for (const tx of block.transactions) {
        totalTxs++;
        if (!tx.success) {
          totalFailed++;
          const category = getTxCategory(tx.programs);
          failuresByCategory.set(category, (failuresByCategory.get(category) || 0) + 1);

          for (const prog of tx.programs) {
            const info = getProgramInfo(prog);
            if (info.category !== 'core') {
              failuresByProgram.set(prog, (failuresByProgram.get(prog) || 0) + 1);
            }
          }

          if (failedTxs.length < 10) {
            failedTxs.push({
              signature: tx.signature,
              slot: block.slot,
              programs: tx.programs,
              cu: tx.computeUnits,
              fee: tx.fee,
              category,
            });
          }
        }
      }
    }

    const topFailingPrograms = Array.from(failuresByProgram.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const categoryBreakdown = Array.from(failuresByCategory.entries())
      .sort((a, b) => b[1] - a[1]);

    return {
      failedTxs,
      totalFailed,
      totalTxs,
      failureRate: totalTxs > 0 ? (totalFailed / totalTxs) * 100 : 0,
      topFailingPrograms,
      categoryBreakdown,
    };
  }, [blocks]);

  if (analysis.totalFailed === 0) {
    return (
      <section id="failures" className="mb-10">
        <SectionHeader title="Failed Transactions" subtitle="Analysis" />
        <div className="card p-6 text-center">
          <div className="text-4xl mb-2">✓</div>
          <div className="text-[var(--success)] font-medium">No Failed Transactions</div>
          <div className="text-sm text-[var(--text-muted)]">
            All {analysis.totalTxs} transactions in recent blocks succeeded
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="failures" className="mb-10">
      <SectionHeader title="Failed Transactions" subtitle={`${analysis.totalFailed} failures (${analysis.failureRate.toFixed(1)}%)`} />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Failure Stats */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Failure Overview</div>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-3xl font-mono text-[var(--error)]">{analysis.totalFailed}</div>
            <div>
              <div className="text-sm text-[var(--text-secondary)]">Failed TXs</div>
              <div className="text-xs text-[var(--text-muted)]">of {analysis.totalTxs} total</div>
            </div>
          </div>

          {/* Failure rate bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--text-muted)]">Failure Rate</span>
              <span className="font-mono text-[var(--error)]">{analysis.failureRate.toFixed(2)}%</span>
            </div>
            <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--error)] rounded-full"
                style={{ width: `${Math.min(100, analysis.failureRate * 10)}%` }}
              />
            </div>
          </div>

          {/* By Category */}
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">By Category</div>
          <div className="space-y-1">
            {analysis.categoryBreakdown.map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                  <span className="text-[var(--text-secondary)] capitalize">{cat}</span>
                </div>
                <span className="font-mono text-[var(--text-muted)]">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Failing Programs */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Top Failing Programs</div>
          {analysis.topFailingPrograms.length > 0 ? (
            <div className="space-y-2">
              {analysis.topFailingPrograms.map(([prog, count]) => {
                const info = getProgramInfo(prog);
                const percent = (count / analysis.totalFailed) * 100;
                return (
                  <div key={prog}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                        <span className="text-sm text-[var(--text-secondary)] truncate max-w-[120px]">{info.name}</span>
                      </div>
                      <span className="text-xs font-mono text-[var(--error)]">{count}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--error)]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-[var(--text-muted)] py-4 text-sm">
              No program-specific failures detected
            </div>
          )}
        </div>

        {/* Recent Failed TXs */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Recent Failed TXs</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {analysis.failedTxs.map((tx) => {
              const mainProg = tx.programs.find(p => getProgramInfo(p).category !== 'core');
              const info = mainProg ? getProgramInfo(mainProg) : null;
              return (
                <div key={tx.signature} className="flex items-center justify-between py-1 border-b border-[var(--border-primary)] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)]" />
                    <a
                      href={getSolscanUrl('tx', tx.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-[var(--accent-secondary)] hover:underline"
                    >
                      {truncateSig(tx.signature)}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    {info && (
                      <span className="text-[10px] text-[var(--text-muted)]">{info.name}</span>
                    )}
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                      {formatCU(tx.cu)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// Block Deep Dive - Detailed block analysis with bar chart visualization
function BlockDeepDive({ blocks }: { blocks: SlotData[] }) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [showVotes, setShowVotes] = useState(false);
  const [hoveredTx, setHoveredTx] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [searchSlot, setSearchSlot] = useState('');
  const [pausedBlocks, setPausedBlocks] = useState<SlotData[]>([]);

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

  const { analysis, blockStats, sections, txsForChart, maxCU } = useMemo(() => {
    if (!selectedBlock?.transactions) {
      return { analysis: null, blockStats: null, sections: [], txsForChart: [], maxCU: 0 };
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
    const nonVoteCUs = nonVoteTxs.map(tx => tx.computeUnits).sort((a, b) => a - b);

    // Block statistics like Solana Beach
    const stats = {
      // Transactions
      total,
      nonVote: nonVoteTxs.length,
      vote: voteTxs.length,
      success: successTxs.length,
      failed: failedTxs.length,
      nonVotePercent: total > 0 ? (nonVoteTxs.length / total) * 100 : 0,
      votePercent: total > 0 ? (voteTxs.length / total) * 100 : 0,
      successPercent: total > 0 ? (successTxs.length / total) * 100 : 0,
      failedPercent: total > 0 ? (failedTxs.length / total) * 100 : 0,

      // Fees (in lamports)
      totalFees,
      baseFees: totalBaseFees,
      priorityFees: totalPriorityFees,
      jitoTips: totalJitoTips,
      nonVoteBaseFees,
      nonVotePriorityFees,
      nonVoteJitoTips,
      jitoTxCount,
      avgFee: nonVoteTxs.length > 0 ? nonVoteFees.reduce((a, b) => a + b, 0) / nonVoteFees.length : 0,
      p50Fee: getPercentile(nonVoteFees, 50),
      p99Fee: getPercentile(nonVoteFees, 99),
      maxFee: nonVoteFees[nonVoteFees.length - 1] || 0,

      // Compute Units
      totalCU,
      blockUtilization: (totalCU / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100,
      nonVoteCU,
      voteCU,
      nonVoteCUPercent: totalCU > 0 ? (nonVoteCU / totalCU) * 100 : 0,
      voteCUPercent: totalCU > 0 ? (voteCU / totalCU) * 100 : 0,
      avgCU: nonVoteTxs.length > 0 ? nonVoteCU / nonVoteTxs.length : 0,
      p50CU: getPercentile(nonVoteCUs, 50),
      p99CU: getPercentile(nonVoteCUs, 99),
      maxCUVal: nonVoteCUs[nonVoteCUs.length - 1] || 0,
    };

    // Filter for chart display
    const filteredTxs = showVotes ? txs : nonVoteTxs;

    // Find max CU for scaling
    const maxComputeUnits = Math.max(...filteredTxs.map(tx => tx.computeUnits), 1);

    // Divide into thirds: beginning, middle, end
    const third = Math.ceil(total / 3);
    const beginning = txs.slice(0, third);
    const middle = txs.slice(third, third * 2);
    const end = txs.slice(third * 2);

    const analyzeSection = (section: typeof txs, name: string, color: string) => {
      const categories = new Map<string, number>();
      let sectionCU = 0;
      let sectionFailed = 0;
      let sectionFees = 0;

      for (const tx of section) {
        const cat = getTxCategory(tx.programs);
        categories.set(cat, (categories.get(cat) || 0) + 1);
        sectionCU += tx.computeUnits;
        sectionFees += tx.fee;
        if (!tx.success) sectionFailed++;
      }

      return {
        name,
        color,
        count: section.length,
        categories: Array.from(categories.entries()).sort((a, b) => b[1] - a[1]),
        avgCU: section.length > 0 ? sectionCU / section.length : 0,
        totalCU: sectionCU,
        totalFees: sectionFees,
        failRate: section.length > 0 ? (sectionFailed / section.length) * 100 : 0,
      };
    };

    const sectionData = [
      analyzeSection(beginning, 'Beginning', 'var(--accent)'),
      analyzeSection(middle, 'Middle', 'var(--text-tertiary)'),
      analyzeSection(end, 'End', 'var(--text-muted)'),
    ];

    return {
      analysis: { total },
      blockStats: stats,
      sections: sectionData,
      txsForChart: filteredTxs,
      maxCU: maxComputeUnits,
    };
  }, [selectedBlock, showVotes]);

  if (!selectedBlock || !analysis || !blockStats) {
    return null;
  }

  // Color helper for transactions
  const getTxColor = (tx: { success: boolean; programs: string[] }) => {
    if (!tx.success) return '#ef4444';
    const cat = getTxCategory(tx.programs);
    if (cat === 'vote') return '#6b7280';
    return CATEGORY_COLORS[cat] || '#22c55e';
  };

  return (
    <section id="deepdive" className="mb-10">
      <SectionHeader title="Block Explorer" subtitle="Real-time block analysis" />

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

            return (
              <button
                key={block.slot}
                onClick={() => setSelectedSlot(block.slot)}
                className={`relative group transition-all duration-200 ${
                  isSelected ? 'z-10' : ''
                }`}
              >
                {/* Block card */}
                <div className={`rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-[var(--bg-secondary)] border-[var(--accent)] shadow-lg shadow-[var(--accent)]/10 ring-1 ring-[var(--accent)]/50'
                    : 'bg-[var(--bg-secondary)]/50 border-[var(--border-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'
                }`}>
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
                    {/* TX count */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)]">TXs</span>
                      <span className="font-mono text-xs text-[var(--text-secondary)]">{block.txCount}</span>
                    </div>

                    {/* CU fill bar */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-[var(--text-muted)]">CU</span>
                        <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{cuPercent.toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, cuPercent)}%`,
                            backgroundColor: cuPercent > 80 ? 'var(--warning)' : isSelected ? 'var(--accent)' : 'var(--text-muted)'
                          }}
                        />
                      </div>
                    </div>

                    {/* Success rate */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)]">Success</span>
                      <span className={`font-mono text-[10px] ${
                        successRate < 95 ? 'text-[var(--warning)]' : 'text-[var(--success)]'
                      }`}>
                        {successRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detailed Block Analysis - Solana Beach Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* BLOCK INFO */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 font-semibold">Block Info</div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Slot</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">{selectedBlock.slot.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Timestamp</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">
                {selectedBlock.blockTime ? new Date(selectedBlock.blockTime * 1000).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Block Hash</span>
              <a
                href={getSolscanUrl('block', selectedBlock.slot)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[var(--accent-secondary)] hover:underline truncate max-w-[200px]"
              >
                {selectedBlock.blockhash}
              </a>
            </div>
          </div>
        </div>

        {/* TRANSACTIONS */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 font-semibold">Transactions</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Total</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">{blockStats.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Non-Vote</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">
                {blockStats.nonVote.toLocaleString()} <span className="text-[var(--text-tertiary)]">({blockStats.nonVotePercent.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Vote</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">
                {blockStats.vote.toLocaleString()} <span className="text-[var(--text-tertiary)]">({blockStats.votePercent.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Success</span>
              <span className="font-mono text-sm text-[var(--success)]">
                {blockStats.success.toLocaleString()} <span className="text-[var(--text-tertiary)]">({blockStats.successPercent.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Failed</span>
              <span className="font-mono text-sm text-[var(--error)]">
                {blockStats.failed.toLocaleString()} <span className="text-[var(--text-tertiary)]">({blockStats.failedPercent.toFixed(1)}%)</span>
              </span>
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
            <div className="border-t border-[var(--border-primary)] my-2 pt-2">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">Non-Vote Fee Breakdown</div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Base:</span>
                  <span className="font-mono text-[var(--text-tertiary)]">{(blockStats.nonVoteBaseFees / 1e9).toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Priority:</span>
                  <span className="font-mono text-[var(--accent)]">{(blockStats.nonVotePriorityFees / 1e9).toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Jito:</span>
                  <span className="font-mono text-[var(--accent-tertiary)]">{(blockStats.nonVoteJitoTips / 1e9).toFixed(6)}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--border-primary)] my-2 pt-2">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">Fee Distribution (non-vote)</div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">avg:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{Math.round(blockStats.avgFee).toLocaleString()} L</span>
                <span className="text-[var(--text-muted)]">p50:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{blockStats.p50Fee.toLocaleString()} L</span>
                <span className="text-[var(--text-muted)]">p99:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{blockStats.p99Fee.toLocaleString()} L</span>
                <span className="text-[var(--text-muted)]">max:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{blockStats.maxFee.toLocaleString()} L</span>
              </div>
            </div>
          </div>
        </div>

        {/* COMPUTE UNITS */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 font-semibold">Compute Units</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Total Used</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">
                {formatCU(blockStats.totalCU)} <span className="text-[var(--text-tertiary)]">/ {formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT)}</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Block Utilization</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">{blockStats.blockUtilization.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Non-Vote CU</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">
                {formatCU(blockStats.nonVoteCU)} <span className="text-[var(--text-tertiary)]">({blockStats.nonVoteCUPercent.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-muted)]">Vote CU</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">
                {formatCU(blockStats.voteCU)} <span className="text-[var(--text-tertiary)]">({blockStats.voteCUPercent.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="border-t border-[var(--border-primary)] my-2 pt-2">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">CU/Tx (non-vote)</div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">avg:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{formatNumber(Math.round(blockStats.avgCU))}</span>
                <span className="text-[var(--text-muted)]">p50:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{formatNumber(blockStats.p50CU)}</span>
                <span className="text-[var(--text-muted)]">p99:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{formatNumber(blockStats.p99CU)}</span>
                <span className="text-[var(--text-muted)]">max:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{formatNumber(blockStats.maxCUVal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section breakdown */}
      <div className="card p-6 mb-4">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 font-semibold">Block Position Breakdown</div>
        <div className="relative mb-4">
          <div className="flex h-8 rounded-lg overflow-hidden bg-[var(--bg-tertiary)]">
            {sections.map((section, i) => {
              const opacity = i === 0 ? '1' : i === 1 ? '0.6' : '0.35';
              return (
                <div
                  key={section.name}
                  className="relative flex-1 transition-all hover:opacity-100 flex items-center justify-center"
                  style={{ backgroundColor: `rgba(196, 181, 253, ${opacity})` }}
                >
                  <div className="text-center">
                    <span className="text-xs font-medium text-[var(--bg-primary)]">{section.count}</span>
                  </div>
                  {section.failRate > 0 && (
                    <div
                      className="absolute bottom-0 left-0 h-0.5 bg-[var(--error)]"
                      style={{ width: `${Math.min(100, section.failRate * 2)}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Position labels */}
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-2 px-1">
              <span>Start</span>
              <span className="text-[var(--text-tertiary)]">Beginning ({sections[0]?.count || 0})</span>
              <span className="text-[var(--text-tertiary)]">Middle ({sections[1]?.count || 0})</span>
              <span className="text-[var(--text-tertiary)]">End ({sections[2]?.count || 0})</span>
              <span>Finish</span>
            </div>
          </div>

          {/* Section detail cards */}
          <div className="grid md:grid-cols-3 gap-3">
            {sections.map((section, i) => {
              const opacity = i === 0 ? '1' : i === 1 ? '0.6' : '0.35';
              return (
                <div
                  key={section.name}
                  className="bg-[var(--bg-secondary)] rounded-lg p-3 border-l-2"
                  style={{ borderLeftColor: `rgba(196, 181, 253, ${opacity})` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">{section.name}</span>
                    <span className={`text-xs font-mono ${
                      section.failRate > 5 ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'
                    }`}>
                      {section.failRate > 0 ? `${section.failRate.toFixed(1)}% failed` : 'All passed'}
                    </span>
                  </div>

                  {/* Top categories */}
                  <div className="flex flex-wrap gap-1">
                    {section.categories.slice(0, 4).map(([cat, count]) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                        <span className="text-[var(--text-muted)] capitalize">{cat}</span>
                        <span className="text-[var(--text-tertiary)] font-mono">{count}</span>
                      </span>
                    ))}
                  </div>

                  {/* CU and Fee stats */}
                  <div className="mt-2 pt-2 border-t border-[var(--border-primary)] grid grid-cols-2 gap-2 text-[10px]">
                    <span className="text-[var(--text-muted)]">CU: <span className="font-mono text-[var(--text-tertiary)]">{formatCU(section.totalCU)}</span></span>
                    <span className="text-[var(--text-muted)]">Fees: <span className="font-mono text-[var(--text-tertiary)]">{(section.totalFees / 1e9).toFixed(4)} SOL</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      {/* Transaction Visualization */}
      <div className="card p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Transaction Visualization</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-0.5">Each bar = 1 transaction, height = CU used, color = category</div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowVotes(!showVotes)}
              className="flex items-center gap-2 text-xs cursor-pointer select-none"
            >
              <div className={`w-8 h-4 rounded-full transition-colors ${showVotes ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${showVotes ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-[var(--text-muted)]">Show Votes</span>
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              {txsForChart.length} {showVotes ? 'total' : 'non-vote'} txs
            </span>
          </div>
        </div>

        {/* Chart area */}
        <div className="relative bg-[var(--bg-secondary)] rounded-xl p-4">
          {/* Y-axis */}
          <div className="absolute left-4 top-4 bottom-12 w-12 flex flex-col justify-between text-[10px] font-mono text-[var(--text-muted)]">
            <span>{formatCU(maxCU)}</span>
            <span>{formatCU(maxCU * 0.75)}</span>
            <span>{formatCU(maxCU * 0.5)}</span>
            <span>{formatCU(maxCU * 0.25)}</span>
            <span>0</span>
          </div>

          {/* Grid lines */}
          <div className="absolute left-16 right-4 top-4 bottom-12 pointer-events-none">
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-[var(--border-primary)]"
                style={{ top: `${100 - pct}%` }}
              />
            ))}
          </div>

          {/* Bar chart - full width visualization */}
          <div className="ml-16 mr-4 h-64 relative overflow-hidden">
            {/* Section dividers - subtle */}
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-[var(--border-secondary)] z-10" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-[var(--border-secondary)] z-10" />

            {/* Bars container - using CSS grid for even distribution */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(txsForChart.length, 2000)}, 1fr)`,
                gap: txsForChart.length > 200 ? '0px' : '1px',
                alignItems: 'end',
              }}
            >
              {txsForChart.slice(0, 2000).map((tx, i) => {
                const heightPercent = Math.sqrt(tx.computeUnits / maxCU) * 100;
                const color = getTxColor(tx);
                const isHovered = hoveredTx === i;
                const category = getTxCategory(tx.programs);
                // Calculate position for smart tooltip placement
                const totalTxs = Math.min(txsForChart.length, 2000);
                const positionPercent = (i / totalTxs) * 100;
                const isLeftEdge = positionPercent < 20;
                const isRightEdge = positionPercent > 80;

                return (
                  <a
                    key={tx.signature}
                    href={getSolscanUrl('tx', tx.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`relative transition-all duration-100 ${
                      isHovered ? 'z-20' : ''
                    }`}
                    style={{
                      height: `${Math.max(2, heightPercent)}%`,
                      backgroundColor: color,
                      opacity: isHovered ? 1 : 0.85,
                      transform: isHovered ? 'scaleY(1.1) scaleX(1.5)' : 'scaleY(1)',
                      transformOrigin: 'bottom center',
                      borderRadius: txsForChart.length < 100 ? '2px 2px 0 0' : '1px 1px 0 0',
                      minWidth: '1px',
                    }}
                    onMouseEnter={() => setHoveredTx(i)}
                    onMouseLeave={() => setHoveredTx(null)}
                  >
                    {/* Enhanced hover tooltip - detailed like Solana Beach */}
                    {isHovered && (() => {
                      const baseFee = (tx.numSignatures || 1) * 5000;
                      const priorityFee = Math.max(0, tx.fee - baseFee);
                      const cuPrice = tx.computeUnits > 0 ? Math.round((priorityFee / tx.computeUnits) * 1e6) : 0; // microlamports per CU
                      return (
                        <div
                          className={`absolute bottom-full mb-2 z-30 pointer-events-none ${
                            isLeftEdge ? 'left-0' : isRightEdge ? 'right-0' : 'left-1/2 -translate-x-1/2'
                          }`}
                        >
                          <div className="bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-xl px-4 py-3 shadow-2xl min-w-[280px] max-w-[320px]">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border-primary)]">
                              <span className="text-sm font-medium text-[var(--text-primary)]">Transaction</span>
                              <span className="font-mono text-sm text-[var(--text-secondary)]">#{i + 1}</span>
                            </div>

                            {/* Main info grid */}
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">Signature:</span>
                                <span className="font-mono text-[var(--text-secondary)]">{tx.signature.slice(0, 12)}...{tx.signature.slice(-12)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">Fee Payer:</span>
                                <span className="font-mono text-[var(--text-secondary)]">{tx.feePayer ? `${tx.feePayer.slice(0, 8)}...${tx.feePayer.slice(-8)}` : '—'}</span>
                              </div>

                              <div className="border-t border-[var(--border-primary)] my-2 pt-2" />

                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">Total Fee:</span>
                                <span className="font-mono text-[var(--text-primary)]">{tx.fee.toLocaleString()} <span className="text-[var(--text-tertiary)]">L</span></span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">Base Fee:</span>
                                <span className="font-mono text-[var(--text-secondary)]">{baseFee.toLocaleString()} <span className="text-[var(--text-tertiary)]">L</span></span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">Priority Fee:</span>
                                <span className="font-mono text-[var(--accent)]">{priorityFee.toLocaleString()} <span className="text-[var(--text-tertiary)]">L</span></span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">Jito Tip:</span>
                                <span className="font-mono text-[var(--accent-tertiary)]">{tx.jitoTip > 0 ? `${tx.jitoTip.toLocaleString()} L` : '—'}</span>
                              </div>

                              <div className="border-t border-[var(--border-primary)] my-2 pt-2" />

                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">CU Used:</span>
                                <span className="font-mono text-[var(--text-primary)]">{tx.computeUnits.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">CU Price:</span>
                                <span className="font-mono text-[var(--text-secondary)]">{cuPrice.toLocaleString()} <span className="text-[var(--text-tertiary)]">μL</span></span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">SOL Movement:</span>
                                <span className={`font-mono ${tx.solMovement > 0 ? 'text-[var(--success)]' : tx.solMovement < 0 ? 'text-[var(--error)]' : 'text-[var(--text-tertiary)]'}`}>
                                  {tx.solMovement !== 0 ? `${tx.solMovement > 0 ? '+' : ''}${(tx.solMovement / 1e9).toFixed(6)}` : '0'} <span className="text-[var(--text-tertiary)]">SOL</span>
                                </span>
                              </div>

                              <div className="border-t border-[var(--border-primary)] my-2 pt-2" />

                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">Type:</span>
                                <span className="text-[var(--text-secondary)] capitalize">{category}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[var(--text-muted)]">Status:</span>
                                <span className={`font-medium px-2 py-0.5 rounded text-[10px] ${
                                  tx.success ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--error)]/20 text-[var(--error)]'
                                }`}>
                                  {tx.success ? 'SUCCESS' : 'FAILED'}
                                </span>
                              </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-3 pt-2 border-t border-[var(--border-primary)] text-[10px] text-[var(--text-muted)] text-center">
                              Click to view on Solscan
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </a>
                );
              })}
            </div>
          </div>

          {/* X-axis labels - simplified */}
          <div className="ml-16 mr-4 flex justify-between text-[10px] text-[var(--text-muted)] mt-2">
            <span>Start</span>
            <span>1/3</span>
            <span>2/3</span>
            <span>End</span>
          </div>
        </div>

        {/* Legend - Transaction categories */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-[var(--border-primary)]">
          <span className="text-[10px] text-[var(--text-muted)] uppercase mr-2">Categories:</span>
          {Object.entries(CATEGORY_COLORS).slice(0, 7).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1 text-[10px]">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[var(--text-tertiary)] capitalize">{cat}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-sm bg-[var(--error)]" />
            <span className="text-[var(--text-tertiary)]">Failed</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// Leader Schedule Section
function LeaderScheduleSection({ schedule, getValidatorName }: { schedule: ReturnType<typeof useLeaderSchedule>['schedule']; getValidatorName: (pubkey: string) => string | null }) {
  if (!schedule || schedule.upcomingLeaders.length === 0) return null;

  // Group consecutive slots by the same leader
  const groupedLeaders: { leader: string; name: string | null; slots: number[]; startSlot: number; endSlot: number }[] = [];
  let currentGroup: typeof groupedLeaders[0] | null = null;

  for (const entry of schedule.upcomingLeaders) {
    if (currentGroup && currentGroup.leader === entry.leader && entry.slot === currentGroup.endSlot + 1) {
      currentGroup.slots.push(entry.slot);
      currentGroup.endSlot = entry.slot;
    } else {
      if (currentGroup) groupedLeaders.push(currentGroup);
      currentGroup = {
        leader: entry.leader,
        name: getValidatorName(entry.leader),
        slots: [entry.slot],
        startSlot: entry.slot,
        endSlot: entry.slot,
      };
    }
  }
  if (currentGroup) groupedLeaders.push(currentGroup);

  return (
    <section id="leaders" className="mb-10">
      <SectionHeader title="Leader Schedule" subtitle="Upcoming block producers" />
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-left text-xs text-[var(--text-muted)] uppercase">
              <th className="px-4 py-3 font-medium w-20">Position</th>
              <th className="px-4 py-3 font-medium">Validator</th>
              <th className="px-4 py-3 font-medium text-right">Slots</th>
              <th className="px-4 py-3 font-medium text-right">Range</th>
            </tr>
          </thead>
          <tbody>
            {groupedLeaders.slice(0, 10).map((group, i) => {
              const isNext = i === 0;
              const relativeStart = group.startSlot - schedule.currentSlot;
              return (
                <tr
                  key={group.startSlot}
                  className={`border-b border-[var(--border-primary)] last:border-0 ${isNext ? 'bg-[var(--accent-tertiary)]/10' : 'hover:bg-[var(--bg-hover)]'}`}
                >
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${isNext ? 'text-[var(--accent-tertiary)]' : 'text-[var(--text-muted)]'}`}>
                      {isNext ? 'NEXT' : `+${relativeStart}`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col">
                      {group.name ? (
                        <>
                          <a
                            href={getSolscanUrl('account', group.leader)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-sm hover:underline truncate ${isNext ? 'text-[var(--accent-tertiary)] font-medium' : 'text-[var(--text-secondary)]'}`}
                          >
                            {group.name}
                          </a>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            {group.leader.slice(0, 8)}...{group.leader.slice(-4)}
                          </span>
                        </>
                      ) : (
                        <a
                          href={getSolscanUrl('account', group.leader)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-[var(--accent-secondary)] hover:underline truncate"
                        >
                          {group.leader.slice(0, 8)}...{group.leader.slice(-4)}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-sm font-mono ${group.slots.length > 2 ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                      {group.slots.length} {group.slots.length === 1 ? 'slot' : 'slots'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--text-muted)]">
                    {group.slots.length === 1
                      ? group.startSlot.toLocaleString()
                      : `${group.startSlot.toLocaleString()} - ${group.endSlot.toLocaleString()}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Live Transaction Stream
function LiveTransactionStream({ transactions, isConnected }: { transactions: LiveTransaction[]; isConnected: boolean }) {
  // Calculate stats
  const successCount = transactions.filter(tx => !tx.err).length;
  const failCount = transactions.filter(tx => tx.err).length;
  const successRate = transactions.length > 0 ? (successCount / transactions.length * 100).toFixed(1) : '—';

  // Mini activity bars (last 20 transactions)
  const activityBars = transactions.slice(0, 20).map(tx => !tx.err);

  return (
    <section id="live" className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Live Transaction Stream" noMargin />
        <div className="flex items-center gap-4">
          {/* Activity visualization */}
          <div className="hidden sm:flex items-center gap-0.5 h-4">
            {activityBars.map((success, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all ${success ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`}
                style={{
                  height: `${Math.max(30, 100 - i * 4)}%`,
                  opacity: Math.max(0.3, 1 - i * 0.04),
                }}
              />
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3 text-xs px-2 py-1 rounded-lg bg-[var(--bg-secondary)]">
            <span className="text-[var(--success)] font-mono">{successCount}</span>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-[var(--error)] font-mono">{failCount}</span>
            <span className="text-[var(--text-tertiary)]">({successRate}%)</span>
          </div>
          <div className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${
            isConnected ? 'bg-[var(--success)]/10' : 'bg-[var(--error)]/10'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`}>
              {isConnected && <span className="block w-full h-full rounded-full bg-[var(--success)] animate-ping" />}
            </span>
            <span className={isConnected ? 'text-[var(--success)]' : 'text-[var(--error)]'}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {transactions.length > 0 ? (
          <div className="max-h-80 overflow-y-auto scrollbar-hide">
            {transactions.map((tx, i) => (
              <div
                key={tx.signature}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-primary)] transition-all ${
                  i === 0 ? 'bg-gradient-to-r from-[var(--accent)]/10 to-transparent' : 'hover:bg-[var(--bg-hover)]'
                }`}
                style={{
                  animation: i === 0 ? 'slideIn 0.3s ease-out' : undefined,
                }}
              >
                {/* Status indicator */}
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  tx.err ? 'bg-[var(--error)]' : 'bg-[var(--success)]'
                }`} />

                {/* Signature */}
                <a
                  href={getSolscanUrl('tx', tx.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[var(--accent-secondary)] hover:underline truncate flex-1"
                >
                  {tx.signature.slice(0, 16)}...{tx.signature.slice(-6)}
                </a>

                {/* Status tag */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  tx.err
                    ? 'bg-[var(--error)]/15 text-[var(--error)]'
                    : 'bg-[var(--success)]/15 text-[var(--success)]'
                }`}>
                  {tx.err ? 'Failed' : 'Success'}
                </span>

                {/* Time */}
                <span className="text-[var(--text-muted)] font-mono whitespace-nowrap text-[10px]">
                  {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-[var(--text-muted)] py-16 text-sm">
            <div className="flex flex-col items-center gap-3">
              {isConnected ? (
                <>
                  <div className="relative">
                    <span className="w-4 h-4 rounded-full bg-[var(--accent)] block" />
                    <span className="absolute inset-0 w-4 h-4 rounded-full bg-[var(--accent)] animate-ping" />
                  </div>
                  <span>Waiting for transactions...</span>
                </>
              ) : (
                <>
                  <div className="spinner w-5 h-5" />
                  <span>Connecting to WebSocket...</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{transactions.length} transactions</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.dex }} />
              DEX
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.nft }} />
              NFT
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.core }} />
              Core
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// Top Validators Section
function TopValidatorsSection({ validatorInfo, getValidatorName }: { validatorInfo: ReturnType<typeof useTopValidators>['validatorInfo']; getValidatorName: (pubkey: string) => string | null }) {
  if (!validatorInfo) return null;

  const { validators, totalStake, avgCommission } = validatorInfo;

  return (
    <section className="mb-10">
      <SectionHeader title="Top Validators" subtitle={`By stake (${validators.length} shown)`} />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Total Network Stake"
          value={formatNumber(totalStake)}
          subtext="SOL"
          accent
        />
        <StatCard
          label="Top 15 Stake"
          value={formatNumber(validators.reduce((sum, v) => sum + v.activatedStake, 0))}
          subtext={`${((validators.reduce((sum, v) => sum + v.activatedStake, 0) / totalStake) * 100).toFixed(1)}% of total`}
        />
        <StatCard
          label="Avg Commission"
          value={`${avgCommission.toFixed(1)}%`}
          subtext="top validators"
        />
        <StatCard
          label="Delinquent"
          value={validators.filter(v => v.delinquent).length.toString()}
          subtext="in top 15"
          color={validators.some(v => v.delinquent) ? undefined : 'green'}
        />
      </div>

      {/* Validators Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-left text-xs text-[var(--text-muted)] uppercase">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Validator</th>
              <th className="px-4 py-3 font-medium text-right">Stake (SOL)</th>
              <th className="px-4 py-3 font-medium text-right">Share</th>
              <th className="px-4 py-3 font-medium text-right">Commission</th>
              <th className="px-4 py-3 font-medium text-right">Last Vote</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {validators.map((v, i) => {
              const stakePercent = (v.activatedStake / totalStake) * 100;
              const name = getValidatorName(v.votePubkey) || getValidatorName(v.nodePubkey);
              return (
                <tr
                  key={v.votePubkey}
                  className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-4 py-2.5 text-sm text-[var(--text-muted)]">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col">
                      {name ? (
                        <>
                          <a
                            href={getSolscanUrl('account', v.votePubkey)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] hover:underline truncate max-w-[200px]"
                          >
                            {name}
                          </a>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            {v.votePubkey.slice(0, 8)}...{v.votePubkey.slice(-4)}
                          </span>
                        </>
                      ) : (
                        <a
                          href={getSolscanUrl('account', v.votePubkey)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm text-[var(--accent-secondary)] hover:underline"
                        >
                          {v.votePubkey.slice(0, 8)}...{v.votePubkey.slice(-4)}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-secondary)]">
                    {formatNumber(v.activatedStake)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${Math.min(100, stakePercent * 10)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-[var(--text-muted)] w-12 text-right">
                        {stakePercent.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm">
                    <span className={v.commission > 10 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}>
                      {v.commission}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--text-muted)]">
                    {v.lastVote.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      v.delinquent
                        ? 'bg-[var(--error)]/20 text-[var(--error)]'
                        : 'bg-[var(--success)]/20 text-[var(--success)]'
                    }`}>
                      {v.delinquent ? 'Delinquent' : 'Active'}
                    </span>
                  </td>
                </tr>
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
