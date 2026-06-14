"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";

interface ScheduleParams {
  start_date: string;
  end_date: string;
  type: 'schedule' | 'attendance';
}

export function useSchedule(params: ScheduleParams) {
  const selectedStoreId = useAppStore((s) => s.selectedStoreId);
  const hydrated = useAppStore((s) => s.hydrated);

  return useQuery({
    queryKey: ["schedule", selectedStoreId, params.type, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("start_date", params.start_date);
      searchParams.set("end_date", params.end_date);
      searchParams.set("type", params.type);
      if (selectedStoreId !== "all") {
        searchParams.set("store_id", String(selectedStoreId));
      }
      const res = await fetch(`/api/schedule?${searchParams}`);
      const data = await res.json();
      if (data.status === 1) {
        return data.data;
      }
      throw new Error(data.errmsg || "获取排班数据失败");
    },
    enabled: hydrated && selectedStoreId !== "all", // 只在水合完成且有门店时请求
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}