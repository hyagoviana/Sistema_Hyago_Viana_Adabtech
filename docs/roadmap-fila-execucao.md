# 🗂️ Fila de Execução — Sistema Hyago Viana Advocacia

> Atualizado: 2026-06-02 · Orquestração: Orion (aios-master)
> Regra: seguimos **um item por vez, em ordem**. Cada frente é desenhada ao iniciar
> (PM→Architect→QA nas grandes), validada no navegador (Playwright) e só então entregue.

---

## ✅ Concluído
- Infra: **Vercel** (via Nitro) + **Supabase** + **Google Drive** + domínio Hostinger
- **Login funcional** (Supabase Auth) + guard de rotas + logout
- **Clientes** (CRUD + atributos profissionais estruturados PF/PJ)
- **Casos** (Pipeline Operacional + Financeira, bifurcação automática)
- **Documentos** (upload/download, Google Drive)
- **Dossiê 360º do caso** (Tarefas, Prazos, Comunicações)
- **Repaginação premium** (Lora, login split-screen, sidebar navy, favicon, botões dourados)
- Remoção dos mocks de identidade ("Maria" → usuário logado)
- **Fluxo n8n #1 — Onboarding ZapSign** (automático): e-mail assinado → Cliente + Caso + Doc

---

## 🔜 Fila (em ordem)

### 1. RBAC (7 papéis) + LGPD  ⟵ **EM ANDAMENTO**
- **1a — LGPD bootstrap:** `consent_records`, registro/revogação, export do titular, retenção.
- **1b — RBAC:** tabela `system_users` (id=auth.uid, role, nome, ativo); matriz de permissões;
  gates de UI + RLS por papel; tela de gestão de usuários + convite por e-mail.
  - Papéis: administrador, advogado titular, advogado associado, prestador externo,
    controladoria, comercial, financeiro.

### 2. Termo de Acerto
Wizard de elaboração (cálculos automáticos) → conferência cruzada (segregação) →
aprovação híbrida (auto/manual) → snapshot imutável + PDF. **Núcleo da monetização.**

### 3. Cobrança
App + **fluxo n8n** (Conta Azul/Asaas): geração de parcelas, webhook de pagamento,
régua de cobrança (cron), renegociação.

### 4. Automação FIES via n8n
SEI scraper (andamento dos processos), Gov.br protocolo, Gmail monitor (MS/FNDE), CNES.

### 5. Portal do Cliente
Login do cliente, casos, documentos, boletos, aceite de termo (2FA).

### 6. Dashboards reais (Op / Financeiro / Admin)

### 7. Migração (~2.500 casos do Excel/Trello)

### 8–12. Projetos 2–6 (app + n8n por módulo)
- **2 — Controladoria** (Projuris sync, classificação IA, prazos, exceções, teses)
- **3 — Peticionamento** (RAG, geração de minutas)
- **4 — Comercial/CRM**
- **5 — Marketing**
- **6 — Agente WhatsApp** (Evolution/n8n)

---

## Padrão de cada frente
1. Desenho (PM→Architect→QA nas grandes) → 2. Migrations via `db-exec` (Management API) →
3. Backend (service/rpc/hooks) → 4. UI → 5. `tsc` + build + **teste no navegador** →
6. Commit/push → 7. Validação do owner.
