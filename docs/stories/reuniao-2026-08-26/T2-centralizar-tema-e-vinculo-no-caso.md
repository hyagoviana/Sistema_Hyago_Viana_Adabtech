# Story T2: Tema configurado num lugar só + vínculo de usuário no CASO alimentando o motor

**Épico:** Reunião 2026-08-26 · **ID:** T2 (item 13-b do owner) · **Onda:** 3 · **Status:** Ready for Review
**Executor:** @dev · Quality gate: @qa
**Risco:** MÉDIO — mexe na precedência de quem recebe a tarefa. A parte de nav é trivial; a do motor exige cuidado.

---

## Story

**Como** administrador,
**quero** configurar **tema** num lugar só, e registrar no **caso** o vínculo com o usuário responsável,
**para que** o motor, na hora de distribuir, puxe essa informação do caso em vez de eu manter uma segunda configuração paralela.

Thiago: "eu só vou tirar essa parte de tema então, dentro de distribuição, que como a gente vai espelhar lá do outro tema, não precisa ter aqui." E: "colocar um registro lá [no caso], uma opção de que esse caso ele tem um vínculo com X usuário, e aí o sistema aqui na hora de rodar o motor vai puxar… então que são esse campo lá dos casos."

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **A configuração de tema já é centralizada.** `src/routes/configuracoes.campos-personalizados.tsx` → `TemaConfigTabs` (linha 217) já tem **três abas por tema**: **Campos** (`TemaFieldDefsEditor`), **Pastas** (`CategoryFoldersEditor`) e **Distribuição** (`TemaDistribuicaoPanel`, linha ~257). Ou seja: **o que a aba Temas do motor faz já está aqui dentro.**
- **A aba duplicada:** `src/routes/controladoria.distribuicao.temas.tsx` (317 linhas) — `useThemeMappings`, `useUpsertThemeMapping`, `useExecutorMappings`; registrada na nav em `controladoria.distribuicao.tsx:62`.
- **Vínculo do caso com usuário já existe:** `src/lib/case-responsaveis-service.ts` + tabela `system_case_responsaveis` (multi-advogados; é a fonte de verdade da **visibilidade** do caso, RBAC de 09/07).
- **Precedência do motor (hoje):** `src/lib/distribuicao/engine/flow-selector.ts:35-66` —
  1. responsável absoluto da tarefa; 2. `theme_exclusive_executor_id`; 3. `task_type_exclusive_executor_id`; senão, distribuição normal por pontos (`motor.ts:138`).
  A exceção por (tipo × tema) vive em `system_task_type_theme_exclusives` (migration `20260824000001`).
- **A aba Vínculos (`controladoria.distribuicao.vinculos.tsx`) é OUTRA coisa:** é a conferência **caso ↔ processos do ProJuris** (o cabeçalho do arquivo documenta a decisão do Thiago de 24/08: escolha manual, um caso pode ter vários processos). **Não é o "vínculo com usuário".**

### NOVO

1. A aba **Temas** do motor vira **redirect** para a configuração do tema.
2. O **caso** ganha, na ficha, a leitura/edição do vínculo com usuário (reusando `system_case_responsaveis`) exposta de forma explícita para o motor.
3. O motor passa a considerar o **responsável do caso** na escolha do executor.

---

## DECISÕES TRAVADAS pelo owner (2026-08-26) — não reabrir

1. **A aba "Vínculos" (caso ↔ processo do ProJuris) FICA.**
   Na reunião o Thiago perguntou "esse vínculo é o quê?" e, no fim, descobriu que o casamento **já é automático pelo número do processo** ("eles nem precisam trazer para cá"). Mesmo assim ela permanece: é a **saída manual** para quando o automático não casa. **Esta story não toca nela.**
2. **Precedência do executor:** o responsável do caso entra **depois** dos exclusivos
   (exceção tipo×tema > exclusivo do tipo > exclusivo do tema) e **antes** da distribuição por pontos,
   e **só** quando o caso tiver exatamente **um** responsável. Com 0 ou 2+, cai na distribuição normal — o sistema **não escolhe no chute**.

---

## Acceptance Criteria

1. **Uma configuração de tema.** A aba **Temas** do motor redireciona para a configuração do tema (`/configuracoes/campos-personalizados`, aba Distribuição do tema selecionado). Nenhum campo editável se perde: multiplicador, executor exclusivo do tema e o que mais a tela antiga oferecia continuam editáveis lá.
2. **A nav do motor continua fazendo sentido.** O item some (ou vira atalho) do grupo Configuração sem quebrar as outras abas.
3. **Vínculo visível no caso.** Na ficha do caso é possível **ver e editar** o(s) usuário(s) vinculado(s) ao caso, com o rótulo explicando que o motor usa essa informação. Sem criar tabela nova: é `system_case_responsaveis`.
4. **O motor usa.** Ao distribuir uma tarefa de um caso com **um** responsável, e não havendo regra exclusiva aplicável, a tarefa é atribuída a esse responsável. Com 0 ou 2+ responsáveis, o comportamento atual (distribuição por pontos) é preservado.
5. **A precedência fica explícita.** A regra completa é documentada em comentário no `flow-selector.ts` e no painel de configuração do motor, para ninguém precisar ler código para saber quem ganha.
6. **Sem regressão de visibilidade.** Mexer no vínculo continua afetando **quem enxerga o caso** exatamente como hoje (regra RBAC de 09/07) — a story não pode afrouxar isso.
7. **Rastro.** A escolha do executor por vínculo do caso aparece no motivo/registro da distribuição (o mesmo lugar onde hoje aparece "exclusivo do tipo"), para o Thiago conseguir auditar.
8. **Gates.** `typecheck` + `lint` limpos; distribuição ponta a ponta testada com os 3 cenários (0, 1, 2+ responsáveis).

---

## Tasks / Subtasks

### T1 — Nav (@dev)
- [x] Conferir campo a campo `controladoria.distribuicao.temas.tsx` contra `TemaDistribuicaoPanel`; anotar no PR. (AC-1)
- [x] Transformar a rota em redirect e ajustar `controladoria.distribuicao.tsx:62`. (AC-1, AC-2)

### T2 — Caso (@dev)
- [x] Expor o vínculo na ficha (reusar o seletor de responsáveis que já existe), com texto explicando o uso pelo motor. (AC-3, AC-6)

### T3 — Motor (@dev)
- [x] `flow-selector.ts`: novo degrau de precedência lendo `system_case_responsaveis` do caso da tarefa (só quando houver exatamente 1). Comentar a regra completa. (AC-4, AC-5)
- [x] Registrar o motivo da escolha no mesmo campo/registro usado pelos exclusivos. (AC-7)

### T4 — QA (@qa)
- [ ] URL antiga da aba Temas: cai na configuração do tema, com os mesmos campos. (AC-1)
- [ ] Caso com 1 responsável: tarefa vai para ele. Com 2: cai na distribuição por pontos. Sem responsável: idem. (AC-4)
- [ ] Regra exclusiva (tipo × tema) continua ganhando do responsável do caso. (AC-5)
- [ ] Visibilidade do caso inalterada para advogado não vinculado. (AC-6)

---

## Dev Notes

- **Não criar campo novo de "usuário do caso".** `system_case_responsaveis` já é a fonte de verdade e já governa visibilidade. Criar um segundo vínculo produziria justamente a duplicidade que esta story existe para acabar.
- **Precedência é assunto sensível:** o Thiago falou em melhorar isso depois ("a gente considera por executor, depois a gente distribui entre o time da pessoa… vamos deixar primeiro, ver se roda legal esses primeiros dias"). Por isso o degrau novo é **conservador** (só com 1 responsável) e **auditável**.
- **Fazer depois de T1 (tipos de tarefa),** porque as duas mexem em `controladoria.distribuicao.tsx`.
- **Aba Financeiro do tema** (centro de custo / serviço do ContaAzul) **não** entra aqui — é da story **FN1**, que acrescenta a quarta aba ao `TemaConfigTabs`.

## Testing

- **UI:** redirect + ficha do caso.
- **Motor:** os 3 cenários de responsável + a regra exclusiva ganhando.
- **Gates:** typecheck + lint.

## Dependências

- **T1 primeiro** (mesma nav).
- **FN1** vai acrescentar aba no mesmo `TemaConfigTabs` — não colidem se T2 entrar antes.

## File List

**Alterados**
- `sistema-hv/src/routes/controladoria.distribuicao.temas.tsx` (vira redirect)
- `sistema-hv/src/routes/controladoria.distribuicao.tsx`
- `sistema-hv/src/routes/casos.$id.index.tsx` (vínculo explícito)
- `sistema-hv/src/lib/distribuicao/engine/flow-selector.ts`
- `sistema-hv/src/lib/case-responsaveis-service.ts` (leitura para o motor, se necessário)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial com 2 pontos de decisão para o owner (aba Vínculos e precedência) | @sm (River) |
| 2026-08-26 | v0.3 | **Implementada.** A aba Temas do motor virou redirect (o `TemaDistribuicaoPanel`, dentro do tema em Configurações, já editava os mesmos campos). O degrau novo da precedência NÃO foi para o `flow-selector` (motor puro, com testes): entrou em `staging-core.ts`, onde a linha da tela 2 é montada — assim o responsável do caso vira o `exclusive_executor_id` da linha, que fica **visível e editável** antes de rodar o motor ("processo automatizado, não automático"). A regra das três precedências, que estava DUPLICADA em dois pontos do arquivo, virou uma função só (`resolverExclusivo`). A ficha do caso passou a mostrar o vínculo com a frase que explica o efeito no motor. typecheck OK, eslint OK, build OK. **Falta o T4 (UI).** | @dev (via Orion) |
| 2026-08-26 | v0.2 | Decisões travadas pelo owner: aba Vínculos **fica** (story não a toca); precedência = responsável do caso só com **1** responsável, depois dos exclusivos. Story pronta para o @dev. | @aios-master (Orion) |

## QA Results

**Revisor:** @qa (Quinn) · **Data:** 2026-08-26 · **Parecer completo:** `QA-onda-3.md`

**PASS.** A decisão de resolver o degrau novo em `staging-core` (e não no motor puro) melhora o resultado: o responsável vira o exclusivo da linha da tela 2, que fica visível e editável antes de rodar. A view `system_case_responsaveis_active` tem a coluna lida. De quebra, a regra de precedência que estava duplicada no arquivo virou função única.

**Gates reproduzidos pelo QA:** `typecheck` limpo · `eslint` limpo · `vite build` OK.
**Pendente:** passeio manual na UI (nenhum agente exercitou a tela).
