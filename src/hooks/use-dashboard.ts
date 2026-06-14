"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";

interface RevenueTrendItem {
  date: string;
  lunch_revenue: number;
  dinner_revenue: number;
  total_revenue: number;
  total_consumption: number;
  bill_count: number;
  guest_count: number;
  table_count: number;
}

interface DashboardData {
  kpis: {
    todayRevenue: number;
    totalConsumption: number;
    billCount: number;
    guestCount: number;
    tableCount: number;
  };
  revenueTrend: RevenueTrendItem[];
}

export function useDashboard(selectedDate?: string) {
  const selectedStoreId = useAppStore((s) => s.selectedStoreId);

  return useQuery<DashboardData>({
    queryKey: ["dashboard", selectedStoreId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStoreId !== "all") {
        params.set("store_id", String(selectedStoreId));
      }
      if (selectedDate) {
        params.set("date", selectedDate);
      }
      const res = await fetch(`/api/dashboard?${params}`);
      const data = await res.json();
      if (data.status === 1) {
        return data.data;
      }
      throw new Error(data.errmsg || "获取数据失败");
    },
  });
}

// 获取昨天的日期（默认筛选日期）
export function getYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}
