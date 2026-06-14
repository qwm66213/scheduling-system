"use client";

import { PageHeading } from "@/components/layout/page-heading";
import { KpiCard } from "@/components/layout/kpi-card";
import { RevenueTrend } from "@/components/charts/revenue-trend";
import { useDashboard, getYesterday } from "@/hooks/use-dashboard";
import { DollarSign, Coins, Receipt, Users2, UtensilsCrossed, Calendar } from "lucide-react";
import { useState } from "react";

// 格式化金额
function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}w`;
  }
  return `¥${value.toLocaleString()}`;
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState<string>(getYesterday());
  const { data, isLoading, isError } = useDashboard(selectedDate);

  const kpis = data?.kpis;
  const revenueTrend = data?.revenueTrend || [];

  return (
    <div>
      <PageHeading
        title="经营概览"
        subtitle="实时掌握各门店关键经营指标"
      />

      {/* 日期筛选 */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="bg-transparent border-none outline-none text-sm text-foreground"
          />
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard
          label="消费总额"
          value={
            isLoading
              ? "..."
              : isError
                ? "--"
                : `¥${(kpis?.totalConsumption ?? 0).toFixed(2)}`
          }
          icon={Coins}
        />
        <KpiCard
          label="营业额"
          value={
            isLoading
              ? "..."
              : isError
                ? "--"
                : `¥${(kpis?.todayRevenue ?? 0).toFixed(2)}`
          }
          icon={DollarSign}
        />
        <KpiCard
          label="账单数"
          value={
            isLoading ? "..." : isError ? "--" : (kpis?.billCount ?? 0)
          }
          unit="单"
          icon={Receipt}
        />
        <KpiCard
          label="客流量"
          value={
            isLoading ? "..." : isError ? "--" : (kpis?.guestCount ?? 0)
          }
          unit="人"
          icon={Users2}
        />
        <KpiCard
          label="开台数"
          value={
            isLoading ? "..." : isError ? "--" : (kpis?.tableCount ?? 0)
          }
          unit="台"
          icon={UtensilsCrossed}
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
