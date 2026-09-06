// S3-04 — as peças da visão 360 do cliente.
//
// Thiago (desenhos 33-35): "Vamos unificar a visualização de 'valores do cliente'
// junto aos casos de cada valor. Também vamos unificar a visualização da etapa
// principal de cada caso. (…) A ideia não é ter todo o detalhamento, isso temos
// na página financeiro do próprio caso. Aqui é um visual geral integral de tudo
// que é do cliente como um todo."
//
// Antes o financeiro do cliente era uma ILHA: um bloco com o total, sem dizer de
// qual caso vinha cada valor. Quem atendia abria caso a caso para montar a foto.
//
// Estas peças são usadas DENTRO da seção "Casos do cliente", que já agrupa por
// tema e por lifecycle. Enriquecer o card existente preserva esse agrupamento —
// uma lista nova ao lado duplicaria os casos na tela, o oposto de "unificar".
//
// Nível de detalhe é RESUMO, de propósito (AC6): parcela a parcela continua na
// aba Financeiro do caso, a um clique daqui.

import type { ResumoValores } from "@/hooks/useClientOverview";

export function brl(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Régua de valores em linha: o total e, abaixo, só as fatias diferentes de zero.
 *
 * Some inteira quando não há nada devido — um bloco "R$ 0,00 · R$ 0,00 · R$ 0,00"
 * em cada card seria ruído em cima do que importa.
 */
export function ValoresResumo({ titulo, v }: { titulo: string; v: ResumoValores }) {
  if (!v.devido_centavos) return null;
  const fatias: Array<[string, number, string]> = [
    ["Pago", v.pago_centavos, "text-emerald-700"],
    ["Vencido", v.vencido_centavos, "text-red-600"],
    ["A vencer", v.vincendo_centavos, "text-muted-foreground"],
  ];
  return (
    <div className="text-[12px]">
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground">{titulo}</span>
        <span className="font-medium text-[var(--navy)]">{brl(v.devido_centavos)}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
        {fatias
          .filter(([, valor]) => valor > 0)
          .map(([rot, valor, cor]) => (
            <span key={rot} className={cor}>
              {rot} {brl(valor)}
            </span>
          ))}
      </div>
    </div>
  );
}

/** Uma etapa espelhada do caso. Some quando o caso não passou por aquela trilha. */
export function EtapaInline({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <span className="text-[11.5px] text-muted-foreground">
      {rotulo}: <span className="text-[var(--navy)]">{valor}</span>
    </span>
  );
}

/**
 * O total do cliente — AC3: deixa de ser uma ilha e passa a ser o somatório
 * visível no topo da seção de casos, ao lado dos casos que o compõem.
 */
export function ClientValoresTotais({
  receitas,
  despesas,
}: {
  receitas: ResumoValores;
  despesas: ResumoValores;
}) {
  const vazio = !receitas.devido_centavos && !despesas.devido_centavos;
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-md border border-[var(--border)] px-4 py-3 mb-3">
      <ValoresResumo titulo="Receitas do cliente" v={receitas} />
      <ValoresResumo titulo="Despesas do cliente" v={despesas} />
      {vazio && (
        <span className="text-[12px] text-muted-foreground">
          Nenhum valor registrado nos casos deste cliente.
        </span>
      )}
    </div>
  );
}
