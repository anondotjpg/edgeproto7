import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const INVOICE_SELECT = `
  id,
  provider,
  user_id,
  plan_key,
  chain,
  asset,
  deposit_address,
  relay_deposit_address,
  relay_request_id,
  relay_status,
  relay_trade_type,
  expected_amount_display,
  expected_destination_amount_display,
  quoted_destination_amount_display,
  edge_min_destination_amount_display,
  received_destination_amount_display,
  destination_address,
  status,
  expires_at,
  created_at,
  updated_at,
  paid_at,
  tx_hash,
  confirmations,
  credited_account_id,
  credited_account_ids,
  relay_in_tx_hashes,
  relay_out_tx_hashes,
  promo_code,
  subtotal_amount_cents,
  discount_amount_cents,
  final_amount_cents,
  account_quantity
`;

async function getUserIdFromPrivyId(privyUserId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("privy_user_id", privyUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id as string | undefined;
}

async function expireStalePendingRelayInvoices(userId: string) {
  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("crypto_deposit_invoices")
    .update({
      status: "expired",
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .eq("provider", "relay")
    .eq("status", "pending")
    .lt("expires_at", nowIso);

  if (error) {
    throw error;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const privyUserId = url.searchParams.get("privyUserId")?.trim();

    if (!privyUserId) {
      return NextResponse.json(
        { error: "Missing Privy user ID." },
        { status: 400 },
      );
    }

    const userId = await getUserIdFromPrivyId(privyUserId);

    if (!userId) {
      return NextResponse.json({ deposits: [] });
    }

    await expireStalePendingRelayInvoices(userId);

    const { data, error } = await supabaseAdmin
      .from("crypto_deposit_invoices")
      .select(INVOICE_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({ deposits: data ?? [] });
  } catch (error) {
    console.error("[crypto-deposits/mine] error", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load deposits.",
      },
      { status: 500 },
    );
  }
}