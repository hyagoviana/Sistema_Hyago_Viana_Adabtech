# Story S5-02: Tela de permissões por papel (matriz editável)

- **Sprint:** S5 — Permissões
- **ID:** S5-02 · **Item do Thiago:** 15
- **Status:** Ready for Review
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

- [x] Tela da matriz + RPC de leitura/gravação com gate (AC 1, 2, 6).
- [x] Contagem de usuários por papel e aviso de impacto (AC 3, 4).
- [ ] Ajustar o painel por usuário para mostrar herdado × override (AC 5).
- [x] Auditoria (AC 7).
- [x] Testes: salvar papel muda o efetivo de todos; override do usuário sobrevive; guarda de auto-bloqueio.

---

## Dev Notes

- A tela é uma **grade**, não um formulário por papel — o Thiago pensa nessa régua como tabela (foi assim
  que ele mandou).
- Cuidado com cache: `permissaoEfetiva` é usada em toda a UI; invalidar as queries de permissão ao salvar,
  senão a pessoa continua vendo o menu antigo até recarregar.

## Definition of Done

- [ ] Dá para mudar a régua de um papel inteiro sem tocar em usuário
- [ ] Overrides individuais continuam funcionando e ficam identificáveis

---

## Dev Agent Record (03/09/2026)

**Implementado.** A aba **Permissões** ganhou duas abas: **Pessoas** (a gestão que já existia) e
**Padrão por papel** (nova).

`RolePermsMatrix.tsx` — grade papéis × módulos, um seletor por célula com quatro níveis mais
**"Padrão do sistema"** (que remove a linha e devolve o papel à régua embutida no código). Edição é por
LINHA: mexe no papel, aparece o botão Salvar daquela linha.

- **Alcance visível** (AC 3): cada papel mostra quantas pessoas o têm (só ativos — suspenso e arquivado
  não contam, senão o número assusta sem motivo).
- **Aviso de impacto** (AC 4): reduzir um nível pede confirmação dizendo quantas pessoas perdem acesso.
- **Guarda de auto-bloqueio** (AC 6, server-side): um admin não consegue reduzir o acesso do próprio
  papel ao módulo Sistema — ficaria sem como desfazer pela tela. Devolve 422 com a explicação.
- **Auditoria** (AC 7): `role_perms.updated` em `system_audit_log`, com papel, mudança e autor.
- Papéis **legados** aparecem no fim da tabela, esmaecidos e marcados — some com o de-para (S5-04).
- Salvar invalida a matriz **e** as permissões do usuário logado; sem isso o menu continuaria mostrando a
  régua antiga até recarregar a página.

**Bônus da S5-01 que faltava:** o schema de escrita de override por usuário só aceitava
`none|view|edit` — agora aceita `configure` (era o AC 7 daquela story, que tinha ficado pela metade).

**Não feito (AC 5):** o painel por usuário ainda não distingue visualmente "herdado" de "override" nem
tem o botão "voltar ao padrão do papel". A régua já funciona (override vence, e `null` volta ao padrão);
falta a etiqueta na tela. Registrado como pendência da story.

---

## QA Results — 03/09/2026 (Quinn)

**Gate: CONCERNS** — o que foi implementado está correto e provado; o AC 5 ficou de fora.

`scripts/qa-role-perms-matriz.ts` (`npm run qa:role-perms`) exercita o serviço contra o **banco real**,
usando um papel de teste que não existe no sistema — nenhum papel em uso é tocado. 9/9:

- a matriz lê os 4 papéis semeados (atendimento, coordenador, estagiario, suporte);
- grava, regrava e **o cache é invalidado** (a segunda gravação aparece na hora — sem isso a tela salvaria
  e a régua só mudaria um minuto depois);
- a régua vale de fato: com padrão `view` o papel vê e **não** edita;
- **override do usuário continua vencendo** o padrão do papel;
- `null` remove a linha e devolve ao padrão do sistema;
- **as 32 linhas dos papéis reais seguem intactas** antes e depois do teste;
- o papel de teste foi limpo no `finally` — zero rastro.

`npm run test:rbac` e `npm run build` verdes.

**Pendência para fechar:** AC 5 (herdado × override visível no painel de cada pessoa).
