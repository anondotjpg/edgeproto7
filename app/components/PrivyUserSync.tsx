"use client";

import { getAccessToken, usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";

const RETRY_DELAYS_MS = [0, 1000, 3000] as const;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function PrivyUserSync() {
  const { ready, authenticated, user } = usePrivy();
  const lastSyncedSignatureRef = useRef<string | null>(null);

  const privyUserId = user?.id ?? null;
  const email = user?.email?.address ?? null;
  const walletAddress =
    user?.wallet?.address ??
    user?.linkedAccounts.find((account) => account.type === "wallet")
      ?.address ??
    null;

  useEffect(() => {
    if (!ready || !authenticated || !privyUserId) {
      if (ready && !authenticated) {
        lastSyncedSignatureRef.current = null;
      }

      return;
    }

    const signature = [
      privyUserId,
      email ?? "",
      walletAddress ?? "",
    ].join("|");

    if (lastSyncedSignatureRef.current === signature) {
      return;
    }

    let cancelled = false;

    async function syncUser() {
      for (const delay of RETRY_DELAYS_MS) {
        if (cancelled) return;

        if (delay > 0) {
          await sleep(delay);
        }

        try {
          const accessToken = await getAccessToken();

          if (!accessToken) {
            throw new Error("Privy access token is unavailable.");
          }

          const response = await fetch("/api/users/sync", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              walletAddress,
            }),
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;

            throw new Error(data?.error ?? "Unable to sync user.");
          }

          if (!cancelled) {
            lastSyncedSignatureRef.current = signature;
          }

          return;
        } catch (error) {
          if (delay === RETRY_DELAYS_MS.at(-1)) {
            console.error("[privy-user-sync] failed", error);
          }
        }
      }
    }

    void syncUser();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    authenticated,
    privyUserId,
    email,
    walletAddress,
  ]);

  return null;
}