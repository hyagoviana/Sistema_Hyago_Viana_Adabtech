# 📚 Sprints — Índice

> **Fase F2 — Construção do Design System & Frontend Mock-First**
> 8 sprints sequenciais. Validação multi-agente obrigatória entre sprints.

---

## 📋 Índice dos sprints

| # | Sprint | Foco | Telas | Estimativa | Status |
|---|---|---|---|---|---|
| **1** | [Fundação Técnica](./sprint-01-fundacao-tecnica.md) | Monorepo + tokens + 3 apps + login mock + Storybook | 1-2 | 5-8d | ⏳ Próximo |
| **2** | [Design System Core](./sprint-02-design-system-core.md) | ~50 componentes (primitives + layout + display + composites) | 0 | 8-12d | ⏳ |
| **3** | [Cliente 360° + FIES (1)](./sprint-03-cliente-360-fies-1.md) | Painel Hoje, Cliente 360, Pipeline Op, Ficha Caso | 15 | 10-14d | ⏳ |
| **4** | [FIES (2) + Controladoria](./sprint-04-fies-2-controladoria.md) | Pipeline Fin, Termo Wizard, Centro Exceções, Teses, Decisões | 15 | 10-12d | ⏳ |
| **5** | [Peticionamento + Comercial](./sprint-05-peticionamento-comercial.md) | Editor minutas (streaming), CRM Kanban, Cross-sell | 15 | 10-14d | ⏳ |
| **6** | [Marketing + WhatsApp](./sprint-06-marketing-whatsapp.md) | Calendário editorial, Chat WhatsApp, Handoff | 10 | 8-10d | ⏳ |
| **7** | [Portal + Painel](./sprint-07-portal-painel.md) | Portal mobile-first, Painel institucional | 20 | 10-12d | ⏳ |
| **8** | [Polish + A11y + Handoff](./sprint-08-polish-handoff.md) | Microinterações, performance, testes, docs, handoff | 0 | 8d | ⏳ |

**Total:** ~75 dias úteis (esticável conforme disponibilidade) · ~115 telas

---

## 🤝 Ritual de Validação Multi-Agente

> **Obrigatório ao fim de CADA sprint antes do próximo começar.**

```
@pm           valida stories/ACs
@architect    valida decisões técnicas
@ux-design    valida pixel-perfect contra PRD 0
@qa           executa Definition of Done + axe + Lighthouse
skill `frontend-design`         anti-AI-slop check
skill `web-design-guidelines`   WCAG 2.2 AA audit
```

Todos os 6 precisam aprovar antes do próximo sprint começar.

---

## 📐 Definição de Pronto Global (toda story de todo sprint)

- Código: CI verde (lint + typecheck + vitest), 0 `any`, 0 `console.log`
- Design: Stories no Storybook, pixel-perfect, responsivo, microinterações
- Acessibilidade: axe-core zero violations critical/serious, teclado funcional
- Performance: bundle não cresce >10% sem justificativa, Lighthouse ≥ 85
- Documentação: comentários no "porquê", README atualizado, changelog
- Validação multi-agente: 6 ✓

Detalhamento completo em [sprints-plan.md](../sprints-plan.md) §12.

---

## 🚀 Pré-requisitos antes de iniciar Sprint 1

- [ ] Node.js 20.18+ instalado
- [ ] pnpm 9.12+ instalado
- [ ] Git instalado
- [ ] PRDs aprovados pelo Hyago ✅
- [ ] Sprints plan aprovado pelo Hyago ✅
- [ ] Pasta `sistema-hv/` ainda não criada (será o primeiro passo do Sprint 1)

---

## 🔗 Documentos relacionados

- [`docs/sprints-plan.md`](../sprints-plan.md) — Plano consolidado dos 8 sprints (visão de alto nível)
- [`docs/architecture/frontend-architecture.md`](../architecture/frontend-architecture.md) — Plano técnico do @architect
- [`docs/prd/00-ux-design-system.md`](../prd/00-ux-design-system.md) — Design Bible v1.2

---

> _— Orion, orquestrando o sistema 🎯_
