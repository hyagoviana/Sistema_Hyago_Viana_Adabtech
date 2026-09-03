# Story S2-03: Criar Judicial no ProJuris usa o assunto do TEMA

- **Sprint:** S2 — Configuração de tema + Drive + ProJuris
- **ID:** S2-03 · **Item do Thiago:** 3
- **Status:** Draft
- **Estimativa relativa:** M
- **Executor sugerido:** @dev · Quality gate: @qa
- **Depende de:** S2-02 (é lá que o assunto do tema é definido)

---

## Story

**Como** escritório que usa o ProJuris como sistema judicial,
**quero** que o processo criado a partir do SHV nasça com o **assunto do tema**,
**para que** o ProJuris não acumule um assunto novo para cada caso e os relatórios de lá continuem
agrupando por tema, como sempre foi.

---

## Contexto / causa raiz

Anotação do Thiago no desenho 5: *"Esse judicial do projuris (PRO.0007818) gerei a partir desse caso
durante um teste, e no sistema foi criado um novo 'assunto' com o identificador do SHV. Precisamos de
outra forma de vincular os dados quando o judicial no projuris for criado direto pelo SHV, para que o
campo 'assunto' possa refletir o dado relacionado ao tema, conforme uso interno, e não ao próprio caso
(1 assunto para cada caso). Acredito que a forma seria vincular os 'assuntos' do projuris aos temas
existentes no SHV."*

No print da aba Judicial, o campo **ASSUNTO (TEMA)** aparece como `INADIMPLENCIAHV-2026-0422` — o código
do caso. A causa é literal:

```ts
// src/lib/projuris/criar-processo.ts:356
assunto: c.caso_pasta_nome || c.case_code,
```

Como o caso é vinculado a um tema, o sistema **já sabe** qual é a classificação interna — falta usar.

---

## Acceptance Criteria

1. `criar-processo` passa a montar o `assunto` na seguinte ordem:
   1. **assunto do tema** (definido na S2-02);
   2. na falta dele, o **assunto geral** configurado nas Integrações;
   3. na falta dos dois, **não inventa**: o diálogo de criação exige a escolha do assunto antes de enviar
      (bloqueia com mensagem clara, em vez de cair no código do caso).
2. O **nome da pasta** no ProJuris (`nomePasta`) continua como está — é outro campo e o Thiago não pediu
   mudança nele.
3. O diálogo `CriarProcessoProjurisDialog` mostra qual assunto será usado e de onde veio ("do tema X"),
   permitindo trocar pontualmente antes de criar — sem alterar a configuração do tema.
4. Processos **já criados** com assunto errado não são alterados automaticamente. A story entrega uma
   listagem (script) dos processos criados pelo SHV cujo assunto é igual ao `case_code`, para o Thiago
   corrigir no ProJuris ou pedir correção em massa depois.
5. O caminho inverso (leitura/sincronização do ProJuris → SHV) **não muda** nesta story.
6. Testes: caso de tema com assunto definido → payload leva o assunto do tema; sem assunto e sem geral →
   bloqueio com mensagem; com override no diálogo → prevalece o escolhido.
7. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [ ] Resolver o assunto pelo tema do caso (AC 1). (`src/lib/projuris/criar-processo.ts:340-360`)
- [ ] Bloqueio + mensagem quando não há assunto resolvível (AC 1.3).
- [ ] UI do diálogo: mostrar origem e permitir override (AC 3). (`CriarProcessoProjurisDialog.tsx`)
- [ ] Script de listagem dos processos com assunto = case_code (AC 4).
- [ ] Testes (AC 6).

---

## Dev Notes

- `assuntoCnj` é outra coisa (árvore CNJ, lista) e continua como está — ver comentário em
  `criar-processo.ts:136` sobre o XSD.
- O `codigoExterno` (que amarra os dois lados pelo `case_code`) **continua** — é ele que faz o vínculo,
  não o assunto. Não trocar um pelo outro.
- Validar com o Thiago num processo de teste antes de liberar (ele já criou o PRO.0007818/PRO.7819 assim).

## Definition of Done

- [ ] Processo criado pelo SHV nasce com o assunto do tema, conferido no ProJuris
- [ ] Nenhum assunto novo é criado lá por causa de caso
- [ ] typecheck + lint + testes verdes
