import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

// RPC endpoints - Helius primary (premium), Alchemy fallback
const HELIUS_API_KEY = 'REDACTED_HELIUS_KEY';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API = `https://api.helius.xyz/v0`;
const ALCHEMY_RPC = 'https://solana-mainnet.g.alchemy.com/v2/REDACTED_ALCHEMY_KEY';

// Primary and fallback connections
let primaryConnection: Connection | null = null;
let fallbackConnection: Connection | null = null;
let useHelius = true; // Helius premium is primary

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
  numSignatures: number; // Number of signatures for base fee calculation
  jitoTip: number; // Jito tip amount in lamports (0 if none)
  feePayer: string; // First signer / fee payer
  solMovement: number; // Net SOL movement (excluding fees) in lamports
}

// Jito tip accounts - tips sent to these addresses are Jito MEV tips
export const JITO_TIP_ACCOUNTS = new Set([
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
]);

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
  transactionCount?: number;
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

// Connection management with automatic fallback
function getConnection(): Connection {
  if (useHelius) {
    if (!primaryConnection) {
      primaryConnection = new Connection(HELIUS_RPC, { commitment: 'confirmed' });
    }
    return primaryConnection;
  } else {
    if (!fallbackConnection) {
      fallbackConnection = new Connection(ALCHEMY_RPC, { commitment: 'confirmed' });
    }
    return fallbackConnection;
  }
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
      const [slot, epochInfo, perfSamples, txCount] = await Promise.all([
        connection.getSlot(),
        connection.getEpochInfo(),
        connection.getRecentPerformanceSamples(5),
        connection.getTransactionCount().catch(() => undefined),
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
        transactionCount: txCount,
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
          // Use Helius jsonParsed encoding for pre-parsed instruction data
          const response = await fetch(HELIUS_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: `block-${s}`,
              method: 'getBlock',
              params: [s, {
                encoding: 'jsonParsed',
                maxSupportedTransactionVersion: 0,
                transactionDetails: 'full',
                rewards: false,
              }],
            }),
          });

          const json = await response.json();
          const block = json?.result;
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
              const numSignatures = tx.transaction.signatures.length;

              // With jsonParsed, program IDs come directly from instructions
              const programs: string[] = [];
              const message = tx.transaction.message;

              // Extract account keys (jsonParsed returns them as objects with pubkey)
              let accountKeys: string[] = [];
              if (message.accountKeys) {
                accountKeys = message.accountKeys.map((k: { pubkey?: string }) =>
                  typeof k === 'string' ? k : k.pubkey ?? String(k)
                );
              }

              // Extract programs from parsed instructions
              if (message.instructions) {
                for (const ix of message.instructions) {
                  // jsonParsed gives programId directly as a string
                  const programId = ix.programId || (ix.program && accountKeys[ix.programIdIndex]);
                  if (programId && !programs.includes(programId)) {
                    programs.push(programId);
                  }
                }
              }

              // Also extract from inner instructions (important for CPI calls)
              if (tx.meta?.innerInstructions) {
                for (const inner of tx.meta.innerInstructions) {
                  for (const ix of inner.instructions) {
                    const programId = ix.programId;
                    if (programId && !programs.includes(programId)) {
                      programs.push(programId);
                    }
                  }
                }
              }

              // Get fee payer (first account)
              const feePayer = accountKeys[0] || '';

              // Detect Jito tips and calculate SOL movement
              let jitoTip = 0;
              let solMovement = 0;
              const preBalances = tx.meta?.preBalances ?? [];
              const postBalances = tx.meta?.postBalances ?? [];
              for (let i = 0; i < accountKeys.length; i++) {
                const balanceChange = (postBalances[i] ?? 0) - (preBalances[i] ?? 0);
                if (JITO_TIP_ACCOUNTS.has(accountKeys[i])) {
                  if (balanceChange > 0) {
                    jitoTip += balanceChange;
                  }
                }
                // Track SOL movement for the fee payer (excluding fee)
                if (i === 0) {
                  solMovement = balanceChange + fee;
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
                numSignatures,
                jitoTip,
                feePayer,
                solMovement,
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
            transactions,
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
        // Store blocks for historical analysis (async, don't await)
        for (const block of validBlocks) {
          storeBlockData(block);
        }
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
    // Slower refresh rate (15s) to reduce API rate limiting
    const interval = setInterval(fetchBlocks, 15000);
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

// Get priority fees via Helius getPriorityFeeEstimate (premium)
export function usePriorityFees() {
  const [fees, setFees] = useState<PriorityFeeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        // Use Helius getPriorityFeeEstimate for accurate percentile data
        const response = await fetch(HELIUS_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'priority-fees',
            method: 'getPriorityFeeEstimate',
            params: [{ options: { includeAllPriorityFeeLevels: true } }],
          }),
        });

        const data = await response.json();
        const levels = data?.result?.priorityFeeLevels;

        if (levels) {
          setFees({
            min: Math.round(levels.min || 0),
            median: Math.round(levels.medium || 0),
            p75: Math.round(levels.high || 0),
            p90: Math.round(levels.veryHigh || 0),
            max: Math.round(levels.unsafeMax || 0),
            recommended: Math.round(levels.medium || 0),
            available: true,
          });
          setIsAvailable(true);
        } else {
          // Fallback to standard RPC method
          const connection = getConnection();
          const recentFees = await connection.getRecentPrioritizationFees();
          const feeValues = (recentFees || [])
            .map(f => f.prioritizationFee)
            .filter(f => f > 0)
            .sort((a, b) => a - b);

          if (feeValues.length > 0) {
            setFees({
              min: feeValues[0],
              median: feeValues[Math.floor(feeValues.length / 2)],
              p75: feeValues[Math.floor(feeValues.length * 0.75)],
              p90: feeValues[Math.floor(feeValues.length * 0.90)],
              max: feeValues[feeValues.length - 1],
              recommended: Math.ceil(feeValues[Math.floor(feeValues.length / 2)] * 1.2),
              available: true,
            });
          }
          setIsAvailable(feeValues.length > 0);
        }
        setIsLoading(false);
      } catch (err) {
        console.warn('Priority fees fetch error:', err);
        setIsAvailable(false);
        setIsLoading(false);
      }
    };

    fetchFees();
    const interval = setInterval(fetchFees, 10000);
    return () => clearInterval(interval);
  }, []);

  return { fees, isLoading, isAvailable };
}

// Helius Enhanced Transaction data
export interface EnhancedTransaction {
  signature: string;
  type: string; // SWAP, TRANSFER, NFT_SALE, etc.
  source: string; // Jupiter, Orca, Raydium, etc.
  description: string;
  fee: number;
  feePayer: string;
  timestamp: number;
  nativeTransfers: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>;
  tokenTransfers: Array<{ fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number; tokenStandard?: string }>;
}

// Fetch enriched transaction data from Helius Enhanced Transactions API
export async function fetchEnhancedTransactions(signatures: string[]): Promise<EnhancedTransaction[]> {
  if (signatures.length === 0) return [];
  // API accepts up to 100 signatures per call
  const batch = signatures.slice(0, 100);
  try {
    const response = await fetch(`${HELIUS_API}/transactions?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: batch }),
    });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
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

// Validator Info Cache (names, logos, locations)
export interface ValidatorMetadata {
  name: string;
  logo?: string;
  location?: string;
  datacenter?: string;
}

const validatorInfoCache = new Map<string, ValidatorMetadata>();
let validatorInfoFetched = false;

// Legacy cache for backward compatibility
const validatorNamesCache = new Map<string, string>();
let validatorNamesFetched = false;

// Fetch validator info from Stakewiz API (free, comprehensive)
export async function fetchValidatorInfo(): Promise<Map<string, ValidatorMetadata>> {
  if (validatorInfoFetched && validatorInfoCache.size > 0) {
    return validatorInfoCache;
  }

  try {
    // Stakewiz provides a comprehensive validator list with names, logos, and datacenter info
    const response = await fetch('https://api.stakewiz.com/validators');
    if (!response.ok) throw new Error('Failed to fetch validator info');

    const data = await response.json();

    for (const v of data) {
      const info: ValidatorMetadata = {
        name: v.name || v.vote_identity?.slice(0, 8) + '...',
        logo: v.image || v.avatar_url || v.keybase_avatar_url || undefined,
        location: v.ip_city ? `${v.ip_city}, ${v.ip_country}` : v.ip_country,
        datacenter: v.asn,
      };

      // Store by both identity and vote_identity so we can look up by either
      if (v.vote_identity) {
        validatorInfoCache.set(v.vote_identity, info);
        validatorNamesCache.set(v.vote_identity, info.name);
      }
      if (v.identity) {
        validatorInfoCache.set(v.identity, info);
        validatorNamesCache.set(v.identity, info.name);
      }
    }

    validatorInfoFetched = true;
    validatorNamesFetched = true;
    return validatorInfoCache;
  } catch (err) {
    console.warn('Failed to fetch validator info:', err);
    return validatorInfoCache;
  }
}

// Get validator metadata by pubkey
export function getValidatorMetadata(pubkey: string): ValidatorMetadata | null {
  return validatorInfoCache.get(pubkey) || null;
}

// Fetch validator names (legacy, calls fetchValidatorInfo)
export async function fetchValidatorNames(): Promise<Map<string, string>> {
  await fetchValidatorInfo();
  return validatorNamesCache;
}

// Hook to get validator names
export function useValidatorNames() {
  const [names, setNames] = useState<Map<string, string>>(validatorNamesCache);
  const [metadata, setMetadata] = useState<Map<string, ValidatorMetadata>>(validatorInfoCache);
  const [isLoading, setIsLoading] = useState(!validatorNamesFetched);

  useEffect(() => {
    if (validatorInfoFetched && validatorInfoCache.size > 0) {
      setNames(validatorNamesCache);
      setMetadata(new Map(validatorInfoCache));
      setIsLoading(false);
      return;
    }

    fetchValidatorInfo().then(() => {
      setNames(new Map(validatorNamesCache));
      setMetadata(new Map(validatorInfoCache));
      setIsLoading(false);
    });
  }, []);

  const getName = useCallback((pubkey: string): string | null => {
    return names.get(pubkey) || null;
  }, [names]);

  const getMetadata = useCallback((pubkey: string): ValidatorMetadata | null => {
    return metadata.get(pubkey) || null;
  }, [metadata]);

  return { names, getName, getMetadata, isLoading };
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

// Leader Schedule Info
export interface LeaderScheduleEntry {
  slot: number;
  leader: string;
  relativeSlot: number; // slots from current
}

export interface LeaderScheduleInfo {
  currentSlot: number;
  upcomingLeaders: LeaderScheduleEntry[];
  leaderCounts: Map<string, number>;
}

// Get leader schedule for upcoming slots
export function useLeaderSchedule(currentSlot: number) {
  const [schedule, setSchedule] = useState<LeaderScheduleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!currentSlot) return;

      try {
        const connection = getConnection();
        const leaderSchedule = await connection.getLeaderSchedule();

        if (!leaderSchedule) {
          setIsLoading(false);
          return;
        }

        // Get epoch info to calculate slot offsets
        const epochInfo = await connection.getEpochInfo();
        const epochStartSlot = currentSlot - epochInfo.slotIndex;

        // Build upcoming leaders list
        const upcomingLeaders: LeaderScheduleEntry[] = [];
        const leaderCounts = new Map<string, number>();

        // Create a slot-to-leader map for next 100 slots
        const slotToLeader = new Map<number, string>();

        for (const [leader, slots] of Object.entries(leaderSchedule)) {
          // Count total slots for this leader
          leaderCounts.set(leader, slots.length);

          for (const slotOffset of slots) {
            const absoluteSlot = epochStartSlot + slotOffset;
            if (absoluteSlot >= currentSlot && absoluteSlot < currentSlot + 100) {
              slotToLeader.set(absoluteSlot, leader);
            }
          }
        }

        // Sort and collect upcoming slots
        const sortedSlots = Array.from(slotToLeader.keys()).sort((a, b) => a - b);
        for (const slot of sortedSlots.slice(0, 20)) {
          const leader = slotToLeader.get(slot)!;
          upcomingLeaders.push({
            slot,
            leader,
            relativeSlot: slot - currentSlot,
          });
        }

        setSchedule({
          currentSlot,
          upcomingLeaders,
          leaderCounts,
        });
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to fetch leader schedule:', err);
        setIsLoading(false);
      }
    };

    fetchSchedule();
    const interval = setInterval(fetchSchedule, 30000); // Every 30s
    return () => clearInterval(interval);
  }, [currentSlot]);

  return { schedule, isLoading };
}

// ============================================
// ENHANCED TRANSACTION STREAM (Helius WebSocket)
// ============================================

export interface StreamTransaction {
  signature: string;
  slot: number;
  timestamp: number;
  success: boolean;
  fee: number;
  feePayer: string;
  programs: string[];
  computeUnits: number;
  jitoTip: number;
  solMovement: number;
  tokenTransfers: Array<{ mint: string; from: string; to: string; amount: number }>;
  nativeTransfers: Array<{ from: string; to: string; amount: number }>;
}

export interface StreamStats {
  total: number;
  failed: number;
  successRate: number;
  avgFee: number;
  totalVolume: number;
}

export function useTransactionStream(maxTx: number = 100) {
  const [transactions, setTransactions] = useState<StreamTransaction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [txPerSecond, setTxPerSecond] = useState(0);
  const [stats, setStats] = useState<StreamStats>({ total: 0, failed: 0, successRate: 100, avgFee: 0, totalVolume: 0 });
  const [fallbackMode, setFallbackMode] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(2000);
  const bufferRef = useRef<StreamTransaction[]>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tpsTimestampsRef = useRef<number[]>([]);
  const statsAccRef = useRef({ total: 0, failed: 0, totalFee: 0, totalVolume: 0 });

  useEffect(() => {
    const wsUrl = HELIUS_RPC.replace('https://', 'wss://');

    // Flush buffer to state every 100ms
    flushIntervalRef.current = setInterval(() => {
      if (bufferRef.current.length > 0) {
        const batch = bufferRef.current.splice(0);
        setTransactions(prev => [...batch, ...prev].slice(0, maxTx));
      }

      // Calculate TPS from 5-second sliding window
      const now = Date.now();
      const window = 5000;
      tpsTimestampsRef.current = tpsTimestampsRef.current.filter(t => now - t < window);
      setTxPerSecond(Math.round(tpsTimestampsRef.current.length / (window / 1000)));

      // Update stats
      const acc = statsAccRef.current;
      setStats({
        total: acc.total,
        failed: acc.failed,
        successRate: acc.total > 0 ? ((acc.total - acc.failed) / acc.total) * 100 : 100,
        avgFee: acc.total > 0 ? acc.totalFee / acc.total : 0,
        totalVolume: acc.totalVolume,
      });
    }, 100);

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectDelayRef.current = 2000; // Reset backoff on success

        // Try Enhanced WebSocket first: transactionSubscribe
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'transactionSubscribe',
          params: [{
            vote: false,
            failed: true,
          }, {
            commitment: 'confirmed',
            encoding: 'jsonParsed',
            transactionDetails: 'full',
            maxSupportedTransactionVersion: 0,
          }],
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Check for subscription error → fallback to logsSubscribe
          if (data.id === 1 && data.error) {
            console.warn('transactionSubscribe not available, falling back to logsSubscribe:', data.error);
            setFallbackMode(true);
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'logsSubscribe',
              params: ['all', { commitment: 'confirmed' }],
            }));
            return;
          }

          // Handle Enhanced transactionSubscribe notifications
          if (data.method === 'transactionNotification' && data.params?.result) {
            const result = data.params.result;
            const tx = result.transaction;
            const meta = tx?.meta;
            const message = tx?.transaction?.message;
            if (!message) return;

            const signature = result.signature || tx?.transaction?.signatures?.[0] || '';
            const slot = result.slot || 0;

            // Extract account keys
            let accountKeys: string[] = [];
            if (message.accountKeys) {
              accountKeys = message.accountKeys.map((k: { pubkey?: string } | string) =>
                typeof k === 'string' ? k : k.pubkey ?? String(k)
              );
            }

            // Extract programs from instructions + inner instructions
            const programs: string[] = [];
            if (message.instructions) {
              for (const ix of message.instructions) {
                const pid = ix.programId || (ix.programIdIndex !== undefined ? accountKeys[ix.programIdIndex] : undefined);
                if (pid && !programs.includes(pid)) programs.push(pid);
              }
            }
            if (meta?.innerInstructions) {
              for (const inner of meta.innerInstructions) {
                for (const ix of inner.instructions) {
                  const pid = ix.programId;
                  if (pid && !programs.includes(pid)) programs.push(pid);
                }
              }
            }

            // Detect Jito tips + SOL movement
            let jitoTip = 0;
            let solMovement = 0;
            const preBalances = meta?.preBalances ?? [];
            const postBalances = meta?.postBalances ?? [];
            for (let i = 0; i < accountKeys.length; i++) {
              const change = (postBalances[i] ?? 0) - (preBalances[i] ?? 0);
              if (JITO_TIP_ACCOUNTS.has(accountKeys[i]) && change > 0) {
                jitoTip += change;
              }
              if (i === 0) {
                solMovement = change + (meta?.fee ?? 0);
              }
            }

            // Extract token transfers from parsed spl-token instructions
            const tokenTransfers: StreamTransaction['tokenTransfers'] = [];
            const nativeTransfers: StreamTransaction['nativeTransfers'] = [];

            const extractTransfers = (instructions: Array<{ program?: string; programId?: string; parsed?: { type?: string; info?: Record<string, unknown> } }>) => {
              for (const ix of instructions) {
                const prog = ix.program || ix.programId;
                if ((prog === 'spl-token' || prog === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' || prog === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') && ix.parsed) {
                  if (ix.parsed.type === 'transfer' || ix.parsed.type === 'transferChecked') {
                    const info = ix.parsed.info as Record<string, unknown>;
                    tokenTransfers.push({
                      mint: (info.mint as string) || '',
                      from: (info.source as string) || (info.authority as string) || '',
                      to: (info.destination as string) || '',
                      amount: Number(info.tokenAmount && typeof info.tokenAmount === 'object' ? (info.tokenAmount as { amount?: string }).amount : info.amount) || 0,
                    });
                  }
                }
                if ((prog === 'system' || prog === '11111111111111111111111111111111') && ix.parsed?.type === 'transfer') {
                  const info = ix.parsed.info as Record<string, unknown>;
                  nativeTransfers.push({
                    from: (info.source as string) || '',
                    to: (info.destination as string) || '',
                    amount: Number(info.lamports) || 0,
                  });
                }
              }
            };

            if (message.instructions) extractTransfers(message.instructions);
            if (meta?.innerInstructions) {
              for (const inner of meta.innerInstructions) {
                extractTransfers(inner.instructions);
              }
            }

            const streamTx: StreamTransaction = {
              signature,
              slot,
              timestamp: Date.now(),
              success: meta?.err === null || meta?.err === undefined,
              fee: meta?.fee ?? 0,
              feePayer: accountKeys[0] || '',
              programs,
              computeUnits: meta?.computeUnitsConsumed ?? 0,
              jitoTip,
              solMovement,
              tokenTransfers,
              nativeTransfers,
            };

            bufferRef.current.push(streamTx);
            tpsTimestampsRef.current.push(Date.now());

            // Accumulate stats
            statsAccRef.current.total++;
            if (!streamTx.success) statsAccRef.current.failed++;
            statsAccRef.current.totalFee += streamTx.fee;
            statsAccRef.current.totalVolume += Math.abs(solMovement);
            return;
          }

          // Handle logsSubscribe fallback notifications
          if (data.method === 'logsNotification' && data.params?.result?.value) {
            const { signature, err } = data.params.result.value;
            if (!signature) return;

            const streamTx: StreamTransaction = {
              signature,
              slot: data.params.result.context?.slot ?? 0,
              timestamp: Date.now(),
              success: !err,
              fee: 0,
              feePayer: '',
              programs: [],
              computeUnits: 0,
              jitoTip: 0,
              solMovement: 0,
              tokenTransfers: [],
              nativeTransfers: [],
            };

            bufferRef.current.push(streamTx);
            tpsTimestampsRef.current.push(Date.now());
            statsAccRef.current.total++;
            if (!streamTx.success) statsAccRef.current.failed++;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        const delay = Math.min(reconnectDelayRef.current, 30000);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
        reconnectDelayRef.current = Math.min(delay * 1.5, 30000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
    };
  }, [maxTx]);

  return { transactions, isConnected, txPerSecond, stats, fallbackMode };
}

// Token Price Info
export interface TokenPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  mint?: string;
}

export interface TokenPriceInfo {
  sol: TokenPrice;
  tokens: TokenPrice[];
  lastUpdated: number;
}

// Fetch token prices from Jupiter API (free, no auth required)
export function useTokenPrices() {
  const [prices, setPrices] = useState<TokenPriceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Jupiter Price API v2 - free and reliable
        const mints = [
          'So11111111111111111111111111111111111111112', // SOL
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
          'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
          'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', // JTO
          'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
          'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
          'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // jitoSOL
        ];

        const response = await fetch(
          `https://api.jup.ag/price/v2?ids=${mints.join(',')}&showExtraInfo=true`
        );

        if (!response.ok) throw new Error('Failed to fetch prices');

        const data = await response.json();

        const tokenMap: Record<string, { symbol: string; name: string }> = {
          'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana' },
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin' },
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether' },
          'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter' },
          'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': { symbol: 'JTO', name: 'Jito' },
          'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk' },
          'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade SOL' },
          'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'jitoSOL', name: 'Jito Staked SOL' },
        };

        const tokens: TokenPrice[] = [];
        let solPrice: TokenPrice | null = null;

        for (const [mint, priceData] of Object.entries(data.data || {})) {
          const info = tokenMap[mint];
          if (!info) continue;

          const pd = priceData as { price?: string; extraInfo?: { quotedPrice?: { buyPrice?: string; sellPrice?: string } } };
          const price = parseFloat(pd.price || '0');

          const token: TokenPrice = {
            symbol: info.symbol,
            name: info.name,
            price,
            change24h: 0, // Jupiter v2 doesn't include 24h change directly
            mint,
          };

          if (mint === 'So11111111111111111111111111111111111111112') {
            solPrice = token;
          } else {
            tokens.push(token);
          }
        }

        if (solPrice) {
          setPrices({
            sol: solPrice,
            tokens,
            lastUpdated: Date.now(),
          });
        }
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to fetch token prices:', err);
        setIsLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

  return { prices, isLoading };
}

// ============================================
// TOKEN METADATA (Helius DAS API)
// ============================================

export interface TokenMetadata {
  name: string;
  symbol: string;
  image?: string;
  decimals?: number;
}

// Persistent cache across hook instances
const tokenMetadataCache = new Map<string, TokenMetadata>();
const pendingFetches = new Set<string>();

// Pre-seed common tokens
const KNOWN_TOKENS: Record<string, TokenMetadata> = {
  'So11111111111111111111111111111111111111112': { name: 'Solana', symbol: 'SOL', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { name: 'Tether', symbol: 'USDT', decimals: 6 },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { name: 'Jupiter', symbol: 'JUP', decimals: 6 },
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': { name: 'Jito', symbol: 'JTO', decimals: 9 },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { name: 'Bonk', symbol: 'BONK', decimals: 5 },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { name: 'Marinade SOL', symbol: 'mSOL', decimals: 9 },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { name: 'Jito Staked SOL', symbol: 'jitoSOL', decimals: 9 },
};

// Initialize cache with known tokens
for (const [mint, meta] of Object.entries(KNOWN_TOKENS)) {
  tokenMetadataCache.set(mint, meta);
}

export async function fetchTokenMetadataBatch(mints: string[]): Promise<void> {
  // Filter out already cached and in-flight
  const toFetch = mints.filter(m => !tokenMetadataCache.has(m) && !pendingFetches.has(m));
  if (toFetch.length === 0) return;

  // Mark as pending
  for (const m of toFetch) pendingFetches.add(m);

  // Batch in chunks of 100
  for (let i = 0; i < toFetch.length; i += 100) {
    const batch = toFetch.slice(i, i + 100);
    try {
      const response = await fetch(HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'das-batch',
          method: 'getAssetBatch',
          params: { ids: batch },
        }),
      });

      const json = await response.json();
      const results = json?.result;
      if (Array.isArray(results)) {
        for (const asset of results) {
          if (!asset?.id) continue;
          const meta: TokenMetadata = {
            name: asset.content?.metadata?.name || asset.id.slice(0, 8) + '...',
            symbol: asset.content?.metadata?.symbol || '???',
            image: asset.content?.links?.image || undefined,
            decimals: asset.token_info?.decimals ?? undefined,
          };
          tokenMetadataCache.set(asset.id, meta);
        }
      }
    } catch (err) {
      console.warn('DAS getAssetBatch failed:', err);
    }

    // Unmark pending
    for (const m of batch) pendingFetches.delete(m);
  }
}

export function useTokenMetadata(mints: string[]) {
  const [, setTick] = useState(0);
  const prevMintsRef = useRef<string>('');

  useEffect(() => {
    const key = mints.join(',');
    if (key === prevMintsRef.current) return;
    prevMintsRef.current = key;

    const unknown = mints.filter(m => !tokenMetadataCache.has(m));
    if (unknown.length > 0) {
      fetchTokenMetadataBatch(unknown).then(() => setTick(t => t + 1));
    }
  }, [mints]);

  const getTokenInfo = useCallback((mint: string): TokenMetadata | null => {
    return tokenMetadataCache.get(mint) || null;
  }, []);

  return { metadata: tokenMetadataCache, getTokenInfo };
}

// Format token amount with decimals
export function formatTokenAmount(rawAmount: number, decimals?: number): string {
  const dec = decimals ?? 0;
  const amount = rawAmount / Math.pow(10, dec);
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
  if (amount >= 1_000) return (amount / 1_000).toFixed(2) + 'K';
  if (amount >= 1) return amount.toFixed(dec > 4 ? 2 : Math.min(dec, 4));
  if (amount > 0) return amount.toPrecision(4);
  return '0';
}

// Top Validators Info
export interface ValidatorDetails {
  votePubkey: string;
  nodePubkey: string;
  activatedStake: number;
  commission: number;
  lastVote: number;
  epochCredits: number;
  delinquent: boolean;
}

export interface TopValidatorsInfo {
  validators: ValidatorDetails[];
  totalStake: number;
  avgCommission: number;
}

// Get top validators by stake
export function useTopValidators(limit: number = 20) {
  const [validatorInfo, setValidatorInfo] = useState<TopValidatorsInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchValidators = async () => {
      try {
        const connection = getConnection();
        const voteAccounts = await connection.getVoteAccounts();

        // Combine and sort by stake
        const allValidators: ValidatorDetails[] = [
          ...voteAccounts.current.map(v => ({
            votePubkey: v.votePubkey,
            nodePubkey: v.nodePubkey,
            activatedStake: v.activatedStake / LAMPORTS_PER_SOL,
            commission: v.commission,
            lastVote: v.lastVote,
            epochCredits: v.epochCredits.length > 0
              ? v.epochCredits[v.epochCredits.length - 1][1]
              : 0,
            delinquent: false,
          })),
          ...voteAccounts.delinquent.map(v => ({
            votePubkey: v.votePubkey,
            nodePubkey: v.nodePubkey,
            activatedStake: v.activatedStake / LAMPORTS_PER_SOL,
            commission: v.commission,
            lastVote: v.lastVote,
            epochCredits: v.epochCredits.length > 0
              ? v.epochCredits[v.epochCredits.length - 1][1]
              : 0,
            delinquent: true,
          })),
        ];

        // Sort by stake descending
        allValidators.sort((a, b) => b.activatedStake - a.activatedStake);

        const topValidators = limit > 0 ? allValidators.slice(0, limit) : allValidators;
        const totalStake = allValidators.reduce((sum, v) => sum + v.activatedStake, 0);
        const avgCommission = topValidators.length > 0
          ? topValidators.reduce((sum, v) => sum + v.commission, 0) / topValidators.length
          : 0;

        setValidatorInfo({
          validators: topValidators,
          totalStake,
          avgCommission,
        });
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to fetch top validators:', err);
        setIsLoading(false);
      }
    };

    fetchValidators();
    const interval = setInterval(fetchValidators, 60000); // Every 60s
    return () => clearInterval(interval);
  }, [limit]);

  return { validatorInfo, isLoading };
}

// TPS History for sparkline
export interface TPSDataPoint {
  timestamp: number;
  tps: number;
}

export function useTPSHistory(maxPoints: number = 60) {
  const [history, setHistory] = useState<TPSDataPoint[]>([]);

  const addDataPoint = useCallback((tps: number) => {
    setHistory(prev => {
      const newPoint = { timestamp: Date.now(), tps };
      return [...prev, newPoint].slice(-maxPoints);
    });
  }, [maxPoints]);

  return { history, addDataPoint };
}

// Validator Locations for world map
export interface ValidatorLocation {
  identity: string;      // Identity pubkey (used in leader schedule)
  voteAccount: string;   // Vote account pubkey
  name: string | null;
  lat: number;
  lng: number;
  city: string;
  country: string;
  stake: number;
  version: string;
}

export interface ValidatorLocationsInfo {
  locations: ValidatorLocation[];
  byCountry: Map<string, number>;
  byContinent: Map<string, number>;
}

// Map country names to codes for continent mapping
function getCountryCode(countryName: string): string {
  const countryMap: Record<string, string> = {
    'United States': 'US', 'USA': 'US', 'Canada': 'CA', 'Mexico': 'MX',
    'Germany': 'DE', 'Netherlands': 'NL', 'United Kingdom': 'GB', 'UK': 'GB',
    'France': 'FR', 'Poland': 'PL', 'Finland': 'FI', 'Ireland': 'IE',
    'Switzerland': 'CH', 'Austria': 'AT', 'Sweden': 'SE', 'Spain': 'ES',
    'Italy': 'IT', 'Belgium': 'BE', 'Norway': 'NO', 'Denmark': 'DK',
    'Portugal': 'PT', 'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Romania': 'RO',
    'Ukraine': 'UA', 'Russia': 'RU', 'Lithuania': 'LT', 'Latvia': 'LV',
    'Estonia': 'EE', 'Bulgaria': 'BG', 'Hungary': 'HU', 'Slovakia': 'SK',
    'Japan': 'JP', 'Singapore': 'SG', 'South Korea': 'KR', 'Korea': 'KR',
    'Hong Kong': 'HK', 'India': 'IN', 'Taiwan': 'TW', 'China': 'CN',
    'Thailand': 'TH', 'Vietnam': 'VN', 'Malaysia': 'MY', 'Indonesia': 'ID',
    'Philippines': 'PH', 'Israel': 'IL', 'UAE': 'AE', 'United Arab Emirates': 'AE',
    'Australia': 'AU', 'New Zealand': 'NZ',
    'Brazil': 'BR', 'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO',
    'South Africa': 'ZA', 'Nigeria': 'NG', 'Kenya': 'KE', 'Egypt': 'EG',
  };
  return countryMap[countryName] || '';
}

// Fetch validator locations from Stakewiz API
export function useValidatorLocations() {
  const [locations, setLocations] = useState<ValidatorLocationsInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Stakewiz provides validator geo data
        const response = await fetch('https://api.stakewiz.com/validators');
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        const locs: ValidatorLocation[] = [];
        const byCountry = new Map<string, number>();
        const byContinent = new Map<string, number>();

        // Continent mapping - expanded
        const continentMap: Record<string, string> = {
          // North America
          'US': 'North America', 'CA': 'North America', 'MX': 'North America',
          // Europe
          'DE': 'Europe', 'NL': 'Europe', 'GB': 'Europe', 'FR': 'Europe', 'PL': 'Europe',
          'FI': 'Europe', 'IE': 'Europe', 'CH': 'Europe', 'AT': 'Europe', 'SE': 'Europe',
          'ES': 'Europe', 'IT': 'Europe', 'BE': 'Europe', 'NO': 'Europe', 'DK': 'Europe',
          'PT': 'Europe', 'CZ': 'Europe', 'RO': 'Europe', 'UA': 'Europe', 'RU': 'Europe',
          'LT': 'Europe', 'LV': 'Europe', 'EE': 'Europe', 'BG': 'Europe', 'HU': 'Europe', 'SK': 'Europe',
          // Asia
          'JP': 'Asia', 'SG': 'Asia', 'KR': 'Asia', 'HK': 'Asia', 'IN': 'Asia', 'TW': 'Asia',
          'CN': 'Asia', 'TH': 'Asia', 'VN': 'Asia', 'MY': 'Asia', 'ID': 'Asia', 'PH': 'Asia',
          'IL': 'Asia', 'AE': 'Asia',
          // Oceania
          'AU': 'Oceania', 'NZ': 'Oceania',
          // South America
          'BR': 'South America', 'AR': 'South America', 'CL': 'South America', 'CO': 'South America',
          // Africa
          'ZA': 'Africa', 'NG': 'Africa', 'KE': 'Africa', 'EG': 'Africa',
        };

        for (const v of data) {
          // API returns ip_latitude/ip_longitude, not latitude/longitude
          const lat = parseFloat(v.ip_latitude);
          const lng = parseFloat(v.ip_longitude);
          if (!isNaN(lat) && !isNaN(lng) && v.identity) {
            locs.push({
              identity: v.identity,           // Identity key (used in leader schedule)
              voteAccount: v.vote_identity || v.identity,  // Vote account
              name: v.name || null,
              lat,
              lng,
              city: v.ip_city || 'Unknown',
              country: v.ip_country || 'Unknown',
              stake: v.activated_stake ? v.activated_stake / 1e9 : 0,
              version: v.version || 'unknown',
            });

            // Count by country
            const country = v.ip_country || 'Unknown';
            byCountry.set(country, (byCountry.get(country) || 0) + 1);

            // Count by continent - extract country code from ASN or infer from country name
            const countryCode = getCountryCode(v.ip_country);
            const continent = continentMap[countryCode] || 'Other';
            byContinent.set(continent, (byContinent.get(continent) || 0) + 1);
          }
        }

        setLocations({ locations: locs, byCountry, byContinent });
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to fetch validator locations:', err);
        setIsLoading(false);
      }
    };

    fetchLocations();
  }, []);

  return { locations, isLoading };
}

// ============================================
// HISTORICAL DATA STORAGE (IndexedDB)
// ============================================

export interface HistoricalBlockData {
  slot: number;
  timestamp: number;
  txCount: number;
  successCount: number;
  failedCount: number;
  totalFees: number;
  priorityFees: number;
  jitoTips: number;
  totalCU: number;
  cuPercent: number;
  categories: Record<string, number>; // tx count by category
}

export interface HistoricalStats {
  blocks: number;
  transactions: number;
  successRate: number;
  avgTxPerBlock: number;
  totalFees: number;
  avgFeePerTx: number;
  priorityFees: number;
  jitoTips: number;
  avgCuPercent: number;
  categoryBreakdown: Record<string, number>;
  tpsHistory: { timestamp: number; tps: number }[];
  feeHistory: { timestamp: number; avgFee: number }[];
}

const DB_NAME = 'solana-dashboard-history';
const DB_VERSION = 1;
const STORE_NAME = 'blocks';

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'slot' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

export async function storeBlockData(block: SlotData): Promise<void> {
  if (!block.transactions || block.transactions.length === 0) return;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Calculate aggregates
    const successCount = block.transactions.filter(t => t.success).length;
    const baseFees = block.transactions.reduce((sum, t) => sum + (t.numSignatures || 1) * 5000, 0);
    const totalFees = block.transactions.reduce((sum, t) => sum + t.fee, 0);
    const priorityFees = totalFees - baseFees;
    const jitoTips = block.transactions.reduce((sum, t) => sum + t.jitoTip, 0);
    const totalCU = block.transactions.reduce((sum, t) => sum + t.computeUnits, 0);

    // Count by category
    const categories: Record<string, number> = {};
    for (const t of block.transactions) {
      const cat = getTxCategory(t.programs);
      categories[cat] = (categories[cat] || 0) + 1;
    }

    const data: HistoricalBlockData = {
      slot: block.slot,
      timestamp: block.blockTime ? block.blockTime * 1000 : Date.now(),
      txCount: block.transactions.length,
      successCount,
      failedCount: block.transactions.length - successCount,
      totalFees,
      priorityFees,
      jitoTips,
      totalCU,
      cuPercent: (totalCU / SOLANA_LIMITS.BLOCK_CU_LIMIT) * 100,
      categories,
    };

    store.put(data);

    // Cleanup old data (keep last 48 hours)
    const cutoff = Date.now() - (48 * 60 * 60 * 1000);
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(cutoff);
    index.openCursor(range).onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch (err) {
    console.warn('Failed to store block data:', err);
  }
}

export async function getHistoricalStats(hoursBack: number = 24): Promise<HistoricalStats | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');

    const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);
    const range = IDBKeyRange.lowerBound(cutoff);

    return new Promise((resolve) => {
      const blocks: HistoricalBlockData[] = [];

      index.openCursor(range).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          blocks.push(cursor.value);
          cursor.continue();
        } else {
          // Calculate stats
          if (blocks.length === 0) {
            resolve(null);
            return;
          }

          const totalTx = blocks.reduce((s, b) => s + b.txCount, 0);
          const successTx = blocks.reduce((s, b) => s + b.successCount, 0);
          const totalFees = blocks.reduce((s, b) => s + b.totalFees, 0);
          const priorityFees = blocks.reduce((s, b) => s + b.priorityFees, 0);
          const jitoTips = blocks.reduce((s, b) => s + b.jitoTips, 0);
          const avgCu = blocks.reduce((s, b) => s + b.cuPercent, 0) / blocks.length;

          // Category breakdown
          const categoryBreakdown: Record<string, number> = {};
          for (const b of blocks) {
            for (const [cat, count] of Object.entries(b.categories)) {
              categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + count;
            }
          }

          // TPS history (bucket by 5 minutes)
          const tpsBuckets = new Map<number, { txs: number; blocks: number }>();
          const feeBuckets = new Map<number, { fees: number; txs: number }>();
          const bucketSize = 5 * 60 * 1000; // 5 minutes

          for (const b of blocks) {
            const bucket = Math.floor(b.timestamp / bucketSize) * bucketSize;
            const tpsBucket = tpsBuckets.get(bucket) || { txs: 0, blocks: 0 };
            tpsBucket.txs += b.txCount;
            tpsBucket.blocks += 1;
            tpsBuckets.set(bucket, tpsBucket);

            const feeBucket = feeBuckets.get(bucket) || { fees: 0, txs: 0 };
            feeBucket.fees += b.totalFees;
            feeBucket.txs += b.txCount;
            feeBuckets.set(bucket, feeBucket);
          }

          const tpsHistory = Array.from(tpsBuckets.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([timestamp, data]) => ({
              timestamp,
              tps: Math.round(data.txs / (data.blocks * 0.4)), // ~0.4s per block
            }));

          const feeHistory = Array.from(feeBuckets.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([timestamp, data]) => ({
              timestamp,
              avgFee: data.txs > 0 ? Math.round(data.fees / data.txs) : 0,
            }));

          resolve({
            blocks: blocks.length,
            transactions: totalTx,
            successRate: totalTx > 0 ? (successTx / totalTx) * 100 : 0,
            avgTxPerBlock: totalTx / blocks.length,
            totalFees,
            avgFeePerTx: totalTx > 0 ? totalFees / totalTx : 0,
            priorityFees,
            jitoTips,
            avgCuPercent: avgCu,
            categoryBreakdown,
            tpsHistory,
            feeHistory,
          });
        }
      };
    });
  } catch (err) {
    console.warn('Failed to get historical stats:', err);
    return null;
  }
}

export function useHistoricalStats(hoursBack: number = 24) {
  const [stats, setStats] = useState<HistoricalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getHistoricalStats(hoursBack);
      setStats(data);
      setIsLoading(false);
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [hoursBack]);

  return { stats, isLoading };
}

// ============================================
// SOLANA COMPASS API - Real Historical Data
// ============================================

export interface EpochNetworkStats {
  epoch: number;
  totalSlots: number;
  skippedSlots: number;
  skipRate: number;
  avgBlockTime: number;
  medianBlockTime: number;
  totalTransactions: number;
  voteTransactions: number;
  nonVoteTransactions: number;
  successfulTx: number;
  failedTx: number;
  successRate: number;
  totalCU: number;
  avgCUPerBlock: number;
  totalFees: number; // lamports
  baseFees: number;
  priorityFees: number;
  jitoTips: number;
  jitoTransactions: number;
  avgJitoTip: number;
  medianJitoTip: number;
  avgFeeRatio: number; // priority/base ratio
  packedSlots: number;
  updatedAt: string;
}

export interface NetworkHistoryData {
  currentEpoch: EpochNetworkStats | null;
  previousEpochs: EpochNetworkStats[];
  isLoading: boolean;
  error: string | null;
}

async function fetchEpochStats(epoch: number): Promise<EpochNetworkStats | null> {
  try {
    const response = await fetch(`https://solanacompass.com/api/epoch-performance/${epoch}?limit=1`);
    if (!response.ok) return null;

    const json = await response.json();
    const data = json.data;

    // Find the aggregate entry (leader: null) or use first entry
    const aggregate = data.find((d: { leader: string | null }) => d.leader === null) || data[0];
    if (!aggregate) return null;

    // The API returns per-block averages, we need to calculate totals
    const numSlots = aggregate.num_slots || 1;

    return {
      epoch,
      totalSlots: numSlots,
      skippedSlots: aggregate.skipped || 0,
      skipRate: aggregate.skipped_percent || 0,
      avgBlockTime: aggregate.average_block_time || 400,
      medianBlockTime: aggregate.median_block_time || 400,
      totalTransactions: (aggregate.txns || 0) * numSlots,
      voteTransactions: (aggregate.vote_txns || 0) * numSlots,
      nonVoteTransactions: (aggregate.non_vote_txns || 0) * numSlots,
      successfulTx: (aggregate.success || 0) * numSlots,
      failedTx: (aggregate.failed || 0) * numSlots,
      successRate: aggregate.txns > 0 ? ((aggregate.success || 0) / aggregate.txns) * 100 : 0,
      totalCU: (aggregate.cu || 0) * numSlots,
      avgCUPerBlock: aggregate.cu || 0,
      totalFees: aggregate.all_fees || 0,
      baseFees: aggregate.base_fees || 0,
      priorityFees: aggregate.priority_fees || 0,
      jitoTips: aggregate.jito_total || 0,
      jitoTransactions: aggregate.jito_transactions || 0,
      avgJitoTip: aggregate.jito_avg_tip || 0,
      medianJitoTip: aggregate.jito_med_tip || 0,
      avgFeeRatio: aggregate.avg_fee_ratio || 0,
      packedSlots: aggregate.packed_slots || numSlots,
      updatedAt: aggregate.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`Failed to fetch epoch ${epoch} stats:`, err);
    return null;
  }
}

export function useNetworkHistory(epochsBack: number = 3) {
  const [data, setData] = useState<NetworkHistoryData>({
    currentEpoch: null,
    previousEpochs: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Get current epoch from RPC
        const connection = getConnection();
        const epochInfo = await connection.getEpochInfo();
        const currentEpochNum = epochInfo.epoch;

        // Fetch current and previous epochs
        const epochs = Array.from({ length: epochsBack + 1 }, (_, i) => currentEpochNum - i);
        const results = await Promise.all(epochs.map(e => fetchEpochStats(e)));

        const validResults = results.filter((r): r is EpochNetworkStats => r !== null);

        setData({
          currentEpoch: validResults[0] || null,
          previousEpochs: validResults.slice(1),
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.warn('Failed to fetch network history:', err);
        setData(prev => ({ ...prev, isLoading: false, error: 'Failed to fetch historical data' }));
      }
    };

    fetchHistory();
    // Refresh every 2 minutes
    const interval = setInterval(fetchHistory, 120000);
    return () => clearInterval(interval);
  }, [epochsBack]);

  return data;
}
