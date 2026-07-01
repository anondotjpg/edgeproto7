import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CancelDepositBody = {
  privyUserId?: string;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as CancelDepositBody;
    const privyUserId =
      typeof body.privyUserId === "string" ? body.privyUserId.trim() : null;

    if (!id) {
      return NextResponse.json(
        { error: "Missing deposit ID." },
        { status: 400 },
      );
    }

    if (!privyUserId) {
      return NextResponse.json(
        { error: "Missing Privy user ID." },
        { status: 400 },
      );
    }

    const userId = await getUserIdFromPrivyId(privyUserId);

    if (!userId) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("crypto_deposit_invoices")
      .select("id, user_id, provider, status")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (invoiceError) {
      throw invoiceError;
    }

    if (!invoice) {
      return NextResponse.json(
        { error: "Deposit not found." },
        { status: 404 },
      );
    }

    if (invoice.status === "paid") {
      return NextResponse.json(
        { error: "Paid deposits cannot be canceled." },
        { status: 409 },
      );
    }

    if (invoice.status === "processing") {
      return NextResponse.json(
        { error: "This deposit is already processing and cannot be canceled." },
        { status: 409 },
      );
    }

    if (invoice.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending deposits can be canceled." },
        { status: 409 },
      );
    }

    const nowIso = new Date().toISOString();

    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from("crypto_deposit_invoices")
      .update({
        status: "expired",
        relay_status: invoice.provider === "relay" ? "cancelled" : null,
        updated_at: nowIso,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select(INVOICE_SELECT)
      .single();

    if (updateError) {
      throw updateError;
    }

    const { error: redemptionError } = await supabaseAdmin
      .from("promo_redemptions")
      .update({ status: "expired" })
      .eq("invoice_id", id)
      .eq("status", "reserved");

    if (redemptionError) {
      throw redemptionError;
    }

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error("[crypto-deposits/cancel] error", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to cancel deposit.",
      },
      { status: 500 },
    );
  }
}