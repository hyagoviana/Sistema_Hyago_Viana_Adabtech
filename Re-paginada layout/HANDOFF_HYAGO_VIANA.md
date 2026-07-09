# HANDOFF — Redesign Premium · HyagoViana Advocacia CRM (v3)

> **Escopo deste handoff: APENAS LAYOUT/APRESENTAÇÃO.** Nenhuma mudança em lógica, rotas, hooks, queries, stores ou dados. Se uma mudança visual exigir mexer em lógica, PARAR e reportar.

---

## 0. Direção criativa: "Apple-grade"

O alvo é a sensação de produto da Apple: **calmo, material, físico e inevitável**. Traduzindo em regras:

1. **Materiais, não cores chapadas.** Fundos são degradês sutis; topbar/modais/popovers são vidro translúcido (`--hv-glass` + `backdrop-filter: var(--hv-glass-blur)`); cards são superfícies com luz vinda de cima (`--hv-inset-hi`).
2. **Motion com física.** Tudo que aparece/move usa `--hv-ease-spring` (entradas, hover) ou `--hv-ease-out` (saídas, colapso). Entrada da tela /hoje: cards em cascata (stagger 40ms, translateY(8px)→0 + fade, duração `--hv-dur-slow`). Números de KPI animam contagem (count-up ~600ms) no primeiro load. **Sempre** respeitar `prefers-reduced-motion` (desligar tudo).
3. **Uma coisa por vez.** Um único card hero por tela, um único CTA dourado por viewport, whitespace generoso (mínimo 24px entre blocos, 32px de padding lateral).
4. **Detalhe invisível.** Transições de 150–280ms em hover de qualquer elemento interativo; focus ring dourado visível via teclado; cantos grandes e consistentes (`--hv-r-lg` em cards, nunca misturar raios no mesmo nível).
5. **Nada grita.** Zero itálico, zero cor saturada decorativa, dourado cirúrgico (CTA, item ativo, micro-detalhes).

## 1. Fundo do app (regra crítica — pedido do cliente)

- O fundo do conteúdo é **creme em degradê para o branco quente**: `background: var(--hv-bg-app)` no container raiz (área à direita da sidebar). **Nunca** cor chapada, **nunca** `#FFF` puro de fundo.
- **Login:** lado esquerdo permanece navy; o lado do formulário usa `var(--hv-bg-login-form)` (creme→branco). O card do formulário pode ser `--hv-surface-grad` com `--hv-elev-2`, flutuando sobre o creme.
- Cards continuam brancos (`--hv-surface-grad`) — o contraste card branco sobre fundo creme-degradê é o que dá a profundidade.

## 2. Tokens

Toda cor, sombra, raio, fonte e easing vem de `hyago-design-tokens.css`. **Zero valores mágicos.**

## 3. Tipografia

| Papel | Fonte | Peso | Tracking |
|---|---|---|---|
| Wordmark marca | Marcellus | 400 | `.14em`, caps |
| H1 saudação | Inter | 650 | `-0.035em` |
| Números KPI | Inter | 650 | `-0.045em`, 32px, `tnum` |
| Título de card | Inter | 650 | `-0.02em`, 15px |
| Eyebrow/labels | Inter | 650 | `.16–.26em`, caps, 9.5–10px |
| Corpo | Inter | 400–450 | normal, 13–14px |

Global: `font-feature-settings: 'tnum' 1, 'cv11' 1`. Serifa (Marcellus) SÓ em wordmark e citação institucional do login. **Zero itálico no sistema inteiro.**

## 4. Logo (lockup)

- Monograma H·V em SVG com gradiente dourado (`#D3AE60 → #8A672A`) — copiar `<defs id="hvmark">` de `hyago-viana-redesign-v2.html` até ter o vetor oficial.
- **Sidebar expandida:** monograma **28×24px** + wordmark 13px (versão reduzida). **Colapsada:** só monograma 30px centralizado. **Login:** monograma 46px, wordmark 17px.

## 5. Sidebar — estrutura ATUAL do menu (v3)

```
OPERAÇÃO      → Hoje · Pipeline Operacional · Pipeline Financeira · Relatório Financeiro · Clientes · Assinatura · Tarefas
COMERCIAL     → Cadastro · Comercial · Pipeline Comercial
INTELIGÊNCIA  → Controladoria · Peticionamento · WhatsApp · Dashboard
MARKETING     → Marketing · Design System
SISTEMA       → Referências · Permissões · Configurações
```

Manter EXATAMENTE esses grupos/itens/ordem (não renomear rotas). Estilo dos labels de grupo: caps 9px, tracking `.28em`, cor `rgba(198,161,85,.5)`.

### Comportamento colapsável
- Larguras: `--hv-sidebar-w` (256px) ⇄ `--hv-sidebar-w-collapsed` (72px). Transição `--hv-sidebar-transition`; o conteúdo expande e ocupa a largura liberada.
- **Colapsada:** ícones centralizados em tiles 40×40; labels somem com `opacity`+`width:0` (nunca `display:none`, para animar); tooltip à direita com o nome; badges viram dot dourado 6px no canto do ícone; grupos viram divisor hairline; logo vira só o monograma.
- **Item ativo:** expandida → barra dourada 3px à esquerda com glow (`0 0 10px rgba(198,161,85,.55)`) + fundo `linear-gradient(90deg, rgba(198,161,85,.17), rgba(198,161,85,.03))` + `inset 0 0 0 1px rgba(198,161,85,.14)`. Colapsada → o tile do ícone recebe esse tratamento.
- Toggle no header da sidebar (chevrons); persistir em `localStorage`.
- Fundo `--hv-sidebar-grad` + `inset -1px 0 0 rgba(198,161,85,.14)` + `4px 0 24px -8px rgba(10,16,31,.35)`.

## 6. Receitas de componentes

**Card:** `--hv-surface-grad`; borda 1px `--hv-line`; raio `--hv-r-lg`; sombra `--hv-inset-hi, --hv-elev-1`; hover: `translateY(-3px)` + `--hv-elev-2` com `--hv-ease-spring`.

**Card hero (métrica nº 1, único por tela):** `radial-gradient(320px 160px at 85% -30%, rgba(198,161,85,.28), transparent 65%), linear-gradient(160deg, --hv-ink-700, --hv-ink-900 60%, --hv-ink-950)`; borda `rgba(198,161,85,.3)`; filete 2px dourado no topo.

**Topbar:** sticky; `background: var(--hv-glass)`; `backdrop-filter: var(--hv-glass-blur)`; borda inferior `--hv-glass-border`. Busca central com `⌘K`.

**Botão primário:** `--hv-gold-grad`; raio `--hv-r-md`; sombra `inset 0 1px 0 rgba(255,255,255,.38), inset 0 -1px 0 rgba(0,0,0,.15), 0 2px 5px rgba(138,103,42,.35), 0 8px 20px -6px rgba(138,103,42,.5)`; hover lift 1px + brightness(1.05); active: scale(.98).

**Input:** branco; borda `--hv-line`; raio 12px; `inset 0 1.5px 3px rgba(21,27,44,.05)`; focus: borda `--hv-gold` + ring `0 0 0 3.5px rgba(168,129,59,.15)`.

**Chips:** fundo `--hv-*-bg` + texto `--hv-*` + inset ring 1px da cor a 12–16%. Peso 650, 10.5px.

**Barras:** trilho rebaixado (`inset 0 1px 2px rgba(21,27,44,.07)`); fill gradiente dourado vertical + brilho `inset 0 1px 0 rgba(255,255,255,.35)`; fora do top-3 usar variante neutra.

**KPI:** label caps 9.5px; número 32px/650/-0.045em com count-up; delta em chip; sparkline SVG 64×22.

**Charts (ordem):** `--hv-ink-700` → `--hv-gold` → `--hv-gold-soft` → `#DDD3BC`. Verde/vermelho só semântico.

**Estados vazios:** nunca em branco — ícone + frase de direção + ação ("Nenhuma tarefa urgente. Criar tarefa →").

## 7. Definition of Done (checklist por tela)

- [ ] Fundo = `--hv-bg-app` (degradê creme→branco), nunca chapado
- [ ] Nenhum hex/sombra/easing fora dos tokens
- [ ] Zero `font-style: italic`
- [ ] Cards com elev-1 + inset-hi + surface-grad; hover elev-2 com spring
- [ ] Topbar em vidro translúcido
- [ ] Dourado apenas em CTA/ativo/detalhes (1 CTA por viewport)
- [ ] Sidebar com os 5 grupos v3, colapsa para 72px, tooltips, localStorage
- [ ] Entrada da tela com stagger + count-up; `prefers-reduced-motion` respeitado
- [ ] Estados vazios com ícone + texto + ação
- [ ] `tnum` nos números; contraste AA sobre navy e dourado
- [ ] Nenhuma lógica/rota/hook/query alterada (diff só de apresentação)
- [ ] Comparado visualmente com `hyago-viana-redesign-v2.html`
