# Story I1: Tela dedicada "Campos personalizados" em Configurações (tela cheia)

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** I1 (relaciona-se com I2)
**Status:** Draft
**Estimativa relativa:** M
**Executor sugerido:** @dev (rota + navegação) · Quality gate: @qa
**Risco:** BAIXO (reorganização de UX; consome editores JÁ existentes; NÃO muda hierarquia de dados)

---

## Story

**Como** administrador,
**quero** uma **tela dedicada "Campos personalizados"** dentro de Configurações (tela cheia), que lista **as pipelines/temas** e **o cadastro do cliente**, e ao entrar numa pipeline edita os campos daquela pipeline,
**para que** eu configure os campos num lugar organizado e visível — em vez do "quadradinho" atual ("Editar campos") escondido no topo de cada Kanban/Lista.

Isto é **reorganização de navegação/visualização**: a tela **consome os editores que já existem** (`TemaFieldDefsEditor` para o tema; `ClientFieldsManagerDialog`/seção equivalente para o cliente). **NÃO muda a hierarquia**: o campo continua sendo **abaixo da pipeline** (`system_tema_field_defs` por `tema_id`); só o **acesso** a ele muda de lugar. Ao clicar em "Cliente", a tela leva à configuração de campos do cliente (a mesma de B1/B2 — flag "aparece em caso" + vínculo a temas). Alinha-se com **I2** (menus de configuração como "fonte da verdade" que as telas consomem).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (será consumido, não reescrito)

- **Editor de campos do TEMA:** `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` — recebe `temaId`, `frenteSlug`, `title` e faz todo o CRUD (criar/editar/ocultar/excluir, tipo, opções, `scope`, `hidden_in_list`, `hidden_in_filters`, `max_occurrences`, auto-avanço). É o mesmo componente que hoje abre no dialog "Editar campos".
- **Ponto atual de acesso (o "quadradinho"):** `sistema-hv/src/components/cases/CaseFiltersPanel.tsx:231-266` — botão "Editar campos" (`SlidersHorizontal`) + `Dialog` com `TemaFieldDefsEditor`, sob `podeGerirFiltros` (`:97`, `can(role,"config.manage")`). **Permanece** (atalho contextual); I1 apenas ACRESCENTA a tela dedicada — não remove o atalho, salvo pedido do owner.
- **Editor de campos do CLIENTE:** `sistema-hv/src/components/clients/ClientFieldsManagerDialog.tsx` (lista + form builder). Aberto hoje de `sistema-hv/src/components/clients/ClientRoster.tsx:446`.
- **Lista de temas:** `sistema-hv/src/hooks/useTemas.ts` (`useTemas()`, `:20`) devolve os temas/pipelines para a listagem de entrada.
- **Rota de Configurações:** `sistema-hv/src/routes/configuracoes.tsx` — hoje mostra perfil, senha, aparência e um atalho-card para `/permissoes` (só admin, `:68`). Padrão de card/atalho a espelhar.
- **Rota de Permissões (molde de tela cheia dedicada em Configurações):** `sistema-hv/src/routes/permissoes.tsx` (aba própria extraída de Configurações — mesmo padrão que I1 seguirá).
- **RBAC / módulo `sistema`:** `sistema-hv/src/lib/rbac.ts` — `ROUTE_MODULE["/configuracoes"] = "sistema"` (`:399`); `canSeeRouteEfetiva`. A nova rota entra no mesmo módulo. Gate de escrita = admin (ver Story B3).

### NOVO nesta story

1. **Rota `/configuracoes/campos-personalizados`** (tela cheia), com um **card/atalho** em `configuracoes.tsx` (só admin), espelhando o atalho de `/permissoes`.
2. **Tela de entrada** com duas seções: **(a) Pipelines/Temas** (lista de `useTemas`) e **(b) Cadastro do Cliente** (um item "Cliente").
3. **Ao clicar num tema:** renderiza `TemaFieldDefsEditor` (em tela cheia, não em dialog) daquele `tema_id` — edita os campos daquela pipeline (hierarquia intacta).
4. **Ao clicar em "Cliente":** renderiza o gerenciador de campos do cliente (o mesmo `ClientFieldsManagerDialog` reaproveitado como seção/painel, ou seu conteúdo extraído), incluindo a flag "aparece em caso" + vínculo a temas de B1/B2.
5. **Registro no RBAC/roteamento:** `ROUTE_MODULE` cobre a subrota; navegação de admin.

---

## Acceptance Criteria

1. **Rota dedicada.** Existe `sistema-hv/src/routes/configuracoes.campos-personalizados.tsx` (tela cheia, dentro do módulo `sistema`), acessível só a quem tem `sistema:edit` (admin). Um **card/atalho** em `configuracoes.tsx` (visível só a admin, espelhando o de `/permissoes`) leva a ela.
2. **Entrada em duas seções.** A tela lista: **(a)** as pipelines/temas (via `useTemas`), cada uma clicável; **(b)** um item **"Cadastro do Cliente"** clicável. A hierarquia é comunicada visualmente (o campo é "abaixo" da pipeline/cliente).
3. **Editar campos de uma pipeline.** Clicar num tema abre, na mesma tela (navegação interna ou subrota), o `TemaFieldDefsEditor` daquele `tema_id` (`frenteSlug=null`), com todo o CRUD atual funcionando — **sem** duplicar lógica (reusa o componente).
4. **Editar campos do cliente.** Clicar em "Cadastro do Cliente" abre o gerenciador de campos do cliente (conteúdo do `ClientFieldsManagerDialog`), incluindo (quando B1 estiver mesclado) a flag "aparece em caso" e o vínculo a temas.
5. **Hierarquia inalterada.** Nenhuma mudança de schema nem de fonte de dado: campos do tema continuam em `system_tema_field_defs` por `tema_id`; campos do cliente em `system_client_field_defs`. I1 só muda navegação/visualização.
6. **Atalho contextual preservado.** O botão "Editar campos" do `CaseFiltersPanel` continua funcionando (não é removido nesta story). Editar por qualquer um dos dois caminhos produz o mesmo resultado (mesmo backend).
7. **Gate + regressão.** Não-admin não vê o card nem acessa a rota (redirect/oculto). `npm run typecheck` e `npm run lint` limpos; telas existentes intactas.

---

## Tasks / Subtasks

- [ ] **T1 — Rota + navegação (@dev).** Criar `sistema-hv/src/routes/configuracoes.campos-personalizados.tsx` (tela cheia com `PageHeader`/`Breadcrumb`, padrão de `permissoes.tsx`). Guardar acesso por admin/`sistema:edit`. Verificar necessidade de rota-pai com `Outlet` (gotcha TanStack: rota com filhas precisa de layout explícito — ver memória `reference_tanstack_nested_routes`) caso se opte por subrotas `.$temaId`. (AC1)
- [ ] **T2 — Card em Configurações (@dev).** Em `sistema-hv/src/routes/configuracoes.tsx`, adicionar um card/atalho (só `isAdmin`) para `/configuracoes/campos-personalizados`, espelhando o card de "Usuários e permissões" (`:68-84`). (AC1)
- [ ] **T3 — Tela de entrada (@dev).** Montar a listagem: seção "Pipelines / Temas" (map de `useTemas()`) + seção "Cadastro do Cliente" (item único). Cada item navega para o editor correspondente (estado local de seleção ou subrota). (AC2)
- [ ] **T4 — Editor de tema em tela cheia (@dev).** Ao selecionar um tema, renderizar `TemaFieldDefsEditor` com `temaId` selecionado e `frenteSlug={null}` (sem dialog). Reaproveitar o componente como está. (AC3, AC5)
- [ ] **T5 — Editor de cliente na tela (@dev).** Ao selecionar "Cadastro do Cliente", renderizar o gerenciador de campos do cliente. Preferir extrair o **conteúdo** do `ClientFieldsManagerDialog` para um componente `ClientFieldsManager` (sem `Dialog`) e usá-lo tanto no dialog existente quanto nesta tela, evitando duplicação. (AC4, AC5)
- [ ] **T6 — RBAC/roteamento (@dev).** Adicionar a subrota ao `ROUTE_MODULE` (`rbac.ts`) como `"sistema"` se necessário; garantir que `canSeeRouteEfetiva`/o guard esconda/bloqueie para não-admin. (AC1, AC7)
- [ ] **T7 — QA/gates (@qa).** Navegar admin → card → tela → tema (editar campo) e → cliente (editar campo); confirmar que o atalho antigo do Kanban ainda funciona (AC6); logar não-admin e confirmar ausência do card/acesso. `npm run typecheck`, `npm run lint`. (AC3, AC4, AC6, AC7)

---

## Dev Notes

- **Reuso, não reescrita.** O valor de I1 é organização de UX. `TemaFieldDefsEditor` já é auto-suficiente (recebe `temaId`); só precisa ser renderizado fora do dialog. Para o cliente, extrair o corpo do `ClientFieldsManagerDialog` para um `ClientFieldsManager` reutilizável mantém uma única fonte de verdade da UI (o dialog vira uma casca fina em volta dele). Não recriar CRUD.
- **Hierarquia é sagrada (levantamento I1):** "Mantém a hierarquia (campo é abaixo da pipeline), só melhora a visualização/organização." Nenhum campo passa a existir "solto"; a tela só agrupa os pontos de entrada.
- **Relação com I2:** esta tela é a materialização de "menus de config como fonte da verdade" — o admin configura os campos aqui e as pipelines/ficha consomem. Não implementa I2 inteiro (que abrange tipos-de-tarefa/temas/executores do motor), só a parte de campos.
- **Subrota vs seleção local:** subrotas `configuracoes.campos-personalizados.$temaId.tsx` dão URL compartilhável, mas exigem layout com `Outlet` (gotcha OneDrive/routeTree). Seleção por estado local é mais simples e suficiente para o MVP; decidir na T1 conforme preferência do time.
- **Sem migration.** Story de front/navegação.

## Testing

- **Manual/QA:** admin abre Configurações → card "Campos personalizados" → tela cheia lista temas + Cliente; entra num tema, cria/edita/oculta um campo (persiste); entra em Cliente, cria um campo; confirma que o botão "Editar campos" do Kanban ainda abre o mesmo editor e reflete as mudanças.
- **Gate:** não-admin não vê o card e é bloqueado/redirecionado da rota.
- **Gates:** `npm run typecheck` e `npm run lint` limpos.
- **Smoke UI** (Playwright, `scripts/smoke-ui.ts`): navegação até a tela e edição de um campo de tema por ela.

## Dependências

- **B1/B2** para a parte "Cliente" exibir a flag "aparece em caso" + vínculo a temas (a tela funciona sem B1, mostrando só o form builder atual do cliente; ganha os controles de vínculo quando B1 mesclar).
- **B3** garante o gate admin dos endpoints consumidos (a tela apenas os invoca).
- Reusa `TemaFieldDefsEditor`, `ClientFieldsManagerDialog` (a extrair) e `useTemas`.

## File List

**Novos**
- `sistema-hv/src/routes/configuracoes.campos-personalizados.tsx`
- (opcional) `sistema-hv/src/components/clients/ClientFieldsManager.tsx` (conteúdo extraído do dialog, reutilizável)

**Alterados**
- `sistema-hv/src/routes/configuracoes.tsx` (card/atalho admin)
- `sistema-hv/src/components/clients/ClientFieldsManagerDialog.tsx` (vira casca do `ClientFieldsManager`, se extraído)
- `sistema-hv/src/lib/rbac.ts` (`ROUTE_MODULE` da subrota, se necessário)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
