"use client";

import type { Agendamento, StatusAgendamento } from "@/lib/types";

interface AppointmentTableProps {
  agendamentos: Agendamento[];
  title?: string;
}

const statusColors: Record<StatusAgendamento, string> = {
  Realizado: "bg-success/10 text-success",
  Agendado: "bg-blue-500/10 text-blue-500",
  Cancelado: "bg-danger/10 text-danger",
  Ausente: "bg-danger/10 text-danger",
  Bloqueado: "bg-muted/10 text-muted",
  Desconhecido: "bg-muted/10 text-muted",
};

const formaPgtoIcons: Record<string, string> = {
  PIX: "💠",
  "Cartão de Crédito": "💳",
  "Cartão de Débito": "💳",
  Dinheiro: "💵",
};

export default function AppointmentTable({
  agendamentos,
  title = "Agendamentos de Hoje",
}: AppointmentTableProps) {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-muted">
          {agendamentos.length} agendamento{agendamentos.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left px-5 py-3 font-medium">Horário</th>
              <th className="text-left px-5 py-3 font-medium">Cliente</th>
              <th className="text-left px-5 py-3 font-medium">Profissional</th>
              <th className="text-left px-5 py-3 font-medium">Serviço</th>
              <th className="text-left px-5 py-3 font-medium">Valor</th>
              <th className="text-left px-5 py-3 font-medium">Pagamento</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {agendamentos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-muted">
                  Nenhum agendamento encontrado
                </td>
              </tr>
            ) : (
              agendamentos.map((ag) => (
                <tr
                  key={ag.id}
                  className="border-b border-card-border last:border-0 hover:bg-accent/5 transition-colors"
                >
                  <td className="px-5 py-3 font-medium whitespace-nowrap">
                    {ag.hora} - {ag.horaFim}
                  </td>
                  <td className="px-5 py-3">
                    <div>{ag.cliente}</div>
                    {ag.telefone && (
                      <div className="text-xs text-muted">{ag.telefone}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">{ag.profissional}</td>
                  <td className="px-5 py-3">{ag.servico}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {ag.valor > 0
                      ? `R$ ${ag.valor.toFixed(2).replace(".", ",")}`
                      : "-"}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {ag.formaPgto ? (
                      <span className="text-xs">
                        {formaPgtoIcons[ag.formaPgto] || ""} {ag.formaPgto}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        statusColors[ag.status]
                      }`}
                    >
                      {ag.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs ${
                        ag.tipo === "Recorrente"
                          ? "text-accent"
                          : ag.tipo === "Encaixe"
                          ? "text-warning"
                          : "text-muted"
                      }`}
                    >
                      {ag.tipo}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
