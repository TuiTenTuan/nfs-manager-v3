"use client";

import { useTheme } from "@/lib/theme";

/** Dotted stroke for write throughput lines (read stays solid). */
export const CHART_WRITE_LINE_DASH = "0 6";

export function useChartColors() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return {
    read: isDark ? "hsl(217, 91%, 62%)" : "hsl(217, 91%, 50%)",
    write: isDark ? "hsl(160, 70%, 45%)" : "hsl(160, 84%, 39%)",
    grid: isDark ? "hsl(240, 5%, 18%)" : "hsl(240, 6%, 88%)",
    text: isDark ? "hsl(240, 4%, 58%)" : "hsl(240, 4%, 46%)",
    tooltipBg: isDark ? "hsl(240, 6%, 10%)" : "hsl(0, 0%, 100%)",
    tooltipBorder: isDark ? "hsl(240, 5%, 18%)" : "hsl(240, 6%, 88%)",
  };
}
