# 🤖 Sprint 5 — Peticionamento + Comercial — Passo a Passo

> **Versão:** 1.0 · **Status:** Pronto para execução
> **Pré-requisitos:** Sprints 1-4 ✅ concluídos e validados

---

## 🎯 Objetivo

Implementar **Editor de Minutas com streaming IA mockado** (módulo Peticionamento) + **CRM completo** (módulo Comercial).

## 📦 Definição de Pronto

- [ ] Editor minuta com streaming char-by-char (mock SSE)
- [ ] Watermark "MINUTA — NÃO REVISADA" visível
- [ ] Painel lateral fontes (teses/decisões/docs) clicáveis
- [ ] Score validação 0-100 visual
- [ ] Funil comercial Kanban operacional
- [ ] Cross-sell engine UI mostra oportunidades
- [ ] Campanhas Meta + Google Ads cards

---

## 📋 Passo a passo

### BLOCO A — Peticionamento (Passos 1-7)

#### Passo 1 · `/peticionamento` — Lista de minutas
- DataTable: tipo peça | caso | versão | status (DRAFT/UNDER_REVIEW/APPROVED) | autor | data
- Filtros: tipo, status, caso, autor
- Empty state: "Gerar primeira minuta? 🤖"

#### Passo 2 · `/peticionamento/nova` — Wizard
- Step 1: Selecionar tipo de peça (9 cards visuais: Inicial FIES, Recurso SGTES, etc.)
- Step 2: Selecionar caso (search ou novo)
- Step 3: Confirmar checklist de prontidão (preview)
- Step 4: Configurações (template, peças validadas a usar como referência)
- Step 5: Disparar geração

#### Passo 3 · `/peticionamento/checklist/[caseId]` — Prontidão viewer
- Header: Score 0-100 + nível (BLOQUEADO/INSUFICIENTE/BOM/OTIMO)
- ✅ Docs disponíveis (lista verde) | ✗ Faltantes (lista vermelha)
- ⚠ Inconsistências detectadas
- 📚 Teses relacionadas (auto-sugeridas)
- ⚖ Decisões favoráveis (auto-sugeridas)
- Botões: [Gerar Minuta Agora] [Aguardar Docs] [Ignorar Pendências]

#### Passo 4 · `/peticionamento/[id]` — **Editor de Minuta (TELA CHAVE)**

Layout 3 colunas:

**Coluna esquerda (lateral fontes, 280px):**
- 📚 Teses (3) — lista clicável
- ⚖ Decisões (5) — lista clicável
- 📋 Docs do caso (4) — lista clicável
- ⚠ Issues (validação automatizada) — contador visual
  - ✓ CPF: ok
  - ✓ Nome: ok
  - ⚠ 1 inferência não verificada
  - ⚠ 1 dado faltante

**Coluna central (editor, flex-1):**
- Header: ID + tipo peça + versão + watermark "⚠ MINUTA — NÃO REVISADA"
- Editor rich text (Tiptap ou Lexical) com:
  - Markdown rendering
  - Markdown raw toggle
  - Comments inline (mock)
- **Streaming inicial:** ao abrir nova minuta, texto aparece char-by-char (mock SSE)
- Toolbar bottom: [Regenerar seção] [Editar] [Aprovar como revisada]

**Coluna direita (preview/info, 240px):**
- Score validação grande (87/100)
- Custo gerado (tokens + USD mock)
- Modelo usado (Opus 4.7)
- Histórico de versões (v1, v2 link)

#### Passo 5 · Streaming mock
```ts
// Mock SSE no MSW
export const peticaoStreamHandler = http.get("/api/peticao/:id/stream", () => {
  const stream = new ReadableStream({
    async start(controller) {
      const text = "EXMO. SR. SECRETÁRIO DE GESTÃO DO TRABALHO... [texto longo]";
      for (const char of text) {
        controller.enqueue(new TextEncoder().encode(`data: ${char}\n\n`));
        await new Promise(r => setTimeout(r, 15)); // 15ms por char
      }
      controller.close();
    },
  });
  return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
});
```

Client component consome com `EventSource` ou `fetch + reader`.

#### Passo 6 · `/peticionamento/[id]/versoes`
- Lista cronológica de versões (v1, v2, v3)
- Diff entre versões selecionadas
- Botão "Restaurar versão N" (cria nova versão a partir)

#### Passo 7 · `/peticionamento/banco-pecas`
- Grid de cards: tipo + título + outcome (favorável/desfavorável/desconhecido)
- Busca semântica (mock)
- Filtros: tipo, outcome, tags
- Upload (drop-zone): PDF/DOCX → "Adicionar como peça validada"

### BLOCO B — Comercial / CRM (Passos 8-15)

#### Passo 8 · `/comercial` — Painel
- KPIs: Leads no mês, conversão, ticket médio, tempo fechamento, CAC
- Sparklines de tendência
- Funil mini (5 etapas)

#### Passo 9 · `/comercial/funil` — Kanban
- 7 colunas: Lead Captado | Qualificado | Proposta | Negociação | Contrato | Cliente | Perdido
- Cards: nome + source + score + dias-em-etapa + responsável
- Drag-drop + gates
- Filtros: source, responsável, etapa, score
- Card mostra próx ação sugerida

#### Passo 10 · `/comercial/leads` — Lista tabular
- DataTable: avatar | nome | source | demanda | score | dias | responsável | última interação | ações
- Filtros + busca

#### Passo 11 · `/comercial/leads/[id]` — Detalhe
- Header: dados básicos + score + responsável
- Tabs: Histórico (eventos), Conversa (WhatsApp integrado P6), Tarefas, Notas
- AlertStrip "IA sugeriu enriquecimento — revisar"

#### Passo 12 · `/comercial/oportunidades` — Cross-sell engine UI
- Lista de oportunidades detectadas pelo engine (mock)
- Cada card:
  - Cliente + score
  - Sugestão (tipo de caso)
  - Razão (lógica do engine)
  - Botões: [Contatar] [Dispensar]
- Filtros: score min, tipo sugerido

#### Passo 13 · `/comercial/campanhas`
- Cards por campanha Meta/Google (mock data):
  - Nome, plataforma (badge), status, budget, gasto, leads gerados, ROI
- Sparkline 30d
- Click → drilldown

#### Passo 14 · `/comercial/email-marketing` + `/novo` + `/templates`
- Lista campanhas: nome, lista, status (rascunho/agendada/enviada), open rate, click rate
- Editor: tipo (regular/cadenciado), audiência, template, agenda, preview
- Templates: editor rich + variáveis ({nome}, {caso}, etc.)

#### Passo 15 · Polish
- Optimistic UI em drag-drop do funil
- Toast de feedback em cada ação
- Loading states matching layout

---

## ✅ Validação multi-agente

### @pm
- [ ] 15 telas funcionais
- [ ] Streaming Claude mock funciona (UX char-by-char)
- [ ] Cross-sell engine mostra ao menos 10 oportunidades fixturadas

### @architect
- [ ] EventSource (ou fetch+reader) corretamente conectado ao MSW SSE
- [ ] Editor rich text isolado (não polui bundle das outras rotas)
- [ ] Lazy load do editor (dynamic import)

### @ux-design-expert
- [ ] Layout 3 colunas do editor pixel-perfect
- [ ] Watermark "MINUTA — NÃO REVISADA" visualmente forte mas não bloqueia leitura
- [ ] Streaming cursor pulsando
- [ ] Funil cards densos mas escaneáveis

### @qa
- [ ] axe verde em todas telas (inclusive editor)
- [ ] Editor com teclado funcional (Ctrl+B bold, etc.)
- [ ] Performance: editor com 5000 chars renderiza < 200ms

### skill `frontend-design`
- [ ] Watermark refinado (não tipo gif giratório)
- [ ] Streaming text com easing suave
- [ ] Cards de oportunidade com hierarquia clara

### skill `web-design-guidelines`
- [ ] Rich text editor com toolbar acessível
- [ ] Foco visível no editor

---

## ⏱ Estimativa

**10-14 dias úteis**

---

> _Próximo:_ **Sprint 6 — Marketing + WhatsApp**
> _— Orion, orquestrando o sistema 🎯_
