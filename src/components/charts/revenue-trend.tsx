"use client";

import { EChartsWrapper, chartColors } from "./echarts-wrapper";

interface RevenueData {
  date: string;
  lunch_revenue: number;
  dinner_revenue: number;
  total_revenue: number;
}

interface RevenueTrendProps {
  data: RevenueData[];
}

export function RevenueTrend({ data }: RevenueTrendProps) {
  const dates = data.map((d) => {
    const date = new Date(d.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  const option = {
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "#fff",
      borderColor: "rgba(201,168,76,0.4)",
      borderRadius: 8,
      textStyle: { color: "#6b5a2a" },
    },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: "category" as const,
      data: dates,
      axisLine: { lineStyle: { color: chartColors.grid } },
      axisLabel: { color: chartColors.axis, fontSize: 12 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: {
        lineStyle: { color: chartColors.grid, type: "dashed" as const },
      },
      axisLabel: {
        color: chartColors.axis,
        fontSize: 12,
        formatter: (v: number) =>
          v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v),
      },
    },
    series: [
      {
        name: "营业额",
        type: "line",
        data: data.map((d) => d.total_revenue),
        smooth: true,
        lineStyle: { color: chartColors.primary, width: 2.5 },
        symbol: "circle",
        symbolSize: 6,
        itemStyle: { color: chartColors.primary },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(201,168,76,0.55)" },
              { offset: 1, color: "rgba(201,168,76,0)" },
            ],
          },
        },
      },
    ],
  };

  return <EChartsWrapper option={option} height={288} />;
}
