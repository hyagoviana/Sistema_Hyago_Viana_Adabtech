# Story FN1: Financeiro do caso — receitas e despesas registradas no SHV (sem tocar na API do ContaAzul)

**Épico:** Reunião 2026-08-26 · **ID:** FN1 · **Onda:** 4 (penúltima) · **Status:** Draft
**Fonte:** `material/documentos/2026-08-25_financeiro-shv.docx` (Desenhos 1 a 6)
**Executor:** @architect (modelo de dados) → @data-engineer (migrations) → @dev (UI/serviço) · Quality gate: @qa
**Risco:** ALTO — módulo novo, com dinheiro. Mitigação: **nada é enviado para fora** nesta story.

---

## Story

**Como** escritório,
**quero** registrar no caso **o que se tem a receber e a pagar**, com tipo, categoria e status,
**para que** tudo seja visível no SHV — inclusive o que **ainda não** vai para o ERP, porque depende de um resultado futuro.

Thiago, no doc: "também defini a possibilidade de que valores sejam registrados/cadastrados no SHV, sem necessariamente serem lançados/registrados no ContaAzul. Assim garantimos que valores que temos que pagar/receber sejam visualizados… em razão de uma especificidade da advocacia: parte dos valores são questões futuras e que dependem de outra situação."

**Recorte desta story (decisão do owner, 26/08):** **fase 1 = cadastro interno completo.** O botão "Fazer lançamento" existe, mas quem conversa com o ContaAzul é a **FN2**.

---

## DECISÃO TRAVADA pelo owner (2026-08-26) — modelo de dados

**Tabelas NOVAS.** O modelo do doc (lançamento + parcelas) nasce em tabelas próprias.
`system_parcelas` (migration `20260608000008_s18_parcelas.sql`) **continua no papel atual** — cobrança emitida (Asaas/ContaAzul), usada por `contaazul/service.ts`, `asaas/service.ts`, `financeiro-service.ts`, relatório financeiro e inadimplência, tudo em produção. O vínculo entre lançamento e cobrança é **opcional** e só entra na **FN2**.

Motivo: forçar o modelo novo dentro da tabela antiga arriscaria quebrar cobrança, inadimplência e relatório de uma vez só. O @architect ainda desenha o formato exato das tabelas (T0), mas **a direção está fechada**.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Aba financeira do caso:** `src/routes/casos.$id.financeiro.tsx` (225 linhas) — cabeçalho, etapa financeira, botão de Termo, "Mover etapa", sync ContaAzul/Asaas, e os **gates**: `podeVerValores(...)` (visibilidade de valores) + `usePodeEditar("financeiro")` + `can(role,"financeiro.manage")`. **Toda a UI nova entra aqui dentro, respeitando esses gates.**
- **Serviço financeiro:** `src/lib/financeiro-service.ts` — `listAllParcelas`, `getClientPaymentStatus`, `getRelatorioFinanceiroPorCaso`, `getRastroFinanceiroCaso`, `getDashboardFinanceiro`.
- **Rastro financeiro do caso já existe** (`getRastroFinanceiroCaso`) — é o "Painel Rastro workflow e checklists, financeiro" do Desenho 1. **Não recriar.**
- **Linha do tempo financeira já existe** — os eventos `fin_*` são gravados e **filtrados** da ficha comum (`CaseTimeline.tsx:172`), aparecendo no submenu financeiro. É o painel "Linha do tempo/notas, financeiro".
- **Configuração por tema:** `TemaConfigTabs` (`configuracoes.campos-personalizados.tsx:217`) já tem as abas Campos/Pastas/Distribuição — **a aba Financeiro entra aqui** (Desenho 6: centro de custo e serviço do ContaAzul por tema).
- **Cliente ↔ ContaAzul:** `syncClientToContaAzul` (`contaazul/service.ts:40`) já existe.
- **Padrão de dinheiro na UI:** campos `money` de `CaseCanonicalFields.tsx:367` e `src/lib/br/` (formatação BR).

### NOVO

1. **Catálogo de categorias financeiras** (a árvore do doc, com código do ContaAzul), cadastrável.
2. **Tipos de receita e de despesa** (as listas do doc).
3. **Lançamento do caso** (receita ou despesa) + **parcelas**, com status **Aguardando / Dispensado / Lançado**.
4. **Regra do reembolsável:** despesa marcada como reembolsável **gera automaticamente** uma receita pendente equivalente.
5. **Vínculo tema → centro de custo / serviço** do ContaAzul (só o campo; o uso é na FN2).
6. **Painéis** do Desenho 1 que ainda não existem: Receitas do caso, Despesas do caso, Valores lançados (com o resumo Devido/Vencido/Recebido/Vincendo e o detalhamento por parcela).

---

## Acceptance Criteria

1. **Catálogo de categorias.** Existe cadastro da árvore de categorias (Fiscal 4.01 / Gerencial 4.02 → Honorários contratuais / Reembolsos / Sucumbência → tipo), com o **código do ContaAzul** em cada nó, e o mesmo para despesas (10.01 Custas / 10.02 Diligências, cada uma com reembolsável e não reembolsável). Os códigos do doc são carregados como seed.
2. **Tipos.** Receita aceita: Entrada, Êxito, Rescisão, Consulta/Parecer, Recuperados/Acordo/Renegociação, Reembolso de custas, Reembolso de diligências, Reembolso de outras despesas. Despesa aceita: Custas processuais/taxas/emolumentos e Diligências.
3. **Registrar receita.** No caso, "Registrar receita" abre o formulário do **Desenho 4**: tipo, centro de custo, conta de recebimento, forma de pagamento, data de vencimento, **nº de parcelas**, período ("repetir a cada N meses/anos"), **valor**, e **Revisar parcelas** — que lista as parcelas que serão criadas e permite editar vencimento e valor de qualquer uma.
4. **Registrar despesa.** "Registrar despesa" abre o **Desenho 5**: tipo, fornecedor, conta de pagamento, forma de pagamento, vencimento, valor, **Reembolsável (só quando o tipo tem categoria reembolsável)**, **Recorrente** + período + **Revisar recorrência**.
5. **Descrição padronizada da despesa.** Gerada automaticamente no formato do doc: `{Tipo da despesa}: caso {tema} - {Nome do cliente}`.
6. **Reembolsável gera receita.** Ao salvar uma despesa marcada como reembolsável, o sistema cria uma **receita com status Aguardando** com as mesmas informações, vinculada à despesa de origem. Desmarcar/excluir a despesa não apaga a receita silenciosamente — o sistema avisa.
7. **Status.** Todo lançamento tem status **Aguardando**, **Dispensado** ou **Lançado**. Nesta story, "Lançado" só é atingido **manualmente** (marcação), porque a integração é a FN2.
8. **Botões de ação presentes.** "Fazer lançamento" e "Revisar lançamento" existem na UI, mas nesta story **apenas registram a intenção** (marcam status / abrem edição) e deixam claro que a integração está pendente. Nenhuma chamada ao ContaAzul.
9. **Painel Receitas do caso / Despesas do caso.** Listas com tipo, valor, status e botão de ação, como no Desenho 2.
10. **Painel Valores lançados.** Mostra, por tipo de receita, **Devido / Vencido / Recebido / Vincendo**, com categoria financeira, centro de custo e status; o **[+]** abre o detalhamento por parcela (conta, parcela, vencimento, valor devido, valor pago, data da baixa) — Desenho 3. Nesta fase, alimentado pelos dados internos do SHV.
11. **Tema → ContaAzul.** A configuração do tema ganha a aba **Financeiro** com dois campos: **centro de custo** e **serviço** do ContaAzul (texto/ID), conforme o Desenho 6.
12. **Sucumbências.** Painel reservado (posição e título), sem funcionalidade — o próprio doc diz que o detalhamento vem depois.
13. **Gates de dinheiro.** Nada de valor aparece para quem não tem `financeiro:view`/`podeVerValores`; nada é editável sem `financeiro:edit`. Servidor e cliente.
14. **Não mexe no que existe.** Cobrança (Asaas/ContaAzul), inadimplência, relatório financeiro e pipeline financeira continuam **exatamente** como estão.
15. **Gates técnicos.** `typecheck` + `lint` limpos; migrations 2× idempotentes + rollback; `db:types` regenerado.

---

## Tasks / Subtasks

### T0 — Modelo (@architect)
- [ ] Desenhar as tabelas novas (lançamento, parcela, categoria, tipo, vínculo despesa→receita) — a direção já está travada pelo owner: **não** reusar `system_parcelas`. Registrar como ADR curta em `docs/sprints-p1-p2/_adrs/`, incluindo o ponto de encontro com a cobrança que a FN2 vai usar.

### T1 — Migrations (@data-engineer)
- [ ] Catálogo de categorias (com código CA) + seed do doc. (AC-1)
- [ ] Lançamentos + parcelas + vínculo despesa→receita reembolsável. (AC-3..AC-7)
- [ ] Campos de tema: centro de custo e serviço do ContaAzul. (AC-11)
- [ ] Rollbacks; aplicar 2×; `db:types`. (AC-15)

### T2 — Serviço (@dev)
- [ ] `src/lib/financeiro-caso-service.ts`: criar/editar/excluir lançamento, gerar parcelas (com revisão), regra do reembolsável, mudança de status, agregações do painel Valores lançados. (AC-3..AC-10)
- [ ] RPCs com gate `financeiro` (view/edit). (AC-13)

### T3 — UI do caso (@dev)
- [ ] Painéis Receitas / Despesas / Valores lançados dentro de `casos.$id.financeiro.tsx`, reusando Rastro e Linha do tempo financeira que **já existem**. (AC-9, AC-10, AC-12)
- [ ] Formulários dos Desenhos 4 e 5, com "Revisar parcelas"/"Revisar recorrência". (AC-3, AC-4)

### T4 — Configuração do tema (@dev)
- [ ] Aba **Financeiro** no `TemaConfigTabs`. (AC-11)

### T5 — QA (@qa)
- [ ] Receita parcelada em 12×: parcelas geradas certas; editar a 5ª (valor e vencimento) e salvar. (AC-3)
- [ ] Despesa reembolsável: receita Aguardando criada e vinculada. (AC-6)
- [ ] Descrição da despesa no formato exato do doc. (AC-5)
- [ ] Painel Valores lançados batendo com a soma das parcelas. (AC-10)
- [ ] Usuário sem `financeiro:view`: não vê valor nenhum. (AC-13)
- [ ] Cobrança/inadimplência/relatório inalterados. (AC-14)

---

## Dev Notes

- **Esta story não fala com o ContaAzul.** Se aparecer chamada de API no diff, está fora de escopo — é FN2.
- **Rastro e linha do tempo financeira já existem.** O Desenho 1 mostra 6 painéis, mas **2 já estão prontos**. Recriar seria desperdício e criaria duas versões.
- **Categoria ≠ tipo.** Categoria é a árvore do ContaAzul (com código); tipo é o vocabulário do SHV. O de-para entre eles é o que a FN2 usa para lançar. Manter separados desde já.
- **Centro de custo e serviço são por TEMA** — não por caso. É o que o Thiago repetiu: "sempre que a gente for trabalhar um tema, ele é para tudo".
- **Valores em centavos** (inteiro) no banco, formatação BR na borda — como o resto do sistema.
- **Nada de importar registro antigo:** "inicialmente não vamos trabalhar com registros antigos, para evitar o trabalho de organização interna".

## Testing

- Casos reais com receita parcelada, despesa recorrente e despesa reembolsável.
- Conferência dos gates com 3 perfis (admin, financeiro, advogado).

## Dependências

- **C1** (campos) e **T2** (aba do tema) tocam `TemaConfigTabs` — coordenar a ordem.
- **FN2** depende inteiramente desta.

## File List

**Novos**
- migrations do catálogo, lançamentos e parcelas (+ rollbacks)
- `sistema-hv/src/lib/financeiro-caso-service.ts`
- `sistema-hv/src/rpc/financeiro-caso.ts`
- componentes de painel e formulários em `sistema-hv/src/components/cases/`

**Alterados**
- `sistema-hv/src/routes/casos.$id.financeiro.tsx`
- `sistema-hv/src/routes/configuracoes.campos-personalizados.tsx` (aba Financeiro do tema)
- `sistema-hv/src/lib/supabase/types.ts`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial a partir do doc 25.08 Financeiro SHV; fase 1 sem API | @sm (River) |
| 2026-08-26 | v0.2 | Owner travou o modelo: **tabelas novas**, `system_parcelas` intacta; vínculo com cobrança só na FN2 | @aios-master (Orion) |
