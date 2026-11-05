import { avatarColors, initials as nameInitials } from "@/components/accounts/avatar";

/** Initials avatar for clients, which have no logo field. */
export default function NameAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const { background, color } = avatarColors(name);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{ width: size, height: size, backgroundColor: background, color }}
    >
      {nameInitials(name)}
    </span>
  );
}
