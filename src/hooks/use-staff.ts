"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";

interface StaffParams {
  page?: number;
  pageSize?: number;
}

export function useStaff(params: StaffParams = {}) {
  const selectedStoreId = useAppStore((s) => s.selectedStoreId);

  return useQuery({
    queryKey: ["staff", selectedStoreId, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (selectedStoreId !== "all") {
        searchParams.set("store_id", String(selectedStoreId));
      }
      if (params.page) searchParams.set("page", String(params.page));
      if (params.pageSize)
        searchParams.set("pageSize", String(params.pageSize));
      const res = await fetch(`/api/staff?${searchParams}`);
      const data = await res.json();
      if (data.status === 1) {
        return data.data;
      }
      throw new Error(data.errmsg || "获取员工数据失败");
    },
  });
}
