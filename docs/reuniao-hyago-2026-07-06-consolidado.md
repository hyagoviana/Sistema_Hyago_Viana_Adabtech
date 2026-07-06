# Consolidação Reunião Hyago — 2026-07-06

Cruzamento de **3 fontes**: (1) anotações do Hyago no grupo (05/07), (2) as 8 anotações "aba por aba" do Matheus (transcrição), (3) estado **real** do código em `sistema-hv/`.

Legenda: ✅ FEITO · 🟡 PARCIAL (existe, mas falta expor/ligar) · 🔴 FALTA · ⚙️ EM ANDAMENTO nesta sessão.

---

## 0. Limpeza / demo (anotações Matheus 1‑3)
- ✅ Banco **zerado** de dados fictícios (0 cadastros/casos/tarefas). Config intacta (556 modelos, 223 estágios, 7 tipos de serviço, 2 usuários).
- ✅ Aba "Leads" já renomeada para **"Cadastro"** com abas Todos/Leads/Clientes/Perdidos.
- ✅ Ficha de cadastro já **não** tem "vincular a um caso (opcional)".

## 1. Entrada do cliente — Contrato + Procuração editável + links ZapSign (Hyago 1 / ENTRADA / Matheus 5‑6)
- 🟡 Motor de geração **editável** (Google Docs: copia modelo → preenche `<campos>` → link editável → exporta PDF) **existe** em `case-documents-service.ts`. Usado hoje no Termo.
- ⚙️ **Dividir os fluxos**: `+ Novo → Procuração` (novo dialog) e `+ Novo → Caso` só contrato. — EM ANDAMENTO.
- 🔴 **Expor botões** "Gerar contrato" / "Gerar procuração" **editáveis** na ficha do caso (hoje o botão editável só está no Termo).
- 🔴 **Emitir link do ZapSign pelo sistema**: `sendToZapsign()` existe mas depende de **chave de API ZapSign em produção** na conta do Hyago (bloqueio de negócio, não de código).

## 2. Dados do cliente (Hyago 2 / Matheus 4)
`ClientFormDialog.tsx` — infra de **campos customizáveis** (`system_client_field_defs` + `CustomFieldsSection`) já existe; muitos itens abaixo entram como campo fixo OU custom field.
- 🔴 **RG com órgão emissor** (ex.: SSP/BA) — hoje RG é campo simples.
- 🔴 **Retirar OAB** — campo OAB ainda presente (linhas 562‑586).
- 🟡 **Especialidade como select fixo** — hoje é **texto livre** (linha 602). Vira `<Select>` com lista fixa p/ busca no CRM.
- 🔴 **Novos campos**: Instituição de Graduação (select fixo), ano de formatura, FIES (sim/não).
- 🔴 **Tags**: médico militar, mais médicos, médicos pelo brasil.
- 🔴 **Residente**: Hospital de Graduação (select fixo), data início, data término, especialidade.
- 🔴 **Dados do contrato do FIES**.
- 🟡 **TIPO** — hoje: Médico/Dentista/Enfermeiro/Outro profissional/Pessoa jurídica. Hyago quer **Médico/Previdenciário/Outro**. Ajustar lista.
- ✅ Dados preenchidos **já reaproveitados** para preencher documentos (autofill de procuração) e busca.

## 3. Cliente — Anotações (Hyago 3)
- ✅ **Notas do cliente** já existem na ficha (`NotesBlock target="client"` em `clientes.$id.tsx`).

## 4. Caso (Hyago 4)
- ✅ **Notas do caso** já existem (`NotesBlock target="case"`).
- 🟡 **Sub‑etapas por serviço criáveis pelo próprio usuário** — infra existe (`system_case_checklist_items` ad‑hoc + `StageChecklistEditor` por tipo de serviço). Falta editor **dentro da ficha do caso** (instância).

## 5. Financeiro / Termo (Hyago 5 / ESTERIA FINANCEIRO)
- ✅ Cálculo do termo + tela de elaboração + conferência segregada (aprovador ≠ enviador) existem.
- 🔴 **Prefill do termo a partir do contrato** (herdar valores já preenchidos, podendo alterar).
- 🔴 **Formato "Word" na tela** para aprovação do colaborador (hoje mostra valores, não o documento).
- 🟡 **À vista / parcelado** — cálculo já gera as duas formas; falta deixar explícito como escolha do cliente no termo.
- 🔴 **Renovação (termo complementar)** reaproveitando termo antigo + dados do ERP (parcelas pagas/pendentes).
- ❓ **"Enviar para conferência"** → hoje registra evento `fin_enviado_conferencia`; fica pendente até outro usuário **aprovar**. (Esclarecer fluxo/destino na reunião.)
- ⏸️ **Integração ERP** — decisão: **agora não** (fase futura, provavelmente via n8n).
- ✅ **Editar/criar etapas do financeiro** — `StageEditor` **já existe** (criar/renomear/reordenar/excluir). Falta **deixar o botão visível/óbvio**.

## 6. Operacionalizar ESF (Hyago 6)
- ✅ Etapas do ESF (FIES_ESF) e **sub‑etapas com requisitos obrigatórios** (gate de avanço) já existem.
- 🔴 **Renovação automática** (recorrência anual) — regra de negócio + automação n8n (fase futura).

---

## Modelo de estágios (confirmado com o owner 2026‑07‑06)
`CADASTRO (roster) → PROCURAÇÃO assinada → COMERCIAL (lead) → CONTRATO/CASO assinado → OPERACIONAL (cliente)`
- Procuração e contrato = **documentos/fluxos separados** (reverte a união S9‑12).
- Enviar procuração p/ assinar → lead no **comercial**. Enviar caso p/ assinar → **operacional**.

## Prioridade para hoje (impacto × esforço)
1. ⚙️ `+ Novo → Procuração` separado + Caso só contrato (EM ANDAMENTO).
2. Expor botões de **contrato/procuração editáveis** na ficha do caso.
3. Ajustes rápidos de **campos do cliente**: TIPO (Médico/Previdenciário/Outro), RG+órgão emissor, retirar OAB, especialidade select.
4. Tornar o **botão de editar etapas do financeiro** visível.
5. Confirmar **chave ZapSign de produção** (desbloqueia os links).

> Itens 🔴 de maior fôlego (FIES/Residente, prefill do termo, formato Word do termo, renovação automática) entram como stories seguintes — não dá pra fechar todos hoje.
