"use client";

import { useAppStore } from "@/stores/app-store";
import { STORES } from "@/lib/stores";
import { Menu, Search, Bell } from "lucide-react";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title = "经营概览" }: AppHeaderProps) {
  const { selectedStoreId, setStore, toggleSidebar, user } = useAppStore();

  return (
    <header className="h-16 flex items-center gap-4 px-4 bg-card/40 backdrop-blur-sm border-b border-border sticky top-0 z-30 shrink-0">
      {/* 触发按钮 */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground cursor-pointer hover:text-gold-bright hover:bg-gold-soft transition-colors"
      >
        <Menu className="w-[18px] h-[18px]" />
      </button>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-border" />

      {/* 页面标题 */}
      <div className="flex flex-col gap-px">
        <h1 className="text-lg font-semibold text-foreground leading-tight m-0">
          {title}
        </h1>
      </div>

      {/* 右侧 */}
      <div className="ml-auto flex items-center gap-3">
        {/* 搜索框 */}
        <div className="relative hidden md:block w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            className="w-full h-9 pl-9 pr-3 border border-border rounded-lg bg-secondary text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold-soft"
            placeholder="搜索员工、门店、订单..."
          />
        </div>

        {/* 门店选择器 */}
        <select
          value={selectedStoreId}
          onChange={(e) =>
            setStore(
              e.target.value === "all" ? "all" : Number(e.target.value)
            )
          }
          className="w-56 h-9 px-3 border border-gold/20 rounded-lg bg-secondary text-sm text-foreground outline-none cursor-pointer"
        >
          <option value="all">全部门店</option>
          {STORES.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>

        {/* 通知铃铛 */}
        <div className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground cursor-pointer hover:text-gold-bright transition-colors">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-gold" />
        </div>

        {/* 用户信息 */}
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary border border-border">
            <span className="text-[10px] font-medium text-gold-bright bg-gold-soft border border-gold/40 px-1.5 py-px rounded whitespace-nowrap">
              {user.role === "admin" ? "超级管理员" : "操作员"}
            </span>
            <span className="text-sm text-foreground whitespace-nowrap">
              {user.name || user.username}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
