import { CHART } from "./palette";

/** Common Recharts props so every chart reads the same. */
export const axisTick = { fontSize: 11, fill: CHART.axis };
export const axisLine = { stroke: CHART.grid };
export const gridProps = { stroke: CHART.grid, strokeDasharray: "3 3", vertical: false } as const;
export const legendStyle = { fontSize: 12, color: CHART.axis, paddingTop: 8 };
