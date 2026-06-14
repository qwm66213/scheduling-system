"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserInfo {
  id: number;
  record_key: string;
  username: string;
  role: string;
  real_name?: string;
  store_id?: number;
}

export function useAuth() {
  const setUser = useAppStore((s) => s.setUser);
  const user = useAppStore((s) => s.user);
  const router = useRouter();

  const query = useQuery({
    queryKey: ["auth", "verify"],
    queryFn: async () => {
      const res = await fetch("/api/auth/verify-token");
      const data = await res.json();
      if (data.status === 1 && data.data?.user) {
        return data.data.user as UserInfo;
      }
      return null;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 分钟
  });

  useEffect(() => {
    if (query.data) {
      setUser({
        id: query.data.id,
        username: query.data.username,
        role: query.data.role,
        name: query.data.real_name,
      });
    } else if (query.isError || (query.isSuccess && !query.data)) {
      // Token 无效或验证失败，清除用户状态并跳转登录页
      setUser(null);
      router.push("/login");
    }
  }, [query.data, query.isError, query.isSuccess, setUser, router]);

  return {
    user: user || query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
