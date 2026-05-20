# Sprint 6 — Onboarding ZapSign + Portal do Cliente V1

> **Versão:** 1.0 · **Status:** Pendente
> **Estimativa:** 10 dias úteis · **Épicos PRD 1:** 5 (ZapSign) + 9 (Portal — primeira metade)

---

## Objetivo

Ligar a **porta de entrada principal** de novos casos: webhook ZapSign com os 3 caminhos (A novo, B existente, C inconsistência), idempotência, validação HMAC. E entregar a **primeira versão funcional do Portal do Cliente** (mobile-first) com login, home, casos, docs (upload), boletos (read-only — geração real vem no Sprint 9). Aceite de Termo via Portal **não** entra aqui — fica no Sprint 9 quando o Termo está pronto.

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **5.1** | Webhook ZapSign Caminho A (cliente novo) | 2d |
| **5.2** | Webhook ZapSign Caminho B (cliente existente) | 1d |
| **5.3** | Webhook ZapSign Caminho C (inconsistência) | 1d |
| **9.1** | Login do Portal | 1d |
| **9.2** | Visão geral dos casos (linguagem cliente) | 2d |
| **9.4** | Upload de documentos | 2d |
| **9.5** | Boletos (read-only V1) | 1d |

---

## Telas Lovable tocadas (Portal)

- `portal.index.tsx` — home
- `portal.casos.$id.tsx` — detalhe caso (linguagem simples)
- `portal.documentos.tsx` — upload + lista pendentes
- `portal.boletos.tsx` — lista + download (vazia até Sprint 9)
- `portal.perfil.tsx` — placeholder (V2 no Sprint 9)
- `portal.mensagens.tsx` — placeholder (V2 no Sprint 9)

---

## Entregas-chave

### ZapSign (Stories 5.1, 5.2, 5.3)
- Edge Function `webhook-zapsign`: valida HMAC do header `X-ZapSign-Signature`
- Idempotência via `doc_id` (UNIQUE em `case_outbox_events`); webhook duplicado retorna 200 + skip
- **Caminho A:** CPF não existe → cria `clients` + `cases` em ONBOARDING + cria pasta Drive (chama Edge `sync-drive-folder` do Sprint 5) + envia WhatsApp boas-vindas (placeholder até ChatGuru no Sprint 9; aqui só registra task)
- **Caminho B:** CPF existe → cria apenas `cases` novo vinculado; reutiliza `contract_honorarios` se aplicável
- **Caminho C:** dados conflitantes (CPF bate mas nome diverge, ou já tem caso ativo do mesmo tipo) → cria tarefa URGENTE para JUR + ADM, notificação imediata via `notifications`, caso NÃO criado até resolução manual
- Logs estruturados de cada webhook (request + response + decisão) em `case_outbox_events`

### Portal V1 (Stories 9.1, 9.2, 9.4, 9.5)
- **Login Portal:** rota dedicada `/portal/entrar` (se ainda não existe, adicionar; OU usar `portal.index.tsx` com auth state). E-mail OU CPF + senha; magic link opcional
- Mobile-first responsivo (já está no Lovable — apenas garantir que viewport mobile funciona)
- Role `client_portal` no Supabase; RLS filtra `cases.client_id = auth.user_metadata.client_id`
- **Home:** lista de casos ativos com **status simplificado** (tradução via tabela `client_facing_status_labels` org-scoped)
- **Próxima ação** na linguagem do cliente (sem jargão jurídico)
- Atalhos para docs pendentes, boletos, mensagens
- **Upload docs:** mesma mecânica do Sprint 5, mas role `client_portal` só pode subir em casos próprios; notificação ADM ao subir
- **Câmera:** `<input type="file" capture="camera">` para foto direta no mobile
- **Boletos read-only:** lista de parcelas (vem da tabela `parcelas`); como o Sprint 9 ainda não rodou, lista é vazia mas a infra está pronta

### Postmark integração (consequência cross-sprint)
- Conta Postmark configurada
- Templates Supabase Auth (convite, magic link, recovery) migrados para Postmark via SMTP
- Bounce tracking → marca `users.email_invalid = true`

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S6-R1** | Webhook ZapSign chega em duplicata (rede instável) | Idempotência por `doc_id` com UNIQUE; retorna 200 sempre |
| **S6-R2** | Caminho C bloqueia ADM se ninguém triagem | SLA: tarefa URGENTE + e-mail + Slack (V2); admin pode forçar criação manual |
| **S6-R3** | Cliente esquece senha no Portal (sem suporte presencial) | Magic link sempre disponível; "Esqueceu senha" via Postmark |
| **S6-R4** | Upload mobile via câmera tem rotação/EXIF errada | Lib `exif-rotate-js`; teste em 3 modelos iOS/Android |
| **S6-R5** | Portal vê dados de outro cliente por bug RLS | Audit-RLS Sprint 1 cobre; teste E2E específico com 2 clientes |
| **S6-R6** | ZapSign muda formato de payload | Schema Zod estrito; alerta @admin se payload novo aparece |

---

## Definition of Done (além do global)

- [ ] 7 stories com ACs cumpridos
- [ ] Smoke E2E ZapSign: 3 caminhos testados com payload real (sandbox)
- [ ] Smoke E2E Portal: cliente loga → vê seu caso → faz upload → ADM recebe notificação
- [ ] axe-core mobile: zero violations nas 6 rotas portal
- [ ] Lighthouse mobile Performance ≥ 80 no Portal Home
- [ ] RLS Portal: cliente A não vê NADA do cliente B (script audit-rls)

---

## Próximo sprint

[**Sprint 7 — POPs FIES_COVID + FIES_ESF_DGM**](./sprint-07-pops-fies.md)

---

> _— @pm John, sob coordenação do Orion 🎯_
