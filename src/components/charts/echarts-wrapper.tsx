"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// 注册必要的组件
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer]);

// cuisine-ops 图表配色
export const chartColors = {
  primary: "#c9a84c",
  secondary: "#8a6e2f",
  grid: "#e6dfd0",
  axis: "#8a7f6a",
  success: "#3a7d5c",
  destructive: "#c23b3b",
};

interface EChartsWrapperProps {
  option: echarts.EChartsCoreOption;
  height?: number;
  className?: string;
}

export function EChartsWrapper({
  option,
  height = 300,
  className,
}: EChartsWrapperProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    chartInstance.current = echarts.init(chartRef.current);

    // 设置配置项
    chartInstance.current.setOption(option);

    // 响应窗口大小变化
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.current?.dispose();
    };
  }, []);

  // option 更新时重新设置
  useEffect(() => {
    chartInstance.current?.setOption(option, true);
  }, [option]);

  return (
    <div
      ref={chartRef}
      style={{ height }}
      className={className}
    />
  );
}
