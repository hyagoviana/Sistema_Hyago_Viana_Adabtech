# Respostas do Thiago — 04/09/2026

Retorno das perguntas de `perguntas-para-thiago-2026-09-03.md`, por WhatsApp, com 4 imagens.
**Três respostas mudam decisões que já estavam travadas** — estão marcadas com ⚠️.

---

## A1 ⚠️ — Andamentos duplicados: a proposta anterior foi RECUSADA

A decisão D9 (1 card agrupado, 1 tarefa, arquiva as irmãs) **não vale mais**. Ele explicou por quê:

> "entendi a ideia, mas acho que ela não atende a metodologia que já existe no SHV/Projuris. Existem 2
> situações/etapas diferentes: o quê fazer com a intimação; se ela gera tarefa ou não. Independentemente
> da intimação gerar tarefa, ela vai ser arquivada após ser conferida. O gerar tarefa é uma outra
> funcionalidade."

E o problema real não é a tarefa duplicada — é o **retrabalho de leitura**:

> "A questão da exibição repetida da intimação é que visualmente a pessoa vê tudo, e precisa lembrar se já
> olhou aquele processo ou não, então gera retrabalho."

### O fluxo que ele definiu

1. sistema recebe as intimações do dia;
2. identifica **repetidas no dia, do mesmo PROCESSO** (não da mesma publicação);
3. lista **apenas a primeira**, deixa as outras "em stand by";
4. recebe a decisão (arquivar direto **ou** distribuir tarefa) e vincula a tarefa à intimação visualizada;
5. **no ProJuris**, arquiva tanto a distribuída quanto as ocultadas — "movimento normal que todas as
   intimações devem ter";
6. **no SHV**, a que gerou a tarefa fica vinculada (histórico) e as outras ficam com status
   **"arquivado por repetição"**, que é diferente de "arquivado".

> "A partir da tomada de decisão em 1 qualquer das intimações, essa tarefa não tem vínculo direto com a
> intimação que veio, mas sim com o processo. Então na prática não tem diferença de qual intimação veio."

**Impacto medido no banco:** 674 intimações viram **458 grupos** (processo + dia) — 32% a menos de
linhas para conferir. Há processos com **7 intimações no mesmo dia**.

---

## A2 — Um responsável por caso

> "vamos manter que cada caso pode ter apenas 1 responsável para fins das funções do SHV"

**Não quebra nada:** hoje, dos casos com responsável, **nenhum tem mais de um** (4 casos, 1 responsável
cada). A proposta do alerta para "2 ou mais" deixa de ser necessária.

---

## A3 — Feriados nacionais automáticos: sim

> "pode carregar os feriados nacionais automaticamente, beleza."

---

## B1 — Assunto do ProJuris: preenchido à mão, por tema

> "Tinha deixado no arquivo a ideia dessa vinculação tema SHV - Assunto Projuris como algo para
> preenchermos na mão e ajustável (conforme fizemos com as serviços/centros de custo do projuris, por
> tema. Facilita conforme formos criando/importando ou próximos temas, fica melhor que repassar a tabela
> agora e ter que repetir a cada próximo tema."

**Fallback:** assunto **"CÍVEIS"**, que já existe no ProJuris — mas ele **não achou um identificador
sistêmico** para ele, então o campo precisa aceitar texto.

---

## B2 ⚠️ — Drive: pode apagar tudo, e a estrutura é outra

> "Todos os modelos tem que estar vinculado a um tema (o tema 'cíveis' é o 'fallback geral', encaixamos
> aqui tudo que não encaixe em outro). **Não precisa se preocupar com os arquivos modelos que já existem
> no SHV, podem apagar tudo, todos que estão ai são de testes e temos as cópias.**"

Isso **derruba o risco da S2-04**: não é mais uma migração delicada de arquivos em uso — é apagar o que é
teste e criar a estrutura nova.

### Estrutura nova (imagem)

```
PASTA DO TEMA
├── TIPO 1
│   └── MODELOS
│       ├── JUDICIAL
│       ├── CONTRATO E PROCURAÇÃO
│       └── ADMINISTRATIVO
└── TIPO 2
    └── MODELOS
        ├── JUDICIAL
        ├── CONTRATO E PROCURAÇÃO
        └── ADMINISTRATIVO
```

> "Com essa subdivisão de pastas, conseguimos categorizar melhor os modelos e dar mais eficiência no uso
> diário. E o SHV também já fica com o rastreio para subdividir melhor na hora de gerar os modelos."

### Fluxo de geração vira 3 telas

> "primeira tela vai virar a de selecionar o tipo de caso. 2ª a de selecionar se quero um modelo de
> procuração e contrato / documento judicial / documento administrativo. 3ª tela selecionado o modelo
> conforme a categoria (em que pasta está)"

Hoje são 2 telas ("Procuração" ou "Documento do caso" → modelo).

---

## C1 ⚠️ — Status da etapa: NÃO mexer agora

A decisão D1 (tirar o status e virar workflow) **foi adiada por ele**:

> "Essa etapa para fins de financeiro e etc acabou ficando obsoleto, mas para facilitar vamos manter da
> forma atual e trabalhamos melhor essa alteração quando avançarmos nos próximos passos do módulo
> financeiro."

**A S4-04 sai desta leva** — era a segunda story de risco alto do plano.

---

## C2 — Registrado e Lançado

> "Registrado = tudo que for cadastrado em receita/despesa do caso. Lançado = foi para o ERP. Essa
> divisão já existe no SHV, seria o caso só de agrupar a soma por receita/despesa"

A imagem confirma: os selos que já existem por lançamento são **Dispensado · Lançado · Aguardando**.
A visão 360 (S3-04) só precisa **somar por receita/despesa**, sem inventar régua nova.

---

## C3 — Permissões

- **C3.1** — "Remove o perfil prestador externo (não temos um trabalho nesse sentido), mantem como
  operacional, e ai se for o caso em alguma situação especifica fazemos isso de alterar as permissões do
  usuario em especifico."
- **C3.2** — "Pode deixar todos os que tenham dúvida como operacional, depois ajustamos aqui na mão."
- **C3.3** — Coordenador com "Ver" em Sistema/usuários: **correto**.
- **C3.4** — "O judicial na verdade está integrado ao módulo 'casos', então usa as mesmas permissões do
  módulo. O módulo inteligência é algo muito embrionário, então mantém fechado para todos que não forem
  administrador."

**Verificado:** não há nenhum override de usuário no módulo `judicial` — alinhá-lo ao operacional não
quebra ninguém.

---

## Ainda em aberto

- **B2 (estrutura):** ele disse "vou passar um detalhamento melhor" e mandou o desenho. Falta definir o
  que é **"TIPO"** dentro do tema — se vira entidade cadastrada no sistema ou continua sendo só pasta no
  Drive, e como o caso sabe a qual tipo pertence.
- **D (insumos):** link do SEI + processo de exemplo; acesso ao quadro do Trello.
