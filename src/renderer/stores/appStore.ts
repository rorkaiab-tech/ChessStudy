import { create } from 'zustand';

export const useAppStore = create((set) => ({
  theme: 'dark',
  sidebarOpen: true,
  setTheme: (t: string) => set({ theme: t }),
  toggleSidebar: () => set((s: any) => ({ sidebarOpen: !s.sidebarOpen })),
}));
