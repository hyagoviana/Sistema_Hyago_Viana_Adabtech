# ContaAzul API v2 — o que dá e o que ainda não sabemos (spike da FN2)

> Saída do spike pedido pelo owner em 2026-08-26 ("pode confirmar e vemos depois
> essa parte da Conta Azul"). Fonte: o código que **já roda em produção**
> (`src/lib/contaazul/client.ts`), o `API-REFERENCE.md` do repositório e uma
> tentativa de sondagem direta da API.
>
> **A sondagem ao vivo NÃO rodou:** o refresh token do `.env.local` devolve
> `invalid_grant` — expirou. Reautorizar o OAuth é pré-requisito para fechar as
> perguntas que sobraram (script pronto: `scripts/diag-contaazul-fn2.ts`, só
> leitura).

---

## Resumo para decidir

| Pergunta do owner | Resposta | Confiança |
|---|---|---|
| 1. Venda de serviço / contrato **recorrente** por API | **Provavelmente não é necessário** — ver abaixo | Média |
| 2. Contas a **pagar** (despesa) | **Não confirmado** | Baixa |
| 3. Categorias / centro de custo / serviço | **Sim, os três** | **Alta** |
| 4. Importação por IA | **Não confirmado** | Baixa |

---

## 1. O contrato recorrente e as "24 competências"

O doc do Thiago descreve um procedimento **de tela**: criar venda recorrente
(contrato), deixar o sistema materializar 24 competências, editar a última venda
(+1 dia no vencimento) para forçar mais 24, repetir, e no fim voltar e corrigir a
parcela 25.

**O que o nosso código prova sobre a API:**

```
POST /v1/financeiro/eventos-financeiros/contas-a-receber
  → condicao_pagamento: { parcelas: [ ...N parcelas com data e valor... ] }
```

Ou seja: a API aceita **as N parcelas de uma vez, explicitamente**, no ato da
criação. Isso é diferente do fluxo de tela — não há recorrência a materializar,
porque **nós mandamos a lista inteira**.

**Conclusão provável:** a limitação das 24 competências é da **venda recorrente
pela interface**, não do caminho de contas a receber que a API oferece. Se for
isso, o contorno dos "blocos de 24" **não precisa ser implementado** — some o
pedaço mais complexo da FN2.

**Como confirmar sem risco:** criar, na conta de teste, uma conta a receber com
72 parcelas e ver se as 72 aparecem. É o teste do AC-5 da FN2.

> ⚠️ Só depois desse teste dá para afirmar. O que está descartado é **assumir**
> o procedimento manual sem antes checar o caminho curto.

---

## 2. Contas a pagar (despesa) — em aberto

Nada no nosso código toca despesa: o sistema só usou contas **a receber**. Os
caminhos prováveis, pelo padrão da API
(`v1/financeiro/eventos-financeiros/contas-a-pagar[...]`), estão no script de
sondagem, mas **não foram testados**.

Se não existir, a despesa fica registrada só no SHV (que é justamente o que a FN1
já entrega) e o lançamento no ERP continua manual — sem perda de dado, com perda
de automação.

---

## 3. Categorias, centro de custo e serviço — **resolvido**

Confirmado pelo código em produção:

| Precisa | Endpoint | Onde |
|---|---|---|
| Listar **categorias** | `GET /v1/categorias` | `client.ts:367` |
| Listar **serviços** | `GET /v1/servicos` | `client.ts:345` |
| Criar serviço | `POST /v1/servicos` | `client.ts:354` |
| Contas financeiras | `GET /v1/conta-financeira` | `client.ts:385` |
| **Centro de custo** | aceito no `rateio` da conta a receber: `rateio_centro_custo: [{ id_centro_custo, valor }]` | `client.ts:457` |

**Consequência prática para a FN1:** os campos "centro de custo" e "serviço" do
tema (Desenho 6) podem virar **seletor** em vez de texto colado à mão — basta
listar do ContaAzul. Ficou como texto nesta fase porque a autorização OAuth está
vencida; a troca é pequena quando o acesso voltar.

---

## 4. Importação por IA — em aberto

O Thiago viu no painel ("O ContaAzul está com esse painel de importações de
lançamentos por IA/automação. Vi recentemente que é uma funcionalidade que agora
tem na API. Conseguimos colocar no nosso sistema?").

Não há menção a isso no `API-REFERENCE.md` do repositório nem no nosso client. Os
caminhos candidatos estão no script de sondagem. **Prioridade baixa** por decisão
do próprio owner.

---

## O que destrava tudo isso

**Reautorizar o OAuth do ContaAzul** (o refresh token do `.env.local` expirou).
Depois disso:

```bash
npx tsx scripts/diag-contaazul-fn2.ts    # só leitura; imprime status de cada endpoint
```

O script já sonda os candidatos das perguntas 1, 2 e 4 e imprime uma amostra da
resposta de cada um. Com a saída dele, a FN2 fica dimensionada em minutos.
