# 🧪 Guia ÚNICO de teste — Reforma 2026-07 (consolidado)

Este guia reúne **tudo** que já está no ar para você testar de uma vez. Marque `[x]` o que passar e me diga o que falhar (onde / o que fez / o que esperava / o que aconteceu + print).

> **Antes de começar:** aguarde o deploy do Vercel concluir (após o último push). Faça um **hard refresh** (Ctrl+Shift+R) para pegar a versão nova.

> **Dica de permissões:** teste primeiro como **admin** (vê tudo) e, se puder, como um **colaborador comum** para conferir os bloqueios.

---

## ⚙️ Pré-requisito (só para a parte de Temas no Drive)
- [ ] **Compartilhar a pasta "tema"** do Drive (`1PtxXwOMn0ibNRXyzAQN-79mHUJc8w4Ro`) **como Editor** com a conta de robô: `hv-drive@hv-sistema.iam.gserviceaccount.com`. Sem isso, "Criar pasta do tema" dá erro.

---

## 1. 🔍 Busca global (lupa do topo) — NOVA
- [ ] Na **lupa do topo** ("Buscar caso, cliente, documento…"), digite parte de um **código de caso** → aparece um dropdown com o caso; clicar abre a ficha.
- [ ] Digite parte de um **nome de cliente** (com e sem acento) → aparece o cliente; clicar abre a ficha.
- [ ] Digite parte do **título de um documento** → aparece o documento; clicar abre o caso dele.
- [ ] Digite algo inexistente → "Nada encontrado".
- [ ] (Como colaborador que só vê alguns casos) a busca **não** deve retornar casos/clientes que ele não pode ver.

## 2. 👥 Cadastro — Lead ↔ Cliente exclusivo — NOVO
- [ ] Uma pessoa aparece **só em Leads** OU **só em Clientes** (nunca nas duas). Quem tem ao menos 1 caso **assinado** está em **Clientes** e sumiu de **Leads**.
- [ ] Ao **assinar** um caso de um lead, ele **vira cliente automaticamente** (some de Leads).
- [ ] **Novo Caso** tem o campo **"Situação inicial"**: **Lead** (padrão, vai ao Comercial aguardando assinatura) ou **Cliente** (já assinado, entra direto no Operacional).
- [ ] Criar caso como **Cliente** → a pessoa aparece em Clientes e o caso no Operacional (sem passar pelo Comercial).
- [ ] No seletor de cliente do Novo Caso, aparecem **todos** (leads e clientes) para vincular.
- *(Observação: uma pessoa cujos casos foram todos marcados "Perdido" volta a aparecer em Leads — me diga se prefere que não.)*

## 3. 🔐 Permissões por aba (convite e edição) — NOVO
- [ ] **Convidar** colaborador (Sistema › Permissões › Convidar): abaixo do **Papel** aparece **"Permissões por aba"**, com um seletor por aba: **Padrão do papel / Não ver / Visualizar / Editar**.
- [ ] Nas abas com valores (**Financeiro**, **Controladoria**) aparece um **2º seletor**: **Valores: padrão / Ver R$ / Ocultar R$**.
- [ ] Enviar o convite com permissões definidas → depois, ao editar o colaborador, as permissões aparecem salvas.
- [ ] **Editar** um colaborador existente (ícone lápis) → seção **"Permissões por aba"** com botão **"Salvar permissões"** próprio.
- [ ] O editor de permissões **não** aparece para o admin nem para você mesmo (evita auto-bloqueio).
- [ ] **Teste real do Matheus:** dê a ele "Não ver" em alguma aba → ao entrar como ele, a aba correspondente some do menu.

### 3b. Chave "ver valores"
- [ ] Colaborador com **Financeiro = Visualizar** mas **Valores = Ocultar R$** → ele abre a aba financeira mas **não vê os números** (vê "Em dia/Devendo" ou nada).
- [ ] Colaborador com **Valores = Ver R$** → vê os valores mesmo que o papel base não permitisse.
- [ ] Com tudo em "padrão" → comportamento igual ao de antes (admin/financeiro veem valores; os demais não).

## 4. 📂 Menu Financeiro — NOVO
- [ ] No menu lateral existe o grupo **"Financeiro"** entre **Comercial** e **Inteligência**, com **Pipeline Financeira** e **Relatório Financeiro**.

## 5. 🗂️ Temas — T1 a T4 (redesenho completo) — NOVO
**T1 — só os 5 temas:**
- [ ] Em **Pipeline Operacional**, os cards são os **temas** (Tema 1..5), **não** os tipos antigos (COVID/FIES sumiram daqui).
- [ ] Botão **"Ver todos em lista"** abre a Lista com todos os casos (inclusive os de tipos antigos ainda não vinculados a um tema).
- [ ] **Novo Caso** com temas cadastrados: o **Tema é obrigatório** (Tema → Frente); a "categoria legada" não aparece mais.
- [ ] Em **Temas** (admin): **renomear** um tema, criar **frentes**, definir **campos**.

**T2 — pasta do tema no Drive** *(depende do pré-requisito do Drive):*
- [ ] No editor do tema, botão **"Criar pasta do tema"** → cria a subpasta no Drive e mostra **"Abrir pasta do tema"**. Renomear o tema **renomeia a pasta** no Drive.

**T3 — casos/procurações vinculáveis (N:N)** *(depende do pré-requisito do Drive):*
- [ ] No editor do tema, seções **"Documentos de caso"** e **"Procurações"** têm um dropdown **"Vincular pasta existente do Drive…"** que lista as subpastas de "modelos"/"procuração" → escolher uma e **Vincular**.
- [ ] A **mesma pasta** pode ser vinculada a **vários temas** (vincule a mesma pasta em 2 temas diferentes).
- [ ] Cada pasta vinculada tem um **X** para **desvincular** (confirma que **não apaga** no Drive).

**T4 — filtros:**
- [ ] Na **Pipeline Financeira**, o filtro do topo é **"Todos os temas"** (não mais "tipos"); filtra os cards por tema.
- [ ] No **Operacional**, o filtro de **frente** (chips) segue funcionando dentro do tema.

## 6. 📊 Aba Hoje (Painel) — ATUALIZADA
- [ ] O bloco antes "Casos por tipo" agora é **"Clientes por tema"**: cada barra é um tema, o número é a **quantidade de clientes** naquele tema (casos sem tema = "Sem tema").
- [ ] "Casos recentes" mostra o **nome do tema** (não mais o tipo antigo).

## 7. 🐛 Bugs corrigidos (1ª leva)
- [ ] **Mover card na Pipeline Financeira** (arrastar entre colunas) → funciona, sem erro 422. Confira também no **Operacional** e **Comercial**.
- [ ] **Lupa de Clientes** (dentro da aba Clientes) filtra por nome/CPF/município, **ignorando acento**.
- [ ] **RG** aceita o número completo (não corta o último dígito).

## 8. 📎 Itens que faltavam detalhe (1ª leva)
- [ ] **Anexar documento**: Caso › aba **Documentos** › **"Anexar documento"**. Se o cliente não tem pasta no Drive, aparece mensagem clara (use "Sincronizar pasta do Drive" na ficha do cliente).
- [ ] **Campos FIES**: em caso de tipo FIES, o bloco **"Dados do contrato FIES"** aparece e salva (recarregue para conferir).
- [ ] **Termo de acerto**: Caso › **Termo de Acerto** › **"Elaborar"** → **Honorários (%)** e **Valor da parcela (R$)** são editáveis (15%/R$500 é só o padrão inicial).
- [ ] **Instituição de graduação / hospital**: Clientes › Editar › **"Formação, FIES e Residência"** → listas ampliadas com digitação livre.
- [ ] **Geração de documento**: Caso › Documentos › **"Gerar documento"** → escolhe modelo, campos preenchem. *(Depende de revisar os modelos no Drive: trocar texto fixo por `<...>`.)*

---

## 📌 Pendências suas / do escritório (não são bugs)
- Compartilhar a pasta do Drive com a Service Account (pré-requisito acima).
- Revisar os **modelos Word no Drive** (inserir os `<...>`).
- Definir **MIX/PLA** (o que é / de qual campo vem).
- **R6/R7/R8** (Controladoria/ProIuris, Inteligência, Inadimplência): dependem de API/regras/mockups.

## Como reportar
Para cada `[ ]` que falhar: **onde** (tela) · **o que fez** · **o que esperava** · **o que aconteceu** (print/mensagem). Eu transformo em correção.
