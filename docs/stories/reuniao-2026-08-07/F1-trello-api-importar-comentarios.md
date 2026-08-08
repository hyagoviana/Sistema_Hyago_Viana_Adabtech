# Story F1: Importar comentários do Trello via API (histórico + espelhamento) vinculando card→caso

- **Épico:** Futuro (pós-segunda) — Reunião 2026-08-07
- **ID:** F1
- **Status:** **Backlog / Futuro**
- **Estimativa relativa:** L/XL
- **Executor sugerido:** @architect + @dev + @data-engineer · Quality gate: @qa + @architect
- **Risco:** MÉDIO/ALTO — depende de credencial externa (login/senha admin do Trello) e de webhook/polling contínuo; a 2ª fase (escrita sistema→Trello) é escrita externa (a confirmar na API).
- **Origem:** Reunião 2026-08-07 (bloco FUTURO, **F1**). Transcrição `Dr. Thiago Correia [0000] se tiver.txt` (parte 2, sobre Trello): *"o Trello tem um histórico de anos de comentários"*, *"puxar do Trello os comentários + data + usuário"*, *"deixar essa API ligada do Trello para espelhar até migrarem; depois desliga"*.

> ⚠️ **ESTA STORY NÃO É PARA ANTES DE SEGUNDA.** É trabalho de FUTURO, posterior à reunião de segunda com o Iago. Na SEGUNDA a única entrega relacionada é a RESPOSTA verbal ao Thiago: **"É POSSÍVEL puxar os comentários do Trello via API"** (ver AC-0). A implementação começa depois, quando o Thiago fornecer login/senha admin do Trello.

---

## Story

**Como** escritório que hoje ainda mantém o histórico de comentários no Trello,
**quero** que o sistema **importe do Trello, via API, os comentários (texto + data + usuário)** de cada card e os registre no caso correspondente (vínculo **card → caso**, que pode ser **manual**: "tal card = tal caso"), mantendo um **espelhamento em tempo real** enquanto o time ainda usa o Trello,
**para** que, ao migrarem tema por tema para o sistema, o histórico de anos de comentários venha junto e a única coisa que ainda dependia do Trello (os comentários) deixe de depender — e depois a integração seja **desligada**.

> **DECISÕES TRAVADAS (reunião 2026-08-07):**
> 1. **1ª fase = só LEITURA** (puxar do Trello para o sistema). Segundo o Thiago: *"vamos tentar ver se a gente consegue essa primeira, que é puxar para cá."*
> 2. **Só os comentários** importam — NÃO importar clientes/casos/temas do Trello (o Trello está "bagunçado", os casos vêm da importação estruturada F2). O Thiago: *"o que a gente precisava do Trello só: os comentários, as datas e quem foi o usuário."*
> 3. **Vínculo card→caso pode ser MANUAL** ("tal card = tal caso"). Reaproveitar o identificador do card guardado no caso quando a importação de dados (F2) já tiver marcado o card.
> 4. **Espelhamento em tempo real** enquanto o Trello estiver ativo; quando o tema migrar 100% para o sistema, **desligar** a integração por tema.
> 5. **2ª fase (FUTURO do FUTURO) = escrita bidirecional** (sistema→Trello). Só depois de confirmar na API se o Trello permite escrever comentário programaticamente. O Thiago: *"eu colocaria como alternativa muito interessante, mas deixaria como a segunda."*

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Timeline de eventos do caso:** `sistema-hv/src/components/cases/CaseTimeline.tsx` (lista `system_case_events` por `case_id`, `created_at DESC`; entrada manual = evento próprio). Um comentário importado do Trello pode virar um **evento de timeline** (ver F1-M1 do lote 08-07: linha do tempo + comentários unificados) OU uma nota — decisão de design no T1.
- **Serviço de eventos/notas:** `sistema-hv/src/lib/notes-service.ts`, `sistema-hv/src/lib/cases-service.ts` (gravam `system_case_events`); `sistema-hv/src/hooks/useTimeline.ts`. O import grava por aqui (não inventar tabela nova de comentário se a timeline já cobrir).
- **Padrão de integração externa server-only com auth:** `sistema-hv/src/lib/projuris/client.ts` (client isolado, segredos de `process.env`/config no banco, nunca no bundle do browser) — **molde** para um `TrelloClient`.
- **Padrão de config de credencial no banco:** `system_distribution_config` guarda as credenciais ProJuris (`projuris_*`) — molde para guardar o token/key do Trello fora do `.env` versionado (incidente de segredos vazados 2026-07-06 — NÃO commitar credencial).
- **Padrão de sync idempotente:** `sistema-hv/src/lib/projuris/judicial-sync.ts` / `sistema-hv/src/lib/distribuicao/sync-core.ts` (leitura idempotente; upsert por chave estável). Molde para o import idempotente de comentários (dedup por ID do comment do Trello).
- **Identificador do caso guardado no banco:** o caso já pode carregar identificadores externos (ver M5 do lote 08-07 = campo do identificador ProJuris na aba Judicial). O **card_id do Trello** segue o mesmo padrão: uma coluna/campo no caso que casa card↔caso.

### NOVO (a construir nesta story — FUTURO)

- **`TrelloClient` (server-only):** wrapper da API REST do Trello (`https://api.trello.com/1/`, auth por `key`+`token`). Métodos de LEITURA: listar boards/cards de um workspace, e `GET /cards/{id}/actions?filter=commentCard` (comentários + data + `memberCreator`).
- **Tabela de vínculo card→caso:** `system_trello_card_links` (`card_id TEXT`, `case_id UUID FK`, `board_id TEXT`, `linked_by`, `active BOOLEAN`, org-scoped) — permite o vínculo manual e desligar por tema/board.
- **Mapa de usuário Trello→system_user:** para atribuir o autor do comentário; fallback = guardar o nome cru do `memberCreator` quando não houver match (o comentário histórico não precisa de FK dura).
- **Rotina de import (idempotente):** para cada card vinculado, puxa os `commentCard` actions, dedup por `action.id` do Trello, grava como evento/nota no caso preservando `date` e `autor`.
- **Espelhamento em tempo real:** webhook do Trello (`POST /webhooks`) OU polling agendado (cron) por board ativo; grava novos comentários no caso. Flag por board para **ligar/desligar** ("tema migrado").

---

## Acceptance Criteria

0. **(SEGUNDA) Resposta de viabilidade ao Thiago:** documentar/registrar que a importação de comentários do Trello via API **é possível** (endpoint `GET /cards/{id}/actions?filter=commentCard` retorna texto+data+autor; Trello Premium permite export/API). Esta é a única entrega de F1 na reunião de segunda — o resto é FUTURO.
1. **Credencial fora do repo:** `key`/`token` do Trello (admin) são lidos de config no banco (molde `system_distribution_config`) ou de env server-only — **nunca** commitados; `TrelloClient` é server-only (não importável no browser).
2. **Leitura de comentários:** `TrelloClient` lista os `commentCard` de um card (`GET /cards/{id}/actions?filter=commentCard`), retornando `{ id, text, date, memberCreator }`. Só LEITURA (fase 1 não escreve no Trello).
3. **Vínculo card→caso (manual):** existe forma de registrar "card X = caso Y" (`system_trello_card_links`), manualmente na UI e/ou pré-preenchido pela importação (F2). Um card sem vínculo não importa comentário para nenhum caso (não adivinha).
4. **Import idempotente:** rodar a importação 2× **não duplica** comentários (dedup por `action.id` do Trello); cada comentário vira um evento/nota no caso preservando **data original** e **autor** (system_user quando casar; senão o nome cru do `memberCreator`).
5. **Espelhamento em tempo real (enquanto ativo):** novos comentários feitos no Trello aparecem no caso (via webhook ou polling agendado) enquanto o board estiver marcado `active`. Latência aceitável para "acompanhar" (não precisa ser instantâneo).
6. **Desligar por tema/board:** um board/tema pode ser marcado como **migrado** → o espelhamento para de rodar para ele (flag `active=false`), sem apagar o histórico já importado.
7. **2ª fase documentada (não implementada):** a story documenta se a API do Trello permite **escrever** comentário (sistema→Trello) para a fase bidirecional futura; a fase 2 NÃO é implementada aqui.
8. **Bloqueio de credencial:** enquanto o Thiago não fornecer login/senha admin do Trello (para gerar key/token), a implementação **não** começa — registrar como dependência externa dura.
9. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; RLS org-scoped nas tabelas novas; nenhum segredo em log/front; import roda server-only.

---

## Tasks / Subtasks

### T0 — (SEGUNDA) Confirmar viabilidade + responder Thiago (@architect)
- [ ] Validar na doc da API Trello o endpoint `GET /cards/{id}/actions?filter=commentCard` (texto+data+autor) e o modelo de auth (key+token, Premium). Registrar a resposta "É POSSÍVEL puxar". (AC-0)

### T1 — Design (@architect + @data-engineer) — depois de segunda
- [ ] Decidir onde o comentário importado é gravado (evento de timeline vs nota) reusando `CaseTimeline`/`notes-service` — alinhar com F1-M1 (linha do tempo + comentários = fluxo único). (AC-4)
- [ ] Migration `system_trello_card_links` (+ rollback) e, se necessário, campo `trello_card_id` no caso. Estratégia de idempotência (dedup por `action.id`). (AC-3, AC-4)

### T2 — TrelloClient (@dev)
- [ ] `sistema-hv/src/lib/trello/client.ts` (server-only, molde `projuris/client.ts`): auth key+token, `listCards(boardId)`, `listCardComments(cardId)`. Testes com fetch mockado. (AC-1, AC-2)

### T3 — Import + vínculo (@dev)
- [ ] `sistema-hv/src/lib/trello/import.ts`: para cada `card_link active`, puxa comentários, dedup, grava evento/nota preservando data+autor; mapa usuário Trello→system_user com fallback. Idempotente. (AC-3, AC-4)
- [ ] UI mínima para vincular card→caso (manual) e listar vínculos. (AC-3)

### T4 — Espelhamento + desligar (@dev + @architect)
- [ ] Webhook (`POST /webhooks`) OU cron de polling por board `active`; flag para marcar board migrado (`active=false`). (AC-5, AC-6)

### T5 — QA (@qa)
- [ ] Import 2× → sem duplicata; data+autor preservados; card sem vínculo não importa; desligar board para o espelho; `typecheck`/`lint` verdes; sem segredo em log. (AC-4..6, AC-9)

---

## Dev Notes

- **Só comentários.** NÃO importar clientes/casos/temas do Trello — a estrutura vem da importação organizada (F2). O Trello está "bagunçado" e importá-lo daria problema (transcrição parte 2).
- **Vínculo manual é aceitável** e provavelmente necessário no começo ("tal card é de tal caso"). Se a importação de dados (F2) já carimbar o identificador do card no caso, reusar esse vínculo em vez de refazer manual.
- **Espelhar até migrar, depois desligar.** O owner quer o Trello espelhado em tempo real enquanto o time ainda o usa (senão "as pessoas vão ficar viciadas e não vão usar o novo"); ao migrar o tema, o Trello morre para ele. Por isso o `active` por board.
- **Fase 2 (bidirecional) é escrita externa** — mesma cautela do H3/ProJuris (escrita externa fica atrás de spike + decisão). O Matheus, na transcrição: *"se eu preencher no sistema, preenche dentro do Trello — não sei se dá, preciso ver na API."*
- **Segredo:** aprender com o incidente de 2026-07-06 (`env` vazado no GitHub) — a key/token do Trello **nunca** vai versionada.
- **Reuso de timeline:** alinhar com F1-M1 do lote 08-07 (linha do tempo + comentários num fluxo só, estilo Trello) — o import do Trello alimenta exatamente esse fluxo unificado.

**Riscos:**
- **R1 — credencial externa (bloqueio):** sem login/senha admin do Trello, não há key/token → nada roda. Dependência dura do Thiago.
- **R2 — vínculo card→caso frágil** se manual em escala; mitigar com pré-carimbo pela F2.
- **R3 — duplicação** se o dedup não usar o `action.id` do Trello.
- **R4 — escrita bidirecional (fase 2)** pode não ser suportada/ser arriscada — manter fora do escopo até spike.

---

## Testing

- **Client (unit):** `listCardComments` monta URL/auth corretos e parseia `{id,text,date,memberCreator}` (fetch mockado, sem rede real).
- **Import:** card vinculado → comentários viram eventos com data+autor originais; rodar 2× → idempotente; card sem vínculo → nada importado.
- **Espelho:** novo comentário no board ativo aparece no caso; board `active=false` → não espelha mais; histórico preservado.
- **Segurança/regressão:** sem segredo em log/front; RLS org-scoped; `typecheck`/`lint` verdes.

## Dependências

- **BLOQUEIO externo (Thiago):** login/senha admin do Trello (gerar key/token). Sem isso, não inicia.
- **F2 (importação de temas)** — opcional, para pré-carimbar o `trello_card_id` no caso e evitar vínculo 100% manual.
- **F1-M1 do lote 08-07** (timeline + comentários unificados) — o import alimenta esse fluxo; alinhar o destino do comentário importado.
- Reusa `CaseTimeline`/`notes-service`/padrão de client server-only do `projuris/client.ts`.

## File List

**A definir na implementação (FUTURO). Previsto:**

**Código (novo):**
- `sistema-hv/src/lib/trello/client.ts` (TrelloClient server-only — leitura).
- `sistema-hv/src/lib/trello/import.ts` (import idempotente + espelho).
- `sistema-hv/src/rpc/trello.ts` (RPCs: vincular card→caso, disparar import, ligar/desligar board — gate admin).
- UI mínima de vínculo/gestão (rota controladoria ou aba do caso).

**Migrations:**
- `sistema-hv/supabase/migrations/2026XXXX_trello_card_links.sql` (+ rollback + `db:types`).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial (FUTURO). Importar comentários do Trello via API (texto+data+autor), vínculo card→caso manual, espelhamento em tempo real com desligar por board, fase 2 (bidirecional) documentada e adiada. Entrega de segunda = só a resposta "é possível puxar". | @sm (Bob) |
