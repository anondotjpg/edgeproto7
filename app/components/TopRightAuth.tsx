"use client";

import Image from "next/image";
import Link from "next/link";
import Avatar from "boring-avatars";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { FiLogOut } from "react-icons/fi";
import { RiUserFill } from "react-icons/ri";

export default function TopRightAuth() {
  const { ready, authenticated, logout, user } = usePrivy();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    function handleDesktopPointerDown(event: MouseEvent) {
      if (window.innerWidth < 1024) return;
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleDesktopPointerDown);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleDesktopPointerDown);

      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openMenu = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    if (window.innerWidth >= 1024) {
      setMenuOpen(true);
    }
  };

  const scheduleClose = () => {
    if (window.innerWidth < 1024) return;

    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }

    closeTimer.current = setTimeout(() => {
      setMenuOpen(false);
    }, 120);
  };

  const goldButtonClassName =
    "relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap rounded-full border border-[#6b5520] bg-linear-to-br from-[#e0b84b] via-[#cfa13a] to-[#b68b2d] px-4 text-[13px] font-bold leading-none text-[#120d02] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-colors duration-150 hover:from-[#cfa13a] hover:via-[#bd9130] hover:to-[#9f7626]";

  const phoneGoldButtonClassName =
    "relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap rounded-full border border-[#6b5520] bg-linear-to-br from-[#e0b84b] via-[#cfa13a] to-[#b68b2d] px-4 text-[13px] font-bold leading-none text-[#120d02] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-colors duration-150 active:shadow-none";

  const avatarSeed =
    user?.id || user?.wallet?.address || user?.email?.address || "edge-user";

  const avatarColors = ["#18181b", "#52525b"];

  const accountMenuItemClassName =
    "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md pl-2 pr-3 text-left text-[13px] font-medium transition-colors hover:bg-zinc-900 active:bg-zinc-900";

  const desktopAvatarButton = (
    <button
      type="button"
      onClick={() => setMenuOpen((open) => !open)}
      className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      aria-label="Open account menu"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-[#e0b84b] via-[#cfa13a] to-[#a97924] p-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[#09090b] p-[2px]">
          <span className="flex h-[28px] w-[28px] items-center justify-center overflow-hidden rounded-full">
            <Avatar
              size={28}
              name={`Edge-${avatarSeed}`}
              variant="pixel"
              colors={avatarColors}
            />
          </span>
        </span>
      </span>
    </button>
  );

  const phoneAvatarButton = (
    <button
      type="button"
      onClick={() => setMenuOpen((open) => !open)}
      className="relative flex h-9 w-9 cursor-pointer items-center justify-start rounded-full"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      aria-label="Open account menu"
    >
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full">
        <Avatar
          size={36}
          name={`Edge-${avatarSeed}`}
          variant="pixel"
          colors={avatarColors}
        />
      </span>
    </button>
  );

  const shimmer = (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-[-35%] left-[-22%] w-[18%] skew-x-[-20deg] bg-white/35 blur-md animate-[buttonShimmer_3.4s_ease-out_infinite]"
    />
  );

  const signedInControls = (
    <>
      <Link href="/accounts" className={goldButtonClassName}>
        {shimmer}
        <span className="relative z-10">Start Challenge</span>
      </Link>

      <div
        ref={menuRef}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        className="relative flex shrink-0 items-center"
      >
        {desktopAvatarButton}

        <AnimatePresence initial={false}>
          {menuOpen ? (
            <motion.div
              key="desktop-account-menu"
              role="menu"
              initial={{ opacity: 0, y: -5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.98 }}
              transition={{
                duration: 0.16,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ transformOrigin: "top right" }}
              className="absolute right-0 top-[calc(100%+6px)] z-[220] hidden lg:block"
            >
              <div className="w-[148px] whitespace-nowrap rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl">
                <Link
                  href="/accounts"
                  onClick={() => setMenuOpen(false)}
                  className={`${accountMenuItemClassName} text-zinc-200`}
                >
                  <RiUserFill className="h-3.5 w-3.5 text-current" />
                  <span>Accounts</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className={`${accountMenuItemClassName} text-red-400`}
                >
                  <FiLogOut className="h-3.5 w-3.5 text-current" />
                  <span>Sign out</span>
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );

  const cta = !ready ? (
    <span
      aria-label="Loading account controls"
      className="inline-flex h-9 w-[126px] shrink-0 animate-pulse rounded-full bg-zinc-900"
    />
  ) : authenticated ? (
    signedInControls
  ) : (
    <Link href="/accounts" className={goldButtonClassName}>
      {shimmer}
      <span className="relative z-10">Start Challenge</span>
    </Link>
  );

  const phoneLeftControl = !ready ? (
    <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-900" />
  ) : authenticated ? (
    phoneAvatarButton
  ) : (
    <span className="h-9 w-9 shrink-0" aria-hidden="true" />
  );

  const phoneRightControl = !ready ? (
    <span className="h-9 w-[68px] shrink-0 animate-pulse rounded-full bg-zinc-900" />
  ) : authenticated ? (
    <Link href="/accounts" className={phoneGoldButtonClassName}>
      {shimmer}
      <span className="relative z-10">Start</span>
    </Link>
  ) : (
    <Link href="/accounts" className={phoneGoldButtonClassName}>
      {shimmer}
      <span className="relative z-10">Start</span>
    </Link>
  );

  return (
    <>
      {/* Actual phone screens */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 sm:hidden">
        <div className="px-4 pb-5 pt-[calc(20px+env(safe-area-inset-top))]">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="pointer-events-auto flex justify-start">
              {phoneLeftControl}
            </div>

            <Link
              href="/"
              aria-label="Edge home"
              className="pointer-events-auto flex h-[30.6px] items-center justify-center"
            >
              <Image
                src="/logo.png"
                alt="Edge"
                width={95}
                height={31}
                priority
                className="h-[30.6px] w-auto object-contain"
              />
            </Link>

            <div className="pointer-events-auto flex justify-end">
              {phoneRightControl}
            </div>
          </div>
        </div>
      </div>

      {/* Tablet layout */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 hidden sm:block md:left-[240px] lg:hidden">
        <div className="px-6 pb-6 pt-[calc(24px+env(safe-area-inset-top))]">
          <div className="flex items-center justify-end gap-3">
            <div className="pointer-events-auto flex min-w-0 items-center justify-end gap-3">
              {cta}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="pointer-events-none fixed right-6 top-4 z-50 hidden lg:block">
        <div className="pointer-events-auto flex items-center gap-3">{cta}</div>
      </div>

      <AnimatePresence initial={false}>
        {authenticated && menuOpen ? (
          <>
            <motion.button
              key="mobile-account-menu-backdrop"
              type="button"
              aria-label="Close account menu"
              onClick={() => setMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="fixed inset-0 z-[200] bg-transparent lg:hidden"
            />

            <motion.div
              key="mobile-account-menu"
              role="menu"
              initial={{ opacity: 0, y: -5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.98 }}
              transition={{
                duration: 0.16,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="fixed left-4 top-[calc(72px+env(safe-area-inset-top))] z-[210] w-[148px] origin-top-left whitespace-nowrap rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl sm:left-auto sm:right-6 sm:origin-top-right lg:hidden"
            >
              <Link
                href="/accounts"
                onClick={() => setMenuOpen(false)}
                className={`${accountMenuItemClassName} text-zinc-200`}
              >
                <RiUserFill className="h-3.5 w-3.5 text-current" />
                <span>Accounts</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className={`${accountMenuItemClassName} text-red-400`}
              >
                <FiLogOut className="h-3.5 w-3.5 text-current" />
                <span>Sign out</span>
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}