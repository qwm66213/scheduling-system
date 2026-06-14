"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { Providers } from "@/components/providers";
import { useAuth } from "@/hooks/use-auth";

// 路由 → 标题映射
const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "经营概览",
  "/revenue": "营业额管理",
  "/schedule": "预排班",
  "/attendance": "考勤记录",
  "/daily-summary": "每日奖金汇总",
  "/personal-summary": "个人奖金明细",
  "/staff": "员工管理",
  "/accounts": "账号管理",
  "/settings": "设置",
};

function AppContent({ children }: { children: React.ReactNode }) {
  useAuth();
  const pathname = usePathname();
  const title = ROUTE_TITLES[pathname] || "930 私房菜";

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader title={title} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppContent>{children}</AppContent>
    </Providers>
  );
}
