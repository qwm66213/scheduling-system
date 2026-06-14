"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";

interface RevenueParams {
  start_date: string;
  end_date: string;
  version?: "actual" | "forecast";
}

export function useRevenue(params: RevenueParams) {
  const selectedStoreId = useAppStore((s) => s.selectedStoreId);

  return useQuery({
    queryKey: ["revenue", selectedStoreId, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("start_date", params.start_date);
      searchParams.set("end_date", params.end_date);
      if (params.version) searchParams.set("version", params.version);
      if (selectedStoreId !== "all") {
        searchParams.set("store_id", String(selectedStoreId));
      }
      const res = await fetch(`/api/revenue?${searchParams}`);
      const data = await res.json();
      if (data.status === 1) {
        return data.data;
      }
      throw new Error(data.errmsg || "获取营业额数据失败");
    },
  });
}
