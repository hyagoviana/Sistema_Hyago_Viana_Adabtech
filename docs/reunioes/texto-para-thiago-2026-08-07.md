# Texto para enviar ao Thiago (WhatsApp/e-mail)

---

**Thiago, valeu pela reunião! Segue um resumo do que preciso que você me mande pra eu fechar o motor e deixar o sistema redondo pra segunda. Separei em 3 partes: (1) o que você me envia, (2) a planilha de colaboradores pra você validar, e (3) o processo que já validamos.**

## 1) O que preciso que você me mande (fim de semana)

1. **Lista de colaboradores** (vou te mandar a planilha pronta no item 2 — é só preencher). Preciso de: nome, cargo (**Estagiário / Júnior / Sênior**), qual **time**, **ID ProJuris** de cada um, e-mail corporativo, se **participa da distribuição** (sim/não) e o **peso** (padrão 100).

2. **Os 14 tipos de tarefa** que não estão na sua planilha de pontos: me diz **quais ficam e quais saem** (ex.: "Lembrete" você falou que sai) e a **pontuação** de cada um que ficar.

3. **Ajuste no ProJuris:** apagar os **"Diligência/Balcão" duplicados** (deixar só 1) e conferir os **prazos (previsto e fatal)** dos tipos de tarefa lá dentro — o motor puxa esses prazos de lá.

4. **Print do Trello** — aquele visual da linha do tempo/comentários que você quer que eu replique no sistema.

5. (quando formos fazer a importação do Trello) **login e senha de admin do Trello** — mas isso é pra depois, sem pressa.

*Confirmações que já ficaram certas:* Emenda = "Emenda à Inicial", Réplica = "Réplica à Contestação", Manifestação = uma lógica pra cada prazo (5/10/15), e as exceções (Audiência→você, Sustentação Oral→você, INDENIZAÇÃO PMMB→Thaíse, TEMFC→Patrícia). O caso de teste que você passou (`0733583-07.2026.8.07.0016` / **PRO.0007713**) já tá anotado.

## 2) Planilha de colaboradores (anexei o Excel)

Anexei uma planilha **"Cadastro de Colaboradores"**. É só preencher uma linha por pessoa com nome, e-mail, cargo, time, ID ProJuris, participa da distribuição e peso — mais as **permissões** (quais abas cada um vê, e quem enxerga valores). Me devolve preenchida que **eu importo tudo no sistema** de uma vez. Assim ninguém precisa cadastrar na mão.

## 3) Processo de validação do motor (o que já combinamos)

> Regra de ouro: **primeiro tudo em SIMULAÇÃO** (não escreve nada no ProJuris). Só ligo o envio real no fim, com 1 caso (o seu de teste).

**FASE 1 — Configurar (sem risco):**
1. **Permissões** (`/permissoes`) — cada executor com **ID ProJuris + "participa" + peso**.
2. **Distribuição → Tipos de tarefa** (`/controladoria/distribuicao/tipos-tarefa`) — pontos/complexidade/prazos.
3. **Distribuição → Temas** (`/controladoria/distribuicao/temas`) — multiplicador.
4. **Distribuição → Exceções** (`/controladoria/distribuicao/excecoes`) — responsável exclusivo.

**FASE 2 — Simulação (não escreve no ProJuris):**
5. **Distribuição** (`/controladoria/distribuicao`) → clicar **Sincronizar/Rodar**.
6. **Distribuição → Lista** (`/controladoria/distribuicao/lista`) — a gente confere **quem recebeu + a regra + as datas**. Pergunta-chave: *"na mão, iria pra essa pessoa?"* Se não bater, ajusto e rodo de novo (é simulação, pode repetir à vontade).

**FASE 3 — Teste real (só depois da Fase 2 bater):** aprovo as tarefas, vejo o envio em **dry-run** (sem escrever), e aí efetivo **1 caso teste** (o seu) pra conferir no ProJuris se caiu na pessoa e data certas. Depois começamos só com a sua agenda e vamos ampliando.

**Me manda o que puder ainda hoje/amanhã que eu já vou deixando tudo configurado no fim de semana. Valeu!** 🙌
