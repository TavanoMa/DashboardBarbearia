"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RevenueChartProps {
  data: { dia: string; valor: number }[];
  title?: string;
}

export default function RevenueChart({
  data,
  title = "Faturamento Semanal",
}: RevenueChartProps) {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="font-semibold mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c9a227" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb20" />
            <XAxis
              dataKey="dia"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `R$${v}`}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a2e",
                border: "1px solid #2d2d44",
                borderRadius: "8px",
                color: "#e5e7eb",
              }}
              formatter={(value) => [
                `R$ ${Number(value).toFixed(2)}`,
                "Faturamento",
              ]}
            />
            <Area
              type="monotone"
              dataKey="valor"
              stroke="#c9a227"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValor)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
