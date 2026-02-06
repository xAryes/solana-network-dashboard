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

  useTopValidators,
  useValidatorNames,
  useNetworkHistory,
  useTokenMetadata,
  formatCU,
  formatNumber,
  formatTokenAmount,
  getSolscanUrl,
  truncateSig,
  SOLANA_LIMITS,
  getProgramInfo,
  getTxCategory,
  CATEGORY_COLORS,
} from './hooks/useSolanaData';
import type { SlotData, LeaderScheduleInfo, ValidatorMetadata, EpochNetworkStats, EnhancedTransaction } from './hooks/useSolanaData';
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

// Section definitions for navigation - streamlined for better UX
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: '◉' },
  { id: 'health', label: 'Health', icon: '♥' },
  { id: 'validators', label: 'Validators', icon: '⬡' },
  { id: 'globe', label: 'Leaders', icon: '◎' },
  { id: 'analytics', label: 'Real-time', icon: '◈' },
  { id: 'epoch', label: 'Epochs', icon: '◐' },
  { id: 'failures', label: 'Failures', icon: '✕' },
  { id: 'deepdive', label: 'Explorer', icon: '⊞' },
  { id: 'limits', label: 'Limits', icon: '◇' },
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

  const { validatorInfo: topValidators } = useTopValidators(0);
  const { getName: getValidatorName, getMetadata: getValidatorMetadata } = useValidatorNames();
  const networkHistory = useNetworkHistory(5);

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
          {/* Total transactions row */}
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

        {/* Network Health */}
        <NetworkHealthSection
          tps={stats.tps}
          avgSlotTime={stats.avgSlotTime}
          skipRate={production?.skipRate || 0}
          blocks={blocks}
        />

        {/* Validators & Network */}
        <section id="validators" className="mb-8 sm:mb-10">
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

        {/* Real-Time Analytics (compact) */}
        <AnalyticsSection blocks={blocks} transactions={transactions} />

        {/* Enhanced Epoch Analytics - Historical data from Solana Compass */}
        <EnhancedEpochAnalytics data={networkHistory} />

        {/* Failed Transactions Analysis */}
        <FailedTransactionsAnalysis blocks={blocks} />

        {/* Block Deep Dive */}
        <BlockDeepDive blocks={blocks} />

        {/* Top Validators */}
        <TopValidatorsSection validatorInfo={topValidators} getValidatorName={getValidatorName} getValidatorMetadata={getValidatorMetadata} />

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
              <span className="hidden sm:inline">Real-time Solana mainnet data via Helius Premium RPC + Enhanced APIs</span>
              <span className="sm:hidden">Powered by Helius</span>
              <span className="hidden sm:inline text-[var(--text-tertiary)]">•</span>
              <span className="flex items-center gap-1">
                Made with <span className="text-[var(--error)]">♥</span> by
                <a
                  href="https://github.com/xAryes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-secondary)] hover:underline"
                >
                  xAryes
                </a>
              </span>
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

// Enhanced Epoch Analytics - The star section with rich historical data
function EnhancedEpochAnalytics({ data }: { data: { currentEpoch: EpochNetworkStats | null; previousEpochs: EpochNetworkStats[]; isLoading: boolean; error: string | null } }) {
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
  const reversed = allEpochs.slice().reverse(); // oldest first for charts

  const formatSOL = (lamports: number) => {
    const sol = lamports / 1e9;
    if (sol >= 1000) return `${(sol / 1000).toFixed(1)}k`;
    if (sol >= 1) return sol.toFixed(1);
    return sol.toFixed(2);
  };

  const formatCompact = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}k`;
    return num.toLocaleString();
  };

  // Trend helpers
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
        <div className="card p-4">
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
          <div className="flex gap-1">
            {reversed.map((e, i) => (
              <div key={e.epoch} className="flex-1 rounded-sm group relative cursor-default" style={{ height: '28px', background: 'var(--bg-tertiary)' }}>
                <div className="w-full rounded-sm" style={{ height: `${(e.totalTransactions / maxTx) * 100}%`, marginTop: `${100 - (e.totalTransactions / maxTx) * 100}%`, background: i === reversed.length - 1 ? 'var(--accent)' : 'var(--text-tertiary)', opacity: 0.4 + (i / reversed.length) * 0.6 }} />
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
        <div className="card p-4">
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
          <div className="flex gap-1">
            {reversed.map((e, i) => {
              return (
                <div key={e.epoch} className="flex-1 rounded-sm group relative cursor-default" style={{ height: '28px', background: 'var(--bg-tertiary)' }}>
                  <div className="w-full rounded-sm" style={{ height: `${(e.totalFees / maxFees) * 100}%`, marginTop: `${100 - (e.totalFees / maxFees) * 100}%`, background: i === reversed.length - 1 ? 'var(--accent)' : 'var(--accent-secondary)', opacity: 0.4 + (i / reversed.length) * 0.6 }} />
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
        <div className="card p-4">
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
          <div className="flex gap-1">
            {reversed.map((e, i) => (
              <div key={e.epoch} className="flex-1 rounded-sm group relative cursor-default" style={{ height: '28px', background: 'var(--bg-tertiary)' }}>
                <div className="w-full rounded-sm" style={{ height: `${maxJito > 0 ? (e.jitoTips / maxJito) * 100 : 0}%`, marginTop: `${maxJito > 0 ? 100 - (e.jitoTips / maxJito) * 100 : 100}%`, background: 'var(--accent-tertiary)', opacity: 0.4 + (i / reversed.length) * 0.6 }} />
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

        {/* Performance */}
        <div className="card p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Network Performance <span className="normal-case text-[var(--text-tertiary)]">(epoch avg)</span></div>
              <div className="text-xl font-mono font-bold text-[var(--success)]">{current.successRate.toFixed(1)}% <span className="text-xs font-normal text-[var(--text-muted)]">success</span></div>
            </div>
            <TrendBadge values={reversed.map(e => e.successRate)} />
          </div>
          <div className="space-y-0.5 text-[10px] mb-2">
            <div className="flex justify-between cursor-default" title={`Average: ${current.avgBlockTime.toFixed(0)}ms, Median: ${current.medianBlockTime.toFixed(0)}ms. Target: 400ms. Higher = congestion`}>
              <span className="text-[var(--text-muted)]">Block Time <span className="text-[var(--text-tertiary)]">(avg/median)</span></span>
              <span className="font-mono text-[var(--text-secondary)]">{current.avgBlockTime.toFixed(0)}ms / {current.medianBlockTime.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between cursor-default" title={`${current.skippedSlots.toLocaleString()} of ${current.totalSlots.toLocaleString()} slots skipped. Causes: offline validators, network delays`}>
              <span className="text-[var(--text-muted)]">Skip Rate <span className="text-[var(--text-tertiary)]">(missed slots)</span></span>
              <span className={`font-mono ${current.skipRate > 5 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>{current.skipRate.toFixed(2)}% <span className="text-[var(--text-muted)]">({current.skippedSlots.toLocaleString()})</span></span>
            </div>
            <div className="flex justify-between cursor-default" title={`Blocks with >80% CU usage. High count = high demand. Avg CU/block: ${formatCompact(current.avgCUPerBlock)}`}>
              <span className="text-[var(--text-muted)]">Packed Blocks <span className="text-[var(--text-tertiary)]">(&gt;80% CU)</span></span>
              <span className="font-mono text-[var(--text-secondary)]">{formatCompact(current.packedSlots)} <span className="text-[var(--text-muted)]">({current.totalSlots > 0 ? ((current.packedSlots / (current.totalSlots - current.skippedSlots)) * 100).toFixed(1) : 0}%)</span></span>
            </div>
            <div className="flex justify-between cursor-default" title={`Average compute units consumed per block out of ${formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT)} limit`}>
              <span className="text-[var(--text-muted)]">Avg CU/Block</span>
              <span className="font-mono text-[var(--text-secondary)]">{formatCompact(current.avgCUPerBlock)} <span className="text-[var(--text-muted)]">({((current.avgCUPerBlock / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100).toFixed(1)}% capacity)</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Fee Deep Dive */}
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

        {/* Breakdown bar with labels */}
        <div className="mb-4">
          <div className="h-8 flex rounded-lg overflow-hidden bg-[var(--bg-tertiary)]">
            {[
              { label: 'Base', value: current.baseFees, color: 'var(--text-tertiary)' },
              { label: 'Priority', value: current.priorityFees, color: 'var(--accent)' },
              { label: 'Jito', value: current.jitoTips, color: 'var(--accent-tertiary)' },
            ].map(item => {
              const pct = totalFeesAndTips > 0 ? (item.value / totalFeesAndTips) * 100 : 0;
              return (
                <div key={item.label} className="h-full flex items-center justify-center text-[9px] font-mono text-white/80 transition-all cursor-default" style={{ width: `${totalFeesAndTips > 0 ? Math.max(8, pct) : 0}%`, background: item.color }} title={`${item.label}: ${formatSOL(item.value)} SOL (${pct.toFixed(1)}%)`}>
                  {pct > 15 ? <span>{item.label} {pct.toFixed(0)}%</span> : pct > 8 ? <span>{pct.toFixed(0)}%</span> : ''}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-[var(--text-muted)]">
            <span>Total: <span className="font-mono text-[var(--text-secondary)]">{formatSOL(current.baseFees + current.priorityFees + current.jitoTips)} SOL</span></span>
            <span>Protocol fees only: <span className="font-mono text-[var(--text-secondary)]">{formatSOL(current.totalFees)} SOL</span> <span className="text-[var(--text-tertiary)]">(excl. Jito)</span></span>
          </div>
        </div>

        {/* 3 fee type cards - enhanced */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Base Fees */}
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

          {/* Priority Fees */}
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

          {/* Jito MEV Tips */}
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
                const basePct = eTotal > 0 ? ((e.baseFees / eTotal) * 100).toFixed(0) : '0';
                const prioPct = eTotal > 0 ? ((e.priorityFees / eTotal) * 100).toFixed(0) : '0';
                const jitoPct = eTotal > 0 ? ((e.jitoTips / eTotal) * 100).toFixed(0) : '0';
                return (
                  <div key={e.epoch} className={`flex items-center gap-3 text-[10px] group cursor-default ${i === 0 ? '' : 'opacity-70 hover:opacity-100'}`} title={`Base: ${basePct}% | Priority: ${prioPct}% | Jito: ${jitoPct}%`}>
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

      {/* Epoch Comparison Table */}
      {allEpochs.length > 1 && (
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase mb-1">Epoch History</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mb-3">Side-by-side comparison of recent epochs. Fees in SOL (lamports / 1B).</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-[10px] text-[var(--text-muted)] uppercase">
                  <th className="text-left py-2 pr-3">Epoch</th>
                  <th className="text-right py-2 px-2">Total TX</th>
                  <th className="text-right py-2 px-2">Non-Vote</th>
                  <th className="text-right py-2 px-2">Failed</th>
                  <th className="text-right py-2 px-2">Fees</th>
                  <th className="text-right py-2 px-2">Priority</th>
                  <th className="text-right py-2 px-2">Jito</th>
                  <th className="text-right py-2 px-2">Success</th>
                  <th className="text-right py-2 px-2">Skip</th>
                  <th className="text-right py-2 pl-2">Block Time</th>
                </tr>
              </thead>
              <tbody>
                {allEpochs.map((epoch, i) => {
                  const prev = allEpochs[i + 1];
                  const delta = (curr: number, prv: number) => {
                    if (!prev || prv === 0) return null;
                    const pct = ((curr - prv) / prv) * 100;
                    if (Math.abs(pct) < 0.5) return null;
                    return pct;
                  };
                  const DeltaSpan = ({ value, invert = false }: { value: number | null; invert?: boolean }) => {
                    if (value === null) return null;
                    const isGood = invert ? value < 0 : value > 0;
                    return <span className={`text-[8px] ml-0.5 ${isGood ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>{value > 0 ? '+' : ''}{value.toFixed(0)}%</span>;
                  };
                  return (
                    <tr key={epoch.epoch} className={`border-b border-[var(--border-primary)] last:border-0 ${i === 0 ? 'bg-[var(--accent)]/5' : ''}`}>
                      <td className="py-2 pr-3">
                        <span className={`font-mono ${i === 0 ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-secondary)]'}`}>{epoch.epoch}</span>
                        {i === 0 && <span className="ml-1 text-[9px] text-[var(--accent)]">current</span>}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-[var(--text-secondary)]">{formatCompact(epoch.totalTransactions)}<DeltaSpan value={delta(epoch.totalTransactions, prev?.totalTransactions ?? 0)} /></td>
                      <td className="text-right py-2 px-2 font-mono text-[var(--text-tertiary)]">{formatCompact(epoch.nonVoteTransactions)}</td>
                      <td className="text-right py-2 px-2 font-mono text-[var(--error)]">{formatCompact(epoch.failedTx)}<DeltaSpan value={delta(epoch.failedTx, prev?.failedTx ?? 0)} invert /></td>
                      <td className="text-right py-2 px-2 font-mono text-[var(--accent)]">{formatSOL(epoch.totalFees)}<DeltaSpan value={delta(epoch.totalFees, prev?.totalFees ?? 0)} /></td>
                      <td className="text-right py-2 px-2 font-mono text-[var(--text-tertiary)]">{formatSOL(epoch.priorityFees)}</td>
                      <td className="text-right py-2 px-2 font-mono text-[var(--accent-tertiary)]">{formatSOL(epoch.jitoTips)}<DeltaSpan value={delta(epoch.jitoTips, prev?.jitoTips ?? 0)} /></td>
                      <td className="text-right py-2 px-2 font-mono text-[var(--success)]">{epoch.successRate.toFixed(1)}%</td>
                      <td className="text-right py-2 px-2 font-mono text-[var(--warning)]">{epoch.skipRate.toFixed(2)}%<DeltaSpan value={delta(epoch.skipRate, prev?.skipRate ?? 0)} invert /></td>
                      <td className="text-right py-2 pl-2 font-mono text-[var(--text-secondary)]">{epoch.avgBlockTime.toFixed(0)}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border-primary)] text-[10px] text-[var(--text-tertiary)] flex justify-between">
            <span>Data: <a href="https://solanacompass.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-secondary)] hover:underline">Solana Compass</a></span>
            <span>{new Date(current.updatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
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
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center" title="The current slot being processed on mainnet">
              <div className="text-xl font-mono font-bold text-[var(--accent)]">{currentSlot.toLocaleString()}</div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Current Slot</div>
              <div className="text-[9px] text-[var(--text-tertiary)]">live</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center" title="Total active validators in the current epoch">
              <div className="text-xl font-mono font-bold text-[var(--text-secondary)]">{validatorCount.toLocaleString()}</div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Active Validators</div>
              <div className="text-[9px] text-[var(--text-tertiary)]">this epoch</div>
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
  blocks,
}: {
  tps: number;
  avgSlotTime: number;
  skipRate: number;
  blocks: SlotData[];
}) {
  // Compute success rate and CU usage from blocks
  const successRate = blocks.length > 0
    ? blocks.reduce((sum, b) => sum + (b.successRate || 100), 0) / blocks.length
    : 100;
  const cuPercent = blocks.length > 0
    ? (blocks.reduce((sum, b) => sum + (b.totalCU || 0), 0) / blocks.length / SOLANA_LIMITS.BLOCK_CU_LIMIT * 100)
    : 0;

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
      <SectionHeader title="Network Health" subtitle={`Real-time from last ${blocks.length} blocks • score 0-100`} />
      <div className="card p-4 sm:p-6">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
          {/* Overall Health - Large */}
          <div className="col-span-3 sm:col-span-2 flex items-center gap-3 sm:gap-4 p-3 sm:p-0 rounded-xl sm:rounded-none bg-[var(--bg-secondary)] sm:bg-transparent cursor-default" title="Weighted average of TPS, slot time, skip rate, success rate, and CU usage. 80+ = Healthy, 50-79 = Degraded, <50 = Critical">
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
          <HealthMetric label="TPS" value={tps.toLocaleString()} score={tpsHealth} tooltip="Transactions per second. 5,000+ = full health" />
          <HealthMetric label="Slot Time" value={`${avgSlotTime}ms`} score={slotTimeHealth} tooltip="Target: 400ms. Deviations reduce health score" />
          <HealthMetric label="Skip Rate" value={`${skipRate.toFixed(2)}%`} score={skipRateHealth} tooltip="% of slots missed this epoch. <10% = healthy" />
          <HealthMetric label="TX Success" value={`${successRate.toFixed(1)}%`} score={successHealth} tooltip={`Avg success rate across last ${blocks.length} blocks`} />
        </div>
      </div>
    </section>
  );
}

// Health metric mini-card
function HealthMetric({ label, value, score, tooltip }: { label: string; value: string; score: number; tooltip?: string }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'var(--success)';
    if (s >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className="flex flex-col items-center text-center p-2 sm:p-0 rounded-lg sm:rounded-none bg-[var(--bg-secondary)]/50 sm:bg-transparent cursor-default" title={tooltip}>
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

// Failed Transactions Analysis
function FailedTransactionsAnalysis({ blocks }: { blocks: SlotData[] }) {
  const [enhancedFailedTxs, setEnhancedFailedTxs] = useState<Map<string, EnhancedTransaction>>(new Map());
  const enhancedFetchRef = useRef<string>('');

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
    const failuresByProgram = new Map<string, number>();
    const totalByProgram = new Map<string, number>(); // total calls per program (success + fail)
    const failuresByPayer = new Map<string, number>();
    let totalFailed = 0;
    let totalTxs = 0;
    let wastedCU = 0;
    let wastedFees = 0;
    let totalCU = 0;
    let totalFees = 0;
    const perBlockFailures: Array<{ slot: number; failed: number; total: number; wastedCU: number }> = [];

    for (const block of blocks) {
      if (!block.transactions) continue;

      let blockFailed = 0;
      let blockTotal = 0;
      let blockWastedCU = 0;

      for (const tx of block.transactions) {
        totalTxs++;
        blockTotal++;
        totalCU += tx.computeUnits;
        totalFees += tx.fee;

        // Track total calls per program (for failure rate calculation)
        for (const prog of tx.programs) {
          const info = getProgramInfo(prog);
          if (info.category !== 'core') {
            totalByProgram.set(prog, (totalByProgram.get(prog) || 0) + 1);
          }
        }

        if (!tx.success) {
          totalFailed++;
          blockFailed++;
          wastedCU += tx.computeUnits;
          wastedFees += tx.fee;
          blockWastedCU += tx.computeUnits;
          const category = getTxCategory(tx.programs);
          failuresByCategory.set(category, (failuresByCategory.get(category) || 0) + 1);

          // Track fee payer
          if (tx.feePayer) {
            failuresByPayer.set(tx.feePayer, (failuresByPayer.get(tx.feePayer) || 0) + 1);
          }

          for (const prog of tx.programs) {
            const info = getProgramInfo(prog);
            if (info.category !== 'core') {
              failuresByProgram.set(prog, (failuresByProgram.get(prog) || 0) + 1);
            }
          }

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

      perBlockFailures.push({ slot: block.slot, failed: blockFailed, total: blockTotal, wastedCU: blockWastedCU });
    }

    // ALL programs with failure rates (failures / total calls) - no slice limit
    const programFailureRates = Array.from(failuresByProgram.entries())
      .map(([prog, failCount]) => {
        const total = totalByProgram.get(prog) || failCount;
        return { prog, failCount, total, rate: (failCount / total) * 100 };
      })
      .sort((a, b) => b.failCount - a.failCount);

    const topFailingPayers = Array.from(failuresByPayer.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const categoryBreakdown = Array.from(failuresByCategory.entries())
      .sort((a, b) => b[1] - a[1]);

    return {
      failedTxs,
      totalFailed,
      totalTxs,
      failureRate: totalTxs > 0 ? (totalFailed / totalTxs) * 100 : 0,
      programFailureRates,
      topFailingPayers,
      categoryBreakdown,
      wastedCU,
      wastedFees,
      totalCU,
      totalFees,
      perBlockFailures,
    };
  }, [blocks]);

  // Enrich failed transactions with Helius Enhanced TX API
  useEffect(() => {
    const sigs = analysis.failedTxs.map(tx => tx.signature);
    const key = sigs.join(',');
    if (sigs.length === 0 || key === enhancedFetchRef.current) return;
    enhancedFetchRef.current = key;

    fetchEnhancedTransactions(sigs).then(enhanced => {
      if (enhanced.length > 0) {
        const map = new Map<string, EnhancedTransaction>();
        for (const etx of enhanced) {
          if (etx.signature) map.set(etx.signature, etx);
        }
        setEnhancedFailedTxs(map);
      }
    });
  }, [analysis.failedTxs]);

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

  return (
    <section id="failures" className="mb-10">
      <SectionHeader title="Failed Transactions" subtitle={`Last ${blocks.length} blocks • ${analysis.totalTxs.toLocaleString()} total transactions`} />

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

          {/* Per-block failure rate mini chart */}
          {analysis.perBlockFailures.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Failures per Block <span className="normal-case text-[var(--text-tertiary)]">(newest right)</span></div>
              <div className="flex items-end gap-px h-10">
                {analysis.perBlockFailures.map((b) => {
                  const maxFailed = Math.max(...analysis.perBlockFailures.map(x => x.failed), 1);
                  const height = b.failed > 0 ? Math.max(8, (b.failed / maxFailed) * 100) : 2;
                  return (
                    <div
                      key={b.slot}
                      className="flex-1 rounded-t-sm transition-colors"
                      style={{
                        height: `${height}%`,
                        backgroundColor: b.failed > 0
                          ? `color-mix(in srgb, var(--error) ${Math.min(100, 30 + (b.failed / maxFailed) * 70)}%, transparent)`
                          : 'var(--bg-tertiary)',
                      }}
                      title={`Slot ${b.slot}: ${b.failed}/${b.total} failed (${b.total > 0 ? ((b.failed / b.total) * 100).toFixed(1) : 0}%)`}
                    />
                  );
                })}
              </div>
            </div>
          )}

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

      {/* Row 2: All Failing Programs (full width) */}
      <div className="card p-4 mb-4 animate-section">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--error)] live-dot" />
            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-medium">All Failing Programs</span>
            <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">{analysis.programFailureRates.length}</span>
          </div>
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)] mb-3">
          Every on-chain program that had at least one failed transaction in the last {blocks.length} blocks ({analysis.totalTxs.toLocaleString()} txs).
          Bar length = relative failure count. Count = failed/total calls to that program. Rate = failure percentage.
        </div>

        {/* Column labels */}
        {analysis.programFailureRates.length > 0 && (
          <div className="flex items-center gap-2.5 px-2 mb-1.5 text-[9px] text-[var(--text-muted)] uppercase tracking-wide">
            <span className="w-5 flex-shrink-0 text-right">#</span>
            <span className="w-28 flex-shrink-0">Program</span>
            <span className="flex-1">Failure count <span className="normal-case text-[var(--text-tertiary)]">(relative to #1)</span></span>
            <span className="w-16 text-right flex-shrink-0">Failed/Total</span>
            <span className="w-14 text-center flex-shrink-0">Fail Rate</span>
          </div>
        )}

        {analysis.programFailureRates.length > 0 ? (
          <div className="max-h-[420px] overflow-y-auto pr-1 space-y-px">
            {analysis.programFailureRates.map(({ prog, failCount, total, rate }, idx) => {
              const info = getProgramInfo(prog);
              const maxFails = analysis.programFailureRates[0]?.failCount || 1;
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
        {analysis.programFailureRates.length > 0 && (
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
              Bar colors match each program&apos;s category (green = DEX, orange = perps, teal = lending, pink = NFT, blue = staking). Data from last {blocks.length} blocks via Helius RPC.
            </div>
          </div>
        )}
      </div>

      {/* Row 3: Fee Payers + Recent TXs */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Failing Fee Payers (who's sending bad TXs) */}
        <div className="card p-4 animate-section" style={{ animationDelay: '0.15s' }}>
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            Top Failing Wallets <span className="normal-case text-[var(--text-tertiary)]">(fee payers)</span>
          </div>
          {analysis.topFailingPayers.length > 0 ? (
            <div className="space-y-2">
              {analysis.topFailingPayers.map(([payer, count], idx) => {
                const pct = (count / analysis.totalFailed) * 100;
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
                      <span className="text-xs font-mono text-[var(--error)]">{count} <span className="text-[var(--text-muted)]">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="ml-6 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--accent)]/50" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-[var(--text-muted)] py-4 text-sm">No fee payer data available</div>
          )}
          {analysis.topFailingPayers.length > 0 && (
            <div className="mt-3 pt-2 border-t border-[var(--border-primary)] text-[9px] text-[var(--text-tertiary)]">
              Wallets sending the most failing transactions. Often bots or arbitrage programs retrying aggressively.
            </div>
          )}
        </div>

        {/* Recent Failed TXs - expanded detail */}
        <div className="card p-4 animate-section" style={{ animationDelay: '0.2s' }}>
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]" />
            Recent Failed TXs <span className="normal-case text-[var(--text-tertiary)]">(newest first)</span>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {analysis.failedTxs.map((tx) => {
              const mainProg = tx.programs.find(p => getProgramInfo(p).category !== 'core');
              const info = mainProg ? getProgramInfo(mainProg) : null;
              const enhanced = enhancedFailedTxs.get(tx.signature);
              return (
                <div key={tx.signature} className="py-1.5 border-b border-[var(--border-primary)] last:border-0 animate-row" style={{ animationDelay: '0.05s' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)]" />
                      <a href={getSolscanUrl('tx', tx.signature)} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-[var(--accent-secondary)] hover:underline">
                        {truncateSig(tx.signature)}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {enhanced?.type && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">
                          {enhanced.type.replace(/_/g, ' ')}
                        </span>
                      )}
                      {enhanced?.source && (
                        <span className="text-[9px] text-[var(--text-tertiary)]">
                          {enhanced.source}
                        </span>
                      )}
                      {!enhanced && info && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]" style={{ color: info.color }}>
                          {info.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {enhanced?.description && (
                    <div className="text-[9px] text-[var(--text-tertiary)] ml-4 mt-0.5 truncate max-w-full">
                      {enhanced.description}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-0.5 ml-4 text-[9px] text-[var(--text-muted)]">
                    <span>CU: <span className="font-mono text-[var(--text-tertiary)]">{formatCU(tx.cu)}</span></span>
                    <span>Fee: <span className="font-mono text-[var(--text-tertiary)]">{tx.fee.toLocaleString()} L</span></span>
                    <span>Slot: <span className="font-mono text-[var(--text-tertiary)]">{tx.slot.toLocaleString()}</span></span>
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
  const [enhancedTxMap, setEnhancedTxMap] = useState<Map<string, EnhancedTransaction>>(new Map());
  const enhancedFetchedSlotRef = useRef<number | null>(null);

  // Collect token mints from enhanced tx data for DAS resolution
  const tokenMints = useMemo(() => {
    const mints = new Set<string>();
    for (const etx of enhancedTxMap.values()) {
      for (const tt of (etx.tokenTransfers || [])) {
        if (tt.mint) mints.add(tt.mint);
      }
    }
    return Array.from(mints);
  }, [enhancedTxMap]);

  const { getTokenInfo } = useTokenMetadata(tokenMints);

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

  const { analysis, blockStats, txsForChart, maxCU } = useMemo(() => {
    if (!selectedBlock?.transactions) {
      return { analysis: null, blockStats: null, txsForChart: [], maxCU: 0 };
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
      avgFee: nonVoteTxs.length > 0 ? nonVoteFees.reduce((a, b) => a + b, 0) / nonVoteFees.length : 0,
      p50Fee: getPercentile(nonVoteFees, 50),
      p99Fee: getPercentile(nonVoteFees, 99),
      maxFee: nonVoteFees[nonVoteFees.length - 1] || 0,
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

    return {
      analysis: { total },
      blockStats: stats,
      txsForChart: filteredTxs,
      maxCU: maxComputeUnits,
    };
  }, [selectedBlock, showVotes]);

  if (!selectedBlock || !analysis || !blockStats) {
    return null;
  }

  // Color helper for transactions
  const getTxColor = (tx: { success: boolean; programs: string[]; jitoTip?: number }) => {
    if (!tx.success) return '#ef4444';
    if ((tx.jitoTip || 0) > 0) return '#a78bfa'; // Jito purple
    const cat = getTxCategory(tx.programs);
    if (cat === 'vote') return '#6b7280';
    return CATEGORY_COLORS[cat] || '#22c55e';
  };

  // Compute chart summary stats
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
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">Non-Vote Fee Breakdown <span className="normal-case text-[var(--text-tertiary)]">(user txs only, SOL)</span></div>
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
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">Fee Distribution <span className="normal-case text-[var(--text-tertiary)]">(non-vote, in lamports)</span></div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">avg:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{Math.round(blockStats.avgFee).toLocaleString()}</span>
                <span className="text-[var(--text-muted)]">p50:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{blockStats.p50Fee.toLocaleString()}</span>
                <span className="text-[var(--text-muted)]">p99:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{blockStats.p99Fee.toLocaleString()}</span>
                <span className="text-[var(--text-muted)]">max:</span>
                <span className="font-mono text-[var(--text-tertiary)]">{blockStats.maxFee.toLocaleString()}</span>
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
              <div className="text-[10px] text-[var(--text-muted)] uppercase mb-2">CU per TX <span className="normal-case text-[var(--text-tertiary)]">(non-vote, compute units)</span></div>
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
        <div className="relative bg-[var(--bg-secondary)] rounded-lg p-3 overflow-visible">
          {/* Y-axis */}
          <div className="absolute left-3 top-3 bottom-8 w-10 flex flex-col justify-between text-[9px] font-mono text-[var(--text-muted)]">
            <span>{formatCU(maxCU)}</span>
            <span>{formatCU(maxCU * 0.75)}</span>
            <span>{formatCU(maxCU * 0.5)}</span>
            <span>{formatCU(maxCU * 0.25)}</span>
            <span>0</span>
          </div>

          {/* Grid lines */}
          <div className="absolute left-14 right-3 top-3 bottom-8 pointer-events-none">
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-[var(--border-primary)]"
                style={{ top: `${100 - pct}%` }}
              />
            ))}
          </div>

          {/* Bar chart - full width visualization */}
          <div className="ml-14 mr-3 h-72 relative overflow-visible">
            {/* Section dividers - subtle */}
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-[var(--border-secondary)] z-10" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-[var(--border-secondary)] z-10" />

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
                const heightPercent = Math.sqrt(tx.computeUnits / maxCU) * 100;
                const color = getTxColor(tx);
                const isHovered = hoveredTx === i;
                const category = getTxCategory(tx.programs);
                // Calculate position for smart tooltip placement
                const totalTxs = Math.min(txsForChart.length, 2000);
                const positionPercent = (i / totalTxs) * 100;
                const isLeftEdge = positionPercent < 20;
                const isRightEdge = positionPercent > 80;

                // Alternating group shading for visual separation at high density
                const groupSize = totalTxs > 500 ? 10 : totalTxs > 200 ? 5 : 3;
                const isAlternateGroup = Math.floor(i / groupSize) % 2 === 1;

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
                      opacity: isHovered ? 1 : isAlternateGroup ? 0.7 : 0.9,
                      transform: isHovered ? 'scaleY(1.1) scaleX(1.5)' : 'scaleY(1)',
                      transformOrigin: 'bottom center',
                      borderRadius: txsForChart.length < 100 ? '2px 2px 0 0' : '1px 1px 0 0',
                      minWidth: '1px',
                      borderRight: totalTxs <= 300 ? '0.5px solid var(--bg-secondary)' : 'none',
                    }}
                    onMouseEnter={() => setHoveredTx(i)}
                    onMouseLeave={() => setHoveredTx(null)}
                  >
                    {/* Compact hover tooltip */}
                    {isHovered && (() => {
                      const baseFee = (tx.numSignatures || 1) * 5000;
                      const priorityFee = Math.max(0, tx.fee - baseFee);
                      const enhanced = enhancedTxMap.get(tx.signature);
                      return (
                        <div
                          className={`absolute z-50 pointer-events-none`}
                          style={{
                            bottom: '100%',
                            marginBottom: '4px',
                            left: isLeftEdge ? '0' : undefined,
                            right: isRightEdge ? '0' : undefined,
                            transform: (!isLeftEdge && !isRightEdge) ? 'translateX(-50%)' : undefined,
                            ...((!isLeftEdge && !isRightEdge) ? { left: '50%' } : {}),
                          }}
                        >
                          <div className="bg-[var(--bg-primary)]/95 backdrop-blur border border-[var(--border-secondary)] rounded px-2 py-1.5 shadow-xl text-[9px] whitespace-nowrap">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-[var(--text-primary)]">#{i + 1}</span>
                              <span className={`px-1 rounded text-[8px] ${
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
                            {enhanced?.description && (
                              <div className="text-[8px] text-[var(--text-secondary)] mb-1 max-w-[250px] whitespace-normal leading-tight">
                                {enhanced.description.length > 100 ? enhanced.description.slice(0, 100) + '...' : enhanced.description}
                              </div>
                            )}
                            <div className="space-y-0.5 text-[var(--text-muted)]">
                              <div>Fee <span className="font-mono text-[var(--text-primary)] ml-1">{tx.fee.toLocaleString()}</span> L</div>
                              <div>Priority <span className="font-mono text-[var(--accent)] ml-1">{priorityFee.toLocaleString()}</span> L</div>
                              {tx.jitoTip > 0 && <div>Jito <span className="font-mono text-[var(--accent-tertiary)] ml-1">{tx.jitoTip.toLocaleString()}</span> L</div>}
                              <div>CU <span className="font-mono text-[var(--text-secondary)] ml-1">{formatCU(tx.computeUnits)}</span></div>
                              {/* SOL movement */}
                              {Math.abs(tx.solMovement) > 0 && (
                                <div>SOL <span className="font-mono text-[var(--accent-secondary)] ml-1">{(Math.abs(tx.solMovement) / 1e9).toFixed(4)}</span></div>
                              )}
                            </div>
                            {/* Token transfers from enhanced data */}
                            {enhanced?.tokenTransfers && enhanced.tokenTransfers.length > 0 && (
                              <div className="mt-1 pt-1 border-t border-[var(--border-primary)] space-y-0.5">
                                {enhanced.tokenTransfers.slice(0, 3).map((tt, j) => {
                                  const meta = getTokenInfo(tt.mint);
                                  return (
                                    <div key={j} className="flex items-center gap-1 text-[8px]">
                                      {meta?.image && (
                                        <img src={meta.image} alt="" className="w-3 h-3 rounded-full flex-shrink-0"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                      )}
                                      <span className="font-mono text-[var(--text-primary)]">
                                        {meta ? formatTokenAmount(tt.tokenAmount, meta.decimals) : tt.tokenAmount.toLocaleString()}
                                      </span>
                                      <span className="text-[var(--text-secondary)]">{meta?.symbol || truncateSig(tt.mint)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div className="mt-1 pt-1 border-t border-[var(--border-primary)] text-[8px] text-[var(--text-tertiary)] font-mono">
                              {tx.signature.slice(0, 10)}...
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

          {/* X-axis labels */}
          <div className="ml-14 mr-3 flex justify-between text-[9px] text-[var(--text-muted)] mt-1">
            <span>Start</span>
            <span>1/3</span>
            <span>2/3</span>
            <span>End</span>
          </div>
        </div>

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
      </div>
    </section>
  );
}

// Top Validators Section
const PAGE_SIZE = 15;
function TopValidatorsSection({ validatorInfo, getValidatorName, getValidatorMetadata }: { validatorInfo: ReturnType<typeof useTopValidators>['validatorInfo']; getValidatorName: (pubkey: string) => string | null; getValidatorMetadata: (pubkey: string) => ValidatorMetadata | null }) {
  const [page, setPage] = useState(0);

  if (!validatorInfo) return null;

  const { validators, totalStake, avgCommission } = validatorInfo;
  const totalPages = Math.ceil(validators.length / PAGE_SIZE);
  const pageStart = page * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, validators.length);
  const pageValidators = validators.slice(pageStart, pageEnd);
  const delinquentCount = validators.filter(v => v.delinquent).length;

  return (
    <section className="mb-10">
      <SectionHeader title="Validators" subtitle={`${validators.length} total • ranked by stake`} />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Total Network Stake"
          value={formatNumber(totalStake)}
          subtext="SOL (sum)"
          accent
        />
        <StatCard
          label="Active Validators"
          value={(validators.length - delinquentCount).toLocaleString()}
          subtext={`of ${validators.length} total`}
        />
        <StatCard
          label="Avg Commission"
          value={`${avgCommission.toFixed(1)}%`}
          subtext="across all validators"
        />
        <StatCard
          label="Delinquent"
          value={delinquentCount.toString()}
          subtext={`${((delinquentCount / validators.length) * 100).toFixed(1)}% of validators`}
          color={delinquentCount === 0 ? 'green' : undefined}
        />
      </div>

      {/* Validators Table */}
      <div className="card overflow-hidden">
        {/* Pagination Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/30">
          <span className="text-xs text-[var(--text-muted)]">
            Showing {pageStart + 1}–{pageEnd} of {validators.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-2 py-1 text-xs rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed"
              title="First page"
            >
              ««
            </button>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 text-xs rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              «
            </button>
            {Array.from({ length: totalPages }, (_, i) => {
              // Show pages near current page
              if (totalPages <= 7 || Math.abs(i - page) <= 2 || i === 0 || i === totalPages - 1) {
                return (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`min-w-[28px] px-1.5 py-1 text-xs rounded font-mono ${
                      i === page
                        ? 'bg-[var(--accent)]/20 text-[var(--accent)] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              }
              // Show ellipsis for gaps
              if (i === 1 && page > 3) return <span key={i} className="px-1 text-xs text-[var(--text-muted)]">...</span>;
              if (i === totalPages - 2 && page < totalPages - 4) return <span key={i} className="px-1 text-xs text-[var(--text-muted)]">...</span>;
              return null;
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-2 py-1 text-xs rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              »
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page === totalPages - 1}
              className="px-2 py-1 text-xs rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed"
              title="Last page"
            >
              »»
            </button>
          </div>
        </div>

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
            {pageValidators.map((v, i) => {
              const stakePercent = (v.activatedStake / totalStake) * 100;
              const name = getValidatorName(v.votePubkey) || getValidatorName(v.nodePubkey);
              const metadata = getValidatorMetadata(v.votePubkey) || getValidatorMetadata(v.nodePubkey);
              const rank = pageStart + i + 1;
              return (
                <tr
                  key={v.votePubkey}
                  className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-4 py-2.5 text-sm text-[var(--text-muted)]">{rank}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {metadata?.logo ? (
                        <img
                          src={metadata.logo}
                          alt=""
                          className="w-7 h-7 rounded-full flex-shrink-0 bg-[var(--bg-tertiary)]"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full flex-shrink-0 bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] text-[var(--text-muted)]">
                          {(name || v.votePubkey).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
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
