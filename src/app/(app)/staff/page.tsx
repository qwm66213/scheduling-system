"use client";

import { useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { useStaff } from "@/hooks/use-staff";
import { STORES } from "@/lib/stores";

export default function StaffPage() {
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading } = useStaff({ page, pageSize });

  const staffData = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <PageHeading title="员工管理" subtitle="查看各门店员工信息" />

      {/* 数据表格 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl text-foreground">员工列表</h3>
            <p className="text-xs text-muted-foreground mt-1">
              共 {total} 名员工
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            加载中...
          </div>
        ) : staffData.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            暂无数据
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border hover:bg-transparent">
                    <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      工号
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      门店
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      岗位
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      部门
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      入职日期
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {staffData.map((staff: Record<string, unknown>) => (
                    <tr
                      key={String(staff.id)}
                      className="border-b border-border hover:bg-gold/[0.04] transition-colors"
                    >
                      <td className="p-4 font-mono text-xs text-muted-foreground">
                        {String(staff.employeeCode || "")}
                      </td>
                      <td className="p-4 font-medium">
                        {String(staff.name || "")}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {STORES.find(
                          (s) => s.id === Number(staff.store_id)
                        )?.name || String(staff.store || staff.store_id)}
                      </td>
                      <td className="p-4">
                        <span className="text-xs border border-border rounded px-2 py-0.5 text-muted-foreground">
                          {String(staff.position || "")}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {String(staff.workName || "")}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {String(staff.hireDate || "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  第 {page} / {totalPages} 页
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
