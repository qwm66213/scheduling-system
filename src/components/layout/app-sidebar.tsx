"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import {
  LayoutDashboard,
  DollarSign,
  CalendarDays,
  Award,
  Users,
  UserCog,
  Settings,
  LogOut,
} from "lucide-react";

interface MenuItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: "经营数据",
    items: [
      { label: "经营概览", href: "/dashboard", icon: LayoutDashboard },
      { label: "营业额管理", href: "/revenue", icon: DollarSign },
      { label: "每日奖金汇总", href: "/daily-summary", icon: Award },
    ],
  },
  {
    title: "排班考勤",
    items: [
      { label: "预排班", href: "/schedule", icon: CalendarDays },
    ],
  },
  {
    title: "员工奖金",
    items: [
      { label: "个人奖金明细", href: "/personal-summary", icon: Award },
      { label: "员工管理", href: "/staff", icon: Users },
    ],
  },
  {
    title: "系统",
    items: [
      {
        label: "账号管理",
        href: "/accounts",
        icon: UserCog,
        adminOnly: true,
      },
      { label: "设置", href: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isSuperAdmin, sidebarCollapsed, toggleSidebar, logout, user } =
    useAppStore();

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 overflow-hidden shrink-0",
        sidebarCollapsed ? "w-12" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-sidebar-border shrink-0 px-4">
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="gold-gradient-text font-display text-[28px] font-black tracking-tight leading-none">
              930
            </span>
            <span className="text-[15px] font-semibold text-gold-bright tracking-[0.15em]">
              私房菜
            </span>
          </div>
          <span className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground pl-0.5">
            Operation Platform
          </span>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto p-3 px-2">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || isSuperAdmin
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              <div className="pt-4 px-3 pb-1.5 text-[11px] font-medium tracking-[0.15em] uppercase text-sidebar-foreground/50">
                {group.title}
              </div>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "nav-item flex items-center gap-2.5 h-9 mb-0.5 px-3 rounded-lg cursor-pointer transition-all whitespace-nowrap border border-transparent",
                      isActive
                        ? "bg-gold-soft text-gold-bright border-gold/30"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold-bright"
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon className="nav-icon w-[18px] h-[18px] flex-shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        {user ? (
          <div className="flex items-center gap-2.5">
            <div className="sidebar-avatar w-9 h-9 rounded-full bg-gold-soft text-gold-bright flex items-center justify-center text-sm font-semibold border border-gold/40 shrink-0">
              {user.name?.[0] || user.username[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#f0ece3] whitespace-nowrap overflow-hidden text-ellipsis">
                {user.name || user.username}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {user.role === "admin" ? "超级管理员" : "操作员"}
              </div>
            </div>
            <button
              onClick={logout}
              className="sidebar-logout w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-gold-bright hover:bg-white/[0.06] transition-colors"
              title="退出登录"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gold-soft animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-sidebar-accent rounded animate-pulse" />
              <div className="h-2 bg-sidebar-accent rounded w-2/3 animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
