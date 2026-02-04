import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Helius RPC endpoint for real mainnet data
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=REDACTED_HELIUS_KEY_OLD';

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
}

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

              totalFees += fee;
              if (success) successCount++;
              totalCU += cu;

              transactions.push({
                signature: sig,
                success,
                fee,
                computeUnits: cu,
                slot: s,
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
            transactions: transactions.slice(0, 10), // Keep only first 10 per block
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
    const interval = setInterval(fetchBlocks, 5000);
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
