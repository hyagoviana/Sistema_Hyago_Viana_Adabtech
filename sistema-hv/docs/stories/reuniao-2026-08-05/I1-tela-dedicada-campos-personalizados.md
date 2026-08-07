# I1 — Tela dedicada de "Campos personalizados" em Configurações

- **Épico:** Reunião 2026-08-05 — Melhorias de UX / organização
- **Risco:** BAIXO (reorganização de navegação + reuso de componentes; sem migration)
- **Status:** Ready for Review
- **Depende de:** B1 (campo cliente→caso, `ClientFieldsManagerDialog` com toggle "Aparece nos casos") + B3 (gate admin `usePodeEditar('sistema')` / `requireModule('sistema','edit')`) — ambos já implementados.

## Contexto

Hoje os campos personalizados por pipeline só são editáveis pelo quadradinho
contextual "Editar campos" no topo do Kanban (`CaseFiltersPanel`), e os campos do
cadastro do cliente por um dialog dentro de Clientes (`ClientRoster`). Não há um
lugar único, em tela cheia, para o admin ver/organizar todos os campos.

Esta story cria a rota `/configuracoes/campos-personalizados` (tela cheia) que
**reusa** os componentes existentes (`TemaFieldDefsEditor` e
`ClientFieldsManagerDialog`) sem reescrevê-los, listando as pipelines/temas + o
cadastro do cliente. **NÃO muda a hierarquia** — o campo continua abaixo da sua
pipeline; só melhora a navegação/organização. O atalho contextual "Editar campos"
do Kanban é preservado.

## Acceptance Criteria

- [x] **AC-1** Nova rota `/configuracoes/campos-personalizados` (tela cheia, dentro
  do menu Sistema), gated por `usePodeEditar('sistema')` (B3). Fallback "restrito a
  administradores" quando não pode editar.
- [x] **AC-2** Coluna esquerda lista as **pipelines (temas)** via `useTemas()` +
  um bloco "Cadastro do cliente".
- [x] **AC-3** Ao selecionar um tema, a coluna direita renderiza o
  `TemaFieldDefsEditor` (reuso, `frenteSlug=null` — painel padrão do tema) para
  criar/editar/ocultar/excluir os campos daquela pipeline. Hierarquia inalterada.
- [x] **AC-4** O bloco "Cadastro do cliente" abre o `ClientFieldsManagerDialog`
  (reuso) para os campos do formulário do cliente (com o toggle "Aparece nos
  casos" do B1 intacto).
- [x] **AC-5** Item de menu "Campos personalizados" na sidebar (grupo Sistema), só
  visível para quem pode **editar** o módulo sistema (mesma régua do servidor).
- [x] **AC-6** Atalho contextual "Editar campos" do Kanban (`CaseFiltersPanel`)
  **preservado** — não foi removido nem alterado.
- [x] **AC-7** Atalho em Configurações (card "Campos personalizados") para a nova
  tela, gated por `sistema:edit`.

## Tasks

- [x] Converter `configuracoes.tsx` em layout (`<Outlet />`) e mover o conteúdo
  atual para `configuracoes.index.tsx` (padrão TanStack de rota-pai com filha).
- [x] Criar `configuracoes.campos-personalizados.tsx` reusando `TemaFieldDefsEditor`
  + `ClientFieldsManagerDialog`, com seletor de temas (`useTemas`) e gate B3.
- [x] Adicionar item de menu na sidebar (grupo Sistema) + gate `sistema:edit`.
- [x] Mapear a rota em `ROUTE_MODULE` (`sistema`) no `rbac.ts`.
- [x] Adicionar card-atalho na tela de Configurações (`configuracoes.index.tsx`).
- [x] Regenerar `routeTree.gen.ts` (via `npm run build`) e rodar gates.

## Dev Agent Record

### File List

- `src/routes/configuracoes.tsx` — vira layout `<Outlet />` (rota-pai).
- `src/routes/configuracoes.index.tsx` — **novo**; conteúdo antigo de Configurações
  + card-atalho "Campos personalizados".
- `src/routes/configuracoes.campos-personalizados.tsx` — **novo**; tela dedicada
  (reuso de `TemaFieldDefsEditor` + `ClientFieldsManagerDialog`).
- `src/lib/rbac.ts` — `ROUTE_MODULE['/configuracoes/campos-personalizados'] = 'sistema'`.
- `src/components/hv/Sidebar.tsx` — item de menu "Campos personalizados" + gate
  `permissaoEfetiva(role, perms, 'sistema', 'edit')`.
- `src/routeTree.gen.ts` — regenerado pelo build (arquivo gerado).

### Notas

- **Sem migration** — reusa a infra de campos (`system_tema_field_defs` /
  client field defs) existente.
- **Hierarquia intacta:** o `TemaFieldDefsEditor` é o MESMO componente usado no
  Kanban; só mudou a navegação (tela cheia em vez do popover).
- **`routeTree.gen.ts`:** regenerado via `npm run build` (outro agente pode tocar
  o mesmo arquivo em paralelo — é gerado; basta rebuildar em caso de conflito).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-05 | v0.1 | Story criada | @sm |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Rota `/configuracoes/campos-personalizados` (tela cheia) reusando `TemaFieldDefsEditor` + `ClientFieldsManagerDialog`; `configuracoes.tsx`→Outlet + novo `configuracoes.index.tsx`; item de menu na sidebar + gate `sistema:edit`; `ROUTE_MODULE` atualizado; card-atalho em Configurações. Kanban "Editar campos" preservado. Sem migration. Gates: `npm run build` OK (routeTree regenerado), `tsc --noEmit` limpo (só erro pré-existente `contaazul/service.ts`), `eslint` 0 nos arquivos tocados. | @dev |

## Status: Ready for Review
