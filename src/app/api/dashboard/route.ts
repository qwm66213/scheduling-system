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

  const headers = { authorization: `Bearer ${token}` };

  try {
    const data = await cachedFetch(
      `dashboard:${storeId}`,
      async () => {
        // 获取最近 7 天的营业额数据
        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        // 串行调用，减少并发连接压力
        const revenue = await expressFetch<{ data: unknown[] }>(
          `/revenue?start_date=${startDate}&end_date=${endDate}&version=actual&store_id=${storeId === "all" ? "" : storeId}`,
          { headers }
        ).catch(() => ({ data: [] }));

        const bonus = await expressFetch<{ data: unknown[] }>(
          `/daily-summary/all?start_date=${startDate}&end_date=${endDate}`,
          { headers }
        ).catch(() => ({ data: [] }));

        const staff = await expressFetch<{ data: { total: number } }>(
          `/staff?store_id=${storeId === "all" ? "" : storeId}&pageSize=1`,
          { headers }
        ).catch(() => ({ data: { total: 0 } }));

        // 取最新一天的营业额
        const revenueData = Array.isArray(revenue.data) ? revenue.data : [];
        const latestRevenue =
          revenueData.length > 0
            ? (revenueData[0] as Record<string, unknown>)
            : null;
        const todayRevenue = latestRevenue
          ? (latestRevenue.total_revenue as number) || 0
          : 0;

        // 计算奖金池（最近一天）
        const bonusData = Array.isArray(bonus.data) ? bonus.data : [];
        const latestBonus =
          bonusData.length > 0
            ? (bonusData[0] as Record<string, unknown>)
            : null;
        const bonusPool = latestBonus
          ? (latestBonus.actual_revenue as number) || 0
          : 0;

        return {
          kpis: {
            todayRevenue,
            attendanceRate: 0,
            bonusPool,
            staffCount: (staff.data as { total: number })?.total || 0,
          },
          revenueTrend: revenueData.slice(0, 7).reverse(), // 最近7天趋势
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
