"use client";

import {
  ClipboardList,
  Landmark,
  AlertTriangle,
  Package,
  BadgeDollarSign,
  CreditCard,
  UserPlus,
  UserX,
  RotateCcw,
  ArrowDownCircle,
  ArrowUpCircle,
  Smartphone,
  UserMinus,
  CalendarClock,
} from "lucide-react";
import Header from "@/components/Header";
import { useResumo } from "@/hooks/useResumo";
import type { LucideIcon } from "lucide-react";

interface StatusCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  mode: "warning" | "danger" | "success" | "neutral";
  /** If true, value > 0 triggers the colored mode; otherwise neutral/success */
  warnIfPositive?: boolean;
}

function StatusCard({ title, value, icon: Icon, mode, warnIfPositive }: StatusCardProps) {
  // Determine effective mode: if warnIfPositive and value is 0, show neutral
  let effectiveMode = mode;
  if (warnIfPositive && value === 0) {
    effectiveMode = "neutral";
  }

  const modeStyles: Record<string, { bg: string; border: string; iconBg: string; iconText: string; valueText: string }> = {
    danger: {
      bg: "bg-danger/5",
      border: "border-danger/30",
      iconBg: "bg-danger/10",
      iconText: "text-danger",
      valueText: "text-danger",
    },
    warning: {
      bg: "bg-warning/5",
      border: "border-warning/30",
      iconBg: "bg-warning/10",
      iconText: "text-warning",
      valueText: "text-warning",
    },
    success: {
      bg: "bg-success/5",
      border: "border-success/30",
      iconBg: "bg-success/10",
      iconText: "text-success",
      valueText: "text-success",
    },
    neutral: {
      bg: "bg-card-bg",
      border: "border-card-border",
      iconBg: "bg-accent/10",
      iconText: "text-accent",
      valueText: "text-foreground",
    },
  };

  const s = modeStyles[effectiveMode];

  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-muted text-sm">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${s.valueText}`}>{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${s.iconBg} ${s.iconText}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export default function ResumoPage() {
  const { data, loading, error, refresh } = useResumo();

  return (
    <>
      <Header
        title="Resumo"
        sessionActive={!error}
        loading={loading}
        onRefresh={refresh}
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
            {error}. Va em{" "}
            <a href="/configuracoes" className="text-accent underline">
              Configuracoes
            </a>{" "}
            para configurar a sessao.
          </div>
        )}

        {/* Row 1 - Urgent / Attention */}
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Itens Pendentes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard
              title="Comandas Pendentes"
              value={data?.totalComandaPendentes ?? 0}
              icon={ClipboardList}
              mode="warning"
              warnIfPositive
            />
            <StatusCard
              title="Caixas Pendentes"
              value={data?.totalCaixaPendente ?? 0}
              icon={Landmark}
              mode="warning"
              warnIfPositive
            />
            <StatusCard
              title="Contas a Pagar Atrasadas"
              value={data?.totalAtrasada ?? 0}
              icon={AlertTriangle}
              mode="danger"
              warnIfPositive
            />
            <StatusCard
              title="Produtos a Vencer"
              value={data?.totalProdVencer ?? 0}
              icon={Package}
              mode="warning"
              warnIfPositive
            />
          </div>
        </div>

        {/* Row 2 - Client Metrics */}
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Clientes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard
              title="Clientes com Credito"
              value={data?.totalClienteCredito ?? 0}
              icon={BadgeDollarSign}
              mode="neutral"
            />
            <StatusCard
              title="Clientes em Debito"
              value={data?.totalClienteDebito ?? 0}
              icon={CreditCard}
              mode="warning"
              warnIfPositive
            />
            <StatusCard
              title="Novos Clientes"
              value={data?.totalClienteNovo ?? 0}
              icon={UserPlus}
              mode="success"
            />
            <StatusCard
              title="Clientes sem Retorno (+60 dias)"
              value={data?.totalClientesSemVir ?? 0}
              icon={UserX}
              mode="warning"
              warnIfPositive
            />
          </div>
        </div>

        {/* Row 3 - General Stats */}
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Visao Geral
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard
              title="Total Retorno"
              value={data?.totalRetorno ?? 0}
              icon={RotateCcw}
              mode="neutral"
            />
            <StatusCard
              title="Contas a Receber (1 semana)"
              value={data?.totalContasReceber ?? 0}
              icon={ArrowDownCircle}
              mode="neutral"
            />
            <StatusCard
              title="Contas a Pagar (1 semana)"
              value={data?.totalContasPagar ?? 0}
              icon={ArrowUpCircle}
              mode="neutral"
            />
            <StatusCard
              title="Usuarios Conectados ao App"
              value={data?.totalUsuariosConectaramApp ?? 0}
              icon={Smartphone}
              mode="neutral"
            />
          </div>
        </div>

        {/* Row 4 */}
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Outros
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard
              title="Clientes sem Usuario"
              value={data?.totalClientesSemUsuario ?? 0}
              icon={UserMinus}
              mode="neutral"
            />
            <StatusCard
              title="Assinaturas a Vencer"
              value={data?.totalAssinatura ?? 0}
              icon={CalendarClock}
              mode="warning"
              warnIfPositive
            />
          </div>
        </div>
      </main>
    </>
  );
}
