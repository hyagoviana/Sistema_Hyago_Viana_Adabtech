# Épico — Reunião 2026-08-26 (Thiago): motor validado, 13 ajustes e o financeiro

**Fonte:** `material/reunioes/2026-08-26_controladoria-financeiro-e-ajustes.txt` (transcrição completa)
+ `material/documentos/2026-08-25_financeiro-shv.docx` + `material/documentos/2026-08-25_registros-contaazul.docx`
+ a lista de 13 pendências escrita pelo owner.

**Contexto:** o motor de distribuição foi validado ponta a ponta na tela com o Thiago
(sync → andamentos → a distribuir → aprovação → espelho no ProJuris). O time dele vai
**testar na quinta e usar de verdade na sexta**. Tudo aqui é ajuste de rotina real, não
funcionalidade nova de fundação — exceto o financeiro, que é um módulo novo.

---

## Decisões travadas pelo owner (2026-08-26)

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Qual tela de tipo de tarefa sobrevive? | **`/configuracoes/tipos-tarefa`** (catálogo único). A aba do motor vira atalho. |
| 2 | Auditoria: menu global ou aba do caso? | **Menu global** — e com busca **também dentro do caso e dentro do motor**. |
| 3 | Status de tarefa | **Remove PENDENTE.** Ficam: **Em andamento**, **Concluída com sucesso**, **Concluída sem sucesso**, **Cancelada**. |
| 4 | Pasta do Drive | **Criar e mover** o que já existe. A subpasta recebe **tudo que o SHV gera**; anexo **manual** continua na pasta do caso. |
| 5 | Identificador do workflow aparece onde? | **Nos 2** — no texto da ação gerada E na linha do tempo. |
| 6 | Grupo de workflow | **Texto livre.** |
| 7 | Financeiro em 2 fases (interno → API) | **Aprovado.** |
| 8 | ContaAzul (contrato recorrente / 24 competências) | **Confirmar na API**, mas **por último** — é o mais complexo. |
| 9 | Importação por IA do ContaAzul | **Checar** viabilidade. |
| 10 | Campo "vinculado" + reordenar arrastando | **Mesma entrega** do item 1. |

---

## Ordem de execução (financeiro/ContaAzul por último, por ordem do owner)

### Onda 1 — o que trava a rotina de sexta (motor + tarefa)
| Story | Título | Risco |
|---|---|---|
| **MO1** | Motor: intimação × andamento (tag, filtro, marcar lido), busca por processo, scroll do Kanban, visual | BAIXO |
| **TK1** | Status de tarefa alinhado ao ProJuris (sem PENDENTE) + filtros na agenda | MÉDIO |
| **T1** | Tipo de tarefa: catálogo único + seleção por classe em todos os seletores | MÉDIO |

### Onda 2 — ajustes de uso diário
| Story | Título | Risco |
|---|---|---|
| **W1** | Workflows: suspender, identificador, grupo, editar, rastro nas ações | BAIXO |
| **N1** | Navegação: voltar ao Kanban do tema pelo breadcrumb + Configurações (sistema × perfil) | BAIXO |
| **D1** | Drive: subpasta "Documentos automáticos" (cria, move o existente, passa a usar) | MÉDIO |
| **L1** | Linha do tempo humanizada (mudança de etapa em português) | BAIXO |

### Onda 3 — estrutura
| Story | Título | Risco |
|---|---|---|
| **AU1** | Menu de Auditoria global + busca no caso e no motor | MÉDIO |
| **C1** | Campos do cliente equiparados aos do caso + campo "vinculado" + reordenar | ALTO |
| **T2** | Centralizar tema e vínculo (tira Temas da distribuição; vínculo de usuário no caso) | MÉDIO |

### Onda 4 — integrações e financeiro (POR ÚLTIMO)
| Story | Título | Risco |
|---|---|---|
| ~~TR1~~ | ~~Importação do Trello~~ — **ADIADA pelo owner (2026-08-26): "essa parte ficará para um outro momento"**. Story pronta em `TR1-importacao-trello.md`, esperando decisão. | — |
| **FN1** | Financeiro do caso: receitas/despesas internas, tipos, status, reembolsável (SEM API) | ALTO |
| **FN2** | ContaAzul: fazer/revisar lançamento, contrato recorrente e as 24 competências | ALTO |

---

## Regras que valem para TODAS as stories

- **Migrations aditivas e idempotentes** (`ADD COLUMN IF NOT EXISTS`), rollback simétrico, aplicadas via
  `npx tsx scripts/db-apply-pg.ts` (o CLI do Supabase não roda no Windows/OneDrive) — **dev = prod**.
- **Gate de escrita** pelo módulo (`requireModule` / `requireAnyModule(..., "edit")` no servidor,
  `usePodeEditar` no cliente). Nunca afrouxar o que já está gateado.
- **Best-effort nunca derruba a operação principal** (padrão do `workflow-engine` e do writeback ProJuris).
- `npm run typecheck` + `npm run lint` limpos antes de fechar qualquer story.
- Cada story lista **as pastas e abas afetadas** — se um arquivo aparece em duas stories, a segunda a ser
  implementada re-lê o arquivo antes de editar.

## Mapa de colisão entre stories (ler antes de paralelizar)

| Arquivo / área | Stories que tocam |
|---|---|
| `src/routes/controladoria.distribuicao.*` | MO1, TK1, T1, T2, AU1 |
| `src/components/cases/CaseTimeline.tsx` | L1, AU1, W1 |
| `src/components/cases/CaseDossie.tsx` | TK1, T1, W1 |
| `src/lib/case-documents-service.ts` | D1 |
| `src/routes/configuracoes.campos-personalizados.tsx` | C1 |
| `src/lib/dossie-service.ts` | TK1, W1 |
| `src/routes/casos.$id.index.tsx` | N1, L1, AU1, TR1, FN1 |

---

## Índice das stories (arquivos)

| ID | Arquivo | Itens do owner atendidos |
|---|---|---|
| MO1 | `MO1-motor-intimacao-andamento-e-ui.md` | extras da reunião (tag/filtro, marcar lido, busca, scroll, visual) |
| TK1 | `TK1-status-tarefa-projuris.md` | 12 |
| T1 | `T1-tipo-tarefa-catalogo-unico-e-classe.md` | 2, 13 (tipos) |
| W1 | `W1-workflows-identificador-grupo-editar.md` | 3, 4, 5, 6, 7 |
| N1 | `N1-navegacao-tema-e-configuracoes.md` | 8 + Configurações sistema × perfil |
| D1 | `D1-drive-subpasta-documentos-automaticos.md` | 9 |
| L1 | `L1-timeline-mudanca-de-etapa-humanizada.md` | 10 |
| AU1 | `AU1-auditoria-global.md` | 11 |
| C1 | `C1-campos-do-cliente-equiparados.md` | 1 + campo vinculado + reordenar |
| T2 | `T2-centralizar-tema-e-vinculo-no-caso.md` | 13 (tema e vínculo) |
| ~~TR1~~ | `TR1-importacao-trello.md` | extra (Trello) — **ADIADA** |
| FN1 | `FN1-financeiro-do-caso-registros-internos.md` | financeiro (doc 25.08) |
| FN2 | `FN2-contaazul-lancamento-e-recorrencia.md` | ContaAzul (doc 25.08) |

**Cobertura:** os 13 itens da lista do owner estão distribuídos nas 13 stories acima — nenhum ficou de fora.

## Decisões de arquitetura travadas (2026-08-26, segunda rodada)

| # | Pergunta | Decisão |
|---|---|---|
| 11 | **T2** — a aba **Vínculos** (caso ↔ processo ProJuris) fica no menu do motor? | **Fica.** É a saída manual quando o casamento automático não casa. A story T2 não a toca. |
| 12 | **T2** — onde entra o responsável do caso na precedência? | **Depois** dos exclusivos e **antes** da distribuição por pontos, **só** quando o caso tiver **1** responsável. |
| 13 | **FN1** — reusar `system_parcelas`? | **Não.** Tabelas novas; `system_parcelas` fica como cobrança emitida. Vínculo entre as duas só na FN2. |

**Todas as 13 stories estão liberadas para execução.**

## Único item ainda em aberto

- **FN2 — spike da API do ContaAzul** (4 perguntas: venda/contrato recorrente, contas a pagar, categorias/centro de custo, importação por IA). Não trava nenhuma outra story: é a **última** da fila e o spike é a primeira task dela.
