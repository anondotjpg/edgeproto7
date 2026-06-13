import { formatUnits, parseUnits } from "viem";
import type { PlanKey } from "@/lib/plans";

export type DepositChain = "solana";
export type DepositAsset = "SOL";

export const CHAIN_CONFIG: Record<
  DepositChain,
  {
    asset: DepositAsset;
    decimals: number;
    minConfirmations: number;
    depositAddressEnv: string;
  }
> = {
  solana: {
    asset: "SOL",
    decimals: 9,
    minConfirmations: 1,
    depositAddressEnv: "SOL_DEPOSIT_ADDRESS",
  },
};

export const PLAN_CRYPTO_AMOUNTS: Record<
  PlanKey,
  Record<DepositChain, string>
> = {
  "1000": {
    solana: "0.01",
  },
  "2000": {
    solana: "0.01",
  },
  "5000": {
    solana: "0.01",
  },
  "10000": {
    solana: "0.01",
  },
};

export function getDepositAddress(chain: DepositChain) {
  const envName = CHAIN_CONFIG[chain].depositAddressEnv;
  const address = process.env[envName];

  if (!address) {
    throw new Error(`Missing ${envName}`);
  }

  return address;
}

export function makeInvoiceAmountAtomic({
  planKey,
  chain,
}: {
  planKey: PlanKey;
  chain: DepositChain;
}) {
  const baseAmount = PLAN_CRYPTO_AMOUNTS[planKey]?.[chain];

  if (!baseAmount) {
    throw new Error(`Missing crypto amount for ${planKey} on ${chain}.`);
  }

  const decimals = CHAIN_CONFIG[chain].decimals;

  return parseUnits(baseAmount, decimals);
}

export function atomicToDisplay({
  chain,
  atomic,
}: {
  chain: DepositChain;
  atomic: bigint;
}) {
  return formatUnits(atomic, CHAIN_CONFIG[chain].decimals);
}

export function hasEnoughConfirmations({
  chain,
  confirmations,
}: {
  chain: DepositChain;
  confirmations: number;
}) {
  return confirmations >= CHAIN_CONFIG[chain].minConfirmations;
}