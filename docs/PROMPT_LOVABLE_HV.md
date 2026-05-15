# 🎨 Prompt Lovable — Sistema Hyago Viana Advocacia

> Cole o conteúdo abaixo da linha `==== PROMPT ====` no Lovable.
> Esse prompt cria SOMENTE o layout visual completo, com botões e telas mockadas (sem backend).

---

==== PROMPT ====

# Projeto: SaaS jurídico premium "Hyago Viana Advocacia"

Construa um SaaS de gestão jurídica completo para um escritório de advocacia especializado em FIES, Mais Médicos, residência médica e defesas CFM/CRM. O design deve ser **editorial premium estilo "Cartier Digital"** — sofisticado, refinado, com personalidade — NÃO genérico tipo Vercel/shadcn. Pense Linear (dark sidebar), Stripe Atlas (editorial), escritório jurídico high-end NY/Paris.

**IMPORTANTE: Crie SOMENTE o layout visual e a estrutura de navegação. Todos os botões e ações devem existir e estar clicáveis, mas usar dados mockados estáticos. Sem backend, sem autenticação real, sem API. Apenas frontend Tailwind + React.**

---

## Stack obrigatória

- **React 18+ com TypeScript**
- **Vite** (não Next.js — Lovable usa Vite)
- **Tailwind CSS** com tokens customizados
- **React Router DOM v6** para roteamento
- **Lucide React** para ícones (NUNCA emojis decorativos)
- **Recharts** para gráficos (sparklines, bars, area)
- Mock data com **Faker.js** + seed fixa (42) para determinismo

---

## Direção visual — "Cartier Digital"

Editorial premium com hierarquia rica. Refinado, não chamativo. Profundidade através de tipografia + cor + ornamentos sutis, não shadows pesadas ou cores gritantes. Sensação de "biblioteca jurídica premium" + "boutique parisiense" + "Linear sidebar".

### Paleta exata (use variáveis CSS)

```css
:root {
  /* Brand */
  --navy: #1e2044;          /* primary deep authority */
  --navy-700: #181a37;
  --navy-800: #11132a;      /* sidebar */
  --navy-900: #0b0c1d;
  --gold: #987814;          /* premium accent — NUNCA fluo, NUNCA mostarda */
  --gold-700: #7b6010;
  --gold-light: #d4a832;    /* highlights */
  --gold-pale: #fbf3dd;

  /* Backgrounds */
  --bg: #ffffff;
  --bg-page: #fdfcfa;       /* page background com warm tint */
  --bg-subtle: #fafafa;
  --bg-paper: #fdfcf8;      /* cream paper texture base */

  /* Text */
  --fg: #171717;
  --fg-muted: #525252;
  --fg-subtle: #a3a3a3;

  /* Borders */
  --border: #e8e8e8;
  --border-navy: rgb(30 32 68 / 0.10);
  --border-gold: rgb(152 120 20 / 0.20);

  /* Semantic */
  --success: #15803d;
  --warning: #b45309;
  --danger: #be123c;
}
```

### Tipografia

- **Display (títulos, KPIs, números)**: `'Playfair Display'`, Georgia, serif — peso 600-700, letter-spacing -0.025em, font-features `kern, liga, dlig, swsh`
- **Body / UI**: `'Inter'`, system-ui — features `cv02, cv03, cv04, cv11, ss01`
- **Mono**: `'JetBrains Mono'` — para códigos de caso, IDs

Importe via Google Fonts no index.html.

### Hierarquia tipográfica

| Uso | Classe | Tamanho | Família |
|-----|--------|---------|---------|
| Hero title (dashboards) | `.hero-title` | clamp(40px, 4.5vw, 60px) | Playfair 700 |
| H1 página | `.page-h1` | 44px (2.75rem) | Playfair 700 |
| H2 seção | `.section-title` | 28px (1.75rem) | Playfair 600 |
| KPI hero | `.kpi-hero` | clamp(56px, 6vw, 80px) | Playfair 700 |
| KPI normal | `.kpi-number` | 48px (3rem) | Playfair 600 |
| Eyebrow (caption) | `.eyebrow` | 11px uppercase tracking 0.12em | Inter 600 |
| Body | base | 16px line-height 1.55 | Inter |
| Small | sm | 14px | Inter |

---

## Elementos signature (CRIE TODOS)

### 1. Eyebrow gold accent
Label uppercase pequeno acima dos títulos com tracinho gold à esquerda.
```css
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--gold-700);
  line-height: 1;
}
.eyebrow::before {
  content: '';
  width: 16px;
  height: 1.5px;
  background: var(--gold);
  border-radius: 1px;
}
```

### 2. H1 ornament — underline duplo gold
```css
.h1-ornament {
  position: relative;
  padding-bottom: 1.25rem;
}
.h1-ornament::after {
  content: '';
  position: absolute; bottom: 0; left: 0;
  width: 80px; height: 2px;
  background: linear-gradient(to right, var(--gold), var(--gold-light) 50%, transparent);
  border-radius: 2px;
}
.h1-ornament::before {
  content: '';
  position: absolute; bottom: -4px; left: 0;
  width: 24px; height: 1px;
  background: var(--gold);
  opacity: 0.5;
}
```

### 3. Ornamental divider (entre seções)
Linha horizontal gradient gold com símbolo ✦ no centro.
```css
.ornament-divider {
  display: flex; align-items: center; gap: 1rem;
  margin: 4rem 0;
}
.ornament-divider::before, .ornament-divider::after {
  content: '';
  flex: 1; height: 1px;
  background: linear-gradient(to right, transparent, rgb(152 120 20 / 0.25), transparent);
}
.ornament-divider span {
  font-size: 0.75rem;
  color: var(--gold);
  letter-spacing: 0.25em;
}
```
Uso: `<div className="ornament-divider"><span>✦</span></div>`

### 4. Card hero (cards principais com gradient sutil + glow gold)
- border: 1px navy/10
- border-top: 2px gold
- background: linear-gradient 135deg gold/0.04 → white
- shadow: 0 16px 40px -8px navy/0.10
- Pseudo-elemento ::before com radial-gradient gold no canto top-right (glow)

### 5. Sidebar premium (dark navy com gold accents)
- width: 256px
- background: linear-gradient 180deg #0e1027 → #11132a → #0b0c1d
- Logo box: gradient gold com inset highlight + shadow gold glow
- Item ativo: barra vertical 3px gold à esquerda com glow + background gradient gold/0.16→transparent
- Group labels: tracinho gold à esquerda + uppercase tracking 0.18em texto gold/70
- Paper texture overlay: radial-gradient(gold/0.50 1px, transparent 1px) 32px 32px opacity 6%

### 6. KPI hero block
Bloco asymmetric: número Playfair 56-80px à esquerda + contexto + trend pill colorida + ícone gold gradient à direita.

### 7. Status dot ringed (substitui emojis 🔴🟡🟢)
```css
.status-dot { width: 8px; height: 8px; border-radius: 50%; position: relative; display: inline-block; }
.status-dot::before {
  content: ''; position: absolute; inset: -3px;
  border-radius: 50%; border: 1.5px solid currentColor; opacity: 0.35;
}
```

### 8. Editorial quote (destaques)
```css
.editorial-quote {
  font-family: 'Playfair Display'; font-style: italic;
  font-size: 1.5rem; line-height: 1.35;
  padding-left: 1.5rem; position: relative; color: var(--navy);
}
.editorial-quote::before {
  content: ''; position: absolute; left: 0; top: 0.25rem; bottom: 0.25rem;
  width: 2px; background: linear-gradient(to bottom, var(--gold), rgb(152 120 20 / 0.2));
  border-radius: 2px;
}
```

### 9. Page background com gradient duplo
```css
body {
  background:
    radial-gradient(ellipse 90% 60% at 50% -10%, rgb(152 120 20 / 0.035), transparent 60%),
    radial-gradient(ellipse 60% 40% at 100% 100%, rgb(30 32 68 / 0.015), transparent 50%),
    #fdfcfa;
}
```

### 10. Trend pill (com border + bg semântico)
```css
.trend-pill {
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  border: 1px solid currentColor; border-color: currentColor/30;
  background: currentColor/[0.06];
  font-size: 0.75rem; font-weight: 500;
}
.trend-pill--up { color: var(--success); }
.trend-pill--down { color: var(--danger); }
```

---

## Layout global

### Estrutura padrão
```
┌─────────────────────────────────────────────────┐
│ Sidebar (256px navy) │  Main area               │
│                      │  ┌────────────────────┐ │
│  Logo HV gold        │  │ Page container     │ │
│  ✦ ornament          │  │ max-w 1440, p 4.5  │ │
│                      │  │                    │ │
│  ─ Operação          │  │  Breadcrumb        │ │
│    Hoje              │  │  PageHeader        │ │
│    Pipeline Op       │  │  (eyebrow + h1     │ │
│    ...               │  │   + subtitle)      │ │
│                      │  │                    │ │
│  ─ Inteligência      │  │  Conteúdo seções   │ │
│    ...               │  │                    │ │
│                      │  └────────────────────┘ │
│  Avatar Maria        │                          │
│  ADM ▾               │                          │
└─────────────────────────────────────────────────┘
```

### Page container
```css
.page-container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 4.5rem 3.5rem 7rem;
}
```

---

## Sidebar — 3 grupos com ornamentos

### Grupo "Operação"
- 🏠 Hoje (`/hoje`)
- 📋 Pipeline Operacional (`/casos`)
- 💰 Pipeline Financeira (`/casos/financeiro`)
- 👥 Clientes (`/clientes`)
- ✓ Tarefas (`/tarefas`)

### Grupo "Inteligência"
- ⚖️ Controladoria (`/controladoria`)
- 📄 Peticionamento (`/peticionamento`)
- 📈 Comercial (`/comercial`)
- 📢 Marketing (`/marketing`)
- 💬 WhatsApp (`/whatsapp`)
- 📊 Dashboards (`/dashboards`)

### Grupo "Sistema"
- 🎨 Design System (`/design-system`)
- ⚙️ Configurações (`/configuracoes`)

(Use ícones Lucide reais: Home, Briefcase, DollarSign, Users, CheckSquare, Scale, FileText, TrendingUp, Megaphone, MessageCircle, BarChart3, Palette, Settings)

---

## TODAS AS TELAS — implementar TODAS

Para cada tela, criar com dados mockados. Botões clicáveis (podem usar console.log ou toast). Foco no visual.

### 🔐 1. `/entrar` — Login
**Split-screen 50/50:**
- **Esquerda**: dark navy `#11132a` com:
  - Logo HV gold no topo
  - Quote editorial Playfair italic gigante: "A excelência jurídica começa pela disciplina dos detalhes." — atribuído a "Hyago Viana, OAB/AL"
  - Padrão sutil de grid no background
  - Radial gradient gold no canto
  - Footer: "© 2026 Hyago Viana Advocacia"
- **Direita**: form sobre fundo branco com:
  - Eyebrow "Acesso restrito"
  - H1 Playfair: "Bem-vindo de volta"
  - Inputs Email + Senha (com label flutuante refinado)
  - Botão "Entrar" navy com hover lift sutil
  - Link "Esqueci minha senha" gold

---

### 📋 2. `/hoje` — Painel pessoal
**Layout asymmetric:**
- **Header**:
  - Lado esquerdo: eyebrow "Painel pessoal" + H1 hero-title "Bom dia, Maria" + descrição "Você tem 3 urgências, 8 prioridade alta e 5 próximas no radar."
  - Lado direito: card data com Playfair 32px "15" + "maio · 2026" italic + mini-calendário 7 letras (S T Q Q S S D) com hoje destacado em navy/gold
- **4 seções com OrnamentalDivider entre elas:**
  1. **Urgente (vermelho)** — 3 TaskCards
  2. **Prioridade alta** — 6 TaskCards
  3. **Próximas** — 4 TaskCards
  4. **Conquistas (gold)** — 6 cards em grid 2 col (ícone CheckCircle2 verde + título + caso)
- Header de seção: ícone box + eyebrow + count "03" Playfair + linha gold fade

---

### 📁 3. `/casos` — Pipeline Operacional (Kanban)
- Breadcrumb + PageHeader "Pipeline Operacional" eyebrow "Operação"
- Toolbar: Search + Filtro Macrostatus + Botões "Ver lista" / "Novo caso" (Plus icon)
- **Board horizontal scroll** com 10 colunas:
  1. Onboarding (cinza)
  2. Análise (cinza)
  3. Conferência (azul)
  4. Pronto p/ ajuizar (gold)
  5. Em andamento (gold)
  6. Aguardando decisão (verde claro)
  7. Implantado (verde)
  8. Implantação parcial (verde)
  9. Encerrado (cinza)
  10. Cancelado (vermelho)
- Cada coluna: header com nome + count + 6-10 CaseCards (mock)
- **CaseCard compacto**: código mono `FIES-2024-1247`, cliente "Dr. João Silva", badge tipo (FIES/CFM), MacrostatusBadge (op+fin), "12 dias no estado", flag alerta se inadimplente, hover lift sutil

---

### 📊 4. `/casos/lista` — Lista de casos
- Breadcrumb + PageHeader + Botão "Voltar ao Kanban"
- **Tabela editorial premium:**
  - Header: linhas gold-pale background com texto uppercase tracking
  - Colunas: Código (mono), Cliente (avatar + nome), Tipo (badge), Op (MacrostatusBadge), Fin (MacrostatusBadge), Município, Última ação
  - Rows: hover bg-subtle, border-bottom gold/10
  - 100 linhas mockadas
- Paginação rodapé refinada

---

### 📄 5. `/casos/[id]` — Ficha do caso 360°
**Cabeçalho rico:**
- Breadcrumb
- Header asymmetric:
  - Esquerda: eyebrow "Caso · FIES-2024-1247" + H1 "Dr. João Silva — FIES ESF" + linha info (CPF mascarado, OAB/AL, telefone)
  - Direita: card cliente vinculado com avatar + link "Ver dossiê"
- AlertStrip se inadimplente (vermelho) ou suspenso (warning)

**2 colunas rastros (op + fin) lado a lado:**
- Card "Rastro Operacional": eyebrow + macrostatus + dias + próximo passo
- Card "Rastro Financeiro": eyebrow + macrostatus + valores + próximo passo
- Border-top gold

**5 abas:**
- Documentos (lista DocumentRow)
- Timeline (TimelineFeed com eventos cronológicos)
- Financeiro (parcelas, boletos, gráfico)
- Comunicação (mensagens com cliente)
- Auditoria (log de modificações)

**NextActionFooter sticky bottom:**
- Próxima ação + responsável + due date + botão "Marcar como feito"

---

### 📝 6. `/casos/[id]/termo` — Termo de Acerto
- Header com badges "Versão 3 · Vigente" gold + "FIES ESF" badge tipo
- **Layout em colunas (sobre fundo paper-texture cream):**
  - Card "Cálculo FIES" — tabela valores
  - Card "Honorários" — % + valor + parcelas
  - Card "Aprovação" — 3 assinaturas (Elaborou Maria · Conferiu Carlos · Aprovou Dr. Hyago) com data + ícone selo
- Footer: "Histórico de versões" — accordion com V1, V2, V3
- Botão "Baixar PDF" gold no topo

---

### 🧙 7. `/casos/[id]/termo/elaborar` — Wizard
**Stepper visual horizontal no topo:**
1. Dados FIES (◉ atual)
2. Cálculo
3. Ajustes
4. Confirmação

Cada step ocupa página inteira com:
- Eyebrow "Step X de 4"
- H1 do step
- Form fields editoriais grandes (label flutuante)
- AlertStrip de validação se erro
- Footer: "Voltar" (ghost) · "Próximo" (navy primary)

---

### 💰 8. `/casos/financeiro` — Pipeline Financeira
Mesmo padrão do `/casos` mas 14 colunas financeiras:
Elaborando · Aprovação · Aguardando ativação · Ativo · Quitando · Quitado · Inadimplente · Parcial · Renegociado · Suspenso · Cancelado · ...

**4 mini-views laterais (collapsible drawer):**
- ⚠️ Aguardando ativação (15)
- 🟡 Parcelas atrasadas (32)
- 🔴 Inadimplência (8)
- 💤 Cliente inerte (12)

---

### 🚨 9. `/casos/financeiro/inadimplencia` — Inadimplência
- PageHeader eyebrow "Financeiro" + H1 "Inadimplência"
- Stats top: 3 StatCards (Total inadimplentes · Valor em aberto · Tempo médio atraso)
- Tabela rica com: Cliente, Caso, Valor, Dias atraso, Última cobrança, Botão "Escalar JUR" (danger outline)

---

### 👥 10. `/clientes` — Listagem de clientes
- PageHeader + Botões "Importar Excel" (ghost) + "Novo cliente" (primary navy)
- Toolbar: Search com ícone gold + Filtro tipo (dropdown)
- Stats inline: "1.247 cadastrados · 892 ativos · 47 novos no mês"
- **Lista em cards** (não tabela — mais editorial):
  - Avatar grande + Nome Playfair + tipo (badge) + município + telefone mascarado + "X casos" + ChevronRight

---

### 🏛️ 11. `/clientes/[id]` — Cliente 360°
**ClientHeader rico:**
- Avatar gigante + Nome Playfair 36px + eyebrow "Cliente · CPF 123.***.***-**"
- Stats inline: Total casos · Receita total · LTV
- 3 abas:
  - **Casos** — grid de CaseCards do cliente
  - **Timeline** — todos eventos cronológicos
  - **Relacionamento** — notas, e-mails, ligações

---

### 📞 12. `/comercial` — Painel Comercial
- PageHeader eyebrow "Comercial · CRM"
- **Hero asymmetric**: HeroStatCard "Leads ativos · 47" + 2 StatCards stacked (Convertidos · % conversão)
- OrnamentalDivider
- **3 cards secundários**: Cross-sell aberto · Taxa conversão · LTV médio
- Quick actions: "Ver funil" · "Novo lead" · "Ver oportunidades"

---

### 🎯 13. `/comercial/funil` — Funil de vendas (Kanban)
**7 colunas:**
1. Lead captado
2. Contato inicial
3. Qualificado
4. Proposta enviada
5. Negociação
6. Convertido (verde)
7. Perdido (cinza)

Cards: nome lead + source badge (WhatsApp/Site/Meta/Google) + score (estrelas gold) + demanda + responsável.
Botão "Novo lead" topo direito.

---

### 📋 14. `/comercial/leads` — Lista de leads
Tabela: Nome · Source (badge cor) · Demanda · Score (estrelas) · Etapa · Responsável · Criado em · Ações.

---

### 💎 15. `/comercial/oportunidades` — Cross-sell
Grid de cards de oportunidade:
- Cliente atual
- Demanda detectada
- Score (badge gold)
- Status (Aberta/Contatado/Convertida/Dispensada)
- Botão "Abordar"

---

### ✉️ 16. `/comercial/email-marketing` — Campanhas
Grid de cards de campanha:
- Nome campanha
- Status (Rascunho/Agendada/Enviada)
- Stats: Enviados · Open rate · Click rate (com mini sparkline)
- Botão "Nova campanha" primary topo

---

### ⚖️ 17. `/controladoria` — Painel Controladoria
- PageHeader eyebrow "Controladoria Jurídica"
- **3 StatCards hero**:
  - Prazos próximos (7 dias) · 12
  - Exceções abertas · 5
  - Movimentações hoje · 89
- OrnamentalDivider
- **Quick links 4 cards** em grid 2x2:
  - Teses (ícone Library)
  - Decisões (ícone Gavel)
  - Saúde Projuris (ícone Activity)
  - Atalhos jurisprudência (ícone Search)

---

### ⏰ 18. `/controladoria/prazos` — Gestão de prazos
- Tabela com prazos: Caso · Tipo prazo · Vencimento · Dias restantes (badge cor por urgência) · Responsável
- Filtros: Próximos 7 dias / 15 dias / 30 dias
- Highlight gold para prazos críticos

---

### 🛑 19. `/controladoria/excecoes` — Centro de exceções
Lista de exceções (situações fora do padrão):
- Cards com: Tipo exceção · Caso · Detectada em · Responsável · Severidade (badge) · Botão "Resolver"

---

### 📚 20. `/controladoria/teses` — Base de teses
- Search bar premium grande
- Grid 3 col de cards de tese:
  - Título Playfair (truncate 2 linhas)
  - Resumo (3 linhas)
  - Badges área + força (forte/média/fraca)
  - "Usado em X casos"

---

### ⚖️ 21. `/controladoria/decisoes` — Base de decisões
Similar a teses, mas com decisões favoráveis catalogadas.
Cards com: Tribunal · Número processo · Data · Resumo · Área (badge).

---

### 📝 22. `/peticionamento` — Lista de minutas
- PageHeader + Botão "Nova minuta" primary
- Tabs por status: Todas · Rascunho · Gerando · Em revisão · Aprovada · Protocolada · Arquivada
- **Lista de minutas** com:
  - Ícone FileText + ícone Bot (se gerada por IA)
  - Título Playfair
  - Tipo de peça (badge)
  - Status badge
  - Última edição "há 2h"
  - Responsável avatar
  - Botão "Abrir"

---

### ✍️ 23. `/peticionamento/[id]` — Editor de minuta
**Layout 3 colunas:**
- **Esquerda 240px**: Sidebar com seções da peça (clicáveis tipo TOC)
- **Centro flex-1**: Editor rich-text mockado (textarea grande estilizada com fundo paper, fonte Playfair 18px)
- **Direita 320px**: Painel IA — "Mapa de fontes" com lista de teses/decisões usadas + score de confiança
- **Topbar editor**: badges status, botões "Salvar" "Gerar IA (Bot icon)" "Validar" "Enviar p/ revisão"

---

### 📦 24. `/peticionamento/banco-pecas` — Banco de peças
Grid de peças validadas reutilizáveis. Cards com tipo + título + "usado X vezes".

---

### 📢 25. `/marketing` — Painel Marketing
- PageHeader eyebrow "Marketing"
- **3 StatCards**:
  - Publicados (30d) · 24
  - Em pipeline · 12
  - Aguardando revisão · 5
- OrnamentalDivider
- **2 cards lado a lado:**
  - Calendário editorial (preview semana)
  - Top performance (3 conteúdos mais vistos)

---

### 📅 26. `/marketing/calendario` — Calendário editorial
Visualização mês: grid 7 colunas. Cada dia com mini-cards de conteúdos agendados (cor por canal: Reels gold, Carrossel navy, Podcast roxo).

---

### 📰 27. `/marketing/conteudos` — Gerenciar conteúdos
Tabela: Título · Tipo (Reels/Carrossel/Podcast/Artigo) · Canal · Status (Pipeline/Roteiro/Produção/Aprovação/Agendado/Publicado) · Data · Responsável.

---

### 🖼️ 28. `/marketing/banco-midia` — Banco de mídia
Grid 4 col de assets visuais (placeholders coloridos). Filtro por tipo (Foto/Vídeo/Áudio/Template).

---

### 💬 29. `/whatsapp` — Inbox conversas
**Layout 2 colunas:**
- **Esquerda 360px**: Lista conversas
  - Tabs Inbox · Classificadas · Routed
  - Cada item: avatar + nome + última msg (truncate) + tempo + badge classificação (8 tipos cores diferentes) + ícone Bot se IA respondeu
- **Direita flex-1**: Empty state "Selecione uma conversa"

---

### 📱 30. `/whatsapp/conversas/[id]` — Chat individual
**Layout 3 colunas:**
- **Esquerda 320px**: Lista conversas (compacta)
- **Centro flex-1**: Chat UI
  - Bubbles cliente (esquerda branco border) + IA (gold pale bg) + atendente (navy bg branco)
  - Áudio com waveform mockado
  - Imagens com OCR result em tooltip
  - Input bottom: textarea + botões anexar/enviar
- **Direita 320px**: Painel IA
  - Classificação atual + confidence
  - Botões "Reclassificar" "Routear p/ JUR" "Handoff humano"
  - Dados extraídos: Nome, CPF, Demanda, Urgência

---

### 🤖 31. `/whatsapp/agente` — Configuração IA
- Switches enable/disable
- Textareas grandes para prompts
- Lista de 8 classificações configuráveis
- Botão "Testar agente" primary

---

### ✅ 32. `/tarefas` — Central de tarefas
- Tabs: Minhas (24) · Equipe (87) · Concluídas (143)
- TaskCards listadas com filtro de prioridade no topo
- Botão "Nova tarefa" + atalhos teclado

---

### 📊 33. `/dashboards` — Hub
**Grid 2x3 de cards grandes** (cada um é um link):
- Operacional (ícone Briefcase)
- Financeiro (ícone DollarSign)
- Comercial (ícone TrendingUp)
- Marketing (ícone Megaphone)
- WhatsApp (ícone MessageCircle)
- Admin Consolidado (ícone Crown)

Cada card: ícone gold gradient + título Playfair + descrição + "Ver dashboard →"

---

### 👑 34. `/dashboards/admin` — Dashboard Admin
**Layout editorial premium:**
- PageHeader hero com aside "Último update 14:32"
- **Hero block** asymmetric 2/1:
  - HeroStatCard "Receita recuperada · mês · R$ 487K · +18.4%"
  - 2 StatCards stacked (Casos ativos · Implantados)
- OrnamentalDivider
- **3 secondary StatCards**: Inadimplência · Leads novos · Taxa conversão
- OrnamentalDivider
- **Matriz Op × Fin**: Card hero full-width com heatmap Recharts (mock cores)
- OrnamentalDivider
- **2 cards pareados**: Cohort implantações (area chart) · Êxito por tipo (bar chart)

---

### 📈 35-39. `/dashboards/{operacional,financeiro,comercial,marketing,whatsapp}`
Mesmo padrão editorial. Cada um com:
- 1 HeroStatCard principal
- 3-4 StatCards secundários
- 2-3 gráficos Recharts (line, bar, area)
- Dividers ornamentais entre seções

---

### 🎨 40. `/design-system` — Showcase
Página interna mostrando todos os componentes. Útil para QA visual.

---

## PORTAL DO CLIENTE (subdomínio mock — pode ser `/portal/*`)

Layout mais clean, navy lateral fina, mais cream/paper.

### 41. `/portal` — Home cliente
- Greeting "Olá, Dr. João" Playfair grande
- Eyebrow "Seu painel"
- **3 cards principais:**
  - Meus casos (lista compacta com status amigável)
  - Pendências (docs solicitados + boletos abertos)
  - Mensagens (últimas 3 do atendimento)
- AlertStrip topo se tiver Termo aguardando aprovação

### 42. `/portal/casos/[id]` — Ficha amigável
Card com:
- Tipo de caso + badge status amigável ("Em análise pela Justiça")
- Próximo passo destacado em card gold pale
- Timeline simplificada visual (steps)
- Documentos do caso

### 43. `/portal/documentos` — Docs
Upload zone grande dashed + lista de docs por caso.

### 44. `/portal/boletos` — Boletos
Cards com: Valor · Vencimento · Status (Em aberto/Pago/Vencido) · Botão "Pagar" verde primary.

### 45. `/portal/mensagens` — Chat
UI chat similar a WhatsApp internal mas mais simples.

### 46. `/portal/perfil` — Perfil
Form de edição de dados pessoais com inputs editoriais.

---

## PAINEL EXECUTIVO (associados — pode ser `/painel/*`)

Visão mais corporativa, premium-corporate.

### 47. `/painel` — Home executiva
- Hero: H1 "Painel Executivo" + data
- **4 HeroStatCards**:
  - Associados representados · 2.547
  - Casos ativos · 1.892
  - Taxa de êxito · 87.4%
  - Valor recuperado 2026 · R$ 4.2M
- OrnamentalDivider
- **Sparkline grande** "Recuperação mensal · últimos 12 meses" — Recharts area chart com gradient gold

### 48. `/painel/demandas` — Distribuição
- H1 "Demandas representadas"
- Bar chart horizontal Recharts:
  - FIES ESF/DGM · 38%
  - COVID · 24%
  - Mais Médicos · 18%
  - Residência · 12%
  - CFM/CRM · 8%
- Cards explicativos por tipo

### 49. `/painel/associados` — Lista
Tabela executiva: Nome · Especialidade · Município · Casos · Status.

### 50. `/painel/relatorios` — PDFs
Grid cards de relatórios gerados: "Relatório anual 2025", "Q1 2026", etc. com botão Download gold.

### 51. `/painel/resultados` — Resultados
Galeria de cases de sucesso: foto + nome + tipo causa + resultado + valor recuperado. Tipo "wall of fame" editorial.

---

## Dados mockados — usar Faker.js seed 42

Crie um arquivo `src/mocks/fixtures.ts` com:

```ts
import { faker } from '@faker-js/faker/locale/pt_BR';
faker.seed(42);

export const casos = Array.from({ length: 300 }, (_, i) => ({
  id: `case-${i}`,
  codigo: `FIES-2024-${String(1000 + i).padStart(4, '0')}`,
  clienteNome: faker.person.fullName(),
  clienteCpf: faker.string.numeric(11),
  tipo: faker.helpers.arrayElement(['FIES_ESF', 'FIES_DGM', 'COVID', 'MAIS_MEDICOS', 'RESIDENCIA', 'CFM_CRM']),
  macrostatusOp: faker.helpers.arrayElement(['ONBOARDING', 'ANALISE', 'EM_ANDAMENTO', 'AGUARDANDO_DECISAO', 'IMPLANTADO']),
  macrostatusFin: faker.helpers.arrayElement(['ELABORANDO', 'ATIVO', 'QUITANDO', 'INADIMPLENTE']),
  diasNoEstado: faker.number.int({ min: 1, max: 90 }),
  municipio: faker.location.city() + '/AL',
  valor: faker.number.int({ min: 5000, max: 80000 }),
  proximoPasso: faker.lorem.sentence(6),
}));

export const clientes = Array.from({ length: 200 }, (_, i) => ({...}));
export const tarefas = Array.from({ length: 50 }, (_, i) => ({...}));
export const leads = Array.from({ length: 100 }, (_, i) => ({...}));
// ... etc
```

---

## Detalhes que NÃO podem faltar

1. ❌ **NUNCA use emojis decorativos como 🔴🟡🟢 ou 🟦** — substitua por status-dot ringed ou ícones Lucide coloridos
2. ❌ **NUNCA use Inter para títulos** — sempre Playfair Display para H1/H2/KPIs
3. ❌ **NUNCA use gradients roxos/azulados genéricos** — só navy + gold da paleta
4. ❌ **NUNCA use shadows pretos puros** — sempre matiz navy (`rgb(30 32 68 / 0.X)`)
5. ✅ **SEMPRE use eyebrow gold accent** acima dos títulos
6. ✅ **SEMPRE use OrnamentalDivider** entre seções importantes
7. ✅ **SEMPRE use Playfair em números KPIs** (lining-nums tabular-nums)
8. ✅ **SEMPRE use letter-spacing -0.025em** em títulos
9. ✅ **SEMPRE max-w 1440 + padding 4.5rem** no page-container
10. ✅ **SEMPRE use trend pills** (não setas isoladas) para variações %
11. ✅ **SEMPRE inclua corner-glow gold** em cards hero
12. ✅ **SEMPRE inclua paper-texture sutil** no fundo de áreas longas (sidebar, cards hero)

---

## Microinterações

- **Hover em cards interativos**: `translate-y-[-2px]` + shadow forte + border navy/18
- **Page transitions**: fade-in 280ms cubic-bezier(0.16, 1, 0.3, 1) + translateY(8px)
- **Sidebar item active**: gold accent bar com box-shadow glow
- **Focus ring**: 3px gold/30 (`--shadow-focus`)
- **Skeleton loading**: pulse com bg-subtle, NÃO com cinza neutro

---

## Acessibilidade

- Todos botões com `aria-label`
- Inputs com `<label>` associados
- Color contrast WCAG AA mínimo
- Focus visible sempre dourado
- `prefers-reduced-motion` respeitado

---

## Entrega final esperada

✅ React + Vite + TS + Tailwind + Router DOM funcionando
✅ Sidebar premium navy com 3 grupos + gold ornaments
✅ TODAS as 51 telas listadas implementadas (mock data, botões clicáveis)
✅ Componentes signature: Eyebrow, OrnamentalDivider, StatCard, HeroStatCard, CaseCard, TaskCard, MacrostatusBadge, PipelineBoard, AlertStrip, TimelineFeed, ClientHeader, DocumentRow, NextActionFooter
✅ Charts mockados com Recharts (sparkline, bar, area, line)
✅ Tipografia Playfair + Inter via Google Fonts
✅ Paleta navy/gold rigorosamente aplicada
✅ Responsive mobile (sidebar vira drawer hamburger)
✅ Página de design-system com showcase dos componentes
✅ Sem erros de console, sem warnings React

Quando terminar, gere uma rota `/design-system` listando todos os componentes criados para QA visual rápido.

==== FIM DO PROMPT ====

---

## 📋 Como usar

1. Abra o **Lovable** (https://lovable.dev)
2. Clique em **"New Project"**
3. Cole TODO o conteúdo entre `==== PROMPT ====` e `==== FIM DO PROMPT ====`
4. Espere o Lovable gerar (vai levar alguns minutos — são 51 telas)
5. Itere visualmente direto no preview do Lovable

## 🎯 Próximos passos depois

Quando o layout estiver perfeito no Lovable:
1. Exportar código do Lovable
2. Substituir os componentes equivalentes no monorepo Next.js
3. Manter o backend MSW + TanStack Query como estão
4. Migrar visual signature (CSS + componentes) para o `@hv/ui` package

---

**Versão**: 1.0
**Data**: 2026-05-15
**Estimativa Lovable**: 30-60min para gerar tudo
