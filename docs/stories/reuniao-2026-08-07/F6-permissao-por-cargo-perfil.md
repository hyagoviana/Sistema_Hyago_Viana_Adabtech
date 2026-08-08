# Story F6: Permissão/visibilidade por CARGO/PERFIL (templates em massa) — "todo Coordenador vê X", com override individual

- **Épico:** Futuro (pós-segunda) — Reunião 2026-08-07
- **ID:** F6
- **Status:** Backlog / Futuro
- **Estimativa relativa:** L
- **Executor sugerido:** @architect (design) + @dev + @data-engineer · Quality gate: @qa
- **Risco:** MÉDIO/ALTO — mexe na FONTE ÚNICA de permissão (`rbac.ts`) e na precedência override×papel. Alto potencial de regressão de segurança se a ordem de precedência não for provada por teste. **Não iniciar sem design fechado (spike).**
- **Origem:** Retorno do Thiago 2026-08-08 (`docs/reunioes/dados-thiago-2026-08-08.md`, seção **"Permissão por CARGO/Perfil (áudio 4 — FUTURO)"**): *"Ele deixou Perfil/Cargo (Coordenador, Prestador de serviço, etc.) pensando em regra de visualização por cargo — definir permissão por cargo, não só pessoa a pessoa. Feature futura."* Relaciona com **M8** (que introduz Perfil/Cargo no cadastro) e reusa o RBAC por módulo de **R3** (`system_user_module_perms` / `rbac.ts`).

> **FEATURE FUTURA (pós-segunda).** Esta story é backlog: descreve o **modelo** e a **direção**, não é para implementar agora. O sistema já tem override **por pessoa×módulo** (`system_user_module_perms`); F6 adiciona uma camada **por perfil/cargo** que se aplica **em massa**, com o override individual continuando a vencer. Sem quebrar a régua atual.

---

## Story

**Como** administrador do escritório,
**quero** definir **templates de permissão por PERFIL e por CARGO** (ex.: "todo **Coordenador** vê Controladoria; todo **Financeiro** edita Financeiro; **Prestador de serviço** só vê os casos vinculados"), aplicáveis **em massa** a todos que têm aquele perfil/cargo,
**para** deixar de configurar **pessoa a pessoa** no editor de permissões — mantendo a possibilidade de **override individual** para exceções pontuais.

> **DECISÕES DE DIREÇÃO (a validar no spike):**
> 1. **Duas dimensões distintas** (introduzidas em M8): **Perfil** (`Administrador`/`Usuário padrão`/`Coordenador`/`Financeiro`) e **Cargo/nível** (`Sênior`/`Júnior`/`Estagiário`/`Prestador de serviço`/`Administrador`). O template de permissão é ancorado numa dessas dimensões (provável: **Perfil**, que é o eixo "de permissão"; Cargo é mais operacional). Fechar no spike qual dimensão (ou ambas) dirige o template.
> 2. **Precedência (crítica):** **override individual > template de perfil/cargo > papel base (`ROLE_MODULE_ACCESS`)**. O `permissaoEfetiva` de `rbac.ts` hoje faz `override > papel`; F6 insere o **template** no meio, sem inverter a precedência existente. Regressão zero: sem template e sem override, o comportamento é idêntico ao de hoje.
> 3. **Aplicação em massa, não cópia:** o template é uma **regra viva** (mudou o template → muda para todos daquele perfil que não têm override), não um "copiar para cada usuário". Isso mantém a fonte da verdade única.
> 4. **Reusa o modelo por módulo (R3):** o template é `perfil × módulo → none/view/edit` (mesmos módulos e níveis de `system_user_module_perms`), mais a chave "ver valores" (R$) por módulo quando aplicável (`MODULE_HAS_VALUES`).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **RBAC por módulo (fonte única) — R3:** `sistema-hv/src/lib/rbac.ts`:
  - `MODULES` (`comercial`/`operacional`/`financeiro`/`controladoria`/`inteligencia`/`marketing`/`sistema`), `ModuleAccess` (`none`/`view`/`edit`), `ModuleAction` (`view`/`edit`).
  - `ROLE_MODULE_ACCESS` — mapa BASE papel→módulo→acesso (derivado de `ROLE_NAV`/`ROLE_CAPABILITIES`), com a régua especial do `financeiro` (só admin/financeiro por padrão).
  - **`permissaoEfetiva(role, overrides, module, action)`** — **precedência atual: override > papel**. É a função PURA onde F6 precisa inserir o template (nova camada intermediária), preservando o contrato/testes existentes.
  - `podeVerValores(...)` (chave "ver valores"/R$ por módulo, `MODULE_HAS_VALUES`), `canSeeRouteEfetiva(...)`, `ROUTE_MODULE`.
- **Override individual (tabela) — R3:** `system_user_module_perms` (`user_id`, `module`, `access` `none/view/edit`, UNIQUE `(user_id, module)`) — migration `20260718000001_user_module_perms.sql` + RLS em `...000007`. É o modelo que o template espelha (mas por perfil, não por usuário).
- **Perfil/Cargo no cadastro — M8:** M8 introduz o **Perfil** (`Administrador`/`Usuário padrão`/`Coordenador`/`Financeiro`) e o **Cargo/nível** no `system_users`. F6 depende desses campos existirem para ancorar o template.
- **Chave "ver valores" (R$) — Fase B:** `MODULE_HAS_VALUES` + `podeVerValores` em `rbac.ts` — o template por perfil também precisa cobrir essa chave (para "todo Financeiro vê R$").
- **Editor de permissões (UI atual):** a tela de Permissões (`/permissoes`) edita hoje o override **por usuário×módulo**. F6 adiciona uma aba/seção "por perfil/cargo".

### NOVO (a construir nesta story — quando sair do backlog)

- **Tabela de template:** `system_role_module_perms` (ou `system_profile_module_perms`) — `(organization_id, profile /* ou cargo */, module, access, valores?)`, UNIQUE `(organization_id, profile, module)`. Espelha `system_user_module_perms` mas ancorada no **perfil/cargo**, não no usuário. Migration aditiva + RLS org-scoped + grants padrão `system_*` + rollback + `db:types`.
- **Nova camada em `permissaoEfetiva`:** assinatura estendida para receber (além dos overrides individuais) os **templates do perfil/cargo do usuário**; precedência **override individual > template > papel base**. Provar por teste de tabela que, sem template e sem override, o resultado é BIT-A-BIT igual ao atual (regressão zero — mesmo espírito do teste de R3-01).
- **Carregamento dos templates:** onde hoje o app carrega `system_user_module_perms` do usuário, passar a carregar também os templates do perfil/cargo dele (1 fetch por sessão; cacheável) e injetá-los em `permissaoEfetiva`/`canSeeRouteEfetiva`/`podeVerValores`.
- **UI de gestão de templates:** na tela de Permissões (admin), aba "Perfis/Cargos": grade `perfil × módulo → none/view/edit` (+ "ver valores"), aplicável em massa. Mostrar, ao editar um usuário, se o valor vem do **template** (herdado) ou de um **override individual** (com botão "voltar ao template").
- **Migração de dados (opcional):** ferramenta para "promover" overrides individuais repetidos em template de perfil (não obrigatório; nice-to-have).

---

## Acceptance Criteria

> ACs de DIREÇÃO (backlog). Serão detalhados/particionados quando a story entrar em sprint.

1. **Modelo de template por perfil/cargo:** existe uma tabela `perfil(ou cargo) × módulo → acesso` (+ chave "ver valores"), org-scoped, UNIQUE por `(org, perfil, módulo)`, aditiva e com RLS/grants no padrão `system_*`. Rollback + `db:types`.
2. **Precedência correta e provada:** `permissaoEfetiva` passa a resolver **override individual > template de perfil/cargo > papel base**. Teste de tabela prova regressão ZERO quando não há template nem override (idêntico ao comportamento atual de `rbac.ts`).
3. **Aplicação em massa:** alterar o template de um perfil muda a permissão efetiva de **todos** os usuários daquele perfil que **não** têm override individual do módulo, sem editar cada usuário.
4. **Override individual vence:** um usuário com override individual num módulo ignora o template do perfil para aquele módulo (a UI indica claramente "override individual" vs "herdado do perfil").
5. **Cobre "ver valores" (R$):** o template consegue expressar "todo Financeiro vê R$" via a chave de valores por módulo (`MODULE_HAS_VALUES`/`podeVerValores`), com a mesma precedência.
6. **UI admin de templates:** admin edita a grade `perfil × módulo` (+ valores) numa aba dedicada de `/permissoes`; ao editar um usuário, vê a origem do valor (template/override) e pode "voltar ao template".
7. **Autorização/segurança/regressão:** só **admin** edita templates; `npm run typecheck` + `npm run lint` verdes; RLS org-scoped; nenhuma abertura de acesso não intencional (nenhum perfil ganha módulo que não tinha sem ação explícita do admin); `db:types` regenerado.

---

## Tasks / Subtasks

> Alto nível (backlog). Detalhar ao promover para sprint.

### T0 — Spike de design (@architect) — PRÉ-REQUISITO
- [ ] Fechar a **dimensão do template**: Perfil, Cargo, ou ambos (e ordem entre eles se ambos). Recomendação inicial: **Perfil**.
- [ ] Fechar a **precedência exata** (override individual > template > papel) e desenhar o teste de regressão-zero (espelho do teste de R3-01).
- [ ] Decidir se o template **substitui** o papel base ou **soma** a ele (recomendação: substitui por módulo quando definido; senão cai no papel).

### T1 — Schema (@data-engineer)
- [ ] Tabela de template + RLS + grants + rollback + `db:types`.

### T2 — Núcleo RBAC (@dev + @architect)
- [ ] Estender `permissaoEfetiva`/`canSeeRouteEfetiva`/`podeVerValores` para a camada de template. Testes de tabela (regressão zero + precedência).

### T3 — Carregamento + wiring (@dev)
- [ ] Carregar templates do perfil/cargo do usuário (por sessão) e injetar nos gates de UI e nos gates de servidor (`requireModule`).

### T4 — UI (@dev)
- [ ] Aba "Perfis/Cargos" em `/permissoes` (grade em massa) + indicação template/override no editor de usuário.

### T5 — QA (@qa)
- [ ] Provar precedência e regressão zero; testar aplicação em massa e override; `typecheck`/`lint` verdes.

---

## Dev Notes

**Não inverter a precedência atual.** Hoje `permissaoEfetiva` é `override > papel`. F6 **insere** o template entre eles: `override individual > template de perfil > papel base`. O ponto sensível é que, hoje, "sem override" cai direto no papel; F6 muda para "sem override → tenta template → senão papel". O teste de regressão precisa provar que, **sem** template configurado, `permissaoEfetiva` devolve EXATAMENTE o que devolve hoje (mesmo espírito do teste que provou R3-01).

**Perfil × Cargo × Papel (`role`) — três eixos, não confundir.** O `system_users.role` (o `Role` de `rbac.ts`) é o eixo **existente** que dá a régua base. M8 introduz **Perfil** e **Cargo** como campos NOVOS de cadastro. F6 deve deixar explícito qual eixo dirige o template (provável Perfil) e como ele se relaciona com `role` (o template pode, inclusive, tornar o mapeamento role↔perfil mais direto no futuro — fora de escopo aqui).

**Reuso máximo de R3.** A tabela de template é praticamente a `system_user_module_perms` "com perfil no lugar de user_id". Reusar módulos, níveis (`none/view/edit`), a chave de valores e a UI de grade minimiza risco e mantém a fonte única.

**Segurança acima de conveniência.** Qualquer erro de precedência aqui **abre acesso indevido** (ex.: um perfil ganhar `financeiro:view` e vazar R$). Por isso T0 (spike) é pré-requisito e os testes de precedência são gate duro. Default conservador: sem template explícito, nada muda.

**Migrations via pg direto** (quando implementar): `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (ver `reference_aplicar_migrations_pg_direto`); dev=prod; rollback simétrico.

**Riscos:**
- **R1 — regressão de segurança na precedência.** Mitigação: spike + teste de tabela obrigatório (regressão zero + precedência).
- **R2 — confusão de eixos (Perfil × Cargo × role).** Mitigação: T0 trava a dimensão; UI deixa a origem do valor visível.
- **R3 — "aplicação em massa" surpreender o admin.** Mitigação: preview de "quantos usuários serão afetados" antes de salvar o template; override individual sempre vence.

### Testing
- Sem template e sem override → `permissaoEfetiva` idêntico ao atual (regressão zero).
- Template de perfil aplicado → todos do perfil sem override mudam; com override, não.
- "Todo Financeiro vê R$" via chave de valores.
- Só admin edita template; `typecheck`/`lint` verdes.

---

## Dependências

- **Depende de:**
  - **M8** — campos **Perfil** e **Cargo** no `system_users` (âncora do template). Sem eles, não há dimensão para o template.
  - **R3** — `system_user_module_perms` + `rbac.ts` (`permissaoEfetiva`, `MODULES`, `MODULE_HAS_VALUES`, `canSeeRouteEfetiva`) — base reusada.
- **Bloqueio:** T0 (spike de design da precedência e da dimensão) antes de qualquer código.
- **Relaciona com:** o editor de permissões atual (`/permissoes`), que ganha a aba de templates.

## File List

**A definir na implementação (backlog). Previsto:**
- `sistema-hv/supabase/migrations/2026xxxx_role_module_perms_templates.sql` (+ rollback) — tabela de template por perfil/cargo.
- `sistema-hv/src/lib/supabase/types.ts` — Row/Insert da tabela nova.
- `sistema-hv/src/lib/rbac.ts` — camada de template em `permissaoEfetiva`/`canSeeRouteEfetiva`/`podeVerValores` (precedência override > template > papel).
- `sistema-hv/src/lib/rbac.test.ts` — testes de precedência + regressão zero.
- `sistema-hv/src/lib/users-service.ts` (+ `rpc/`/`hooks/`) — carregar templates do perfil/cargo do usuário.
- Rota/tela `/permissoes` — aba "Perfis/Cargos" (grade em massa) + indicação template/override no editor de usuário.

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial (BACKLOG/FUTURO). Templates de permissão por PERFIL/CARGO aplicáveis em massa, com override individual mantendo precedência. Reusa o RBAC por módulo de R3 (`system_user_module_perms`/`rbac.ts`/`permissaoEfetiva`) e os campos Perfil/Cargo de M8. Nova precedência: override individual > template de perfil/cargo > papel base, com regressão zero provada por teste. Não iniciar sem spike de design (T0). Épico "Futuro (pós-segunda) — Reunião 2026-08-07". | @sm (Bob) |
