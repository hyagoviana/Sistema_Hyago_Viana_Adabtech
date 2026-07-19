# Guia de teste da reforma (smoke test) — 2026-07

Roteiro para o Hyago validar, no ambiente, tudo o que foi entregue. Marque `[x]` o que passar e me diga o que falhar (com print/erro) — os refinamentos saem daí.

> Dica: teste logado como **admin** primeiro (vê tudo) e depois, se possível, como um usuário **operacional/comum** para conferir os bloqueios de permissão.

---

## 1. Permissões por módulo (R3/R4)
- [ ] Em **Permissões** (só admin), cada usuário tem, por módulo (Comercial/Operacional/Financeiro/Controladoria/Inteligência…), a opção **não ver / visualizar / editar**.
retorno: como deve funcionar isso aqui, quando for convidar algum colaborador, no popup de convite de usuário depois em baixo do campo papel, precisa ter todas as abas em baixo, e ali o administrador antes de enviar o convite ele vai colocando aba por aba para aquele novo colaborador qual aba ele pode não ver / visualizar / editar, e isso se espelha quando o colaborador novo terminar de fazer o preenchido e a senha quando ele entrar no sistema ele só consegue não ver / visualizar / editar as abas selecionadas para ele, quero q funcione assim, eu cadastrei um colaborador novo Matehus de oliveira torquato, e não consegui dar as permissões adequadas. 

- [ ] Um usuário **operacional** (ou advogado) NÃO vê valores em R$: na **ficha do cliente** e na **ficha do caso** aparece só "Em dia / Devendo" (ou nada), nunca os números.
retorno: isso aqui de valores vamos colocar uma opção que ficara legal, quando for convidar algum colaborador novo, para as abas que tem valor a ser mostrado vamos ter uma chave true ou false aonde pode ser ativada para o colaborador novo pode ver valores naquela aba ou não, ou seja na aba financeiro tem valores correto, então ali precisa ter a chave permitindo ou não a aquele colaborador olhar valores, e preciso que vc mapeia quais abas tem valores a amostra, e pense no futuro também porque por exemplo não mexemos em controladoria ainda mas sei q la vai ter valores, então precisa setar essa permissão para essa aba. 

- [ ] Admin/Financeiro veem o painel financeiro completo (parcelas, totais, termo, cobranças).
retorno: tudo certo, vamos amarrar na questão das permissões acho q isso é irrelevante, será feito manual mesmo por usuário convidado 

- [ ] Um não-financeiro que abrir o **Dashboard Financeiro** é bloqueado (sem totais).
retorno: beleza

- [ ] A coluna **Valor** na Lista de casos só aparece para quem tem permissão financeira.
retorno:como vamos amarrar na questão das permissões acho q isso é irrelevante, será feito manual mesmo por usuário convidado 



## 2. Financeiro desacoplado (R4)
- [ ] O painel financeiro do **cliente** soma as parcelas de **todos os casos** dele.
retorno: ta certo

- [ ] "Nova cobrança / Gerar fatura" (Conta Azul/Asaas) aparece **dentro do painel do cliente** (escolhendo o caso) — e não solto para qualquer um.
retorno: isso preciso testar depois com calma 

- [ ] Operacional não vê o botão de cobrança em lugar nenhum.
retorno: ta certo



## 3. Lead / Cliente por caso (R1) (Observação aqui da logica pois esta errada para esse ajuste: como será feito agora, todo cadastro feito é um lead e esse lead fica dentro do cadastro e fica dentro da pepiline comercial, mas se o lead tiver um caso assinado ele automaticamente vira um cliente, então o cadastro que esta no lead não pdoe aparecer dentro de lead, entãoa  anova logica deve ser, ou o cadastro esta dentro de lead ou dentro de clientes, não pode estar nos 2, se aquele cadastro já é um cliente ele não pode ter o cadastro duplicado dentro de lead, e quando clicar me novo caso, e for selecionar um cadastro para vincular um caso novo deve ter a opção de escolher se é um cliente ou um lead, entendeu agora como deve ser essa parte de cadastro ? 
- [ ] Na **ficha da pessoa**, os casos aparecem **agrupados por TEMA** e, dentro, separados em **Casos efetivados / Aguardando assinatura / Perdidos**. *(Se quiser a ordem dos grupos diferente, me avise.)*
retorno: tudo certo 

- [ ] Bloco **"Vínculo no caso"** (município + vínculo empregatício + papel) na ficha do caso — a mesma pessoa pode ter vínculos diferentes em casos diferentes.
retorno: tudo certo 

- [ ] Uma pessoa com um caso em assinatura e outro efetivado aparece corretamente nas duas situações.
retorno: tudo certo 



## 4. Bugs do Hyago (R5)
- [ ] **Busca/lupa** de clientes filtra digitando o termo (sem precisar marcar chip de campo).
retorno: lupa ainda não funciona precio que veja
> **▸ [CORRIGIDO 2026-07-19]** A busca agora também ignora **acento** (buscar "sao"/"jose" acha "São"/"José") — a causa provável era digitar com/sem acento. **Re-teste (2ª leva):** em **Clientes**, digite parte do **nome** (com e sem acento), depois um **CPF** (com e sem pontos) e um **município** — a lista deve filtrar em tempo real, sem abrir "Filtros Avançados". Se ainda falhar, me diga **exatamente o que digitou** e se a lista tem quantos itens.

- [ ] **RG** aceita digitar o número completo (não corta o último dígito).
retorno: tudo certo

- [ ] **Anexar documento** ao caso funciona; se o cliente não tem pasta no Drive, aparece mensagem clara (não erro genérico).
retorno: preciso de mais detalhes para testar
> **▸ Como testar (2ª leva):** abra um **caso** → aba **Documentos** → botão **"Anexar documento"** (topo direito). Escolha um `.pdf`/`.doc`/`.docx` → deve subir e listar. **Teste da mensagem clara:** use um caso cujo **cliente ainda não tem pasta no Drive** → ao anexar deve aparecer *"O cliente não tem pasta no Drive… use 'Sincronizar pasta do Drive' e tente novamente"* (não um erro genérico). Depois, na ficha do **cliente**, clique **"Sincronizar pasta do Drive"** e repita — agora anexa normal.

- [ ] **Mover etapa** no Kanban não dá erro.
retorno:  ainda continua com erro (index-CsDVzrmZ.js:12 
 POST https://www.sistemahyagoviana.com.br/_serverFn/dcb6540… 422 (Unprocessable Content)
(anonymous)	@	index-CsDVzrmZ.js:12
uD	@	index-CsDVzrmZ.js:12
lD	@	index-CsDVzrmZ.js:12
await in lD		
Object.assign.url	@	index-CsDVzrmZ.js:12
client	@	index-CsDVzrmZ.js:12
i	@	index-CsDVzrmZ.js:12
gS	@	index-CsDVzrmZ.js:12
Object.assign	@	index-CsDVzrmZ.js:12
(anonymous)	@	index-CsDVzrmZ.js:12
mutationFn	@	index-CsDVzrmZ.js:118
fn	@	index-CsDVzrmZ.js:12
x	@	index-CsDVzrmZ.js:12
start	@	index-CsDVzrmZ.js:12
execute	@	index-CsDVzrmZ.js:12
await in execute		
mutate	@	index-CsDVzrmZ.js:12
(anonymous)	@	index-CsDVzrmZ.js:12
B	@	casos.financeiro.index-nVydNlP8.js:1
R	@	StageEditor-C9QaPFdR.js:5
(anonymous)	@	StageEditor-C9QaPFdR.js:5
Fn.unstable_batchedUpdates	@	index-CsDVzrmZ.js:2
(anonymous)	@	StageEditor-C9QaPFdR.js:5
handleEnd	@	StageEditor-C9QaPFdR.js:5) esse é da etapa da pepline financeira, mas queor q veja em todos, comercial e operacional
> **▸ [CORRIGIDO 2026-07-19]** Causa raiz achada: o board financeiro é um **funil único** (compartilhado por todos os tipos), mas o back exigia que a etapa-destino pertencesse ao *tipo* do caso → rejeitava todo arraste com **422**. Agora o funil único é aceito. **Verifiquei os 3:** Comercial e Operacional **não tinham** esse bug (validam de outro jeito); o do Financeiro foi corrigido. **Re-teste (2ª leva):** arraste um card entre colunas na **Pipeline Financeira** → deve mover e mostrar o toast "Financeiro movido pra …". Repita no **Operacional** e no **Comercial** para confirmar.

- [ ] **Instituição de graduação / hospital** têm listas ampliadas (com digitação livre).
retorno: preciso de mais detalhes para testar
> **▸ Como testar (2ª leva):** vá em **Clientes** → abra um cliente → **Editar** → seção **"Formação, FIES e Residência"**. No campo **Instituição de graduação** comece a digitar (ex.: "UF") → deve aparecer uma lista de sugestões (150+ faculdades); e você também consegue **digitar um nome que não está na lista** e ele salva. Mesmo teste no campo **Residência — hospital**. Salve e reabra para confirmar que persistiu.

- [ ] Em caso **FIES**, o bloco de **campos FIES** (Instituição Caixa/BB, Valor, Situação, Ano) aparece e salva.
retorno: preciso de mais detalhes para testar
> **▸ Como testar (2ª leva):** abra (ou crie) um **caso de um tipo FIES**. Na ficha deve aparecer o bloco **"Dados do contrato FIES"** com: **Instituição Financeira** (Caixa / Banco do Brasil), **Valor / saldo devedor** (R$), **Situação** (Ativo / Inativo / FIES liquidado) e **Ano do contrato**. Preencha, saia do campo (ele salva sozinho no *onBlur*/seleção), **recarregue a página** e confira se manteve. Em um caso de tipo **não-FIES** o bloco **não** deve aparecer.

- [ ] No **Termo de acerto**, o **% de honorários** e o **valor da parcela** são editáveis (vêm pré-preenchidos, não travados em 15%/R$500).
retorno: preciso de mais detalhes para testar
> **▸ Como testar (2ª leva):** na ficha do **caso** → painel **"Termo de Acerto"** → botão **"Elaborar"**. No diálogo, os campos **Honorários (%)** e **Valor da parcela (R$)** vêm pré-preenchidos (15% e R$500 são só *padrão* quando o caso não tem valor) mas você **consegue alterar** os dois. Mude para, ex., 20% e R$ 800,00 → **"Calcular e revisar"** → o cálculo deve refletir os novos valores. (O 15%/R$500 só aparece como ponto de partida, não travado.)

- [ ] Geração de documento: variáveis preenchem — **⚠️ depende de você revisar os modelos no Drive** (trocar trechos fixos por `<...>`, ex.: "POSTO DE SAÚDE DO MANGUE SECO", CBO, CNES). Os aliases Unidade de Saúde/CBO/CNES já resolvem se o modelo tiver o placeholder e o caso tiver o campo.
> **▸ Como testar (2ª leva):** ficha do **caso** → aba **Documentos** → botão **"Gerar documento"** → escolha **"Procuração"** ou **"Documento do caso"** → escolha a **pasta** (categoria) e o **modelo** (tem busca por nome). O sistema lê os campos do modelo ("Lendo campos do modelo…"); os que ele consegue preencher sozinho vêm marcados **(preenchido)** em verde, e os obrigatórios com `*`. Clique **"Gerar"** → abre o Google Docs embutido para revisar → **"Concluí a edição (Finalizar)"** gera o PDF na pasta do caso. **Importante:** um campo só é substituído se o **modelo tiver o placeholder** `<...>` — por isso a revisão dos modelos no Drive é o pré-requisito. **Como saber se um campo não preencheu:** se no doc gerado sobrou um texto fixo antigo (ex.: "POSTO DE SAÚDE DO MANGUE SECO"), é porque naquele modelo aquilo é texto fixo, não `<Unidade de Saúde>`.
retorno: preciso de mais detalhes para testar 



## 5. Temas (R2) — o mais novo, teste com atenção: esse tópico ainda ainda não esta do jeito q eu pedi, eu vou descrever mais claramente para vc entender e fazer do jeito que eu quero, tanto visualmente como no back por traz do sistema, 
descrição: temos hoje a pasta dentro do drive chamada modelos que é essa aqui https://drive.google.com/drive/u/0/folders/1su0XT7i2B7ziHGN1PTz5ZRhSWNFEZOsJ e aqui é salvo todos os documentos de casos criados, mas eu vou criar uma pasta nova chamada tema que será criado a pasta de cada tema que temos, eu pedi para ser criamos 5 temos novos e só pdoe ter esses lá o Tema 1, Tema 2, Tema 3, Tema 4 e Tema 5, a pasta nova que tem os temas são esses aqui https://drive.google.com/drive/u/0/folders/1PtxXwOMn0ibNRXyzAQN-79mHUJc8w4Ro dentro dessa pasta precisa ter uma pasta para cada tema criado eu ano criei ainda, mas vc precisa criar, e quando cria rum tema novo precisa cair dentro dessa pasta com o nome do tema, ou seja os outros temas que estão no front ali com covid e etc são casos não é para estar ali só é para ter os 5 temas que eu mandei, quando eu criar um tema ou editar um toma precisa ter a opção de adicionar novos casos a aquele tema e assim cria uma pasta daquela caso novo dentro do tema  e duplica também uma pasta dentro dos casos, assim eu consigo vincular o mesmo caso criado em vários temas, e eu preciso conseguir excluir e adicionar pastas de casos dentro dos temas, eou seja dentro do tema quando for vincular um caso precisa puxar todas as pastas dos casos existentes que ficam aqui https://drive.google.com/drive/u/0/folders/1su0XT7i2B7ziHGN1PTz5ZRhSWNFEZOsJ e isso serve também para procuração que fica dentro dessa pasta aqui em modelos https://drive.google.com/drive/u/0/folders/1ed5kBsyHalUuMoap_0i_KJQ_fFfbiPYd e quando eu adicionar procurações novas é criado uma pasta dentro do tema e dentro da pasta https://drive.google.com/drive/u/0/folders/1ed5kBsyHalUuMoap_0i_KJQ_fFfbiPYd para ser usado essa procuração em outros temas se eu quiser, e quando eu entrar no tema terá a pepiline e dentro do tema pode ter vários casos diferentes mas tudo fica organizado por tema, e na pepline quero q tenha filtro para tudo para filtrar. 
- [ ] Em **Operacional/Pipeline**, botão **"Temas"** (admin) → gerenciador com **Tema 1..5** (fictícios).
retorno: 

- [ ] **Renomear** um tema (ex.: "Tema 1" → "FIES / 1%").
retorno: 

- [ ] Criar **frentes** dentro do tema (ex.: ESF, DGM, Censo, Portaria).
retorno: 

- [ ] Definir **campos personalizados** por tema/frente.
retorno: 

- [ ] Vincular **pasta do Drive** ao tema (botão "Criar pasta do tema") **depois de renomear**.
retorno: 

- [ ] Criar um **caso novo** escolhendo **tema → frente** → confere: entra no board do tema, o `case_code` usa o nome do tema, e os documentos/checklist da frente aparecem.
retorno: 

- [ ] **Vincular um caso existente** a um tema (botão "Vincular a um tema" na ficha) → confere que ele aparece no board do tema. *(A etapa pode reiniciar se não houver equivalente — é esperado, tem aviso.)*
retorno: 

- [ ] No Kanban, **filtro por frente** (chips) esconde colunas de outra frente.
retorno: 

- [ ] **Toggle Kanban ↔ Lista** ("Ver em lista" / "Kanban") preserva tema e frente; a Lista tem colunas densas e ordenação por coluna.
retorno: 

---

## Pendências que dependem de você / do escritório (não são bugs)
- **Modelos Word no Drive** (R5-08): revisar e inserir os `<...>` nos modelos.
- **MIX/PLA** (R4-04): dizer o que é e de qual campo vem.
- **R6/R7/R8** (Controladoria com ProIuris, Inteligência, Inadimplência): precisam de **API do ProIuris**, **regras de distribuição** por escrito e **mockups**.
- **Fusão dos temas legados FIES**: se um dia quiser fundir de verdade os service_types antigos, me avise (hoje a recomendação é você montar os temas manualmente do zero).

## Como reportar
Para cada `[ ]` que falhar: **onde** (tela), **o que fez**, **o que esperava** e **o que aconteceu** (print/mensagem). Eu transformo em correção/refinamento.
