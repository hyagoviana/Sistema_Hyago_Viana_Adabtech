# Story S5-02: Tela de permissões por papel (matriz editável)

- **Sprint:** S5 — Permissões
- **ID:** S5-02 · **Item do Thiago:** 15
- **Status:** Draft
- **Estimativa relativa:** G
- **Executor sugerido:** @dev · Quality gate: @qa
- **Depende de:** S5-01

---

## Story

**Como** administrador,
**quero** editar o que **cada papel** enxerga e faz, numa tabela,
**para que** eu não precise ajustar pessoa por pessoa quando a regra é do cargo inteiro.

---

## Contexto

Diálogo da reunião (bloco 2, 13:18-15:06):

> **Thiago:** *"eu acho que a gente precisava de um menu de permissão do perfil, onde a gente pode
> configurar o que que o perfil em si vai ver"*
> **Matheus:** *"isso vai mudar nesse perfil que tu abriu, por exemplo, nesse usuário"*
> **Thiago:** *"Mas é só no dele, eu não mudo no perfil dele como um todo completo (...) Eu não tenho como
> mudar o do perfil"*
> **Adavio:** *"ele quer para todo o perfil, que hoje ele consegue editar para um usuário. Não para todo o
> papel"*
> **Matheus:** *"A gente pode deixar em configurações ali o nível do papel"*

Hoje só existe o painel por usuário (dentro de "Editar usuário"), com "Padrão do papel · Ver · Visualizar ·
Editar" por aba.

---

## Acceptance Criteria

1. Nova tela **Permissões por papel**, dentro de Configurações (ou como aba de Usuários e permissões),
   com a **matriz papéis × módulos** e o nível em cada célula (**Sem acesso · Ver · Editar · Configurar**).
2. Salvar grava em `system_role_module_perms` (S5-01) e passa a valer para **todos** do papel, na hora.
3. A tela mostra, ao lado de cada papel, **quantos usuários** o têm — quem edita vê o alcance da mudança.
4. **Aviso de impacto** antes de salvar uma redução de acesso: "N pessoas perdem acesso a X".
5. O painel **por usuário** continua existindo e continua vencendo o padrão do papel; ele passa a exibir
   claramente o que é **herdado** e o que é **override**, com um botão "voltar ao padrão do papel".
6. Só quem tem **Configurar** no módulo **Sistema** entra na tela (e ninguém consegue remover o próprio
   acesso de administrar: guarda contra auto-bloqueio).
7. Toda alteração vai para `system_audit_log` (quem, quando, papel, módulo, de/para).
8. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [ ] Tela da matriz + RPC de leitura/gravação com gate (AC 1, 2, 6).
- [ ] Contagem de usuários por papel e aviso de impacto (AC 3, 4).
- [ ] Ajustar o painel por usuário para mostrar herdado × override (AC 5).
- [ ] Auditoria (AC 7).
- [ ] Testes: salvar papel muda o efetivo de todos; override do usuário sobrevive; guarda de auto-bloqueio.

---

## Dev Notes

- A tela é uma **grade**, não um formulário por papel — o Thiago pensa nessa régua como tabela (foi assim
  que ele mandou).
- Cuidado com cache: `permissaoEfetiva` é usada em toda a UI; invalidar as queries de permissão ao salvar,
  senão a pessoa continua vendo o menu antigo até recarregar.

## Definition of Done

- [ ] Dá para mudar a régua de um papel inteiro sem tocar em usuário
- [ ] Overrides individuais continuam funcionando e ficam identificáveis
