# Story S5-03: Unificar Perfil e Nível de acesso (mantendo Cargo) + ocultar suspensos

- **Sprint:** S5 — Permissões
- **ID:** S5-03 · **Item do Thiago:** 15
- **Status:** Draft
- **Estimativa relativa:** M
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** administrador cadastrando um colaborador,
**quero** **um** campo definindo o acesso da pessoa (e não dois que dizem quase a mesma coisa),
**para que** ninguém preencha "Perfil" achando que mudou permissão.

---

## Contexto

Anotações do Thiago no desenho 37 (diálogo "Editar usuário"):
- *"Cargo vamos manter como uma informação individual. É usado pelo motor e outras configurações que
  faremos no futuro."*
- *"Essas 2 informações estão redundantes, vamos unificar em uma só condição."* (Perfil × Nível de acesso)
- E no desenho 39, sobre a lista: *"Adicionar uma opção de filtro para ocultar os perfis suspensos da
  visualização."*

Na reunião ele reforçou: *"aqui é perfil, nível de acesso, e aqui ele já fala em papel. Então são
entidades diferentes, unir isso tudo em uma coisa só"*.

Hoje o diálogo tem: **Nível de acesso** (que é o papel do RBAC) e, em "Dados do colaborador",
**Perfil**, **Cargo**, **Unidade organizacional**, **Status ProJuris**.

---

## Acceptance Criteria

1. **Nível de acesso** é o campo único que define permissão, e passa a se chamar apenas
   **"Nível de acesso"** em todas as telas (o termo "papel" some da UI — segue existindo no código).
2. O campo **Perfil** sai do formulário. Os valores já preenchidos:
   - se corresponderem a um papel da matriz, viram sugestão no de-para da **S5-04**;
   - são preservados em coluna legada (não apagar dado), e a `system_perfis` deixa de ser oferecida no
     cadastro de usuário.
3. **Cargo permanece**, separado e explicitamente descrito como "não muda permissão" — texto que já existe
   no diálogo ("Nada aqui muda permissão nem afeta o motor") ajustado para refletir que **cargo afeta sim
   o motor/sucumbência**, mas não permissão.
4. A lista de usuários ganha filtro **"Ocultar suspensos"** (ligado por padrão), com contador de quantos
   estão ocultos.
5. Nenhum usuário muda de acesso por causa desta story — é reorganização de formulário.
6. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [ ] Remover o campo Perfil do formulário e ajustar textos (AC 1-3). (`src/routes/permissoes.tsx` +
      componentes de usuários, `src/lib/users-service.ts`)
- [ ] Filtro de suspensos na lista (AC 4).
- [ ] Verificar usos de `system_perfis` e marcar como legado (AC 2).

---

## Dev Notes

- **Não** dropar `system_perfis` nem a coluna — o projeto tem o hábito (correto) de deixar dormente e
  limpar depois, como foi feito com `frente_slug`.
- Conferir se algum lugar do motor lê "perfil" achando que é cargo — o `cadastro-colaborador.ts` mapeia
  perfil/cargo na importação da planilha do Thiago.

## Definition of Done

- [ ] Um só campo define acesso; cargo continua para o motor
- [ ] Lista sem o ruído dos suspensos
