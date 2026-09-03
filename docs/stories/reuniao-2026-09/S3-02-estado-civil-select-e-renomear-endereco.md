# Story S3-02: Estado civil como escolha e renomeação dos campos de endereço

- **Sprint:** S3 — Cliente
- **ID:** S3-02 · **Item do Thiago:** 8
- **Status:** Draft
- **Estimativa relativa:** P
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** quem preenche o cadastro,
**quero** escolher o estado civil numa lista e ver os campos de endereço com o nome certo,
**para que** o dado saia padronizado e sirva direto nas variáveis dos documentos.

---

## Contexto

Anotações do Thiago no desenho 29:
- *"Para o campo 'estado civil', converter em múltipla escolha (standard como solteiro)."*
- *"alterar para 'endereço'"* (campo hoje rotulado logradouro)
- *"alterar para 'número endereço'"* (campo hoje rotulado número)

Isso importa além da tela: esses rótulos alimentam o motor de variáveis dos modelos Word.

---

## Acceptance Criteria

1. **Estado civil** vira `select` com as opções: Solteiro(a) · Casado(a) · Divorciado(a) · Viúvo(a) ·
   União estável · Separado(a). **Default: Solteiro(a)** em cadastro novo (o Thiago pediu "standard como
   solteiro"); em cliente já existente, o valor atual é preservado.
2. **Migração de dados**: os valores em texto livre já gravados são normalizados para as opções acima
   (casefold + acento). O que não casar fica como está e é listado no relatório do script — ninguém perde
   informação.
3. Rótulos alterados: `logradouro` → **"Endereço"**, `número` → **"Número endereço"**.
   A **chave** do campo não muda (é ela que casa com as variáveis dos documentos e com dados já gravados);
   muda o rótulo exibido. Se algum modelo Word usa o rótulo antigo como chave, a story mapeia o alias.
4. O motor de variáveis continua preenchendo esses campos nos documentos (teste em um modelo real).
5. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [ ] Select de estado civil + default (AC 1). (formulário de cliente — S3-01)
- [ ] Script de normalização com dry-run (AC 2).
- [ ] Renomear rótulos e conferir aliases das variáveis (AC 3, 4).
- [ ] Gerar um documento de teste e conferir o preenchimento (AC 4).

---

## Dev Notes

- **Não renomear a key.** O balde `custom_fields`/colunas do cliente já guarda dados por chave; renomear
  quebraria documentos e importações. Rótulo é apresentação.
- Ver o motor de variáveis (aliases de honorários, data automática) — o mesmo lugar onde os aliases moram.

## Definition of Done

- [ ] Estado civil padronizado no cadastro e nos dados existentes
- [ ] Rótulos novos na tela, variáveis preenchendo igual
