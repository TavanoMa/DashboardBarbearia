export const CHART_COLORS = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
  green: "#008300",
  violet: "#4a3aa7",
  red: "#e34948",
} as const;

export const CATEGORICAL = [
  CHART_COLORS.blue,
  CHART_COLORS.orange,
  CHART_COLORS.aqua,
  CHART_COLORS.yellow,
  CHART_COLORS.magenta,
  CHART_COLORS.green,
  CHART_COLORS.violet,
  CHART_COLORS.red,
];

export const STATUS_COLORS = {
  realizado: "#10b981",
  agendado: "#2a78d6",
  cancelado: "#a855f7",
  ausente: "#e34948",
} as const;

export const TOOLTIP_STYLE = {
  background: "#1a1a2e",
  border: "1px solid #2d2d44",
  borderRadius: "8px",
  color: "#e5e7eb",
  fontSize: "13px",
  padding: "8px 12px",
} as const;

export const AXIS_STYLE = {
  fill: "#6b7280",
  fontSize: 12,
} as const;

export const GRID_STYLE = {
  stroke: "#e5e7eb20",
  strokeDasharray: undefined as undefined,
} as const;

export function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function formatBRLShort(value: number): string {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
}
