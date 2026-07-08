# Pasta 04 — Abatimento Militar · Fechamento dos modelos

**Pasta Drive (oficial):** `1cxylOE61H2PuMI-cii2b5Vn-Dh4pIoLI`
**Status:** fechada para teste em 2026-07-08 · 2 modelos (1 Declaração + 1 Requerimento)

## Diferenças em relação às outras pastas

- **Só 2 documentos**, **sem split** de gênero/Ativo-Inativo (o modelo é do médico militar, masculino). Se precisar de versão feminina ("médica militar"), dá pra criar depois.
- **Base legal própria:** abatimento pela **atuação como médico militar** (art. 6º-B, inciso II, da Lei nº 10.260/2001) — não é ESF/censo/portaria.
- **A Declaração é assinada pelo DIRETOR da unidade militar** (ex.: Diretor do Hospital Naval), não por Secretário de Saúde. Campos novos: **unidade de exercício** (hospital militar), **carga horária**, **nome/cargo do diretor**, **IBGE** e **cidade**.

## 🚩 Ponto para você decidir (não mexi sozinho no texto jurídico)
O **cabeçalho do Requerimento** herdou o texto de ESF: *"Médico Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%"*. O corpo é 100% militar (Forças Armadas, art. 6º-B). Deixei o cabeçalho **fiel ao original**. Se quiser, troco por algo como *"Atuação como Médico Militar das Forças Armadas"* — me confirma.

## Dicionário de campos

**Declaração Militar**
| Placeholder | Grupo | Origem |
|---|---|---|
| `<dados pessoais do médico - obrigatório>` | 🟢 | Cadastro (nome, nacionalidade, RG*, CPF, endereço) |
| `<unidade de exercício - obrigatório>` | 🟡 | Campo do caso (hospital/unidade militar) |
| `<CNES do local - obrigatório>` | 🟡 | Campo do caso |
| `<município - obrigatório>` | 🔵/🟡 | Cidade (chave da tabela de municípios p/ o IBGE) |
| `<IBGE - obrigatório>` | 🔵 | Tabela de municípios |
| `<período trabalhado - obrigatório>` | 🟡 | Campo do caso |
| `<carga horária - obrigatório>` | 🟡 | Campo do caso (ex.: 30 horas) |
| `<data - obrigatório>` | auto | Data de geração |
| `<nome do diretor - obrigatório>` | 🟡 | Quem assina a declaração |
| `<cargo do diretor - obrigatório>` | 🟡 | Ex.: Diretor do Hospital Naval de Brasília |

**Requerimento 1% Militar**
| Placeholder | Grupo | Origem |
|---|---|---|
| `<dados pessoais do médico - obrigatório>` | 🟢 | Cadastro |
| `<período trabalhado - obrigatório>` (repete) | 🟡 | Campo do caso |
| `<município - obrigatório>` (repete) | 🟡 | Campo do caso |
| `<unidade de exercício - obrigatório>` | 🟡 | Hospital/unidade militar |
| `<CNES do local - obrigatório>` | 🟡 | Campo do caso |
| `<data - obrigatório>` | auto | Brasília - DF (fixo) + data |
| Advogado assinante | fixo | Hyago Alves Viana, OAB/DF 49.122 |

`*` RG ainda não existe no cadastro. Placeholders **sem espaço interno**.

---

## Os 2 modelos (colar cada um no Google Doc correspondente)

### 1) Declaração Militar

```
DECLARAÇÃO

Atesto, para os devidos fins, especialmente para comprovação junto ao Ministério da Saúde e demais órgãos competentes para fins de concessão do abatimento mensal de 1% (um por cento) do saldo devedor do FIES, nos termos do art. 6º-B, inciso II, da Lei nº 10.260/2001, que <dados pessoais do médico - obrigatório>, atua como MÉDICO MILITAR DAS FORÇAS ARMADAS, em efetivo exercício profissional no <unidade de exercício - obrigatório>, inscrito no CNES nº: <CNES do local - obrigatório>, localizado na cidade de <município - obrigatório> (IBGE <IBGE - obrigatório>).

Declaro, ainda, que o profissional exerce suas atividades de forma contínua e ininterrupta no período compreendido entre <período trabalhado - obrigatório>, cumprindo carga horária semanal de <carga horária - obrigatório>, em conformidade com as normas internas das Forças Armadas e com as exigências previstas na legislação aplicável ao Programa de Financiamento Estudantil - FIES.

A atuação profissional ora declarada ocorre no âmbito do serviço público de saúde prestado pelas Forças Armadas, conforme previsão expressa do art. 6º-B, inciso II, da Lei nº 10.260/2001, incluída pela legislação vigente, que equipara o médico militar aos demais profissionais com direito ao abatimento de 1% do FIES.

Por verdade, firmo a presente declaração para produzir seus efeitos legais.

<município - obrigatório>, <data - obrigatório>.

_____________________________________
<nome do diretor - obrigatório>
<cargo do diretor - obrigatório>
```

### 2) Requerimento 1% Militar

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento e Suspensão mensal de 1% do saldo devedor do FIES – Médico Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais do médico - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES e a suspensão das parcelas mensais de amortização do contrato FIES por trabalhar como médico militar nas Forças Armadas, tendo em vista que trabalha de forma ininterrupta desde <período trabalhado - obrigatório>, onde mantém vínculo ativo, como médico militar na cidade de <município - obrigatório>.

O requerente se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES e a suspensão das parcelas de amortização do contrato do FIES, tendo em vista que trabalha como médico militar das Forças Armadas, conforme comprovo com os documentos em anexo, em especial a declaração assinada pela autoridade responsável e competente.

Município da UBS: <município - obrigatório>;

Nome da UBS: <unidade de exercício - obrigatório>;

Período trabalhado: <período trabalhado - obrigatório>;

CNES: <CNES do local - obrigatório>;

Ativo/Inativo na unidade: Ativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº 12.202/2010 e ratificado na Lei 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO e a SUSPENSÃO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do FIES pelo período trabalhado, bem como a imediata suspensão das parcelas mensais de amortização do contrato do FIES.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

---

## Como testar
1. Colar cada modelo no Google Doc correspondente na pasta `1cxylO…` (Abatimento Militar).
2. **Sincronizar modelos** → **Gerar documento → Documento do caso → Abatimento Militar → [documento]** → preencher → Word.
3. Conferir os `<…>`.
