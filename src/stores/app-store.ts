"use client";

import { create } from "zustand";

interface User {
  id: number;
  username: string;
  role: string;
  name?: string;
}

interface AppState {
  user: User | null;
  selectedStoreId: number | "all";
  isSuperAdmin: boolean;
  sidebarCollapsed: boolean;
  hydrated: boolean;
  setStore: (id: number | "all") => void;
  setUser: (user: User | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  logout: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  selectedStoreId: "all",
  isSuperAdmin: false,
  sidebarCollapsed: false,
  hydrated: false,

  setStore: (id) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("selectedStoreId", String(id));
    }
    set({ selectedStoreId: id });
  },

  setUser: (user) =>
    set({
      user,
      isSuperAdmin: user?.role === "admin",
    }),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  logout: () => {
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie =
      "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    if (typeof window !== "undefined") {
      localStorage.removeItem("selectedStoreId");
    }
    set({ user: null, isSuperAdmin: false, selectedStoreId: "all" });
    window.location.href = "/login";
  },

  setHydrated: (hydrated) => set({ hydrated }),
}));

// 客户端水合：从 localStorage 恢复状态
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("selectedStoreId");
  if (saved && saved !== "all") {
    const num = Number(saved);
    if (!isNaN(num)) {
      useAppStore.getState().setStore(num);
    }
  }
  useAppStore.getState().setHydrated(true);
}
