import { readFileSync, writeFileSync } from "node:fs";
const s = readFileSync("material/integracoes/projuris/application.wadl", "utf8");
const re = /<wadl:resource path="([^"]+)"[^>]*>([\s\S]*?)(?=<wadl:resource path=|<\/wadl:resources>)/g;
const rows = [];
let m;
while ((m = re.exec(s))) {
  const bloco = m[2];
  const metodos = [...new Set([...bloco.matchAll(/<wadl:method name="([A-Z]+)"/g)].map((x) => x[1]))];
  const doc = (bloco.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? "").replace(/\s+/g, " ").trim();
  if (metodos.length) rows.push({ path: m[1], metodos, doc });
}
const grupos = [
  ["Intimações", /^intimacao/],
  ["Andamentos (movimentações)", /^andamento/],
  ["Tarefas", /^tarefa|^kanban\/tarefa|^permissao\/tarefa/],
  ["Processos", /^processo/],
  ["Pessoas / clientes", /^pessoa/],
  ["Marcadores e tipos", /^marcador|^tipo$|^cadastro-tipo/],
  ["Usuários e grupos", /^usuario|^grupo/],
];
let md = `# Referência da API do ProJuris (extraída do WADL)

> Fonte: \`application.wadl\` (enviado pelo Thiago em 2026-08-24) — ${rows.length} recursos.
> Gerado por \`scripts/gerar-referencia-api-projuris.mjs\`. Base: \`api.projurisadv.com.br/adv-service\`.

Este arquivo existe porque a integração foi construída por engenharia reversa antes
da documentação chegar. Vários endpoints que procurávamos existem — e outros que
usávamos eram os "errados" (mais pobres).

## Endpoints que respondem pedidos do doc "21.08 _ Controladoria"

| Pedido do doc | Endpoint |
|---|---|
| "Informar protocolo" — criar processo a partir do SHV | \`POST /processo-judicial\` (e \`PUT\` para editar) |
| "Arquivar intimação" (botão da tela 1) | \`PUT /intimacao/{codigo-intimacao}/situacao/{chave-situacao-intimacao}\` |
| Desfazer o arquivamento | \`PUT /intimacao/{codigo-intimacao}/desarquivar\` |
| "Marcar lido" na movimentação (botão da tela 1) | \`PUT /andamento/alterar-status-lido/{codigo-andamento}\` |
| "puxar o que é intimação **e movimentação**" | \`POST /andamento/consulta-geral\` (consulta global, não por processo) |
| Motor "lança nas agendas" | \`POST /tarefa\` · \`PUT /tarefa\` · \`PUT /tarefas-situacao\` |
| Criar tipo de tarefa do SHV no ProJuris | \`POST /tarefa-tipo\` · \`PUT /tarefa-tipo\` |
| Prazo previsto/fatal por tipo | \`POST /tarefa-tipo/consulta\` · \`GET /tarefa-tipo/{codigo}\` |
| Vincular intimação a um processo | \`PUT /intimacao/{codigo}/vincular/processo/{codigo-processo}\` |
| Contador da fila | \`GET /intimacao/contar-pendentes\` |

`;
for (const [titulo, rx] of grupos) {
  const lista = rows.filter((r) => rx.test(r.path)).sort((a, b) => a.path.localeCompare(b.path));
  if (!lista.length) continue;
  md += `\n## ${titulo}\n\n`;
  for (const r of lista) {
    md += `- \`${r.metodos.join("/")} /${r.path}\`${r.doc ? ` — ${r.doc.slice(0, 160)}` : ""}\n`;
  }
}
writeFileSync("sistema-hv/docs/referencia-api-projuris.md", md, "utf8");
console.log("doc gerado:", md.split("\n").length, "linhas");
