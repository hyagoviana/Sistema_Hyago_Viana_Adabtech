# Story R5-02: Bug B2 — RG aceita um dígito a menos (não dá para digitar o RG completo)

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-02
- **Status:** Draft
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

- [ ] **Front** — em `sistema-hv/src/lib/format.ts` `formatRg`: subir o `slice(0, 9)` para um limite maior (ex.: 12) e ajustar a máscara para não descartar o excedente (mascara os 9 primeiros no padrão 2.3.3-1 e concatena o resto, ou torna a máscara progressiva sem cap). Manter `X`.
- [ ] **Form** — confirmar que `ClientFormDialog.tsx:477-483` não impõe `maxLength` menor que o novo limite (não impõe hoje — validar).
- [ ] **Testes** (AC 1-4) — teste unitário de `formatRg` com RG de 10-11 dígitos (preserva último), padrão 9 (mascara), com `X`. `npx tsc --noEmit` / `npm run lint` verdes.

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

- `sistema-hv/src/lib/format.ts`
- `sistema-hv/src/components/clients/ClientFormDialog.tsx` (verificação)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — bug B2 RG 1 dígito a menos | @sm |
