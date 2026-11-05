import { create } from "zustand";

export interface PendingEmailVerification {
  fullName: string;
  email: string;
  password: string;
}

interface VerificationState {
  pending: PendingEmailVerification | null;
  setPending: (payload: PendingEmailVerification) => void;
  clearPending: () => void;
}

export const useVerificationStore = create<VerificationState>((set) => ({
  pending: null,
  setPending: (payload) => set({ pending: payload }),
  clearPending: () => set({ pending: null }),
}));

