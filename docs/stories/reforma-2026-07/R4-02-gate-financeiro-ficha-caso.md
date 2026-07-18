# Story R4-02: Gate de $ na ficha do CASO (`TermoPanel` + `AsaasCobrancasPanel`)

- **Épico:** R4 — Desacoplar Financeiro (bloco B4 + E5)
- **ID:** R4-02
- **Status:** Ready for Review
- **Estimativa relativa:** S (gate de render no bloco financeiro da ficha do caso)
- **Executor sugerido:** @dev · Quality gate: @architect
- **Prioridade no épico:** 2 (segundo gate — bloco de valores dentro do caso)

---

## Story

**Como** administrador/financeiro,
**quero** que o bloco financeiro da ficha do caso (Termo de acerto com honorários/parcelas e o painel de cobranças Asaas/Conta Azul) só apareça para quem tem permissão financeira,
**para que** operacional/jurídico que abre um caso não veja valores, honorários, parcelas nem crie/gerencie cobranças.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (gate parcial):** em `casos.$id.tsx:99-101` já há `const { role } = useAuth(); const podeFinanceiro = can(role, "financeiro.manage");`. Esse `podeFinanceiro` **hoje** só gate-ia o botão "Enviar para o financeiro" (`casos.$id.tsx:372`) — **NÃO** gate-ia a exibição de `TermoPanel`/`AsaasCobrancasPanel`.
- **JÁ EXISTE (o vazamento):** quando o caso está bifurcado (`finBifurcated`), `casos.$id.tsx:378-385` renderiza `<TermoPanel caseId={caso.id} />` e `<AsaasCobrancasPanel caseId={caso.id} clientId={caso.client_id} />` **sem checar `podeFinanceiro`** — qualquer autenticado que veja o caso vê termo (15%/R$500, honorários) e cobranças (doc-mestre §3.6:89, §5.3:164).
- **JÁ EXISTE:** `TermoPanel` (`src/components/cases/TermoPanel.tsx`) mostra valores do termo; `AsaasCobrancasPanel` (`src/components/cases/AsaasCobrancasPanel.tsx`) lista parcelas com $ **e** contém os botões de criar cobrança Asaas/Conta Azul (é o alvo do "mover gerar fatura" em R4-05).
- **NOVO:** condicionar o bloco `finBifurcated` inteiro (termo + cobranças) a `podeVerFinanceiro`.

> **DECISÃO TRAVADA (doc-mestre §4.4):** valores ($) exigem `financeiro:view`. O bloco do termo e o de cobranças são valores → gate obrigatório.

---

## DEPENDÊNCIA CRÍTICA — R3 (`permissaoEfetiva`)

- Gate deve usar `permissaoEfetiva(user, 'financeiro', 'view')` do épico **R3 (story R3-01)**.
- **Ponte até R3 existir:** reusar o `podeFinanceiro = can(role, 'financeiro.manage')` que **já está computado** em `casos.$id.tsx:100`. Renomear/derivar um `podeVerFinanceiro` (mesma expressão) e marcar `// TODO(R4/R3): permissaoEfetiva(user,'financeiro','view')`.
- **Observação:** `financeiro.manage` implica ver+gerir. Para o gate de **visualização** de $ é suficiente como ponte; quando R3 chegar, `view` e `edit` podem se separar (ver só × criar cobrança).

---

## Acceptance Criteria

1. Com o caso bifurcado (`finBifurcated`), usuário **com** o gate vê `TermoPanel` + `AsaasCobrancasPanel` como hoje.
2. Usuário **sem** o gate (operacional, comercial, advogado_associado, prestador_externo, marketing) **NÃO** vê termo nem cobranças; no lugar, nada financeiro (ou selo "em dia/devendo" opcional, sem valores).
3. O botão "Enviar para o financeiro" (`casos.$id.tsx:372`) continua gate-ado por `podeFinanceiro` (comportamento atual preservado).
4. O bloco não dispara os hooks de $ (`useParcelas`, termo) quando o gate é falso (defesa reforçada pelos RPCs em R4-03).

---

## Tasks / Subtasks

- [x] **Gate no bloco `finBifurcated`** (AC: 1,2) — em `casos.$id.tsx`, trocado `{finBifurcated && (` por `{finBifurcated && podeVerFinanceiro && (` (envolvendo `TermoPanel` + `AsaasCobrancasPanel`).
  - [x] Derivado `const podeVerFinanceiro = permissaoEfetiva(role, perms ?? {}, "financeiro", "view")` — usa direto a infra efetiva de R3-01 (não a ponte `can`), idêntico ao padrão de R4-01 (`clientes.$id.tsx`).
- [x] **Estado sem gate** (AC: 2) — MVP oculta o bloco (não monta `TermoPanel`/`AsaasCobrancasPanel`), sem nenhum "R$". Sinal "em dia/devendo" fica para R4-04.
- [x] **Preservar** (AC: 3) — gate do botão "Enviar para o financeiro" mantido em `podeFinanceiro` (`can(role,"financeiro.manage")`); bloco `removido_do_operacional` intacto.
- [x] **Testes** (AC: 1-4) — `npm run typecheck` (sem erro novo em `casos.$id.tsx`), `npm run test:rbac` verde, `npx eslint src/routes/casos.$id.tsx` (só CRLF pré-existente do arquivo inteiro, zero violação de código).

---

## Dev Notes

**Telas/arquivos a receber gate:**
- `sistema-hv/src/routes/casos.$id.tsx:378-385` — condicionar bloco `finBifurcated` a `podeVerFinanceiro`.
- (Sem mudança de lógica em `TermoPanel.tsx`/`AsaasCobrancasPanel.tsx` neste story — só deixam de ser montados sem gate. A movimentação de "gerar fatura" é R4-05.)

**Padrão a reusar:**
- `podeFinanceiro` já existe em `casos.$id.tsx:100` — não recriar `useAuth()`.

**Riscos de regressão / vazamento de $:**
- **Vazamento:** montar `TermoPanel`/`AsaasCobrancasPanel` sem gate dispara `useParcelas`/termo com valores. Não montar quando gate falso; RPC (R4-03) é a última linha.
- **Regressão:** não englobar acidentalmente o botão "Enviar para o financeiro" nem o bloco `removido_do_operacional` no novo gate — eles são de fluxo, não de $ (revisar o JSX entre as linhas 372 e 385 ao editar).
- Não tocar `macrostatus_fin`/dual-write (regra de ouro).

### Testing
- `operacional` abre caso bifurcado → sem termo, sem cobranças, sem "R$".
- `financeiro`/`admin` → bloco completo igual a hoje.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** **R3-01** (`permissaoEfetiva`); ponte `can(role,'financeiro.manage')` (já computado). **R4-03** (gate RPC) como defesa do fetch.
- **Habilita:** R4-05 (mover "gerar fatura/Conta Azul" — que hoje vive dentro do `AsaasCobrancasPanel` protegido aqui).

---

## File List

- `sistema-hv/src/routes/casos.$id.tsx` — imports `useMyModulePerms` + `permissaoEfetiva`; deriva `podeVerFinanceiro`; gate `finBifurcated && podeVerFinanceiro` no bloco `TermoPanel` + `AsaasCobrancasPanel`.

## Dev Agent Record

### Agent Model Used
- @dev (James) — Opus 4.8 (1M)

### Implementation Notes
- Em vez da **ponte** `podeFinanceiro = can(role,'financeiro.manage')` sugerida no Draft, usei **direto** a infra efetiva de R3-01: `permissaoEfetiva(role, perms ?? {}, "financeiro", "view")` — cópia exata do padrão já entregue em R4-01 (`clientes.$id.tsx:76-78`). Como R3-01 já está aplicado, não há TODO pendente nem ponte a remover depois.
- Gate aplicado **apenas** ao bloco `{finBifurcated && (...)}` que renderiza `TermoPanel` + `AsaasCobrancasPanel`. Sem o gate o bloco não é montado, então os hooks de $ (termo/`useParcelas`) nem disparam (AC-4).
- **Não** englobados no gate: botão "Enviar para o financeiro" (topo e dentro do card, ambos seguem `podeFinanceiro`) e o bloco `removido_do_operacional` — são de fluxo, não de $ (AC-3 preservado).
- Sem mudança em `TermoPanel.tsx`/`AsaasCobrancasPanel.tsx` (mover "gerar fatura" é R4-05). Sem migration, sem toque em `macrostatus_fin`/dual-write.

### Validation
- `npm run typecheck`: nenhum erro **novo** em `casos.$id.tsx`. O único erro no arquivo (`serviceTypeId={caso.service_type_id}` string|null vs string, no `MoveCaseFinDialog`) é **pré-existente** — confirmado por baseline com o arquivo revertido (mesma linha, mesmo erro).
- `npm run test:rbac`: 🎉 todos os testes passaram (inclui `permissaoEfetiva` financeiro/view por papel + overrides).
- `npx eslint src/routes/casos.$id.tsx`: só erros `prettier/prettier — Delete ␍` (CRLF) que atingem **todas** as linhas do arquivo (condição pré-existente por OneDrive/Windows; baseline 551 → 565 = +14 = as 14 linhas que adicionei, mesma natureza CRLF). Zero violação real de código. Não rodei `--fix` para não reescrever o arquivo inteiro (fora do escopo cirúrgico).

### Confirmação de comportamento
- **operacional / advogado_associado / comercial / prestador_externo / marketing** (base `financeiro/view == false`, sem override): abrem caso bifurcado → **não veem** `TermoPanel` (honorários/parcelas) nem `AsaasCobrancasPanel` (cobranças), nenhum "R$".
- **admin / financeiro** (base `financeiro/view == true`): veem o bloco completo, igual a hoje.
- Overrides por usuário (R3-01) funcionam aditivamente (ex.: `advogado_associado` com override `financeiro:view` passa a ver o bloco).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial do épico R4 (B4/E5) — gate na ficha do caso | @sm |
| 2026-07-18 | 0.3 | Gate `finBifurcated && podeVerFinanceiro` implementado; usou `permissaoEfetiva` direto (não a ponte `can`), padrão idêntico a R4-01. typecheck/test:rbac/eslint validados. Status → Ready for Review | @dev |
