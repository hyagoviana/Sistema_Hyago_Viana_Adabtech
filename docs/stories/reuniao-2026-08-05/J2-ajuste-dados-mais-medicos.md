# Story J2: Ajuste dos casos Mais Médicos importados — nome do caso editável, CPF preenchível na ficha, e fim do "tema = caso" redundante na lista

- **Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
- **ID:** J2
- **Status:** Ready for Review
- **Estimativa relativa:** S/M
- **Executor sugerido:** @dev + @data-engineer · Quality gate: @qa
- **Risco:** BAIXO — edição de campos existentes (`caso_pasta_nome`, `cpf_cnpj`) na ficha + ajuste de UI/dados; sem schema novo. Cuidado com o UNIQUE parcial `(organization_id, cpf_cnpj)` ao trocar o CPF-marcador pelo CPF real.
- **Origem:** Levantamento 2026-08-05, Bloco **J** (itens **J2** e **J3**). Relaciona-se diretamente com a **A8** (ETL Mais Médicos) da reunião 2026-08-03 — os casos importados manualmente ficaram sem CPF e sem "caso/documento" vinculado, por isso a lista mostra **tema = caso** ("Mais Médicos") repetido.

---

## Story

**Como** administrador/equipe operacional (Dr. Thiago),
**quero** poder **alterar o nome do caso** dos casos Mais Médicos importados, **preencher o CPF** de cada cliente pela ficha (substituindo o marcador `CL-XXXX`), e que a **lista deixe de repetir "tema = caso"** ("Mais Médicos" nas duas colunas) quando o caso já tiver um nome próprio,
**para** que a base importada (os ~381/392 casos do beta) fique visualmente distinguível e completa dentro do sistema, sem depender de reimportar tudo, enquanto a equipe preenche os CPFs nos próximos dias.

> **CONTEXTO (A8, reunião 2026-08-03):** os casos vieram por ETL manual (`scripts/import-mais-medicos.py`) e por decisão travada: (1) **CPF ausente na base** → gravado o marcador claramente-não-CPF `CL-XXXX` (= `ID_CLIENTE_INTERNO`) em `system_clients.cpf_cnpj`, com `custom_fields.cpf_pendente=true`, editável depois pela ficha; (2) **1 cliente = 1 caso**, `lifecycle=CLIENTE`; (3) o caso **não** foi criado pelo fluxo normal (cadastrar→vincular caso→assinar), então **não tem `caso_pasta_nome`** (o "nome do caso" que o fluxo normal preenche a partir da pasta/documento escolhido). Resultado: na lista, o "tipo/nome do caso" cai no nome do **tema** ("Mais Médicos"), ficando redundante com a coluna de tema.
>
> **DECISÕES TRAVADAS (reunião 2026-08-05):**
> 1. **Nome do caso editável** para os importados (J3): a ficha permite definir/alterar `caso_pasta_nome`.
> 2. **CPF preenchível na mão** pela ficha do cliente, trocando o marcador `CL-XXXX` pelo CPF real (com validação), limpando `cpf_pendente`.
> 3. **Lista não repete tema=caso** quando o caso tem nome próprio: já existe o fallback `caso_pasta_nome → tema` (`casos.lista.tsx:210`); o ajuste é (a) dar nome aos importados e (b) esconder a coluna redundante quando se está dentro de um único tema (conecta com E1 do levantamento).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Nome do caso = `system_cases.caso_pasta_nome`** (nullable). É o que o fluxo normal grava (a partir da pasta escolhida em `CaseFormDialog.tsx:179 → selectedFolder?.name`). A lista resolve o rótulo do "tipo de caso" priorizando-o: `sistema-hv/src/routes/casos.lista.tsx:210-216` (`if (c.caso_pasta_nome) return c.caso_pasta_nome; … return nome do tema`). Também usado em `CaseCardReal.tsx:39`, `ClientCasesSection.tsx:299`, `CaseFiltersPanel.tsx`, `casos.$id.tsx:210`.
- **Escrita de caso:** `sistema-hv/src/lib/cases-service.ts:222` já grava `caso_pasta_nome: input.caso_pasta_nome ?? null` no `createCase`. Validador: `sistema-hv/src/lib/validators/case.ts:15` (`caso_pasta_nome: z.string().trim().max(200).optional().nullable()`).
- **Cliente + CPF:** `system_clients.cpf_cnpj NOT NULL` + **UNIQUE parcial** `(organization_id, cpf_cnpj) WHERE deleted_at IS NULL`; `custom_fields` JSONB (guarda `cpf_pendente=true`/`import_batch='MM_2026_08_03'`); serviço `sistema-hv/src/lib/clients-service.ts` (`createClient` **valida CPF + e-mail**). Ficha do cliente: `sistema-hv/src/routes/clientes.$id.tsx`.
- **Import A8:** `sistema-hv/scripts/import-mais-medicos.py` (ETL, idempotente) + `sistema-hv/scripts/import-mais-medicos-drive.mjs` (pastas) + `sistema-hv/scripts/import-mais-medicos-rollback.sql`. Batch marcado por `custom_fields.import_batch` e `cpf_pendente`. A8 registrou 381 clientes/casos importados; o levantamento 2026-08-05 fala em **392** — reconciliar a contagem real no T0.
- **Redundância tema=caso na lista (E1 do levantamento):** ajuste de UI já previsto — ocultar coluna/filtro "tema" quando dentro de um único tema.

### NOVO (a construir nesta story)

- **Editar o nome do caso na ficha** (`casos.$id.tsx`): um campo/edição inline que grava `caso_pasta_nome` via um endpoint de update de caso (novo/estendido). Aplicável a qualquer caso, mas o alvo prático são os importados (sem nome).
- **Editar/preencher CPF na ficha do cliente** (`clientes.$id.tsx`): trocar o marcador `CL-XXXX` pelo CPF real, com validação de CPF (reusar a validação do `clients-service`) e limpeza de `custom_fields.cpf_pendente`; respeitar o UNIQUE parcial (CPF real não pode colidir com outro cliente ativo).
- **Endpoint de update:** `updateCase({ id, caso_pasta_nome })` e `updateClientCpf({ id, cpf_cnpj })` (ou estender um update de cliente existente) — server fns com gate de edição (`requireAnyModule('edit')`/admin conforme padrão).
- **Ajuste de lista (E1):** quando a lista está filtrada por um único tema (`?tema=`/`?cat=`), ocultar a coluna/label redundante de tema (mantendo o nome do caso). Opcional nesta story se E1 for tratado à parte — no mínimo, garantir que casos com `caso_pasta_nome` deixam de mostrar o nome do tema como "tipo".
- **(Opção operacional) script de preenchimento em lote:** um utilitário para, quando a equipe fornecer a planilha CPF↔`CL-XXXX`, atualizar `cpf_cnpj` em massa (idempotente, valida CPF, respeita UNIQUE) — alternativa ao preenchimento manual um-a-um.

---

## Acceptance Criteria

1. **Nome do caso editável (ficha):** na ficha do caso (`casos.$id.tsx`), o admin/usuário com permissão de edição consegue **definir/alterar** o nome do caso, gravando em `system_cases.caso_pasta_nome` (validação `max(200)`, trim; vazio → volta a null). A alteração reflete imediatamente na ficha e na lista.
2. **CPF preenchível (ficha do cliente):** na ficha do cliente (`clientes.$id.tsx`), o usuário consegue substituir o marcador `CL-XXXX` por um **CPF/CNPJ real**, com **validação** (reusa a validação de `clients-service`); ao salvar um CPF válido, `custom_fields.cpf_pendente` é removido/`false`. CPF inválido é rejeitado com mensagem clara.
3. **UNIQUE respeitado:** ao gravar o CPF real, se ele colidir com outro cliente ativo da org (UNIQUE parcial `(organization_id, cpf_cnpj) WHERE deleted_at IS NULL`), o erro é tratado com mensagem clara ("CPF já cadastrado para outro cliente"), sem 500 cru. O marcador `CL-XXXX` (único por natureza) continua válido enquanto o CPF real não é informado.
4. **Lista deixa de repetir tema=caso:** para casos que **têm** `caso_pasta_nome`, a lista mostra o nome do caso (não o do tema) na coluna de "tipo/nome do caso" — comportamento já suportado por `resolveTipo` (`casos.lista.tsx:210`); a story garante que, ao nomear os importados, a redundância some. Adicionalmente, quando a lista está dentro de um **único tema**, a coluna/label redundante de tema é ocultada (E1) — ou, no mínimo, documenta-se que isso fica na story E1 e J2 entrega só o nome editável.
5. **Alvo: os importados Mais Médicos:** os casos do batch (`custom_fields.import_batch='MM_2026_08_03'`, hoje sem `caso_pasta_nome` e com `cpf_cnpj='CL-XXXX'`) ficam **editáveis** por ambos os fluxos acima. A contagem real do batch (381 vs 392) é reconciliada e registrada.
6. **(Se implementado) preenchimento em lote:** havendo planilha CPF↔`CL-XXXX`, um script idempotente atualiza `cpf_cnpj` em massa, validando cada CPF e respeitando o UNIQUE; linhas inválidas/colidentes são reportadas, não aplicadas. Reexecução não duplica nem corrompe.
7. **Autorização/regressão:** os updates exigem permissão de edição (padrão do app — gate de módulo/admin); `npm run typecheck` + `npm run lint` verdes; sem DDL nova (usa colunas existentes); nada quebra no fluxo normal de criação de caso (que já grava `caso_pasta_nome`).

---

## Tasks / Subtasks

### T0 — Reconciliar contagem + estado do batch (@data-engineer) — antes de codar
- [x] `SELECT count(*)` dos casos/clientes do batch `MM_2026_08_03`; quantos com `caso_pasta_nome IS NULL` e `cpf_pendente=true`. **Resultado real (via `scripts/db-query.ts`, dev=prod):** **381 clientes** no batch (`custom_fields.import_batch='MM_2026_08_03'`), TODOS com `cpf_pendente=true` E marcador `CL-%` (também 381 marcadores `CL-%` no banco inteiro — nenhum fora do batch). Esses clientes têm **382 casos** vinculados (1 cliente com 2 casos), dos quais **381 com `caso_pasta_nome IS NULL`** (1 já tinha nome). **Reconciliação 381 vs 392:** o número REAL é **381 clientes / 382 casos**; o "392" do levantamento é aproximação/planilha (não bate com o banco). OBS: `system_cases` não tem `custom_fields` — o batch é marcado só no `system_clients`; casos do batch se identificam pelo JOIN via `client_id`. (AC-5)

### T1 — Update do nome do caso (@dev)
- [x] Server fn `updateCaseFn` JÁ existia (`src/rpc/cases.ts` → `updateCase`) e já grava `caso_pasta_nome` (validador `case.ts` já inclui `caso_pasta_nome` no `caseUpdateSchema`), com gate `handleManage` (operacional:edit). Reusado. (AC-1,7)
- [x] UI na ficha `src/routes/casos.$id.tsx`: botão-lápis ao lado do título abre `CaseNameEditDialog` (novo componente) que grava/limpa `caso_pasta_nome` via `useUpdateCase`. Só para quem pode gerir o caso (`podeGerirCaso`). (AC-1)
- [x] Confirmado: `resolveTipo` (`casos.lista.tsx:225`) já prioriza `caso_pasta_nome` — nomear o caso remove a redundância sem mudança extra. (AC-4)

### T2 — Preencher CPF na ficha do cliente (@dev)
- [x] `updateClientCpf` (novo em `clients-service.ts`) + `updateClientCpfFn` (novo em `rpc/clients.ts`, gate `handleWrite`): valida CPF/CNPJ (reusa `isValidCpf`/`isValidCnpj`/`sanitizeCpfCnpj`), grava `cpf_cnpj` canônico + `person_type`, remove `custom_fields.cpf_pendente`, trata UNIQUE parcial 23505 → 409 "CPF já cadastrado para outro cliente" (sem 500). Hook `useUpdateClientCpf`. (AC-2,3)
- [x] UI em `src/routes/clientes.$id.tsx`: banner "CPF pendente" (mostra o marcador `CL-XXXX`) + botão "Preencher CPF" → `ClientCpfFillDialog` (novo), visível quando `cpf_pendente` ou marcador `CL-%`, com máscara CPF/CNPJ (`formatCpfCnpj`). Botão só para quem pode editar o cadastro. (AC-2)

### T3 — Lista sem tema=caso redundante (@dev)
- [x] Casos nomeados mostram o nome do caso (`resolveTipo` já prioriza `caso_pasta_nome`) — entregue via T1. A ocultação da COLUNA/label de tema dentro de um único tema fica em **E1** (story separada, conforme AC-4 permite fatiar); J2 entrega o nome editável. (AC-4)

### T4 — (Opcional) preenchimento em lote de CPF (@data-engineer)
- [ ] NÃO implementado nesta story (opcional; sem planilha CPF↔`CL-XXXX` fornecida). O `updateClientCpf` já é a peça reusável para um script em lote quando a planilha existir. (AC-6)

### T5 — QA (@qa)
- [ ] Nomear um caso importado → lista deixa de mostrar "Mais Médicos" como tipo. (AC-1,4)
- [ ] Preencher CPF válido num cliente importado → `cpf_pendente` some; CPF inválido rejeitado; CPF duplicado → mensagem clara. (AC-2,3)
- [ ] Update sem permissão de edição → bloqueado. (AC-7)
- [ ] `typecheck`+`lint` verdes; fluxo normal de criação intacto. (AC-7)

---

## Dev Notes

**Nada de schema novo — os campos já existem.** `caso_pasta_nome` e `cpf_cnpj`/`custom_fields` já estão no banco e já são lidos/escritos pelo app. J2 é essencialmente **expor edição** desses dois campos na ficha + garantir a UX da lista. `createCase` já grava `caso_pasta_nome` (`cases-service.ts:222`) e a lista já prioriza esse campo (`casos.lista.tsx:210`) — a raiz da redundância é simplesmente que os importados vieram com ele **null**.

**Por que a A8 deixou assim (intencional).** A8 (decisão 1 do owner, 2026-08-03) travou o CPF-marcador `CL-XXXX` e não pré-vinculou documento de assinatura (decisão 5) — logo, sem `caso_pasta_nome`. J2 é o "acabamento" previsto: a própria A8/levantamento diz "preencher CPF depois via ficha" e "poder alterar o nome do caso dos importados". Não reabrir o ETL; editar no app.

**UNIQUE parcial do CPF.** Trocar `CL-XXXX` (único) pelo CPF real pode colidir com um cliente já existente que tenha esse CPF. Tratar o erro do UNIQUE parcial `(organization_id, cpf_cnpj) WHERE deleted_at IS NULL` com mensagem amigável (não 500). A validação de CPF do `clients-service` deve ser reusada para não aceitar o marcador nem CPF inválido como "real".

**Contagem 381 vs 392.** A A8 registra 381 clientes/casos efetivamente inseridos (2026-08-04); o levantamento 2026-08-05 cita 392. Reconciliar no T0 antes de comunicar números (pode haver casos criados fora do batch ou linhas de padding). Não bloqueia a implementação — ambos os fluxos operam por caso, não por total.

**E1 (coluna tema redundante).** O levantamento tem um item próprio (E1) para "não repetir tema em cada linha quando dentro de um tema". J2 se conecta a isso, mas o essencial de J2 é dar **nome** aos casos; a ocultação da coluna pode ficar em E1 se o time preferir fatiar. Deixar explícito qual parte J2 entrega.

**Migrations via pg direto.** Se o T4 (lote) for feito, aplicar/rodar via `npx tsx scripts/db-apply-pg.ts` da pasta `sistema-hv/` (CLI Supabase quebrado no Windows/OneDrive; `reference_aplicar_migrations_pg_direto`). dev=prod.

**Riscos:**
- **R1 — colisão de CPF** ao migrar do marcador para o real (UNIQUE parcial). Mitigação: tratar erro + relatório no lote.
- **R2 — casos fora do batch.** Se editar nome/CPF de casos não-importados sem querer, sem dano (é edição normal), mas a UI deve deixar claro o alvo (badge `cpf_pendente`/marcador).
- **R3 — validação de CPF rejeitando o marcador.** É o comportamento desejado (o marcador não é CPF), mas a UI precisa permitir ao usuário **substituir** o marcador por um CPF válido (não travar a edição por o valor atual ser inválido).

### Testing
- Nomear caso importado (`caso_pasta_nome`) → ficha + lista mostram o nome; tema deixa de aparecer como "tipo".
- CPF válido → grava, `cpf_pendente` removido; inválido → rejeitado; duplicado → mensagem clara (sem 500).
- (Lote) rodar 2× → idempotente; rejeições reportadas.
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues):** A8 (ETL Mais Médicos — batch importado com `import_batch`/`cpf_pendente`/`CL-XXXX`); `system_cases.caso_pasta_nome` + `resolveTipo` na lista; `system_clients.cpf_cnpj` + UNIQUE parcial + `custom_fields`; `clients-service` (validação CPF); fichas `casos.$id.tsx` e `clientes.$id.tsx`; validador `case.ts`.
- **Relaciona com E1** (ocultar coluna tema redundante dentro de um tema) — pode ser fatiado.
- **Relaciona com A8** (importação) e **A3** (board SISGIMM/parcelas — fora de J2).
- **Não** depende do motor de distribuição (H*).

## File List

**A definir na implementação. Previsto:**
- `sistema-hv/src/routes/casos.$id.tsx` (edição do nome do caso).
- `sistema-hv/src/routes/clientes.$id.tsx` (edição/preenchimento de CPF).
- `sistema-hv/src/lib/cases-service.ts` (update de `caso_pasta_nome`) + `sistema-hv/src/rpc/*` (server fn).
- `sistema-hv/src/lib/clients-service.ts` (update de CPF + limpar `cpf_pendente`; tratar UNIQUE) + rpc.
- `sistema-hv/src/routes/casos.lista.tsx` / `CaseFiltersPanel.tsx` (E1 — ocultar tema redundante, se incluído).
- `sistema-hv/scripts/` (script opcional de preenchimento em lote de CPF).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-05 | v0.1 | Draft inicial. Acabamento dos casos Mais Médicos importados (A8): nome do caso editável na ficha (`caso_pasta_nome`, já lido por `resolveTipo` em `casos.lista.tsx:210`), CPF preenchível pela ficha do cliente (troca o marcador `CL-XXXX` por CPF real, valida, limpa `cpf_pendente`, respeita o UNIQUE parcial), e fim do "tema=caso" redundante na lista (nome próprio + E1 opcional). Sem DDL (campos já existem). Reconciliar contagem 381 (A8) vs 392 (levantamento) no T0. Script opcional de CPF em lote. Relaciona com A8/E1. | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). **T0 reconciliação (dev=prod):** batch real = **381 clientes / 382 casos** (todos os 381 clientes com `cpf_pendente=true` + marcador `CL-%`; 381 casos sem `caso_pasta_nome`); o "392" do levantamento não bate com o banco — número correto é 381. **T1 (nome do caso):** `updateCaseFn`/validador já suportavam `caso_pasta_nome`; add UI — botão-lápis no título → `CaseNameEditDialog` (novo) em `casos.$id.tsx`; `resolveTipo` já reflete. **T2 (CPF):** novo `updateClientCpf` (service) + `updateClientCpfFn` (RPC, gate comercial/operacional edit) + `useUpdateClientCpf` (hook) — valida CPF/CNPJ reusando `validators/client`, limpa `cpf_pendente`, trata UNIQUE parcial (409, sem 500); UI = banner "CPF pendente" + `ClientCpfFillDialog` (novo) em `clientes.$id.tsx`. **T3:** nome editável remove a redundância; ocultar coluna de tema fica em E1. **T4** (lote) não feito (opcional, sem planilha). **Arquivos:** `src/lib/clients-service.ts`, `src/rpc/clients.ts`, `src/hooks/useClients.ts`, `src/components/clients/ClientCpfFillDialog.tsx` (novo), `src/components/cases/CaseNameEditDialog.tsx` (novo), `src/routes/clientes.$id.tsx`, `src/routes/casos.$id.tsx`. **Gates:** `npm run typecheck` verde (só o erro pré-existente `contaazul/service.ts`); `npx eslint` nos 7 arquivos tocados = 0 erros. Sem migration (DDL zero). | @dev |
