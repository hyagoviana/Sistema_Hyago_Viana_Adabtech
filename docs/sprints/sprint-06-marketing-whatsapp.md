# 📣 Sprint 6 — Marketing + WhatsApp — Passo a Passo

> **Versão:** 1.0 · **Status:** Pronto para execução
> **Pré-requisitos:** Sprints 1-5 ✅ concluídos e validados

---

## 🎯 Objetivo

Implementar **Pipeline editorial IA** (módulo Marketing) + **Inbox WhatsApp com chat completo** (módulo WhatsApp).

## 📦 Definição de Pronto

- [ ] Calendário editorial (mês/semana/lista)
- [ ] Editor de conteúdo multi-tab (Briefing/Roteiro/Copy/Mídia/Compliance)
- [ ] Compliance OAB checker visual (score + issues)
- [ ] Banco de mídia (grid + busca)
- [ ] Inbox WhatsApp com 3 abas
- [ ] Chat UI com painel lateral IA
- [ ] Handoff humano funcional (mock)
- [ ] Configuração agente (templates + plantão)

---

## 📋 Passo a passo

### BLOCO A — Marketing (Passos 1-7)

#### Passo 1 · `/marketing` — Painel
- KPIs: conteúdos publicados/mês, taxa engajamento mock, próximos publicações
- Cards de últimos conteúdos publicados

#### Passo 2 · `/marketing/calendario` — Calendário editorial
- 3 views: Mês (grid) | Semana | Lista
- Mini-cards coloridos por tipo:
  - [F] Feed post (gold)
  - [P] Podcast (navy)
  - [R] Reel (gold-light)
  - [I] Ideia (cinza)
  - [E] E-mail (info blue)
- Click em card → drawer com preview
- Botões: [Sugerir IA] [+ Nova ideia]
- Drag entre dias para reagendar (drag-drop)

#### Passo 3 · `/marketing/conteudos` — Lista
- DataTable: título, tipo, frente, stage (IDEIA/BRIEFING/REDACAO/REVISAO/APROVADO/PUBLICADO), assigned, compliance score
- Filtros: stage, tipo, frente
- Empty state: "Calendário vazio. Sugerir conteúdos com IA?"

#### Passo 4 · `/marketing/conteudos/novo` — Briefing wizard
- Step 1: Tipo (Reel/Short/Podcast/Post/E-mail/Article)
- Step 2: Frente temática (Mais Médicos/INSS/Residência/FIES/etc.)
- Step 3: Briefing (texto livre + referências opcionais)
- Step 4: Configurações (duração desejada, tom, plataforma)
- Step 5: "Gerar com IA" ou "Salvar para depois"

#### Passo 5 · `/marketing/conteudos/[id]` — **Editor multi-tab**
Layout com tabs:
- **Briefing**: texto + referências
- **Roteiro**: estrutura por cena/bloco com slots (visual, voz, texto overlay, duração)
- **Copy**: copy principal + 2 variações + hashtags + CTA
- **Mídia**: lista de assets vinculados ao conteúdo
- **Compliance**: score OAB 0-100 + lista de issues

Direita: painel "Generation info" (modelo, custo, tokens)
Footer: workflow buttons [Salvar Rascunho] [Enviar p/ Revisão] [Aprovar] [Publicar]

#### Passo 6 · `/marketing/banco-midia`
- Grid 4 cols (md), 6 cols (xl)
- Thumbnails (vídeos com play overlay, imagens, PDFs, áudios)
- Filtros: tipo (image/video/audio/file/template), frente, tags
- Busca por título/tags
- Upload zone (drop-zone large)
- Click → drawer com preview + metadata + tags + uso em conteúdos

#### Passo 7 · `/marketing/brand-guidelines`
- Editor rich text: voice/tone, do/don't lists, visual guidelines, OAB compliance rules
- Apenas para `marketing.admin`

### BLOCO B — WhatsApp (Passos 8-13)

#### Passo 8 · `/whatsapp` — Inbox
- Status header: 🟢 Evolution API: Conectada · Mensagens hoje: 47 in/38 out
- 4 tabs: Inbox (3) | Em atendimento (5) | Aguardando cliente (12) | Encerradas
- Lista cards de conversas:
  - Avatar + nome + telefone
  - Tipo (lead/cliente)
  - Tempo desde última mensagem
  - 🤖 Resumo IA (1 linha)
  - Última mensagem preview
  - Botão "[Pegar conversa]" (se ainda não tem dono)

#### Passo 9 · `/whatsapp/conversas/[id]` — **Chat UI (TELA CHAVE)**

Layout 3 colunas:

**Esquerda (lateral IA, 280px):**
- 🤖 **Resumo IA**: tipo (Lead/Cliente), profissão, demanda
- 📋 **Coletado**: lista de campos (Nome ✓, CPF ✓, etc.)
- 🔄 **Handoff**: status + tempo
- 🎯 **Ações sugeridas**: [Criar lead] [Vincular cliente] [Encerrar]

**Centro (chat, flex-1):**
- Header: nome + telefone + status + atendente atual
- Mensagens scroll vertical:
  - Bolhas distintas: cliente (esquerda, branco) | agente IA (direita, gold-light) | humano (direita, navy)
  - Timestamp em cada
  - Status entrega (sent/delivered/read)
  - Áudios com waveform + transcrição inline
  - Imagens/docs com preview + OCR text colapsável
- Composer bottom: textarea + anexar (📎) + áudio (🎤) + templates (📋) + Enviar (⏎)

**Direita (caso vinculado, 240px - opcional):**
- Se thread está vinculada a caso/cliente: mostra info do caso
- Se lead: mostra ações comerciais

#### Passo 10 · Bolhas de chat — componentes
- `<MessageBubbleClient />` — mensagem recebida
- `<MessageBubbleAgent />` — agente IA
- `<MessageBubbleHuman />` — humano interno
- `<MessageAudio />` — com transcrição
- `<MessageImage />` — com OCR
- `<MessageDocument />` — link + OCR text

#### Passo 11 · `/whatsapp/agente` — Configuração agente
- Status Evolution API
- Editor de templates de mensagens (6 templates: Saudação, LGPD consent, Coleta, Confirmação, Handoff, Fora de horário)
- Horário de atendimento humano (Mon-Fri + Sáb)
- Teams de plantão (Comercial, Jurídico, Adm)
- Palavras-chave handoff (chips removíveis)
- URL Política de Privacidade

#### Passo 12 · `/whatsapp/handoffs` — Fila ativa
- Lista de conversas em HANDOFF aguardando humano
- Tempo de espera em destaque (vermelho se > 30s)
- Botão "Pegar"

#### Passo 13 · `/whatsapp/templates` — Editor de templates
- Lista de templates pré-aprovados (Meta Business futuro)
- Editor: variáveis {nome}, {caso}, etc.
- Preview render

---

## ✅ Validação multi-agente

### @pm
- [ ] 10 telas funcionais
- [ ] Demo: receber mensagem (mock) → agente IA processa → handoff → humano responde

### @architect
- [ ] WebSocket mock para mensagens em tempo real (ou polling com refetch)
- [ ] State machine de conversation (GREETING → LGPD → COLLECTING → CLASSIFYING → ROUTED/HANDOFF)
- [ ] Storage de mensagens com paginação (cursor-based)

### @ux-design-expert
- [ ] Calendário editorial visualmente leve mas informativo
- [ ] Chat UI familiar (estilo WhatsApp Web)
- [ ] Bolhas com hierarquia clara (cliente vs agente vs humano)
- [ ] Compliance score visual e ergonômico

### @qa
- [ ] axe verde
- [ ] Áudio playback funcional (mock)
- [ ] Drag para reagendar conteúdo
- [ ] Performance: chat com 100+ mensagens scroll suave

### skill `frontend-design`
- [ ] Calendário não vira pesadelo visual (whitespace mantido)
- [ ] Chat sem overflow excessivo

### skill `web-design-guidelines`
- [ ] Mensagens com role + aria-label adequados
- [ ] Tab order lógico no chat

---

## ⏱ Estimativa

**8-10 dias úteis**

---

> _Próximo:_ **Sprint 7 — Portal Cliente + Painel Institucional**
> _— Orion, orquestrando o sistema 🎯_
