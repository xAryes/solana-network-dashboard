import { useState } from 'react';
import {
  useNetworkStats,
  useRecentBlocks,
  useSupplyInfo,
  useValidatorInfo,
  useRecentTransactions,
  useInflationInfo,
  useClusterInfo,
  useBlockProduction,
  formatCU,
  formatNumber,
  getSolscanUrl,
  truncateSig,
  SOLANA_LIMITS,
  getProgramInfo,
  getTxCategory,
  CATEGORY_COLORS,
} from './hooks/useSolanaData';
import type { SlotData } from './hooks/useSolanaData';

function App() {
  const { stats, isLoading } = useNetworkStats();
  const { blocks } = useRecentBlocks(8);
  const { supply } = useSupplyInfo();
  const { validators } = useValidatorInfo();
  const { transactions } = useRecentTransactions(blocks);
  const { inflation } = useInflationInfo();
  const { cluster } = useClusterInfo();
  const { production } = useBlockProduction();

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Connecting to Solana mainnet...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)] px-6 py-4 sticky top-0 bg-[var(--bg-primary)] z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-medium">Solana Network</h1>
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span className="status-dot live" />
              <span>Mainnet</span>
            </div>
            <span className="text-sm text-[var(--text-muted)] font-mono">
              Slot {stats.currentSlot.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--accent-tertiary)] font-mono">{stats.tps.toLocaleString()} TPS</span>
            <a
              href="https://solscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--text-tertiary)] hover:text-[var(--accent-secondary)]"
            >
              Solscan ↗
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Network Overview */}
        <section className="mb-10">
          <SectionHeader title="Network Overview" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
        </section>

        {/* Epoch Progress */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[var(--text-secondary)]">Epoch {stats.epochInfo.epoch} Progress</span>
            <span className="text-sm text-[var(--text-tertiary)] font-mono">
              {stats.epochInfo.slotIndex.toLocaleString()} / {stats.epochInfo.slotsInEpoch.toLocaleString()} slots
            </span>
          </div>
          <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full"
              style={{ width: `${stats.epochInfo.epochProgress}%` }}
            />
          </div>
        </section>

        {/* Validators & Network */}
        <section className="mb-10">
          <SectionHeader title="Validators & Network" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
        <section className="mb-10">
          <SectionHeader title="Supply & Economics" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
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
            <StatCard
              label="Foundation"
              value={inflation ? `${inflation.foundation.toFixed(2)}%` : '—'}
              subtext="allocation"
            />
            <StatCard
              label="Inflation Epoch"
              value={inflation ? inflation.epoch.toLocaleString() : '—'}
              subtext="current"
            />
          </div>
        </section>

        {/* Block Performance */}
        <section className="mb-10">
          <SectionHeader title="Block Performance" subtitle={`Last ${blocks.length} blocks`} />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard label="Avg TX/Block" value={avgTxPerBlock.toLocaleString()} />
            <StatCard label="Avg CU Usage" value={`${avgCuPercent.toFixed(1)}%`} />
            <StatCard label="Avg Success Rate" value={`${avgSuccessRate.toFixed(1)}%`} color="green" />
            <StatCard label="Total Fees" value={formatNumber(totalFees / 1e9)} subtext="SOL" />
            <StatCard label="CU Limit" value={`${SOLANA_LIMITS.BLOCK_CU_LIMIT / 1e6}M`} subtext="per block" />
            <StatCard label="Target Slot" value={`${SOLANA_LIMITS.SLOT_TIME_MS}ms`} />
          </div>
        </section>

        {/* CU Distribution */}
        <CUDistribution transactions={transactions} />

        {/* Block Visualizer */}
        <BlockVisualizer blocks={blocks} />

        {/* Two Column Layout: Blocks & Transactions */}
        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          {/* Recent Blocks */}
          <section>
            <SectionHeader title="Recent Blocks" />
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] text-left text-xs text-[var(--text-muted)] uppercase">
                    <th className="px-4 py-3 font-medium">Slot</th>
                    <th className="px-4 py-3 font-medium text-right">TXs</th>
                    <th className="px-4 py-3 font-medium text-right">CU %</th>
                    <th className="px-4 py-3 font-medium text-right">Success</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block) => {
                    const cuPercent = block.totalCU ? (block.totalCU / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100 : 0;
                    const isHighCU = cuPercent > 70;
                    return (
                      <tr key={block.slot} className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-2.5">
                          <a
                            href={getSolscanUrl('block', block.slot)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sm text-[var(--accent-secondary)] hover:underline"
                          >
                            {block.slot.toLocaleString()}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-secondary)]">
                          {block.txCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, cuPercent)}%`,
                                  backgroundColor: isHighCU ? 'var(--warning)' : 'var(--text-tertiary)'
                                }}
                              />
                            </div>
                            <span className={`font-mono text-xs w-8 text-right ${isHighCU ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>
                              {cuPercent.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm">
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
          </section>

          {/* Recent Transactions */}
          <section>
            <SectionHeader title="Recent Transactions" />
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] text-left text-xs text-[var(--text-muted)] uppercase">
                    <th className="px-4 py-3 font-medium">Signature</th>
                    <th className="px-4 py-3 font-medium text-right">CU</th>
                    <th className="px-4 py-3 font-medium text-right">Fee</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length > 0 ? transactions.slice(0, 8).map((tx) => (
                    <tr key={tx.signature} className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-hover)]">
                      <td className="px-4 py-2.5">
                        <a
                          href={getSolscanUrl('tx', tx.signature)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm text-[var(--accent-secondary)] hover:underline"
                        >
                          {truncateSig(tx.signature)}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-secondary)]">
                        {formatCU(tx.computeUnits)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-secondary)]">
                        {(tx.fee / 1e9).toFixed(6)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs font-medium ${tx.success ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                          {tx.success ? '✓' : '✗'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                        Loading transactions...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Priority Fees (Placeholder) */}
        <section className="mb-10">
          <SectionHeader title="Priority Fees" subtitle="Fee market analysis" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard label="Min Fee" value="—" subtext="lamports/CU" />
            <StatCard label="Median Fee" value="—" subtext="lamports/CU" />
            <StatCard label="75th Percentile" value="—" subtext="lamports/CU" />
            <StatCard label="90th Percentile" value="—" subtext="lamports/CU" />
            <StatCard label="Max Fee" value="—" subtext="lamports/CU" />
            <StatCard label="Recommended" value="—" subtext="for fast inclusion" accent />
          </div>
        </section>

        {/* Program Activity (Placeholder) */}
        <section className="mb-10">
          <SectionHeader title="Top Programs" subtitle="By transaction count" />
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-left text-xs text-[var(--text-muted)] uppercase">
                  <th className="px-4 py-3 font-medium">Program</th>
                  <th className="px-4 py-3 font-medium text-right">Transactions</th>
                  <th className="px-4 py-3 font-medium text-right">CU Used</th>
                  <th className="px-4 py-3 font-medium text-right">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {['Jupiter Aggregator', 'Raydium AMM', 'Orca Whirlpool', 'Marinade Finance', 'Tensor'].map((program) => (
                  <tr key={program} className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2.5 font-mono text-sm text-[var(--accent-secondary)]">{program}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-muted)]">—</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-muted)]">—</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-[var(--text-muted)]">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Account Contention (Placeholder) */}
        <section className="mb-10">
          <SectionHeader title="Hot Accounts" subtitle="High contention accounts" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {['SOL/USDC Pool', 'JUP Staking', 'Marinade State', 'Orca Pool'].map((account) => (
              <div key={account} className="card p-4">
                <div className="text-xs text-[var(--text-muted)] mb-1">{account}</div>
                <div className="text-lg font-mono text-[var(--text-muted)]">—</div>
                <div className="text-xs text-[var(--text-tertiary)] mt-1">write locks/slot</div>
              </div>
            ))}
          </div>
        </section>

        {/* Network Limits Reference */}
        <section className="pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader title="Network Limits" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
            <LimitCard label="Block CU Limit" value={`${SOLANA_LIMITS.BLOCK_CU_LIMIT / 1e6}M`} />
            <LimitCard label="TX Default CU" value={`${SOLANA_LIMITS.TX_DEFAULT_CU / 1e3}k`} />
            <LimitCard label="TX Max CU" value={`${SOLANA_LIMITS.TX_MAX_CU / 1e6}M`} />
            <LimitCard label="Target Slot Time" value={`${SOLANA_LIMITS.SLOT_TIME_MS}ms`} />
            <LimitCard label="Slots per Epoch" value="432,000" />
            <LimitCard label="Epoch Duration" value="~2-3 days" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-primary)] px-6 py-6 mt-8">
        <div className="max-w-7xl mx-auto">
          {/* Category Legend */}
          <div className="mb-4 pb-4 border-b border-[var(--border-primary)]">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Transaction Categories</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.dex }} />
                <span className="text-[var(--text-tertiary)]">DEX</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.perps }} />
                <span className="text-[var(--text-tertiary)]">Perps</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.lending }} />
                <span className="text-[var(--text-tertiary)]">Lending</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.staking }} />
                <span className="text-[var(--text-tertiary)]">Staking</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.oracle }} />
                <span className="text-[var(--text-tertiary)]">Oracle</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.nft }} />
                <span className="text-[var(--text-tertiary)]">NFT</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.core }} />
                <span className="text-[var(--text-tertiary)]">Core</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.vote }} />
                <span className="text-[var(--text-tertiary)]">Vote</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--error)]" />
                <span className="text-[var(--text-tertiary)]">Failed</span>
              </span>
            </div>
          </div>

          {/* Dashboard Legend + Credits */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <span>Real-time Solana mainnet data via Helius RPC</span>
              <span className="text-[var(--text-tertiary)]">•</span>
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
            <div className="flex items-center gap-4">
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

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <h2 className="text-sm text-[var(--text-secondary)] uppercase tracking-wider font-medium">{title}</h2>
      {subtitle && <span className="text-xs text-[var(--text-muted)]">{subtitle}</span>}
    </div>
  );
}

function StatCard({ label, value, subtext, accent, color }: { label: string; value: string; subtext?: string; accent?: boolean; color?: 'purple' | 'green' | 'blue' }) {
  const colorClass = color === 'green' ? 'text-[var(--accent-tertiary)]'
    : color === 'blue' ? 'text-[var(--accent-secondary)]'
    : accent ? 'text-[var(--accent)]'
    : 'text-[var(--text-primary)]';

  return (
    <div className="card p-4">
      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-mono ${colorClass}`}>{value}</div>
      {subtext && <div className="text-xs text-[var(--text-tertiary)] mt-1">{subtext}</div>}
    </div>
  );
}

function LimitCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-[var(--bg-secondary)] rounded">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-mono text-[var(--text-secondary)]">{value}</span>
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
    <section className="mb-10">
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

// Block Visualizer - Shows the internal structure of blocks
function BlockVisualizer({ blocks }: { blocks: SlotData[] }) {
  const [selectedBlock, setSelectedBlock] = useState<number>(0);

  if (blocks.length === 0) return null;

  const block = blocks[selectedBlock];
  const txs = block?.transactions || [];

  // Aggregate program stats
  const programStats = new Map<string, { count: number; cu: number; fees: number; success: number }>();
  const categoryStats = new Map<string, { count: number; cu: number }>();

  for (const tx of txs) {
    const category = getTxCategory(tx.programs);

    // Update category stats
    const catStat = categoryStats.get(category) || { count: 0, cu: 0 };
    catStat.count++;
    catStat.cu += tx.computeUnits;
    categoryStats.set(category, catStat);

    // Update program stats
    for (const prog of tx.programs) {
      const info = getProgramInfo(prog);
      // Skip compute budget and system for cleaner stats
      if (info.category === 'core' && (info.name === 'Compute Budget' || info.name === 'System' || info.name === 'ATA')) continue;

      const stat = programStats.get(prog) || { count: 0, cu: 0, fees: 0, success: 0 };
      stat.count++;
      stat.cu += tx.computeUnits;
      stat.fees += tx.fee;
      if (tx.success) stat.success++;
      programStats.set(prog, stat);
    }
  }

  // Sort programs by count
  const topPrograms = Array.from(programStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  // Sort categories by count
  const sortedCategories = Array.from(categoryStats.entries())
    .sort((a, b) => b[1].count - a[1].count);

  const totalTx = txs.length;
  const blockCuUsed = block?.totalCU || 0;
  const blockCuPercent = (blockCuUsed / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100;

  return (
    <section className="mb-10">
      <SectionHeader title="Block Visualizer" subtitle="Transaction composition analysis" />

      {/* Block Selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {blocks.map((b, i) => (
          <button
            key={b.slot}
            onClick={() => setSelectedBlock(i)}
            className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap transition-colors ${
              i === selectedBlock
                ? 'bg-[var(--accent)] text-[var(--bg-primary)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            {b.slot.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Block Composition Visual */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Block Composition ({totalTx} TXs sampled)
          </div>

          {/* Visual bar showing transaction types */}
          <div className="h-8 rounded-lg overflow-hidden flex mb-4">
            {sortedCategories.map(([cat, stat]) => {
              const percent = (stat.count / totalTx) * 100;
              if (percent < 1) return null;
              return (
                <div
                  key={cat}
                  className="h-full relative group cursor-pointer"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS.unknown,
                  }}
                  title={`${cat}: ${stat.count} txs (${percent.toFixed(1)}%)`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/10 transition-opacity" />
                </div>
              );
            })}
          </div>

          {/* Category Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            {sortedCategories.map(([cat, stat]) => {
              const percent = (stat.count / totalTx) * 100;
              if (percent < 1) return null;
              return (
                <div key={cat} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS.unknown }}
                  />
                  <span className="text-[var(--text-secondary)] capitalize">{cat}</span>
                  <span className="text-[var(--text-muted)] font-mono">{stat.count}</span>
                </div>
              );
            })}
          </div>

          {/* CU Usage Bar */}
          <div className="mt-6 pt-4 border-t border-[var(--border-primary)]">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[var(--text-muted)]">Block CU Usage</span>
              <span className="font-mono text-[var(--text-secondary)]">
                {formatCU(blockCuUsed)} / {formatCU(SOLANA_LIMITS.BLOCK_CU_LIMIT)} ({blockCuPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, blockCuPercent)}%`,
                  backgroundColor: blockCuPercent > 80 ? 'var(--warning)' : blockCuPercent > 50 ? 'var(--accent)' : 'var(--accent-tertiary)',
                }}
              />
            </div>
          </div>

          {/* Block Stats */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-[var(--bg-secondary)] rounded p-2">
              <div className="text-xs text-[var(--text-muted)]">Success Rate</div>
              <div className="font-mono text-sm text-[var(--accent-tertiary)]">{(block?.successRate || 100).toFixed(1)}%</div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded p-2">
              <div className="text-xs text-[var(--text-muted)]">Total Fees</div>
              <div className="font-mono text-sm">{((block?.totalFees || 0) / 1e9).toFixed(4)} SOL</div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded p-2">
              <div className="text-xs text-[var(--text-muted)]">Avg CU/TX</div>
              <div className="font-mono text-sm">{totalTx > 0 ? formatCU(blockCuUsed / block.txCount) : '—'}</div>
            </div>
          </div>
        </div>

        {/* Top Programs in Block */}
        <div className="card p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Programs in Block
          </div>

          {topPrograms.length > 0 ? (
            <div className="space-y-2">
              {topPrograms.map(([prog, stat]) => {
                const info = getProgramInfo(prog);
                const percent = (stat.count / totalTx) * 100;
                const successRate = stat.count > 0 ? (stat.success / stat.count) * 100 : 100;

                return (
                  <div key={prog} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: info.color }}
                        />
                        <a
                          href={getSolscanUrl('account', prog)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-secondary)]"
                        >
                          {info.name}
                        </a>
                        <span className="text-xs text-[var(--text-muted)] capitalize">({info.category})</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-[var(--text-tertiary)]">{stat.count} txs</span>
                        <span className={successRate < 95 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}>
                          {successRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: info.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-[var(--text-muted)] py-8 text-sm">
              No program data available
            </div>
          )}

          {/* Category Summary */}
          <div className="mt-6 pt-4 border-t border-[var(--border-primary)]">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Transaction Types
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {sortedCategories.slice(0, 6).map(([cat, stat]) => (
                <div key={cat} className="flex justify-between items-center py-1.5 px-2 bg-[var(--bg-secondary)] rounded">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    <span className="text-[var(--text-secondary)] capitalize">{cat}</span>
                  </div>
                  <div className="font-mono text-[var(--text-muted)]">
                    {formatCU(stat.cu)} CU
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Stream Preview */}
      <div className="card mt-4 p-4">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Transaction Stream (First 20)
        </div>
        <div className="flex flex-wrap gap-1">
          {txs.slice(0, 40).map((tx, i) => {
            const category = getTxCategory(tx.programs);
            return (
              <a
                key={tx.signature}
                href={getSolscanUrl('tx', tx.signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-mono hover:scale-110 transition-transform"
                style={{
                  backgroundColor: tx.success
                    ? CATEGORY_COLORS[category] || CATEGORY_COLORS.unknown
                    : 'var(--error)',
                  opacity: tx.success ? 1 : 0.7,
                }}
                title={`${tx.signature.slice(0, 8)}... | ${formatCU(tx.computeUnits)} CU | ${tx.success ? 'Success' : 'Failed'}`}
              >
                {i + 1}
              </a>
            );
          })}
          {txs.length > 40 && (
            <div className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-mono bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              +{txs.length - 40}
            </div>
          )}
        </div>
        <div className="mt-3 text-xs text-[var(--text-muted)]">
          Click any transaction to view on Solscan. Colors indicate transaction type. Red = failed.
        </div>
      </div>
    </section>
  );
}

export default App;
