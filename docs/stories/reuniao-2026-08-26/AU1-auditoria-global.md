# Story AU1: Menu de Auditoria (global, no caso e no motor) — e a linha do tempo para de mostrar alteração de campo

**Épico:** Reunião 2026-08-26 · **ID:** AU1 (item 11 do owner) · **Onda:** 3 · **Status:** Draft
**Executor:** @dev (tela + serviço) + @data-engineer (diff com valor anterior) · Quality gate: @qa
**Risco:** MÉDIO — tela nova + mudança no formato do `diff` (precisa conviver com o formato antigo).

---

## Story

**Como** administrador,
**quero** um menu de **Auditoria** onde eu pesquise **quem mexeu no quê e como**, com essa busca disponível **também dentro do caso e dentro do motor**,
**para que** a linha do tempo do caso volte a ser sobre o **caso**, e não sobre cada campo que alguém editou.

Thiago: "essa mudança de dado do serviço, campo atualizado, eu acho que não precisa vir para a linha do tempo. Dá para a gente pensar em ter um menu de auditoria onde essa informação aparece, que a gente sabe qual é o campo, quem mexeu e como mexeu… era A e agora virou B."

**Decisão do owner (26/08):** **menu global** — "tudo precisa ter para pesquisa, até no caso e no motor também".

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Tabela de eventos:** `system_case_events` (`supabase/migrations/20260523000004_cases.sql:98`) —
  `case_id, organization_id, action, from_macrostatus_op, to_macrostatus_op, diff (jsonb), triggered_by, created_at`.
  **Já é uma trilha de auditoria** — só não tem tela nem valor anterior.
- **O evento em questão:** `canonical_fields_updated`, gravado em `src/lib/cases-service.ts:1221-1227`, com
  `diff = patch` — **só os valores NOVOS**, sem o anterior.
- **Exibição hoje:** `CaseTimeline.tsx:87` e `CaseFeed.tsx:125` — "Dados do serviço atualizados: Campo A, Campo B"
  (`describeChangedFields`, linha ~48, lê as chaves do diff).
- **Execuções de automação:** `system_workflow_runs` (rule_id, case_id, event_key, status, detail) — hoje sem tela.
- **Auditoria do motor já existe em parte:** abas **Hist. andamentos**, **Hist. tarefas** e **Execuções**
  (`controladoria.distribuicao.historico-andamentos.tsx`, `historico-tarefas.tsx`, `historico.tsx`),
  além de `action_by` gravado nas decisões (auditoria de 10/08).
- **Menu lateral:** `src/components/hv/Sidebar.tsx:122` — grupo **Sistema** (Referências, Permissões, Configurações).
- **RBAC:** `requireModule("sistema")` / `usePodeEditar("sistema")`; visibilidade por papel em `src/lib/visibility.ts`.

### NOVO

1. **Rota `/auditoria`** — busca global sobre `system_case_events`, com filtros.
2. **`diff` com valor anterior** para `canonical_fields_updated`: `{ from: {...}, to: {...} }`, mantendo leitura do formato antigo.
3. **`canonical_fields_updated` sai da linha do tempo** (continua gravado, só não é exibido lá).
4. **Painel de auditoria dentro do caso** (mesma busca, já filtrada por aquele caso).
5. **Atalho no motor** para a auditoria filtrada pelo contexto da distribuição.

---

## Acceptance Criteria

1. **Menu global.** Existe `/auditoria`, acessível pelo grupo **Sistema** do menu lateral, com gate `sistema:view` (quem não tem, não vê o item nem entra pela URL).
2. **O que a tela mostra.** Uma linha por evento com: **data/hora**, **quem** (nome do usuário de `triggered_by`, não UUID), **caso** (código, clicável), **o que aconteceu** (rótulo em português) e, para alteração de campo, **campo: de → para**.
3. **Filtros.** Por período (data inicial/final), por usuário, por caso (código ou cliente), por tipo de ação e por texto livre (nome do campo). Os filtros combinam entre si.
4. **Valor anterior.** A partir desta story, `canonical_fields_updated` grava `{ from, to }`. Eventos **anteriores** (só com o valor novo) continuam aparecendo, exibindo "— → valor" sem quebrar a tela.
5. **Linha do tempo limpa.** `canonical_fields_updated` **não aparece mais** em `CaseTimeline` nem em `CaseFeed`. Mudança de etapa, tarefas, documentos, notas e prazos continuam aparecendo normalmente.
6. **Dentro do caso.** A ficha do caso tem acesso à auditoria **daquele caso** (painel ou aba, já filtrado) — sem precisar ir ao menu global e filtrar na mão.
7. **No motor.** A área de distribuição tem atalho para a auditoria (a partir do histórico/execuções), levando à mesma tela com o filtro pré-aplicado.
8. **Paginação.** A tela pagina (ou faz scroll infinito) e **nunca** carrega a tabela inteira de uma vez — `system_case_events` cresce rápido.
9. **Nada deixa de ser gravado.** Nenhum evento some do banco. A story é de leitura + um campo a mais no diff.
10. **Regressão.** `typecheck` + `lint` limpos; a timeline continua correta para todos os outros eventos.

---

## Tasks / Subtasks

### T1 — Diff com valor anterior (@dev)
- [ ] `cases-service.ts` (~linha 1218): montar `diff = { from: <valores atuais das chaves do patch>, to: patch }` usando o `before` que a função **já tem em mãos**. Manter `manual` se já existir. (AC-4)
- [ ] Garantir que o merge atômico em JSONB (migration `20260824000005`) continua intacto — **não** reintroduzir read-modify-write. (AC-9)

### T2 — Serviço de auditoria (@dev)
- [ ] `src/lib/auditoria-service.ts` (server-only): `listAuditEvents({ from, to, userId, caseId, action, q, limit, cursor })` com join de nome de usuário e código do caso; paginação por `created_at` + id. (AC-2, AC-3, AC-8)
- [ ] `src/rpc/auditoria.ts` com gate `requireModule("sistema", "view")`. (AC-1)

### T3 — Tela global (@dev)
- [ ] `src/routes/auditoria.tsx` — filtros no topo, tabela paginada, código do caso clicável. (AC-1, AC-2, AC-3, AC-8)
- [ ] `Sidebar.tsx` — item **Auditoria** no grupo Sistema, gate `sistema:view`. (AC-1)
- [ ] Rótulos em português: reusar o módulo de texto de evento criado em **L1** (`case-event-label.ts`) para não ter duas traduções. (AC-2)

### T4 — Tirar da timeline (@dev)
- [ ] `CaseTimeline.tsx` e `CaseFeed.tsx`: filtrar `canonical_fields_updated` na camada de apresentação (mesmo padrão do filtro `fin_` já existente, linha ~172). (AC-5)

### T5 — No caso e no motor (@dev)
- [ ] Painel/aba de auditoria na ficha do caso, reusando o componente da tela global com `caseId` fixo. (AC-6)
- [ ] Atalho na área de distribuição (aba Execuções/Histórico) para `/auditoria` com filtro pré-aplicado. (AC-7)

### T6 — QA (@qa)
- [ ] Editar 3 campos de um caso: **não** aparece na linha do tempo; **aparece** na auditoria com de → para. (AC-4, AC-5)
- [ ] Evento antigo (antes da story) aparece sem quebrar. (AC-4)
- [ ] Filtros combinados (usuário + período + campo). (AC-3)
- [ ] Usuário sem `sistema:view`: não vê o menu e recebe 403 na URL. (AC-1)
- [ ] Caso com histórico longo: a tela pagina e não trava. (AC-8)

---

## Dev Notes

- **A trilha já existia** — o que faltava era tela. Não criar tabela nova de auditoria: `system_case_events` **é** a trilha, e duplicar geraria duas versões da verdade.
- **Formato do diff muda, leitura tem que aceitar os dois.** Regra prática: se o diff tem `from`/`to`, usa; senão, trata o objeto inteiro como "to" e mostra "—" no anterior.
- **Nomes, não UUIDs.** O mesmo tropeço já corrigido nos gráficos do motor (auditoria de 10/08): resolver `triggered_by` para nome.
- **Paginar desde o primeiro dia.** Essa tabela recebe evento de todo caso, todo dia.
- **Escopo v1 = eventos de caso.** Auditoria de mudanças de **configuração** (tipos de tarefa, temas, permissões) **não** entra aqui — não há trilha para isso hoje e criar seria outra story. Se o Thiago pedir, vira AU2.

## Testing

- **Dados reais** de um caso muito editado.
- **Compatibilidade:** eventos antes e depois da mudança de formato na mesma tela.
- **Gates:** typecheck + lint.

## Dependências

- **L1 primeiro** (extrai o módulo de rótulo de evento que esta story reusa e mexe nos mesmos 2 arquivos).
- **C1** também mexe em campos do caso, mas em outro arquivo — sem colisão.

## File List

**Novos**
- `sistema-hv/src/lib/auditoria-service.ts`
- `sistema-hv/src/rpc/auditoria.ts`
- `sistema-hv/src/routes/auditoria.tsx`
- `sistema-hv/src/components/cases/CaseAuditPanel.tsx`

**Alterados**
- `sistema-hv/src/lib/cases-service.ts` (diff com `from`/`to`)
- `sistema-hv/src/components/cases/CaseTimeline.tsx` · `CaseFeed.tsx`
- `sistema-hv/src/components/hv/Sidebar.tsx`
- `sistema-hv/src/routes/casos.$id.index.tsx` (painel no caso)
- `sistema-hv/src/routes/controladoria.distribuicao.historico.tsx` (atalho)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial; owner escolheu menu global com busca também no caso e no motor | @sm (River) |
