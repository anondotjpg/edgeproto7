import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRelayIntentStatus } from "@/lib/relay";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

function mapRelayStatusToInvoiceStatus(status: string) {
  if (status === "success") return "paid";
  if (status === "refund") return "refunded";
  if (status === "failure") return "failed";

  if (
    status === "depositing" ||
    status === "pending" ||
    status === "submitted" ||
    status === "delayed"
  ) {
    return "processing";
  }

  return "pending";
}

async function handleCheckCryptoDeposits(req: Request) {
  console.log("[check-crypto-deposits] hit", {
    at: new Date().toISOString(),
    method: req.method,
    hasAuthHeader: Boolean(req.headers.get("authorization")),
    hasCronSecretEnv: Boolean(process.env.CRON_SECRET),
    hasRelayApiKey: Boolean(process.env.RELAY_API_KEY),
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
      expires_at
      `,
    )
    .eq("provider", "relay")
    .in("status", ["pending", "processing"])
    .not("relay_request_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.log("[check-crypto-deposits] invoice query error", error.message);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: {
    invoiceId: string;
    status: string;
    relayStatus?: string;
    accountId?: string | null;
    error?: string;
  }[] = [];

  for (const invoice of invoices ?? []) {
    try {
      const relayRequestId = String(invoice.relay_request_id || "");

      if (!relayRequestId) {
        results.push({
          invoiceId: invoice.id,
          status: "missing_relay_request_id",
        });

        continue;
      }

      const relayStatus = await getRelayIntentStatus(relayRequestId);

      const nextInvoiceStatus = mapRelayStatusToInvoiceStatus(
        relayStatus.status,
      );

      const inTxHashes = relayStatus.inTxHashes ?? [];
      const outTxHashes = relayStatus.txHashes ?? [];

      if (relayStatus.status === "success") {
        const { data: accountId, error: rpcError } = await supabaseAdmin.rpc(
          "mark_relay_crypto_invoice_paid",
          {
            p_invoice_id: invoice.id,
            p_relay_status: relayStatus.status,
            p_in_tx_hashes: inTxHashes,
            p_out_tx_hashes: outTxHashes,
          },
        );

        if (rpcError) {
          results.push({
            invoiceId: invoice.id,
            status: "credit_failed",
            relayStatus: relayStatus.status,
            error: rpcError.message,
          });

          continue;
        }

        results.push({
          invoiceId: invoice.id,
          status: "paid",
          relayStatus: relayStatus.status,
          accountId,
        });

        continue;
      }

      if (
        new Date(invoice.expires_at) < now &&
        relayStatus.status === "waiting"
      ) {
        await supabaseAdmin
          .from("crypto_deposit_invoices")
          .update({
            status: "expired",
            relay_status: relayStatus.status,
            relay_in_tx_hashes: inTxHashes,
            relay_out_tx_hashes: outTxHashes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.id)
          .in("status", ["pending", "processing"]);

        results.push({
          invoiceId: invoice.id,
          status: "expired",
          relayStatus: relayStatus.status,
        });

        continue;
      }

      const hasSubmittedTx =
        relayStatus.status === "pending" ||
        relayStatus.status === "submitted";

      await supabaseAdmin
        .from("crypto_deposit_invoices")
        .update({
          status: nextInvoiceStatus,
          relay_status: relayStatus.status,
          relay_in_tx_hashes: inTxHashes,
          relay_out_tx_hashes: outTxHashes,
          tx_hash: inTxHashes[0] ?? outTxHashes[0] ?? null,
          confirmations: hasSubmittedTx ? 1 : 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)
        .in("status", ["pending", "processing"]);

      results.push({
        invoiceId: invoice.id,
        status: nextInvoiceStatus,
        relayStatus: relayStatus.status,
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
    checked: invoices?.length ?? 0,
    results,
  });

  return NextResponse.json({
    ok: true,
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