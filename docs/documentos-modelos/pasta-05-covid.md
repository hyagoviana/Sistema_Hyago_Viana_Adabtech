# Pasta 05 — Abatimento COVID · Fechamento dos modelos

**Pasta Drive (oficial):** `1NHISSQSsq17Jvlg5D-NqOnhHUgI4K4mL`
**Status:** fechada para teste em 2026-07-08 · 2 modelos (1 Declaração + 1 Requerimento)

## Diferenças em relação às outras pastas

- **Base legal da PANDEMIA:** abatimento por ter atuado na Covid-19 — art. 6º-B, **inciso III**, da Lei nº 10.260/01 (com redação da **Lei nº 14.024/2020**), Portaria GM/MS nº 188/2020 e Decreto Legislativo nº 6/2020 (ESPIN / calamidade pública). Tudo isso é **texto fixo**.
- **Declaração** assinada pelo **Secretário Municipal de Saúde** (como a Pasta 01/DGM).
- **Requerimento** assinado pelo advogado (Hyago), porém a **data/local é a cidade do médico** — não "Brasília - DF".
- **Campo novo `<percentual total>`:** *"totalizando 27% (vinte e sete por cento)"* — 1% por mês trabalhado; o total varia por cliente (nº de meses).
- **Dados pessoais** incluem **estado civil** (ex.: "solteira").
- **Só 1 modelo de cada** (Declaração + Requerimento), **sem split** de gênero/Ativo-Inativo. O modelo original está no **feminino**.

## 🚩 Ponto para você decidir — GÊNERO
Os dois modelos usam **feminino** ("médica", "a Requerente", "brasileira, solteira"). Se você atende homens nesse tipo, ou (a) criamos versões **Masculino**, ou (b) transformo as palavras de gênero em variáveis. Como foi 1 modelo só, deixei **fiel ao original (feminino)**. Me diz como prefere.

## Dicionário de campos

**Declaração COVID**
| Placeholder | Grupo | Origem |
|---|---|---|
| `<secretário municipal de saúde - obrigatório>` (repete) | 🔵 | Tabela de municípios (editável) |
| `<cargo do secretário - obrigatório>` (repete) | 🔵 | "Secretário"/"Secretária" |
| `<município - obrigatório>` (repete) | 🔵/🟡 | Cidade |
| `<dados pessoais da médica - obrigatório>` | 🟢 | Cadastro (nome, nac., estado civil, CPF, RG*, endereço) |
| `<unidade de exercício - obrigatório>` | 🟡 | Hospital/unidade SUS |
| `<CNES do local - obrigatório>` | 🟡 | Campo do caso |
| `<período trabalhado - obrigatório>` | 🟡 | Campo do caso |
| `<data - obrigatório>` | auto | Data de geração |

**Requerimento ADM COVID**
| Placeholder | Grupo | Origem |
|---|---|---|
| `<dados pessoais da médica - obrigatório>` | 🟢 | Cadastro |
| `<município - obrigatório>` (repete) | 🟡 | Cidade do médico |
| `<período trabalhado - obrigatório>` | 🟡 | Campo do caso |
| `<percentual total - obrigatório>` | 🟡 | Total de meses = % (ex.: "27% (vinte e sete por cento)") |
| `<data - obrigatório>` | auto | Cidade do médico + data |
| Advogado assinante | fixo | Hyago Alves Viana, OAB/DF 49.122 |

`*` RG ainda não existe no cadastro. Placeholders **sem espaço interno**.

---

## Os 2 modelos (colar cada um no Google Doc correspondente)

### 1) Declaração COVID - Modelo

```
DECLARAÇÃO

Eu, <secretário municipal de saúde - obrigatório>, na condição de <cargo do secretário - obrigatório> Municipal de Saúde do Município de <município - obrigatório>, DECLARO para os devidos fins que <dados pessoais da médica - obrigatório>, trabalhou como médica no âmbito do Sistema Único de Saúde – SUS no <unidade de exercício - obrigatório> (CNES <CNES do local - obrigatório>), neste Município, na linha de frente do combate à pandemia causada pela Covid-19, no período de Emergência em Saúde Pública de Importância Nacional (ESPIN), decretado pela Portaria GM/MS n. 188, de 3 de fevereiro de 2020, e pelo Decreto Legislativo n. 6, de 20 de março de 2020, que reconheceu o Estado de Calamidade Pública em decorrência da pandemia da Covid-19, de forma ininterrupta, <período trabalhado - obrigatório>.

<município - obrigatório>, <data - obrigatório>.

_____________________________________
<secretário municipal de saúde - obrigatório>
<cargo do secretário - obrigatório> Municipal de Saúde de <município - obrigatório>
```

### 2) Requerimento ADM COVID

```
AO MINISTÉRIO DA SAÚDE, DEPARTAMENTO DE SAÚDE DA FAMÍLIA – SECRETARIA DE ATENÇÃO PRIMÁRIA À SAÚDE – DESF/SAPS

Assunto: Solicitação de Abatimento Mensal de 1% do Saldo Devedor Consolidado do FIES para Profissional de Saúde que Trabalhou na Pandemia da Covid-19.

REQUERIMENTO ADMINISTRATIVO

<dados pessoais da médica - obrigatório>, por intermédio de seu advogado infra-assinado (procuração anexa), vem, por meio deste requerimento administrativo, solicitar o abatimento mensalmente de 1% (um por cento) do saldo devedor consolidado da dívida do FIES, incluídos os juros devidos no período, nos termos do art. 6º-B, inciso III, da Lei n. 10.260/01, com redação alterada pela Lei n. 14.024/2020, por ter trabalhado como Médica no âmbito do Sistema Único de Saúde (SUS) durante o período de vigência da emergência sanitária decorrente da pandemia da Covid-19, decretada pela Portaria n. 188/2020 e pelo Decreto Legislativo n. 6/2020, no Município de <município - obrigatório>, de forma ininterrupta, pelo período de <período trabalhado - obrigatório>, conforme comprovado pela documentação anexa.

Dessa forma, a Requerente pugna pela concessão do benefício do abatimento mensalmente de 1% (um por cento) do saldo devedor consolidado da dívida do FIES para cada mês trabalhado, totalizando <percentual total - obrigatório>, a ser descontado do valor global do saldo devedor, nos termos do art. 6º-B, inciso III, da Lei n. 10.260/01.

Nesses termos,

Pede deferimento.

<município - obrigatório>, <data - obrigatório>.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

---

## Como testar
1. Colar cada modelo no Google Doc correspondente na pasta `1NHISS…` (Abatimento COVID).
2. **Sincronizar modelos** → **Gerar documento → Documento do caso → Abatimento COVID → [documento]** → preencher → Word.
3. Conferir os `<…>`. Atenção ao `<percentual total>` (ex.: "27% (vinte e sete por cento)").
