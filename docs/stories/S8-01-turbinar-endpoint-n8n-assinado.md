# S8-01 — Turbinar endpoint `api.webhooks.n8n` (procuração assinada)

**Status:** Implementado (Fase 1 — lado app). Pendente: reescrever o fluxo n8n (Fase 2) para chamar este endpoint em vez de escrever cru no Supabase.

> **ATUALIZAÇÃO S9-06 (2026-07-03):** o modelo mudou (Sprint 9). Procuração assinada = evento **COMERCIAL** e o caso **SEGUE LEAD** — o endpoint NÃO promove mais a CLIENTE na procuração. No ramo `assinado=true` ele agora chama `registrarProcuracaoAssinada` (em vez de `promoverCasoManual`); a resposta retorna `caso_promovido=false` e `caso_lifecycle='LEAD'`. A promoção a CLIENTE passou a ser **só por CONTRATO assinado** (`promoverCasoOperacional`, via botão manual ou webhook ZapSign roteando `doc_kind='contrato'`). O defeito (a) descrito abaixo ("cria como LEAD e nunca promove") deixa de ser defeito — LEAD após procuração é o comportamento CORRETO.

**Contexto:** O onboarding automático do n8n (fluxo "disparar e cria leads") hoje
escreve DIRETO no Supabase e apresenta 3 defeitos: (a) cria o caso como LEAD e
nunca promove a CLIENTE; (b) salva o PDF assinado em `system_client_documents`
(nível cliente) em vez de `system_case_documents` (procuração do caso); (c) não
registra consentimento LGPD. A correção (Opção A) é o n8n passar a CHAMAR
`POST /api/webhooks/n8n` (`processN8nWebhook`). Esta story turbina esse endpoint
para cobrir os 3 pontos, mantendo retrocompatibilidade.

---

## Contrato do payload (o que o n8n deve enviar)

`POST /api/webhooks/n8n`

**Auth (obrigatório):** header `x-webhook-secret: <N8N_WEBHOOK_SECRET>` (ou
`Authorization: Bearer <secret>`). Sem secret configurado no app → 503; secret
errado → 401.

**Body (JSON):**

```jsonc
{
  // --- Cliente (obrigatórios: nome_cliente, cpf_cnpj) ---
  "nome_cliente": "Fulano de Tal",
  "cpf_cnpj": "123.456.789-00",       // com ou sem máscara; o app sanitiza
  "email": "fulano@exemplo.com",       // opcional
  "telefone": "(11) 99999-0000",       // opcional

  // --- Processo (obrigatório: tipo_processo) ---
  "tipo_processo": "FIES_ESF",         // SLUG do system_service_types
  "numero_processo": null,             // opcional
  "municipio": "São Paulo",            // opcional
  "responsavel": "Dra. Beltrana",      // opcional
  "proximo_passo": null,               // opcional

  // --- Documento assinado (opcional) ---
  // Presente SÓ quando a procuração já foi assinada no ZapSign.
  "assinado": true,
  "documento_assinado": {
    // Preferido: o n8n sobe o PDF ao Drive ANTES e passa o id/url.
    "drive_file_id": "1AbC...",
    "drive_url": "https://drive.google.com/file/d/1AbC.../view",
    // Alternativa: só a URL pública do PDF assinado — o app baixa e sobe na
    // pasta do caso. (Se drive_file_id vier, este é ignorado.)
    "signed_file_url": "https://zapsign.../signed.pdf",
    "name": "Procuração",              // título do doc (default "Procuração")
    "zapsign_doc_token": "abc-123"     // token do ZapSign (rastreio/dedupe)
  }
}
```

### Regras do bloco `documento_assinado`

- Só é processado quando `assinado === true` **e** `documento_assinado` presente.
- É preciso **pelo menos** `drive_file_id` **ou** `signed_file_url` para armazenar
  o PDF. Se vier só `signed_file_url`, o caso precisa ter pasta no Drive (o app
  cria a pasta do cliente/caso antes; se o Drive falhar, retorna 424).
- Sem esse bloco (ou `assinado` ausente/false) → comportamento legado: cria
  cliente + caso na 1ª etapa op e o caso permanece **LEAD**.

---

## Resposta (`N8nWebhookResult`)

```jsonc
{
  "cliente_id": "uuid",
  "cliente_nome": "Fulano de Tal",
  "cliente_criado": true,
  "cliente_drive_folder_id": "1...",

  "caso_id": "uuid",
  "caso_code": "FIES-2026-0007",
  "caso_criado": true,
  "caso_drive_folder_id": "1...",

  // Só relevante quando assinado=true:
  "documento_assinado_id": "uuid | null",
  "documento_assinado_criado": true,     // false se reprocessamento/atualização
  "caso_promovido": true,                // true se virou CLIENTE nesta chamada
  "caso_lifecycle": "CLIENTE",           // 'LEAD' | 'CLIENTE' | ...
  "consentimento_registrado": true       // false se já existia consentimento ativo
}
```

Erros: `N8nWebhookError` com status próprio (400 validação, 424 dependência
externa Drive/fetch, 500 interno). Falhas de dependência usam **424** (não 5xx)
por causa do gateway Vercel que mascara 5xx (ver memória
`reference_vercel_5xx_gateway`).

---

## O que o endpoint passou a fazer

1. **Cliente** — find-or-create por CPF/CNPJ + pasta no Drive (inalterado).
2. **Caso** — find-or-create por tipo+cliente. **Corrigido:** a 1ª etapa op agora
   é resolvida via `system_service_types` → `system_pipeline_stages`
   (`kind='op'`, menor `ordem`), em vez do slug `'ONBOARDING'` hardcoded que
   podia não existir na pipeline do tipo. Fallback `'ONBOARDING'` só como último
   recurso. O caso nasce **LEAD** (default da coluna) — lifecycle NÃO é escrito no
   insert.
3. **Documento assinado** (`assinado=true`):
   - **a.** Grava/atualiza `system_case_documents` com `doc_kind='procuracao'`,
     `status='ASSINADO'`, `case_id`, `drive_file_id/url`, `title`,
     `zapsign_doc_token` (quando informado). Reusa o padrão de
     `case-documents-service`/`zapsign/webhook`. Se já existia uma procuração no
     caso (placeholder/enviada), ela é promovida a ASSINADO (não duplica).
   - **b.** **Promove o caso a CLIENTE** via `promoverCasoManual` (escrita de
     lifecycle centralizada, auditada em `system_case_events`). Idempotente
     (no-op se já CLIENTE). Ator = usuário `admin` da org; se não houver admin,
     a promoção é pulada com log (best-effort — não perde o doc).
   - **c.** Registra **consentimento LGPD** via `recordConsent`
     (`system_consent_records`, `finalidade='prestacao_servico_juridico'`,
     `channel='WHATSAPP'`). Só grava se não houver consentimento ativo p/ o
     cliente (idempotente).
4. **Idempotência:** cliente por CPF/CNPJ; caso por tipo+cliente; documento por
   caso+`doc_kind='procuracao'` (não duplica nem re-sobe PDF se já ASSINADO);
   promoção no-op se já CLIENTE; consentimento no-op se já ativo.
5. **Retrocompatível:** payload sem documento assinado ⇒ comportamento antigo
   (onboarding, caso LEAD).

---

## Arquivos alterados

- `sistema-hv/src/lib/n8n-webhook-service.ts` — payload estendido
  (`assinado`, `documento_assinado`), resposta estendida, resolução da 1ª etapa
  op (sem slug hardcoded), gravação da procuração ASSINADA, promoção via
  `promoverCasoManual`, registro LGPD via `recordConsent`.
- `sistema-hv/src/routes/api.webhooks.n8n.tsx` — comentário; o parse já aceita os
  novos campos (tipo `N8nIncomingPayload`); auth/secret inalterados.

## Sem migration

Reusa tabelas existentes: `system_case_documents`, `system_cases`,
`system_consent_records` (migration `20260602000004_rbac_lgpd.sql`),
`system_case_events`, `system_audit_log`. Não toca `system_cases` (sem recriar
view).

---

## Verificação

- `npx tsc --noEmit`: só os 3 erros pré-existentes de `service_type_id`
  (`casos.$id.tsx`, `casos.financeiro.index.tsx`). Nenhum erro nos arquivos
  tocados.
- `npx eslint src/lib/n8n-webhook-service.ts`: limpo (formatado com prettier).
- `src/routes/api.webhooks.n8n.tsx`: só erros CRLF de prettier (pré-existentes,
  ignorados por guardrail).

## Pendências / notas para a Fase 2 (reescrever o fluxo n8n)

- O n8n deve **parar de escrever cru no Supabase** e passar a chamar
  `POST /api/webhooks/n8n` com o secret e o payload acima.
- Preferir subir o PDF assinado ao Drive no n8n e enviar `drive_file_id`
  (evita o app rebaixar via `signed_file_url`).
- LGPD: o schema `system_consent_records` cobre o registro; `channel='WHATSAPP'`
  foi assumido (origem Zaping/WhatsApp). Ajustar se a origem for outra.
- Promoção depende de existir usuário `admin` na org (seed já cria o
  `hyagoviana.adv@gmail.com` como admin). Sem admin, o caso fica CLIENTE-pendente
  (doc gravado, promoção pulada) — monitorar log.
