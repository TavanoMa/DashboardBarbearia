import { NextResponse } from "next/server";
import { buscarProdutos, isSessionConfigured } from "@/lib/appbarber";
import { parseMoneyBR } from "@/lib/parser";

export interface ProdutoEstoque {
  codigo: string;
  descricao: string;
  categoria: string;
  categoriaCodigo: string;
  marca: string;
  saldo: number;
  qtdMinima: number;
  valor: number;
  valorCompra: number;
  comissao: string;
  valorProfissional: number;
  unidade: string;
}

export async function GET() {
  if (!isSessionConfigured()) {
    return NextResponse.json({ error: "Sessão não configurada" }, { status: 401 });
  }

  try {
    const raw = await buscarProdutos();

    const produtos: ProdutoEstoque[] = raw.map((r) => ({
      codigo: r.Codigo || "",
      descricao: r.Descricao || "",
      categoria: r.Categoria || "",
      categoriaCodigo: r.CategoriaCodigo || "",
      marca: r.Marca || "",
      saldo: parseInt(r.Saldo, 10) || 0,
      qtdMinima: parseInt(r.QtdMinima, 10) || 0,
      valor: parseMoneyBR(r.Valor),
      valorCompra: parseMoneyBR(r.ValorCompra),
      comissao: r.Comissao || "",
      valorProfissional: parseMoneyBR(r.ValorProfissional),
      unidade: r.tipounidadeSigla || "un",
    }));

    return NextResponse.json({ produtos });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar estoque" }, { status: 500 });
  }
}
