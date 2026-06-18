import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const INVOICE_SELECT = `
  id,
  provider,
  chain,
  asset,
  deposit_address,
  relay_deposit_address,
  relay_request_id,
  relay_status,
  relay_trade_type,
  expected_amount_display,
  expected_destination_amount_display,
  quoted_destination_amount_atomic,
  quoted_destination_amount_display,
  edge_min_destination_amount_atomic,
  edge_min_destination_amount_display,
  received_destination_amount_atomic,
  received_destination_amount_display,
  destination_address,
  status,
  expires_at,
  tx_hash,
  confirmations,
  credited_account_id,
  relay_in_tx_hashes,
  relay_out_tx_hashes,
  promo_code,
  subtotal_amount_cents,
  discount_amount_cents,
  final_amount_cents
`;

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const privyUserId = url.searchParams.get("privyUserId");

    if (!id) {
      return NextResponse.json(
        { error: "Missing invoice ID." },
        { status: 400 },
      );
    }

    if (!privyUserId) {
      return NextResponse.json(
        { error: "Missing Privy user ID." },
        { status: 400 },
      );
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_user_id", privyUserId)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!user?.id) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("crypto_deposit_invoices")
      .select(INVOICE_SELECT)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (invoiceError) {
      throw invoiceError;
    }

    if (!invoice) {
      return NextResponse.json(
        { error: "Deposit invoice not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("[crypto-deposits/read] error", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load deposit invoice.",
      },
      { status: 500 },
    );
  }
}
