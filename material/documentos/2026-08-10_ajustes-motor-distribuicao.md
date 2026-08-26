# Ajustes no Motor de Distribuição

## Objetivo

Simplificar a arquitetura e a interface do **Motor de Distribuição**, removendo telas redundantes e concentrando o fluxo operacional em uma única experiência de distribuição.

Este documento foi montado com base nas decisões discutidas na reunião.

---

## 1. Estrutura principal do Motor de Distribuição

O **Motor de Distribuição deve funcionar essencialmente como uma lista/fluxo único**.

Não devemos tratar `Absolut`, `Complex` e `General` como telas, abas ou filtros independentes.

Essas classificações devem funcionar como **regras internas do motor**, utilizadas durante o processamento da distribuição.

### Fluxo esperado

1. Receber a tarefa/processo que precisa ser distribuído.
2. Identificar internamente as regras aplicáveis.
3. Identificar:
   - tipo de tarefa;
   - tipo de caso;
   - tema;
   - complexidade;
   - prioridade/urgência;
   - regras específicas;
   - executor elegível;
   - data prevista;
   - data limite/fatal, quando aplicável.
4. Calcular:
   - para quem a tarefa será enviada;
   - para qual data a tarefa será enviada.
5. Exibir o resultado da distribuição.
6. Permitir:
   - **Aprovar**;
   - **Reprovar**;
   - **Editar o executor** antes da confirmação.
7. Após aprovação, efetivar a distribuição.

---

## 2. Tela principal da distribuição

A tela principal deve concentrar o processo completo.

A lista deve apresentar, no mínimo:

- processo;
- tarefa;
- executor sugerido;
- data prevista;
- regra utilizada pelo motor;
- status da distribuição;
- ações disponíveis.

### Ações

Cada item deve permitir:

- Aprovar distribuição;
- Reprovar distribuição;
- Editar executor;
- Visualizar a regra utilizada;
- Visualizar informações suficientes para conferência antes da efetivação.

A regra aplicada deve ser exibida para fins de auditoria e conferência.

---

## 3. Remover `Executores` como tela independente do Motor

A tela de **Executores** não deve continuar existindo como uma tela operacional separada dentro do Motor de Distribuição.

As informações do executor devem ficar vinculadas ao cadastro do usuário.

### Migrar para

`Usuários / Permissões`

Adicionar ao cadastro do usuário os campos necessários para integração e distribuição.

### Campos sugeridos

- `projuris_id`
  - ID correspondente do usuário/executor no ProJuris.

- `participa_distribuicao`
  - boolean;
  - define se o usuário pode participar do Motor de Distribuição.

- regras/configurações relacionadas à distribuição;
- peso/carga, caso essa informação continue sendo utilizada;
- disponibilidade;
- tipos de tarefa permitidos;
- temas permitidos;
- restrições específicas.

O sistema deve utilizar essas configurações automaticamente ao executar o motor.

---

## 4. Exceções e regras específicas

As exceções não devem funcionar como uma etapa operacional separada do processo de distribuição.

As regras específicas devem fazer parte da **configuração do sistema**.

Exemplos mencionados na reunião:

- determinada tarefa + determinado tema é exclusiva de um usuário;
- determinada tarefa, independentemente do tema, pertence a um usuário específico;
- determinado tema, independentemente da tarefa, pertence a um usuário específico.

### Exemplo de regra

```text
SE tarefa = X
E tema = Y
ENTÃO executor = usuário Z
```

ou

```text
SE tema = Y
ENTÃO executor = usuário Z
```

ou

```text
SE tarefa = X
ENTÃO executor = usuário Z
```

Essas regras devem ser resolvidas pelo Motor automaticamente.

### Importante

Não criar uma etapa manual de escolha dessas regras toda vez que o motor rodar.

As regras devem estar previamente configuradas.

---

## 5. Configuração de Tipos de Tarefa

Criar ou consolidar um menu geral de configuração de **Tipos de Tarefa**.

Esse menu deve armazenar os dados necessários para o Motor de Distribuição.

Parte dessas informações pode ser sincronizada com o ProJuris.

### Exemplos de informações

- ID da tarefa no ProJuris;
- nome da tarefa;
- prazo previsto;
- prazo fatal;
- prioridade;
- complexidade;
- pontuação;
- regras específicas;
- executor obrigatório, quando aplicável;
- tema;
- demais variáveis necessárias ao motor.

O objetivo é evitar que, a cada execução, o motor precise buscar e interpretar novamente todas essas informações externamente.

Sempre que possível, os dados necessários devem estar previamente sincronizados/configurados no nosso sistema.

---

## 6. Histórico

Durante a reunião, a tela de **Histórico** foi utilizada principalmente para investigar e entender tecnicamente o que o motor havia feito.

Não ficou definido que o Histórico precisa continuar sendo uma etapa operacional independente.

A orientação para implementação é:

### Não tratar Histórico como etapa do fluxo.

As informações importantes para auditoria devem ficar disponíveis no próprio resultado da distribuição.

Registrar pelo menos:

- tarefa;
- processo;
- executor sugerido;
- executor final;
- data calculada;
- regra utilizada;
- data/hora da execução;
- usuário que aprovou;
- usuário que editou;
- alterações realizadas;
- status;
- resposta da integração com ProJuris.

Essas informações podem existir tecnicamente como logs/histórico no banco, mas **não precisam obrigatoriamente existir como uma tela principal separada no menu do Motor**.

Caso seja necessário manter visualização histórica, ela deve ser uma visualização secundária de auditoria e não uma etapa do fluxo.

---

## 7. `Absolut`, `Complex` e `General`

Não criar três experiências diferentes.

Esses valores representam regras/tipos utilizados internamente pelo Motor.

### Comportamento esperado

O usuário não precisa selecionar manualmente qual motor será utilizado em cada execução.

O sistema deve identificar automaticamente, com base nos dados da tarefa/processo, qual regra aplicar.

Exemplo:

```text
Tarefa recebida
    ↓
Motor analisa processo + tarefa + tema + complexidade
    ↓
Identifica regra aplicável
    ↓
Calcula executor
    ↓
Calcula data
    ↓
Apresenta resultado para aprovação
```

---

## 8. Integração com ProJuris

A integração precisa mapear IDs retornados pela API para entidades legíveis no sistema.

### Não exibir somente IDs técnicos.

Exemplo incorreto:

```text
Executor: DDD294BB
Task ID: 55129271
```

Exemplo esperado:

```text
Executor: Thaís
Tarefa: Elaborar Contestação
Processo: 0000000-00.0000.0.00.0000
```

O ID deve continuar armazenado internamente para integração.

### Mapear

- ProJuris User ID → usuário interno;
- ProJuris Task Type ID → tipo de tarefa;
- ProJuris Process ID → processo/caso;
- demais IDs utilizados pela integração.

---

## 9. Etapa de confirmação

Antes de efetivar a criação/distribuição da tarefa no ProJuris, deve existir uma confirmação.

O Motor deve primeiro gerar uma **proposta de distribuição**.

### Proposta

Exibir:

- processo;
- tarefa;
- executor;
- data;
- regra aplicada.

Depois permitir:

```text
[Aprovar]
[Reprovar]
[Editar executor]
```

Somente após aprovação deve ocorrer a efetivação da distribuição.

---

## 10. Resultado esperado da arquitetura

### Antes

Possíveis telas separadas:

```text
Motor de Distribuição
├── Lista
├── Executores
├── Exceções
├── Histórico
├── Absolut
├── Complex
└── General
```

### Estrutura desejada

```text
Motor de Distribuição
│
├── Distribuição
│   ├── tarefas pendentes
│   ├── processamento
│   ├── executor sugerido
│   ├── data sugerida
│   ├── regra aplicada
│   ├── aprovar
│   ├── reprovar
│   └── editar executor
│
└── Auditoria / Histórico
    └── opcional e secundário
```

Configurações ficam fora do fluxo operacional:

```text
Configurações
├── Usuários / Permissões
│   ├── ProJuris ID
│   ├── participa da distribuição
│   └── regras do executor
│
├── Tipos de Tarefa
│   ├── ProJuris Task ID
│   ├── prazo previsto
│   ├── prazo fatal
│   ├── pontos
│   ├── complexidade
│   └── regras
│
└── Regras de Distribuição
    ├── regra por tarefa
    ├── regra por tema
    ├── regra por tarefa + tema
    └── executor obrigatório
```

---

# Instruções para implementação no código atual

Antes de alterar qualquer coisa:

1. Analise a estrutura atual do projeto.
2. Identifique:
   - rotas;
   - páginas;
   - componentes;
   - tabelas;
   - services;
   - APIs;
   - integração com ProJuris;
   - lógica atual do Motor de Distribuição.
3. Não remova código ou banco de dados sem verificar dependências.
4. Preserve dados e integrações existentes.
5. Reaproveite o máximo possível da implementação atual.

---

## Alterações prioritárias

### Prioridade 1

Consolidar a operação do Motor na tela principal de distribuição.

### Prioridade 2

Mover configuração de executor para:

```text
Usuários / Permissões
```

Adicionar:

```text
projuris_id
participa_distribuicao
```

e demais configurações necessárias.

### Prioridade 3

Transformar `Absolut`, `Complex` e `General` em regras internas, não páginas separadas.

### Prioridade 4

Implementar fluxo:

```text
receber tarefa
→ processar motor
→ gerar proposta
→ exibir regra
→ aprovar/reprovar/editar
→ enviar ao ProJuris
```

### Prioridade 5

Reorganizar exceções como regras de configuração.

### Prioridade 6

Reavaliar a tela Histórico.

Se houver dependências ou informações úteis nela, não apagar os dados.

Apenas retirar do fluxo principal e transformar em auditoria secundária, caso necessário.

---

# Cuidados

Não remover imediatamente tabelas ou endpoints associados a:

- executores;
- histórico;
- exceções;
- regras;
- distribuição.

Primeiro identificar se são utilizados por:

- banco;
- API;
- ProJuris;
- jobs;
- cron;
- workers;
- telas;
- componentes;
- logs;
- relatórios.

A remoção inicial deve ser preferencialmente de **interface/rota redundante**, preservando backend e dados até validar que não existem dependências.

---

# Critério de aceite

A implementação estará correta quando:

- o usuário conseguir operar a distribuição em uma única tela;
- o sistema identificar automaticamente as regras;
- `Absolut`, `Complex` e `General` não precisarem ser selecionados como telas separadas;
- o resultado mostrar quem receberá a tarefa;
- a regra aplicada estiver visível;
- seja possível aprovar, reprovar ou editar o executor;
- o ID do ProJuris estiver associado ao usuário interno;
- seja possível definir se o usuário participa da distribuição;
- regras específicas estejam configuradas previamente;
- a distribuição só seja efetivada após confirmação;
- dados históricos permaneçam rastreáveis;
- nenhuma integração existente seja quebrada.

---

# Observação importante

As decisões mais claras da reunião foram:

1. **Motor de Distribuição deve ser essencialmente uma lista/fluxo único.**
2. **A distribuição precisa permitir aprovar, reprovar e editar o executor.**
3. **A regra utilizada pelo motor deve poder ser visualizada para conferência.**
4. **Configuração de executor deve migrar para Usuários/Permissões.**
5. **Adicionar ID ProJuris ao usuário.**
6. **Adicionar opção indicando se o usuário participa da distribuição.**
7. **Absolut / Complex / General são regras internas do motor, e não fluxos independentes.**
8. **Tipos de tarefa e regras devem ficar previamente configurados.**

Sobre a remoção das telas **Histórico** e **Exceções**, não houve uma frase literal determinando a exclusão delas.

A arquitetura discutida, porém, indica que:

- Histórico deve ser auditoria/log, não etapa operacional;
- Exceções devem virar regras/configurações internas;
- Executores devem ser administrados em Usuários/Permissões.

Portanto, **não apagar estruturas de backend dessas áreas sem antes verificar dependências**.
