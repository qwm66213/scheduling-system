"use client";

import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";

// 格式化金额
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return `¥${value.toLocaleString()}`;
}

export default function DailySummaryPage() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 使用 fetch 直接调用，避免 hook 循环
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      const res = await fetch(`/api/daily-summary?${params}`);
      const result = await res.json();
      if (result.status === 1) {
        setData(result.data || []);
      }
    } catch {
      console.error("获取数据失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <PageHeading title="每日奖金汇总" subtitle="查看各门店每日奖金数据" />

      {/* 筛选栏 */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
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
          <button
            onClick={fetchData}
            className="h-9 px-4 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold-bright transition-colors"
          >
            查询
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-display text-xl text-foreground">每日汇总</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {startDate} 至 {endDate}
          </p>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            加载中...
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            点击"查询"获取数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border hover:bg-transparent">
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    日期
                  </th>
                  <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    实际营业额
                  </th>
                  <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    前厅出勤
                  </th>
                  <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    前厅奖金
                  </th>
                  <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    后厨出勤
                  </th>
                  <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    后厨奖金
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-border hover:bg-gold/[0.04] transition-colors"
                  >
                    <td className="p-4 font-medium">{String(item.date)}</td>
                    <td className="p-4 text-right font-display text-gold-bright">
                      {formatCurrency(
                        Number(item.actual_revenue) || 0
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {String(item.front_check_count || 0)} 人
                    </td>
                    <td className="p-4 text-right font-display text-success">
                      {formatCurrency(
                        Number(item.front_bonus) || 0
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {String(item.back_check_count || 0)} 人
                    </td>
                    <td className="p-4 text-right font-display text-success">
                      {formatCurrency(
                        Number(item.back_bonus) || 0
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
