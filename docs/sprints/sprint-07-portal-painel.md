# 📱 Sprint 7 — Portal Cliente + Painel Institucional — Passo a Passo

> **Versão:** 1.0 · **Status:** Pronto para execução
> **Pré-requisitos:** Sprints 1-6 ✅ concluídos e validados

---

## 🎯 Objetivo

Implementar **apps `portal/` (mobile-first) e `painel/` (institucional)** completos.

## 📦 Definição de Pronto

- [ ] Portal: 14 telas mobile-first
- [ ] Painel: 6 telas desktop/tablet
- [ ] Aceite Termo com 2FA mock
- [ ] Bottom nav portal funcional
- [ ] Mapa institucional com pins por estado
- [ ] Lighthouse mobile Portal ≥ 90

---

## 📋 Passo a passo

### BLOCO A — Portal do Cliente (Passos 1-9)

> **Princípio:** mobile-first. Tudo desenhado primeiro para 360px e cresce até desktop.

#### Passo 1 · Setup `apps/portal/`
- Layout root sem sidebar
- TopBar simplificada (logo + nome + sino + perfil)
- Bottom nav fixed (5 ícones: 🏠 Casos, 📂 Docs, 💳 Boletos, 💬 Mensagens, 👤 Perfil)
- Theme idêntico ao interno (mesmo `@hv/ui` + tokens)
- MSW separado: handlers que retornam apenas dados do cliente logado

#### Passo 2 · Telas de auth Portal
- `/entrar` — login (email/CPF + senha + magic link)
- `/recuperar` — recovery
- `/primeiro-acesso/:token` — set password + LGPD banner obrigatório

Form premium: logo HV grande, copy claro, touch targets ≥ 44px.

#### Passo 3 · `/` — Home (visão geral)
- Header: "Olá, Dr. {nome}" com sino + perfil
- Card "Seus casos ({n})" — lista de cards verticais
- Cada card: tipo simplificado + status em **linguagem do cliente** ("Aguardando resposta do Ministério") + CTA "Ver detalhes →"
- Seção "Pendências":
  - 📎 N docs pendentes (link)
  - 💳 N boletos em aberto (link)
  - 💬 N mensagens (link)

#### Passo 4 · `/casos/[id]` — Caso simplificado
- Header: tipo + status em linguagem cliente
- Próxima ação em destaque
- Mini timeline (últimas 5 eventos)
- "Você precisa fazer algo?" (se docs pendentes)
- Mapping de macrostatus → linguagem cliente:
  ```ts
  const labels = {
    DOCS_PENDENTES: "Aguardando alguns documentos seus",
    DGM_ENVIADA: "DGM enviada à prefeitura, aguardando assinatura",
    ACOMPANHAMENTO_ADM: "Aguardando resposta do Ministério da Saúde",
    IMPLANTADO: "Tudo certo! Abatimento implantado",
    ...
  };
  ```

#### Passo 5 · `/documentos` + `/documentos/upload`
- Lista: pendentes (vermelho) + recebidos (verde)
- Upload mobile-first:
  - Tirar foto (câmera) ou escolher da galeria
  - Crop opcional
  - Preview antes de enviar
  - Confirmação visual

#### Passo 6 · `/boletos` + `/boletos/[id]`
- Lista: abertos (top) + pagos (collapsed)
- Card boleto: valor + vencimento + status + ações [Baixar PDF] [Copiar Pix]
- Detalhe: QR Code Pix grande + linha digitável copyable

#### Passo 7 · `/mensagens` + `/mensagens/[thread]`
- Lista threads (WhatsApp histórico + portal)
- Detalhe: chat similar ao app interno mas simplificado
- Composer com câmera/áudio/arquivo

#### Passo 8 · `/termos` + `/termos/[id]/aceitar` — **TELA CRÍTICA**

Tela aceitar:
- Header: "Termo de Acerto v{n}"
- PDF viewer inline (pdf.js ou iframe)
- Pinch-to-zoom mobile
- Resumo de valores (destacado)
- Checkbox obrigatório "Li o documento completo e estou de acordo"
- Botão "Aceitar Termo" **desativado** até checkbox marcado **E** 2FA validado
- Modal 2FA: código 6 dígitos (SMS mock)
- Após aceite: tela de sucesso + evidência (timestamp + IP + UA registrados)

#### Passo 9 · `/perfil` + `/perfil/privacidade`
- Perfil: dados básicos editáveis
- Privacidade: opções LGPD (revogar consents, baixar dados, solicitar exclusão)

### BLOCO B — Painel Institucional (Passos 10-13)

> **Stakeholders:** ANMR, AMPB. Dados agregados anonimizados.

#### Passo 10 · Setup `apps/painel/`
- Layout: TopBar institucional + nav horizontal (não sidebar)
- Theme idêntico mas com branding ANMR/AMPB customizado opcional via subdomain/query
- Auth dedicada (`inst_partner` role)

#### Passo 11 · `/` — Dashboard agregado
- KPIs grandes:
  - Total de associados representados
  - Total de casos no escritório
  - Taxa de êxito (TOTAL+PARCIAL / total encerrados)
  - Valor total recuperado
- Sparklines tendência 12 meses

#### Passo 12 · `/associados` — Mapa
- Mapa do Brasil (react-simple-maps) com pins por estado
- Tooltip ao hover: N associados, taxa êxito UF
- Lista lateral com top 10 estados

#### Passo 13 · `/demandas`, `/resultados`, `/relatorios`
- Demandas: gráficos de distribuição por tipo (pie + bar)
- Resultados: cohort de implantações por ano
- Relatórios: lista de PDF exports gerados (mock) + botão "Gerar novo"

---

## ✅ Validação multi-agente

### @pm
- [ ] Portal: 14 telas mobile-first funcionais
- [ ] Painel: 6 telas operando com dados agregados mock
- [ ] Demo mobile real (testar em smartphone)

### @architect
- [ ] Apps isolados (sem compartilhar fixtures sensíveis)
- [ ] RLS-like mock no Portal (cliente só vê próprios dados)
- [ ] Painel: anonimização visível (sem CPF/nomes)

### @ux-design-expert
- [ ] Bottom nav portal sempre acessível
- [ ] Touch targets ≥ 44px verificados
- [ ] Linguagem cliente sem jargão jurídico
- [ ] 2FA aceite Termo intuitivo
- [ ] Mapa institucional bonito (não amador)

### @qa
- [ ] Lighthouse mobile Portal ≥ 90 (Performance + A11y)
- [ ] Câmera funciona em iOS Safari + Android Chrome
- [ ] PDF viewer responsivo
- [ ] Aceite Termo: 2FA obrigatório enforçado em UI

### skill `frontend-design`
- [ ] Portal não parece "interno simplificado" — tem identidade própria preservando HV
- [ ] Painel institucional premium (não tipo dashboard Power BI)

### skill `web-design-guidelines`
- [ ] Touch targets, contraste mobile validados
- [ ] Foco visível em mobile (tap)
- [ ] Sem hover-only interactions

---

## ⏱ Estimativa

**10-12 dias úteis**

---

> _Próximo:_ **Sprint 8 — Polish + A11y + Performance + Handoff**
> _— Orion, orquestrando o sistema 🎯_
