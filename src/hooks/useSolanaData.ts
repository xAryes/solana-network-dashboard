import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Helius RPC endpoint for real mainnet data
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=43b98341-8ccf-4dfa-a986-c2c45c36be77';

// Solana block limits
export const SOLANA_LIMITS = {
  BLOCK_CU_LIMIT: 60_000_000, // 60M CU per block
  TX_DEFAULT_CU: 200_000,
  TX_MAX_CU: 1_400_000,
  SLOT_TIME_MS: 400,
};

export interface SlotData {
  slot: number;
  blockTime: number | null;
  txCount: number;
  parentSlot: number;
  blockhash: string;
  totalFees?: number;
  successRate?: number;
  totalCU?: number;
  transactions?: TransactionInfo[];
}

export interface TransactionInfo {
  signature: string;
  success: boolean;
  fee: number;
  computeUnits: number;
  slot: number;
  programs: string[]; // Program IDs called in this transaction
}

// Known Solana program IDs for detection
export const KNOWN_PROGRAMS: Record<string, { name: string; category: string; color: string }> = {
  // System & Core
  '11111111111111111111111111111111': { name: 'System', category: 'core', color: '#71717a' },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': { name: 'Token', category: 'core', color: '#71717a' },
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': { name: 'Token-2022', category: 'core', color: '#71717a' },
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': { name: 'ATA', category: 'core', color: '#71717a' },
  'ComputeBudget111111111111111111111111111111': { name: 'Compute Budget', category: 'core', color: '#52525b' },
  'Vote111111111111111111111111111111111111111': { name: 'Vote', category: 'vote', color: '#52525b' },

  // DEX / AMM
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': { name: 'Jupiter v6', category: 'dex', color: '#22c55e' },
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': { name: 'Jupiter v4', category: 'dex', color: '#22c55e' },
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': { name: 'Raydium AMM', category: 'dex', color: '#6366f1' },
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': { name: 'Raydium CLMM', category: 'dex', color: '#6366f1' },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': { name: 'Orca Whirlpool', category: 'dex', color: '#06b6d4' },
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': { name: 'Orca v1', category: 'dex', color: '#06b6d4' },
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': { name: 'Meteora DLMM', category: 'dex', color: '#f59e0b' },
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': { name: 'Meteora Pools', category: 'dex', color: '#f59e0b' },
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX': { name: 'Openbook', category: 'dex', color: '#ec4899' },
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY': { name: 'Phoenix', category: 'dex', color: '#f97316' },

  // Oracles
  'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH': { name: 'Pyth', category: 'oracle', color: '#a855f7' },
  'pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT': { name: 'Pyth v2', category: 'oracle', color: '#a855f7' },
  'SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f': { name: 'Switchboard', category: 'oracle', color: '#84cc16' },

  // Lending
  'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo': { name: 'Solend', category: 'lending', color: '#14b8a6' },
  'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA': { name: 'Marginfi', category: 'lending', color: '#8b5cf6' },
  'KLend2g3cP87ber41LAK123Z1rFg2wEEgmuuPgidDqd': { name: 'Kamino Lend', category: 'lending', color: '#f43f5e' },

  // Staking / Liquid Staking
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD': { name: 'Marinade', category: 'staking', color: '#0ea5e9' },
  'SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy': { name: 'Stake Pool', category: 'staking', color: '#3b82f6' },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { name: 'Jito Staking', category: 'staking', color: '#10b981' },

  // NFT
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': { name: 'Metaplex', category: 'nft', color: '#f472b6' },
  'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN': { name: 'Tensor Swap', category: 'nft', color: '#818cf8' },
  'TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp': { name: 'Tensor cNFT', category: 'nft', color: '#818cf8' },
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K': { name: 'Magic Eden v2', category: 'nft', color: '#e879f9' },

  // Perps / Derivatives
  'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH': { name: 'Drift', category: 'perps', color: '#fb923c' },
  'ZETAxsqBRek56DhiGXrn75yj2NHU3aYUnxvHXpkf3aD': { name: 'Zeta', category: 'perps', color: '#4ade80' },

  // Misc
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': { name: 'Memo', category: 'misc', color: '#94a3b8' },
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo': { name: 'Memo v1', category: 'misc', color: '#94a3b8' },
};

export interface NetworkStats {
  currentSlot: number;
  blockHeight: number;
  epochInfo: {
    epoch: number;
    slotIndex: number;
    slotsInEpoch: number;
    epochProgress: number;
  };
  tps: number;
  avgSlotTime: number;
  isLive: boolean;
}

export interface SupplyInfo {
  total: number;
  circulating: number;
  nonCirculating: number;
}

export interface ValidatorInfo {
  totalValidators: number;
  activeValidators: number;
  delinquentValidators: number;
  totalStake: number;
}

export interface InflationInfo {
  total: number;
  validator: number;
  foundation: number;
  epoch: number;
}

export interface ClusterInfo {
  totalNodes: number;
  rpcNodes: number;
  currentLeader: string | null;
}

export interface BlockProductionInfo {
  totalSlots: number;
  totalBlocksProduced: number;
  totalSlotsSkipped: number;
  skipRate: number;
}

// Singleton connection
let connectionInstance: Connection | null = null;

function getConnection() {
  if (!connectionInstance) {
    connectionInstance = new Connection(HELIUS_RPC, {
      commitment: 'confirmed',
    });
  }
  return connectionInstance;
}

export function useNetworkStats() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const slotTimesRef = useRef<number[]>([]);
  const lastSlotRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(Date.now());

  const fetchStats = useCallback(async () => {
    try {
      const connection = getConnection();
      const [slot, epochInfo, perfSamples] = await Promise.all([
        connection.getSlot(),
        connection.getEpochInfo(),
        connection.getRecentPerformanceSamples(5),
      ]);

      const avgTps = perfSamples.length > 0
        ? perfSamples.reduce((sum, s) => sum + (s.numTransactions / s.samplePeriodSecs), 0) / perfSamples.length
        : 0;

      const now = Date.now();
      if (lastSlotRef.current > 0 && slot > lastSlotRef.current) {
        const slotDelta = slot - lastSlotRef.current;
        const timeDelta = now - lastTimeRef.current;
        const avgSlotTime = timeDelta / slotDelta;
        slotTimesRef.current.push(avgSlotTime);
        if (slotTimesRef.current.length > 20) {
          slotTimesRef.current.shift();
        }
      }
      lastSlotRef.current = slot;
      lastTimeRef.current = now;

      const avgSlotTime = slotTimesRef.current.length > 0
        ? slotTimesRef.current.reduce((a, b) => a + b, 0) / slotTimesRef.current.length
        : 400;

      setStats({
        currentSlot: slot,
        blockHeight: epochInfo.blockHeight ?? slot,
        epochInfo: {
          epoch: epochInfo.epoch,
          slotIndex: epochInfo.slotIndex,
          slotsInEpoch: epochInfo.slotsInEpoch,
          epochProgress: (epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100,
        },
        tps: Math.round(avgTps),
        avgSlotTime: Math.round(avgSlotTime),
        isLive: true,
      });

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.warn('RPC failed:', err);
      setError('RPC connection failed');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, isLoading, error };
}

export function useRecentBlocks(count: number = 10) {
  const [blocks, setBlocks] = useState<SlotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    try {
      const connection = getConnection();
      const slot = await connection.getSlot();
      const slots = Array.from({ length: count }, (_, i) => slot - i);

      const blockPromises = slots.map(async (s): Promise<SlotData | null> => {
        try {
          const block = await connection.getBlock(s, {
            maxSupportedTransactionVersion: 0,
            transactionDetails: 'full',
            rewards: false,
          });

          if (!block) return null;

          let totalFees = 0;
          let successCount = 0;
          let totalCU = 0;
          const transactions: TransactionInfo[] = [];

          if (block.transactions) {
            for (const tx of block.transactions) {
              const sig = tx.transaction.signatures[0];
              const success = tx.meta?.err === null;
              const fee = tx.meta?.fee ?? 0;
              const cu = tx.meta?.computeUnitsConsumed ?? 200000;

              // Extract program IDs from account keys
              const programs: string[] = [];
              const message = tx.transaction.message;

              // Handle both legacy and versioned transactions
              if ('accountKeys' in message) {
                // Legacy transaction
                const accountKeys = message.accountKeys.map((k: { toBase58?: () => string }) =>
                  typeof k === 'string' ? k : k.toBase58?.() ?? String(k)
                );
                // Program IDs are typically the accounts that are invoked
                // We can identify them from the compiled instructions
                if ('compiledInstructions' in message) {
                  for (const ix of (message as { compiledInstructions: { programIdIndex: number }[] }).compiledInstructions) {
                    const programId = accountKeys[ix.programIdIndex];
                    if (programId && !programs.includes(programId)) {
                      programs.push(programId);
                    }
                  }
                } else if ('instructions' in message) {
                  for (const ix of (message as { instructions: { programIdIndex: number }[] }).instructions) {
                    const programId = accountKeys[ix.programIdIndex];
                    if (programId && !programs.includes(programId)) {
                      programs.push(programId);
                    }
                  }
                }
              } else if ('staticAccountKeys' in message) {
                // Versioned transaction (v0)
                const accountKeys = (message as { staticAccountKeys: { toBase58?: () => string }[] }).staticAccountKeys.map((k) =>
                  typeof k === 'string' ? k : k.toBase58?.() ?? String(k)
                );
                if ('compiledInstructions' in message) {
                  for (const ix of (message as { compiledInstructions: { programIdIndex: number }[] }).compiledInstructions) {
                    const programId = accountKeys[ix.programIdIndex];
                    if (programId && !programs.includes(programId)) {
                      programs.push(programId);
                    }
                  }
                }
              }

              totalFees += fee;
              if (success) successCount++;
              totalCU += cu;

              transactions.push({
                signature: sig,
                success,
                fee,
                computeUnits: cu,
                slot: s,
                programs,
              });
            }
          }

          const txCount = block.transactions?.length ?? 0;

          return {
            slot: s,
            blockTime: block.blockTime,
            txCount,
            parentSlot: block.parentSlot,
            blockhash: block.blockhash,
            totalFees,
            successRate: txCount > 0 ? (successCount / txCount) * 100 : 100,
            totalCU,
            transactions: transactions.slice(0, 50), // Keep first 50 per block for better analysis
          };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(blockPromises);
      const validBlocks = results.filter((b): b is SlotData => b !== null);

      if (validBlocks.length > 0) {
        setBlocks(validBlocks);
        setError(null);
      }
      setIsLoading(false);
    } catch (err) {
      console.warn('Failed to fetch blocks:', err);
      setError('Failed to fetch blocks');
      setIsLoading(false);
    }
  }, [count]);

  useEffect(() => {
    fetchBlocks();
    // Slower refresh rate (8s) to reduce lag and UI jank
    const interval = setInterval(fetchBlocks, 8000);
    return () => clearInterval(interval);
  }, [fetchBlocks]);

  return { blocks, isLoading, error };
}

export function useSupplyInfo() {
  const [supply, setSupply] = useState<SupplyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSupply = async () => {
      try {
        const connection = getConnection();
        const supplyInfo = await connection.getSupply();

        setSupply({
          total: supplyInfo.value.total / LAMPORTS_PER_SOL,
          circulating: supplyInfo.value.circulating / LAMPORTS_PER_SOL,
          nonCirculating: supplyInfo.value.nonCirculating / LAMPORTS_PER_SOL,
        });
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to fetch supply:', err);
        setIsLoading(false);
      }
    };

    fetchSupply();
    const interval = setInterval(fetchSupply, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

  return { supply, isLoading };
}

export function useValidatorInfo() {
  const [validators, setValidators] = useState<ValidatorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchValidators = async () => {
      try {
        const connection = getConnection();
        const voteAccounts = await connection.getVoteAccounts();

        const activeStake = voteAccounts.current.reduce((sum, v) => sum + v.activatedStake, 0);
        const delinquentStake = voteAccounts.delinquent.reduce((sum, v) => sum + v.activatedStake, 0);

        setValidators({
          totalValidators: voteAccounts.current.length + voteAccounts.delinquent.length,
          activeValidators: voteAccounts.current.length,
          delinquentValidators: voteAccounts.delinquent.length,
          totalStake: (activeStake + delinquentStake) / LAMPORTS_PER_SOL,
        });
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to fetch validators:', err);
        setIsLoading(false);
      }
    };

    fetchValidators();
    const interval = setInterval(fetchValidators, 60000); // Every 60s
    return () => clearInterval(interval);
  }, []);

  return { validators, isLoading };
}

// Get recent transactions across blocks
export function useRecentTransactions(blocks: SlotData[]) {
  const transactions = blocks
    .flatMap(block => block.transactions || [])
    .slice(0, 20);

  return { transactions };
}

// Get inflation info
export function useInflationInfo() {
  const [inflation, setInflation] = useState<InflationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInflation = async () => {
      try {
        const connection = getConnection();
        const inflationRate = await connection.getInflationRate();

        setInflation({
          total: inflationRate.total * 100,
          validator: inflationRate.validator * 100,
          foundation: inflationRate.foundation * 100,
          epoch: inflationRate.epoch,
        });
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to fetch inflation:', err);
        setIsLoading(false);
      }
    };

    fetchInflation();
    const interval = setInterval(fetchInflation, 60000); // Every 60s
    return () => clearInterval(interval);
  }, []);

  return { inflation, isLoading };
}

// Get cluster info
export function useClusterInfo() {
  const [cluster, setCluster] = useState<ClusterInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCluster = async () => {
      try {
        const connection = getConnection();
        const [nodes, leader] = await Promise.all([
          connection.getClusterNodes(),
          connection.getSlotLeader().catch(() => null),
        ]);

        const rpcNodes = nodes.filter(n => n.rpc !== null).length;

        setCluster({
          totalNodes: nodes.length,
          rpcNodes,
          currentLeader: leader,
        });
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to fetch cluster info:', err);
        setIsLoading(false);
      }
    };

    fetchCluster();
    const interval = setInterval(fetchCluster, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

  return { cluster, isLoading };
}

// Get block production stats
export function useBlockProduction() {
  const [production, setProduction] = useState<BlockProductionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProduction = async () => {
      try {
        const connection = getConnection();
        const prodInfo = await connection.getBlockProduction();

        let totalSlots = 0;
        let totalProduced = 0;

        // Aggregate from all validators
        for (const [, [slots, produced]] of Object.entries(prodInfo.value.byIdentity)) {
          totalSlots += slots;
          totalProduced += produced;
        }

        const skipped = totalSlots - totalProduced;
        const skipRate = totalSlots > 0 ? (skipped / totalSlots) * 100 : 0;

        setProduction({
          totalSlots,
          totalBlocksProduced: totalProduced,
          totalSlotsSkipped: skipped,
          skipRate,
        });
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to fetch block production:', err);
        setIsLoading(false);
      }
    };

    fetchProduction();
    const interval = setInterval(fetchProduction, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

  return { production, isLoading };
}

// Priority fee info interface
export interface PriorityFeeInfo {
  min: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  recommended: number;
  available: boolean;
}

// Get priority fees - requires Developer+ Helius plan
export function usePriorityFees() {
  const [fees, setFees] = useState<PriorityFeeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        const connection = getConnection();

        // Try to fetch recent prioritization fees
        // This requires Developer+ Helius plan
        const recentFees = await connection.getRecentPrioritizationFees();

        if (recentFees && recentFees.length > 0) {
          // Extract fee values and sort
          const feeValues = recentFees
            .map(f => f.prioritizationFee)
            .filter(f => f > 0)
            .sort((a, b) => a - b);

          if (feeValues.length > 0) {
            const min = feeValues[0];
            const max = feeValues[feeValues.length - 1];
            const median = feeValues[Math.floor(feeValues.length / 2)];
            const p75 = feeValues[Math.floor(feeValues.length * 0.75)];
            const p90 = feeValues[Math.floor(feeValues.length * 0.90)];
            // Recommended: slightly above median for good inclusion
            const recommended = Math.ceil(median * 1.2);

            setFees({
              min,
              median,
              p75,
              p90,
              max,
              recommended,
              available: true,
            });
            setIsAvailable(true);
          } else {
            // No fees found (all zero)
            setFees({
              min: 0,
              median: 0,
              p75: 0,
              p90: 0,
              max: 0,
              recommended: 0,
              available: true,
            });
            setIsAvailable(true);
          }
        } else {
          setIsAvailable(false);
        }
        setIsLoading(false);
      } catch (err) {
        // Method not available on this plan
        console.warn('Priority fees not available (requires Developer+ plan):', err);
        setIsAvailable(false);
        setIsLoading(false);
      }
    };

    fetchFees();
    const interval = setInterval(fetchFees, 10000); // Every 10s for fees
    return () => clearInterval(interval);
  }, []);

  return { fees, isLoading, isAvailable };
}

// Helper to format SOL
export function formatSOL(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol >= 1_000_000) return (sol / 1_000_000).toFixed(2) + 'M';
  if (sol >= 1_000) return (sol / 1_000).toFixed(2) + 'K';
  if (sol >= 1) return sol.toFixed(4);
  return (sol * 1000).toFixed(4) + ' mSOL';
}

// Helper to format large numbers
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
}

// Helper to format CU
export function formatCU(cu: number): string {
  if (cu >= 1_000_000) return (cu / 1_000_000).toFixed(1) + 'M';
  if (cu >= 1_000) return (cu / 1_000).toFixed(0) + 'k';
  return cu.toString();
}

// Helper to get Solscan URL
export function getSolscanUrl(type: 'tx' | 'block' | 'account', id: string | number): string {
  const base = 'https://solscan.io';
  switch (type) {
    case 'tx': return `${base}/tx/${id}`;
    case 'block': return `${base}/block/${id}`;
    case 'account': return `${base}/account/${id}`;
  }
}

// Helper to truncate signature
export function truncateSig(sig: string): string {
  return sig.slice(0, 8) + '...' + sig.slice(-4);
}

// Helper to get program info
export function getProgramInfo(programId: string): { name: string; category: string; color: string } {
  return KNOWN_PROGRAMS[programId] || { name: truncateSig(programId), category: 'unknown', color: '#64748b' };
}

// Helper to get primary program category for a transaction
export function getTxCategory(programs: string[]): string {
  // Priority order for categorization
  const priority = ['dex', 'perps', 'lending', 'nft', 'staking', 'oracle', 'core', 'vote', 'misc', 'unknown'];

  for (const cat of priority) {
    for (const prog of programs) {
      const info = KNOWN_PROGRAMS[prog];
      if (info?.category === cat) {
        return cat;
      }
    }
  }
  return 'unknown';
}

// Category colors for the visualizer
export const CATEGORY_COLORS: Record<string, string> = {
  dex: '#22c55e',      // Green - swaps
  perps: '#fb923c',    // Orange - derivatives
  lending: '#14b8a6',  // Teal - lending
  nft: '#f472b6',      // Pink - NFTs
  staking: '#3b82f6',  // Blue - staking
  oracle: '#a855f7',   // Purple - oracles
  core: '#71717a',     // Gray - system
  vote: '#52525b',     // Dark gray - votes
  misc: '#94a3b8',     // Light gray - misc
  unknown: '#64748b',  // Slate - unknown
};
