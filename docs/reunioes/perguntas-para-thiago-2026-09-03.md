# Perguntas para o Thiago — 03/09/2026

Levantamento da reunião 02/09 fechado; plano em 7 sprints e 25 stories montado. O que falta para
destravar a execução está abaixo, em ordem de urgência.

---

## A. Trava a primeira sprint (precisamos para começar)

### A1. Andamentos duplicados — pode sempre virar uma tarefa só?

Vamos agrupar as intimações da mesma publicação num card só (no exemplo do seu arquivo, o processo
`1003999-60.2025.4.01.3311` gerou 6 intimações — CEF, União, FNDE, repetidas).

- Existe **algum caso** em que duas intimações da mesma publicação exigem **duas tarefas diferentes**
  (prazos ou providências distintas por parte)? Se existir, precisamos de uma exceção.
- Com o writeback ligado, o que fazemos com as "irmãs" no ProJuris: **arquivar todas** junto com a que
  foi distribuída, ou **marcar como lidas** e deixar arquivar para vocês?

### A2. Caso com mais de um responsável — quem o motor escolhe?

Vamos ligar o direcionamento por caso (hoje ele nunca lê isso — você estava certo). Só que um caso pode
ter **vários** responsáveis cadastrados.

Nossa proposta: **um** responsável → o motor entrega para ele; **dois ou mais** → volta para a
distribuição por pontuação e registra um aviso na tela, para vocês verem por que não direcionou.

Serve? Ou você prefere que exista um **"responsável principal"** entre eles, e o motor use sempre esse?

### A3. Campos "do cliente" que já existem no cadastro padrão

Corrigimos o problema que você apontou (campo criado no tema como "do cliente" não aparecia na página do
cliente). Ao preparar a correção dos campos que já estão lá, apareceram estes seis:

| Campo criado no tema | Situação |
|---|---|
| Carência estendida FIES | ok, não existe equivalente |
| IBGE do Município | ok, não existe equivalente |
| período carência estendida | ok, não existe equivalente |
| Saldo FIES atualizado | ok, não existe equivalente |
| **FIES** | **já existe** como campo padrão do cadastro (bloco "Formação, FIES e residência") |
| **Nº contrato FIES** | **já existe** como "Nº do contrato FIES" no mesmo bloco |

**Olhamos os dados antes de recomendar, e o quadro é pior do que parecia** — por isso a recomendação
mudou em relação ao que escrevemos primeiro:

- O FIES está gravado em **dois lugares ao mesmo tempo**: no campo padrão do cadastro e no campo
  personalizado. São **375 clientes** com valor no personalizado e **290** no padrão.
- Nos **373** clientes que têm os dois, o valor **diverge em todos** — na maioria porque o campo padrão
  está **vazio** e quem tem o dado é o personalizado.
- Os formatos também estão misturados: `["Sim"]`, `"Não"` e `false` convivem na mesma coluna.

Ou seja: hoje o dado de FIES de ~375 clientes **não aparece em lugar nenhum** da ficha (o personalizado
não tem definição cadastrada, e o padrão está vazio). Não é um detalhe de tela — é informação sumida.

Como você quer resolver?

1. **Consolidar no campo personalizado** (onde o dado realmente está), normalizando os formatos para
   Sim/Não e aposentando o campo padrão — **nossa recomendação agora**; ou
2. Consolidar no campo padrão, migrando os valores do personalizado para ele; ou
3. Manter os dois, se significam coisas diferentes (e aí precisamos de nomes que os distingam).

O mesmo vale para "Nº contrato FIES". Os outros quatro campos não conflitam com nada e criamos assim que
você responder.

### A4. Fim de semana — e feriado?

O motor vai parar de distribuir sábado e domingo. Feriado hoje depende de alguém bloquear o dia no
calendário do sistema. Quer que a gente **carregue os feriados nacionais automaticamente** (e vocês
acrescentam os locais/recesso)? É pouco esforço e evita o mesmo problema em novembro/dezembro.

---

## B. Trava a segunda sprint (ProJuris e Drive)

### B1. Assunto do ProJuris de cada tema

Para o processo criado pelo SHV nascer com o assunto certo, precisamos do de-para. Hoje os temas são:

| Tema no SHV | Assunto correspondente no ProJuris |
|---|---|
| 1% fies | ? |
| Inadimplência HV | ? |
| Indenização Mais Médicos | ? |
| Desenrola FIES | ? |
| Transferência de Residência Médica | ? |

E qual é o **assunto geral** que os temas sem assunto próprio devem usar?

### B2. Pastas do Drive — confirmação antes de mexer

Vamos migrar os modelos para dentro da pasta de cada tema e, **depois de validar**, mandar a pasta
"modelos" antiga para a lixeira (recuperável por 30 dias).

- Dentro do tema, os nomes são exatamente **"Casos"** e **"Procurações"**?
- Existem modelos hoje que **não pertencem a nenhum tema**? Se sim, para onde vão?
- Confirma que podemos enviar a pasta antiga para a lixeira depois que provarmos que a geração de
  documento e de procuração continuam funcionando?

---

## C. Decisões de negócio das sprints seguintes

### C1. Fim do "status" da etapa — quais etapas abrem o financeiro?

Vamos tirar o status (Normal/Ganho) das etapas e transformar o gatilho em regra de workflow, como você
sugeriu. Para converter sem perder nada, precisamos confirmar **tema a tema** qual etapa abre o
financeiro hoje (a que está marcada como "Ganho").

E: além de "Ganho", vocês usam "Encerrado"/"Perdido" para alguma coisa — relatório, contagem, filtro?
Se usam, mantemos o conceito de **etapa final** com esse nome; se não, some junto.

### C2. Visão 360 do cliente — o que são "Registradas" e "Lançado"?

No seu rascunho, cada caso mostra receitas e despesas em seis colunas:
**Registradas · Lançado · Devido · Vencido · Pago · A vencer**.

O sistema hoje trabalha com Devido/Vencido/Pago/A vencer. O que exatamente entra em **"Registradas"** e
em **"Lançado"**? (Suspeitamos: registradas = tudo que foi cadastrado, lançado = o que já virou parcela
no financeiro — mas é melhor você confirmar do que a gente adivinhar e os números saírem errados.)

### C3. Permissões — quatro pontos da matriz

1. **Prestador externo** (ex.: a conta do Matheus) não existe na sua tabela. Hoje esse papel só enxerga
   os casos vinculados a ele. Vira Operacional com restrição, ou você quer manter um papel próprio?
2. Quem são as pessoas de **Suporte** e de **Estagiário**? Não temos como deduzir do cadastro atual.
3. **Coordenador** aparece com "Ver" em Sistema/usuários — é só enxergar a lista de pessoas, sem
   convidar nem mudar acesso, certo?
4. A matriz não cita **Judicial** nem **Inteligência**, que existem no sistema. Mantemos como estão?

Vamos te mandar a planilha usuário-a-usuário com o de-para proposto antes de aplicar — ninguém muda de
acesso sem você e o Hyago olharem.

### C4. "Editar caso" — quem pode?

Você anotou "só determinados cargos podem". Pela sua matriz, isso dá **Administrador e Coordenador**
(os que têm "Configurar" no módulo Operacional). Fecha? Mudança de etapa e preenchimento de campos
continuam liberados para todos, como você pediu.

### C5. Estado civil

Vai virar lista de escolha, com padrão *Solteiro(a)*. As opções seriam: Solteiro(a) · Casado(a) ·
Divorciado(a) · Viúvo(a) · União estável · Separado(a). Falta alguma que apareça nos documentos de vocês?

### C6. Casos prioritários

Confirmando: a página da controladoria lista os casos marcados como **Prioritário** ou **Urgente** no
próprio caso (a marcação que já existe e que o motor usa para prazo) — sem criar uma marcação nova.
É isso que você imaginou?

---

## D. Insumos que ficaram com você

1. **SEI** — link do portal e um número de processo de exemplo (sem isso não conseguimos nem testar a
   viabilidade do CAPTCHA).
2. **Trello** — liberar o quadro *Cobrança HV* para a conta do Matheus e confirmar se precisa do plano
   Premium para a API.
3. A **lista das outras alterações** que você ficou de mandar até sexta.
