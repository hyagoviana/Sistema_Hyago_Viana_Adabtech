# Story S5-01: Modelo de permissões — papéis da matriz, módulo Cliente e nível Configurar

- **Sprint:** S5 — Permissões
- **ID:** S5-01 · **Item do Thiago:** 15 · **Decisão:** D2
- **Status:** Ready for Review
- **Estimativa relativa:** G
- **Executor sugerido:** @dev + @data-engineer · Quality gate: @architect + @qa

---

## Story

**Como** administrador,
**quero** que o sistema tenha os papéis que o escritório realmente usa, o módulo **Cliente** e um terceiro
nível de acesso (**Configurar**),
**para que** a régua de permissão do sistema seja a mesma régua da tabela que o Thiago desenhou.

---

## Contexto

Thiago, na reunião (bloco 2, 15:06 e 18:01): *"a gente tem perfil, a gente tem nível de acesso e a gente
tem cargo. Tá bem redundante. Cargo (...) é interessante manter (...) mas esse nível de acesso e esse
perfil acho que dá para virar uma coisa só. (...) Esse usuário padrão vai ser dividido por área."* E:
*"continua dessa mesma forma, só adiciona uma outra opção que é uma opção de configurar, que aí já não é
mais ele preencher, por exemplo, a informação do campo personalizado ou mudar de Kanban. Ele mudar um
Kanban, mudar o tema."*

Matheus resumiu e ele confirmou: *"além de editar, que seria o operacional, você quer um configurar, que
seria estratégico"*.

**Hoje** (`src/lib/rbac.ts`): 9 papéis (`admin`, `advogado_titular`, `advogado_associado`,
`prestador_externo`, `controladoria`, `comercial`, `financeiro`, `operacional`, `marketing`);
níveis `none | view | edit`; módulos `comercial · operacional · financeiro · controladoria ·
inteligencia · marketing · sistema · judicial`; defaults **derivados em código** de `ROLE_NAV` +
`ROLE_CAPABILITIES`; override **por usuário** em `system_user_module_perms`.

**Matriz alvo** (02.09.docx): Administrador · Coordenador · Financeiro · Controladoria · Suporte ·
Atendimento (antigo comercial) · Operacional · Estagiário · Marketing, sobre os módulos
Cliente · Operacional · Comercial · Financeiro · Controladoria · Marketing · Sistema/usuários.

---

## Acceptance Criteria

1. **Papéis**: a lista passa a ser a da matriz. Os papéis atuais que não estão nela são mantidos apenas
   como valores legados aceitos no banco até a **S5-04** concluir o de-para (nenhum usuário fica sem papel
   em nenhum momento).
2. **Módulo `cliente`** entra na lista de módulos (CHECK da tabela + `MODULES` no rbac + rótulo).
   Os módulos `inteligencia` e `judicial` continuam existindo (não estão na matriz, mas estão no sistema).
3. **Nível `configure`** entra: ordem `none < view < edit < configure`, com `configure ⊃ edit ⊃ view`.
   `accessAllows` passa a tratar a nova ação `configure`.
4. **Defaults por papel viram dado**, não código: nova tabela `system_role_module_perms`
   (`role`, `module`, `access`), populada pela matriz do documento. `rbac.ts` passa a ler dela, com o
   mapa derivado atual como **fallback** se a tabela estiver vazia (regressão zero no deploy).
5. **Precedência preservada**: override por usuário (`system_user_module_perms`) > padrão do papel.
   `permissaoEfetiva` ganha a ação `configure` sem mudar o comportamento das ações existentes.
6. A régua especial do módulo **financeiro** (hoje: só admin e financeiro por padrão, decisão de 18/07)
   é **substituída pela matriz** — que já define financeiro por papel. Registrar a mudança no comentário
   do código, para não parecer regressão acidental.
7. `system_user_module_perms.access` aceita `configure` (CHECK atualizado) — override pode conceder
   Configurar a uma pessoa específica (o "supervisorzinho" do Adavio).
8. Testes do `rbac`: matriz do documento reproduzida célula a célula; `configure` implica `edit` e `view`;
   override vence o padrão; papel desconhecido → sem acesso.
9. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [x] Migration: tabela `system_role_module_perms` + seed da matriz + CHECKs (`module` com `cliente`,
      `access` com `configure`) + RLS/grants no padrão das demais `system_*` (AC 2, 3, 4, 7).
- [x] `rbac.ts`: papéis, módulos, `ModuleAccess`/`ModuleAction`, `accessAllows`, leitura dos defaults
      da tabela com fallback (AC 1-6).
- [x] `rbac-perms-service.ts`: carregar defaults + overrides numa consulta (AC 5).
- [x] Atualizar `rbac.test.ts` com a matriz (AC 8).

---

## Dev Notes

- **Cargo continua separado** (`system_users.cargo`): o motor e o cálculo de sucumbência usam. Nada de
  fundir cargo com papel — isso é a S5-03 (que funde *perfil* com *nível de acesso*, não com cargo).
- Esta story **não muda tela nem tira acesso de ninguém**: entrega o modelo. Quem aplica é a S5-02 (tela)
  e a S5-04 (de-para).
- Cuidado com a ordem de deploy: migration antes do código que lê a tabela.

## Definition of Done

- [ ] Matriz do Thiago reproduzida em teste automatizado
- [ ] Nenhum usuário perde acesso neste passo
- [ ] typecheck + lint + testes verdes

---

## Dev Agent Record (03/09/2026)

**Migration `20260903000001_permissoes_matriz_thiago.sql` — APLICADA no banco** (via `db-apply-pg.ts`,
já que o CLI do Supabase não roda nesta máquina):
- papéis novos no CHECK de `system_users.role`: `coordenador`, `suporte`, `atendimento`, `estagiario`
  (os legados continuam aceitos);
- módulo `cliente` e nível `configure` em `system_user_module_perms`;
- tabela `system_role_module_perms` (padrão por papel vira dado editável), com RLS e grants no padrão
  das demais `system_*`.

**Decisão que garante regressão zero — leia antes de mexer:** o seed cobre **só os quatro papéis novos**,
que ninguém tem ainda. Papel **sem linhas** na tabela cai no mapa derivado de sempre. É por isso que
nenhum dos 41 usuários muda de acesso hoje. As linhas dos papéis antigos entram na **S5-04**, no mesmo
passo do de-para revisado pelo owner — e é lá que a matriz passa a valer para todos.

**Código:**
- `rbac.ts`: 13 papéis (9 da matriz + 4 legados), módulo `cliente`, `ModuleAccess`/`ModuleAction` com
  `configure`, e a escada `none < view < edit < configure` num mapa numérico (a função antiga ficou ao
  lado, renomeada, como referência do que foi substituído).
- `permissaoEfetiva` ganhou um 5º parâmetro **opcional** (`roleDefaults`). Precedência:
  **override do usuário > padrão do papel (tabela) > mapa derivado**.
- `rbac-perms-service.ts`: `getRoleModuleDefaults(role)` com cache de 1 min e a mesma postura defensiva
  do arquivo (erro ⇒ `{}` ⇒ cai no papel).
- `auth-guard.ts`: `requireModule` e `requireAnyModule` passam o padrão do papel.
- `rpc/permissions.ts`: o RPC que alimenta o front devolve **padrão do papel mesclado com os overrides**
  — sem isso a UI e o servidor divergiriam para os papéis novos (botão aparece, ação dá 403).

**Teste:** `rbac.test.ts` teve o oráculo estendido para o módulo `cliente`, e a contagem de combinações
virou **derivada** (`ROLES × MODULES × ações`) em vez de um número fixo — acrescentar papel ou módulo não
"quebra" mais um teste que só contava linhas. As 182 combinações batem com `can`/`canSeeRoute`.

---

## QA Results — 03/09/2026 (Quinn)

**Gate: PASS**

`scripts/qa-permissoes-matriz.ts` (também em `npm run qa:permissoes`) roda contra o **banco real**.
17/17 verificações:

**Matriz semeada** — coordenador configura o operacional, edita o financeiro e só vê o sistema;
atendimento edita cliente e não tem financeiro. Bate célula a célula com o documento do Thiago.

**Regressão zero, provada e não afirmada** — para os 5 papéis em uso (`admin`, `operacional`,
`financeiro`, `advogado_titular`, `prestador_externo`), a permissão efetiva **com** a nova camada é
idêntica à **sem** ela, nas 8 dimensões × 2 ações: **0 divergências**. E os 41 usuários continuam com
papel reconhecido pelo rbac.

**Precedência** — override do usuário derruba o padrão do papel; sem override, o padrão vale.

**Escada** — `configure` cobre `edit`; `edit` **não** cobre `configure`; `view` não cobre `edit`.

### Observações para as próximas stories

1. **`src/lib/supabase/types.ts` está desatualizado** (é gerado pelo CLI do Supabase, que não roda nesta
   máquina). Por isso a leitura de `system_role_module_perms` usa um cast tipado e localizado, com
   comentário. Quando alguém rodar `npm run db:types` num ambiente que suporte o CLI, o cast sai.
2. **`seesOnlyOwnCases` ainda lista só os papéis legados** (`advogado_*`, `prestador_externo`). Se o
   de-para da S5-04 converter o prestador externo em Operacional sem override, ele passa a **ver a base
   toda** — é exatamente o ponto que está na pergunta C3.1 ao Thiago. Não mexer nisso sem a resposta.
3. `MODULE_HAS_VALUES` (a chave "ver valores") não foi estendido ao módulo `cliente`; o gate de $ da
   ficha do cliente continua pendurado no `financeiro`, como antes. Correto por ora — mas é o tipo de
   coisa que a S5-02 vai querer expor na tela.
