# Review de Planejamento — MVP-Drive

> Validação da quebra de stories, estimativas, dependências e capacidade.
> **Revisor:** Tarek (PM) · **Data:** 2026-05-21 · **Versão revisada:** v1.0

---

## 🟢 Veredito geral

**APROVADO COM AJUSTES.**

Plano coerente, estimativas realistas se o dev for fulltime e Hyago disponível como PO. Quebra de stories funcional mas com 3 oportunidades de re-arranjo.

**2 BLOCKERs** (alinhar antes de começar).
**6 SHOULD-FIX** (refinar antes do kickoff).
**4 NICE-TO-HAVE**.

---

## 🚫 BLOCKERs

### BLOCKER-P1 — Capacidade do dev não declarada

**Problema:** Estimativas (12d total) pressupõem **1 dev fulltime**. Não está documentado quem implementa.

**Cenários:**
- Se Hyago contratar dev junior: dobrar prazo (24d)
- Se dev senior fulltime: 12d realista
- Se dev part-time (~4h/dia): ~18d
- Se Claude Code + humano revisor: 8-10d (Claude codifica rápido, mas testes/QA manual demandam pessoa)

**Ação:** Hyago confirmar com Orion quem implementa antes do kickoff. Ajustar prazos.

---

### BLOCKER-P2 — Disponibilidade do PO (Hyago) não combinada

**Problema:** Durante a sprint, dev terá dúvidas:
- "Pasta no Drive: organizar por mês? por tipo? por área?"
- "Telefone obrigatório ou opcional?"
- "Cliente PJ tem campos diferentes de PF?"

Sem PO disponível em ~30min/dia → bloqueios frequentes.

**Ação:**
- Combinar **daily 15min** Hyago + dev às 09h00
- Canal Slack/WhatsApp para dúvidas async
- Hyago aprova UI no fim de cada story (5min screenshot review)

---

## ⚠️ SHOULD-FIX (refinar)

### SHOULD-P1 — Story 2.1 (Zod validators) é tarefa técnica, não user story

**Atual:** Story formal com "Como developer / Quero / Para".

**Recomendado:** Re-rotular como **Tarefa Técnica 2.0** (preparatória), antes das stories user-facing. Adiciona clareza.

Story user-facing começa em 2.2 (UI lendo dados reais).

---

### SHOULD-P2 — Stories 2.5 e 2.6 podem ser uma só

**Atual:**
- Story 2.5: UI listagem (1d)
- Story 2.6: UI ficha (0.5d)

**Recomendado:** Mesclar em **Story 2.5 — UI Clientes (listagem + ficha) (1.5d)**. Reduz overhead de PR e validação.

---

### SHOULD-P3 — Story 3.4 muito gorda (2d)

**Atual:** Story 3.4 cobre drag-drop + listagem + download + delete em 2d.

**Recomendado:** Quebrar:
- **3.4a — UI: drag-drop upload + listagem (1d)**
- **3.4b — UI: ações (download + delete + confirmações) (0.5d)**

Permite gate intermediário no QA. Reduz risco de PR gigante.

---

### SHOULD-P4 — Falta cerimônia de sprint definida

**Atual:** Stories detalhadas, mas nenhuma cerimônia descrita.

**Recomendado adicionar ao `README.md`:**

| Cerimônia | Duração | Frequência | Participantes |
|---|---|---|---|
| Kickoff sprint | 30min | 1x no início | Hyago, Dev, Orion, Aria, Tarek, Quinn |
| Daily sync | 15min | Diário | Hyago, Dev |
| Story review | 10min | Por story | Hyago, Dev |
| Sprint review | 30min | 1x no fim | Todos |
| Retro rápida | 15min | 1x no fim | Hyago, Dev |

Total cerimônias: ~3h/sprint — aceitável.

---

### SHOULD-P5 — Ordering de dependências não explícito

**Atual:** Sprint MVP-1 lista 4 stories mas não diz "1.1 → 1.2 → 1.3 → 1.4".

**Recomendado:** Adicionar diagrama de dependência:

```
Sprint MVP-1:
  1.1 (Schema) ─┐
                ├──► 1.4 (Smoke test)
  1.2 (SB client) ─┤
                   │
  1.3 (Drive helper) ─┘

Sprint MVP-2:
  2.0 (Zod validators) ──► 2.2 (Hook) ──► 2.3 (POST route) ──┐
                                          2.4 (PATCH/DEL) ──┴──► 2.5 (UI)

Sprint MVP-3:
  3.1 (POST upload) ──► 3.2 (GET download) ──► 3.3 (DELETE) ──► 3.4a (UI upload) ──► 3.4b (UI ações)
```

---

### SHOULD-P6 — Falta "Buffer" nas estimativas

**Atual:** 12d total é o tempo de codificação puro. Sem buffer para:
- Bugs achados em QA (retrabalho)
- Feedback do Hyago em UX (ajustes)
- Discovery de edge cases

**Recomendado:** Adicionar 20% buffer:
- MVP-1: 3-4d → **4-5d** (com buffer)
- MVP-2: 3-4d → **4-5d** (com buffer)
- MVP-3: 4-5d → **5-6d** (com buffer)
- **Total: ~13-16 dias úteis** (~3 semanas calendário)

---

## 💡 NICE-TO-HAVE

| # | Item |
|---|---|
| NTH-P1 | Burndown chart simples (uma planilha) para visualizar progresso |
| NTH-P2 | Demo de fim de sprint gravada (vídeo 5min) — Hyago revê quando puder |
| NTH-P3 | Definição de "P0/P1/P2" para bugs (já no test plan) |
| NTH-P4 | Template de PR padronizado |

---

## 📊 Análise de capacidade

### Cenário 1 — Dev senior fulltime (recomendado)

| Sprint | Estimativa nominal | Com buffer | Calendário |
|---|---|---|---|
| MVP-1 | 3-4d | 4-5d | Semana 1 |
| MVP-2 | 3-4d | 4-5d | Semana 2 |
| MVP-3 | 4-5d | 5-6d | Semana 3 |
| **TOTAL** | **10-13d** | **13-16d** | **3 semanas** |

### Cenário 2 — Claude Code + Hyago como revisor

- Codificação Claude: rápida (talvez 6-8d)
- QA manual + validação Hyago: 4-5d
- Overhead handoffs: 2d
- **Total estimado: 12-15d (3 semanas)**

### Cenário 3 — Dev part-time (4h/dia)

| Sprint | Estimativa fulltime | Part-time (x1.8) |
|---|---|---|
| MVP-1 | 4d | 7d |
| MVP-2 | 4d | 7d |
| MVP-3 | 5d | 9d |
| **TOTAL** | **13d** | **~23 dias** (4.5 semanas) |

---

## 🎯 Acceptance Criteria — análise

Maioria está **SMART** (Specific, Measurable, Achievable, Relevant, Time-bound). Algumas observações:

| Story | AC | Análise |
|---|---|---|
| 1.1 #1 "Migration roda sem erros" | ✅ SMART | OK |
| 1.3 #1 "createFolder cria pasta visível no Drive" | ⚠️ "visível" subjetivo | Especificar: "API retorna `id` válido + folder aparece em `files.list()`" |
| 2.5 #5 "Layout Lovable preservado pixel-a-pixel" | ⚠️ Difícil mensurar | Sugerir: "Screenshot diff < 5px em viewport 1440x900" — ou aceite visual do Hyago |
| 3.1 #5 "SHA-256 calculado e gravado" | ✅ SMART | OK |
| 3.4 #5 "Mensagem clara se arquivo > 20MB" | ⚠️ "clara" subjetivo | Especificar texto: "Arquivo excede o limite de 20MB. Tente comprimir." |

**Ação:** Refinar 3-4 AC para serem mensuráveis (Quinn pode complementar no test plan).

---

## 🗓️ Cronograma sugerido (Cenário 1)

```
Semana 1 (Sprint MVP-1):
  Seg: Kickoff + Story 1.1 (schema)
  Ter: Story 1.1 conclusão + Story 1.2 (SB clients)
  Qua: Story 1.3 (Drive helper)
  Qui: Story 1.3 + Story 1.4 (smoke test)
  Sex: Gate MVP-1 + buffer

Semana 2 (Sprint MVP-2):
  Seg: Kickoff + Story 2.0 (Zod) + 2.2 (hook)
  Ter: Story 2.3 (POST)
  Qua: Story 2.4 (PATCH/DEL)
  Qui: Story 2.5 (UI)
  Sex: Gate MVP-2 + buffer

Semana 3 (Sprint MVP-3):
  Seg: Kickoff + Story 3.1 (upload)
  Ter: Story 3.2 (download)
  Qua: Story 3.3 (delete) + 3.4a início
  Qui: Story 3.4a conclusão + 3.4b
  Sex: Gate MVP-3 + Sprint Review + Retro

Semana 4:
  Buffer / hotfixes / deploy preview Vercel
```

---

## 📋 Definition of Ready (Stories prontas pra começar)

Antes de cada story entrar em "in progress", verificar:

- [ ] AC SMART (específicos e mensuráveis)
- [ ] Dependências resolvidas (story anterior em "done")
- [ ] Mock-ups / wireframes disponíveis (se UI) — usar Lovable existente
- [ ] Hyago disponível para tirar dúvidas
- [ ] Branch criada com nome convencional: `feat/mvp-drive-{sprint}-{story-id}`

---

## ✅ Ações requeridas (consolidadas)

**Antes do Sprint MVP-1 começar:**

- [ ] **BLOCKER-P1:** Hyago define quem implementa (dev humano? Claude? combo?)
- [ ] **BLOCKER-P2:** Combinar daily 15min Hyago + dev
- [ ] **SHOULD-P5:** Adicionar diagrama de dependência aos 3 sprint docs
- [ ] **SHOULD-P6:** Atualizar estimativas com buffer (13-16d total)
- [ ] **SHOULD-P4:** Documentar cerimônias no `README.md` do MVP-Drive

**Durante a execução:**

- [ ] **SHOULD-P1:** Re-rotular Story 2.1 como "Tarefa Técnica 2.0"
- [ ] **SHOULD-P2:** Mesclar Stories 2.5 + 2.6
- [ ] **SHOULD-P3:** Quebrar Story 3.4 em 3.4a + 3.4b
- [ ] Refinar 3-4 acceptance criteria vagos (alinhar com Quinn)

**Aprovação:** Após resolver BLOCKERs, plano fica **pronto para execução**.

---

— Tarek, PM 📊
