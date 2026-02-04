import { useState, useMemo, useCallback } from 'react';
import {
  useNetworkStats,
  useRecentBlocks,
  useSupplyInfo,
  useValidatorInfo,
  useRecentTransactions,
  useInflationInfo,
  useClusterInfo,
  useBlockProduction,
  usePriorityFees,
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
  const { blocks } = useRecentBlocks(4);
  const { supply } = useSupplyInfo();
  const { validators } = useValidatorInfo();
  const { transactions } = useRecentTransactions(blocks);
  const { inflation } = useInflationInfo();
  const { cluster } = useClusterInfo();
  const { production } = useBlockProduction();
  const { fees: priorityFees, isAvailable: priorityFeesAvailable } = usePriorityFees();

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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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

        {/* Priority Fees */}
        <section className="mb-10">
          <SectionHeader
            title="Priority Fees"
            subtitle={priorityFeesAvailable ? "Real-time fee market" : "Requires Developer+ Helius plan"}
          />
          {priorityFeesAvailable && priorityFees ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <StatCard label="Min Fee" value={priorityFees.min.toLocaleString()} subtext="lamports/CU" />
              <StatCard label="Median Fee" value={priorityFees.median.toLocaleString()} subtext="lamports/CU" color="green" />
              <StatCard label="75th Percentile" value={priorityFees.p75.toLocaleString()} subtext="lamports/CU" />
              <StatCard label="90th Percentile" value={priorityFees.p90.toLocaleString()} subtext="lamports/CU" color="blue" />
              <StatCard label="Max Fee" value={priorityFees.max.toLocaleString()} subtext="lamports/CU" />
              <StatCard label="Recommended" value={priorityFees.recommended.toLocaleString()} subtext="for fast inclusion" accent />
            </div>
          ) : (
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[var(--text-secondary)] mb-1">Priority Fee Data Unavailable</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    This feature requires a Helius Developer plan or higher to access <code className="bg-[var(--bg-tertiary)] px-1 rounded">getRecentPrioritizationFees()</code>
                  </div>
                </div>
                <a
                  href="https://helius.dev/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--accent-secondary)] hover:underline whitespace-nowrap ml-4"
                >
                  Upgrade Plan →
                </a>
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                <div className="text-xs text-[var(--text-muted)] mb-2">With Developer+ plan you'll see:</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                    <div className="text-[var(--text-muted)]">Min Fee</div>
                    <div className="font-mono text-[var(--text-tertiary)]">lamports/CU</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                    <div className="text-[var(--text-muted)]">Median</div>
                    <div className="font-mono text-[var(--text-tertiary)]">lamports/CU</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                    <div className="text-[var(--text-muted)]">75th %ile</div>
                    <div className="font-mono text-[var(--text-tertiary)]">lamports/CU</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                    <div className="text-[var(--text-muted)]">90th %ile</div>
                    <div className="font-mono text-[var(--text-tertiary)]">lamports/CU</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                    <div className="text-[var(--text-muted)]">Max Fee</div>
                    <div className="font-mono text-[var(--text-tertiary)]">lamports/CU</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                    <div className="text-[var(--text-muted)]">Recommended</div>
                    <div className="font-mono text-[var(--text-tertiary)]">lamports/CU</div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
        <NetworkLimitsSection />
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

function SectionHeader({ title, subtitle, noMargin }: { title: string; subtitle?: string; noMargin?: boolean }) {
  return (
    <div className={`flex items-baseline gap-3 ${noMargin ? '' : 'mb-4'}`}>
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
  // Track selected block by slot number, not index (prevents jumping when data refreshes)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // Find the block that matches our selected slot, or default to first block
  const selectedIndex = useMemo(() => {
    if (blocks.length === 0) return 0;
    if (selectedSlot === null) return 0;
    const idx = blocks.findIndex(b => b.slot === selectedSlot);
    return idx >= 0 ? idx : 0;
  }, [blocks, selectedSlot]);

  const block = blocks[selectedIndex];

  // Handle block selection
  const handleSelectBlock = useCallback((slot: number) => {
    setSelectedSlot(slot);
  }, []);

  // Memoize the expensive computations
  const { topPrograms, sortedCategories, totalTx, blockCuUsed, blockCuPercent } = useMemo(() => {
    if (!block) {
      return { topPrograms: [], sortedCategories: [], totalTx: 0, blockCuUsed: 0, blockCuPercent: 0 };
    }

    const txs = block.transactions || [];
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
    const topProgs = Array.from(programStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);

    // Sort categories by count
    const sortedCats = Array.from(categoryStats.entries())
      .sort((a, b) => b[1].count - a[1].count);

    const total = txs.length;
    const cuUsed = block.totalCU || 0;
    const cuPercent = (cuUsed / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100;

    return {
      topPrograms: topProgs,
      sortedCategories: sortedCats,
      totalTx: total,
      blockCuUsed: cuUsed,
      blockCuPercent: cuPercent,
    };
  }, [block]);

  if (blocks.length === 0) return null;

  return (
    <section className="mb-10">
      <SectionHeader title="Block Visualizer" />

      {/* Selected Block Banner - Prominent indicator */}
      <div className="card mb-4 p-4 border-l-4 border-l-[var(--accent)] bg-gradient-to-r from-[var(--accent)]/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Currently Analyzing</div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono text-[var(--accent)] font-semibold">
                  {block?.slot.toLocaleString() || '—'}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {block?.txCount.toLocaleString()} transactions
                </span>
              </div>
            </div>
          </div>
          <a
            href={block ? getSolscanUrl('block', block.slot) : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--accent-secondary)] hover:underline font-mono flex items-center gap-1"
          >
            View on Solscan ↗
          </a>
        </div>
      </div>

      {/* Block Selector */}
      <div className="mb-4">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Select Block to Analyze</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {blocks.map((b) => {
            const isSelected = b.slot === block?.slot;
            return (
              <button
                key={b.slot}
                onClick={() => handleSelectBlock(b.slot)}
                className={`px-4 py-2 rounded-lg text-xs font-mono whitespace-nowrap transition-colors duration-100 flex flex-col items-center gap-1 min-w-[100px] ${
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--bg-primary)] border-2 border-[var(--accent)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-primary)]'
                }`}
              >
                <span className="text-[11px] opacity-70">{isSelected ? '● Selected' : 'Slot'}</span>
                <span className="font-semibold">{b.slot.toLocaleString()}</span>
                <span className="text-[10px] opacity-60">{b.txCount} txs</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Block Composition Visual */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              Block Composition
            </div>
            <div className="text-xs font-mono text-[var(--text-tertiary)]">
              {totalTx} TXs sampled
            </div>
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
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              Programs in Block
            </div>
            <div className="text-xs font-mono text-[var(--accent)]">
              Slot {block?.slot.toLocaleString()}
            </div>
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
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
            Transaction Stream
          </div>
          <div className="text-xs font-mono text-[var(--accent)]">
            Slot {block?.slot.toLocaleString()}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {(block?.transactions || []).slice(0, 40).map((tx, i) => {
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
          {(block?.transactions?.length || 0) > 40 && (
            <div className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-mono bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              +{(block?.transactions?.length || 0) - 40}
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

// Network Limits Section - Comprehensive CU reference post-SIMD upgrades
function NetworkLimitsSection() {
  return (
    <section className="pt-6 border-t border-[var(--border-primary)]">
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
