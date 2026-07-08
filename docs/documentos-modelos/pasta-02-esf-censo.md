# Pasta 02 — Abatimento ESF Censo 05 · Fechamento dos modelos

**Pasta Drive (oficial):** `1AQjL14THUGA5MyJ_9JXB8c4a2OTLGIAL`
**Status:** fechada para teste em 2026-07-08 · 4 modelos · 1 estrutura (Requerimento)

## Diferenças em relação à Pasta 01 (ESF DGM)

- A Pasta 02 tem **apenas Requerimentos** (4), **sem Declaração**. Motivo: o CENSO 5 comprova a área prioritária por **dados do IBGE** (texto fixo: *"conforme confirmado com dados do IBGE pelo Ministério da Saúde"*), e **não** por uma declaração assinada pelo Secretário Municipal de Saúde.
- Logo, este modelo **não tem** as variáveis de município do tipo população/densidade/salário/percentual/IBGE/secretário/perfil. Ele é o esquema **enxuto** do requerimento.
- Texto próprio: *"O/A requerente **declara** que se enquadra…"* e *"Lei nº: 12.202/2010"* (com dois-pontos). É um modelo distinto do requerimento da Pasta 01.

## Dicionário de campos (placeholder → origem)

| Placeholder | Grupo | Origem |
|---|---|---|
| `<dados pessoais da médica/do médico - obrigatório>` | 🟢 | Cadastro: nome + nacionalidade + RG* + CPF + endereço |
| `<município - obrigatório>` (repete: prosa + "Município da UBS") | 🟡 | Campo do caso (município da UBS) |
| `<UBS de atuação - obrigatório>` | 🟡 | Campo do caso |
| `<período trabalhado - obrigatório>` (repete: prosa + "Período trabalhado") | 🟡 | Campo do caso |
| `<CNES do local - obrigatório>` | 🟡 | Campo do caso |
| `<data - obrigatório>` | auto | Data de geração |
| Advogado assinante | fixo | Hyago Alves Viana, OAB/DF 49.122 |

`*` RG ainda não existe no cadastro (mesma pendência da Pasta 01).

> **Gênero** (médica/médico, A/O requerente) e **situação** (Ativo/Inativo) ficam **fixos no texto de cada um dos 4 modelos** — o usuário escolhe o documento certo, sem seletor.
>
> ⚠️ **Placeholders sem espaço interno** — depois do bug da Pasta 01, todos os `<...>` abaixo são limpos (`<campo>`, nunca `< campo >`). O código já tolera espaços, mas manter limpo evita qualquer risco.

---

## Os 4 modelos (colar cada um no Google Doc correspondente)

### 1) Requerimento CENSO 5 Feminino Ativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento e Suspensão Mensal de 1% do Saldo Devedor do FIES – Médica Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais da médica - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária e a suspensão das parcelas mensais de amortização do contrato do FIES, tendo em vista que trabalha de forma ininterrupta desde <período trabalhado - obrigatório>, como médica da estratégia de saúde da família no município de <município - obrigatório>, onde mantém vínculo ativo.

A requerente declara que se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES e a suspensão das parcelas de amortização do contrato do FIES, tendo em vista que trabalha na Estratégia Saúde da Família (ESF) em uma área prioritária, que inclusive faz parte dos 20% mais pobres do município, conforme confirmado com dados do IBGE pelo Ministério da Saúde.

Município da UBS: <município - obrigatório>;

Nome da UBS: <UBS de atuação - obrigatório>;

Período trabalhado: <período trabalhado - obrigatório>;

CNES: <CNES do local - obrigatório>;

Ativo/Inativo na unidade: Ativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº: 12.202/2010 e ratificado na Lei nº: 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO e a SUSPENSÃO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do FIES pelo período trabalhado, bem como a imediata suspensão das parcelas mensais de amortização do contrato do FIES.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

### 2) Requerimento CENSO 5 Feminino Inativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento Mensal de 1% do Saldo Devedor do FIES – Médica Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais da médica - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária, tendo em vista que trabalhou de forma ininterrupta entre <período trabalhado - obrigatório>, como médica da estratégia de saúde da família no município de <município - obrigatório>.

A requerente declara que se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES, tendo em vista que trabalhou na Estratégia Saúde da Família (ESF) em uma área prioritária, que inclusive faz parte dos 20% mais pobres do município, conforme confirmado com dados do IBGE pelo Ministério da Saúde.

Município da UBS: <município - obrigatório>;

Nome da UBS: <UBS de atuação - obrigatório>;

Período trabalhado: <período trabalhado - obrigatório>;

CNES: <CNES do local - obrigatório>;

Ativo/Inativo na unidade: Inativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº: 12.202/2010 e ratificado na Lei nº: 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do FIES pelo período trabalhado.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

### 3) Requerimento CENSO 5 Masculino Ativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento e Suspensão Mensal de 1% do Saldo Devedor do FIES – Médico Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais do médico - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária e a suspensão das parcelas mensais de amortização do contrato do FIES, tendo em vista que trabalha de forma ininterrupta desde <período trabalhado - obrigatório>, como médico da estratégia de saúde da família no município de <município - obrigatório>, onde mantém vínculo ativo.

O requerente declara que se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES e a suspensão das parcelas de amortização do contrato do FIES, tendo em vista que trabalha na Estratégia Saúde da Família (ESF) em uma área prioritária, que inclusive faz parte dos 20% mais pobres do município, conforme confirmado com dados do IBGE pelo Ministério da Saúde.

Município da UBS: <município - obrigatório>;

Nome da UBS: <UBS de atuação - obrigatório>;

Período trabalhado: <período trabalhado - obrigatório>;

CNES: <CNES do local - obrigatório>;

Ativo/Inativo na unidade: Ativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº: 12.202/2010 e ratificado na Lei nº: 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO e a SUSPENSÃO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do FIES pelo período trabalhado, bem como a imediata suspensão das parcelas mensais de amortização do contrato do FIES.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

### 4) Requerimento CENSO 5 Masculino Inativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento Mensal de 1% do Saldo Devedor do FIES – Médico Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais do médico - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária, tendo em vista que trabalhou de forma ininterrupta entre <período trabalhado - obrigatório>, como médico da estratégia de saúde da família no município de <município - obrigatório>.

O requerente declara que se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES, tendo em vista que trabalhou na Estratégia Saúde da Família (ESF) em uma área prioritária, que inclusive faz parte dos 20% mais pobres do município, conforme confirmado com dados do IBGE pelo Ministério da Saúde.

Município da UBS: <município - obrigatório>;

Nome da UBS: <UBS de atuação - obrigatório>;

Período trabalhado: <período trabalhado - obrigatório>;

CNES: <CNES do local - obrigatório>;

Ativo/Inativo na unidade: Inativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº: 12.202/2010 e ratificado na Lei nº: 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do FIES pelo período trabalhado.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

---

## Como testar
1. Colar cada modelo no Google Doc correspondente na pasta `1AQjL14…` (ESF Censo 05).
2. **Sincronizar modelos** → **Gerar documento → Documento do caso → Abatimento ESF Censo 05 → [documento]** → preencher → Word.
3. Conferir se todos os `<…>` foram substituídos (a data agora preenche com o fix de espaço).
