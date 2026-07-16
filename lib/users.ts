import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

type UpsertAppUserInput = {
  privyUserId: string;
  email?: string | null;
  walletAddress?: string | null;
};

type ExistingUserRow = {
  id: string;
};

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  return normalized || null;
}

function normalizeWalletAddress(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized || null;
}

async function updateExistingUser({
  userId,
  email,
  walletAddress,
}: {
  userId: string;
  email: string | null;
  walletAddress: string | null;
}) {
  const updates: {
    email?: string;
    wallet_address?: string;
  } = {};

  // Do not overwrite stored values with null while Privy is still
  // finishing embedded-wallet creation after login.
  if (email) {
    updates.email = email;
  }

  if (walletAddress) {
    updates.wallet_address = walletAddress;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

export async function upsertAppUser({
  privyUserId,
  email,
  walletAddress,
}: UpsertAppUserInput) {
  const normalizedPrivyUserId = privyUserId.trim();

  if (!normalizedPrivyUserId) {
    throw new Error("Missing Privy user ID.");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);

  const { data: existingUser, error: existingUserError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("privy_user_id", normalizedPrivyUserId)
    .maybeSingle<ExistingUserRow>();

  if (existingUserError) {
    throw existingUserError;
  }

  if (existingUser?.id) {
    await updateExistingUser({
      userId: existingUser.id,
      email: normalizedEmail,
      walletAddress: normalizedWalletAddress,
    });

    return existingUser.id;
  }

  const { data: insertedUser, error: insertUserError } = await supabaseAdmin
    .from("users")
    .insert({
      privy_user_id: normalizedPrivyUserId,
      email: normalizedEmail,
      wallet_address: normalizedWalletAddress,
    })
    .select("id")
    .single<ExistingUserRow>();

  if (!insertUserError && insertedUser?.id) {
    return insertedUser.id;
  }

  // Two tabs can perform the first sync at nearly the same time. The unique
  // index makes one insert win; fetch that row when the other insert conflicts.
  if (insertUserError?.code === "23505") {
    const { data: racedUser, error: racedUserError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_user_id", normalizedPrivyUserId)
      .single<ExistingUserRow>();

    if (racedUserError) {
      throw racedUserError;
    }

    await updateExistingUser({
      userId: racedUser.id,
      email: normalizedEmail,
      walletAddress: normalizedWalletAddress,
    });

    return racedUser.id;
  }

  if (insertUserError) {
    throw insertUserError;
  }

  throw new Error("Unable to create user.");
}