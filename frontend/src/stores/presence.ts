import { create } from 'zustand';

interface PresenceState {
  selfOnline: boolean;
  setSelfOnline: (online: boolean) => void;
}

export const usePresence = create<PresenceState>((set) => ({
  selfOnline: false,
  setSelfOnline: (online) => set({ selfOnline: online }),
}));