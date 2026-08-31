# Respostas ao Thiago — 31/08/2026

Dois blocos: **(A)** as 5 dúvidas que ficaram pendentes de análise/resposta e
**(B)** o que foi executado do documento "31.08 — tarefas".

---

## A. Dúvidas pendentes — respostas

### A1. Dá para cadastrar um novo processo judicial no ProJuris pela API, direto do SHV?

**Sim.** Os endpoints existem e estão mapeados na nossa referência
(`sistema-hv/docs/referencia-api-projuris.md`, extraída do WADL da API):

| Ação | Endpoint |
|---|---|
| Criar processo judicial | `POST /processo-judicial` |
| Editar processo judicial | `PUT /processo-judicial` |
| Converter extrajudicial → judicial | `PUT /processo-judicial/alterar-para-extra-judicial/{codigo-processo}` |
| Consultar processo | `GET /processo-judicial/atendimento/{codigo-atendimento}` |

É exatamente o caso de uso "informar protocolo" do doc 21.08 da Controladoria.

**O que falta para ligar:** a escrita no ProJuris hoje está atrás da trava
`projuris_writeback_ativo` (nasce desligada, botão na tela de Configuração da
Distribuição), e só está implementada para arquivar intimação / marcar andamento
como lido. Cadastrar processo é **um endpoint novo no nosso cliente**, não uma
mudança de arquitetura — o transporte, a autenticação e a trava já existem.

**Antes de codar precisamos de você:** os campos obrigatórios do formulário de
processo do ProJuris (vara, comarca, classe, assunto, partes) e a regra de quais
campos do caso do SHV alimentam cada um. Sem esse de-para, o cadastro entra lá
incompleto.

---

### A2. Dá para alterar EM LOTE a categoria financeira / centro de custo de lançamentos anteriores do ContaAzul, pela API?

**Não. E não é só "em lote" — não dá nem um a um.** Isso foi testado hoje contra a
API real (conexão ativa, sondagem somente-leitura + escritas em UUID inexistente,
nenhum lançamento real tocado). Script: `scripts/diag-contaazul-editar-lancamento.ts`.

O que a sondagem devolveu:

| Tentativa | Resposta | Leitura |
|---|---|---|
| `GET/PATCH/PUT …/contas-a-receber/{id}` | **404 de rota** | O lançamento **não tem endpoint de edição**. E é nele que a categoria mora. |
| `POST …/contas-a-receber/lote`, `…/atualizar-lote`, `PUT …/categoria` | **404 de rota** | **Não existe nenhuma operação em lote** de lançamento na API. |
| `PATCH …/parcelas/{id}` | **409** "Versão informada para o recurso é inválida" | Essa rota **existe** (o erro é de controle de versão, não de rota) — mas ela edita a **parcela**, e os campos que a documentação lista são vencimento, valor, observação e conta financeira. |

O detalhe que fecha a questão é o modelo do próprio ContaAzul: **categoria e centro
de custo pertencem ao lançamento (conta a receber), não à parcela**. A parcela é
editável; o lançamento não é. Então o único campo que a gente conseguiria mexer
não é o que você precisa.

**O caminho realista:** corrigir pelo painel do ContaAzul (ou pedir ao suporte
deles um ajuste em massa). Aliás — a conta já tem um centro de custo chamado
**"AJUSTE CATEGORIA"**, o que sugere que alguém aí já vinha contornando por lá.

**Único teste que ainda faltaria** (e que só faz sentido se você quiser cravar até
o último detalhe): criar um lançamento **de teste** no ContaAzul e tentar o `PATCH`
de parcela com `version` correto, mandando categoria junto, para ver se ele aceita
um campo não documentado. Isso cria um registro real na sua conta — só faço com
sua autorização, e a expectativa honesta é que dê no mesmo.

---

### A3. Integração com o Trello — o que é necessário e como é a documentação

A API do Trello é REST simples, autenticada por **API key + token** gerados no
próprio painel (`trello.com/power-ups/admin` → API key; o token sai de uma URL de
autorização e não expira se você pedir `expiration=never`). Leitura de cards,
descrição e comentários é `GET`, sem nada de webhook — para importação a gente
nem precisa de webhook.

**Isto já está escrito e pronto para executar:** a story
`docs/stories/reuniao-2026-08-26/TR1-importacao-trello.md`, que você mesmo adiou em
26/08 ("sobre o Trello não iremos fazer agora"). O recorte que você definiu está
lá: importar **só a descrição** (vai para Observações do caso) e **os comentários**
(viram notas na linha do tempo, preservando autor e data). Nada de checklists,
anexos, etiquetas ou movimentação entre listas.

**Os 3 bloqueios para destravar são seus:**

1. **API key + token do Trello** (você gera; eu digo onde colar).
2. **Qual board/lista** é a origem do tema-piloto (você falou em um tema pequeno,
   de 29 casos).
3. **Onde está o ID do card dentro do caso no SHV** — você mandou o time preencher
   um campo com o ID do card; preciso saber qual campo é, porque é ele que faz o
   casamento card ↔ caso.

Com esses três, a importação roda primeiro em `--dry-run` (relatório do que
faria, sem escrever), a gente confere junto, e só depois `--commit`.

---

### A4. "Robô de pesquisa do SEI" com superação de CAPTCHA

Aqui eu preciso ser direto em duas frentes, porque elas têm respostas diferentes.

**A parte do CAPTCHA: não é o caminho.** Contornar o CAPTCHA do SEI significa
quebrar deliberadamente um controle de acesso de sistema público — some o risco
jurídico (é o escritório fazendo isso, não um fornecedor anônimo), o risco
operacional (bloqueio de IP, do CPF/certificado usado, e o robô quebra a cada
mudança de layout) e o custo de manutenção eterno. Eu não recomendo construir
isso, nem por fora nem por dentro do sistema.

**A parte que interessa — "ter a informação do SEI dentro do sistema" — tem
caminhos legítimos, e são melhores:**

1. **Consultar se o tribunal/órgão tem API.** Muitos SEIs expõem o
   *SEI-Barramento / PEN* ou uma API REST de consulta pública; onde existe, é
   consulta autenticada, estável e sem CAPTCHA.
2. **Sessão autenticada, não anônima.** Consulta feita *logado* com a credencial
   do escritório normalmente não passa pelo CAPTCHA — que existe para barrar
   varredura anônima. Isso é automação de um acesso que já é nosso por direito,
   e é bem diferente de burlar o controle.
3. **Trazer o resultado para dentro do SHV, você tem razão nisso.** Concordo com
   o que o Matheus falou: se for feito, tem que ser dentro do sistema — o achado
   vira andamento/tarefa no caso, entra no motor de distribuição e é auditável.
   Fazer por fora só cria mais uma planilha que ninguém confere.

**Proposta:** antes de projetar robô nenhum, você me diz **quais órgãos/SEIs**
importam de verdade (os 2 ou 3 que doem). Eu verifico caso a caso se tem API ou
se dá para logar, e a gente decide com dado em mãos. É meia hora de investigação
por órgão, e evita construir a coisa errada.

---

### A5. Integração/automação ContaAzul ↔ Asaas — o SHV como "caminho" entre os dois

Primeiro, o estado real de cada lado — porque isso muda a conversa:

| Perna | Situação |
|---|---|
| SHV cria conta a receber e cobrança no **ContaAzul** | ✅ funcionando (é o **padrão de cobrança** desde 10/07) |
| **ContaAzul → SHV**: pagamento recebido lá baixa a parcela aqui | ✅ funcionando, por **cron diário 08:30** + botão "Sincronizar Conta Azul" no caso |
| SHV cria cobrança no **Asaas** (boleto/pix/link) | ✅ funcionando, mas **opcional/secundário** por decisão sua de 10/07 |
| **Asaas → SHV**: pagamento avisado por webhook baixa a parcela | ✅ funcionando |
| **Asaas → ContaAzul** (cobra num, contabiliza no outro) | ❌ não existe — e **não é ajuste pequeno**, ver abaixo |

**Duas correções importantes ao que eu havia dito antes:**

1. **O ContaAzul não tem webhook.** Não é omissão nossa: a API deles não oferece.
   Por isso o caminho de volta é o **cron diário + botão manual**, e isso já roda e
   já foi testado. Quem tem webhook é o Asaas.

2. **A ponte Asaas→ContaAzul não é "uma linha de código"**, como eu descrevi antes
   — eu estava errado nisso. O motivo é de modelo: no SHV cada parcela pertence a
   **um** provedor (`system_parcelas.provider` = `conta_azul` **ou** `asaas`). Uma
   parcela cobrada no Asaas simplesmente **não tem lançamento correspondente no
   ContaAzul** para receber baixa. Para o SHV ser literalmente o caminho entre os
   dois, a parcela precisaria carregar **os dois vínculos** — cobrança no Asaas +
   lançamento no ContaAzul — e isso é mudança de modelo, mais a regra de qual
   categoria e qual conta financeira recebem o lançamento espelhado.

**Então a pergunta que importa antes de construir qualquer coisa é sua:** o
ContaAzul já é o padrão e já emite a cobrança. Usar o Asaas em paralelo só se
justifica se a **cobrança precisar sair por lá** (taxa melhor, split, régua de
cobrança) e o ContaAzul precisar continuar sendo a **contabilidade**. Se for esse
o caso, o trabalho é bem definido e eu faço; se não for, manter tudo no ContaAzul
é mais simples e evita dois registros para o mesmo dinheiro.

**Sobre o Pluga:** com o ContaAzul sem webhook, o Pluga também vai depender de
varredura periódica — ou seja, não resolve nada que a gente não resolva, e ainda
cobra mensalidade e perde o vínculo com o caso, que é o que dá sentido ao
lançamento. Não recomendo para este caso.

---

## B. O que foi executado do documento "31.08 — tarefas"

Todos os itens do documento foram implementados. Detalhamento:

### B1. Tela de Tarefas (`/tarefas`) — reconstruída

| Seu pedido | O que foi feito |
|---|---|
| "Remover esse menu, já retiramos essa função prazo desvinculado de tarefas" | A coluna **Prazos** e os 3 KPIs de prazo saíram da tela. |
| "Remover visualização unificada de checklist / tarefas daqui" | A lista agora traz **só tarefas**. Checklist ficou apenas na página do caso. |
| "Dividir entre 2 menus: tarefas em atraso / tarefas em prazo" | Duas abas, **"Em atraso"** aberta por padrão. |
| "Listas com até 10 tarefas por visualização, com opção de ir entre as páginas" | Paginação de 10 com navegação 1, 2, 3… |
| Ordem: prazo mais próximo → maior prioridade → criação mais recente | Implementada exatamente nessa hierarquia. Tarefa **sem prazo vai para o fim**. |
| "A visualização padrão deve ser vinculada apenas as tarefas do próprio usuário" | Abre em **"Minhas tarefas"**; ver as dos outros virou opção no seletor. |
| "Novos filtros: TEMA, TIPO, PRIORIDADE" | Os três entraram, junto com busca, colaborador e status. |
| KPIs por situação da tarefa | Três cartões: **Tarefas abertas**, **Em atraso**, **Em prazo** — clicar troca a aba. |

### B2. Data no card do Kanban — agora vem das tarefas

Você apontou dois problemas no mesmo print, e os dois foram corrigidos:

**"Essa data que aparece, não entendemos exatamente de onde vem."** Vinha de
`status_changed_at` — era "há quantos dias o caso está parado nesta etapa", que
não é informação de prazo. Agora o selo do card segue a sua regra:

- **sem tarefa aberta com prazo → sem selo nenhum** (o caso em dia fica limpo,
  como você descreveu);
- **tarefa em prazo → dias que faltam** (`12d`, ou `vence hoje`);
- **tarefa em atraso → contador de dias de atraso, em vermelho** (`26d atraso`) —
  que é o comportamento do Trello que você pediu, com o contador que lá não tem.

Quando o caso tem várias tarefas abertas, o selo mostra a mais urgente.

**"Essa tela está desordenada. A ordem muda sempre."** A causa: a consulta
ordenava por data de criação, e os casos importados em lote têm data de criação
praticamente idêntica — com empate, o banco devolve em ordem arbitrária, e por
isso mudava a cada atualização de página. Agora a ordem é a **data e hora de
ingresso do caso na etapa**, como você sugeriu, com desempate estável. A ordem
para de mudar sozinha.

### B3. Workflows — tipo, responsável e workflow sucessivo

**"Quando a ação for criar tarefa, adicionar opção de vincular a um tipo de
tarefa já existente e para quem a tarefa é criada."** Feito: a ação "Criar
tarefa" ganhou o seletor **classe → tipo** (o mesmo usado na criação manual) e o
seletor de **responsável**.

**"Adicionar opção de workflow sucessivo: quando a tarefa criada pela ação 1 for
concluída, gerar a ação 2."** Feito. Dentro da ação "Criar tarefa" há agora o
bloco **"Quando esta tarefa for concluída"**, onde se define a ação seguinte
(comentário, nova tarefa ou mudar etapa).

Detalhe importante de como ficou: o encadeamento fica **amarrado àquela tarefa
concreta**, não a "qualquer tarefa do tipo X". Concluir a tarefa que o workflow
criou dispara a ação seguinte; concluir outra tarefa parecida, não. Isso evita
o disparo cruzado que aconteceria se a gente resolvesse com duas regras soltas.
A cadeia tem **um nível** de propósito, e desligar o workflow desliga a cadeia
inteira.

### B4. Card de tarefa na ficha do caso — sobreposição corrigida

"As vezes esse dá sobreposição." Os selos (tipo, ProJuris, prioridade) e o
seletor de situação agora ficam num bloco próprio que **quebra para a linha de
baixo** quando a largura aperta, em vez de passar por cima do nome do
responsável.

### B5. Auditoria do caso — recolhida por padrão

"O painel de auditoria do caso, ser uma opção sim/não. Assim ele aparece fechado."
Feito: virou um painel que **nasce fechado**, com um clique para abrir. Além do
visual, isso economiza a consulta — a tabela só é carregada quando alguém abre.

---

## C. Pendências para o deploy

1. **Aplicar a migration** `20260831000001_workflow_encadeado.sql` (adiciona uma
   coluna em `system_case_tasks`, aditiva — nada existente é alterado). Sem ela, o
   workflow sucessivo não grava a marca de origem.
2. **Conferir no preview** os ajustes visuais (tela de tarefas, selo do card,
   painel de auditoria) — foram feitos sem navegador.
