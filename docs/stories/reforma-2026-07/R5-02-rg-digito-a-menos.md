# Story R5-02: Bug B2 — RG aceita um dígito a menos (não dá para digitar o RG completo)

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-02
- **Status:** Ready for Review
- **Estimativa relativa:** XS (máscara/limite no form — 1 função pura)
- **Executor sugerido:** @dev · Quality gate: @qa
- **Item do documento-mestre:** §8 **B2** — "RG 1 dígito a menos · `20260622000001_clients_rg.sql` + máscara no form"

---

## Story

**Como** operador cadastrando um cliente PF,
**quero** digitar o RG completo (incluindo RGs com mais de 9 caracteres, por variação de estado),
**para que** o RG salvo bata com o documento e apareça correto nos documentos gerados.

---

## Contexto / o que JÁ EXISTE vs NOVO (arquivo:linha)

- **JÁ EXISTE (coluna):** `system_clients.rg TEXT` — `sistema-hv/supabase/migrations/20260622000001_clients_rg.sql:10`. **Coluna é TEXT livre** — o banco NÃO limita tamanho. **O bug é 100% no front.**
- **ROOT CAUSE (bug):** `formatRg` em `sistema-hv/src/lib/format.ts:122-131` faz `.slice(0, 9)` sobre os dígitos e aplica máscara fixa `2.3.3-1` (9 posições). RGs que passam de 9 caracteres úteis (variação por estado/UF) ficam **truncados no último dígito** → é o "um dígito a menos" relatado pelo Hyago.
- **Uso no form:** `sistema-hv/src/components/clients/ClientFormDialog.tsx:472-483` (`onChange={(e) => field.onChange(formatRg(e.target.value))}`) e no reset de edição `:322`. Não há `maxLength` no `<Input>` — o limite vem só do `slice` interno.
- **NOVO:** afrouxar o `slice` (ex.: 12) e generalizar a máscara para não descartar dígitos além do 9º (aplicar máscara "usual" só nos 9 primeiros e deixar o excedente legível, OU máscara progressiva sem cap rígido). Manter aceitação de `X` (dígito verificador).

> **DECISÃO TRAVADA:** RG é **texto livre por estado** — a máscara é conveniência visual, não validação. Nunca truncar dígitos digitados. Elevar o limite e preservar tudo o que o usuário digitou.

---

## Acceptance Criteria

1. Digitar um RG com mais de 9 caracteres úteis **não** perde o último dígito — todos os caracteres digitados são preservados no valor salvo.
2. RGs no padrão comum (`12.345.678-9`) continuam mascarados como hoje.
3. Aceita dígito verificador `X`.
4. Edição de cliente com RG previamente salvo re-exibe o valor completo (sem truncar no `formatRg` do reset em `ClientFormDialog.tsx:322`).

---

## Tasks / Subtasks

- [x] **Front** — em `sistema-hv/src/lib/format.ts` `formatRg`: subir o `slice(0, 9)` para um limite maior (ex.: 12) e ajustar a máscara para não descartar o excedente (mascara os 9 primeiros no padrão 2.3.3-1 e concatena o resto, ou torna a máscara progressiva sem cap). Manter `X`.
- [x] **Form** — confirmar que `ClientFormDialog.tsx:477-483` não impõe `maxLength` menor que o novo limite (não impõe hoje — validar).
- [x] **Testes** (AC 1-4) — teste unitário de `formatRg` com RG de 10-11 dígitos (preserva último), padrão 9 (mascara), com `X`. `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/format.ts` (`formatRg`).
- (verificar, sem alterar salvo necessário) `sistema-hv/src/components/clients/ClientFormDialog.tsx`.

**Regras de ouro pertinentes:**
- Bug de **front** — **sem migration** (coluna já é TEXT livre; não tocar `20260622000001_clients_rg.sql`).
- Não introduzir validação que rejeite RGs fora do padrão — máscara é só apresentação.

### Testing
- `formatRg("123456789012")` preserva os 12 dígitos (não corta o 12º).
- `formatRg("123456789")` → `12.345.678-9`.
- `formatRg("1234567x")` → aceita `X` maiúsculo.
- Editar cliente existente com RG salvo → campo re-exibe completo.

---

## Dependências

- **Depende de:** nada (quick win independente).
- **Cruzamentos:** nenhum com R2/R4.
- **Habilita:** RG correto nos autofills de documento (relacionado a D1-D4, mas independente).

---

## File List

- `sistema-hv/src/lib/format.ts` (modificado — `formatRg`)
- `sistema-hv/src/lib/format.test.ts` (novo — testes de `formatRg`)
- `sistema-hv/src/components/clients/ClientFormDialog.tsx` (verificado — sem alteração)

## Dev Agent Record

**Agente:** @dev (James) · Modelo: Opus 4.8 (1M)

### Root cause confirmado
`formatRg` fazia `.slice(0, 9)` sobre os caracteres já limpos e aplicava a máscara fixa 2.3.3-1 (9 posições). Qualquer RG com mais de 9 caracteres úteis (variação por UF) tinha o excedente descartado ANTES da máscara → o "um dígito a menos" relatado pelo Hyago. Coluna `system_clients.rg` já é `TEXT` livre; bug 100% de front, sem migration.

### Implementação
- `slice(0, 9)` → `slice(0, 12)` e a função agora separa `head` (9 primeiros) de `tail` (excedente). A máscara 2.3.3-1 é aplicada só ao `head`; o `tail` é concatenado legível ao final (`masked + tail`). Nenhum dígito digitado é truncado.
- Aceitação do `X` mantida (normalização `toUpperCase()` + classe `[0-9X]`).
- Casos comuns preservados: `formatRg("123456789")` → `12.345.678-9`; parcial `12345` → `12.345`.

### Verificação do form
`ClientFormDialog.tsx` — o `<Input>` do RG (linha ~477-483) NÃO tem `maxLength`; o único limite era o `slice` interno de `formatRg` (agora 12). O reset de edição (linha ~322, `formatRg(client.rg)`) re-exibe o valor completo pela mesma função corrigida. Nenhuma alteração necessária no componente.

### Testes / gates
- Novo `src/lib/format.test.ts` (padrão dos `.test.ts` via `npx tsx`) — 8 asserts, todos verdes: 12 dígitos preservados (`12.345.678-9012`), 10 dígitos (`12.345.678-90`), padrão 9 (`12.345.678-9`), parcial 5 (`12.345`), `X` maiúsculo, `1234567x` mantém `X`, vazio.
- `npm run typecheck`: os erros reportados são pré-existentes (termo-service.ts, visibility.ts, casos.*.tsx) — nenhum em `format.ts`/`format.test.ts`. Zero erro novo.
- `eslint` em `format.ts`/`format.test.ts`: as 2 mensagens prettier são pré-existentes em `formatPhone` (linhas 43/47, confirmado via `git stash`), fora do escopo desta story. Linhas editadas + arquivo de teste: zero lint.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — bug B2 RG 1 dígito a menos | @sm |
| 2026-07-18 | 0.2 | Fix `formatRg` (slice 9→12 + head/tail sem truncar) + teste `format.test.ts`; form verificado (sem `maxLength`). Status → Ready for Review | @dev |
