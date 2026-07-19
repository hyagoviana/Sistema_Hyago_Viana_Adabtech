# Guia de teste da reforma (smoke test) — 2026-07

Roteiro para o Hyago validar, no ambiente, tudo o que foi entregue. Marque `[x]` o que passar e me diga o que falhar (com print/erro) — os refinamentos saem daí.

> Dica: teste logado como **admin** primeiro (vê tudo) e depois, se possível, como um usuário **operacional/comum** para conferir os bloqueios de permissão.

---

## 1. Permissões por módulo (R3/R4)
- [ ] Em **Permissões** (só admin), cada usuário tem, por módulo (Comercial/Operacional/Financeiro/Controladoria/Inteligência…), a opção **não ver / visualizar / editar**.
- [ ] Um usuário **operacional** (ou advogado) NÃO vê valores em R$: na **ficha do cliente** e na **ficha do caso** aparece só "Em dia / Devendo" (ou nada), nunca os números.
- [ ] Admin/Financeiro veem o painel financeiro completo (parcelas, totais, termo, cobranças).
- [ ] Um não-financeiro que abrir o **Dashboard Financeiro** é bloqueado (sem totais).
- [ ] A coluna **Valor** na Lista de casos só aparece para quem tem permissão financeira.

## 2. Financeiro desacoplado (R4)
- [ ] O painel financeiro do **cliente** soma as parcelas de **todos os casos** dele.
- [ ] "Nova cobrança / Gerar fatura" (Conta Azul/Asaas) aparece **dentro do painel do cliente** (escolhendo o caso) — e não solto para qualquer um.
- [ ] Operacional não vê o botão de cobrança em lugar nenhum.

## 3. Lead / Cliente por caso (R1)
- [ ] Na **ficha da pessoa**, os casos aparecem **agrupados por TEMA** e, dentro, separados em **Casos efetivados / Aguardando assinatura / Perdidos**. *(Se quiser a ordem dos grupos diferente, me avise.)*
- [ ] Bloco **"Vínculo no caso"** (município + vínculo empregatício + papel) na ficha do caso — a mesma pessoa pode ter vínculos diferentes em casos diferentes.
- [ ] Uma pessoa com um caso em assinatura e outro efetivado aparece corretamente nas duas situações.

## 4. Bugs do Hyago (R5)
- [ ] **Busca/lupa** de clientes filtra digitando o termo (sem precisar marcar chip de campo).
- [ ] **RG** aceita digitar o número completo (não corta o último dígito).
- [ ] **Anexar documento** ao caso funciona; se o cliente não tem pasta no Drive, aparece mensagem clara (não erro genérico).
- [ ] **Mover etapa** no Kanban não dá erro.
- [ ] **Instituição de graduação / hospital** têm listas ampliadas (com digitação livre).
- [ ] Em caso **FIES**, o bloco de **campos FIES** (Instituição Caixa/BB, Valor, Situação, Ano) aparece e salva.
- [ ] No **Termo de acerto**, o **% de honorários** e o **valor da parcela** são editáveis (vêm pré-preenchidos, não travados em 15%/R$500).
- [ ] Geração de documento: variáveis preenchem — **⚠️ depende de você revisar os modelos no Drive** (trocar trechos fixos por `<...>`, ex.: "POSTO DE SAÚDE DO MANGUE SECO", CBO, CNES). Os aliases Unidade de Saúde/CBO/CNES já resolvem se o modelo tiver o placeholder e o caso tiver o campo.

## 5. Temas (R2) — o mais novo, teste com atenção
- [ ] Em **Operacional/Pipeline**, botão **"Temas"** (admin) → gerenciador com **Tema 1..5** (fictícios).
- [ ] **Renomear** um tema (ex.: "Tema 1" → "FIES / 1%").
- [ ] Criar **frentes** dentro do tema (ex.: ESF, DGM, Censo, Portaria).
- [ ] Definir **campos personalizados** por tema/frente.
- [ ] Vincular **pasta do Drive** ao tema (botão "Criar pasta do tema") **depois de renomear**.
- [ ] Criar um **caso novo** escolhendo **tema → frente** → confere: entra no board do tema, o `case_code` usa o nome do tema, e os documentos/checklist da frente aparecem.
- [ ] **Vincular um caso existente** a um tema (botão "Vincular a um tema" na ficha) → confere que ele aparece no board do tema. *(A etapa pode reiniciar se não houver equivalente — é esperado, tem aviso.)*
- [ ] No Kanban, **filtro por frente** (chips) esconde colunas de outra frente.
- [ ] **Toggle Kanban ↔ Lista** ("Ver em lista" / "Kanban") preserva tema e frente; a Lista tem colunas densas e ordenação por coluna.

---

## Pendências que dependem de você / do escritório (não são bugs)
- **Modelos Word no Drive** (R5-08): revisar e inserir os `<...>` nos modelos.
- **MIX/PLA** (R4-04): dizer o que é e de qual campo vem.
- **R6/R7/R8** (Controladoria com ProIuris, Inteligência, Inadimplência): precisam de **API do ProIuris**, **regras de distribuição** por escrito e **mockups**.
- **Fusão dos temas legados FIES**: se um dia quiser fundir de verdade os service_types antigos, me avise (hoje a recomendação é você montar os temas manualmente do zero).

## Como reportar
Para cada `[ ]` que falhar: **onde** (tela), **o que fez**, **o que esperava** e **o que aconteceu** (print/mensagem). Eu transformo em correção/refinamento.
