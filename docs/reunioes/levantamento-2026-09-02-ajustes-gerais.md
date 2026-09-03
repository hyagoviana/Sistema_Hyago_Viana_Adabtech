# Levantamento — Reunião 02/09/2026 + anotações do Thiago

**Fontes:** transcrição `Dr. Thiago Correia [0000] Tá rodand (1).txt` (2 blocos), `02.09.docx` / `02.09.pdf`
(16 pendências + 34 telas anotadas + matriz de permissões) e `ANDAMENTOS DUPLICADOS.docx` (21 prints).

**Escopo desta leva:** TUDO que está nas fontes, **exceto** a integração Conta Azul / Asaas
(venda, contrato recorrente, cobrança, assinatura, conciliação) — decisão do owner em 03/09.
O que sobra de Conta Azul aqui é só **remoção de UI morta** (item 10).

---

## 1. Decisões travadas com o owner (03/09/2026)

| # | Assunto | Decisão |
|---|---------|---------|
| D1 | Status da etapa (item 16) | **Some da tela** e o gatilho do financeiro vira **regra de Workflow** explícita. Migração converte as etapas hoje `stage_role='won'` em regras. |
| D2 | Papéis / permissões (item 15) | **Adotar a matriz do Thiago** (Administrador, Coordenador, Financeiro, Controladoria, Suporte, Atendimento, Operacional, Estagiário, Marketing) com **de-para dos usuários atuais**. |
| D3 | Pastas do Drive (item 6) | Migrar modelos para dentro da pasta do tema, **validar**, e só então mandar a pasta antiga para a lixeira. Cuidado explícito do owner: **não quebrar a lógica de Casos e Procurações**. Dry-run obrigatório. |
| D4 | Robô SEI (item 13) | Entra, **por último**. Ainda é preciso escolher/montar a solução de CAPTCHA (spike). |
| D5 | Casos prioritários (item 14) | **Reusar a urgência que já existe** no caso (`prioritario`/`urgente`) — sem campo novo. |
| D6 | Trello (item 12) | **Por último.** Depende da documentação da API e do quadro separado que o Thiago vai liberar. |
| D7 | Cadastro do cliente (item 8) | **Tudo vira página** (`/clientes/novo` e `/clientes/:id/editar`); o pop-up deixa de existir. |
| D8 | Referências (menu legado) | **Não mexer agora** — nem limpeza, nem motor de de-para nos documentos. Épico futuro. |
| D9 | Andamentos duplicados | **1 card agrupado** (selo "N intimações", expansível); distribuir gera **uma** tarefa e baixa as irmãs. |
| D10 | Menu "Editar caso" | Gateado pelo **novo nível "Configurar"** do módulo Operacional (por padrão: Administrador e Coordenador). |

---

## 2. Os 16 itens x estado real do código

### Item 1 — Menu centralizado de configuração de tema
Hoje existem **dois** lugares: o diálogo `Editar tema` (botão na Área de Trabalho / `pipeline.tsx`) e
`/configuracoes/campos-personalizados` (já com abas **Campos · Pastas do Drive · Distribuição · Financeiro**).
São redundantes e o do Kanban confunde configuração com operação.
→ Manter só o de Configurações, acrescentar aba **Integrações**, e tirar o botão da Área de Trabalho.

### Item 2 — PDF / PDF assinado fora da pasta "Documentos automáticos"
**Bug localizado.** `finalizeCaseDocument` (`src/lib/case-documents-service.ts:647`) grava o PDF com
`ensureCaseFolder` (raiz da pasta do caso). O correto é `ensureCaseAutoFolder` — que já existe e já é
usado pelo webhook do ZapSign (`src/lib/zapsign/webhook.ts:138`). Fix pequeno + backfill dos existentes.

### Item 3 — Assunto errado ao criar Judicial no ProJuris pelo SHV
`src/lib/projuris/criar-processo.ts:356`: `assunto = caso_pasta_nome || case_code`, ou seja, **um assunto
novo por caso** (o print mostra `INADIMPLENCIAHV-2026-0422` como assunto). O assunto tem que vir do **TEMA**.

### Item 4 — Responsável exclusivo por caso não chega no motor
**Confirmado o que o Thiago suspeitava.** O motor tem a precedência certa
(`flow-selector.ts`: `process.directed_executor_id` → tema → tipo de tarefa), mas quem monta o payload
grava **sempre `directed_executor_id: null`** (`staging-core.ts:1045` e `sync-core.ts:621`). O responsável
do caso nunca é lido.

### Item 5 — Integração Assunto ProJuris ↔ tema SHV
`system_theme_mapping` existe (usado pelo motor), mas o **código/identificador do assunto não é editável**
na tela do tema. Vários temas podem compartilhar o mesmo assunto — o identificador tem que ser ajustável.
Renomear os rótulos das abas para **"ProJuris"** e **"Conta Azul"**.

### Item 6 — Estrutura de pastas de temas e modelos no Drive
`system_service_type_folders` aponta para pastas dentro de uma pasta **"modelos" global** (legado da
documentação do Iago). O desejado: `Temas/<tema>/Casos` e `Temas/<tema>/Procurações`, **criadas junto com o
tema**, e o sistema lendo só de lá.

### Itens 7 e 8 — Página e cadastro do cliente
- Cadastro é modal (`ClientFormDialog`) → vira **página**.
- `estado civil` vira **select** (default *solteiro*); `logradouro` → **"endereço"**; `número` → **"número endereço"**.
- Falta um **painel de dados do cliente** (campos padrão + personalizados **do cliente**, sem os campos de caso).
- O card "Pasta no Drive" ocupa espaço demais → vira **botão**.
- **Visão 360**: casos do cliente com **valor** e **etapa principal** espelhados, rastro comercial, notas e documentos.
- **Bug**: campo criado no tema com `scope='cliente'` **não aparece** na página do cliente. A bifurcação
  existe só no sentido cliente→tema (`client-fields-service.ts:325+`); falta o inverso.

### Itens 9 e 10 — Página do caso e financeiro do caso
Hoje há **4 menus** para configurar o caso: (1) menu rápido `Editar caso`, (2) `Preencher campos`,
(3) `Novo estágio`, (4) painel `Campos do caso`. Nenhum deles muda o **responsável**.
Consolidar em **3**: estágios (sem mudança) · campos da página (sem mudança) · **"Editar caso"**
(= 1 + 2, com **mudar tema · urgência · responsável**, restrito por cargo).
O painel **Rastro financeiro** sai da ficha e vai para a aba **Financeiro**; o espaço liberado recebe o
painel de Casos vinculados / Observações. Na aba Financeiro, remover o painel morto da ideia antiga de
cobrança (CA/Asaas) e reaproveitar o espaço.

### Item 11 — Correções no motor de distribuição
- **Fim de semana**: `api.cron.daily` chama `runSync(ymd(new Date()))` **todo dia**. A engine só respeita dia
  útil na *data-alvo* (`date-utils.isWeekday`), não na *data de distribuição*. Sábado e domingo o motor distribui.
- **Andamentos duplicados**: a dedupe é só por `codigoIntimacao` (`uq_dist_movement_origem_id`) e pelos flags
  `descartada`/`duplicada` do ProJuris. Os prints mostram 4-6 intimações com **códigos diferentes** para o
  mesmo processo/data/publicação, variando só "Parte a qual se refere" (CEF, União, FNDE).
- **Responsável exclusivo**: ver item 4.

### Item 12 — Trello
Nada implementado. Existe o campo `IDCARDTRELLO` nos casos do tema. Quadro: **Cobrança HV**.

### Item 13 — Robô de pesquisa do SEI com CAPTCHA
Nada implementado. ~300-400 processos administrativos consultados hoje na mão, no máximo 1x/mês.
Objetivo: rodar diário/semanal e mostrar **data da última movimentação** x **data da última visualização**.

### Item 14 — Painel de casos prioritários (controladoria)
Não existe. Uma linha por **processo judicial** vinculado ao caso, com data da última movimentação
judicial (individual por processo) e a **administrativa = data da última mudança de etapa do caso**.

### Item 15 — Menu de permissões por perfil
Hoje: 9 papéis **hardcoded** em `src/lib/rbac.ts`, defaults derivados de navegação+capabilities, override
**só por usuário** (`system_user_module_perms`), níveis `none|view|edit`, módulos
`comercial · operacional · financeiro · controladoria · inteligencia · marketing · sistema · judicial`.
Faltam: papéis da matriz, módulo **Cliente**, nível **Configurar**, e **defaults editáveis por papel**.
No cadastro do usuário, **Perfil** e **Nível de acesso** são redundantes → unificar (mantendo **Cargo**,
que o motor usa). Na lista, falta filtro para **ocultar suspensos**.

### Item 16 — Alterar status / etapa
`stage_role` (`normal|won|closed|lost`) é o "status" da etapa. `won` dispara o financeiro e o GANHO
comercial. Decisão D1: sai da tela, vira workflow.

---

## 3. Matriz de permissões (fonte: 02.09.docx)

Níveis: **Ver** < **Editar dados** < **Configurar**.

| Papel | Cliente | Operacional | Comercial | Financeiro | Controladoria | Marketing | Sistema/usuários |
|---|---|---|---|---|---|---|---|
| Administrador | Configurar | Configurar | Configurar | Configurar | Configurar | Configurar | Configurar |
| Coordenador | Configurar | Configurar | Configurar | Editar | Editar | Editar | Ver |
| Financeiro | Editar | Editar | Editar | Configurar | Editar | — | — |
| Controladoria | Editar | Editar | Editar | Ver | Configurar | — | — |
| Suporte | Editar | Editar | Editar | Ver | Editar | Ver | — |
| Atendimento (antigo comercial) | Editar | Editar | Editar | — | — | — | — |
| Operacional | Editar | Editar | Ver | — | — | — | — |
| Estagiário | Editar | Editar | Ver | — | — | — | — |
| Marketing | Ver | Ver | Ver | — | — | Ver | — |

O override **por usuário** continua existindo e tem precedência sobre o padrão do papel
(caso do "supervisorzinho" que o Adavio levantou na reunião).

---

## 4. Fora desta leva (registrado)

- **Conta Azul / Asaas** — venda, contrato recorrente, cobrança/assinatura, webhook de pagamento,
  conciliação e vínculo de cobrança criada por fora. Todo o 1º bloco da reunião.
- **Referências como dicionário de-para nos documentos** (D8).
- **Vendedor/comissão do comercial** na venda do Conta Azul (o próprio Thiago adiou).

---

## 5. Pendências do lado do Thiago

- Link do site do SEI/Ministério da Saúde + número de processo de exemplo (item 13).
- Acesso ao quadro **Cobrança HV** do Trello (conta do Matheus) e, se a API exigir, o plano Premium (item 12).
- A "listinha com as outras alterações" que ele prometeu mandar até sexta.
