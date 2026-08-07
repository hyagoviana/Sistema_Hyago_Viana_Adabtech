# Levantamento de melhorias — Reuniões com Dr. Thiago (04–05/08/2026)

> Fonte: 2 transcrições — (1) "Adavio Tittoni [0000] É, estamos no" (demo longa do sistema) e (2) "Impromptu Google Meet Meeting - August 05" (com ACTION ITEMS marcados no Fathom).
> Cruzado com o estado atual do código (`sistema-hv/src`), incluindo o motor de distribuição/ProJuris já implementado.
> Legenda de status: **[NOVO]** não existe · **[PARCIAL]** existe mas precisa mudar · **[EXISTE]** já pronto, só ajuste fino · **[BUG]** defeito a corrigir.
> Legenda de prioridade: 🔴 alta · 🟡 média · 🟢 baixa/estético.

---

## Sumário por bloco

- **A.** Campos & filtros do tema/pipeline
- **B.** Campos do Cliente ↔ Caso (espelhamento)
- **C.** Kanban / pipeline / navegação
- **D.** Checklist & linha do tempo
- **E.** Lista & colunas
- **F.** Financeiro como módulo/submenu
- **G.** Judicial como módulo/submenu
- **H.** Motor de distribuição / ProJuris  ← foco técnico
- **I.** Configuração centralizada (menus de config)
- **J.** Importação / dados (Mais Médicos)

---

## A. Campos & filtros do tema/pipeline

| # | Item | Status | Prio | Detalhe |
|---|------|--------|------|---------|
| A1 | Config por campo: obrigatório, **ocultar na lista**, **ocultar do filtro** (mas continua no caso do cliente) | **EXISTE** | 🟢 | Já implementado (lápis do campo). Só validar que "ocultar do filtro" NÃO some do caso. Migration `20260804000001` já tem `hidden_in_filters`. |
| A2 | Filtro multi-seleção: poder marcar **mais de um valor** num campo múltipla-escolha (ex.: "muito baixo" + "baixo" juntos) — para **todos** os filtros (tema/Kanban/lista) | **PARCIAL** | 🔴 | Hoje o filtro múltipla-escolha troca de um pra outro. Thiago quer seleção múltipla no valor do filtro, não no tipo do campo. |
| A3 | Município = **texto livre** (não múltipla-escolha, senão 5.000 opções) + limite de opções em campos de seleção | **PARCIAL** | 🟡 | Criar filtro com tipos: texto livre / múltipla escolha / número / porcentagem já existe. Definir teto de opções renderizadas. |
| A4 | **Campos dependentes** (grupo pai → grupo filho). Ex.: Município → Período. Só preenche filho se pai preenchido; **máx. 3 níveis / 3 filhos**; regra imposta na criação (botão "dependente") | **NOVO** | 🔴 | *ACTION ITEM* reunião 05/08. Respeita hierarquia (evita "dois pais"). Também citado na T1 (IVS ↔ município). |
| A5 | Campo **multi-linha com botão "+"**: começa com N linhas (definidas na config, ex. 3) e usuário adiciona; **teto 5–10 linhas**; linha em branco é ignorada | **NOVO** | 🟡 | *ACTION ITEM* reunião 05/08. Ex.: edital/ciclo/município com nº variável de ocorrências. |
| A6 | **Reordenar** opções de lista/menu por **drag-and-drop** (ou setas ↑↓) | **NOVO** | 🟡 | *ACTION ITEM* reunião 05/08. Reaproveitar o padrão já usado em "editar etapas". |
| A7 | **BUG**: criar campo cujo `key`/rótulo já existe em outro tema estava sendo **bloqueado como "duplicado"** | **BUG** | 🔴 | Validação de unicidade global barrando campos legítimos entre temas. Liberar (unicidade por tema, não global) mantendo opção de bloqueio manual. |
| A8 | Criar novo filtro/campo com tipos: texto / múltipla escolha / número / porcentagem / data | **EXISTE** | 🟢 | Confirmado no código (`system_tema_field_defs.type`). |

---

## B. Campos do Cliente ↔ Caso — espelhamento (pedido grande da T1)

| # | Item | Status | Prio | Detalhe |
|---|------|--------|------|---------|
| B1 | Campo personalizado **do Cliente** com opção **"aparece em caso"** + escolher **em quais temas** aparece. Fonte única = cliente; alterar num tema reflete em todos (é o mesmo dado do cliente refletindo em N lugares) | **NOVO** | 🔴 | Núcleo do pedido. Adavio confirmou viável como **bifurcação**: o mesmo campo é gravado no cliente **e** vira filtro na(s) pipeline(s) escolhida(s). Não é filtro "acima de todas as entidades" — é o dado do cliente vinculado a temas específicos. |
| B2 | Ao criar campo no cliente, marcar se ele **vai pro caso/pipeline** ou fica só no perfil do cliente | **NOVO** | 🔴 | Sub-item de B1. "Onde esse campo aparece? Só cliente, ou cliente + casos?" |
| B3 | Só **administradores** criam/configuram campos (cliente e pipeline) | **PARCIAL** | 🟡 | Campos são sensíveis (definem o que é mostrado). Gate por RBAC de admin/config. |

> Nota técnica: hoje o filtro é vinculado ao **ID da pipeline** (abaixo da entidade "caso"), por isso não existe filtro único que sirva "para todos os temas de uma vez". A solução B1 é criar o mesmo filtro em cada tema escolhido, alimentado pelo dado do cliente (bifurcação: um comando vem de dois lugares).

---

## C. Kanban / pipeline / navegação

| # | Item | Status | Prio | Detalhe |
|---|------|--------|------|---------|
| C1 | **Múltiplos Kanbans por tema** (ex.: "Mais Médicos" + "Inadimplência"), cada um com etapas e checklists próprios | **EXISTE** | 🟢 | Demonstrado funcionando na T1. |
| C2 | Botão **"Vincular ao tema / ao Kanban"**: (a) **mover/transferir** (sai do atual) ou (b) **duplicar** (espelha o MESMO caso em 2 lugares — comentários/dados sincronizados, não é cópia) | **EXISTE** | 🟢 | Igual ao financeiro. "Vincular ao tema" troca de tema; "outro Kanban deste tema" só muda o Kanban. |
| C3 | **Rastro operacional** deve mostrar **todos** os Kanbans/etapas em que o caso está (quando duplicado em 2) | **PARCIAL** | 🔴 | Hoje mostra um só. Ex.: "Mais Médicos › Documentos iniciais" **e** "Inadimplência › Cobrança total". |
| C4 | **Pop-up de seleção de Kanban** ao entrar num tema com >1 Kanban (quadradinhos com título + funis). Se só há 1, entra direto | **NOVO** | 🟡 | Decisão final: **pop-up** (não "página do meio"), pra não quebrar usabilidade. |
| C5 | **"Links úteis" / wiki por tema**: quadro com caixinhas de texto ou link (URL), **título editável** (Links úteis / Manuais / Observações), admins escrevem, salva no Drive | **NOVO** | 🟡 | Vinculado ao **TEMA** (não ao Kanban). Post-it/aviso geral. Aparece na entrada do tema (junto ao pop-up C4). |

---

## D. Checklist & linha do tempo

| # | Item | Status | Prio | Detalhe |
|---|------|--------|------|---------|
| D1 | **Checklist por etapa do Kanban** (operacional, igual ao financeiro): preencher tudo → **avança automático**; item pode ser obrigatório | **EXISTE** | 🟢 | Já implementado e demonstrado. |
| D2 | Usuário pode **adicionar itens próprios** ao checklist do caso (além dos obrigatórios da etapa) | **EXISTE** | 🟢 | Mantido (Thiago confirmou "pode manter"). Admins gerenciam os da etapa. |
| D3 | **Linha do tempo** movida pra perto do checklist; **chat removido** da timeline (conversa só em "Notas") | **EXISTE** | 🟢 | Conforme solicitado. |

---

## E. Lista & colunas

| # | Item | Status | Prio | Detalhe |
|---|------|--------|------|---------|
| E1 | Coluna "**tipo de caso**" vs "**tema**" **redundante** quando se está vendo a lista de um único tema | **PARCIAL** | 🟡 | Quando estou dentro do tema "1% FIES", não repetir "tema" em cada linha. Ajuste de UI + opção de ocultar filtros/colunas na lista. |
| E2 | Ordem sugerida das colunas: **Tema → Tipo de caso** (fica mais legível) | **PARCIAL** | 🟢 | Ajuste de layout da lista. |
| E3 | Lista "**Todos os temas**": tem filtros próprios ("editar campos" da visão Todos). Gera dúvida — deixar claro que campo criado em "Todos" só filtra a lista Todos, não propaga aos temas | **EXISTE** | 🟢 | Comportamento correto; é questão de comunicação/UX. Opção de remover a aba "Todos" existe se quiserem. |

---

## F. Financeiro como módulo/submenu (ACTION ITEM 05/08)

| # | Item | Status | Prio | Detalhe |
|---|------|--------|------|---------|
| F1 | Transformar financeiro num **submenu/módulo próprio dentro do caso** (página própria): detalhamento de parcelas, gerar faturas, etapas próprias, sync ContaAzul/Asaas, **campo de comentários exclusivo do financeiro** | **PARCIAL** | 🔴 | Backend existe (parcelas, honorários, entrada, sync). Falta encapsular como submenu isolado. Quem não tem acesso financeiro **não vê** os comentários/detalhes. |
| F2 | No caso comum, manter só uma **linha de "rastro financeiro"** resumida: etapa + **a pagar / vencido / pago** (visível só a quem tem acesso) | **PARCIAL** | 🔴 | Remover o bloco financeiro "espelhado integral" de dentro do caso comum; deixar só o resumo. |
| F3 | **Timeline não mistura** eventos do financeiro no operacional | **PARCIAL** | 🟡 | Hoje sai coisa do financeiro na linha do tempo. Isolar no módulo. |
| F4 | Sync ContaAzul/Asaas (criar cliente lá) migra pra **dentro do módulo financeiro** | **EXISTE** | 🟢 | Sync já existe; só reposicionar. ContaAzul continua sendo o ERP-fonte (juros/atraso calculados lá; nós só puxamos/enviamos). |

---

## G. Judicial como módulo/submenu (ACTION ITEM 05/08 — novo)

| # | Item | Status | Prio | Detalhe |
|---|------|--------|------|---------|
| G1 | **Submenu "Judicial" dentro do caso** que **espelha o ProJuris** (só leitura): tarefas do processo, pra quem foram, status | **NOVO** | 🔴 | Mesma lógica do módulo financeiro. Botão/rastro judicial no caso abre a página. |
| G2 | **Rastro judicial** = Kanban próprio do tema (etapas: eliminado / indeferida / sentenciado / recurso). Criado como "mais um Kanban" do tema | **NOVO** | 🟡 | Reusa C1 (múltiplos Kanbans por tema). |
| G3 | Quadro-resumo judicial: **tribunal + nº do processo + etapa** | **NOVO** | 🟡 | Espelhado do ProJuris. |
| G4 | **Campo "sigiloso"** no caso: quando marcado, o menu judicial só é visível aos **usuários autorizados** (vinculados ao registro do processo) | **NOVO** | 🔴 | Não existe hoje. Implementar flag + gate de visibilidade. Regra geral: todos veem o judicial, exceto quando sigiloso. |
| G5 | Não puxar as movimentações/andamentos "cru" do ProJuris pro caso (viraria zona) — só o essencial, com rolagem/limite | **NOVO** | 🟡 | Modal com scroll ao bater limite. |

---

## H. Motor de distribuição / ProJuris  🔧 (foco técnico)

### H.0 — O que já existe no código (base sólida)

O motor **v1.0 está implementado e funcional** em `src/lib/distribuicao/`:

- `engine/motor.ts` — orquestrador determinista (`distributeBatch`, `distributeTask`), 3 fluxos **ABSOLUTE → COMPLEX → GENERAL**.
- `engine/scoring.ts` — `final_points = task_type_points × theme_multiplier` + complexidade/temporal por `max()`.
- `engine/flow-selector.ts` — precedência: executor dirigido do processo → tema exclusivo → tipo-tarefa exclusivo → nível de complexidade.
- `engine/date-engine.ts` — data base, limite aplicável (min interno/fatal), data preferencial, data final (fim de semana/bloqueios/ocupação), datas bloqueadas por executor.
- `engine/responsible-engine.ts` — fila GENERAL (proporcional por peso) / COMPLEX (rodízio igual), preferência histórica (últimos 2 executores do processo), débito de crédito (média móvel 90d).
- `engine/alerts.ts` — alertas ALT-RESP / ALT-PRAZO / ALT-CONF, com bloqueio.
- `sync-core.ts` — OAuth2 ProJuris → `GET /intimacao/consulta` (janela -3d) → `/processo/{cod}` → tarefas multi-módulo → mapeia com Supabase → `distributeBatch` → grava em `system_distribution_results` (**writeback_pending=true, is_simulation=true**).
- `projuris/client.ts` (OAuth2 Keycloak) e `projuris/normalizer.ts`.
- **UI já existente** em `/controladoria/distribuicao/`: painel, lista, executores, tipos-tarefa, temas, calendário, **simulador**, relatório, indicadores, histórico, exceções, configuração.
- **Tabelas**: `system_distribution_results`, `_queue_state`, `_batch_logs`, `_simulations`, `_manual_assignments`, `_exceptions`, `_config`, `_calendar`, `_writeback_log`, `system_projuris_executor_mapping`, `system_task_type_mapping`, `system_theme_mapping`.
- **Cron** `api.cron.distribuicao.tsx` (08:00 BRT) + **RPC** `sincronizarDistribuicaoFn` (gate `controladoria:edit`).

> Conclusão: o "cérebro" (scoring/fluxo/datas/fila) está pronto. **O que a reunião pede é fechar a ponta de integração e a UX de operação.** Por isso "já funciona mas precisamos mexer em muita coisa" bate exatamente com os gaps abaixo.

### H.1 — Gaps técnicos (cruzando reunião × código)

| # | Item | Status | Prio | Onde mexer / observação |
|---|------|--------|------|-------------------------|
| H1 | **Mapear ID → nome** (a API só traz números): tarefa, executor, processo | **PARCIAL** | 🔴 | `normalizer.ts` + tabelas de mapping. Na reunião não conseguiam identificar quem era o executor. Usar o **identificador interno do ProJuris** (não o nº do processo judicial) como chave de casamento. |
| H2 | **Tela de confirmação/aprovação antes de gerar** ("aprovar / rejeitar / editar executor") — a lista de distribuição é a **etapa final de entrega** | **PARCIAL** | 🔴 | *ACTION ITEM.* Existe `/distribuicao/lista`, mas falta o fluxo aprovar-antes-de-escrever. Motor decide a regra internamente; a tela só confirma. |
| H3 | **Writeback ao ProJuris** (gravar a atribuição da tarefa) | **NOVO** | 🔴 | **0% implementado** (design pronto): flag `writeback_pending`, tabela `_writeback_log`, alerta `ALT-RESP-005`. Hoje o motor roda **só como simulação** (era exatamente o que estava acontecendo na reunião: "rodou como simulador, não gerou tarefa real"). |
| H4 | **Resolução de tema inteligente** (`resolveTema()`) | **PARCIAL** | 🔴 | `normalizer.ts` hoje usa só o *assunto* cru. Precisa mapear assunto/marcador/campo-personalizado do ProJuris → `motor_theme_id`. |
| H5 | **ID ProJuris + flag "participa da distribuição"** no cadastro de Usuários/Permissões | **NOVO** | 🔴 | *ACTION ITEM.* Executor = usuário interno. Guardar `projuris_executor_id` e regras (elegível, peso, complexo) junto ao usuário. |
| H6 | **Menu de configuração de "Tipos de tarefa"** refletindo campos do ProJuris (prazo previsto / prazo fatal) + campos só nossos (pontos, complexidade) | **PARCIAL** | 🟡 | Existe `/distribuicao/tipos-tarefa` e `system_task_type_mapping`. Ideia da reunião: guardar isso **internamente** pro motor não buscar tudo fora a cada rodada. |
| H7 | **Sincronizar tipos de tarefa nos dois sistemas**: criar tipo no nosso sistema deve criar/vincular no ProJuris (senão não há ID pra casar) | **NOVO** | 🟡 | Investigar se a API ProJuris tem endpoint de criação; senão, criar lá primeiro e vincular ID aqui. |
| H8 | **Marcador vs campo personalizado** (complexo / individual / coletivo / urgente) | **INFO** | 🟢 | Adavio: pra API tanto faz (pega o payload inteiro). Melhor usar **campo personalizado** no ProJuris (inserção mais fechada). No nosso sistema vira campo do caso judicial → motor lê internamente, sem buscar fora. |
| H9 | **Variáveis de entrada do motor** confirmadas na reunião | **EXISTE** | 🟢 | tipo de tarefa · tipo de caso · tema · **complexidade 0/1/2** · **urgência 0/1/2** (normal/prioritário/urgente) · datas (base, prazo previsto, prazo fatal). ⚠️ Alinhar terminologia: **ABSOLUTE/COMPLEX/GENERAL = a LISTA/fluxo**, não a complexidade do caso. |
| H10 | Após rodar, a tela deve **indicar a regra utilizada** (conferência) | **PARCIAL** | 🟡 | Motor já gera alertas/flow; expor "regra aplicada" por tarefa na lista de aprovação. |
| H11 | **Config `system_distribution_config` (auth_type + base_url)** ainda não é usada pelo `sync-core` (as env vars dominam) | **PARCIAL** | 🟡 | Migration `20260729000001` criou as colunas; falta ligar no `sync-core.ts` (do insumo Thiago 04/08). |
| H12 | **Códigos ProJuris** dos tipos de tarefa e temas + **relatório de intimações** | **PENDENTE** | 🟡 | Falta o Thiago mandar (registrado no insumo 04/08). Sem isso o mapping fica incompleto. |

### H.2 — Sequência sugerida do motor
1. **H1 + H5** (ID→nome + executor no usuário) — sem isso nada é rastreável.
2. **H4** (resolveTema) + **H11/H12** (config + códigos) — alimentar o mapping.
3. **H2** (tela de aprovação) — operar com segurança em simulação.
4. **H3** (writeback) — só depois de H2 aprovado, virar de simulação p/ produção.
5. **Piloto com o Thiago** (agenda dele), depois rollout pros demais executores.

---

## I. Configuração centralizada

| # | Item | Status | Prio | Detalhe |
|---|------|--------|------|---------|
| I1 | **Tela dedicada de "Campos personalizados"** em Configurações (tela cheia, não o quadradinho "Editar campos"). Lista pipelines + cadastro do cliente; entra e edita campo dentro da pipeline | **NOVO** | 🟡 | Mantém a hierarquia (campo é abaixo da pipeline), só melhora a visualização/organização. |
| I2 | Menus de configuração como "fonte da verdade" que o motor/telas consomem: **tipos de tarefa, temas, usuários/executores** ficam configurados uma vez e são refletidos (não reconfigurar a cada uso) | **PARCIAL** | 🟡 | Alinha com H6. Controladoria não deve reconfigurar toda vez. |
| I3 | Tudo de campo/config restrito a **administradores** | **PARCIAL** | 🟡 | Ver B3. |

---

## J. Importação / dados (Mais Médicos)

| # | Item | Status | Prio | Detalhe |
|---|------|--------|------|---------|
| J1 | **392 casos** importados do Excel com filtros da base | **EXISTE** | 🟢 | Feito. Pipeline "Mais Médicos" povoada. |
| J2 | Casos importados manualmente ficaram **sem CPF** e sem "caso/documento" vinculado → por isso tema=caso ficam iguais ("Mais Médicos") na lista | **PARCIAL** | 🟡 | Ajuste de dados: preencher CPF na mão nos próximos dias (Thiago vai pôr a equipe) ou reimportar com nomes de caso. |
| J3 | Poder **alterar o nome do caso** dos importados | **PARCIAL** | 🟡 | Quando se cria pelo fluxo normal (cadastrar→vincular caso→assinar), o nome do caso vem do documento; nos importados manuais falta. |

---

## Ações do outro lado (Dr. Thiago)
- Enviar ao Adavio a **lista de campos** que aparecem em: *elaborando*, *rastros*, *página Judicial*.
- Enviar **códigos ProJuris** de tipos de tarefa e temas + **relatório de intimações** (pendente do insumo 04/08).
- Preencher **CPF** dos casos Mais Médicos importados.
- Fechar a modelagem de **ContaAzul** (ele está ajustando lá; ERP permanece como fonte financeira).

## Combinados de agenda
- Sexta: "pente-fino" Adavio + Thiago no ProJuris.
- Início da semana (segunda): apresentar ao **Iago** para começarem a usar.
