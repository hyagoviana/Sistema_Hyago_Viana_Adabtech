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

## Notas importantes

1. **Busca por CPF/CNPJ**: query param é `documentos` (plural), não `documento`
2. **PUT exige todos os campos** — usar PATCH para updates parciais
3. **Pessoa Física**: cpf, rg, data_nascimento, inscricoes são obrigatórios
4. **perfis**: array de objetos `{tipo_perfil: "Cliente"}`, não strings
5. **enderecos**: plural, array de objetos com `estado` (não `uf`)
6. **telefone**: `telefone_celular` e `telefone_comercial` (não `telefone`)
