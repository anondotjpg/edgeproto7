// app/api/promo-codes/validate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validatePromoCode } from "@/lib/promo-codes";

function promoToastError({
  status,
  code,
  message,
}: {
  status: number;
  code: "PROMO_VALIDATE_FAILED" | "PROMO_INVALID";
  message: string;
}) {
  return NextResponse.json(
    {
      code,
      valid: false,
      error: message,
      message,
      toastTitle: "Promo code not applied",
      toastDescription: message,
    },
    { status },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const planKey = body.planKey as PlanKey;
    const promoCode = typeof body.promoCode === "string" ? body.promoCode : "";
    const privyUserId =
      typeof body.privyUserId === "string" ? body.privyUserId : "";

    if (!planKey || !(planKey in PLAN_CONFIG) || !privyUserId) {
      return promoToastError({
        status: 400,
        code: "PROMO_VALIDATE_FAILED",
        message: "Missing fields.",
      });
    }

    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_user_id", privyUserId)
      .maybeSingle();

    if (userError || !userRow) {
      return promoToastError({
        status: 401,
        code: "PROMO_VALIDATE_FAILED",
        message: "User not found.",
      });
    }

    const result = await validatePromoCode({
      code: promoCode,
      planKey,
      userId: userRow.id,
    });

    if (!result.valid) {
      const message = result.message ?? "Invalid promo code.";

      return NextResponse.json(
        {
          ...result,
          code: "PROMO_INVALID",
          error: message,
          message,
          toastTitle: "Promo code not applied",
          toastDescription: message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to validate promo.";

    return promoToastError({
      status: 500,
      code: "PROMO_VALIDATE_FAILED",
      message,
    });
  }
}