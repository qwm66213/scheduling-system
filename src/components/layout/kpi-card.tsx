import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  icon: LucideIcon;
  className?: string;
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  icon: Icon,
  className,
}: KpiCardProps) {
  const isPositive = delta !== undefined && delta >= 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden p-5 bg-card border border-border rounded-xl",
        "hover:border-gold/40 transition-colors group",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gold/5 group-hover:bg-gold/10 transition-colors" />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground tracking-tight">
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
            {unit && (
              <span className="text-sm text-muted-foreground">{unit}</span>
            )}
          </div>
          {delta !== undefined && (
            <div
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                isPositive &&
                  "text-success bg-success/10",
                isNegative &&
                  "text-destructive bg-destructive/10"
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isPositive ? "+" : ""}
              {delta}%
            </div>
          )}
        </div>
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gold-soft border border-gold/20 flex items-center justify-center">
          <Icon className="h-5 w-5 text-gold" />
        </div>
      </div>
    </div>
  );
}
