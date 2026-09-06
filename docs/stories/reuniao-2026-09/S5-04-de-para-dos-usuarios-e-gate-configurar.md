# Story S5-04: De-para dos usuários e aplicação do nível Configurar

- **Sprint:** S5 — Permissões
- **ID:** S5-04 · **Item do Thiago:** 15 · **Decisão:** D2
- **Status:** CONCLUÍDA (06/09) — de-para NÃO aplicado por decisão do owner
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

---

## Regras definidas — respostas C3 do Thiago (04/09)

- **C3.1 — prestador externo sai.** "Remove o perfil prestador externo (não temos um trabalho nesse
  sentido), mantem como operacional, e ai se for o caso em alguma situação especifica fazemos isso de
  alterar as permissões do usuario em especifico." → o único usuário com esse papel vira **Operacional**;
  restrição individual, se precisar, vira override.
  **Atenção:** `seesOnlyOwnCases` lista os papéis que só enxergam os próprios casos. Ao virar Operacional,
  essa pessoa passa a **ver a base toda** — é o efeito que ele aceitou ao dizer "ajustamos o usuário
  específico". Confirmar na aplicação.
- **C3.2 — dúvida vira Operacional.** "Pode deixar todos os que tenham dúvida como operacional, depois
  ajustamos aqui na mão."
- **C3.3 — Coordenador com "Ver" em Sistema:** confirmado.
- **C3.4 — módulos fora da matriz:** "O judicial na verdade está integrado ao módulo 'casos', então usa as
  mesmas permissões do módulo. O módulo inteligência é algo muito embrionário, então mantém fechado para
  todos que não forem administrador."
  **Verificado:** não há nenhum override de usuário no módulo `judicial` — alinhá-lo ao operacional não
  quebra ninguém.

**Insumo do de-para (achado da S5-03):** **Wesley Ramos** tem `perfil = coordenador` com papel
`operacional`. É a única informação que o campo Perfil guarda e o papel não tem — primeiro candidato ao
papel **Coordenador**.

---

## Execução — 06/09/2026

### O achado que travava tudo: `Configurar` era inalcançável

`deriveRoleModuleAccess` tinha teto `edit`, e a S5-01 semeou a matriz só para os quatro papéis NOVOS
(regressão zero). O **admin não tem linha lá**, caía no derivado e ficava sem `configure` — então
`requireModule(x, "configure")` recusava **todo mundo, inclusive ele**. Os dois RPCs que a S2-02 criou
com esse gate estavam inacessíveis.

Corrigido: o admin passa a ter `configure` em todos os módulos, que é o que a descrição do papel sempre
disse. Como `configure` está no topo da escada, isso só ADICIONA — o QA prova que nenhum papel perdeu
`view` ou `edit`.

Com isso a decisão **D10** vale como escrita:

| Papel | Configura |
|---|---|
| Administrador | todos os módulos |
| Coordenador | cliente, comercial, operacional (matriz) |
| Demais | nada |

### Gates aplicados (AC5, AC6)

- Menu **"Editar caso"** → `usePodeConfigurar("operacional")`. Editar o **nome** do caso continua em
  `edit`: é conteúdo, não régua.
- **Configurar tema** → `requireModule("sistema", "configure")`, fechando o `TODO(R3)` de
  `rpc/temas.ts`. Era `requireRole(["admin"])`, papel cravado no código que ignorava a matriz; agora
  delegar é ajuste de permissão, não alteração de código.
- Novo hook `usePodeConfigurar`.

### O de-para — entregue, NÃO aplicado

Três scripts, com o passo humano no meio de propósito:

| Comando | O que faz |
|---|---|
| `npm run depara:gerar` | produz o CSV, **sem escrever nada** |
| `npm run depara:aplicar` | lê a **planilha revisada** (nunca um mapa no código), grava snapshot antes de escrever |
| `npm run depara:reverter` | desfaz a partir do snapshot |

Travas: promover a Administrador exige `SIM` escrito; linha sem papel proposto aborta tudo; planilha
desatualizada é recusada em vez de sobrescrever decisão mais recente; reverter não toca em quem já foi
movido para outro papel depois.

Planilha gerada: `docs/reunioes/depara-usuarios-2026-09-06.csv` (43 usuários).

**Decisão do owner (06/09): NÃO aplicar.** Dos 43, só 2 estão em papel legado:

| Pessoa | Papel | Situação | Decisão |
|---|---|---|---|
| Matheus Torquato | `prestador_externo` | ativo | É o **desenvolvedor**, não opera o sistema. Virar `operacional` só o faria enxergar todos os casos sem necessidade. **Fica como está.** |
| mariana pestana | `advogado_titular` | suspensa | Não usa o sistema. **Fica como está.** |

Os outros 41 já estão nos papéis da matriz. Os papéis legados continuam válidos em `ROLES` justamente
para isso — ninguém fica sem papel. Os scripts ficam prontos para quando entrar alguém num papel legado.

**Também por decisão do owner:** Nicole Rocha, Pablo Silva e Ana Patricia Cruz têm `perfil=administrador`
no campo antigo mas papel não-admin. Ficam como estão — o campo `perfil` é resíduo do cadastro velho e
não governa acesso nenhum.

### QA — `npm run qa:s504`

38 verificações: que Configurar é alcançável, que ninguém perdeu acesso, que os gates estão no código e
que as travas do de-para existem. Ele pegou um `requireRole` que sobrou como import morto em `temas.ts`.
