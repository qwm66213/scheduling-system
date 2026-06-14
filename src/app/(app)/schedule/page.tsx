"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { useSchedule } from "@/hooks/use-schedule";
import { useAppStore } from "@/stores/app-store";
import { STORES } from "@/lib/stores";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

// 出勤状态配置（统一黑色边框）
const STATUS_CONFIG: Record<string, { label: string }> = {
  check: { label: "√" },
  leave: { label: "O" },
  absent: { label: "旷" },
  save: { label: "存" },
  annual: { label: "年" },
  second: { label: "借" },
};

// 门店缩写映射
const STORE_ABBREV: Record<string, string> = {
  "930殷高店": "殷",
  "930长江西路店": "长",
  "930国和店": "国",
  "930宜川店": "宜",
  "930小馆拾光里店": "江",
  "930浦锦路店": "浦",
  "930金沙江店": "金",
  "930车站南路店": "凉",
  "930中华路店": "中",
  "930柳营路店": "柳",
  "930长阳店": "阳",
};

// 时段标签
const PERIOD_LABELS: Record<string, string> = {
  am: "上午",
  pm: "下午",
};

// 星期映射
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// 每页显示人数
const PAGE_SIZE = 15;

// 布局尺寸
const COL_EMPLOYEE = 140;
const COL_DATE = 100;
const AVATAR_SIZE = 32;

// 获取本周的日期范围
function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

// 格式化日期
function formatDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface StaffInfo {
  id: number;
  employeeCode: string;
  name: string;
  position: string;
  workName: string;
}

interface ScheduleRecord {
  employee_id: string;
  date: string;
  name: string;
  position: string;
  business_line: string;
  period: string;
  status: string;
  secondment_store?: string;
  hours?: number;
}

interface EditCell {
  employeeId: string;
  date: string;
  period: string;
}

export default function SchedulePage() {
  const selectedStoreId = useAppStore((s) => s.selectedStoreId);
  const hydrated = useAppStore((s) => s.hydrated);

  const [dataType, setDataType] = useState<'schedule' | 'attendance'>('schedule');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"front" | "back">("front");
  const [page, setPage] = useState(1);
  const [staffList, setStaffList] = useState<StaffInfo[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [editCell, setEditCell] = useState<EditCell | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editSecondmentStore, setEditSecondmentStore] = useState("");
  const [editHours, setEditHours] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null); // 正在保存的单元格
  const [localUpdates, setLocalUpdates] = useState<Map<string, ScheduleRecord>>(new Map()); // 本地更新缓存

  // 计算当前周的日期范围
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const startDate = weekDates[0].toISOString().split("T")[0];
  const endDate = weekDates[6].toISOString().split("T")[0];

  // 计算周标题
  const weekTitle = useMemo(() => {
    const year = weekDates[0].getFullYear();
    const month = weekDates[0].getMonth() + 1;
    const firstDay = weekDates[0].getDate();
    const weekNum = Math.ceil(firstDay / 7);
    return `${year}年${month}月 第${weekNum}周`;
  }, [weekDates]);

  // 获取门店员工列表 - 只在 hydrated 后执行
  useEffect(() => {
    if (!hydrated) return;

    if (selectedStoreId === "all") {
      setStaffList([]);
      return;
    }

    // 使用 AbortController 防止重复请求
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchStaff = async () => {
      setLoadingStaff(true);
      try {
        const res = await fetch(`/api/staff?store_id=${selectedStoreId}&pageSize=200`, { signal });
        const data = await res.json();
        if (data.status === 1 && data.data?.data) {
          setStaffList(data.data.data);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error("获取员工列表失败");
        }
      } finally {
        setLoadingStaff(false);
      }
    };

    fetchStaff();

    return () => {
      controller.abort();
    };
  }, [selectedStoreId, hydrated]);

  // 获取排班数据
  const { data, isLoading: loadingSchedule, refetch } = useSchedule({
    start_date: startDate,
    end_date: endDate,
    type: dataType,
  });

  const scheduleData = data || [];

  // 建立排班数据索引：employee_id_date_period → record（合并远程数据和本地更新）
  const scheduleIndex = useMemo(() => {
    const index = new Map<string, ScheduleRecord>();
    // 先添加远程数据
    (scheduleData as ScheduleRecord[]).forEach((record) => {
      const key = `${record.employee_id}_${record.date}_${record.period}`;
      index.set(key, record);
    });
    // 再用本地更新覆盖
    localUpdates.forEach((record, key) => {
      index.set(key, record);
    });
    return index;
  }, [scheduleData, localUpdates]);

  // 按 Tab 筛选员工
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      if (activeTab === "front") {
        return staff.workName === "前厅";
      } else {
        return staff.workName === "后厨";
      }
    });
  }, [staffList, activeTab]);

  // 分页
  const totalPages = Math.ceil(filteredStaff.length / PAGE_SIZE);
  const paginatedStaff = filteredStaff.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  // 前厅/后厨人数统计
  const frontCount = staffList.filter((s) => s.workName === "前厅").length;
  const backCount = staffList.filter((s) => s.workName === "后厨").length;

  // 切换 Tab 时重置页码
  const handleTabChange = (tab: "front" | "back") => {
    setActiveTab(tab);
    setPage(1);
  };

  // 上一周
  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
    setLocalUpdates(new Map()); // 清空本地更新
    setPage(1);
  };

  // 下一周
  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
    setLocalUpdates(new Map()); // 清空本地更新
    setPage(1);
  };

  // 获取某员工某天某个时段的排班记录
  const getShift = (
    employeeId: string,
    date: Date,
    period: string
  ): ScheduleRecord | undefined => {
    const dateStr = date.toISOString().split("T")[0];
    const key = `${employeeId}_${dateStr}_${period}`;
    return scheduleIndex.get(key);
  };

  // 点击单元格打开编辑
  const handleCellClick = (
    employeeId: string,
    date: Date,
    period: string
  ) => {
    const dateStr = date.toISOString().split("T")[0];
    const currentRecord = getShift(employeeId, date, period);

    setEditCell({ employeeId, date: dateStr, period });
    setEditStatus(currentRecord?.status || "");
    setEditSecondmentStore(currentRecord?.secondment_store || "");
    setEditHours(currentRecord?.hours || 0);
  };

  // 确认编辑（立即保存到后端）
  const handleEditConfirm = useCallback(async () => {
    if (!editCell) return;

    const staff = staffList.find(
      (s) => String(s.employeeCode) === editCell.employeeId || String(s.id) === editCell.employeeId
    );
    if (!staff) return;

    const cellKey = `${editCell.employeeId}_${editCell.date}_${editCell.period}`;
    setSavingCell(cellKey);

    const newRecord: ScheduleRecord = {
      employee_id: editCell.employeeId,
      date: editCell.date,
      name: staff.name,
      position: staff.position,
      business_line: staff.workName,
      period: editCell.period,
      status: editStatus,
      secondment_store: editStatus === "second" ? editSecondmentStore : "",
      hours: editStatus === "hours" ? editHours : 0,
    };

    try {
      const storeId =
        selectedStoreId === "all" ? undefined : Number(selectedStoreId);

      const res = await fetch("/api/schedule/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: [{ ...newRecord, store_id: storeId }],
          type: dataType,
        }),
      });

      const result = await res.json();
      if (result.status === 1) {
        // 保存成功后刷新数据
        refetch();
      } else {
        alert(result.errmsg || "保存失败");
      }
    } catch {
      alert("保存失败");
    } finally {
      setSavingCell(null);
      setEditCell(null);
    }
  }, [editCell, editStatus, editSecondmentStore, editHours, staffList, selectedStoreId, refetch]);

  const isLoading = loadingStaff || loadingSchedule;

  // 页面标题根据 dataType 动态显示
  const pageTitle = dataType === 'schedule' ? '预排班' : '考勤记录';
  const pageSubtitle = dataType === 'schedule' ? '管理各门店排班计划' : '管理各门店考勤记录';

  return (
    <div>
      <PageHeading
        title={pageTitle}
        subtitle={pageSubtitle}
      />

      {/* 主 Tab 切换：预排班 / 考勤记录 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setDataType('schedule');
            setLocalUpdates(new Map());
            setPage(1);
          }}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            dataType === 'schedule'
              ? "bg-gold text-white"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          预排班
        </button>
        <button
          onClick={() => {
            setDataType('attendance');
            setLocalUpdates(new Map());
            setPage(1);
          }}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            dataType === 'attendance'
              ? "bg-gold text-white"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          考勤记录
        </button>
      </div>

      {/* 顶部工具栏 + Tab 切换 + 状态图例 */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between">
          {/* 日期选择器 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center min-w-[140px]">
              <div className="text-base font-bold text-foreground">
                {weekTitle}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatDate(weekDates[0])} ~ {formatDate(weekDates[6])}
              </div>
            </div>

            <button
              onClick={handleNextWeek}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tab 切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange("front")}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "front"
                  ? "bg-gold text-white"
                  : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              前厅 ({frontCount})
            </button>
            <button
              onClick={() => handleTabChange("back")}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "back"
                  ? "bg-gold text-white"
                  : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              后厨 ({backCount})
            </button>
          </div>

          {/* 状态图例 */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1">
                <span className="w-5 h-5 rounded border border-border flex items-center justify-center font-semibold text-foreground text-[10px]">
                  {config.label}
                </span>
                <span>
                  {key === "check" ? "出勤" :
                   key === "leave" ? "请假" :
                   key === "absent" ? "旷工" :
                   key === "save" ? "存休" :
                   key === "annual" ? "年假" :
                   key === "second" ? "借调" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 排班表格 */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {selectedStoreId === "all" ? (
          <div className="p-12 text-center text-muted-foreground">
            请先选择门店查看排班
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            加载中...
          </div>
        ) : paginatedStaff.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            暂无{activeTab === "front" ? "前厅" : "后厨"}员工
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: COL_EMPLOYEE + COL_DATE * 7 }}>
              <thead>
                <tr className="border-b border-border">
                  <th
                    className="text-center p-2 font-semibold text-xs text-muted-foreground sticky left-0 bg-card z-10"
                    style={{ width: COL_EMPLOYEE }}
                  >
                    员工
                  </th>
                  {weekDates.map((date, index) => (
                    <th
                      key={index}
                      className="text-center p-2 font-semibold text-xs text-muted-foreground"
                      style={{ width: COL_DATE }}
                    >
                      <div>{WEEKDAYS[index]}</div>
                      <div className="text-[10px] mt-0.5">{formatDate(date)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedStaff.map((staff) => {
                  const empId = String(staff.employeeCode || staff.id);

                  return (
                    <tr
                      key={staff.id}
                      className="border-b border-border hover:bg-gold/[0.02] transition-colors"
                      style={{ height: 72 }}
                    >
                      <td
                        className="p-2 sticky left-0 bg-card z-10"
                        style={{ width: COL_EMPLOYEE }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="rounded-full flex items-center justify-center text-xs font-semibold border-2 shrink-0"
                            style={{
                              width: AVATAR_SIZE,
                              height: AVATAR_SIZE,
                              backgroundColor: "rgba(201, 168, 76, 0.1)",
                              borderColor: "rgba(201, 168, 76, 0.4)",
                              color: "#D8A93A",
                            }}
                          >
                            {staff.name[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">
                              {staff.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {staff.position}
                            </div>
                          </div>
                        </div>
                      </td>

                      {weekDates.map((date, index) => {
                        const amShift = getShift(empId, date, "am");
                        const pmShift = getShift(empId, date, "pm");

                        // 获取显示文本：借调显示门店缩写，其他显示状态标签
                        const getDisplayText = (shift: ScheduleRecord | undefined) => {
                          if (!shift) return "";
                          if (shift.status === "second" && shift.secondment_store) {
                            return STORE_ABBREV[shift.secondment_store] || "借";
                          }
                          const config = STATUS_CONFIG[shift.status];
                          return config?.label || shift.status;
                        };

                        return (
                          <td
                            key={index}
                            className="p-1 text-center"
                            style={{ width: COL_DATE }}
                          >
                            <div className="flex flex-col gap-0.5">
                              {/* 上午 */}
                              <div
                                className={`inline-flex items-center justify-center h-7 px-1.5 rounded-md border cursor-pointer transition-colors text-[11px] font-semibold ${
                                  savingCell === `${empId}_${date.toISOString().split('T')[0]}_am`
                                    ? 'border-gold bg-gold/10 text-gold'
                                    : 'border-border hover:bg-accent text-foreground'
                                }`}
                                onClick={() => handleCellClick(empId, date, "am")}
                              >
                                {savingCell === `${empId}_${date.toISOString().split('T')[0]}_am` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  getDisplayText(amShift) || <span className="w-3">&nbsp;</span>
                                )}
                              </div>

                              {/* 下午 */}
                              <div
                                className={`inline-flex items-center justify-center h-7 px-1.5 rounded-md border cursor-pointer transition-colors text-[11px] font-semibold ${
                                  savingCell === `${empId}_${date.toISOString().split('T')[0]}_pm`
                                    ? 'border-gold bg-gold/10 text-gold'
                                    : 'border-border hover:bg-accent text-foreground'
                                }`}
                                onClick={() => handleCellClick(empId, date, "pm")}
                              >
                                {savingCell === `${empId}_${date.toISOString().split('T')[0]}_pm` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  getDisplayText(pmShift) || <span className="w-3">&nbsp;</span>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              共 {filteredStaff.length} 人，第 {page} / {totalPages} 页
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
      </div>

      {/* 编辑弹窗 */}
      {editCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-2xl p-6 w-80">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              编辑排班 - {PERIOD_LABELS[editCell.period]}
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                出勤状态
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setEditStatus(key)}
                    className={`h-10 rounded-lg border-2 border-border text-sm font-semibold text-foreground transition-colors ${
                      editStatus === key ? "ring-2 ring-gold bg-accent" : ""
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {editStatus === "second" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  借调门店
                </label>
                <select
                  value={editSecondmentStore}
                  onChange={(e) => setEditSecondmentStore(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg bg-secondary text-foreground outline-none focus:border-gold"
                >
                  <option value="">请选择门店</option>
                  {STORES.filter((store) => String(store.id) !== String(selectedStoreId)).map((store) => (
                    <option key={store.id} value={store.name}>
                      {store.name} ({STORE_ABBREV[store.name]})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setEditCell(null)}
                className="flex-1 h-10 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleEditConfirm}
                className="flex-1 h-10 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold-bright transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
