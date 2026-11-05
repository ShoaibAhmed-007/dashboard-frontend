import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatbotUiState {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

// Shared across every component that calls useChatConversations() (the
// Dashboard AI sidebar panel and the main chat page are separate components) so
// switching conversations in one place is reflected everywhere immediately.
export const useChatbotUiStore = create<ChatbotUiState>()(
  persist(
    (set) => ({
      activeConversationId: null,
      setActiveConversationId: (id) => set({ activeConversationId: id }),
    }),
    {
      name: "chatbot-ui-storage",
      partialize: (s) => ({ activeConversationId: s.activeConversationId }),
    }
  )
);
