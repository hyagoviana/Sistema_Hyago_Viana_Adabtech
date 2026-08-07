# Roteiro de reunião — Validação do Motor de Distribuição (ProJuris) com o Thiago

> Prefixo dos links = a URL do seu sistema. No dev local é `http://localhost:8080`; em produção, o link do Vercel.
> No menu lateral: grupo **INTELIGÊNCIA → Distribuição**. As sub-abas ficam dentro dessa tela.

---

## PARTE 1 — Perguntas para o Thiago (siga na ordem, vá anotando as respostas)

### Bloco A — Executores (quem entra na distribuição)
1. "Dos usuários que estão no ProJuris, **quais realmente entram no rodízio** de distribuição?"
2. "Para cada um: **qual o peso** dele (recebe mais ou menos que os outros) e **ele pode pegar caso complexo** ou não?"
3. "A exceção **TEMFC → Patrícia**: a Patrícia é a **'Ana Patricia Cruz'** que aparece no ProJuris, ou é outra pessoa?"
4. "Confirmando: **Thiago = 128858** e **Thaíse = 204546**, certo?"

### Bloco B — Responsável exclusivo (quem sempre pega certo tipo/tema)
5. "As regras de exclusividade são essas — **falta alguma**?
   - Audiência → Thiago
   - Sustentação Oral → Thiago (e/ou PMMB)
   - INDENIZAÇÃO PMMB → Thaíse
   - TEMFC → Patrícia"

### Bloco C — Tipos de tarefa e prazos
6. "Tem 5 tipos que não bateram automático. Me diz qual é o certo:
   - **'Diligências/Balcão'** (no ProJuris tem 3 parecidos — qual usar?)
   - **'Emenda'** → é 'Emenda à Inicial'?
   - **'Manifestação'** → tem de 5, 10 e 15 dias — usamos qual? (ou os três?)
   - **'Réplica'** → é 'Réplica à Contestação'?"
7. "Tem 14 tipos que existem no ProJuris mas **não estão na sua planilha de pontos**. Você quer **pontuar** eles ou **ignorar**?"
8. "Para cada tipo, **quantos dias** é o **prazo previsto** e o **prazo fatal**? (o motor usa isso pra calcular a data quando o ProJuris não mandar)."

### Bloco D — O ponto mais importante: onde fica a complexidade
9. "No ProJuris, **onde você marca** se um caso é **complexo / individual / coletivo / prioritário**? É um **marcador** ou um **campo personalizado**? Me mostra na tela e me diz o **nome exato** desse campo."
   - *(Sem isso, o motor não consegue puxar essas variáveis pra pontuação — é o único buraco real.)*

### Bloco E — Escrita no ProJuris (a parte irreversível)
10. "Pra gente **testar o envio** (o motor colocar a tarefa na agenda da pessoa no ProJuris): posso usar **1 caso seu** de teste? Confirma que o certo é o **'adicionar/substituir responsável em lote'**?"
11. "A API do ProJuris deixa **criar um tipo de tarefa** por fora, ou o certo é **criar no ProJuris primeiro** e depois a gente vincula no nosso sistema?"

---

## PARTE 2 — Processo de validação (onde entrar, passo a passo)

> Regra de ouro: **primeiro tudo em SIMULAÇÃO** (não escreve nada no ProJuris). Só liga o envio real no final, com 1 caso.

### FASE 1 — Configurar (sem risco nenhum)

**Passo 1 — Cadastrar os executores**
- Entrar em: **Menu → Permissões** → `/permissoes`
- Em cada usuário que participa: preencher **ID ProJuris**, ligar **"Participa da distribuição"** e definir o **peso**. Salvar.

**Passo 2 — Ajustar os tipos de tarefa (pontos + prazos)**
- Entrar em: **Menu → Distribuição → aba "Tipos de tarefa"** → `/controladoria/distribuicao/tipos-tarefa`
- Preencher **pontos**, **complexidade** e **prazo previsto/fatal (dias)** conforme as respostas do Bloco C.
- Corrigir os 5 tipos que não bateram (Bloco C, pergunta 6).

**Passo 3 — Ajustar os temas (multiplicador)**
- **Distribuição → aba "Temas"** → `/controladoria/distribuicao/temas`
- Conferir o **multiplicador** de cada assunto/tema.

**Passo 4 — Cadastrar as exceções (responsável exclusivo)**
- **Distribuição → aba "Exceções"** → `/controladoria/distribuicao/excecoes`
- Lançar as regras do Bloco B (Audiência→Thiago, etc).

**Passo 5 — (se precisar) Calendário/bloqueios**
- **Distribuição → aba "Calendário"** → `/controladoria/distribuicao/calendario`
- Marcar feriados/ausências que travam a agenda.

### FASE 2 — Rodar em SIMULAÇÃO (não escreve no ProJuris)

**Passo 6 — Rodar o motor**
- **Distribuição → tela principal** → `/controladoria/distribuicao`
- Clicar em **"Sincronizar / Rodar"**. O motor puxa as intimações do dia e distribui **em simulação**.

**Passo 7 — Conferir junto com o Thiago**
- **Distribuição → aba "Lista"** → `/controladoria/distribuicao/lista`
- Para cada tarefa, olhar: **quem recebeu**, a **"Regra aplicada"** (coluna própria) e as **datas**.
- **Pergunta-chave ao Thiago:** *"Se fosse você distribuindo na mão, essa tarefa iria pra essa pessoa?"*
- Se **não** bater → volta na Fase 1, ajusta peso/pontos/exceção e **roda de novo** (é simulação, pode repetir à vontade).

**Passo 8 — (opcional) Ver o comparativo**
- **Distribuição → aba "Simulador"** → `/controladoria/distribuicao/simulador` (comparar motor × realidade).

### FASE 3 — Teste real de envio (irreversível — só depois da Fase 2 bater)

**Passo 9 — Aprovar as tarefas**
- Na **aba "Lista"** → usar **Aprovar / Rejeitar / Editar executor** nas tarefas que estiverem certas.

**Passo 10 — Ver o envio em modo seguro (dry-run)**
- Ainda na Lista, clicar em **"Write-back ProJuris"** → abre em **pré-visualização** (mostra o plano, **NÃO escreve**). Revisar com o Thiago.

**Passo 11 — Efetivar 1 caso de teste**
- Só depois de tudo conferido: **(passo técnico meu)** ligar a trava `PROJURIS_WRITEBACK_ENABLED=1`, você digita a data e confirma → o motor escreve **de verdade** no ProJuris.
- **Conferir no ProJuris:** a tarefa caiu na **pessoa certa** e na **data certa**?

**Passo 12 — Rollout**
- Deu certo no caso teste → **começar só com a agenda do Thiago** (como ele pediu) por alguns dias → depois liberar para os demais executores.

---

## Resumo do que já está pronto (pode dizer pro Thiago)
- Conexão com o ProJuris **já funciona**; o motor já **puxa intimações, tipos (52) e executores (15)**.
- Já calcula **pontuação, fluxo, datas e balanceamento**, mostra a **regra** e tem a **tela de aprovação**.
- Falta: **os dados de negócio dele** (Blocos A–D) + **1 teste real de envio** (Fase 3). O resto é rodar e conferir.
