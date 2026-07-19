# 🧪 Guia de teste — 3ª leva (2026-07-19)

Roteiro focado no que mudou nesta rodada. Marque `[x]` o que passar; no que falhar, escreva embaixo: **onde** · **o que fez** · **o que esperava** · **o que aconteceu** (+ print).

> **Antes:** aguarde o deploy do Vercel e faça **Ctrl+Shift+R** (hard refresh).
> **Pré-requisito Temas/Drive:** a pasta `1PtxXw…`, `modelos` e `procuração` compartilhadas como **Editor** com `hv-drive@hv-sistema.iam.gserviceaccount.com`.

---

## 1. 👤 Cadastro: Lead ↔ Cliente
- [ ] **+ Novo** (topo) abre **só** "Novo cliente" (não mostra mais Caso/Procuração/Documento).
- [ ] No cadastro, existe a chave **"É um cliente"** e ela vem **desligada**.
- [ ] Criar com a chave **desligada** → a pessoa entra em **Leads**.
- [ ] Criar com a chave **ligada** → a pessoa entra direto em **Clientes** (não aparece em Leads).
- [ ] Abrir a ficha de um **lead** → botão **"Tornar esse lead um cliente"** → clicar → some de Leads e passa a aparecer em Clientes.
- [ ] Uma pessoa aparece **só em Leads OU só em Clientes** (nunca nas duas).

retorno:

## 2. 🗑️ Excluir cliente
- [ ] Excluir um cliente → some do sistema **e a pasta dele some do Drive** (vai para a lixeira). *(As 90 pastas antigas de clientes excluídos já foram limpas.)*

retorno:

## 3. 🔐 Permissões por aba (o problema do Matheus)
- [ ] Editar o **Matheus** (Operacional) → defina, por aba: ex. **Operacional = Não ver**, **Financeiro = Visualizar**, **Comercial = Não ver** → **Salvar permissões**.
- [ ] Entrar como o **Matheus** → o **menu reflete** o que você marcou: as abas em "Não ver" **somem**; as em "Visualizar/Editar" aparecem. (Hoje = 19h: antes o menu ignorava isso.)
- [ ] Chave **"Ver valores"**: colaborador com **Financeiro = Visualizar** + **Valores = Ocultar R$** → abre a aba mas **não vê os números**.

retorno:

## 4. 🔍 Busca global (lupa do topo)
- [ ] Digite **"financeiro"** → aparece a **aba/página** Financeiro (com a ramificação "Financeiro ›" à direita) e clicar leva lá.
- [ ] Digite o nome de um **tema** → aparece como **Tema** e leva ao Pipeline.
- [ ] Digite o nome de um **cliente** → aparece o cliente.
- [ ] (Com casos/documentos criados) digite parte do **código do caso** ou do **título de um documento** → aparecem.
- [ ] Cada resultado mostra a **ramificação** (onde vai levar) e o **tipo** (Caso/Cliente/Tema/Página/Documento).

retorno:

## 5. 🗂️ Temas (criar, pastas, vincular, excluir)
- [ ] **Pipeline Operacional → "+ Novo tema"** → digite o nome → confere no Drive que nasceu `1PtxXw/<Tema>` com as subpastas **Casos** e **Procurações**.
- [ ] **Lápis** no card do tema → abre **só o editor** do tema (não abre a lista "Temas" por trás). Fechar não "cai" na lista.
- [ ] No editor: **renomear** o tema → a pasta no Drive renomeia junto.
- [ ] Seção **Casos** → **"Vincular pasta existente do Drive…"** lista suas 6 pastas de caso (de `modelos`) → vincular uma → aparece + é criada (vazia) dentro de `<Tema>/Casos`.
- [ ] Seção **Procurações** → mesma coisa com suas 7 pastas (de `procuração`) → vai para `<Tema>/Procurações`.
- [ ] **Criar nova** pasta pelo tema (Casos ou Procurações) + anexar o Word → nasce nos 2 lugares (no tema e em `modelos`/`procuração`).
- [ ] **Excluir** o tema → confirma → a pasta do tema vai para a **lixeira do Drive**.
- [ ] No Pipeline, os cards são só os **temas** (COVID/FIES não aparecem).

retorno:

## 6. 📄 Criar caso pela ficha do cliente (bug corrigido)
- [ ] Na ficha de um cliente/lead, **"Novo caso"** → o popup **abre sem quebrar a página** (antes dava erro `useFormField`).
- [ ] Escolher **Tema → Frente**, Situação inicial (Lead/Cliente) → **Criar caso**.
- [ ] Depois, na **ficha do caso → aba Documentos → "Gerar documento"** → escolher modelo → variáveis → Word editável → enviar ao **ZapSign**. *(Fluxo em 2 passos, como combinado.)*

retorno:

## 7. 📊 Aba Hoje
- [ ] O bloco é **"Clientes por tema"** (cada barra = um tema, número = clientes nele).
- [ ] "Casos recentes" mostra o **nome do tema**.

retorno:

## 8. 🐛 Bugs da 1ª leva (reconfirmar)
- [ ] **Mover card na Pipeline Financeira** (arrastar) → sem erro 422.
- [ ] **Lupa dentro de Clientes** filtra por nome/CPF ignorando acento.
- [ ] **RG** aceita o número completo.

retorno:

---

## 📌 Depende de você / do escritório (não é bug)
- Revisar os **modelos Word no Drive** (inserir os `<...>` no lugar do texto fixo).
- Definir **MIX/PLA**.
- **Controladoria/Inteligência/Inadimplência** (R6/R7/R8): dependem de API/regras/mockups.
