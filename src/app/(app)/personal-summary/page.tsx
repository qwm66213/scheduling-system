"use client";

import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { useAppStore } from "@/stores/app-store";

// 格式化金额
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return `¥${value.toLocaleString()}`;
}

export default function PersonalSummaryPage() {
  const selectedStoreId = useAppStore((s) => s.selectedStoreId);

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

  const fetchData = async () => {
    if (selectedStoreId === "all") return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      const res = await fetch(`/api/personal-summary?${params}`);
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

  // 按员工分组
  const groupedByEmployee: Record<string, {
    name: string;
    business_line: string;
    position: string;
    records: Record<string, unknown>[];
  }> = {};

  data.forEach((item) => {
    const empId = String(item.employee_id);
    if (!groupedByEmployee[empId]) {
      groupedByEmployee[empId] = {
        name: String(item.employee_name || ""),
        business_line: String(item.business_line || ""),
        position: String(item.position || ""),
        records: [],
      };
    }
    groupedByEmployee[empId].records.push(item);
  });

  return (
    <div>
      <PageHeading title="个人奖金明细" subtitle="查看员工个人奖金详情" />

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
            disabled={selectedStoreId === "all"}
            className="h-9 px-4 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold-bright transition-colors disabled:opacity-50"
          >
            查询
          </button>
          {selectedStoreId === "all" && (
            <span className="text-sm text-warning">
              请先选择门店
            </span>
          )}
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-display text-xl text-foreground">个人奖金</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {startDate} 至 {endDate}
          </p>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            加载中...
          </div>
        ) : Object.keys(groupedByEmployee).length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {selectedStoreId === "all"
              ? "请先选择门店"
              : '点击"查询"获取数据'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border hover:bg-transparent">
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    姓名
                  </th>
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    部门
                  </th>
                  <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    岗位
                  </th>
                  {(
                    data[0]
                      ? [
                          ...new Set(
                            data.map((d) => String(d.date))
                          ),
                        ]
                      : []
                  ).map((date) => (
                    <th
                      key={date}
                      className="text-center p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider"
                    >
                      {new Date(date).getDate()}日
                    </th>
                  ))}
                  <th className="text-right p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    合计
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedByEmployee).map(
                  ([empId, emp]) => {
                    const totalBonus = emp.records.reduce(
                      (sum, r) => sum + (Number(r.bonus) || 0),
                      0
                    );
                    return (
                      <tr
                        key={empId}
                        className="border-b border-border hover:bg-gold/[0.04] transition-colors"
                      >
                        <td className="p-4 font-medium">{emp.name}</td>
                        <td className="p-4 text-muted-foreground">
                          {emp.business_line === "front"
                            ? "前厅"
                            : "后厨"}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {emp.position}
                        </td>
                        {emp.records.map((record, idx) => {
                          const bonus = Number(record.bonus);
                          return (
                            <td
                              key={idx}
                              className={`p-4 text-center font-display ${
                                bonus > 0
                                  ? "text-success"
                                  : bonus < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {formatCurrency(bonus)}
                            </td>
                          );
                        })}
                        <td
                          className={`p-4 text-right font-display font-semibold ${
                            totalBonus > 0
                              ? "text-success"
                              : totalBonus < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {formatCurrency(totalBonus)}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
