import { Metadata } from "next";
import ChatModulePage from "@/components/chat/ChatModulePage";

export const metadata: Metadata = {
  title: "Chat",
};

/**
 * The Chat module. Not at `/chat` — that route is Dashboard AI (the AI assistant)
 * — and not at `/messages`, which is the existing DM directory this module is
 * intended to eventually replace.
 */
export default function WorkspaceChatRoutePage() {
  return <ChatModulePage />;
}
