import type { ChannelMember, ChatChannel } from "@/types/chat";

export type { ChannelMember };

/**
 * @deprecated Use {@link ChatChannel} from `@/types/chat` — DMs and channels
 * are one shape server-side, discriminated on `kind`. Kept as an alias so the
 * existing channel components keep compiling during the Chat migration.
 */
export type Channel = ChatChannel;
