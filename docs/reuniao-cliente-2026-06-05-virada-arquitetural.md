# Reunião Adabtech × Hyago Viana — Entendimento e Mudanças no Sistema

> **Fonte:** transcrição `Reunião Adabtech - hyago viana.txt` (reunião de alinhamento, ~1h05).
> **Data do documento:** 2026-06-05.
> **Participantes:** Adávio Tittoni (Adabtech), Matheus Torquato (Adabtech), Hyago Viana (cliente/dono), Dr. Thiago Correia (cliente), Patrícia Cruz (cliente — modelos/declarações).
> **Status:** documento de entendimento. **Nenhuma alteração de código foi feita.** Serve de base pra decidir o replanejamento.

---

## 1. TL;DR — a virada principal

A reunião muda a **lógica central** do sistema. Resumindo numa frase (palavras do próprio Adávio no fim da call):

> "A gente tava fazendo o caso depende do cliente, agora o **caso é isolado do cliente**."

E também:

> "Em vez de ser o cliente direto, ele vai escolher o **caso** \[tipo de serviço]… aí aparece a pipeline para aquele caso em específico."

Na prática, três mudanças estruturais:

1. **"Tipo de Serviço" (categoria de caso) vira uma entidade de primeira classe e configurável** — cada serviço (FIES ESF, FIES DGM, COVID, Mais Médicos, Residência, CFM/CRM, etc.) carrega **sua própria pipeline (etapas/colunas próprias)** e **seus próprios modelos de documento**. Hoje isso é tudo fixo/hardcoded.
2. **Inversão do fluxo de documentos** — o ponto de entrada deixa de ser "receber documento assinado por e-mail do ZapSign" e passa a ser "**gerar o documento de dentro do sistema**" (a partir de modelos), e só então **enviar pro ZapSign por API**. O e-mail/OCR deixa de ser o caminho principal.
3. **Ponto zero do cliente passa a ser manual** — alguém (comercial) cria o cliente no sistema; não nasce mais automaticamente da assinatura.

> ⚠️ **Importante:** isso é praticamente uma **reconstrução** da espinha dorsal de dados (caso ↔ cliente ↔ tipo de serviço). Matheus e Adávio reconheceram isso ("muda muito a lógica do que a gente tinha… é praticamente uma nova construção") e decidiram **montar essa nova estrutura primeiro**, antes de avançar. O drag-and-drop do Kanban (que acabei de entregar) é justamente o último item que o Matheus citou que ainda ia terminar antes de mexer na estrutura.

---

## 2. Glossário (pra evitar confusão com a palavra "caso")

Na reunião "caso" foi usado com **dois sentidos**. Pra clareza, neste documento adoto:

| Termo | O que é | Exemplo |
|---|---|---|
| **Tipo de Serviço** (= "categoria de caso", "esteira") | Entidade de **configuração**. Tem pipeline própria (etapas) + modelos de documento vinculados. Admin pode criar/editar. | FIES ESF, FIES DGM, COVID, Mais Médicos, Residência, CFM/CRM |
| **Caso** (= "processo") | **Instância** vinculada a **1 cliente** + **1 tipo de serviço**. Um cliente pode ter vários. | "Caso FIES ESF da Maria de Jesus" |
| **Cliente** | Pessoa/PJ. Criado manualmente. Pode ter vários casos. | Maria de Jesus |

---

## 3. Entendimento detalhado (o que foi acordado)

### 3.1. Estrutura de pastas no Drive (confirmada)
- Existe a pasta-raiz **"Sistema HV"** no Drive do cliente.
- Hierarquia: **Sistema HV → Clientes → \[pasta do cliente] → \[pasta do caso] → documentos**.
- A pasta do cliente é criada automaticamente; dentro dela, a pasta do **caso**; e os documentos do processo (procuração, contrato, declarações) caem na pasta do caso.
- Um cliente pode ter **vários casos** → várias pastas de caso dentro da pasta do cliente.
- **Documentos pessoais do cliente** (CPF, CNH, etc., que **não** são de um caso) ficam na seção/pasta de **documentos do cliente**, separados dos documentos do caso.

### 3.2. Pipeline Operacional por Tipo de Serviço (mudança grande)
- Hoje há **uma única** pipeline operacional com colunas fixas pra todos os casos.
- **Acordado:** ao entrar em "Pipeline Operacional", o usuário **primeiro escolhe o Tipo de Serviço** (cards: FIES, COVID, Mais Médicos…). Ao clicar, abre **o Kanban específico daquele tipo**, com **as etapas próprias daquele serviço**.
- Cada serviço tem **esteira diferente** ("a esteira é diferente"). Ex.: COVID tem um fluxo próprio; FIES ESF tem outro.
- Isso **substitui o Trello** que eles usam hoje (cada quadro do Trello = uma esteira de um serviço).
- **As etapas/colunas da pipeline são editáveis** pelo usuário dono do processo (criar, renomear, remover, reordenar). "Vocês que vão editar e selecionar o que quer mudar."
- A documentação que o Hyago já passou (do FIES) cobre ~50% e serve de molde; os outros serviços são, em geral, mais simples — exceto **COVID**, que é o mais diferente/complexo.

### 3.3. Pipeline Financeira + bifurcação + acerto parcial
- A pipeline financeira **também é editável** (colunas como suspenso, renegociado, cancelado, etc. — tudo ajustável).
- **Bifurcação:** quando o caso é "ganho"/encerrado operacionalmente, há um **botão tipo "Caso ganho / Enviar para o financeiro"** que move o caso pra pipeline financeira. *(Hoje a bifurcação é automática via trigger ao mover pra IMPLANTADO/IMPLANTAÇÃO PARCIAL — ver §4.)*
- Em tese **todos os casos** devem chegar ao financeiro.
- **Termo de acerto parcial (marcação que acompanha o caso):** um caso pode ir **parcialmente** ao financeiro **sem encerrar 100%**. Exemplo dado: pediu R$20k, ganhou e recebeu R$10k (vai pro acerto), mas recorreu pelos outros R$10k (segue judicial). Precisa de uma **marcação/tag "acerto parcial / judicial"** que **acompanha o caso** e fica visível pra quem faz o acerto adiante. ~90% dos casos encerram 100% (só apertar o botão); alguns ficam com essa marcação.

### 3.4. Inversão do fluxo de documentos (núcleo da mudança)
**Antes:** ponto de entrada = e-mail do ZapSign → OCR extrai dados → cria cliente/caso/documento. Problema: difícil identificar a qual caso o documento pertence quando o cliente tem vários casos.

**Agora (acordado):**
1. Cliente é criado manualmente no sistema (ponto zero).
2. Dentro do **caso**, o usuário clica **"Criar documento"**.
3. Escolhe um **modelo (template)** pré-definido **para aquele tipo de serviço**.
4. Os campos do modelo são **auto-preenchidos** com dados que o sistema já tem (nome, e-mail, telefone, endereço, tipo de caso).
5. O usuário preenche os **campos variáveis** na hora (ex.: porcentagem, período trabalhado). Alguns são **obrigatórios** — sem preencher, o documento **não pode ser salvo/enviado**.
6. Alguns campos ficam **em branco** propositalmente (preenchidos por terceiros, ex.: secretário de saúde).
7. O documento gerado **já nasce vinculado ao caso correto** → some o problema de identificação por OCR.
8. Cada modelo tem uma flag: **"vai pro ZapSign"** (assinatura) **ou** **"só download"** (ex.: declarações não assinadas pelo ZapSign).
9. Documento gerado tem **numeração** → quando o ZapSign devolver o "documento assinado", casa a numeração e identifica qual documento foi assinado.

### 3.5. Modelos de documento (templates)
- **Placeholders** no formato `<campo>` (sinais de maior/menor) dentro do modelo.
- **Patrícia** envia as **declarações**; **contratos** vêm de outra pessoa (mafia/equipe) — Hyago centraliza e repassa.
- Modelos são **vinculados ao Tipo de Serviço** ("quais modelos a gente usa no FIES ESF?").
- Após gerado, o usuário pode **editar o documento daquele cliente** (não o modelo). Caixa de edição.
- **Tecnologia: Google Docs** (não Word), porque "Word não roda na web". Gerar já no formato do Google Docs pra preservar **formatação, imagens, tipografia e bullets** (Word→GoogleDocs quebra a formatação — dor relatada pelo Dr. Thiago).
- **Saída em dois formatos:** **DOCX editável** (pra aprovação/edição) e **PDF** (versão final/protocolo). Documento assinado retorna em **PDF**.

### 3.6. Integração ZapSign por API (não mais por e-mail)
- O ZapSign vira **"um botão"**: "quando eu preciso enviar esse documento pro ZapSign, eu clico no botão e ele vai pro ZapSign. Senão é tudo local."
- Fluxo: gerar documento → "Enviar para ZapSign" → ZapSign gera **link** → enviar ao cliente → cliente assina → evento **"documento assinado"** retorna ao sistema.
- **Ao assinar, a automação BAIXA o PDF assinado e lança na pasta do caso** — **baixar o original, não copiar** (copiar quebra a **cadeia de certificação digital**, alerta do Dr. Thiago). "Vai ser lançado no Drive… como se fosse o PDF que você recebe no e-mail."
- **Pré-requisito a confirmar:** a conta ZapSign do Hyago precisa ter **API liberada** (pode ter custo/contratação). Adávio vai estudar a doc da API do ZapSign.
- Manter, se possível, **as duas portas** abertas (criar no sistema e o caminho antigo), mas o foco é o sistema → ZapSign.

### 3.7. Cliente — ponto zero manual + dados do painel
- Criação do cliente passa a ser **manual** no sistema (provavelmente pelo **comercial**): nome, e-mail, telefone, dados iniciais. Patrícia vai enviar **como eles criam um cliente hoje** (quais campos).
- **Não dá pra criar cliente sem vincular um caso?** — Correção do Adávio: o cliente é criado **do zero**; **depois**, dentro do cliente, vincula-se um **novo caso** (que já vem com os modelos do tipo e cai na pipeline). Ou seja: criar cliente e criar/vincular caso são passos, não um só.
- **Dados a exibir no painel do cliente** (a definir com o cliente): possíveis campos vistos nos documentos — nome, CPF, e-mail, telefone, endereço, **CRM, OAB, vínculo institucional, especialidade, profissão**. Alguns editáveis, outros auto-preenchidos. Dados "fixos do contrato" (que não mudam) ficam registrados pra não re-preencher a cada documento.

### 3.8. Papéis / RBAC
- Papéis já definidos: **admin, advogado, financeiro, operacional, comercial**.
- Falta **mapear visibilidade** — quem vê o quê (ex.: "financeiro vê pipeline operacional? sim/não"). Adávio vai detalhar com o Hyago depois.
- **Dono do processo** edita a pipeline daquele processo.

### 3.9. Formatação dos documentos (Dr. Thiago)
- Padronizar formatação; suportar imagens e tipografia.
- Gerar no formato **Google Docs** pra não quebrar (problema que tiveram com outras automações).

---

## 4. O que muda no sistema ATUAL (gap analysis)

> Base: estado atual do código (TanStack Start + Supabase + Drive). Os caminhos abaixo são do app em `sistema-hv/`.

### 4.1. Modelo de dados — **mudança estrutural grande**
**Hoje:**
- `system_cases` tem `client_id` **NOT NULL** (caso depende do cliente). ✔️ — isso na verdade **continua válido** (todo caso tem um cliente). O que muda é o conceito de **Tipo de Serviço** como entidade separada.
- `case_type` é um **CHECK fixo** (`FIES_ESF, FIES_DGM, COVID, MAIS_MEDICOS, RESIDENCIA, CFM_CRM`) — `supabase/migrations/20260523000004_cases.sql`.
- `macrostatus_op` e `macrostatus_fin` são **enums fixos** (colunas do Kanban hardcoded) — mesmo arquivo + `constants.ts`.

**Precisa:**
- **Nova entidade `system_service_types` (Tipo de Serviço)** — configurável: nome, slug, ativo, ordem. Substitui o CHECK fixo de `case_type` por uma **FK** (`system_cases.service_type_id`).
- **Etapas de pipeline por tipo de serviço** — nova tabela `system_pipeline_stages` (ou `system_service_type_stages`): cada tipo de serviço tem N etapas operacionais ordenadas e **editáveis**; idem para o financeiro (ou uma coluna `kind: 'op' | 'fin'`). Substitui os enums fixos `MACRO_OP`/`MACRO_FIN`.
- `system_cases.macrostatus_op/fin` deixam de ser texto-enum e passam a referenciar a **etapa** (FK `stage_id`).
- **Modelos de documento vinculados ao tipo de serviço** — nova tabela `system_document_templates`: nome, tipo de serviço (FK), arquivo/Google Doc base, flag `vai_para_zapsign`, definição dos **campos** (auto vs manual, obrigatório, em branco).
- **Pasta de caso no Drive** — `system_cases` ganha `drive_folder_id/url/sync_*` (não tem hoje). *(já estava previsto na Fase 2 do trabalho anterior).*
- **Documentos de caso** — nova tabela `system_case_documents` (espelho de `system_client_documents`, com `case_id`), + view ativa + RLS. Documentos do cliente continuam em `system_client_documents` (docs pessoais).
- **Marcação "acerto parcial / judicial"** — campo/flag em `system_cases` (ex.: `acerto_parcial boolean` + `tem_pendencia_judicial boolean` ou uma tag) que **acompanha o caso** mesmo após ir ao financeiro.
- **Numeração de documento** — sequência/coluna em `system_case_documents` pra casar com o retorno do ZapSign.

### 4.2. Pipeline Operacional (UI)
**Hoje:** `src/routes/casos.index.tsx` — um Kanban único com `MACRO_OP` fixo (com drag-and-drop já implementado ✅).
**Precisa:**
- Tela de **seleção de Tipo de Serviço** antes do Kanban (cards por serviço).
- Kanban passa a renderizar **colunas dinâmicas** (vindas de `system_pipeline_stages` do tipo escolhido), não mais o enum fixo.
- **Editor de pipeline** (admin/dono): criar/renomear/remover/reordenar etapas.
- O componente genérico `KanbanBoard.tsx` (criado na Fase 1) **já ajuda** — ele recebe `columns` por props; basta alimentar com etapas dinâmicas em vez de constantes.

### 4.3. Pipeline Financeira (UI)
**Hoje:** `src/routes/casos.financeiro.index.tsx` — Kanban único com `MACRO_FIN` fixo (drag-and-drop ✅). Bifurcação **automática** via trigger (`20260523000007_fin_bifurcacao.sql`).
**Precisa:**
- Colunas **dinâmicas/editáveis** (igual operacional).
- **Bifurcação por botão explícito** ("Enviar para o financeiro") em vez de automática — *ou* manter automática + botão. **(Confirmar com o cliente — ver §5.)*
- Exibir a **marcação de acerto parcial** no card/ficha.
- *Observação:* o cliente disse pra **deixar a pipeline financeira "um pouquinho parada agora"** e focar na nova estrutura. → **menor prioridade**.

### 4.4. Documentos (geração + ZapSign) — **módulo novo**
**Hoje:** só upload/download de documentos do **cliente** (Drive + `system_client_documents`). Sem geração, sem templates, sem ZapSign por API (o n8n atual recebe por e-mail).
**Precisa (novo):**
- **Motor de modelos**: armazenar templates (Google Docs), parsear placeholders `<campo>`, formulário dinâmico de preenchimento (auto + manual obrigatório + em branco).
- **Geração via Google Docs API** (copiar modelo → substituir placeholders → exportar DOCX e PDF).
- **Botão "Enviar para ZapSign"** (quando aplicável) via **API do ZapSign**: criar documento, gerar link, acompanhar status.
- **Webhook/automação "documento assinado"**: baixar o **PDF original assinado** e lançar na **pasta do caso** (preservando certificação — não copiar).
- **Aba "Documentos" dentro do caso** em `src/routes/casos.$id.tsx` (hoje não existe).

### 4.5. Onboarding / n8n
**Hoje:** fluxo n8n "disparar e cria leads" cria cliente+caso a partir do e-mail/ZapSign, com bug de `org_id` hardcoded.
**Precisa:**
- **Inverter:** o n8n de "receber por e-mail e criar" perde protagonismo. O novo caminho é **sistema → ZapSign (API) → retorno do assinado**.
- Manter (opcionalmente) o recebimento por e-mail como porta secundária.
- Corrigir o `org_id` inválido de qualquer forma.

### 4.6. RBAC
**Hoje:** RBAC existe (`system_users`, `rbac.ts`, 1 papel/usuário). Papéis já contemplam admin/advogado/financeiro/operacional/comercial.
**Precisa:** **mapa de visibilidade** (matriz papel × tela/ação) — a definir com o cliente. Possível necessidade de "dono do processo" (quem edita a pipeline de um tipo de serviço).

---

## 5. Pontos em aberto / dúvidas a confirmar com o cliente

1. **API do ZapSign** — a conta do Hyago tem API liberada? Custo? (bloqueia o fluxo de assinatura).
2. **Bifurcação financeira** — manter automática (trigger atual) ou trocar por **botão explícito** "Enviar para o financeiro"? (ou os dois).
3. **Campos do painel do cliente** — lista final de campos (nome, CPF, e-mail, telefone, endereço, CRM, OAB, vínculo institucional, especialidade, profissão…). Patrícia envia o "como criam cliente hoje".
4. **Modelos de documento** — Patrícia envia as declarações; contratos vêm de outra pessoa. Definir o conjunto inicial por tipo de serviço e quais campos são obrigatórios/em branco.
5. **Matriz de visibilidade RBAC** — quem (papel) vê/edita cada pipeline e cada tela.
6. **Etapas de cada Tipo de Serviço** — usar a documentação do FIES como molde; mapear COVID (mais complexo) e os demais.
7. **"Acerto parcial"** — formato exato da marcação e onde aparece (card, ficha, financeiro).
8. **Migração de dados existentes** — já há clientes/casos de teste caindo (Maria de Jesus, João Pedro, Jerusa…). Definir como migrar `case_type` fixo → `service_type_id` e estados fixos → etapas dinâmicas.

---

## 6. Itens adiados (não fazer agora)

- **Módulo Financeiro / cálculo de honorários** — calculadora de honorários, parcelas, descontos, abatimento (saldo devedor antes/depois), hoje manual. Vai pro **módulo financeiro (parte 2)**.
- **Controladoria / Pró-Juris (parte judicial — parte 3)** — integração com Pró-Juris (API rica) pra o processo judicial; espelhamento; evitar duplicação de dados. Reunião com o pessoal deles agendada. **Futuro.**
- **Alerta de não-assinados** — ~20% não fecham; automação a cada 7 dias pra alertar contratos enviados e não assinados. **Mais pra frente.**

---

## 7. Faseamento sugerido (proposta, a validar)

> Alinhado com a decisão da call: **montar a nova estrutura primeiro**.

- **Fase A — Nova espinha dorsal de dados** *(prioridade máxima)*
  Tipos de Serviço configuráveis + etapas de pipeline por serviço (op/fin) + caso referenciando serviço e etapa + migração dos dados de teste.
- **Fase B — Pipeline operacional dinâmica**
  Seleção de tipo de serviço → Kanban com colunas dinâmicas (reaproveita `KanbanBoard.tsx` + drag-and-drop já pronto) + editor de etapas.
- **Fase C — Documentos do caso + pastas no Drive**
  Pasta de caso, `system_case_documents`, aba de documentos no caso (era a "Fase 2" anterior, agora encaixa aqui).
- **Fase D — Modelos + geração (Google Docs) + ZapSign por API**
  Templates por serviço, formulário dinâmico, geração DOCX/PDF, botão ZapSign, retorno do assinado pra pasta do caso.
- **Fase E — RBAC (matriz de visibilidade) + ajustes financeiros (bifurcação por botão, acerto parcial)**
- **Fases futuras** — módulo financeiro/cálculo (parte 2); Pró-Juris/judicial (parte 3); alertas de não-assinado.

---

## 8. Impacto no que já foi feito

- **Drag-and-drop dos Kanbans (entregue):** **aproveitável.** O `KanbanBoard.tsx` é genérico e recebe colunas por props — só precisará receber **etapas dinâmicas** em vez de constantes fixas. O mecanismo de mover/persistir continua.
- **CRUD de clientes / upload de documentos de cliente:** aproveitável; ganha a camada de **documentos por caso**.
- **`case_type` fixo e `macrostatus_*` fixos:** **serão substituídos** por entidades configuráveis (maior parte do retrabalho de banco).
- **n8n de onboarding por e-mail:** muda de papel (vira secundário); fluxo principal passa a ser sistema → ZapSign.

---

*Documento gerado a partir da transcrição da reunião. Próximo passo sugerido: validar os "Pontos em aberto" (§5) com o Hyago/Patrícia e fechar a Fase A.*
