# 💬 PRD Projeto 6 — Agente de IA via WhatsApp

> **Plataforma Unificada Hyago Viana Advocacia**
> **Versão:** 1.0 · **Data:** 2026-05-15 · **Owners:** @pm + @architect + @qa · **Orquestração:** Orion
> **Status:** Aprovado para épicos/stories
>
> Consome: PRD Master + PRD 0 + PRD 1.

> ⚠ **Alinhamento com estratégia design-first (v1.1):**
> Quando este PRD entrar em execução (Fase **F6** do roadmap, pode paralelizar com F5 Controladoria), as telas do WhatsApp (Inbox de conversas, Chat UI com painel lateral IA, Configuração do Agente, Handoffs) **JÁ ESTARÃO IMPLEMENTADAS** com fixtures. Este PRD foca em: setup Evolution API self-hosted, n8n workflow inbound/outbound, state machine conversacional (Claude Haiku), classificação 8 categorias, handoff humano, multimodal (Whisper áudio + OCR Vision), LGPD consent. **UI pronta — foco é orquestração e IA.**

---

## Sumário
1. [Visão](#1-visão)
2. [Personas](#2-personas)
3. [Escopo](#3-escopo)
4. [Schema do Projeto 6](#4-schema-do-projeto-6)
5. [Infraestrutura — Evolution API + n8n](#5-infraestrutura)
6. [Fluxo conversacional](#6-fluxo-conversacional)
7. [Classificação de intenção](#7-classificação-de-intenção)
8. [Handoff humano](#8-handoff-humano)
9. [Multimodal — áudio e OCR](#9-multimodal--áudio-e-ocr)
10. [LGPD](#10-lgpd)
11. [Telas](#11-telas)
12. [Épicos e Stories](#12-épicos-e-stories)
13. [Métricas](#13-métricas)
14. [Critérios de aceitação](#14-critérios-de-aceitação)
15. [Riscos](#15-riscos)

---

## 1. Visão

> **"Atende 24/7 como um SDR informado, sem fingir ser humano, sem decidir nada juridicamente, encaminhando ao setor correto."**

O agente:
- Saúda e **identifica-se como automação** ("Oi! Sou o assistente virtual da Hyago Viana...").
- Solicita **consentimento LGPD** explícito antes de coletar dados.
- Coleta nome, CPF, contato, profissão, órgão de classe, tipo de demanda, descrição livre.
- **Classifica** o contato em 8 categorias (lead, cliente ativo, nova demanda, etc.).
- **Encaminha** ao setor correto (comercial, cross-sell, controladoria, administrativo).
- **Faz handoff humano** quando solicitado ou em casos sensíveis.
- **Registra tudo** na base canônica (Projeto 1).

---

## 2. Personas

| Persona | Tipo |
|---|---|
| **Lead externo** | Pessoa que descobriu o escritório (anúncio, indicação) |
| **Cliente ativo** | Já contratado, com caso(s) |
| **Médico curioso** | Ainda sem demanda definida |
| **Solicitante administrativo** | Cliente pedindo 2ª via, atualizar dados |
| **Agente IA** | Sistema responde no lugar do humano |
| **Atendente humano** | Camila, comercial — recebe handoff |

---

## 3. Escopo

### Em escopo (V1)
- ✅ Integração Evolution API self-hosted
- ✅ Webhook inbound + outbound
- ✅ Agente IA conversacional (Claude Haiku → Sonnet escalação)
- ✅ Coleta LGPD-compliant
- ✅ Classificação automática em 8 categorias
- ✅ Encaminhamento ao setor (cria oportunidade/lead/caso/comunicação)
- ✅ Handoff humano via comando ou trigger automático
- ✅ Captura multimodal: áudio (transcrição) + imagens/docs (OCR)
- ✅ Registro completo em `case_communications` + `whatsapp_*`

### Fora de escopo
- ❌ Atendimento jurídico substantivo (consulta processual, parecer)
- ❌ Geração de documentos
- ❌ Aceite de Termo (vai por Portal/ZapSign)
- ❌ Cobrança automática (vai pelo Projeto 1 régua)

---

## 4. Schema do Projeto 6

### 4.1 Tabela `whatsapp_conversations`

```sql
CREATE TABLE whatsapp_conversations (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         uuid NOT NULL REFERENCES organizations(id),
  phone_e164              text NOT NULL,                              -- ex: +5582999999999
  client_id               uuid REFERENCES clients(id),                -- vinculado quando identificado
  client_lead_id          uuid REFERENCES commercial_leads(id),       -- se for lead
  status                  text NOT NULL DEFAULT 'ACTIVE',              -- ACTIVE | HANDED_OFF | CLOSED | BLOCKED
  -- Estado da conversa (state machine)
  state                   text NOT NULL DEFAULT 'GREETING',            -- GREETING | LGPD_CONSENT | COLLECTING_DATA | CLASSIFYING | ROUTED | HANDOFF
  collected_data          jsonb DEFAULT '{}'::jsonb,                  -- {full_name, cpf, profession, ...}
  classification          text,                                        -- LEAD_EXTERNO | CLIENTE_ATIVO | NOVA_DEMANDA | QUESTAO_PROCESSUAL | QUESTAO_ADM_FIN | ENVIO_DOC | PEDIDO_HUMANO | NAO_CLASSIFICADO
  intended_routing        text,                                        -- COMERCIAL | CROSS_SELL | CONTROLADORIA | ADMINISTRATIVO | HUMAN_HANDOFF
  routed_to_user_id       uuid REFERENCES users(id),
  routed_at               timestamptz,
  -- Consentimento
  lgpd_consent_id         uuid REFERENCES consent_records(id),
  -- Métricas
  message_count_in        int DEFAULT 0,
  message_count_out       int DEFAULT 0,
  resolved_without_human  boolean,                                    -- true se agente resolveu sem handoff
  -- Tempos
  started_at              timestamptz NOT NULL DEFAULT now(),
  last_message_at         timestamptz,
  handed_off_at           timestamptz,
  closed_at               timestamptz
);

CREATE INDEX idx_conv_phone ON whatsapp_conversations(phone_e164);
CREATE INDEX idx_conv_client ON whatsapp_conversations(client_id);
CREATE INDEX idx_conv_state ON whatsapp_conversations(state, last_message_at DESC);
```

### 4.2 Tabela `whatsapp_messages`

```sql
CREATE TABLE whatsapp_messages (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  conversation_id     uuid NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  -- Identificação Evolution
  evolution_msg_id    text,
  direction           text NOT NULL,                              -- INBOUND | OUTBOUND
  sender              text,                                       -- AGENT_IA | USER_HUMAN | CLIENT
  sender_user_id      uuid REFERENCES users(id),                  -- se humano interno
  -- Conteúdo
  message_type        text NOT NULL,                              -- TEXT | AUDIO | IMAGE | DOCUMENT | LOCATION | CONTACT
  text_content        text,
  media_storage_path  text,
  transcription       text,                                       -- áudio transcrito
  ocr_text            text,                                       -- texto extraído de imagem/doc
  ai_summary          text,
  -- Tempos
  sent_at             timestamptz NOT NULL DEFAULT now(),
  delivered_at        timestamptz,
  read_at             timestamptz,
  -- Raw
  raw_payload         jsonb
);

CREATE INDEX idx_msg_conv ON whatsapp_messages(conversation_id, sent_at DESC);
CREATE INDEX idx_msg_evolution ON whatsapp_messages(evolution_msg_id);
```

### 4.3 Tabela `agent_classifications` (logs de classificação para acurácia)

```sql
CREATE TABLE agent_classifications (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         uuid NOT NULL REFERENCES organizations(id),
  conversation_id         uuid NOT NULL REFERENCES whatsapp_conversations(id),
  ai_classification       text NOT NULL,
  ai_routing              text NOT NULL,
  ai_confidence           numeric(5,2),
  ai_reasoning            text,
  human_validated         boolean,
  human_correction        text,
  validated_by_id         uuid REFERENCES users(id),
  validated_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);
```

### 4.4 Tabela `agent_handoffs`

```sql
CREATE TABLE agent_handoffs (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         uuid NOT NULL REFERENCES organizations(id),
  conversation_id         uuid NOT NULL REFERENCES whatsapp_conversations(id),
  reason                  text NOT NULL,                             -- USER_REQUESTED | SENSITIVE_TOPIC | LOW_CONFIDENCE | EXPLICIT_KEYWORD | ESCALATION
  reason_details          text,
  target_team             text NOT NULL,                             -- COMERCIAL | JURIDICO | ADMINISTRATIVO | CONTROLADORIA
  picked_up_by_id         uuid REFERENCES users(id),
  picked_up_at            timestamptz,
  response_time_seconds   int,                                       -- tempo até humano pegar
  conversation_summary    text,                                      -- resumo gerado por IA para o humano
  created_at              timestamptz NOT NULL DEFAULT now()
);
```

---

## 5. Infraestrutura

### 5.1 Evolution API self-hosted

- **Repo:** [https://github.com/EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api)
- **Docker Compose** em VPS (mesma do n8n).
- **Conexão:** QR Code escaneado por aparelho oficial do escritório (número dedicado).
- **Multi-instância:** preparado para 2+ instâncias se necessário.

### 5.2 n8n workflow `wf-evolution-inbound`

```
[Webhook Evolution recebe mensagem]
   ↓
[Valida HMAC]
   ↓
[Upsert whatsapp_conversations (por phone)]
   ↓
[Insert whatsapp_messages]
   ↓
[Identifica cliente (lookup por phone)]
   ↓
[Se message_type=AUDIO: transcrever (Whisper ou Claude)]
[Se IMAGE/DOCUMENT: OCR + extração]
   ↓
[Determina state atual da conversa]
   ↓
[Roteia para handler do state:
   - GREETING → enviar saudação + pedir consent
   - LGPD_CONSENT → registrar consent + iniciar coleta
   - COLLECTING_DATA → próxima pergunta ou finalizar
   - CLASSIFYING → classificar + rotear
   - ROUTED → mensagem para humano (se conexão ativa)
   - HANDOFF → notificar humano em plantão]
   ↓
[Atualiza conversation.state + collected_data]
   ↓
[Se gerou resposta IA: chama wf-evolution-outbound]
```

### 5.3 Migração para WhatsApp Business API

- Evolution API tem **risco de banimento** WhatsApp.
- Plano de migração: ao volume / risco aumentar, migrar para Meta WhatsApp Business API oficial (Twilio, 360dialog ou direto Meta).
- Custos repassados ao escritório (conforme contrato).
- Adapter `WhatsAppAdapter` (Hexagonal) já desde V1 — troca sem reescrita.

---

## 6. Fluxo conversacional

### 6.1 State machine

```
GREETING
   ↓ (mensagem do usuário)
LGPD_CONSENT
   ↓ (aceita)
COLLECTING_DATA
   ├── nome
   ├── CPF
   ├── profissão
   ├── órgão de classe (se aplicável)
   ├── tipo de demanda (multi-choice)
   └── descrição livre
   ↓
CLASSIFYING (IA)
   ↓
ROUTED (ou HANDOFF)
```

### 6.2 Mensagens-modelo (templates)

#### Saudação

```
Olá! 👋
Sou o assistente virtual da Hyago Viana Advocacia.

⚠ Aviso: sou um agente automatizado. Vou te ajudar a entender o que você precisa e direcioná-lo à pessoa certa.

Por causa da LGPD, preciso pedir seu consentimento para coletar alguns dados (nome, CPF, contato e descrição do que você precisa).

Posso continuar? Responda *SIM* para concordar ou *FALAR COM HUMANO* se preferir falar diretamente com nossa equipe.
```

#### Coleta de dados (uma pergunta por vez)

```
Ótimo! Vamos começar.

Qual é o seu nome completo?
```

```
Obrigado, [nome].
Pode me passar seu CPF, por favor? (somente números)
```

```
Você é médico(a)? Se sim, qual seu CRM e UF?
(responda "não sou médico" se não for o caso)
```

```
Sobre o que você gostaria de falar com a gente?

1️⃣ Abatimento FIES (Mais Médicos / ESF / COVID)
2️⃣ Auxílio-moradia residência médica
3️⃣ Defesa em CFM/CRM (ético-disciplinar)
4️⃣ Mandado de segurança / previdenciário
5️⃣ Outra demanda
6️⃣ Sou cliente do escritório e tenho uma dúvida

Responda com o número.
```

#### Confirmação / encaminhamento

```
Perfeito, [nome]! Suas informações:
✓ Nome: [nome]
✓ CPF: [cpf]
✓ Profissão: Médico(a) — CRM [crm]/[uf]
✓ Demanda: Abatimento FIES

Vou encaminhar para nossa equipe comercial. Em até 1h alguém te chama por aqui mesmo.

Se precisar agilizar, ligue (82) 9xxxx-xxxx.

Até já! 👋
```

#### Handoff explícito

```
Entendi que você prefere falar com um humano.

Já encaminhei sua conversa para nossa equipe. Em até 30 minutos alguém te responde por aqui.

Se for muito urgente, pode ligar agora: (82) 9xxxx-xxxx.
```

### 6.3 Persistência de contexto

- Cada conversa mantém `collected_data` (jsonb).
- Se cliente sair e voltar em menos de 24h, retoma onde parou.
- Após 24h sem resposta, conversa expira (state → CLOSED), reinicia se nova mensagem.

---

## 7. Classificação de intenção

### 7.1 Categorias

| Categoria | Critérios |
|---|---|
| **LEAD_EXTERNO** | Phone não está em `clients`; demanda nova |
| **CLIENTE_ATIVO** | Phone vincula a cliente; pergunta sobre caso existente |
| **NOVA_DEMANDA** | Cliente existente, mas demanda nova (cross-sell) |
| **QUESTAO_PROCESSUAL** | Cliente pergunta sobre andamento processo |
| **QUESTAO_ADM_FIN** | 2ª via boleto, atualizar endereço, dúvida sobre Termo |
| **ENVIO_DOC** | Mensagem inclui documento/imagem; possível envio de doc para caso |
| **PEDIDO_HUMANO** | Usuário pediu falar com humano |
| **NAO_CLASSIFICADO** | Confidence baixa; escala |

### 7.2 Prompt classificador (Claude Haiku)

```
Você é classificador de intenções para atendimento jurídico.
Conversa anterior + último contexto: [contexto]

Última mensagem do usuário: "[mensagem]"

Classifique em UMA categoria:
- LEAD_EXTERNO
- CLIENTE_ATIVO
- NOVA_DEMANDA
- QUESTAO_PROCESSUAL
- QUESTAO_ADM_FIN
- ENVIO_DOC
- PEDIDO_HUMANO
- NAO_CLASSIFICADO

E sugira um roteamento:
- COMERCIAL
- CROSS_SELL
- CONTROLADORIA
- ADMINISTRATIVO
- HUMAN_HANDOFF

Retorne JSON: { classification, routing, confidence, reasoning }
```

### 7.3 Roteamento automático após classificação

| Classificação | Ação |
|---|---|
| LEAD_EXTERNO | Cria `commercial_leads` (Projeto 4) + notifica COMERCIAL |
| CLIENTE_ATIVO | Cria `case_communications` vinculado + notifica responsável_juridico do caso |
| NOVA_DEMANDA | Cria `commercial_opportunities` (cross-sell) + notifica COMERCIAL |
| QUESTAO_PROCESSUAL | Cria `case_communications` + notifica CONTROLADORIA |
| QUESTAO_ADM_FIN | Cria `case_communications` + notifica ADM/FIN |
| ENVIO_DOC | Salva mídia em Storage, vincula a caso (se identificável), notifica ADM |
| PEDIDO_HUMANO | Handoff direto |
| NAO_CLASSIFICADO | Handoff direto (humano decide) |

---

## 8. Handoff humano

### 8.1 Triggers automáticos

- Usuário disse "humano", "atendente", "pessoa", "humano", "real".
- Tema sensível detectado (palavras-chave: "ameaça", "processar vocês", "urgente urgente").
- Cliente com processo ativo + sinais de insatisfação.
- Confidence de classificação < 60%.

### 8.2 Fluxo handoff

1. Agente envia mensagem "Ok, vou conectar você com alguém da nossa equipe..."
2. `conversation.state = HANDOFF`, `status = HANDED_OFF`.
3. IA gera resumo (`agent_handoffs.conversation_summary`) — context para o humano.
4. Notificação para `target_team` no app interno.
5. Primeiro humano que aceita: registra `picked_up_by_id`.
6. Conversa segue por humano (mensagens outbound via app, não IA).
7. Métrica: `response_time_seconds` (tempo até pickup).

### 8.3 SLA handoff

- **Pickup < 30s**: meta ≥ 95% (em horário comercial).
- **Pickup < 5min**: meta 100% (em horário comercial).
- **Fora de horário**: agente informa horário de atendimento + agenda callback.

### 8.4 UI do humano (tela `/whatsapp/conversas`)

```
┌──────────────────────────────────────────────────────────────┐
│ Conversas WhatsApp                                           │
│ [Inbox (3)] [Em Atendimento (5)] [Aguardando Cliente (12)]   │
│                                                              │
│ ┌─ 📞 João Silva (+5582 99999-9999) ────────────── 30s ─────┐│
│ │ 🤖 [Resumo IA]: Lead externo, médico, interessado em FIES ││
│ │                                                            ││
│ │ Última mensagem: "Quero falar com um humano por favor"    ││
│ │                                                            ││
│ │ [Pegar conversa] [Ver histórico completo]                 ││
│ └───────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

Quando pega:
```
┌──────────────────────────────────────────────────────────────┐
│ ← Voltar  João Silva (+5582 99999-9999)        👀 Camila    │
├──────────────────────────────────────────────────────────────┤
│ 🤖 Resumo IA: Lead. Médico. CRM 12345/AL. Interesse FIES.   │
│ Coletado: nome ✓ CPF ✓ profissão ✓ demanda: ABATIMENTO FIES │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ [conversa estilo chat — mensagens]                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [campo de texto]                                  [Enviar →] │
│ Anexar 📎  Áudio 🎤  Template 📄                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Multimodal — áudio e OCR

### 9.1 Áudio

- Recebe áudio inbound (Evolution API entrega URL).
- n8n baixa áudio → envia para transcrição.
- **Opção 1:** Whisper (OpenAI API) — ~$0.006/min.
- **Opção 2:** Claude Vision via vídeo (não suporta áudio direto, V2 com ElevenLabs).
- **Default:** Whisper.
- Transcrição salva em `whatsapp_messages.transcription`.
- Continua o flow conversacional com base no texto transcrito.

### 9.2 Imagem / Documento

- Recebe URL da mídia.
- Salva em `client-uploads` bucket Supabase.
- OCR:
  - PDF: pdf-parse (texto direto) + Tesseract (se for scan).
  - Imagem: Claude Vision (preciso) ou Tesseract (rápido/barato).
- Texto extraído em `whatsapp_messages.ocr_text`.
- Se mensagem mostra ser **documento de caso**, vincula a caso e cria `case_document` (status `RECEBIDO`).

### 9.3 Localização / Contato

- Salva em `raw_payload` mas não processa ativamente em V1.

---

## 10. LGPD

### 10.1 Banner inicial

Antes de coletar dados, agente envia:

```
Antes de continuarmos, alguns avisos importantes:

📋 *Política de Privacidade*
Vamos coletar: nome, CPF, contato, profissão e descrição da sua demanda.
Finalidade: avaliar sua solicitação e direcioná-la ao setor correto.
Base legal: consentimento (LGPD art. 7º, I).
Retenção: durante o relacionamento + 5 anos pós-encerramento (compliance fiscal).

Você pode a qualquer momento:
✓ Pedir acesso aos seus dados
✓ Solicitar exclusão (quando não houver obrigação legal de reter)
✓ Revogar consentimento

Política completa: https://hyagoviana.adv.br/privacidade

Continuamos? Responda *ACEITO* ou *NÃO*.
```

### 10.2 Registro de consentimento

Ao receber "ACEITO":
- Insere `consent_records` (finalidade: `DADOS_OPERACIONAIS`, channel: `WHATSAPP`, evidence: timestamp + phone + texto).
- `conversation.lgpd_consent_id` referenciado.

### 10.3 Revogação

- Usuário envia "REVOGAR CONSENTIMENTO" a qualquer momento.
- Agente confirma + registra revogação em `consent_records.revoked_at`.
- `conversation.status = CLOSED` + flag em `clients`.
- Equipe é notificada para cumprir solicitação manual (preservando obrigações legais).

---

## 11. Telas

(Detalhadas em §8.4 acima.)

### Configuração do Agente (Admin)

```
┌──────────────────────────────────────────────────────────────┐
│ Agente WhatsApp — Configuração                               │
│                                                              │
│ Status Evolution API: 🟢 Conectado                           │
│ Última mensagem inbound: há 2 min                            │
│ Mensagens hoje: 47 in / 38 out                               │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Mensagens-modelo                                             │
│ [✏ Saudação]  [✏ LGPD consent]  [✏ Coleta dados]            │
│ [✏ Confirmação]  [✏ Handoff]  [✏ Fora de horário]          │
│                                                              │
│ Horário de atendimento humano                                │
│ Segunda a Sexta: 09:00 - 18:00                              │
│ Sábado: 09:00 - 12:00                                       │
│ Fora desse horário, agente informa retorno em horário comer.│
│                                                              │
│ Teams de plantão (handoff)                                   │
│ Comercial:    Camila, Pedro                                 │
│ Jurídico:     Dra. Patrícia                                 │
│ Adm:          Maria                                          │
│                                                              │
│ Palavras-chave handoff automático                            │
│ [humano] [atendente] [pessoa] [+ adicionar]                 │
│                                                              │
│ Política de Privacidade — URL                                │
│ [https://hyagoviana.adv.br/privacidade]                     │
│                                                              │
│ [Salvar]                                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 12. Épicos e Stories

### Épico 1 — Infraestrutura
- **Story 1.1:** Setup Evolution API (Docker, QR code, instância)
- **Story 1.2:** n8n workflow inbound + HMAC
- **Story 1.3:** n8n workflow outbound (enviar mensagens)
- **Story 1.4:** Adapter `WhatsAppAdapter` (preparado para Business API futuro)

### Épico 2 — State Machine + Saudação
- **Story 2.1:** Detecção primeira mensagem → state GREETING
- **Story 2.2:** Envio saudação + identificação automação
- **Story 2.3:** Persistência de conversa + state

### Épico 3 — LGPD
- **Story 3.1:** Banner consentimento
- **Story 3.2:** Registro em `consent_records`
- **Story 3.3:** Comando "REVOGAR"

### Épico 4 — Coleta de Dados
- **Story 4.1:** Sequência de perguntas
- **Story 4.2:** Validação (CPF, formato)
- **Story 4.3:** Persistência incremental em `collected_data`

### Épico 5 — Classificação
- **Story 5.1:** Edge function `/api/ai/classify-conversation`
- **Story 5.2:** Logs em `agent_classifications`
- **Story 5.3:** Roteamento automático

### Épico 6 — Handoff
- **Story 6.1:** Detecção triggers automáticos
- **Story 6.2:** Comando "humano"
- **Story 6.3:** Notificação ao team
- **Story 6.4:** Pickup + UI atendente
- **Story 6.5:** Métricas tempo resposta

### Épico 7 — Multimodal
- **Story 7.1:** Áudio → Whisper → texto
- **Story 7.2:** Imagem/PDF → OCR
- **Story 7.3:** Vinculação automática docs a casos

### Épico 8 — Configuração Admin
- **Story 8.1:** Página configuração
- **Story 8.2:** Editor de templates
- **Story 8.3:** Horários e teams

### Épico 9 — Migração para WhatsApp Business API (V2)
- Stories deferred

---

## 13. Métricas

| Métrica | Meta |
|---|---|
| **Conversas resolvidas sem humano** | ≥ 50% |
| **Tempo handoff < 30s** | ≥ 95% (horário comercial) |
| **Classificação correta (validação amostral)** | ≥ 85% |
| **LGPD consent rate** | ≥ 90% |
| **Tempo total triagem (saudação → routed)** | < 3min |
| **Taxa de conversão lead → cliente** (com IA) | baseline + 30% |

---

## 14. Critérios de aceitação

- ✅ Evolution API conectada e estável (uptime ≥ 95% 30d)
- ✅ Saudação + LGPD funcionando em 100% das conversas novas
- ✅ Classificação automática em 8 categorias
- ✅ Roteamento automático para 5 destinos
- ✅ Handoff < 30s em horário comercial
- ✅ Áudio transcrito + OCR funcionando
- ✅ 100+ conversas processadas em produção
- ✅ Métricas dashboard operando
- ✅ Treinamento equipe (3h) realizado

---

## 15. Riscos

| # | Risco | Mitigação |
|---|---|---|
| **R6.1** | Banimento WhatsApp Evolution | Plano migração WhatsApp Business API; multi-instância |
| **R6.2** | Cliente confundir agente com humano | Identificação explícita na primeira mensagem + recall periódico |
| **R6.3** | Agente alucinar resposta jurídica | Prompt strict: nunca dar consulta jurídica; sempre encaminhar |
| **R6.4** | Tempo handoff alto (fora horário) | Comunicação clara + agendamento callback |
| **R6.5** | LGPD não-conformidade (coleta sem consent) | Bloqueio rigoroso no state machine; coleta só após `ACEITO` |
| **R6.6** | Cliente envia áudio longo | Limite 5min + transcrição truncada com aviso |

---

> **Status:** Aprovado. **Próximo:** PRD Projeto 3 — Máquina de Peticionamento.
> _— @pm + @architect + @qa, sob coordenação de Orion 🎯_
