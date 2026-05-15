# 👥 Sprint 3 — Cliente 360° + FIES (parte 1) — Passo a Passo

> **Versão:** 1.0 · **Status:** Pronto para execução
> **Pré-requisitos:** Sprints 1 e 2 ✅ concluídos e validados

---

## 🎯 Objetivo

Implementar **15 telas centrais** do app interno: Painel "Hoje", Cliente 360°, listagens, Pipeline Operacional Kanban, Ficha do Caso. **Onde o produto ganha alma.**

## 📦 Definição de Pronto

- [ ] 15 telas funcionais com fixtures
- [ ] CaseCard pixel-perfect (dois rastros lado a lado)
- [ ] Pipeline Op Kanban com drag-drop acessível
- [ ] Realtime mock (refetch 30s)
- [ ] Filtros URL persistentes (nuqs)
- [ ] Empty/error/loading states
- [ ] Performance: pipeline com 200 casos renderiza < 1s

---

## 📋 Passo a passo

### ÉPICO A — Fixtures expandidas (Passos 1-3)

**Passo 1 · Expandir `@hv/mocks` fixtures**
- 50 clientes (5x mais que Sprint 1)
- 200 casos FIES (todos os macrostatus operacionais cobertos)
- 80 casos outros tipos
- 500 eventos timeline distribuídos
- Cron seed determinístico (faker seed 42)

**Passo 2 · Schemas Zod expandidos em `@hv/api-client`**
- `caso.ts`: macrostatusOperacional enum, macrostatusFinanceiro enum, fiesData jsonb, etc.
- `evento.ts`: tipo, actor, payload, timestamp
- `documento.ts`: status, hash, ocr_text

**Passo 3 · Handlers MSW expandidos**
- `casos.handlers.ts`: GET list (paginated, filtered), GET by id, PATCH macrostatus
- `eventos.handlers.ts`: GET por case_id
- `documentos.handlers.ts`: GET por case_id

### ÉPICO B — Painel "Hoje" (Passo 4)

**Passo 4 · `/hoje`**
- 4 seções: Urgente (🔴), Hoje (🟡), Próximos (🔵), Conquistas (🟢)
- Header Playfair: "Bom dia, {nome} 👋"
- Realtime: TanStack Query com `refetchInterval: 30_000`
- Empty state: "Tudo limpo por hoje 🌿"
- Skeleton on load

**Stories componentes:**
- `<TaskCardCompact />` (urgente)
- `<TaskCardDefault />` (hoje)
- `<AchievementCard />` (conquistas — verde sutil)

### ÉPICO C — Clientes (Passos 5-9)

**Passo 5 · `/clientes` (lista)**
- DataTable do design system
- Colunas: avatar, nome, CPF mascarado, CRM, # casos ativos, último contato, ações
- Filtros: status, programa (FIES/Mais Médicos/etc.), UF
- Busca: fuzzy em nome/CPF/email (URL state via nuqs)
- Densidade toggle
- Empty state: "Importar do Excel?" → CTA

**Passo 6 · `/clientes/novo` (wizard)**
- Step 1: Tipo (PF/PJ) — radio cards visuais
- Step 2: Dados básicos (nome, CPF/CNPJ, contato)
- Step 3: Profissional (CRM, programa, vínculo)
- Step 4: Confirmação
- Validação Zod por step
- Persistência draft em sessionStorage

**Passo 7 · `/clientes/[id]` (Cliente 360°) — Layout**
- Parallel routes do Next.js: `@casos`, `@documentos`, `@timeline`, `@financeiro`, `@comunicacao`
- Header sticky: avatar + nome (Playfair) + identificação + alertas + ações rápidas
- Tabs navegação (underline gold)
- AlertStrip se inadimplente

**Passo 8 · Cliente 360 — Aba Casos**
- Lista de cards `CaseCard` (componente core, ver Passo 11)
- Cada caso mostra **dois rastros lado a lado**
- Filtro "Apenas ativos" toggle

**Passo 9 · Cliente 360 — Outras 4 abas**
- Documentos: grid `DocumentRow` agrupado por caso
- Timeline: `TimelineFeed` consolidado (eventos de todos os casos)
- Financeiro: tabela parcelas + snapshot Termo viewer
- Comunicação: lista threads WhatsApp + e-mails

### ÉPICO D — Casos & Pipeline (Passos 10-13)

**Passo 10 · `/casos` — Pipeline Operacional**
- `PipelineBoard` (componente do Sprint 2) com 10 colunas:
  - ONBOARDING, TRIAGEM, DOCS_PENDENTES, DGM_ENVIADA, PRONTO_PROTOCOLO, ACOMPANHAMENTO_ADM, JUDICIAL_OPERACIONAL, IMPLANTADO, ENCERRADO_OPERACIONAL, CANCELADO
- Toolbar: filtros, view toggle (Kanban|Lista), densidade, +Novo caso
- Filtros URL state (nuqs): tipo_caso, banco, UF, advogado, SLA, origem
- Realtime: refetch a cada 30s
- Performance: virtual scroll em colunas com 50+ casos

**Passo 11 · `<CaseCard />` componente**

```tsx
// packages/ui/src/components/composites/CaseCard.tsx
export interface CaseCardProps {
  caso: Caso;
  variant?: "compact" | "default" | "expanded";
}

export function CaseCard({ caso, variant = "default" }: CaseCardProps) {
  return (
    <Card variant="interactive" className="cursor-pointer">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-navy">{caso.codigo}</span>
        <Badge variant="navy">{caso.tipoSubcaso}</Badge>
        <Badge variant="neutral">{caso.origem}</Badge>
        <span className="text-xs text-fg-muted">{caso.municipio}</span>
        {caso.flagJudicialOperacional && <span>⚖</span>}
        {caso.flagJudicialFinanceiro && <span>💰</span>}
      </div>

      {/* Identificação cliente */}
      <p className="mt-2 text-sm font-medium">{caso.cliente.nome}</p>
      <p className="text-xs text-fg-muted">CRM {caso.cliente.crm} · CPF ***...{caso.cliente.cpfMasked}</p>

      {/* Dois rastros */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <RastroBlock label="OPERACIONAL" status={caso.macrostatusOperacional} ... />
        <RastroBlock label="FINANCEIRO" status={caso.macrostatusFinanceiro} ... />
      </div>

      {/* Rodapé alertas */}
      <div className="mt-3 flex items-center gap-3 text-xs text-fg-muted">
        {alertas.map(a => <span key={a}>⚠ {a}</span>)}
        <span>📎 {caso.docsCount} docs</span>
        <span>💬 {caso.msgsCount}</span>
        <span className="ml-auto text-navy">Abrir →</span>
      </div>
    </Card>
  );
}
```

**Passo 12 · `/casos/[id]` — Ficha do Caso**
- Header: código + badges + alertas + ações rápidas (lateral)
- 2 rastros lado a lado em grid 2-col
- Tabs: Visão | Docs | Timeline | Financeiro | Comunicação | Auditoria
- Cada tab usa Suspense para streaming

**Passo 13 · `/casos/lista` — View tabular alternativa**
- DataTable com mesmas colunas + macrostatus pill
- Toggle entre Kanban e Lista preserva filtros

### ÉPICO E — Tarefas (Passo 14)

**Passo 14 · `/tarefas`**
- Lista pessoal (atribuídas ao user logado)
- Variante `/tarefas/equipe` para gestores
- Filtros: status, priority, due date
- Bulk actions: aceitar múltiplas

### ÉPICO F — Polish + Performance (Passo 15)

**Passo 15 · Otimizações**
- Virtual scroll em listagens grandes (@tanstack/react-virtual)
- Image optimization
- Skeleton matching exato do layout
- Suspense boundaries por aba do Cliente 360
- Pre-fetch hover em Links

---

## ✅ Validação multi-agente

### @pm
- [ ] 15 telas funcionais com fixtures
- [ ] Demo: criar cliente → criar caso → mover no pipeline → abrir Cliente 360

### @architect
- [ ] Parallel routes funcionando em Cliente 360
- [ ] nuqs URL state em todas listagens
- [ ] TanStack Query keys consistentes
- [ ] Suspense streaming em RSC

### @ux-design-expert
- [ ] CaseCard pixel-perfect (dois rastros)
- [ ] Pipeline Kanban com drag-drop fluido + gates visuais
- [ ] Loading states matching layout (não spinners genéricos)
- [ ] Empty state Clientes com CTA "Importar do Excel"

### @qa
- [ ] Performance: pipeline com 200 casos < 1s render
- [ ] Drag-drop funcional + acessível por teclado
- [ ] Filtros URL persistem em refresh
- [ ] E2E: criar cliente → criar caso → mover entre colunas

### skill `frontend-design`
- [ ] Densidade controlada (não overload)
- [ ] Hierarquia visual clara
- [ ] Microinterações no drag-drop

### skill `web-design-guidelines`
- [ ] axe verde em todas as 15 telas
- [ ] Drag-drop com ARIA live regions

---

## ⏱ Estimativa

**10-14 dias úteis** · _Em sessão Claude: 5-7 sessões_

---

> _Próximo:_ **Sprint 4 — FIES (parte 2) + Controladoria**
> _— Orion, orquestrando o sistema 🎯_
