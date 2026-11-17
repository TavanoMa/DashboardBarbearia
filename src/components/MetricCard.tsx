"use client";

import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "accent" | "success" | "danger" | "warning";
}

const colorMap = {
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
};

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "accent",
}: MetricCardProps) {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center text-center">
      <div className={`p-2.5 rounded-lg mb-3 ${colorMap[color]}`}>
        <Icon size={22} />
      </div>
      <p className="text-muted text-sm">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-muted text-xs mt-1">{subtitle}</p>}
      {trend && (
        <p
          className={`text-xs mt-2 font-medium ${
            trend.value >= 0 ? "text-success" : "text-danger"
          }`}
        >
          {trend.value >= 0 ? "+" : ""}
          {trend.value}% {trend.label}
        </p>
      )}
    </div>
  );
}
