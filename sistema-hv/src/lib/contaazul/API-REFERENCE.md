# Conta Azul API v2 — Referência de Pessoas

Base URL: `https://api-v2.contaazul.com`
Auth: `Authorization: Bearer {access_token}` (OAuth2 via Cognito)

---

## GET /v1/pessoas — Buscar pessoas por filtro

### Query Params
| Param | Tipo | Default | Notas |
|---|---|---|---|
| pagina | integer | 1 | |
| tamanho_pagina | integer | 10 | Enum: 10,20,50,100,200,500,1000 |
| tipo_ordenacao | string | "NOME" | Enum: NOME, EMAIL, DOCUMENTO, ATIVO |
| ordem_ordenacao | string | "ASC" | Enum: ASC, DESC |
| busca | string | | Busca textual livre |
| ids | string | | UUIDs separados por vírgula |
| **documentos** | string | | CPF/CNPJ (campo correto pra buscar) |
| paises | string | | |
| cidades | string | | |
| ufs | string | | |
| codigos_pessoa | string | | |
| emails | string | | |
| tipos_pessoa | string | | Ex: "Física" |
| nomes | string | | |
| telefones | string | | |
| data_criacao_inicio | string | | |
| data_criacao_fim | string | | |
| data_alteracao_de | string | | |
| data_alteracao_ate | string | | |
| tipo_perfil | string | | Ex: "Cliente" |
| com_endereco | boolean | false | |

---

## POST /v1/pessoas — Criar pessoa

Body: `application/json` (**required**)

### Campos do body (TODOS usados no exemplo da doc)
| Campo | Tipo | Exemplo | Notas |
|---|---|---|---|
| agencia_publica | boolean | false | |
| ativo | boolean | true | |
| codigo | string (<=20) | "CLI001" | Código interno da pessoa |
| nome | string | "João Silva" | |
| nome_fantasia | string | "Empresa LTDA" | Pode ser "" |
| tipo_pessoa | string | "Física" | Enum: Física, Jurídica, Estrangeira |
| cpf | string | "123.456.789-00" | Obrigatório se Física |
| cnpj | string | "12.345.678/0001-90" | Obrigatório se Jurídica |
| rg | string | "12.345.678-9" | Obrigatório se Física |
| data_nascimento | string | "1990-01-01" | YYYY-MM-DD |
| email | string | "joao@email.com" | Pode ter vírgula pra múltiplos |
| telefone_celular | string | "11983899529" | |
| telefone_comercial | string | "1138185004" | |
| observacao | string | "Cliente preferencial" | |
| optante_simples | boolean | true | |
| perfis | array | [{"tipo_perfil":"Cliente"}] | Objeto com tipo_perfil |
| enderecos | array | [...] | Array de objetos |
| inscricoes | array | [...] | Array de objetos (obrigatório pra PF) |
| outros_contatos | array | [...] | Array de objetos |
| contato_cobranca_faturamento | object | {...} | emails[] + whatsapp |

### Estrutura: enderecos[]
```json
{
  "bairro": "Centro",
  "cep": "12345-678",
  "cidade": "São Paulo",
  "complemento": "Apto 45",
  "estado": "SP",
  "logradouro": "Rua das Flores",
  "numero": "123",
  "pais": "Brasil"
}
```

### Estrutura: inscricoes[]
```json
{
  "indicador_inscricao_estadual": "NAO CONTRIBUINTE",
  "inscricao_estadual": "123456789",
  "inscricao_municipal": "123456789",
  "inscricao_suframa": "123456789"
}
```

### Estrutura: outros_contatos[]
```json
{
  "cargo": "Gerente",
  "email": "maria@email.com",
  "nome": "Maria Silva",
  "telefone_celular": "11983899529",
  "telefone_comercial": "1138185004"
}
```

### Estrutura: contato_cobranca_faturamento
```json
{
  "emails": ["joao@email.com"],
  "whatsapp": "5511999999999"
}
```

### Estrutura: perfis[]
```json
{ "tipo_perfil": "Cliente" }
```
Valores: "Cliente", "Fornecedor", "Transportadora"

---

## PUT /v1/pessoas/{id} — Atualizar pessoa (substituição integral)

Path: `id` (string, **required**)
Body: **required** — mesma estrutura do POST.
Endereços no PUT incluem `"id"` do endereço existente.

> **IMPORTANTE:** PUT exige TODOS os campos preenchidos (substituição integral).
> Para atualizar campos individuais, usar **PATCH**.

---

## PATCH /v1/pessoas/{id} — Atualizar parcialmente

Path: `id` (string, **required**)
Body: apenas os campos que se deseja alterar.

> **RECOMENDADO** para o sync do sistema — envia só os campos que temos.

---

## GET /v1/pessoas/{id} — Retornar pessoa por ID

Path: `id` (string, **required**)

### Response
| Campo | Tipo | Exemplo |
|---|---|---|
| ativo | boolean | true |
| atrasos_pagamentos | number | 750.25 |
| atrasos_recebimentos | number | 1500.5 |
| codigo | string | "CLI001" |
| contato_cobranca_faturamento | object | {emails[], whatsapp} |
| criado_em | string | "2024-01-15" |
| data_alteracao | string | "2024-01-15T10:30:06" |
| data_nascimento | string | "1990-01-01" |
| documento | string | "123.456.789-00" |
| email | string | "joao@email.com" |
| ... (demais campos do cadastro) | | |

---

## POST /v1/pessoas/ativar — Ativar em lote

Body: `{ "uuids": ["uuid1", "uuid2"] }` — máximo 10 IDs

---

## POST /v1/pessoas/excluir — Excluir em lote (POST, não DELETE)

---

## POST /v1/pessoas/desativar — Desativar em lote

---

## GET /v1/pessoas/conta-conectada — Dados da empresa conectada

Response: data_fundacao, documento, email, id_empresa, nome_fantasia, razao_social

---

## Financeiro — Contas a Receber

### GET /v1/conta-financeira — Listar contas financeiras
Retorna contas bancárias, cartões, poupança, etc. Usado para obter o `conta_bancaria` ID necessário na cobrança.

### POST /v1/financeiro/eventos-financeiros/contas-a-receber — Criar evento de contas a receber

Cria um evento financeiro com parcelas. Resposta **assíncrona** (202) — retorna protocolo.

**Body (application/json):**
| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| data_competencia | string | Sim | YYYY-MM-DD |
| valor | number | Sim | Valor total |
| observacao | string | Sim | Observação do evento |
| descricao | string | Sim | Descrição do evento |
| contato | string (uuid) | Sim | ID da pessoa (contaazul_customer_id) |
| conta_financeira | string (uuid) | Sim | ID da conta financeira |
| rateio | array | Não | Categorias + centros de custo |
| condicao_pagamento | object | Sim | Contém as parcelas |

**condicao_pagamento.parcelas[] (required):**
| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| descricao | string | Sim | Ex: "Mensalidade (2/6)" |
| data_vencimento | string | Sim | YYYY-MM-DD |
| nota | string | Sim | Nota adicional |
| conta_financeira | string (uuid) | Sim | |
| detalhe_valor | object | Sim | |
| detalhe_valor.valor_bruto | number | Sim | |
| detalhe_valor.multa | number | Não | |
| detalhe_valor.juros | number | Não | |
| detalhe_valor.desconto | number | Não | |
| detalhe_valor.taxa | number | Não | |
| metodo_pagamento | string | Não | Ver enum abaixo |

**metodo_pagamento enum:** DINHEIRO, CARTAO_CREDITO, BOLETO_BANCARIO, CARTAO_CREDITO_VIA_LINK, CHEQUE, CARTAO_DEBITO, TRANSFERENCIA_BANCARIA, OUTRO, CARTEIRA_DIGITAL, CASHBACK, CREDITO_LOJA, CREDITO_VIRTUAL, DEPOSITO_BANCARIO, **PIX_PAGAMENTO_INSTANTANEO**, SEM_PAGAMENTO, VALE_ALIMENTACAO, VALE_COMBUSTIVEL, VALE_PRESENTE, VALE_REFEICAO, **PIX_COBRANCA**, DEBITO_AUTOMATICO

**Response 202:**
```json
{
  "protocolo": "35473eec-...",
  "status": "PENDING",
  "data_criacao": "2024-10-22T14:30:00Z"
}
```

### GET /v1/financeiro/eventos-financeiros/{id_evento}/parcelas — Listar parcelas do evento
Retorna as parcelas vinculadas a um evento financeiro.

### GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar — Buscar receitas por filtro
Filtros: data_vencimento, data_competência, data_pagamento, valor, status, etc.

### GET /v1/financeiro/eventos-financeiros/parcelas/{id} — Retornar parcela por ID
Detalhes de uma parcela específica.

### PATCH /v1/financeiro/eventos-financeiros/parcelas/{id} — Atualizar parcela parcialmente
Alterar data_vencimento, valor, observações, conta financeira.

---

## Cobranças (Boleto / Pix / Link de Pagamento)

### POST /v1/financeiro/eventos-financeiros/contas-a-receber/gerar-cobranca — Gerar cobrança

Gera boleto, pix ou link de pagamento a partir de uma parcela existente.

**Body (application/json):**
| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| conta_bancaria | string (uuid) | Sim | Deve ser tipo COBRANCAS_CONTA_AZUL ou CONTA_CORRENTE (Conta PJ) |
| descricao_fatura | string | Sim | Descrição da fatura |
| id_parcela | string (uuid) | Sim | ID da parcela (vem do evento de contas a receber) |
| data_vencimento | string | Sim | YYYY-MM-DD |
| tipo | string | Sim | Enum: "LINK_PAGAMENTO", "PIX_COBRANCA", "BOLETO" |
| atributos | object | Não | Desconto antecipado |
| atributos.desconto_antecipado.valor | number | Não | |
| atributos.desconto_antecipado.percentual | number | Não | |
| atributos.desconto_antecipado.dias_antes_vencer | integer | Não | |
| maximo_parcelas | integer | Não | Máximo de parcelas no cartão |

**Response 200:**
```json
{
  "id": "35473eec-4e74-11ee-b500-9f61de8a8b8b",
  "url": "http://www.exemplo.com.br",
  "status": "REGISTRADO"
}
```

Status possíveis: AGUARDANDO_CONFIRMACAO, EM_CANCELAMENTO, REGISTRADO, QUITADO, CANCELADO, INVALIDO, EXPIRADO, FALHA_EMISSAO, FALHA_CANCELAR, REMESSA_GERADO, REMESSA_PENDENTE, PAGO, EXTORNADO

### GET /v1/financeiro/eventos-financeiros/contas-a-receber/cobranca/{id_cobranca} — Consultar cobrança
Retorna detalhes da cobrança (id, url, status).

### DELETE /v1/financeiro/eventos-financeiros/contas-a-receber/cobranca/{id_cobranca} — Cancelar cobrança
Cancela uma cobrança existente. Usar quando gerada incorretamente ou antes do pagamento.

---

## Baixas (Quitação de Parcelas)

### POST /v1/financeiro/eventos-financeiros/parcelas/{parcela_id}/baixa — Criar baixa
Registra pagamento recebido. Campos: data, valor, juros, multa, descontos, método de pagamento.

### GET /v1/financeiro/eventos-financeiros/parcelas/{parcela_id}/baixa — Listar baixas da parcela
Consulta todas as baixas de uma parcela.

### PATCH /v1/financeiro/eventos-financeiros/parcelas/baixa/{baixa_id} — Atualizar baixa parcialmente
Corrigir valor, conta financeira, data, observações.

### DELETE /v1/financeiro/eventos-financeiros/parcelas/baixa/{baixa_id} — Deletar baixa
Remove uma baixa existente.

### GET /v1/financeiro/eventos-financeiros/parcelas/baixa/{baixa_id} — Consultar baixa por ID
Detalhes completos da baixa.

---

## Notas importantes

1. **Busca por CPF/CNPJ**: query param é `documentos` (plural), não `documento`
2. **PUT exige todos os campos** — usar PATCH para updates parciais
3. **Pessoa Física**: cpf, rg, data_nascimento, inscricoes são obrigatórios
4. **perfis**: array de objetos `{tipo_perfil: "Cliente"}`, não strings
5. **enderecos**: plural, array de objetos com `estado` (não `uf`)
6. **telefone**: `telefone_celular` e `telefone_comercial` (não `telefone`)
7. **Fluxo de cobrança**: Criar conta a receber → gerar cobrança (boleto/pix/link) a partir da parcela
8. **conta_bancaria**: obrigatório no gerar-cobranca — obter via GET /v1/conta-financeira
9. **PATCH para updates**: Sempre preferir PATCH sobre PUT (atualização parcial, menos campos obrigatórios)
10. **Tipos de cobrança**: LINK_PAGAMENTO, PIX_COBRANCA, BOLETO
