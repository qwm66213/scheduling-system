import { NextRequest, NextResponse } from "next/server";
import { expressFetch } from "@/lib/express-client";
import { cachedFetch } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ status: 0, errmsg: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store_id") || "all";
  const selectedDate = searchParams.get("date"); // 单日筛选（仅用于 KPI）

  const headers = { authorization: `Bearer ${token}` };

  try {
    // KPI 数据：根据筛选日期查询
    const kpiStartDate = selectedDate || new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const kpiEndDate = selectedDate || new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // 趋势图数据：始终查询最近 7 天
    const trendEndDate = new Date().toISOString().split("T")[0];
    const trendStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const cacheKey = `dashboard:${storeId}:${selectedDate || "yesterday"}`;

    const data = await cachedFetch(
      cacheKey,
      async () => {
        // 查询 KPI 数据（单日或昨日）
        const kpiRevenue = await expressFetch<{ data: unknown[] }>(
          `/revenue?start_date=${kpiStartDate}&end_date=${kpiEndDate}&version=actual&store_id=${storeId === "all" ? "" : storeId}`,
          { headers }
        ).catch(() => ({ data: [] }));

        const kpiData = Array.isArray(kpiRevenue.data) ? kpiRevenue.data : [];
        const kpiRecord = kpiData[0] as Record<string, unknown> | undefined;

        // 查询趋势图数据（最近 7 天）
        const trendRevenue = await expressFetch<{ data: unknown[] }>(
          `/revenue?start_date=${trendStartDate}&end_date=${trendEndDate}&version=actual&store_id=${storeId === "all" ? "" : storeId}`,
          { headers }
        ).catch(() => ({ data: [] }));

        const trendData = Array.isArray(trendRevenue.data) ? trendRevenue.data : [];

        return {
          kpis: {
            todayRevenue: (kpiRecord?.total_revenue as number) || 0,
            totalConsumption: (kpiRecord?.total_consumption as number) || 0,
            billCount: (kpiRecord?.bill_count as number) || 0,
            guestCount: (kpiRecord?.guest_count as number) || 0,
            tableCount: (kpiRecord?.table_count as number) || 0,
          },
          revenueTrend: trendData.slice(0, 7).reverse(), // 最近7天趋势
        };
      },
      60 // 60 秒缓存
    );

    return NextResponse.json({ status: 1, data });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { status: 0, errmsg: "获取数据失败" },
      { status: 500 }
    );
  }
}
