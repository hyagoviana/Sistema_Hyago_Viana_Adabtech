# Story S5-04: De-para dos usuários e aplicação do nível Configurar

- **Sprint:** S5 — Permissões
- **ID:** S5-04 · **Item do Thiago:** 15 · **Decisão:** D2
- **Status:** Draft
- **Estimativa relativa:** M — **mexe no acesso de gente que está trabalhando**
- **Executor sugerido:** @dev · Quality gate: @qa + aprovação do owner
- **Depende de:** S5-01, S5-02, S5-03

---

## Story

**Como** dono do sistema,
**quero** que os 41 usuários cadastrados passem para os papéis da matriz **com revisão minha antes**,
**para que** ninguém chegue na segunda-feira sem conseguir trabalhar.

---

## Contexto

Decisão D2: adotar a matriz do Thiago. Os papéis atuais não têm correspondência óbvia em todos os casos
(`advogado_titular`, `advogado_associado`, `prestador_externo` não existem na matriz; `Coordenador`,
`Suporte`, `Atendimento` e `Estagiário` não existem hoje).

Proposta de de-para (a ser revisada pelo owner):

| Papel atual | Papel novo |
|---|---|
| admin | Administrador |
| advogado_titular | Coordenador |
| advogado_associado | Operacional |
| prestador_externo | Operacional *(com override restritivo, caso a caso)* |
| controladoria | Controladoria |
| comercial | Atendimento |
| financeiro | Financeiro |
| operacional | Operacional |
| marketing | Marketing |

Sem correspondência automática: **Suporte** e **Estagiário** — atribuição manual, caso a caso.

---

## Acceptance Criteria

1. Script gera a **planilha de de-para** (usuário, e-mail, papel atual, papel proposto, módulos que ganha,
   módulos que perde) em CSV, **sem escrever nada**.
2. O owner/Thiago revisam e devolvem a planilha ajustada; o script aplica **a partir do arquivo revisado**
   (nunca do mapa hardcoded).
3. Aplicação é **transacional e reversível**: snapshot dos papéis antigos em tabela/arquivo antes de
   escrever; script de rollback pronto.
4. Ninguém fica sem papel; ninguém vira administrador por acidente (o script recusa promover a
   Administrador sem marcação explícita na planilha).
5. O nível **Configurar** é efetivamente aplicado nas telas que a matriz exige — em especial o menu
   **"Editar caso"** (S4-01), a **configuração de temas** (S2-01) e a tela de **permissões por papel**
   (S5-02). Todos os `TODO` deixados pelas stories anteriores são fechados aqui.
6. Cada gate novo tem teste: papel sem Configurar não vê/não executa; com Configurar, sim.
7. Verificação pós-aplicação: relatório com contagem por papel e uma amostra de usuários reais conferida
   por login (ou por simulação de sessão).
8. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [ ] Script `scripts/de-para-papeis.ts` (`--export`, `--apply arquivo.csv`, `--rollback`) (AC 1-4).
- [ ] Exportar, enviar ao owner, aguardar retorno (AC 2).
- [ ] Fechar os `TODO` de gate espalhados pelas sprints anteriores (AC 5, 6).
- [ ] Relatório pós-aplicação (AC 7).

---

## Dev Notes

- Este é o passo com maior chance de gerar chamado no dia seguinte. Aplicar **no início do expediente**,
  com alguém de plantão, e não numa sexta à noite.
- Prestador externo: hoje `seesOnlyOwnCases` limita a visão a casos vinculados. Se virar Operacional, essa
  restrição some — por isso a linha da tabela pede override restritivo. Confirmar com o owner na revisão
  da planilha.
- Lembrar do bug histórico do `requireRole` com status em caixa diferente ("active" × "ACTIVE") — rodar a
  verificação de acesso de ponta a ponta, não só o cálculo em memória.

## Definition of Done

- [ ] Planilha revisada pelo owner e aplicada
- [ ] Nenhum usuário sem acesso ao que precisa; nenhum com acesso a mais
- [ ] Rollback pronto e testado
