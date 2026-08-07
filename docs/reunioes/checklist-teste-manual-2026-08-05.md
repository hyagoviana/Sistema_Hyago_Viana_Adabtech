# Checklist de teste manual — entregas da reunião 2026-08-05 (24 stories + correção C4)

> Marque `[x]` conforme validar. Organizado por **ABA/onde clicar** no painel. Cada item diz **o que fazer** e o **resultado esperado**.
> Legenda de status técnico: todas já passaram no build/typecheck/lint e as 9 migrations estão no banco (dev=prod). Aqui é a validação de **uso real**.

---

## 🗂️ ABA: Pipeline Operacional

- [ ] **C4/C5 — Página de escolha de kanban + notas do tema** *(correção 2026-08-07)*
  - **Fazer:** clicar num tema (ex.: "Mais Médicos"). 
  - **Esperar:** abre uma **PÁGINA** (não pop-up) com um card por kanban do tema; cada card lista os **funis em tópicos** (bullets). Deve abrir a página **mesmo em tema com 1 só kanban**.
- [ ] **C5 — Bloco de notas + links do tema**
  - **Fazer:** na mesma página, rolar até o bloco embaixo → escrever uma anotação e **adicionar um link** (URL).
  - **Esperar:** salva; o link abre em nova aba; só **admin** consegue editar (outros veem só leitura).
- [ ] **C4 — Entrar no kanban**
  - **Fazer:** clicar em "Entrar nesta esteira" num dos kanbans.
  - **Esperar:** entra na esteira daquele kanban específico.
- [ ] **A2 — Filtro multi-valor** (na esteira/lista do tema)
  - **Fazer:** abrir filtros → num filtro de seleção, **marcar 2+ valores** (ex.: "muito baixo" + "baixo").
  - **Esperar:** a lista mostra casos de **qualquer** um dos valores marcados (não troca de um pro outro).

---

## 🗂️ ABA: Clientes

- [ ] **J2 — Preencher CPF de cliente importado (Mais Médicos)**
  - **Fazer:** abrir um cliente importado (tem banner "CPF pendente" com marcador `CL-XXXX`) → botão **"Preencher CPF"** → digitar um CPF válido → salvar.
  - **Esperar:** valida o CPF, grava, some o banner "pendente".
- [ ] **B1 — Campo do cliente que "aparece nos casos"**
  - **Fazer:** em "Editar campos do cliente" (ou Configurações → Campos personalizados → Cadastro do cliente) → marcar **"Aparece nos casos"** num campo e escolher os temas.
  - **Esperar:** esse campo passa a aparecer na ficha dos casos daqueles temas; ao alterar o valor num caso, reflete no cliente (fonte única).

---

## 🗂️ ABA: Clientes → (abrir um caso) = Ficha do caso

- [ ] **F1/G1 — Submenus Ficha / Financeiro / Judicial**
  - **Fazer:** abrir um caso → alternar entre as abas do topo (Ficha, Financeiro, Judicial, Termo).
  - **Esperar:** a URL muda e o conteúdo troca; a Ficha continua com tudo (dados do caso, timeline, documentos).
- [ ] **J2 — Editar nome do caso**
  - **Fazer:** na ficha, clicar no **lápis** ao lado do título → mudar o nome → salvar → recarregar.
  - **Esperar:** o nome persiste após reload.
- [ ] **C3 — Rastro operacional multi-kanban**
  - **Fazer:** num caso que foi **duplicado em 2 kanbans**, olhar o bloco "Rastro Operacional".
  - **Esperar:** mostra **todas** as posições (ex.: "Mais Médicos › Documentos iniciais" **e** "Inadimplência › Cobrança total"), não só uma.
- [ ] **A4 — Campo dependente (pai → filho)** *(configurar antes em Configurações → Campos)*
  - **Fazer:** na aba "Dados do caso", com um campo filho dependente de um pai (ex.: Período depende de Município) → tentar preencher o filho com o pai vazio.
  - **Esperar:** o filho só habilita quando o pai está preenchido.
- [ ] **A5 — Campo multi-linha com "+"**
  - **Fazer:** num campo multi-ocorrência, clicar em **"+"** para adicionar linha.
  - **Esperar:** adiciona linhas até o teto configurado; linha em branco é ignorada ao salvar.
- [ ] **G4 — Campo sigiloso**
  - **Fazer:** marcar o caso como **"sigiloso"** e indicar usuários autorizados → entrar com um usuário **não** autorizado.
  - **Esperar:** o usuário não autorizado **não** vê o submenu Judicial daquele caso (admin sempre vê).

- [ ] **F1 — Submenu Financeiro (dentro do caso)**
  - **Fazer:** abrir a aba **Financeiro** do caso.
  - **Esperar:** rastro resumido (**a pagar / vencido / pago**), detalhamento de parcelas, botão **Sincronizar ContaAzul/Asaas**, e um bloco de **comentários exclusivos do financeiro** (quem não tem acesso financeiro não vê). A timeline da Ficha **não** mistura eventos do financeiro.
- [ ] **G1 — Submenu Judicial (dentro do caso)**
  - **Fazer:** abrir a aba **Judicial**; num caso com processo ProJuris vinculado, clicar **"Atualizar do ProJuris"** e **"Ver andamentos"**.
  - **Esperar:** espelha (só leitura) tarefas/quadro tribunal-processo-fase; andamentos abrem em **modal com scroll** e "carregar mais". *(Depende de auth ProJuris viva.)*

---

## 🗂️ ABA: Pipeline Operacional → "Ver todos em lista" (Lista de casos)

- [ ] **E1 — Menu "Colunas" + ordem + coluna Tema redundante**
  - **Fazer:** botão **"Colunas"** → desmarcar/reordenar colunas; depois selecionar um **único tema**.
  - **Esperar:** colunas somem/reordenam; dentro de um tema a coluna **"Tema"** some (redundante com Tipo de caso); ordem Tema → Tipo de caso.

---

## 🗂️ ABA: Sistema → Configurações → Campos personalizados

- [ ] **I1 — Tela dedicada de Campos personalizados**
  - **Fazer:** abrir Configurações → **"Campos personalizados"** (tela cheia) → escolher um tema à esquerda.
  - **Esperar:** lista pipelines/temas + "Cadastro do cliente"; à direita edita os campos do tema.
- [ ] **A6 — Reordenar opções (↑↓)**
  - **Fazer:** num campo de múltipla escolha, reordenar as opções com as **setas ↑↓**.
  - **Esperar:** a ordem persiste e aparece na mesma ordem na ficha.
- [ ] **A7 — Mesmo campo em temas diferentes (bug corrigido)**
  - **Fazer:** criar um campo com a **mesma chave/rótulo** já usada em **outro** tema.
  - **Esperar:** **permite** criar (unicidade é por tema); criar a mesma chave **no mesmo tema** continua bloqueado.
- [ ] **B3 — Gate admin**
  - **Fazer:** entrar com um usuário **não-admin**.
  - **Esperar:** os controles de criar/editar campos ficam ocultos/bloqueados.

---

## 🗂️ ABA: Sistema → Permissões (Usuários)

- [ ] **H5 — ID ProJuris + "participa da distribuição"**
  - **Fazer:** editar um usuário → preencher **"ID ProJuris"** + marcar **"participa da distribuição"** (peso/elegível complexo) → salvar → reabrir.
  - **Esperar:** persiste; o usuário passa a ser considerado **executor** na Distribuição.

---

## 🗂️ ABA: Inteligência → Distribuição (Controladoria)

- [ ] **H1 — Lista com nomes (ID→nome)**
  - **Fazer:** abrir a lista de distribuição.
  - **Esperar:** Executor aparece pelo **nome** (não código/UUID), com coluna **"Tipo"** e o **nº do processo**.
- [ ] **H2 — Aprovar / Rejeitar / Editar executor + Regra aplicada**
  - **Fazer:** numa linha, ver a coluna **"Regra aplicada"**; usar aprovar/rejeitar/editar executor (e "Aprovar tudo").
  - **Esperar:** a decisão fica registrada (selo de aprovação); editar o executor troca o nome; só aprovado fica elegível a efetivar.
- [ ] **H3 — Write-back ProJuris (dry-run)**
  - **Fazer:** clicar **"Write-back ProJuris"**.
  - **Esperar:** abre em **dry-run** (preview, **sem escrever** no ProJuris). ⚠️ **Só efetiva** com confirmação + digitar a data + a env `PROJURIS_WRITEBACK_ENABLED=1` — **não habilitar** antes de validar o endpoint com o Thiago.
- [ ] **H6 — Config Tipos de tarefa (prazos + sincronizar)** *(sub-tela de Distribuição)*
  - **Fazer:** abrir Tipos de tarefa → editar **prazo previsto/fatal (dias)**; botão **"Sincronizar tipos"**; marcar **executor exclusivo**.
  - **Esperar:** salva os prazos internos; o sync concilia os tipos do ProJuris (só leitura).
- [ ] **H11 — Credenciais no banco (write-only)** *(Configuração de Distribuição)*
  - **Fazer:** abrir a Configuração → campos de segredo.
  - **Esperar:** segredos aparecem como **"•••• definido" / "não definido"** (nunca reexibem o valor); gravar só quando digita algo novo.
- [ ] **H4 — Resolução de tema (indireto)**
  - **Fazer:** rodar uma sincronização de distribuição.
  - **Esperar:** temas que não casam geram alerta **ALT-TEMA-001** (não quebra o lote). *(Depende de auth ProJuris viva.)*

---

## ⚠️ Itens que dependem de auth ProJuris viva (token)
Se o token do ProJuris expirou, os fluxos **G1 (judicial), H1/H4/H6 (sync), H3 (write-back)** podem não puxar dados reais — isso é ambiente, não código. Reautenticar e repetir.

## Pendências que NÃO bloqueiam (follow-up)
- **H7:** criar tipo de tarefa nos dois sistemas (espera endpoint de escrita da API — spike).
- **G1-T4:** rastro judicial como board dedicado do tema (hoje usa a `fase` do ProJuris).
- **A6:** só setas ↑↓ (sem drag-and-drop — falta a lib `@dnd-kit/sortable`).
