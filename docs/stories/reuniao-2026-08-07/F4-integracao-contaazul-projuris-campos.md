# Story F4: Definir e exibir os campos das integrações (Judicial↔ProJuris, Financeiro↔Conta Azul)

- **Épico:** Futuro (pós-segunda) — Reunião 2026-08-07
- **ID:** F4
- **Status:** **Backlog / Futuro (a projetar quando a controladoria/Conta Azul fechar)**
- **Estimativa relativa:** L
- **Executor sugerido:** @architect + @dev + @data-engineer · Quality gate: @qa
- **Risco:** MÉDIO — depende da modelagem financeira (Conta Azul) que ainda está sendo fechada com terceiro (Adavio/Iago); exibe dados de integração no caso e liga cobranças por identificador.
- **Origem:** Reunião 2026-08-07 (bloco FUTURO, **F4**). Transcrição `Matheus Torquato [0601] Opa, Thiago.txt`: *"quando a gente trabalhando na integração Conta Azul e ProJuris, a gente ainda vai projetar quais são os campos que vai aparecer"*, *"na aba judicial poder identificar o identificador do processo"*, *"no financeiro a opção de adicionar para aquela cobrança qual é a fatura do Conta Azul."*

> ⚠️ **NÃO É PARA ANTES DE SEGUNDA.** O Thiago: *"a projetar… vocês organizem essa Conta Azul, como vai funcionar o processo, para a gente poder organizar no sistema."* Depende de fechar a modelagem financeira. As bases de **identificação manual** (M5 = ID ProJuris na aba Judicial; M6 = nº da fatura Conta Azul na aba Financeiro) são do lote **até-segunda** (reuniao-2026-08-07-melhorias-ate-segunda) — F4 é a camada de **espelhar/gerar** que vem depois.

---

## Story

**Como** controladoria/gestor operando um caso,
**quero** que a aba **Judicial** exiba os campos **espelhados do ProJuris** e a aba **Financeiro** exiba/gere as **cobranças do Conta Azul**, casando caso↔ProJuris por **identificador do processo** e cobrança↔Conta Azul por **número da fatura**,
**para que** o caso seja o painel único: o judicial reflete o que está no ProJuris e o financeiro reflete/gera o que está no Conta Azul, sem sair do sistema.

> **DECISÕES TRAVADAS (reunião 2026-08-07):**
> 1. **Identificação primeiro (bases já no lote até-segunda):** M5 = campo manual do **identificador do processo no ProJuris** (ex.: `PRO.0007713`) na aba Judicial; M6 = campo manual do **nº da fatura do Conta Azul** por cobrança na aba Financeiro. F4 assume esses campos existindo e **liga os dados de verdade** por cima.
> 2. **Judicial espelha o ProJuris** (D1: ProJuris é a fonte; SHV espelha) — F4 define **quais campos** do ProJuris aparecem na aba Judicial (o Thiago vai fornecer a lista).
> 3. **Financeiro espelha/gera Conta Azul** — F4 define quais campos de cobrança aparecem e permite **gerar cobrança** (o cliente pode ter várias cobranças → casar por nº de fatura).
> 4. **A projetar depois de fechar Conta Azul** — a modelagem do processo financeiro com o terceiro precisa estar pronta; F4 não bloqueia a semana.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Aba Judicial (espelho ProJuris, só-leitura):** `sistema-hv/src/routes/casos.$id.judicial.tsx` (G1 do lote 08-05) — quadro-resumo (tribunal/órgão/nº processo/etapa) + lista de tarefas (tipo/responsável/status/prazos) + "Atualizar do ProJuris" + gate de sigilo `usePodeVerJudicial`. F4 **estende os campos exibidos** aqui conforme a lista do Thiago.
- **Sync de judicial:** `sistema-hv/src/lib/projuris/judicial-sync.ts` + `sistema-hv/src/rpc/judicial.ts` (leitura idempotente do ProJuris) — casa por identificador do processo (`projuris_processo_codigo`/`numero_processo`). Ver também `sistema-hv/src/lib/projuris/client.ts` (`projurisGet`/`projurisPostConsulta`, só-leitura).
- **Aba Financeiro do caso:** `sistema-hv/src/routes/casos.$id.financeiro.tsx` (+ `casos.financeiro.*`) — onde as cobranças/fatura aparecem. O **termo migra para dentro do Financeiro** (M4 do lote até-segunda).
- **Cliente Conta Azul (v2):** `sistema-hv/src/lib/contaazul/{client,service,types}.ts` — já sincroniza pessoas e **gera cobrança** (`gerarCobranca`, `criarContaAReceber`, `getCobranca`, `buscarContasAReceber`, `deleteCobranca`). F4 liga esses a cada cobrança do caso por nº de fatura.
- **Asaas (opcional):** `sistema-hv/src/lib/asaas/*` — provedor alternativo já modelado.
- **Motor/writeback ProJuris (H3, já implementado):** `sistema-hv/src/lib/distribuicao/writeback.ts` — referência de escrita controlada (não é o foco de F4, que é exibição/casamento).

### NOVO (a construir nesta story — FUTURO)

- **Mapa de campos exibidos por integração:** definição (config ou código) de **quais** campos do ProJuris aparecem na aba Judicial e **quais** campos de cobrança do Conta Azul aparecem no Financeiro (lista fornecida pelo Thiago).
- **Casamento por identificador:** usar o campo M5 (identificador ProJuris) para puxar/espelhar o judicial do caso; usar o campo M6 (nº da fatura) para casar cada cobrança do caso com a fatura no Conta Azul.
- **Exibição no Financeiro:** por cobrança, mostrar status/valor/vencimento vindos do Conta Azul (leitura) e permitir gerar/atualizar cobrança (reuso de `contaazul/service.ts`), com o nº da fatura persistido no caso.

---

## Acceptance Criteria (aplicáveis quando a modelagem Conta Azul fechar)

1. **Judicial exibe os campos do ProJuris definidos:** a aba Judicial mostra o conjunto de campos que o Thiago especificar (além do resumo/tarefas já existentes de G1), espelhados por leitura idempotente e casados pelo **identificador do processo** (M5). Continua só-leitura (D1) e respeitando o gate de sigilo (G4).
2. **Financeiro exibe/gera Conta Azul por fatura:** na aba Financeiro, cada cobrança do caso mostra os dados vindos do Conta Azul (status/valor/vencimento) e pode ser **gerada/atualizada** via `contaazul/service.ts`, casando por **nº da fatura** (M6). Um caso com várias cobranças casa cada uma à sua fatura.
3. **Campos configuráveis/definidos:** a lista de campos exibidos por integração está definida num ponto único (config ou constante) — não espalhada — para o Thiago validar "quais campos aparecem".
4. **Identificação é a chave:** sem o identificador (M5/M6) preenchido, o espelho/casamento não acontece (não adivinha) — orienta o usuário a preencher o identificador.
5. **Depende da modelagem financeira fechada:** a story só executa após o processo Conta Azul estar modelado com o terceiro; documentado como pré-condição.
6. **Regressão/segurança:** só-leitura no ProJuris (nenhuma escrita nova além do que H3 já cobre); escrita no Conta Azul só nos endpoints já existentes de cobrança; RLS org-scoped + gate de sigilo (G4) preservados; nenhum segredo em log/front; `typecheck`/`lint` verdes.

---

## Tasks / Subtasks

### T0 — Pré-condição (@architect + owner)
- [ ] Confirmar que a modelagem do processo Conta Azul está fechada (com Adavio/Iago) e obter do Thiago a **lista de campos** por integração. (AC-3, AC-5)

### T1 — Judicial: campos do ProJuris (@dev)
- [ ] Estender `casos.$id.judicial.tsx` para exibir os campos definidos, casados por identificador (M5), via `judicial-sync.ts` (só-leitura, gate G4). (AC-1, AC-4)

### T2 — Financeiro: cobranças Conta Azul por fatura (@dev + @data-engineer)
- [ ] Na aba Financeiro, exibir/gerar cobranças via `contaazul/service.ts`, casando por nº da fatura (M6); suportar N cobranças por caso. (AC-2, AC-4)

### T3 — Definição centralizada dos campos (@architect)
- [ ] Um ponto único (config/constante) lista os campos exibidos por integração para validação do Thiago. (AC-3)

### T4 — QA (@qa)
- [ ] Judicial casa por identificador e espelha; Financeiro casa cobrança↔fatura e gera; sem identificador → não espelha; gate de sigilo ok; `typecheck`/`lint` verdes; sem segredo em log. (AC-1..6)

---

## Dev Notes

- **F4 é a camada de dados por cima da identificação (M5/M6).** M5/M6 (campos manuais de identificador) são do lote **até-segunda**; F4 só faz sentido depois deles e depois da modelagem Conta Azul. Não duplicar M5/M6 aqui — consumir.
- **Judicial = só-leitura (D1).** A aba Judicial espelha o ProJuris; qualquer escrita ao ProJuris é do motor/writeback (H3), não de F4. Manter o gate de sigilo (G4).
- **Conta Azul já gera cobrança.** `contaazul/service.ts` tem `gerarCobranca`/`criarContaAReceber`/`getCobranca`/`buscarContasAReceber`/`deleteCobranca` — reusar; F4 é ligação/exibição, não um novo client. Erro pré-existente de typecheck em `contaazul/service.ts` é conhecido (ver stories anteriores) — não regredir.
- **Conta Azul é decisão de terceiro.** O owner registrou em rodadas anteriores que a cobrança/sync Conta Azul é conduzida pelo Adavio/terceiro; F4 organiza a **exibição no sistema** conforme o processo que eles fecharem — não redesenha a integração de billing.
- **N cobranças por caso:** o casamento é por **fatura** (M6), não por caso — um caso tem várias faturas no Conta Azul.

**Riscos:**
- **R1 — modelagem financeira em aberto.** Executar cedo demais retrabalha. Mitigar com T0 (pré-condição).
- **R2 — identificador ausente** → nada casa. Mitigar orientando o preenchimento de M5/M6.
- **R3 — sigilo (G4)** exposto na aba Judicial. Mitigar mantendo o gate server-side.

---

## Testing

- **Judicial:** caso com identificador ProJuris → aba mostra os campos definidos (espelho); sem identificador → não espelha; caso sigiloso → gate barra.
- **Financeiro:** cobrança com nº de fatura → dados do Conta Azul aparecem; gerar cobrança persiste a fatura; N cobranças casam individualmente.
- **Segurança/regressão:** só-leitura ProJuris; escrita Conta Azul só nos endpoints existentes; RLS/gate ok; `typecheck`/`lint` verdes.

## Dependências

- **DEPENDÊNCIA DURA:** M5 (identificador ProJuris na aba Judicial) + M6 (nº da fatura Conta Azul na aba Financeiro) — lote **até-segunda** (`reuniao-2026-08-07-melhorias-ate-segunda`).
- **Pré-condição:** modelagem do processo Conta Azul fechada (Adavio/Iago) + lista de campos do Thiago.
- **Reusa:** `casos.$id.judicial.tsx` + `judicial-sync.ts` (G1), `casos.$id.financeiro.tsx`, `contaazul/{client,service}.ts`, gate G4 (`usePodeVerJudicial`).
- **Liga com M5/M6** e com o épico financeiro (F1-financeiro-modulo-submenu do lote 08-05).

## File List

**A definir na implementação (FUTURO). Previsto:**
- `sistema-hv/src/routes/casos.$id.judicial.tsx` (campos ProJuris definidos).
- `sistema-hv/src/routes/casos.$id.financeiro.tsx` (exibir/gerar cobranças Conta Azul por fatura).
- `sistema-hv/src/lib/projuris/judicial-sync.ts` / `sistema-hv/src/lib/contaazul/service.ts` (extensões de leitura/casamento — reuso).
- Config/constante central com a lista de campos por integração.

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial (FUTURO). Definir/exibir campos das integrações: Judicial espelha ProJuris (casa por identificador do processo, M5), Financeiro espelha/gera cobranças do Conta Azul (casa por nº de fatura, M6). A projetar quando a modelagem Conta Azul fechar; consome M5/M6 do lote até-segunda; só-leitura no ProJuris, reuso do client Conta Azul. | @sm (Bob) |
