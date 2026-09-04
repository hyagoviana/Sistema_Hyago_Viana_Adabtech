# Story S2-02: Aba Integrações do tema — assunto ProJuris ajustável

- **Sprint:** S2 — Configuração de tema + Drive + ProJuris
- **ID:** S2-02 · **Item do Thiago:** 5
- **Status:** Draft
- **Estimativa relativa:** M
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** administrador,
**quero** dizer, na configuração do tema, **qual é o assunto do ProJuris** correspondente,
**para que** o sistema saiba de antemão o que lançar quando criar um processo lá — e para que o de-para
tema↔ProJuris pare de depender de adivinhação por nome.

---

## Contexto

Anotação do Thiago no desenho 13 (aba de integrações do tema): *"Identificar do projuris para o ASSUNTO
relacionado ao tema. No geral todos os temas já possuem seu próprio assunto no PROJURIS, mas podem existir
temas que não tem um assunto próprio (compartilham um registro geral lá). Fazendo dessa forma com
identificador ajustável, acho que amarramos bem essa situação, e também a situação do registro 'assunto'
quando criarmos um Judicial no projuris direto pelo SHV (ele já sabe de antes qual o assunto ele vai
lançar para o registro)."*

No mesmo desenho ele pede: **"Alterar nome para 'projuris'"** e **"Alterar nome para 'Contaazul'"**, e
anota que *"essas informações ficaram bem repetitivas"*.

Hoje `system_theme_mapping` guarda o de-para tema↔ProJuris usado pelo motor, mas
`projuris_tema_codigo` é preenchido pela sincronização e **não é editável** na tela do tema
(`configuracoes.campos-personalizados.tsx`, aba Distribuição, mostra só "ainda não está mapeado").
`src/lib/projuris/normalizer.ts:196` casa o assunto do processo por **nome normalizado** contra esse
de-para — frágil.

---

## Acceptance Criteria

1. Nova aba **Integrações** na Configuração de temas, com dois blocos: **ProJuris** e **Conta Azul**
   (nomes exatamente assim — pedido do Thiago).
2. Bloco ProJuris permite **escolher o assunto** do tema:
   - lista os assuntos disponíveis no ProJuris (reusando a busca de listas de apoio já existente em
     `src/lib/projuris/criar-processo.ts` — `LISTAS_DE_APOIO.assuntos`), com busca por texto;
   - permite também digitar/colar o **identificador** manualmente (campo ajustável, como ele pediu);
   - deixa **vazio** como opção válida — tema sem assunto próprio usa o assunto geral configurado.
3. **Vários temas podem apontar para o mesmo assunto** — nada de unicidade impedindo isso.
4. O valor é persistido no de-para existente (`system_theme_mapping`), sem tabela nova; se faltar coluna
   para o **código** do assunto (distinto do nome), migration aditiva a cria.
5. Bloco Conta Azul: só a **renomeação e reorganização** do que já existe (centro de custo / categoria),
   sem funcionalidade nova — a integração de cobrança está fora desta leva.
6. A tela mostra o **estado do vínculo** ("mapeado por sincronização" x "definido manualmente") — quem
   olha entende de onde veio.
7. Editar o assunto **não** reprocessa nada retroativo; vale para o que for criado a partir dali.
8. Gate de escrita: módulo Sistema, nível Configurar.
9. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [ ] Migration aditiva para o código do assunto em `system_theme_mapping` (se necessário) (AC 4).
- [ ] Endpoint de listagem de assuntos do ProJuris reaproveitado para a tela (AC 2).
- [ ] Aba **Integrações** com os dois blocos (AC 1, 2, 5, 6).
- [ ] RPC de salvar o vínculo, com gate (AC 4, 8).
- [ ] Renomear rótulos "Projuris"→"ProJuris" e "Contaazul"→"Conta Azul" em todas as telas (AC 1).

---

## Dev Notes

- **Dependência para a S2-03**: é o valor definido aqui que o `criar-processo` vai usar. Se este campo
  estiver vazio, a S2-03 cai no fallback (assunto geral) — nunca no código do caso.
- O motor lê `system_theme_mapping` para pontuação/multiplicador; **não alterar** essa semântica, só
  acrescentar o campo do assunto.
- A lista de apoio do ProJuris pode falhar (rede/credencial): a tela degrada para o campo manual,
  como já faz o diálogo de criação de processo.

## Definition of Done

- [ ] Cada tema pode ter seu assunto do ProJuris definido e revisto pelo Thiago
- [ ] Rótulos renomeados
- [ ] typecheck + lint verdes

---

## Resposta B1 do Thiago (04/09)

> "Tinha deixado no arquivo a ideia dessa vinculação tema SHV - Assunto Projuris como algo para
> preenchermos na mão e ajustável (…) Facilita conforme formos criando/importando ou próximos temas, fica
> melhor que repassar a tabela agora e ter que repetir a cada próximo tema."

Confirma o AC 2 como escrito: **campo ajustável, preenchido à mão por tema**. Ele não vai mandar a tabela
pronta — o de-para é preenchido conforme os temas nascem.

**Fallback:** assunto **"CÍVEIS"**, que já existe no ProJuris. Ele **não achou um identificador sistêmico**
para ele, então o campo precisa aceitar **texto**, não só um id de lista.
