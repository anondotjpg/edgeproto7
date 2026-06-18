import { NextResponse } from "next/server";
import {
  DESTINATION_CONFIG,
  usdcAtomicToDisplay,
} from "@/lib/crypto-deposits";
import { getRelayIntentStatus } from "@/lib/relay";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type JsonRecord = Record<string, unknown>;

type RelayInvoiceRow = {
  id: string;
  provider: string | null;
  status: string | null;
  relay_request_id: string | null;
  relay_deposit_address: string | null;
  deposit_address: string | null;
  expires_at: string | null;

  edge_min_destination_amount_atomic: string | null;
  expected_destination_amount_atomic: string | null;
};

type CronResult = {
  invoiceId: string;
  status: string;
  relayStatus?: string;
  accountId?: string | null;
  receivedDestinationAmountAtomic?: string | null;
  edgeMinDestinationAmountAtomic?: string | null;
  error?: string;
};

const RELAY_API_BASE = process.env.RELAY_API_BASE ?? "https://api.relay.link";
const RELAY_API_KEY = process.env.RELAY_API_KEY ?? null;

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function relayHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (RELAY_API_KEY) {
    headers["x-api-key"] = RELAY_API_KEY;
  }

  return headers;
}

async function readRelayJson(response: Response): Promise<unknown> {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Relay returned non-JSON response. Status: ${response.status}. ${text.slice(
        0,
        160,
      )}`,
    );
  }
}

function getRelayErrorMessage(data: unknown, fallback: string) {
  if (!isRecord(data)) return fallback;

  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;

  const error = data.error;

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

function normalizeRelayStatus(status: string | null | undefined) {
  if (status === "refunded") return "refund";
  return status ?? "waiting";
}

function mapRelayStatusToInvoiceStatus(status: string) {
  const normalized = normalizeRelayStatus(status);

  if (normalized === "success") return "paid";
  if (normalized === "refund") return "refunded";
  if (normalized === "failure") return "failed";

  if (
    normalized === "depositing" ||
    normalized === "pending" ||
    normalized === "submitted" ||
    normalized === "delayed"
  ) {
    return "processing";
  }

  return "pending";
}

function isExpired(expiresAt: string | null, now: Date) {
  if (!expiresAt) return false;

  const expiresAtMs = new Date(expiresAt).getTime();

  if (!Number.isFinite(expiresAtMs)) return false;

  return expiresAtMs < now.getTime();
}

async function getRelayRequestsByDepositAddress(depositAddress: string) {
  const url = new URL(`${RELAY_API_BASE}/requests/v2`);

  url.searchParams.set("depositAddress", depositAddress);
  url.searchParams.set("includeChildRequests", "true");
  url.searchParams.set("sortBy", "updatedAt");
  url.searchParams.set("sortDirection", "desc");
  url.searchParams.set("limit", "20");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: relayHeaders(),
    cache: "no-store",
  });

  const data = await readRelayJson(response);

  if (!response.ok) {
    throw new Error(
      getRelayErrorMessage(
        data,
        `Relay requests lookup failed with status ${response.status}.`,
      ),
    );
  }

  if (!isRecord(data)) return [];

  const requests = data.requests;

  if (Array.isArray(requests)) {
    return requests.filter(isRecord);
  }

  if (isRecord(requests)) {
    return [requests];
  }

  return [];
}

function getBestRelayRequestStatus(requests: JsonRecord[]) {
  const success = requests.find((request) => request.status === "success");

  if (success) return "success";

  const firstStatus = readString(requests[0]?.status);

  return firstStatus;
}

function walkRecords<T>(
  value: unknown,
  visitor: (record: JsonRecord) => T | null,
): T | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = walkRecords(item, visitor);

      if (found !== null) return found;
    }

    return null;
  }

  if (!isRecord(value)) return null;

  const direct = visitor(value);

  if (direct !== null) return direct;

  for (const nested of Object.values(value)) {
    const found = walkRecords(nested, visitor);

    if (found !== null) return found;
  }

  return null;
}

function findDestinationOutTxValue(request: JsonRecord) {
  const data = isRecord(request.data) ? request.data : null;
  const outTxs = Array.isArray(data?.outTxs) ? data.outTxs : [];

  for (const tx of outTxs) {
    if (!isRecord(tx)) continue;

    const chainId = Number(tx.chainId);

    if (chainId !== DESTINATION_CONFIG.chainId) continue;

    const txData = isRecord(tx.data) ? tx.data : null;
    const value = readString(txData?.value);

    if (value) return value;
  }

  return null;
}

function findCurrencyOutAmount(request: JsonRecord) {
  return walkRecords(request, (record) => {
    const currencyOut = record.currencyOut;

    if (!isRecord(currencyOut)) return null;

    return (
      readString(currencyOut.amount) ??
      readString(currencyOut.amountAtomic) ??
      readString(currencyOut.amount_atomic) ??
      readString(currencyOut.rawAmount)
    );
  });
}

function findUsdcAmountObject(request: JsonRecord) {
  return walkRecords(request, (record) => {
    const currency = record.currency;

    if (!isRecord(currency)) return null;

    const symbol = readString(currency.symbol);

    if (symbol !== DESTINATION_CONFIG.asset) return null;

    return (
      readString(record.amount) ??
      readString(record.amountAtomic) ??
      readString(record.amount_atomic) ??
      readString(record.rawAmount)
    );
  });
}

function findReceivedDestinationAmountAtomic(requests: JsonRecord[]) {
  const successfulRequests = requests.filter(
    (request) => request.status === "success",
  );

  for (const request of successfulRequests) {
    const currencyOutAmount = findCurrencyOutAmount(request);

    if (currencyOutAmount) return currencyOutAmount;

    const usdcAmount = findUsdcAmountObject(request);

    if (usdcAmount) return usdcAmount;

    const destinationOutTxValue = findDestinationOutTxValue(request);

    if (destinationOutTxValue) return destinationOutTxValue;

    const data = isRecord(request.data) ? request.data : null;
    const price = readString(data?.price);

    if (price) return price;
  }

  return null;
}

function extractRequestHashes(requests: JsonRecord[]) {
  const inHashes: string[] = [];
  const outHashes: string[] = [];

  for (const request of requests) {
    const data = isRecord(request.data) ? request.data : null;

    const inTxs = Array.isArray(data?.inTxs) ? data.inTxs : [];
    const outTxs = Array.isArray(data?.outTxs) ? data.outTxs : [];

    for (const tx of inTxs) {
      if (!isRecord(tx)) continue;

      const hash = readString(tx.hash);

      if (hash) inHashes.push(hash);
    }

    for (const tx of outTxs) {
      if (!isRecord(tx)) continue;

      const hash = readString(tx.hash);

      if (hash) outHashes.push(hash);
    }
  }

  return {
    inTxHashes: [...new Set(inHashes)],
    outTxHashes: [...new Set(outHashes)],
  };
}

function safeBigInt(value: string | null | undefined) {
  if (!value) return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function usdcDisplayFromAtomicString(value: string) {
  try {
    return usdcAtomicToDisplay(BigInt(value));
  } catch {
    return null;
  }
}

async function handleCheckCryptoDeposits(req: Request) {
  console.log("[check-crypto-deposits] hit", {
    version: "relay-expected-output-v1",
    at: new Date().toISOString(),
    method: req.method,
    hasAuthHeader: Boolean(req.headers.get("authorization")),
    hasCronSecretEnv: Boolean(process.env.CRON_SECRET),
  });

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const { data: invoices, error } = await supabaseAdmin
    .from("crypto_deposit_invoices")
    .select(
      `
      id,
      provider,
      status,
      relay_request_id,
      relay_deposit_address,
      deposit_address,
      expires_at,
      edge_min_destination_amount_atomic,
      expected_destination_amount_atomic
      `,
    )
    .eq("provider", "relay")
    .in("status", ["pending", "processing"])
    .not("relay_request_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(20)
    .returns<RelayInvoiceRow[]>();

  if (error) {
    console.log("[check-crypto-deposits] invoice query error", error.message);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: CronResult[] = [];

  for (const invoice of invoices ?? []) {
    try {
      const relayRequestId = invoice.relay_request_id?.trim();
      const depositAddress =
        invoice.relay_deposit_address?.trim() ??
        invoice.deposit_address?.trim() ??
        null;

      if (!relayRequestId) {
        results.push({
          invoiceId: invoice.id,
          status: "missing_relay_request_id",
        });

        continue;
      }

      const relayStatus = await getRelayIntentStatus(relayRequestId);

      const relayRequests = depositAddress
        ? await getRelayRequestsByDepositAddress(depositAddress)
        : [];

      const requestStatus = getBestRelayRequestStatus(relayRequests);
      const effectiveRelayStatus = normalizeRelayStatus(
        requestStatus ?? relayStatus.status,
      );

      const requestHashes = extractRequestHashes(relayRequests);

      const inTxHashes =
        requestHashes.inTxHashes.length > 0
          ? requestHashes.inTxHashes
          : relayStatus.inTxHashes ?? [];

      const outTxHashes =
        requestHashes.outTxHashes.length > 0
          ? requestHashes.outTxHashes
          : relayStatus.txHashes ?? [];

      const nextInvoiceStatus =
        mapRelayStatusToInvoiceStatus(effectiveRelayStatus);

      if (effectiveRelayStatus === "success") {
        const receivedDestinationAmountAtomic =
          findReceivedDestinationAmountAtomic(relayRequests);

        const minDestinationAmountAtomic =
          invoice.edge_min_destination_amount_atomic ??
          invoice.expected_destination_amount_atomic ??
          null;

        const receivedAtomic = safeBigInt(receivedDestinationAmountAtomic);
        const minAtomic = safeBigInt(minDestinationAmountAtomic);

        if (!receivedDestinationAmountAtomic || receivedAtomic === null) {
          const { error: updateError } = await supabaseAdmin
            .from("crypto_deposit_invoices")
            .update({
              status: "processing",
              relay_status: effectiveRelayStatus,
              relay_in_tx_hashes: inTxHashes,
              relay_out_tx_hashes: outTxHashes,
              tx_hash: inTxHashes[0] ?? outTxHashes[0] ?? null,
              confirmations: 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.id)
            .in("status", ["pending", "processing"]);

          results.push({
            invoiceId: invoice.id,
            status: updateError
              ? "amount_unknown_update_failed"
              : "success_amount_unknown",
            relayStatus: effectiveRelayStatus,
            error: updateError?.message,
          });

          continue;
        }

        if (!minDestinationAmountAtomic || minAtomic === null) {
          const { error: updateError } = await supabaseAdmin
            .from("crypto_deposit_invoices")
            .update({
              status: "processing",
              relay_status: effectiveRelayStatus,
              received_destination_amount_atomic:
                receivedDestinationAmountAtomic,
              received_destination_amount_display: usdcDisplayFromAtomicString(
                receivedDestinationAmountAtomic,
              ),
              relay_in_tx_hashes: inTxHashes,
              relay_out_tx_hashes: outTxHashes,
              tx_hash: inTxHashes[0] ?? outTxHashes[0] ?? null,
              confirmations: 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.id)
            .in("status", ["pending", "processing"]);

          results.push({
            invoiceId: invoice.id,
            status: updateError
              ? "min_unknown_update_failed"
              : "success_min_unknown",
            relayStatus: effectiveRelayStatus,
            receivedDestinationAmountAtomic,
            error: updateError?.message,
          });

          continue;
        }

        if (receivedAtomic < minAtomic) {
          const { error: updateError } = await supabaseAdmin
            .from("crypto_deposit_invoices")
            .update({
              status: "underpaid",
              relay_status: effectiveRelayStatus,
              received_destination_amount_atomic:
                receivedDestinationAmountAtomic,
              received_destination_amount_display: usdcDisplayFromAtomicString(
                receivedDestinationAmountAtomic,
              ),
              relay_in_tx_hashes: inTxHashes,
              relay_out_tx_hashes: outTxHashes,
              tx_hash: inTxHashes[0] ?? outTxHashes[0] ?? null,
              confirmations: 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.id)
            .in("status", ["pending", "processing"]);

          results.push({
            invoiceId: invoice.id,
            status: updateError ? "underpaid_update_failed" : "underpaid",
            relayStatus: effectiveRelayStatus,
            receivedDestinationAmountAtomic,
            edgeMinDestinationAmountAtomic: minDestinationAmountAtomic,
            error: updateError?.message,
          });

          continue;
        }

        const { data: accountId, error: rpcError } = await supabaseAdmin.rpc(
          "mark_relay_crypto_invoice_paid",
          {
            p_invoice_id: invoice.id,
            p_relay_status: effectiveRelayStatus,
            p_in_tx_hashes: inTxHashes,
            p_out_tx_hashes: outTxHashes,
          },
        );

        if (rpcError) {
          results.push({
            invoiceId: invoice.id,
            status: "credit_failed",
            relayStatus: effectiveRelayStatus,
            receivedDestinationAmountAtomic,
            edgeMinDestinationAmountAtomic: minDestinationAmountAtomic,
            error: rpcError.message,
          });

          continue;
        }

        const { error: receivedUpdateError } = await supabaseAdmin
          .from("crypto_deposit_invoices")
          .update({
            received_destination_amount_atomic:
              receivedDestinationAmountAtomic,
            received_destination_amount_display: usdcDisplayFromAtomicString(
              receivedDestinationAmountAtomic,
            ),
            relay_in_tx_hashes: inTxHashes,
            relay_out_tx_hashes: outTxHashes,
            tx_hash: inTxHashes[0] ?? outTxHashes[0] ?? null,
            confirmations: 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.id);

        results.push({
          invoiceId: invoice.id,
          status: receivedUpdateError ? "paid_received_update_failed" : "paid",
          relayStatus: effectiveRelayStatus,
          accountId,
          receivedDestinationAmountAtomic,
          edgeMinDestinationAmountAtomic: minDestinationAmountAtomic,
          error: receivedUpdateError?.message,
        });

        continue;
      }

      if (
        isExpired(invoice.expires_at, now) &&
        effectiveRelayStatus === "waiting"
      ) {
        const { error: updateError } = await supabaseAdmin
          .from("crypto_deposit_invoices")
          .update({
            status: "expired",
            relay_status: effectiveRelayStatus,
            relay_in_tx_hashes: inTxHashes,
            relay_out_tx_hashes: outTxHashes,
            tx_hash: inTxHashes[0] ?? outTxHashes[0] ?? null,
            confirmations: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.id)
          .in("status", ["pending", "processing"]);

        if (updateError) {
          results.push({
            invoiceId: invoice.id,
            status: "expire_update_failed",
            relayStatus: effectiveRelayStatus,
            error: updateError.message,
          });

          continue;
        }

        results.push({
          invoiceId: invoice.id,
          status: "expired",
          relayStatus: effectiveRelayStatus,
        });

        continue;
      }

      const hasSubmittedTx =
        effectiveRelayStatus === "pending" ||
        effectiveRelayStatus === "submitted";

      const { error: updateError } = await supabaseAdmin
        .from("crypto_deposit_invoices")
        .update({
          status: nextInvoiceStatus,
          relay_status: effectiveRelayStatus,
          relay_in_tx_hashes: inTxHashes,
          relay_out_tx_hashes: outTxHashes,
          tx_hash: inTxHashes[0] ?? outTxHashes[0] ?? null,
          confirmations: hasSubmittedTx ? 1 : 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)
        .in("status", ["pending", "processing"]);

      if (updateError) {
        results.push({
          invoiceId: invoice.id,
          status: "status_update_failed",
          relayStatus: effectiveRelayStatus,
          error: updateError.message,
        });

        continue;
      }

      results.push({
        invoiceId: invoice.id,
        status: nextInvoiceStatus,
        relayStatus: effectiveRelayStatus,
      });
    } catch (error) {
      results.push({
        invoiceId: invoice.id,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  console.log("[check-crypto-deposits] done", {
    version: "relay-expected-output-v1",
    checked: invoices?.length ?? 0,
    results,
  });

  return NextResponse.json({
    ok: true,
    version: "relay-expected-output-v1",
    checked: invoices?.length ?? 0,
    results,
  });
}

export async function GET(req: Request) {
  return handleCheckCryptoDeposits(req);
}

export async function POST(req: Request) {
  return handleCheckCryptoDeposits(req);
}