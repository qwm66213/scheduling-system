"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";

interface RevenueTrendItem {
  date: string;
  lunch_revenue: number;
  dinner_revenue: number;
  total_revenue: number;
}

interface DashboardData {
  kpis: {
    todayRevenue: number;
    attendanceRate: number;
    bonusPool: number;
    staffCount: number;
  };
  revenueTrend: RevenueTrendItem[];
}

export function useDashboard() {
  const selectedStoreId = useAppStore((s) => s.selectedStoreId);

  return useQuery<DashboardData>({
    queryKey: ["dashboard", selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStoreId !== "all") {
        params.set("store_id", String(selectedStoreId));
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
