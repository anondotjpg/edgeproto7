import { formatUnits, parseUnits } from "viem";
import type { PlanKey } from "@/lib/plans";

export type DepositChain = "solana" | "ethereum" | "bitcoin";
export type DepositAsset = "SOL" | "ETH" | "BTC";
export type DestinationAsset = "USDC";

export type DepositStatus =
  | "pending"
  | "processing"
  | "paid"
  | "expired"
  | "refunded"
  | "failed"
  | "invalid";

export const RELAY_SOLANA_CHAIN_ID = Number(
  process.env.RELAY_SOLANA_CHAIN_ID ?? 792703809,
);

export const RELAY_BITCOIN_CHAIN_ID = Number(
  process.env.RELAY_BITCOIN_CHAIN_ID ?? 8253038,
);

export const RELAY_ETHEREUM_CHAIN_ID = Number(
  process.env.RELAY_ETHEREUM_CHAIN_ID ?? 1,
);

const EVM_NATIVE_CURRENCY = "0x0000000000000000000000000000000000000000";
const SOLANA_NATIVE_CURRENCY = "11111111111111111111111111111111";
const BITCOIN_NATIVE_CURRENCY =
  "bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqmql8k8";

export const SOLANA_USDC_MINT =
  process.env.RELAY_SOLANA_USDC_MINT ??
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const RELAY_TREASURY_SOLANA_ADDRESS =
  process.env.RELAY_TREASURY_SOLANA_ADDRESS ??
  "2i5RNHQFmiEWFqwvmRsGK6iaV6YqiW3WqzJkArRinXiQ";

export const RELAY_AUTO_REFUND_ADDRESSES: Record<DepositChain, string> = {
  ethereum: process.env.RELAY_ETH_REFUND_TO ?? EVM_NATIVE_CURRENCY,
  bitcoin: process.env.RELAY_BTC_REFUND_TO ?? BITCOIN_NATIVE_CURRENCY,
  solana: process.env.RELAY_SOL_REFUND_TO ?? SOLANA_NATIVE_CURRENCY,
};

export const CHAIN_CONFIG: Record<
  DepositChain,
  {
    asset: DepositAsset;
    decimals: number;
    relayChainId: number;
    relayOriginCurrency: string;
    relayUserAddress: string;
    label: string;
    networkLabel: string;
  }
> = {
  solana: {
    asset: "SOL",
    decimals: 9,
    relayChainId: RELAY_SOLANA_CHAIN_ID,
    relayOriginCurrency: SOLANA_NATIVE_CURRENCY,
    relayUserAddress: SOLANA_NATIVE_CURRENCY,
    label: "Solana",
    networkLabel: "Solana",
  },
  ethereum: {
    asset: "ETH",
    decimals: 18,
    relayChainId: RELAY_ETHEREUM_CHAIN_ID,
    relayOriginCurrency: EVM_NATIVE_CURRENCY,
    relayUserAddress: EVM_NATIVE_CURRENCY,
    label: "Ethereum",
    networkLabel: "Ethereum mainnet",
  },
  bitcoin: {
    asset: "BTC",
    decimals: 8,
    relayChainId: RELAY_BITCOIN_CHAIN_ID,
    relayOriginCurrency: BITCOIN_NATIVE_CURRENCY,
    relayUserAddress: BITCOIN_NATIVE_CURRENCY,
    label: "Bitcoin",
    networkLabel: "Bitcoin Network",
  },
};

export const DESTINATION_CONFIG = {
  chain: "solana",
  chainId: RELAY_SOLANA_CHAIN_ID,
  asset: "USDC" as DestinationAsset,
  decimals: 6,
  currency: SOLANA_USDC_MINT,
  recipient: RELAY_TREASURY_SOLANA_ADDRESS,
};

export function makePlanUsdcAmountAtomic(feeAmount: number) {
  return parseUnits(String(feeAmount), DESTINATION_CONFIG.decimals);
}

export function usdcAtomicToDisplay(atomic: bigint) {
  return formatUnits(atomic, DESTINATION_CONFIG.decimals);
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

export function getRelayRefundTo(chain: DepositChain) {
  return RELAY_AUTO_REFUND_ADDRESSES[chain];
}

export function getRelayUserAddress(chain: DepositChain) {
  return CHAIN_CONFIG[chain].relayUserAddress;
}

export function isDepositChain(value: unknown): value is DepositChain {
  return (
    value === "solana" || value === "ethereum" || value === "bitcoin"
  );
}

export function getDepositAsset(chain: DepositChain) {
  return CHAIN_CONFIG[chain].asset;
}

export function getPaymentMethodLabel(chain: DepositChain) {
  return CHAIN_CONFIG[chain].label;
}

export function getNetworkLabel(chain: DepositChain) {
  return CHAIN_CONFIG[chain].networkLabel;
}

export function getPlanKeyValue(planKey: PlanKey) {
  return Number(planKey);
}