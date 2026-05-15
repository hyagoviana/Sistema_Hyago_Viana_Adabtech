# ⚖️ Sprint 4 — FIES (parte 2) + Controladoria — Passo a Passo

> **Versão:** 1.0 · **Status:** Pronto para execução
> **Pré-requisitos:** Sprints 1-3 ✅ concluídos e validados

---

## 🎯 Objetivo

Completar fluxos FIES (Pipeline Financeira + Termo de Acerto Wizard) e implementar **módulo Controladoria** completo (Projeto 2 — UI).

## 📦 Definição de Pronto

- [ ] Pipeline Financeira 15 colunas + 8 views complementares
- [ ] Termo Wizard com cálculo automático mockado
- [ ] Snapshot viewer com versionamento (v1, v2)
- [ ] Controladoria: painel + prazos + movimentações + exceções + teses + decisões
- [ ] Validação fila baixa-confiança (movimentações)
- [ ] Centro de Exceções com 8 categorias

---

## 📋 Passo a passo

### BLOCO A — FIES Pipeline Financeira (Passos 1-4)

#### Passo 1 · `/casos/financeiro` — Pipeline 15 colunas
- Kanban com 15 macrostatus financeiros (ver PRD 1 §4.2)
- Mesmo padrão visual do Pipeline Op (Sprint 3)
- Card variante "financeiro" mostra parcela atual + valor total + status
- Realtime + drag-drop + gates

#### Passo 2 · 8 Views complementares
Sub-rotas:
- `/casos/financeiro/aguardando-ativacao` (TERMO_ACEITO sem cobrança)
- `/casos/financeiro/parcelas-atrasadas` (ATIVO + parcela vencida 1-29d)
- `/casos/financeiro/inadimplencia` (INADIMPLENTE)
- `/casos/financeiro/pendencias-judiciais` (SUSPENSO + hold judicial)
- `/casos/financeiro/readequacao-parcela` (SUSPENSO + hold readequacao)
- `/casos/financeiro/cliente-inerte` (APRESENTANDO_TERMO >15d)
- `/casos/financeiro/cobranca-judicial` (COBRANCA_JUDICIAL)
- `/casos/financeiro/tramitacao-judicial` (JUDICIAL_FINANCEIRO)

Cada view: DataTable com colunas específicas + ações in-row.

#### Passo 3 · `/casos/[id]/termo` — Snapshot Viewer
- Lista de snapshots v1, v2, v3...
- Card por snapshot: status badge, valores principais, who/when
- Diff viewer entre versões
- Botão "Ver PDF" (mock URL)

#### Passo 4 · `/casos/[id]/termo/elaborar` — Wizard 4 steps
- Stepper visual (1/4 → 2/4 → 3/4 → 4/4)
- Step 1: Dados FIES (saldo antes/depois, parcelas pagas)
- Step 2: Cálculo automático (preview: valor efetivo, honorários, parcelamento)
- Step 3: Ajustes (cláusula especial opcional, percentual override)
- Step 4: Confirmação + assinatura digital → vira RASCUNHO
- AC: ZodResolver por step, draft em sessionStorage

Bloco extra: `/casos/[id]/termo/conferir`
- 2ª pessoa do FIN abre
- **Sistema enforce segregação** (UI bloqueia se mesmo user que elaborou)
- Checklist 8 itens visual (cards interativos)
- Aprovar → status APROVACAO_JURIDICA

### BLOCO B — Renovações & Novas (Passo 5)

#### Passo 5 · `/casos/renovacoes` e `/casos/novas-solicitacoes`
- Renovações: calendário visual + lista de casos ESF próximos do ciclo anual
- Novas: lista de clientes com contexto que mudou (cross-sell hint)

### BLOCO C — Controladoria (Passos 6-12)

#### Passo 6 · `/controladoria` — Painel multi-aba
- KPIs no topo: 🔥 Prazos próximos | ⚠ Exceções abertas | 📈 Movimentações hoje
- Tabs: Painel | Prazos | Movimentações | Exceções | Teses | Decisões | Projuris
- Card "Prazos de hoje" destacado

#### Passo 7 · `/controladoria/prazos`
- 2 views: Lista | Calendário
- Lista: DataTable (data fatal, tipo, descrição, responsável, status)
- Calendário: visual mensal com pins coloridos por urgência
- Alertas: 15/7/3/1 dias antes
- Click prazo → drawer com detalhes + aceitar/recusar

#### Passo 8 · `/controladoria/movimentacoes`
- DataTable: data, processo, classificação IA, urgência, confidence, status humano
- Filtros: classificação, urgência, status, confidence < threshold
- Row expandable: texto completo da movimentação + payload IA

#### Passo 9 · `/controladoria/movimentacoes/validar` — Fila validação
- Layout 60/40: lista esquerda | detalhes direita
- Movimentações com `confidence < 70%` aparecem aqui
- Para cada: classificação IA → botões "Manter | Corrigir | Dispensar"
- Modal "Corrigir": form para reclassificar
- Painel direito: teses+decisões relacionadas auto-sugeridas

#### Passo 10 · `/controladoria/excecoes` — Centro de Exceções
- Header KPIs: total abertas / urgentes / resolvidas hoje
- Agrupado por prioridade (🔴 URGENTE / 🟡 ATENÇÃO / 🟢 ROTINA)
- 8 categorias: PRAZO_SEM_RESPONSAVEL, PRAZO_CONFLITANTE, TAREFA_SEM_ACEITE, TAREFA_VENCIDA, PROCESSO_PARADO, MOVIMENTACAO_BAIXA_CONFIANCA, DECISAO_NAO_CLASSIFICADA, ERRO_INTEGRACAO
- Cada exceção: card com título + descrição + link "Resolver →"

#### Passo 11 · `/controladoria/teses` + `/controladoria/teses/nova`
- Lista: cards por tema + área de direito + status (RASCUNHO/REVISAO/APROVADA/DEPRECIADA)
- Busca semântica (mock retorna top 5 por keyword)
- Filtros: tema, área, status
- Editor: rich text + tags + jurisprudência related + workflow status

#### Passo 12 · `/controladoria/decisoes` + `/controladoria/decisoes/nova`
- Lista: tribunal + processo + ementa + resultado (DEFERIDO/INDEFERIDO/etc.)
- Busca semântica + filtros (tribunal, ano, resultado, tema)
- Cadastro: form manual OU upload PDF (mock OCR extract)
- "Marcar como destacada" (decisão marco)

### BLOCO D — Integração Projuris UI (Passo 13)

#### Passo 13 · `/controladoria/projuris` — Saúde
- Status sync (última sync, frequência, erros recentes)
- Botão "Sync agora" (mock)
- Tabela: processos sincronizados / pendentes / com erro

---

## ✅ Validação multi-agente

### @pm
- [ ] Pipeline Financeira + 8 views funcionais
- [ ] Termo Wizard E2E completo (rascunho → conferência → aprovação)
- [ ] Controladoria com 7 sub-telas operando

### @architect
- [ ] Segregação enforced em UI (elaborador ≠ conferidor)
- [ ] Snapshot imutável visualmente claro (versionamento)
- [ ] State machine de macrostatus respeitada nos drag-drop

### @ux-design-expert
- [ ] Wizard Termo intuitivo (steps progressivos)
- [ ] Centro de Exceções escaneável (cores e ícones)
- [ ] Fila validação ergonômica (atalhos de teclado: 1 manter, 2 corrigir, 3 dispensar)

### @qa
- [ ] Drag-drop respeita gates (ex: ELABORANDO não pode pular para APROVACAO sem CONFERINDO)
- [ ] Wizard salva rascunho em sessionStorage
- [ ] axe verde em todas telas

### skill `frontend-design`
- [ ] Densidade alta (controladoria) mas legível
- [ ] Hierarquia clara em Centro de Exceções

### skill `web-design-guidelines`
- [ ] Atalhos de teclado documentados e funcionais
- [ ] Cor + ícone + texto em todos status badges

---

## ⏱ Estimativa

**10-12 dias úteis**

---

> _Próximo:_ **Sprint 5 — Peticionamento + Comercial**
> _— Orion, orquestrando o sistema 🎯_
