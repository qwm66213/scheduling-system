"use client";

import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { useRevenue } from "@/hooks/use-revenue";
import { STORES } from "@/lib/stores";

// 格式化金额
function formatCurrency(value: number): string {
  return `¥${value.toLocaleString()}`;
}

export default function RevenuePage() {
  const [activeTab, setActiveTab] = useState<"actual" | "forecast">("actual");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const { data, isLoading } = useRevenue({
    start_date: startDate,
    end_date: endDate,
    version: activeTab === "actual" ? "actual" : undefined,
  });

  const revenueData = data || [];

  return (
    <div>
      <PageHeading
        title="营业额管理"
        subtitle="录入与查看各门店每日营业数据"
      />

      {/* 筛选栏 */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Tab 切换 */}
          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setActiveTab("actual")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === "actual"
                  ? "bg-gold text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              实际营业额
            </button>
            <button
              onClick={() => setActiveTab("forecast")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === "forecast"
                  ? "bg-gold text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              预估营业额
            </button>
          </div>

          {/* 日期选择 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 px-3 border border-border rounded-lg bg-secondary text-sm text-foreground outline-none focus:border-gold"
            />
            <span className="text-muted-foreground">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-3 border border-border rounded-lg bg-secondary text-sm text-foreground outline-none focus:border-gold"
            />
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-display text-xl text-foreground">
            {activeTab === "actual" ? "实际营业额" : "预估营业额"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {startDate} 至 {endDate}
          </p>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            加载中...
          </div>
        ) : revenueData.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            暂无数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border hover:bg-transparent">
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    日期
                  </th>
                  {activeTab === "actual" ? (
                    <>
                      <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        午市营业额
                      </th>
                      <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        晚市营业额
                      </th>
                      <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        总营业额
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        门店
                      </th>
                      <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        大厅
                      </th>
                      <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        宴会
                      </th>
                      <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        包间
                      </th>
                      <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        外卖
                      </th>
                      <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        总计
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeTab === "actual"
                  ? // 实际营业额表格
                    (revenueData as Record<string, unknown>[]).map(
                      (item, index) => (
                        <tr
                          key={index}
                          className="border-b border-border hover:bg-gold/[0.04] transition-colors"
                        >
                          <td className="p-4 font-medium">{String(item.date)}</td>
                          <td className="p-4 text-right font-display">
                            {formatCurrency(
                              Number(item.lunch_revenue) || 0
                            )}
                          </td>
                          <td className="p-4 text-right font-display">
                            {formatCurrency(
                              Number(item.dinner_revenue) || 0
                            )}
                          </td>
                          <td className="p-4 text-right font-display font-semibold text-gold-bright">
                            {formatCurrency(
                              Number(item.total_revenue) || 0
                            )}
                          </td>
                        </tr>
                      )
                    )
                  : // 预估营业额表格
                    (revenueData as Record<string, unknown>[]).map(
                      (item, index) => (
                        <tr
                          key={index}
                          className="border-b border-border hover:bg-gold/[0.04] transition-colors"
                        >
                          <td className="p-4 font-medium">{String(item.date)}</td>
                          <td className="p-4 text-muted-foreground">
                            {STORES.find(
                              (s) => s.id === Number(item.store_id)
                            )?.name || String(item.store_id)}
                          </td>
                          <td className="p-4 text-right font-display">
                            {formatCurrency(
                              Number(item.hall_revenue) || 0
                            )}
                          </td>
                          <td className="p-4 text-right font-display">
                            {formatCurrency(
                              Number(item.banquet_revenue) || 0
                            )}
                          </td>
                          <td className="p-4 text-right font-display">
                            {formatCurrency(
                              Number(item.room_revenue) || 0
                            )}
                          </td>
                          <td className="p-4 text-right font-display">
                            {formatCurrency(
                              Number(item.delivery_revenue) || 0
                            )}
                          </td>
                          <td className="p-4 text-right font-display font-semibold text-gold-bright">
                            {formatCurrency(
                              Number(item.total_revenue) || 0
                            )}
                          </td>
                        </tr>
                      )
                    )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
