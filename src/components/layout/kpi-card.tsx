import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  icon: LucideIcon;
  className?: string;
  iconPosition?: "top-right" | "bottom-right" | "center-right";
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  icon: Icon,
  className,
  iconPosition = "top-right",
}: KpiCardProps) {
  const isPositive = delta !== undefined && delta >= 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden p-4 bg-card border border-border rounded-xl",
        "hover:border-gold/40 transition-colors group",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gold/5 group-hover:bg-gold/10 transition-colors" />

      <div className="relative flex flex-col h-full">
        {/* Label */}
        <p className="text-sm text-muted-foreground mb-1">{label}</p>

        {/* Value and Icon row */}
        <div className="flex items-end justify-between mt-auto">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
            {unit && (
              <span className="text-sm text-muted-foreground">{unit}</span>
            )}
          </div>

          {/* Icon - positioned at bottom right */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gold-soft border border-gold/20 flex items-center justify-center">
            <Icon className="h-4 w-4 text-gold" />
          </div>
        </div>

        {/* Delta indicator */}
        {delta !== undefined && (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-2 w-fit",
              isPositive && "text-success bg-success/10",
              isNegative && "text-destructive bg-destructive/10"
            )}
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}
            {delta}%
          </div>
        )}
      </div>
    </div>
  );
}