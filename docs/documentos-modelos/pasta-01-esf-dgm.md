# Pasta 01 — Abatimento ESF DGM · Fechamento dos modelos

**Pasta Drive (oficial):** `16ySv_cUciMNT9_YzrtAAsp8OwTReYRmI`
**Status:** fechada para teste em 2026-07-08 · 8 modelos · 2 estruturas (Declaração + Requerimento)

## Contexto (o problema que isto resolve)

Os arquivos atuais na pasta **não são modelos** — são documentos antigos já preenchidos com dados de clientes anteriores (São Paulo/Bruna, Matinhos/Otavio, etc.). Por isso a geração não preenche nada: não há `<placeholders>` para o sistema substituir. Este documento reescreve os 8 como modelos de verdade.

**Regra do fluxo:** o usuário escolhe **exatamente qual** dos 8 documentos gerar (Ativa/Inativa × Feminina/Masculina × Declaração/Requerimento). Logo, gênero e situação (ativo/inativo) já ficam **fixos no texto de cada modelo** — não há seletor, não há condicional. Cada documento continua sendo o seu próprio modelo.

---

## Dicionário de campos (placeholder → origem)

| Placeholder | Grupo | Origem do valor |
|---|---|---|
| `<município - obrigatório>` | 🟡/🔵 | Município da atuação (campo do caso + chave da tabela de municípios). Repete no doc; preenche 1×. |
| `<população - obrigatório>` | 🔵 | Tabela de municípios (editável) |
| `<densidade demográfica - obrigatório>` | 🔵 | Tabela de municípios (editável) |
| `<salário médio - obrigatório>` | 🔵 | Tabela de municípios (editável) |
| `<percentual da população - obrigatório>` | 🔵 | Tabela de municípios (editável) |
| `<IBGE - obrigatório>` | 🔵 | Tabela de municípios (editável) |
| `<secretário municipal de saúde - obrigatório>` | 🔵 | Tabela de municípios (editável). Repete (corpo + assinatura). |
| `<cargo do secretário - obrigatório>` | 🔵 | "Secretário" ou "Secretária" (ver nota 2 abaixo) |
| `<dados pessoais da médica/do médico - obrigatório>` | 🟢 | Cadastro do cliente: nome + nacionalidade + RG* + CPF + endereço |
| `<nome da médica/do médico - obrigatório>` | 🟢 | Cadastro (nome) |
| `<UBS de atuação - obrigatório>` | 🟡 | Campo do caso |
| `<CNES do local - obrigatório>` | 🟡 | Campo do caso |
| `<período de vínculo - obrigatório>` | 🟡 | Campo do caso (ver nota 3) |
| `<período trabalhado - obrigatório>` | 🟡 | Campo do caso |
| `<nº do perfil - obrigatório>` | 🟡 | Campo do caso / tabela de perfis (PERFIL 2/3/7…) |
| `<informações sobre o perfil - obrigatório>` | 🟡 | Tabela de perfis (texto-padrão vinculado ao nº do perfil) |
| `<data - obrigatório>` | auto | Data de geração |

`*` **RG ainda não existe no cadastro** do cliente — precisa ser adicionado para o autofill completo.

**Grupos:** 🟢 já vem do cadastro · 🔵 tabela de municípios · 🟡 campo do caso. Todos editáveis antes de gerar.

> **Testável AGORA (sem código novo):** basta colar os modelos abaixo no Drive e sincronizar. O sistema já detecta os `<placeholders>`, abre os campos para preencher **manualmente** e gera o Word. As tabelas de municípios/perfis e o RG são a **fase de autofill** (fazem os campos 🔵/🟢 virem prontos) — entram depois que as 6 pastas estiverem mapeadas.

---

## ⚠️ Achados da leitura dos 8 (não estavam óbvios)

1. **Bug de assinatura no "Declaração Inativo Masculina" (Fabio/Guajará-Mirim):** o declarante é a **Secretária Silvane Fandinho Campos**, mas o bloco de assinatura traz **"FABIO NUNES DE SOUZA"** (o próprio médico). Erro de copiar/colar do arquivo antigo. Ao virar placeholder `<secretário municipal de saúde>`, **o bug se corrige sozinho**.

2. **Secretário × Secretária:** o cargo concorda com o gênero do **secretário**, que é independente do gênero da médica (ex.: médico Fabio + Secretária Silvane). Por isso criei `<cargo do secretário - obrigatório>` (valor "Secretário" ou "Secretária"). O cabeçalho da assinatura fica em caixa alta institucional ("SECRETÁRIO(A) MUNICIPAL DE SAÚDE DE …").

3. **`<período de vínculo>` provavelmente é lixo herdado:** nos 4 originais ele está **idêntico** ("abril de 2020 a fevereiro de 2022"), com clientes/cidades diferentes. Confirmar se deve mesmo variar por caso ou se pode ser removido do modelo.

4. **Removi anos "chumbados"** (ex.: "em 2023") que variavam entre os documentos, para não induzir erro.

---

## Os 8 modelos (colar cada um no Google Doc correspondente)

### 1) Declaração Ativa Feminina

```
DECLARAÇÃO

Considerando que o município de <município - obrigatório> possui uma população estimada de <população - obrigatório> habitantes no último Censo em 2022, com uma densidade demográfica de <densidade demográfica - obrigatório> habitantes por quilômetro quadrado.

Considerando que o salário médio dos trabalhadores é de <salário médio - obrigatório> salários mínimos, sendo <percentual da população - obrigatório> o percentual da população com rendimento nominal mensal per capita de até ½ salário mínimo (2010).

Pelo presente, <secretário municipal de saúde - obrigatório>, na condição de <cargo do secretário - obrigatório> Municipal de Saúde do município de <município - obrigatório>, DECLARA para os devidos fins que <dados pessoais da médica - obrigatório>, atua exercendo a referida profissão na Equipe de Estratégia Saúde da Família na:

<UBS de atuação - obrigatório>, no mês de <período de vínculo - obrigatório>, CBO: 225142 - MEDICO DA ESTRATEGIA DE SAUDE DA FAMILIA – CNES nº: <CNES do local - obrigatório>;

Localizada no município de <município - obrigatório> (IBGE <IBGE - obrigatório>), com carga horária semanal de 40 horas de trabalho, tendo executado atividades pelo período de <período trabalhado - obrigatório>, de forma ininterrupta.

A unidade de saúde supracitada é oriunda de setor censitário que integra o SUS (Sistema Único de Saúde) e apresenta população de baixa renda, carente por excelência. Traduz-se, pois, em área de difícil retenção de profissional médico. O município de <município - obrigatório> é beneficiado pelo programa "Mais Médicos", sendo classificado no <nº do perfil - obrigatório>: <informações sobre o perfil - obrigatório>, conforme Fundação Instituto Brasileiro de Geografia e Estatística (IBGE);

Informo que a unidade de Estratégia Saúde da Família (ESF) em que a médica atua é vinculada a Unidades Básicas de Saúde localizadas em setores censitários e que fazem parte de seu território adstrito, que compõem os 20% (vinte por cento) mais pobres do município de <município - obrigatório>, baseado nos dados do Instituto Brasileiro de Geografia e Estatística (IBGE), conforme a portaria conjunta nº 3, de 19 de fevereiro de 2013.

Declaro, pois, que a médica <nome da médica - obrigatório> está de acordo com as regras para o abatimento e suspensão do saldo devedor consolidado no âmbito do Financiamento Estudantil – FIES, atendendo os critérios hábeis ao abatimento em conformidade com as normativas: Lei nº 12.202/2010 e regulamentada pelas Portaria nº 1.377/2011 de 13 de junho de 2011; Portarias nº 203/2013, e 08 de fevereiro de 2013; Portaria Conjunta SGTES/SAS nº 3 de 19 fevereiro de 2013 e Portaria Normativa nº 7, de 26 de abril de 2013.

<município - obrigatório>, <data - obrigatório>.

_____________________________________
<secretário municipal de saúde - obrigatório>
SECRETÁRIO(A) MUNICIPAL DE SAÚDE DE <município - obrigatório>.
```

### 2) Declaração Ativo Masculino

```
DECLARAÇÃO

Considerando que o município de <município - obrigatório> possui uma população estimada de <população - obrigatório> habitantes no último Censo em 2022, com uma densidade demográfica de <densidade demográfica - obrigatório> habitantes por quilômetro quadrado.

Considerando que o salário médio dos trabalhadores é de <salário médio - obrigatório> salários mínimos, sendo <percentual da população - obrigatório> o percentual da população com rendimento nominal mensal per capita de até ½ salário mínimo (2010).

Pelo presente, <secretário municipal de saúde - obrigatório>, na condição de <cargo do secretário - obrigatório> Municipal de Saúde do município de <município - obrigatório>, DECLARA para os devidos fins que <dados pessoais do médico - obrigatório>, atua exercendo a referida profissão na Equipe de Estratégia Saúde da Família no:

<UBS de atuação - obrigatório>, no mês de <período de vínculo - obrigatório>, CBO: 225142 - MEDICO DA ESTRATEGIA DE SAUDE DA FAMILIA – CNES nº: <CNES do local - obrigatório>;

Localizada no município de <município - obrigatório> (IBGE <IBGE - obrigatório>), com carga horária semanal de 40 horas de trabalho, tendo executado atividades pelo período de <período trabalhado - obrigatório>, de forma ininterrupta.

A unidade de saúde supracitada é oriunda de setor censitário que integra o SUS (Sistema Único de Saúde) e apresenta população de baixa renda, carente por excelência. Traduz-se, pois, em área de difícil retenção de profissional médico. O município de <município - obrigatório> é beneficiado pelo programa "Mais Médicos", sendo classificado no <nº do perfil - obrigatório>: <informações sobre o perfil - obrigatório>, conforme Fundação Instituto Brasileiro de Geografia e Estatística (IBGE);

Informo que a unidade de Estratégia Saúde da Família (ESF) em que o médico atua é vinculada à Unidade Básica de Saúde localizada em setor censitário e que faz parte de seu território adstrito, que compõe os 20% (vinte por cento) mais pobres do município de <município - obrigatório>, baseado nos dados do Instituto Brasileiro de Geografia e Estatística (IBGE), conforme a portaria conjunta nº 3, de 19 de fevereiro de 2013.

Declaro, pois, que o médico <nome do médico - obrigatório> está de acordo com as regras para o abatimento e suspensão do saldo devedor consolidado no âmbito do Financiamento Estudantil – FIES, atendendo os critérios hábeis ao abatimento em conformidade com as normativas: Lei nº 12.202/2010 e regulamentada pelas Portaria nº 1.377/2011 de 13 de junho de 2011; Portarias nº 203/2013, e 08 de fevereiro de 2013; Portaria Conjunta SGTES/SAS nº 3 de 19 fevereiro de 2013 e Portaria Normativa nº 7, de 26 de abril de 2013.

<município - obrigatório>, <data - obrigatório>.

_____________________________________
<secretário municipal de saúde - obrigatório>
SECRETÁRIO(A) MUNICIPAL DE SAÚDE DE <município - obrigatório>.
```

### 3) Declaração Inativa Feminina

```
DECLARAÇÃO

Considerando que o município de <município - obrigatório> possui uma população estimada de <população - obrigatório> habitantes no último Censo em 2022, com uma densidade demográfica de <densidade demográfica - obrigatório> habitantes por quilômetro quadrado.

Considerando que o salário médio dos trabalhadores é de <salário médio - obrigatório> salários mínimos, sendo <percentual da população - obrigatório> o percentual da população com rendimento nominal mensal per capita de até ½ salário mínimo (2010).

Pelo presente, <secretário municipal de saúde - obrigatório>, na condição de <cargo do secretário - obrigatório> Municipal de Saúde do município de <município - obrigatório>, DECLARA para os devidos fins que <dados pessoais da médica - obrigatório>, atuou exercendo a referida profissão na Equipe de Estratégia Saúde da Família na:

<UBS de atuação - obrigatório>, no mês de <período de vínculo - obrigatório>, CBO: 225142 - MEDICO DA ESTRATEGIA DE SAUDE DA FAMILIA – CNES nº: <CNES do local - obrigatório>;

Localizada no município de <município - obrigatório> (IBGE <IBGE - obrigatório>), com carga horária semanal de 40 horas de trabalho, tendo executado atividades pelo período de <período trabalhado - obrigatório>, de forma ininterrupta.

A unidade de saúde supracitada é oriunda de setor censitário que integra o SUS (Sistema Único de Saúde) e apresenta população de baixa renda, carente por excelência. Traduz-se, pois, em área de difícil retenção de profissional médico. O município de <município - obrigatório> é beneficiado pelo programa "Mais Médicos", sendo classificado no <nº do perfil - obrigatório>: <informações sobre o perfil - obrigatório>, conforme Fundação Instituto Brasileiro de Geografia e Estatística (IBGE);

Informo que a unidade de Estratégia Saúde da Família (ESF) em que a médica atuou é vinculada a Unidades Básicas de Saúde localizadas em setores censitários e que fazem parte de seu território adstrito, que compõem os 20% (vinte por cento) mais pobres do município de <município - obrigatório>, baseado nos dados do Instituto Brasileiro de Geografia e Estatística (IBGE), conforme a portaria conjunta nº 3, de 19 de fevereiro de 2013.

Declaro, pois, que a médica <nome da médica - obrigatório> está de acordo com as regras para o abatimento do saldo devedor consolidado no âmbito do Financiamento Estudantil – FIES, atendendo os critérios hábeis ao abatimento em conformidade com as normativas: Lei nº 12.202/2010 e regulamentada pelas Portaria nº 1.377/2011 de 13 de junho de 2011; Portarias nº 203/2013, e 08 de fevereiro de 2013; Portaria Conjunta SGTES/SAS nº 3 de 19 fevereiro de 2013 e Portaria Normativa nº 7, de 26 de abril de 2013.

<município - obrigatório>, <data - obrigatório>.

_____________________________________
<secretário municipal de saúde - obrigatório>
SECRETÁRIO(A) MUNICIPAL DE SAÚDE DE <município - obrigatório>.
```

### 4) Declaração Inativo Masculina

```
DECLARAÇÃO

Considerando que o município de <município - obrigatório> possui uma população estimada de <população - obrigatório> habitantes no último Censo em 2022, com uma densidade demográfica de <densidade demográfica - obrigatório> habitantes por quilômetro quadrado.

Considerando que o salário médio dos trabalhadores é de <salário médio - obrigatório> salários mínimos, sendo <percentual da população - obrigatório> o percentual da população com rendimento nominal mensal per capita de até ½ salário mínimo (2010).

Pelo presente, <secretário municipal de saúde - obrigatório>, na condição de <cargo do secretário - obrigatório> Municipal de Saúde do município de <município - obrigatório>, DECLARA para os devidos fins que <dados pessoais do médico - obrigatório>, atuou exercendo a referida profissão na Equipe de Estratégia Saúde da Família no:

<UBS de atuação - obrigatório>, no mês de <período de vínculo - obrigatório>, CBO: 225142 - MEDICO DA ESTRATEGIA DE SAUDE DA FAMILIA – CNES nº: <CNES do local - obrigatório>;

Localizada no município de <município - obrigatório> (IBGE <IBGE - obrigatório>), com carga horária semanal de 40 horas de trabalho, tendo executado atividades pelo período de <período trabalhado - obrigatório>, de forma ininterrupta.

A unidade de saúde supracitada é oriunda de setor censitário que integra o SUS (Sistema Único de Saúde) e apresenta população de baixa renda, carente por excelência. Traduz-se, pois, em área de difícil retenção de profissional médico. O município de <município - obrigatório> é beneficiado pelo programa "Mais Médicos", sendo classificado no <nº do perfil - obrigatório>: <informações sobre o perfil - obrigatório>, conforme Fundação Instituto Brasileiro de Geografia e Estatística (IBGE);

Informo que a unidade de Estratégia Saúde da Família (ESF) em que o médico atuou é vinculada à Unidade Básica de Saúde localizada em setor censitário e que faz parte de seu território adstrito, que compõe os 20% (vinte por cento) mais pobres do município de <município - obrigatório>, baseado nos dados do Instituto Brasileiro de Geografia e Estatística (IBGE), conforme a portaria conjunta nº 3, de 19 de fevereiro de 2013.

Declaro, pois, que o médico <nome do médico - obrigatório> está de acordo com as regras para o abatimento do saldo devedor consolidado no âmbito do Financiamento Estudantil – FIES, atendendo os critérios hábeis ao abatimento em conformidade com as normativas: Lei nº 12.202/2010 e regulamentada pelas Portaria nº 1.377/2011 de 13 de junho de 2011; Portarias nº 203/2013, e 08 de fevereiro de 2013; Portaria Conjunta SGTES/SAS nº 3 de 19 fevereiro de 2013 e Portaria Normativa nº 7, de 26 de abril de 2013.

<município - obrigatório>, <data - obrigatório>.

_____________________________________
<secretário municipal de saúde - obrigatório>
SECRETÁRIO(A) MUNICIPAL DE SAÚDE DE <município - obrigatório>.
```

### 5) Requerimento Declaração Feminino Ativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento e Suspensão Mensal de 1% do Saldo Devedor do FIES – Médica Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais da médica - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária e a suspensão das parcelas mensais de amortização do contrato do FIES, tendo em vista que trabalha de forma ininterrupta desde <período trabalhado - obrigatório>, como médica da estratégia de saúde da família no município de <município - obrigatório>, onde mantém vínculo ativo.

A requerente se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES e a suspensão das parcelas de amortização do contrato do FIES, tendo em vista que trabalha na Estratégia Saúde da Família (ESF) em uma área prioritária, que inclusive faz parte dos 20% mais pobres do município, conforme comprovo com os documentos em anexo, em especial a declaração assinada e com firma reconhecida da secretaria municipal de saúde do município de <município - obrigatório>.

Município da UBS: <município - obrigatório>;
Nome da UBS: <UBS de atuação - obrigatório>;
Período trabalhado: <período trabalhado - obrigatório>;
CNES: <CNES do local - obrigatório>;
Ativo/Inativo nas unidades: Ativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº 12.202/2010 e ratificado na Lei 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO e a SUSPENSÃO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do FIES pelo período trabalhado, bem como a imediata suspensão das parcelas mensais de amortização do contrato do FIES.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

### 6) Requerimento Declaração Feminino Inativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento Mensal de 1% do Saldo Devedor do FIES – Médica Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais da médica - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária, tendo em vista que trabalhou de forma ininterrupta entre <período trabalhado - obrigatório>, como médica da estratégia de saúde da família no município de <município - obrigatório>.

A requerente se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES, tendo em vista que trabalhou na Estratégia Saúde da Família (ESF) em uma área prioritária, que inclusive faz parte dos 20% mais pobres do município, conforme comprovo com os documentos em anexo, em especial a declaração assinada e com firma reconhecida da secretaria municipal de saúde do município de <município - obrigatório>.

Município da UBS: <município - obrigatório>;
Nome da UBS: <UBS de atuação - obrigatório>;
Período trabalhado: <período trabalhado - obrigatório>;
CNES: <CNES do local - obrigatório>;
Ativo/Inativo nas unidades: Inativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº 12.202/2010 e ratificado na Lei 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do FIES pelo período trabalhado.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

### 7) Requerimento Declaração Masculino Ativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento e Suspensão mensal de 1% do saldo devedor do FIES – Médico Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais do médico - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária e a suspensão das parcelas mensais de amortização do contrato do FIES, tendo em vista que trabalha de forma ininterrupta desde <período trabalhado - obrigatório>, como médico da estratégia de saúde da família no município de <município - obrigatório>, onde mantém vínculo ativo.

O requerente se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES e a suspensão das parcelas de amortização do contrato do FIES, tendo em vista que trabalha na Estratégia Saúde da Família (ESF) em uma área prioritária, que inclusive faz parte dos 20% mais pobres do município, conforme comprovo com os documentos em anexo, em especial a declaração assinada e com firma reconhecida da secretaria municipal de saúde do município de <município - obrigatório>.

Município da UBS: <município - obrigatório>;
Nome da UBS: <UBS de atuação - obrigatório>;
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

### 8) Requerimento Declaração Masculino Inativo

```
Ao Ministério da Saúde, Departamento de Saúde da Família - Secretaria de Atenção Primária à Saúde – DESF/SAPS

REQUERIMENTO ADMINISTRATIVO – FIES

Abatimento Mensal de 1% do Saldo Devedor do FIES – Médico Integrante de Equipe Saúde da Família Localizada em Setor Censitário – 20%

<dados pessoais do médico - obrigatório>, vem por meio deste requerimento, juntamente com seu procurador (procuração anexa), solicitar o abatimento de 1% do saldo devedor do FIES por trabalhar na atenção primária em área prioritária, tendo em vista que trabalhou de forma ininterrupta entre <período trabalhado - obrigatório>, como médico da estratégia de saúde da família no município de <município - obrigatório>.

O requerente se enquadra nos requisitos exigidos para o abatimento de 1% do saldo devedor do FIES, tendo em vista que trabalhou na Estratégia Saúde da Família (ESF) em uma área prioritária, que inclusive faz parte dos 20% mais pobres do município, conforme comprovo com os documentos em anexo, em especial a declaração assinada e com firma reconhecida da secretaria municipal de saúde do município de <município - obrigatório>.

Município da UBS: <município - obrigatório>;
Nome da UBS: <UBS de atuação - obrigatório>;
Período trabalhado: <período trabalhado - obrigatório>;
CNES: <CNES do local - obrigatório>;
Ativo/Inativo na unidade: Inativo.

Comprovo o alegado, com os documentos em anexo.

Dessa forma, conforme previsto pela Lei nº 12.202/2010 e ratificado na Lei 13.366, de 2016, os médicos que financiaram o curso pelo Fundo de Financiamento Estudantil (FIES), possuem direito de solicitar o ABATIMENTO mensal de 1% do saldo devedor.

Diante do exposto, venho requerer que seja feito o abatimento mensal de 1% do saldo devedor do FIES pelo período trabalhado.

Brasília - DF, <data - obrigatório>.

Atenciosamente.

_____________________________________
HYAGO ALVES VIANA
OAB/DF N. 49.122
```

---

## Como testar agora

1. Abrir cada um dos 8 Google Docs na pasta `16ySv…` (Abatimento ESF DGM).
2. Selecionar tudo, apagar e colar o modelo correspondente acima.
3. No sistema: **Configurações → Sincronizar modelos** (varre a pasta e registra os `<placeholders>` como campos).
4. Num caso: **Gerar documento → Documento do caso → Abatimento ESF DGM → [documento] →** preencher os campos → **Gerar e abrir no Word**.
5. Conferir no Word se todos os `<…>` foram substituídos.

## Fase de autofill (depois de mapear as 6 pastas)
- **Tabela de municípios**: `<município>` → população, densidade, salário médio, %, IBGE, secretário (+ cargo).
- **Tabela de perfis**: `<nº do perfil>` → `<informações sobre o perfil>`.
- **Campo RG** no cadastro do cliente (compõe `<dados pessoais>`).
- **Campos do caso**: UBS, CNES, período de vínculo, período trabalhado, nº do perfil.
