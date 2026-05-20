# Sprint 9 — Cobrança (Conta Azul/Asaas) + Portal V2 + ChatGuru

> **Versão:** 1.0 · **Status:** Pendente
> **Estimativa:** 10 dias úteis · **Épico PRD 1:** 8 (final — apresentação até quitação) + 9 (Portal V2)

---

## Objetivo

Fechar o ciclo financeiro completo: apresentação do Termo ao cliente (4 canais), aceite com evidências legais, geração automática de parcelas via API Conta Azul **ou** Asaas (auto-detecção por contrato), webhook de pagamento atualizando status, régua de cobrança (lembrete amigável D-5, contato ativo D+15, escalação D+30, judicial 3+ meses), renegociação criando snapshot v2 com Aditivo. E completar o **Portal V2**: aceite de Termo via Portal com 2FA, mensagens (integração ChatGuru), perfil do cliente.

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **8.4** | Apresentação ao cliente | 1d |
| **8.5** | Aceite ou Discordância (4 canais) | 2d |
| **8.6** | Geração de parcelas via API | 3d |
| **8.7** | Régua de cobrança | 1d |
| **8.8** | Renegociação (v2 + Aditivo) | 1d |
| **9.3** | Aceite Termo via Portal (com 2FA) | 1d |
| **9 (extra)** | ChatGuru integração (mensagens + régua WhatsApp) | 1d |

---

## Telas Lovable tocadas

- `casos.$id.tsx` (aba Financeiro, aba Comunicação)
- `casos.$id.termo.tsx` (botão Apresentar, vista do Termo apresentado)
- `casos.financeiro.inadimplencia.tsx` (escalação)
- `portal.boletos.tsx`, `portal.casos.$id.tsx` (aceite), `portal.mensagens.tsx`, `portal.perfil.tsx`
- `whatsapp.conversas.$id.tsx` (mensagens vindas do ChatGuru)

---

## Entregas-chave

### Apresentação (Story 8.4)
- Botão "Apresentar" no Termo aprovado
- Sistema envia link Portal + WhatsApp (ChatGuru) + e-mail (Postmark) — canais configuráveis por org
- Status → APRESENTANDO_TERMO
- Alerta "Cliente Inerte" se >15d sem resposta (cron pg_cron + view do Sprint 4)

### Aceite (Story 8.5) — 4 canais
| Canal | Evidência registrada |
|---|---|
| **PORTAL** | user_id, IP, user-agent, timestamp, signed_text "Aceito os termos..." |
| **WHATSAPP** | thread_id ChatGuru, mensagem "ACEITO", número, timestamp |
| **PRESENCIAL** | Foto/assinatura escaneada + user_id que registrou |
| **ZAPSIGN** | doc_id ZapSign + signed_pdf_path |

- UI no dossiê: botão "Registrar aceite" abre seletor de canal + form de evidência
- Discordância: cliente justifica → TERMO_EM_DISCORDANCIA → fila em `controladoria.excecoes.tsx` (Sprint 4)

### Geração de Parcelas via API (Story 8.6)
- Adapter pattern: interface `CobrancaProvider` com 2 implementações (`ContaAzulProvider`, `AsaasProvider`)
- Detecção por `contract_honorarios.provider_preferido` (ou config org)
- Edge Function `create-cobranca` chama API criando N boletos
- Webhooks de pagamento (`webhook-conta-azul`, `webhook-asaas`) atualizam `parcelas.status = PAGA`
- Boletos disponíveis no Portal (`portal.boletos.tsx` agora popula) e via WhatsApp (link)
- NF sob demanda (Conta Azul) — botão "Gerar NF"
- Retry exponencial em falhas API; fallback: registro manual + alerta

### Régua de cobrança (Story 8.7)
- Cron pg_cron diário:
  - **D-5 antes vencimento:** dispara WhatsApp lembrete amigável (template ChatGuru)
  - **D+15 após:** cria tarefa "Contato ativo" para FIN
  - **D+30:** transição automática para INADIMPLENTE + tarefa JUR
  - **3+ meses:** tarefa "Avaliar cobrança judicial" para JUR

### Renegociação (Story 8.8)
- FIN inicia renegociação (até 2º mês atraso) ou JUR (a partir 3º)
- Wizard similar ao Termo: ajusta valor, parcelas, datas
- Cria snapshot v2 com `supersedes = v1`; v1 vira SUBSTITUIDO
- Gera Aditivo PDF (mesmo motor do Termo)
- Aceite do Aditivo segue mesmos 4 canais

### Portal Aceite Termo com 2FA (Story 9.3)
- Visualização PDF inline (`pdf.js`)
- Botão "Aceitar" → confirmação dupla (modal)
- 2FA: SMS (via provider — Twilio/Zenvia, decidir em ADR-008) OU TOTP se cliente configurou
- Texto literal salvo: "Eu, {nome}, CPF {cpf}, aceito o Termo de Acerto v{N} em {data}."
- Evidência completa registrada (IP, UA, timestamp, hash do PDF visualizado)

### ChatGuru
- Webhook inbound: mensagens cliente criam `case_communications` (canal=WHATSAPP)
- Outbound: Edge Function `send-whatsapp` chama API ChatGuru
- Templates pré-aprovados (lembrete cobrança, boas-vindas, "Aceito" hint)
- Régua automatizada de cobrança via WhatsApp (Story 8.7) usa este endpoint

### Portal Perfil + Mensagens
- `portal.perfil.tsx`: cliente atualiza endereço, telefone, preferências de privacidade (LGPD opt-in/out por finalidade)
- `portal.mensagens.tsx`: timeline mensagens WhatsApp + Portal (filtro por caso)

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S9-R1** | API Conta Azul/Asaas instável | Adapter pattern; retry; fallback manual; alerta @admin |
| **S9-R2** | Webhook de pagamento chega duplicado | Idempotência por `payment_id` |
| **S9-R3** | Cliente aceita Termo errado (v1 quando v2 existia) | Hash do PDF visualizado precisa bater com hash do snapshot ativo; erro se diverge |
| **S9-R4** | SMS 2FA tem custo alto | TOTP é default; SMS opcional; admin pode limitar para casos críticos |
| **S9-R5** | ChatGuru rate limit | Queue com backoff; UI mostra "Enviando..." |
| **S9-R6** | NF Conta Azul falha em emissão | Botão manual + log; FIN pode reemitir |

---

## Definition of Done (além do global)

- [ ] 7 stories com ACs cumpridos
- [ ] Smoke E2E completo: aprovação (Sprint 8) → apresentação → aceite Portal com 2FA → parcelas criadas (sandbox) → webhook paga → status atualiza
- [ ] Smoke E2E renegociação: criar v2 a partir de v1, gerar Aditivo, novo aceite
- [ ] ChatGuru: enviar template e receber resposta
- [ ] ADR-007 (Adapter Cobrança) + ADR-008 (Provider 2FA SMS) registrados
- [ ] LGPD: cliente atualiza preferências e log persiste

---

## Próximo sprint

[**Sprint 10 — Migração + Hardening**](./sprint-10-migracao-hardening.md)

---

> _— @pm John, sob coordenação do Orion 🎯_
