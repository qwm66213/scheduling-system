"use client";

import { PageHeading } from "@/components/layout/page-heading";
import { KpiCard } from "@/components/layout/kpi-card";
import { RevenueTrend } from "@/components/charts/revenue-trend";
import { useDashboard } from "@/hooks/use-dashboard";
import { DollarSign, ClipboardCheck, Coins, Users } from "lucide-react";

// 格式化金额
function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}w`;
  }
  return `¥${value.toLocaleString()}`;
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  const kpis = data?.kpis;
  const revenueTrend = data?.revenueTrend || [];

  return (
    <div>
      <PageHeading
        title="经营概览"
        subtitle="实时掌握各门店关键经营指标 · 数据更新于最近7日"
      />

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <KpiCard
          label="最新营业额"
          value={
            isLoading
              ? "..."
              : isError
                ? "--"
                : formatCurrency(kpis?.todayRevenue ?? 0)
          }
          icon={DollarSign}
        />
        <KpiCard
          label="出勤率"
          value={
            isLoading ? "..." : isError ? "--" : (kpis?.attendanceRate ?? 0)
          }
          unit="%"
          icon={ClipboardCheck}
        />
        <KpiCard
          label="奖金池"
          value={
            isLoading
              ? "..."
              : isError
                ? "--"
                : formatCurrency(kpis?.bonusPool ?? 0)
          }
          icon={Coins}
        />
        <KpiCard
          label="员工数"
          value={
            isLoading ? "..." : isError ? "--" : (kpis?.staffCount ?? 0)
          }
          unit="人"
          icon={Users}
        />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* 营业额趋势图 */}
        <div className="xl:col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="font-display text-xl text-foreground">
                营业额走势
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                最近7日 · 全门店合计
              </p>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gold" />
                <span className="text-muted-foreground">实际营业额</span>
              </div>
            </div>
          </div>
          {revenueTrend.length > 0 ? (
            <RevenueTrend data={revenueTrend} />
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              暂无数据
            </div>
          )}
        </div>

        {/* 门店排行 */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-xl text-foreground">
                营业额趋势
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                近7日每日合计
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {revenueTrend.length > 0 ? (
              revenueTrend
                .slice()
                .reverse()
                .slice(0, 7)
                .map((item, index) => {
                  const date = new Date(item.date);
                  const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;
                  const isHighest =
                    item.total_revenue ===
                    Math.max(...revenueTrend.map((r) => r.total_revenue));

                  return (
                    <div
                      key={item.date}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary transition"
                    >
                      <div
                        className={`h-8 w-8 rounded-md flex items-center justify-center font-display font-bold text-sm ${
                          isHighest
                            ? "bg-gradient-to-br from-gold to-gold-bright text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {formattedDate}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          午{formatCurrency(item.lunch_revenue)} / 晚
                          {formatCurrency(item.dinner_revenue)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gold-bright">
                          {formatCurrency(item.total_revenue)}
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
