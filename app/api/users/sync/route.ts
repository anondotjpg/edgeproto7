import { NextResponse } from "next/server";
import { privyServer } from "@/lib/privy-server";
import { upsertAppUser } from "@/lib/users";

export const runtime = "nodejs";

type SyncUserBody = {
  email?: string | null;
  walletAddress?: string | null;
};

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  return token || null;
}

export async function POST(req: Request) {
  const accessToken = getBearerToken(req);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Privy access token." },
      { status: 401 },
    );
  }

  let privyUserId: string;

  try {
    const verifiedToken =
      await privyServer.utils().auth().verifyAuthToken(accessToken);

    // This ID comes from the verified Privy JWT, never from request JSON.
    privyUserId = verifiedToken.userId;
  } catch (error) {
    console.error("[users/sync] invalid Privy token", error);

    return NextResponse.json(
      { error: "Invalid or expired Privy access token." },
      { status: 401 },
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SyncUserBody;

    const userId = await upsertAppUser({
      privyUserId,
      email: typeof body.email === "string" ? body.email : null,
      walletAddress:
        typeof body.walletAddress === "string" ? body.walletAddress : null,
    });

    return NextResponse.json({
      ok: true,
      userId,
    });
  } catch (error) {
    console.error("[users/sync] database error", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to sync user.",
      },
      { status: 500 },
    );
  }
}