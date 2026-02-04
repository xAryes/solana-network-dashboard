import {
  useNetworkStats,
  useRecentBlocks,
  useSupplyInfo,
  useValidatorInfo,
  useRecentTransactions,
  formatCU,
  formatNumber,
  getSolscanUrl,
  truncateSig,
  SOLANA_LIMITS
} from './hooks/useSolanaData';

function App() {
  const { stats, isLoading } = useNetworkStats();
  const { blocks } = useRecentBlocks(8);
  const { supply } = useSupplyInfo();
  const { validators } = useValidatorInfo();
  const { transactions } = useRecentTransactions(blocks);

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

        {/* Validators & Stake */}
        <section className="mb-10">
          <SectionHeader title="Validators & Stake" />
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
            <StatCard label="Stake Participation" value="—" subtext="Coming soon" />
            <StatCard label="Skip Rate" value="—" subtext="Coming soon" />
            <StatCard label="Vote Latency" value="—" subtext="Coming soon" />
          </div>
        </section>

        {/* Supply */}
        <section className="mb-10">
          <SectionHeader title="Supply" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Supply" value={supply ? formatNumber(supply.total) : '—'} subtext="SOL" accent />
            <StatCard label="Circulating" value={supply ? formatNumber(supply.circulating) : '—'} subtext="SOL" />
            <StatCard label="Non-Circulating" value={supply ? formatNumber(supply.nonCirculating) : '—'} subtext="SOL" />
            <StatCard
              label="Circulating %"
              value={supply ? `${((supply.circulating / supply.total) * 100).toFixed(1)}%` : '—'}
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
      <footer className="border-t border-[var(--border-primary)] px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Real-time Solana mainnet data via Helius RPC</span>
          <div className="flex items-center gap-6">
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

export default App;
