# Story S4-04: Status da etapa sai da tela — gatilho vira Workflow

- **Sprint:** S4 — Caso
- **ID:** S4-04 · **Item do Thiago:** 16 · **Decisão:** D1
- **Status:** ADIADA pelo owner (resposta C1, 04/09)
- **Estimativa relativa:** G — **story de risco alto**
- **Executor sugerido:** @dev · Quality gate: @qa + @architect

---

## Story

**Como** administrador que configura as etapas de um tema,
**quero** só **etapas**, sem um "status" paralelo em cada uma,
**para que** a configuração deixe de ter dois conceitos disputando o mesmo lugar — e para que o que
dispara o financeiro seja uma regra que eu consigo ler e mudar.

---

## Contexto

Anotação do Thiago no desenho 52 (diálogo "Etapas · Inadimplência HV"): *"Essa situação de etapas + status
(normal, ganho, etc), acabou ficando obsoleto. Podemos atingir o mesmo resultado pelo próprio controle das
etapas + workflows. Vamos simplificar e manter apenas as etapas em si, sem esse status. Também estão tendo
alguns erros no workflow relacionado a isso, acho que esse ajuste já deve resolver."*

O "status" é a coluna **`stage_role`** de `system_pipeline_stages` (`normal | won | closed | lost`),
editável no `StageEditor.tsx:247`. Ela **não é decorativa**:

- `won` é a etapa que dispara a **bifurcação financeira** e marca **GANHO** no comercial
  (`pipeline-service.ts:65,103`, `comercial.leads.tsx:63-76`);
- `closed`/`lost` são usados como etapas terminais em contagens e filtros.

O motor de **Workflows** já existe desde 17/08 (`system_workflow_rules` / `system_workflow_runs`,
`runWorkflowsFor`, gatilho **`status_changed`** cabeado, com dropdown de etapas por tema).
Ou seja: a régua para substituir o `stage_role` **já está pronta**.

**Decisão D1:** o status some da tela e o gatilho vira regra de Workflow explícita, com migração.

---

## Acceptance Criteria

### Migração (roda ANTES da UI mudar)

1. Script/migration cria, para **cada etapa hoje `stage_role='won'`**, uma regra de Workflow equivalente:
   *"ao entrar na etapa X (tema T) → abrir o financeiro do caso"* — reusando o gatilho `status_changed`
   e a mesma ação que a bifurcação executa hoje.
2. Idem para o marco **GANHO comercial**, quando aplicável ao funil comercial.
3. As regras nascem **ativas** e são **visíveis** em `/configuracoes/workflows` — quem olhar entende o
   que substituiu o antigo status.
4. Relatório do que foi criado (tema, etapa, regra) anexado ao PR.

### Comportamento

5. O código que hoje decide pelo `stage_role='won'` passa a **não** disparar o financeiro; quem dispara é
   a regra de workflow. Um caso movido para a etapa terminal continua abrindo o financeiro exatamente como
   antes — **provado em teste de ponta a ponta**.
6. As etapas terminais (`closed`/`lost`) continuam funcionando para contagem/filtro. Se a informação
   "esta etapa encerra o caso" for necessária, ela vira uma **propriedade da etapa** com nome explícito
   (ex.: *etapa final*), **não** um seletor de status genérico.
7. O dropdown de **status** some do `StageEditor`. O diálogo fica: nome, ordem, excluir, adicionar.
8. Erros de workflow relatados pelo Thiago são reproduzidos e verificados após a mudança; o que
   permanecer é registrado como bug separado com o caso que reproduz.

### Segurança

9. **Rollback versionado**: migration inversa que restaura os `stage_role` e desativa as regras criadas.
10. Feature flag ou deploy em dois passos (migração → UI) para permitir voltar sem perder dado.
11. `npx tsc --noEmit`, `npm run lint` e testes verdes; teste automatizado do fluxo mover-etapa →
    financeiro aberto.

---

## Tasks / Subtasks

- [ ] Mapear **todos** os pontos que leem `stage_role` (grep já feito: `pipeline-service.ts`,
      `board-service.ts`, `StageEditor.tsx`, `comercial.leads.tsx`, hooks) e decidir caso a caso (AC 5, 6).
- [ ] Migration de conversão + relatório (AC 1-4).
- [ ] Trocar o gatilho do financeiro para o workflow (AC 5).
- [ ] Propriedade "etapa final" explícita, se necessária (AC 6).
- [ ] Remover o dropdown do editor de etapas (AC 7).
- [ ] Reproduzir e reverificar os erros de workflow (AC 8).
- [ ] Migration inversa + plano de rollback (AC 9, 10).

---

## Dev Notes

- **Ordem obrigatória:** migração primeiro, UI depois. Tirar o dropdown antes de criar as regras deixaria
  temas sem gatilho — casos parariam de abrir financeiro em silêncio, que é o pior desfecho possível.
- Atenção ao funil comercial: `comercial.leads.tsx:63-76` identifica a etapa terminal por `stage_role`
  **ou** pelo label "Ganho". Se o `stage_role` sair, o label vira o único critério — o que é frágil.
  Preferir a propriedade explícita de etapa final (AC 6).
- Workflows encadeados existem (`20260831000001_workflow_encadeado.sql`) — conferir que a regra criada
  não dispara laço com regras já cadastradas pelo Thiago.

## Definition of Done

- [ ] Nenhum tema perdeu o gatilho do financeiro (relatório + teste ponta a ponta por tema)
- [ ] Editor de etapas só com etapas
- [ ] Rollback testado

---

## ⚠️ ADIADA — resposta C1 do Thiago (04/09)

A decisão D1 (tirar o status da etapa e transformar o gatilho em workflow) **foi adiada por ele**:

> "Essa etapa para fins de financeiro e etc acabou ficando obsoleto, mas para facilitar vamos manter da
> forma atual e trabalhamos melhor essa alteração quando avançarmos nos próximos passos do módulo
> financeiro."

**Nada foi implementado** e nada deve ser: `stage_role` continua como está, e o gatilho do financeiro
segue sendo a etapa marcada como "Ganho".

Esta era a segunda story de risco alto do plano (a outra é a S2-04). Sai da leva — retomar quando o
módulo financeiro avançar, junto com a decisão de o que fazer com "Encerrado"/"Perdido".
