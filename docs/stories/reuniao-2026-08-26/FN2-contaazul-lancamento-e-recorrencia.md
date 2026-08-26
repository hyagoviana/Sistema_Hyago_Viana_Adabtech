# Story FN2: ContaAzul — "Fazer lançamento" de verdade, despesas e o contorno das 24 competências

**Épico:** Reunião 2026-08-26 · **ID:** FN2 · **Onda:** 4 (**a última**) · **Status:** BLOQUEADA — spike parcial; falta reautorizar o OAuth do ContaAzul
**Fonte:** `material/documentos/2026-08-25_registros-contaazul.docx` (passo a passo, Desenhos 1 a 9) + `2026-08-25_financeiro-shv.docx`
**Executor:** @dev + @architect (spike da API) · Quality gate: @qa
**Risco:** ALTO — escreve em sistema financeiro externo. Owner decidiu deixar por último **porque é o mais complexo**.

---

## Story

**Como** escritório,
**quero** que o botão "Fazer lançamento" do caso **crie de fato** a venda/despesa no ContaAzul, com categoria, centro de custo e serviço certos,
**para que** o ERP continue sendo a base única de recebíveis e a pagar, sem redigitação.

Thiago: "o ContaAzul representa um ERP financeiro onde administramos o grosso dos recebíveis e a pagar do escritório. Teoricamente todos os nossos registros que envolvam valores vão obrigatoriamente passar pelo sistema."

---

## SPIKE OBRIGATÓRIO antes de estimar (resposta ao owner)

O que **já está documentado no repositório** (`sistema-hv/src/lib/contaazul/API-REFERENCE.md`) e portanto **é certo que dá**:

| Precisa | Endpoint conhecido |
|---|---|
| Cliente/fornecedor | `GET/POST/PATCH /v1/pessoas` (já usado por `syncClientToContaAzul`) |
| Conta a receber com parcelas | `POST /v1/financeiro/eventos-financeiros/contas-a-receber` |
| Listar parcelas do evento | `GET .../{id_evento}/parcelas` |
| **Editar UMA parcela** | `PATCH .../parcelas/{id}` ← **é a peça do contorno das 24 competências** |
| Cobrança (boleto/pix/link) | `POST .../contas-a-receber/gerar-cobranca` |
| Baixa (quitação) | `POST .../parcelas/{parcela_id}/baixa` |
| Contas financeiras | `GET /v1/conta-financeira` |

O que **ainda não temos documentado** e o spike precisa responder:

1. **Venda de serviço / contrato recorrente** — o doc do Thiago descreve o fluxo pela **tela** (venda avulsa × venda recorrente). Existe endpoint de venda/contrato na API v2, ou só "contas a receber"? Se só houver contas a receber, o parcelamento pode ser resolvido direto (sem o contrato) — o que **elimina** a limitação das 24 competências. **Essa é a pergunta mais importante da story.**
2. **Contas a pagar / despesas** — existe o equivalente de `eventos-financeiros` para despesa?
3. **Categorias financeiras, centro de custo e serviço** — dá para listar por API (para o de-para do SHV) ou o admin cadastra o ID na mão (Desenho 6)?
4. **Importação por IA de lançamentos** (última pergunta do doc do Thiago) — existe endpoint público? **Owner pediu para checar.**

**Saída do spike:** um documento curto em `sistema-hv/docs/` com o veredito de cada item + o desenho final do fluxo. **Só depois** o restante das tasks é estimado.

---

## Contexto / o que JÁ EXISTE

- **Cliente da API:** `src/lib/contaazul/client.ts` (621 linhas) — OAuth, refresh, chamadas; inclusive `rateio_centro_custo` (linha ~457), o que indica que o centro de custo já é aceito em algum payload.
- **Serviço:** `src/lib/contaazul/service.ts` (702 linhas) — `syncClientToContaAzul`, `createContaAzulCharge`, `syncContaAzulPagamentos`, `cancelContaAzulCharge`.
- **Sync agendado:** `src/routes/api.cron.sync-contaazul.tsx` + o cron único diário (`api.cron.daily.tsx`, R6 de 14/08 — Vercel Hobby só permite 2).
- **Callback OAuth:** `src/routes/api.contaazul.callback.tsx`.
- **FN1** entrega: lançamentos, categorias com código CA, tipos, status e o vínculo tema → centro de custo/serviço.

---

## Acceptance Criteria

> Sujeitos a ajuste conforme o spike. O que **não** muda: nada é enviado sem confirmação humana, e nada é enviado duas vezes.

1. **Fazer lançamento (receita).** Com o lançamento em **Aguardando**, o botão cria no ContaAzul a receita correspondente, com: pessoa (cliente), **categoria financeira** (pelo tipo de receita do SHV), **centro de custo** e **serviço** (pelo tema), valor, parcelas, forma de pagamento, conta de recebimento e vencimentos. Ao voltar com sucesso, o lançamento fica **Lançado** e guarda o **ID do registro no ContaAzul**.
2. **Fazer lançamento (despesa).** Idem para despesa, com **fornecedor**, categoria pelo tipo de despesa, centro de custo pelo tema e a **descrição padronizada** (`{Tipo}: caso {tema} - {Cliente}`).
3. **Revisar lançamento.** Para um lançamento já **Lançado**, o botão **altera** o registro existente no ContaAzul (não cria outro). Se a alteração não for possível pela API, a UI diz o que precisa ser feito à mão — sem falhar em silêncio.
4. **Idempotência.** Clicar duas vezes não cria dois registros. O ID externo guardado é a trava (mesmo princípio do `projuris_codigo_tarefa` no motor).
5. **Parcelas completas (as 24 competências).** Se o spike confirmar a limitação, o sistema executa o contorno descrito no doc — identificar a última parcela materializada e alterar seu vencimento em blocos até completar o total, e no fim corrigir o vencimento da primeira parcela editada. **Se a API não permitir**, o sistema **avisa** quantas parcelas faltam materializar e instrui o passo manual. Em nenhum caso o número de parcelas fica errado sem ninguém saber.
6. **Reembolsável.** A receita gerada pela despesa reembolsável (FN1) só vai ao ContaAzul quando alguém mandar — não vai junto automaticamente.
7. **Volta do ContaAzul.** O sync existente passa a atualizar os lançamentos novos (recebido/vencido/baixa), alimentando o painel "Valores lançados" da FN1 com dado real.
8. **Erro tratado.** Falha de integração retorna **4xx com mensagem legível** (nunca 5xx — a Vercel mascara gateway 5xx; ver `reference_vercel_5xx_gateway`), registra o erro no lançamento e **não** muda o status para Lançado.
9. **Nada quebra.** Cobrança Asaas, cobrança ContaAzul atual, sync de pagamentos e relatório financeiro continuam funcionando.
10. **Gates.** `typecheck` + `lint`; teste em ambiente/registros de teste que o Thiago já criou (categorias, centro de custo, serviço e cliente "teste CA", CPF 988.119.405-91) **antes** de qualquer registro real.

---

## Tasks / Subtasks

### T0 — Spike (@architect + @dev)
- [x] **Parcial.** Documento criado em `sistema-hv/docs/referencia-api-contaazul-v2.md`. Categorias, serviços, contas financeiras e **centro de custo** estão CONFIRMADOS pelo código em produção. A sondagem ao vivo das perguntas 1, 2 e 4 **não rodou**: o refresh token do `.env.local` devolve `invalid_grant` (expirou). Script de sondagem pronto e só-leitura: `scripts/diag-contaazul-fn2.ts`. (SPIKE)

### T1 — De-para (@dev)
- [ ] Mapear tipo de receita/despesa do SHV → categoria do ContaAzul (usando o código já cadastrado na FN1) e tema → centro de custo/serviço. (AC-1, AC-2)

### T2 — Lançar (@dev)
- [ ] `fazerLancamento(lancamentoId)` e `revisarLancamento(lancamentoId)` em `contaazul/service.ts`, com ID externo, idempotência e erro 4xx legível. (AC-1..AC-4, AC-8)

### T3 — Parcelas (@dev)
- [ ] Implementar o contorno das competências **ou** o aviso, conforme o spike. (AC-5)

### T4 — Volta (@dev)
- [ ] Estender `syncContaAzulPagamentos` para os lançamentos novos. (AC-7)

### T5 — QA (@qa)
- [ ] Tudo primeiro na conta de teste com os registros que o Thiago criou. (AC-10)
- [ ] Receita em 72 parcelas (o caso extremo do doc): conferir que todas existem no ContaAzul ao final. (AC-5)
- [ ] Duplo clique não duplica. (AC-4)
- [ ] Derrubar a credencial de propósito: mensagem legível, status não muda. (AC-8)

---

## Dev Notes

- **O doc do Thiago descreve a TELA, não a API.** Os 16 passos (Desenhos 1 a 9) são o procedimento manual dele. Nosso trabalho é chegar ao **mesmo resultado**; se a API oferecer caminho mais curto (contas a receber parceladas direto), **usar o caminho curto** — a limitação das 24 competências é da tela.
- **Registros antigos ficam para depois:** decisão dele. "As antigas ficam lá e depois a gente volta e resolve como faz" — o Adavio ficou de ver se a API altera registro antigo.
- **Vínculo ContaAzul ↔ Asaas** ficou com o Adavio (o próprio Thiago anotou) — **fora do escopo** desta story.
- **Nunca 5xx.** Erro de dependência externa vai como 424, senão a mensagem não chega no front (aprendizado já registrado no projeto).
- **Conta de teste primeiro, sempre.** O Thiago criou categorias, centro de custo, serviço e cliente de teste exatamente para isso.

## Testing

- Conta de teste → conferência com o Thiago → só então produção.

## Dependências

- **FN1** (obrigatória — é onde nasce o lançamento).
- **Spike T0** trava o resto.

## File List

**Novos**
- `sistema-hv/docs/referencia-api-contaazul-v2.md` (saída do spike)

**Alterados**
- `sistema-hv/src/lib/contaazul/client.ts` · `service.ts` · `types.ts`
- `sistema-hv/src/lib/financeiro-caso-service.ts` (da FN1)
- `sistema-hv/src/routes/api.cron.sync-contaazul.tsx`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial; spike com 4 perguntas, incluindo importação por IA | @sm (River) |
| 2026-08-26 | v0.2 | **Spike parcial.** Confirmado: categorias (`GET /v1/categorias`), serviços (`GET/POST /v1/servicos`), contas financeiras e **centro de custo** (aceito no `rateio` da conta a receber) — os três da pergunta 3. **Achado que pode encolher muito esta story:** o `POST .../contas-a-receber` aceita **a lista completa de parcelas de uma vez** (`condicao_pagamento.parcelas[]`), o que sugere que a limitação das 24 competências é da **tela** de venda recorrente, não do caminho que a API oferece — se confirmado, o contorno dos blocos de 24 (a parte mais complexa) **não precisa existir**. Perguntas 1, 2 e 4 seguem abertas porque o refresh token expirou. | @dev (via Orion) |
