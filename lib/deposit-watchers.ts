import type { DepositChain } from "@/lib/crypto-deposits";

export type DepositInvoice = {
  id: string;
  chain: DepositChain;
  asset: "SOL" | "ETH" | "BTC";
  deposit_address: string;
  expected_from_address: string | null;
  expected_amount_atomic: string;
  created_at: string;
  expires_at: string;
};

export type FoundPayment = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amountAtomic: bigint;
  confirmations: number;
};

/**
 * Relay invoices are checked through Relay status/request APIs now.
 * Do not directly scan Solana/Ethereum/Bitcoin deposit addresses here.
 */
export async function findPaymentForInvoice(
  _invoice: DepositInvoice,
): Promise<FoundPayment | null> {
  return null;
}

export function hasEnoughConfirmations({
  chain,
  confirmations,
}: {
  chain: DepositChain;
  confirmations: number;
}) {
  if (chain === "solana") return confirmations >= 1;
  if (chain === "ethereum") return confirmations >= 12;
  if (chain === "bitcoin") return confirmations >= 2;

  return false;
}