"use client";

import Image from "next/image";
import { avatarColors, initials } from "@/components/accounts/avatar";

/**
 * A bank account's avatar: its uploaded logo when there is one, otherwise
 * deterministic initials. Used wherever a bank account is named — the
 * transactions table, the bank picker, balances, and the overview.
 *
 * `logoUrl` is optional because a transaction's nested `bankAccount` may omit
 * it; the initials fallback keeps those rows looking right either way.
 */
export default function BankAvatar({
  bankName,
  logoUrl,
  size = 32,
}: {
  bankName: string;
  logoUrl?: string | null;
  size?: number;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full bg-white object-contain"
        unoptimized
      />
    );
  }

  const { background, color } = avatarColors(bankName);
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: background, color }}
      className="flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
    >
      {initials(bankName)}
    </span>
  );
}
