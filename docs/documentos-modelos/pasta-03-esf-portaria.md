# Pasta 03 — Abatimento ESF Portaria · Fechamento dos modelos

**Pasta Drive (oficial):** `1NJ8OYXhn2ZhScyGfyiLbJjQpLh0zDdiq`
**Status:** fechada para teste em 2026-07-08 · 4 modelos · 1 estrutura (Requerimento)

## Diferenças em relação às Pastas 01 e 02

- Como a Pasta 02, tem **apenas Requerimentos** (4), **sem Declaração**.
- A prova da área prioritária aqui é a **Portaria Conjunta nº 3/2013 do Ministério da Saúde** (texto fixo: *"em uma área prioritária, assim definida pela Portaria Conjunta nº 3/2013 do Ministério da Saúde"*). — Na 01 era a declaração do Secretário; na 02, os dados do IBGE.
- Frase da atuação um pouco diferente: feminino *"como médica da estratégia de saúde da família, **localizada** no município de X"*; masculino *"como médico da estratégia de saúde da família **no** município de X"*.
- Fecho: *"do saldo devedor do **contrato FIES** pelo período trabalhado"*.

## Dicionário de campos (mesmo esquema enxuto da Pasta 02)

| Placeholder | Grupo | Origem |
|---|---|---|
| `<dados pessoais da médica/do médico - obrigatório>` | 🟢 | Cadastro: nome + nacionalidade + RG* + CPF + endereço |
| `<município - obrigatório>` (repete: prosa + "Município da UBS") | 🟡 | Campo do caso |
| `<UBS de atuação - obrigatório>` | 🟡 | Campo do caso |
| `<período trabalhado - obrigatório>` (repete: prosa + "Período trabalhado") | 🟡 | Campo do caso |
| `<CNES do local - obrigatório>` | 🟡 | Campo do caso |
| `<data - obrigatório>` | auto | Data de geração |
| Advogado assinante | fixo | Hyago Alves Viana, OAB/DF 49.122 |

`*` RG ainda não existe no cadastro (mesma pendência).

> **Gênero** e **situação (Ativo/Inativo)** ficam fixos em cada um dos 4 modelos. Placeholders **sem espaço interno**.
>
> 🔴 **Caso de 2+ UBS:** quando o médico atuou em mais de uma unidade, o requerimento repete o bloco *Nome da UBS / Período trabalhado / CNES* (e usa "Município **das** UBS"). O modelo padrão abaixo cobre **1 UBS**; para 2+, o usuário **duplica o bloco** no Word gerado (o motor de placeholder não faz grupos repetíveis). Se isso for frequente, dá pra criar um modelo "2 UBS" à parte — me avise.

---

## Os 4 modelos (colar cada um no Google Doc correspondente)

### 1) Requerimento Previsto na Portaria Feminino Ativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento e Suspensão Mensal de 1% do Saldo Devedor do FIES – Médica Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais da médica - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária e a suspensão das parcelas mensais de amortização do contrato do FIES, tendo em vista que trabalha de forma ininterrupta desde <período trabalhado - obrigatório>, como médica da estratégia de saúde da família, localizada no município de <município - obrigatório>, onde mantém vínculo ativo.

A requerente declara que se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES e a suspensão das parcelas de amortização do contrato do FIES, tendo em vista que trabalha na Estratégia Saúde da Família (ESF) em uma área prioritária, assim definida pela Portaria Conjunta nº 3/2013 do Ministério da Saúde.

Município da UBS: <município - obrigatório>;

Nome da UBS: <UBS de atuação - obrigatório>;

Período trabalhado: <período trabalhado - obrigatório>;

CNES: <CNES do local - obrigatório>;

Ativo/Inativo na unidade: Ativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº 12.202/2010 e ratificado na Lei 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO e a SUSPENSÃO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do contrato FIES pelo período trabalhado, bem como a imediata suspensão das parcelas mensais de amortização do contrato do FIES.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

### 2) Requerimento Previsto na Portaria Feminino Inativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento Mensal de 1% do Saldo Devedor do FIES – Médica Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais da médica - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária, tendo em vista que trabalhou de forma ininterrupta entre <período trabalhado - obrigatório>, como médica da estratégia de saúde da família, localizada no município de <município - obrigatório>.

A requerente declara que se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES, tendo em vista que trabalhou na Estratégia Saúde da Família (ESF) em uma área prioritária, assim definida pela Portaria Conjunta nº 3/2013 do Ministério da Saúde.

Município da UBS: <município - obrigatório>;

Nome da UBS: <UBS de atuação - obrigatório>;

Período trabalhado: <período trabalhado - obrigatório>;

CNES: <CNES do local - obrigatório>;

Ativo/Inativo na unidade: Inativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº 12.202/2010 e ratificado na Lei 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do contrato FIES pelo período trabalhado.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

### 3) Requerimento Previsto na Portaria Masculino Ativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento e Suspensão Mensal de 1% do Saldo Devedor do FIES – Médico Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais do médico - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária e a suspensão das parcelas mensais de amortização do contrato do FIES, tendo em vista que trabalha de forma ininterrupta desde <período trabalhado - obrigatório>, como médico da estratégia de saúde da família no município de <município - obrigatório>, onde mantém vínculo ativo.

O requerente declara que se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES e a suspensão das parcelas de amortização do contrato do FIES, tendo em vista que trabalha na Estratégia Saúde da Família (ESF) em uma área prioritária, assim definida pela Portaria Conjunta nº 3/2013 do Ministério da Saúde.

Município da UBS: <município - obrigatório>;

Nome da UBS: <UBS de atuação - obrigatório>;

Período trabalhado: <período trabalhado - obrigatório>;

CNES: <CNES do local - obrigatório>;

Ativo/Inativo na unidade: Ativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº 12.202/2010 e ratificado na Lei 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO e a SUSPENSÃO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do contrato FIES pelo período trabalhado, bem como a imediata suspensão das parcelas mensais de amortização do contrato do FIES.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

### 4) Requerimento Previsto na Portaria Masculino Inativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento Mensal de 1% do Saldo Devedor do FIES – Médico Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais do médico - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária, tendo em vista que trabalhou de forma ininterrupta entre <período trabalhado - obrigatório>, como médico da estratégia de saúde da família no município de <município - obrigatório>.

O requerente declara que se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES, tendo em vista que trabalhou na Estratégia Saúde da Família (ESF) em uma área prioritária, assim definida pela Portaria Conjunta nº 3/2013 do Ministério da Saúde.

Município da UBS: <município - obrigatório>;

Nome da UBS: <UBS de atuação - obrigatório>;

Período trabalhado: <período trabalhado - obrigatório>;

CNES: <CNES do local - obrigatório>;

Ativo/Inativo na unidade: Inativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº 12.202/2010 e ratificado na Lei 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do contrato FIES pelo período trabalhado.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

---

## Como testar
1. Colar cada modelo no Google Doc correspondente na pasta `1NJ8OY…` (ESF Portaria).
2. **Sincronizar modelos** → **Gerar documento → Documento do caso → Abatimento ESF Portaria → [documento]** → preencher → Word.
3. Conferir os `<…>`. Para caso de 2+ UBS, duplicar o bloco UBS/Período/CNES no Word.
