# Épico — Reunião 2026-08-05 (Thiago × Adavio): Melhorias + Motor ProJuris

Origem: transcrições `Adavio Tittoni [0000] É, estamos no.txt` (demo longa) + `Impromptu Google Meet Meeting - August 05.txt` (ACTION ITEMS do Fathom). Levantamento-fonte: [`docs/reunioes/levantamento-2026-08-05-melhorias-e-motor-projuris.md`](../../reunioes/levantamento-2026-08-05-melhorias-e-motor-projuris.md). Stories redigidas pelo @sm (Bob) via esquadrão em 2026-08-05.

> **Não há story para os itens já 100% prontos** (A1, A8, C1, C2, D1–D3, E3, F4-infra, H8/H9 — ver levantamento). Estas 24 stories cobrem só o que exige trabalho (NOVO / PARCIAL / BUG).

---

## Trilha 1 — Produto / UX (campos, kanban, lista, módulos)

| ID | Título | Est. | Risco | Depende de |
|----|--------|------|-------|-----------|
| [A7](A7-bug-campo-duplicado-entre-temas.md) | 🐛 Campo "duplicado" entre temas bloqueava criação | M | Médio (regressão) | — |
| [A2](A2-filtro-multi-valor.md) | Filtro multi-valor em campos de seleção | M | Médio | — |
| [A3](A3-municipio-texto-livre-teto-opcoes.md) | Município texto-livre + teto de opções em selects | S | Baixo | — |
| [A6](A6-reordenar-opcoes-drag-drop.md) | Reordenar opções de lista/menu (setas ↑↓ / DnD) | M | Baixo | — |
| [A5](A5-campo-multilinha-botao-add.md) | Campo multi-linha com botão "+" | M | Baixo | — |
| [A4](A4-campos-dependentes-pai-filho.md) | Campos dependentes pai→filho (máx 3 níveis/filhos) | L | Médio/Alto | — |
| [E1](E1-lista-ocultar-colunas-e-ordem.md) | Lista: ocultar colunas + ordem Tema→Tipo | S/M | Baixo | — |
| [C4](C4-popup-selecao-kanban.md) | Pop-up de seleção de Kanban ao entrar no tema | M | Baixo | A3-lote-anterior (boards) |
| [C3](C3-rastro-operacional-multi-kanban.md) | Rastro operacional mostra TODOS os kanbans do caso | M/L | Médio | A3-lote-anterior (boards) |
| [C5](C5-links-uteis-wiki-por-tema.md) | Links úteis/wiki por tema (admin) | M | Baixo | C4 (mesma entrada do tema) |
| [B1](B1-campo-cliente-espelhado-no-caso.md) | 🎯 Campo do cliente espelhado no caso (bifurcação) | XL | Médio/Alto | — |
| [B3](B3-gate-admin-criacao-campos.md) | Gate admin p/ criar campos (cobre I3) | M | Baixo | — |
| [I1](I1-tela-dedicada-campos-personalizados.md) | Tela dedicada de Campos Personalizados (Config) | M | Baixo | B1, B3 |
| [F1](F1-financeiro-modulo-submenu.md) | Financeiro como módulo/submenu isolado (F1–F4) | L | Médio | — |
| [J2](J2-ajuste-dados-mais-medicos.md) | Ajuste dados Mais Médicos (nome do caso + CPF) | S/M | Baixo | A8-lote-anterior |

## Trilha 2 — Motor ProJuris / Distribuição + Judicial

> Nota de escopo: **o motor v1.0 JÁ EXISTE** (`src/lib/distribuicao/` + `src/lib/projuris/` + 13 rotas `controladoria.distribuicao.*` + tabelas `system_distribution_*`). Estas stories fecham integração e UX de operação — **não** reconstroem o motor. A auth do ProJuris já foi destravada (ver A9 do lote 08-03, change log v0.5).

| ID | Título | Est. | Risco | Depende de |
|----|--------|------|-------|-----------|
| [H11](H11-config-auth-sync-core.md) | Ligar config auth (base_url/auth_type) ao sync-core | S/M | Baixo | — |
| [H5](H5-usuario-id-projuris-flag-distribuicao.md) | ID ProJuris + flag "participa da distribuição" no usuário | M | Baixo/Médio | — |
| [H1](H1-projuris-id-para-nome.md) | Mapear ID→nome (executor/tipo/processo) | M | Médio | H5 |
| [H4](H4-resolve-tema-inteligente.md) | `resolveTema()` inteligente (de-para assunto→theme_id) | M | Médio | — |
| [H6](H6-menu-config-tipos-tarefa.md) | Menu config Tipos de Tarefa interno (cobre H6+H7+I2) | M/L | Médio | — |
| [H2](H2-tela-aprovacao-distribuicao.md) | Tela aprovar/rejeitar/editar + regra aplicada (H10) | L | Médio/Alto | H1 |
| [H3](H3-writeback-projuris.md) | ⚠️ Writeback ao ProJuris (escrita em produção) | XL | ALTO | H2 |
| [G1](G1-judicial-submenu-espelho-projuris.md) | Submenu Judicial espelhando ProJuris (G1–G3+G5) | L | Médio | H11 |
| [G4](G4-campo-sigiloso-gate-visibilidade.md) | Campo "sigiloso" + gate de visibilidade por caso | M | Médio | G1 |

---

## Ordem sugerida de execução

**Trilha 1 (paralela à 2):** A7 → A2 → A3 → A6 → A5 → A4 → E1 → C4 → C3 → C5 → B1 → B3 → I1 → F1 → J2.
Racional: começa pelo BUG (A7) e ganhos rápidos de campo/filtro; A4 (campos dependentes) é a única de migração pesada da leva de campos; B1 é o pedido grande (fazer depois que A2/A4 estabilizarem a infra de campos); I1 depende de B1+B3; F1 e J2 são independentes.

**Trilha 2:** H11 → H5 → H1 → H4 → H6 → H2 → **H3** (só depois de H2 aprovado e dry-run validado) → G1 → G4.
Racional (do levantamento H.2): destravar operação sem `.env` (H11) + executor no usuário (H5) → nada é rastreável sem ID→nome (H1); resolveTema (H4) e config de tipos (H6) alimentam o mapping; H2 (aprovação) permite operar seguro em simulação; **H3 (writeback) é o último** — vira de simulação p/ produção só após piloto com o Thiago. Judicial (G1/G4) consome o espelho do ProJuris.

## Decisões do owner travadas (ver stories)
- **A4:** dependência definida na criação (checkbox "dependente" + escolher o pai); máx. 3 níveis e 3 filhos; filho só preenche se o pai estiver preenchido.
- **B1:** bifurcação — o campo do cliente é a fonte única; "vincular a tema(s)" cria/liga o mesmo campo como filtro nas pipelines escolhidas; editar em qualquer tema grava no cliente e reflete nos demais.
- **C4:** pop-up (quadradinhos por board), **não** "página do meio"; entra direto se o tema só tem 1 Kanban.
- **F/G:** financeiro e judicial viram **módulos/submenus isolados** dentro do caso; timeline do operacional não mistura eventos deles; comentários próprios só p/ quem tem acesso.
- **G4:** campo "sigiloso" no caso → judicial só visível a usuários autorizados (gate no servidor, não só UI).
- **H (ProJuris):** D1 = ProJuris é a fonte da verdade (SHV espelha); writeback (H3) é fase controlada, com dry-run + confirmação humana; a lista de distribuição é a **etapa final** (aprovar/editar), a regra é decidida internamente pelo motor.

## Bloqueios externos (Dr. Thiago)
- Lista de campos que aparecem em *elaborando*, *rastros* e *página Judicial*.
- Códigos ProJuris de tipos/temas + relatório de intimações (parte já descoberta via API no A9).
- Preencher CPF dos casos Mais Médicos importados (J2).
- Fechar modelagem ContaAzul (ERP-fonte financeiro permanece).

## Divergências/achados registrados pelo esquadrão (revisar no kickoff)
- **A7:** duas validações — índice único por-tema (correto) vs `findClientBucketKeyConflict` (global, roda só p/ `scope='cliente'`) = causa provável.
- **B1:** infra parcial já existe (`scope='cliente'` grava no balde `system_clients.custom_fields`); story adiciona vínculo por tema.
- **G4:** `system_cases` NÃO tem campo sigiloso hoje (mais próximo: `tem_pendencia_judicial`); gate é **por-caso**, `requireModule` é insuficiente → helper novo.
- **H3:** o alerta real é `ALT-SYNC-001` (o levantamento citou `ALT-RESP-005`); `results` é imutável por trigger → aprovação (H2) usa tabela satélite.
- **H5:** bug legado em `executores.tsx` grava o código ProJuris no campo FK `executor_id` — H5 corrige movendo a fonte da verdade p/ a tela de usuário.
- **F1/G1:** ambas migram `casos.$id.tsx` p/ layout + `<Outlet/>` — coordenar p/ evitar conflito (ver `reference_tanstack_nested_routes`).
- **J2:** reconciliar 381 (A8) vs 392 (levantamento) casos no T0.
</content>
