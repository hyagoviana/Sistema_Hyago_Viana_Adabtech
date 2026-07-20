# 🔧 Ajustes finos — alinhamento com o Adavio (transcrição 2026-07-20)

> Levantamento de TUDO que apareceu na transcrição `Transcriação alinhamento sistema hyago.txt`, sem deixar nada de fora.
> **Conta Azul = o advogado (Adavio) faz — NÃO mexer** (decisão do Hyago).

---

## 1. 🔧 A EXECUTAR (nós) — ajustes de código

| # | Ajuste | Origem (fala) | Risco |
|---|--------|---------------|-------|
| **A1** | **Ver em lista — filtros rápidos no topo**: filtrar por **tipo/tema** e por **caso/nome**, com botões de filtro rápido em cima. Hoje o filtro por tema **não filtra** (ex.: COVID mostra os dois). | "tem que colocar uns filtros que eles querem, tipo filtro por tipo… ou caso… selecionar os filtros rápidos" · "não tá filtrando" | MÉDIO |
| **A2** | **Ver em lista — mais informações/colunas**: hoje mostra pouca coisa; falta pasta/modelo e o resto. "Precisa ter todas essas informações." | "tem pouca informação aqui, tá faltando o resto… pasta modelo" | BAIXO |
| **A3** | **Ver em lista — clicar em qualquer parte da linha abre o caso** (hoje só clicando no código). | "clicável qualquer canto… abre a linha… ele tá só quando eu clico no código" | BAIXO |
| **A4** | **Kanban / Pipeline operacional — mais filtros** (mesmos filtros do ver em lista). | "tem que ter no Kanban… mais filtros no pipeline operacional" | MÉDIO |
| **A5** | **Pipeline operacional do tema — remover a opção "Financeiro" ao lado**: dentro do pipeline operacional só aparece **Operacional** (financeiro é módulo separado, já tem aba própria). | "vou tirar essas opções… só aparece pipeline operacional, não pode ter esse financeiro do lado" | BAIXO |
| **A6** | **Editar usuário — mostrar o telefone** que o colaborador preencheu no onboarding (hoje não aparece no editar usuário). | "não tá aparecendo… tem que aparecer o número que ele colocar lá quando terminar o cadastro" | BAIXO |
| **A7** | **Fechar o gate de escrita no SERVIDOR para checklist e termo** (ficou como `requireAuth`; falta exigir `edit` no módulo). | "fechar o gate de escrita checklist no termo servidor" · Matheus: "isso que eu nem fiz" | MÉDIO |
| **A8** | **Seletor de responsável do caso — incluir ADMIN** (e revisar quais papéis aparecem). Hoje só advogado_titular/associado; admin não aparece. | "não tá selecionando advogado… pelo menos administrador deveria aparecer" | BAIXO |
| **A9** | **Bug: confirmar assinatura NÃO joga o caso na pipeline operacional.** Criou caso + confirmou assinatura, mas o caso não apareceu no operacional. Deveria cair. | "criei o caso, confirmar assinatura… mas ele não caiu na pipeline operacional, ele tem que cair" | ALTO |
| **A10** | **Bug: editar o nome do tema não atualiza o rótulo no topo do caso.** Ao entrar no caso para vincular, o cabeçalho mostra "cliente – nome do tema **ANTIGO**". | "em cima tá o nome do cliente traço o nome do tema antigo, não atualizou… precisa alterar" | MÉDIO |
| **A11** | **Vincular pasta de CASO no tema — filtrar as pastas oferecidas**: está puxando pastas que não deviam (07, 08 e o termo financeiro); só devem aparecer as de caso (até a 06). *(Adavio disse "depois eu ajusto" — confirmar se é ele ou nós.)* | "tá puxando os 7, 8 e o termo financeiro, não pode, até o 6 só" | BAIXO |

---

## 2. 🧠 A EXECUTAR — o "motor" de variáveis dos documentos (o item mais pesado)

| # | Ajuste | Origem (fala) |
|---|--------|---------------|
| **B1** | **Documentos não preenchem com o cadastro do cliente.** As variáveis (CRM, UF, vínculo institucional, e os campos FIES: instituição financeira, valor, situação, ano do contrato) **não puxam** para o documento gerado. Alguns docs puxam dados do médico, outros não. Precisa de um "**motor que leia e mude**", cobrindo **todos** os campos do cadastro e valendo também para **documentos novos** que forem anexados. | "documento que não era preenchido com cadastro do cliente" · "tá pedindo instituição financeira, valor, situação, ano do FIES" · "fica inconsistente no preenchimento" · "tem que ter um motor que leia e mude" |

> **Parte código (nós):** garantir que o autofill mapeie **todos** os campos do cadastro/FIES para as variáveis; robustez para modelos novos.
> **Parte do escritório (owner):** os modelos Word precisam ter os **placeholders `<…>`** nos lugares certos (root cause já identificado). Sem isso, não há o que preencher.

---

## 3. 💰 Termo atrelado ao contrato assinado (candidato — confirmar se é nós ou Adavio)

| # | Ajuste | Origem (fala) |
|---|--------|---------------|
| **C1** | O **valor/percentual/parcela do termo** deve vir **atrelado ao que foi preenchido no contrato/procuração** no momento da assinatura — para não conferir o contrato na mão. Regra: **salvar as variáveis do documento no banco** e **só considerar quando o documento estiver ASSINADO**; aí o termo já abre pré-preenchido com esses valores. | "esteja atrelado no caso… evita o trabalho manual de conferir o contrato" · "salvar as variáveis do Word… só leva em consideração aqueles que foram assinados… apareceu o valor dentro do termo de aceite" · Adavio: "eu vou fazer isso aqui" |

> Já existe base para isso (`system_case_honorarios` pré-preenche o termo). O que falta é **capturar as variáveis do documento assinado → gravar no caso → alimentar o termo**. Depende do B1 (motor de variáveis). **Adavio falou "eu vou fazer isso" — confirmar divisão.**

---

## 4. ✅ JÁ FEITO (confirmado no alinhamento — só validar no ar)

- Cadastro **lead→cliente sem duplicar** (sai de lead, fica só em cliente). ✅
- **Temas**: criação + pasta Casos/Procurações + vincular/criar + replicação em modelos. ✅
- **RG** com máscara (ponto e traço, número completo). ✅
- Chave **"é um cliente"** no cadastro + botão **"mandar para cliente"**. ✅
- **Lupa/busca global** funciona (nome, CPF, tema, página). ✅
- **Erro ao mover etapa do Kanban** — corrigido. ✅
- **Permissões ver/visualizar/editar** + chave "ver valores" — funcionando. ✅
- **15%/R$500 editáveis no termo** — já dá para alterar (falta só o C1: vir do contrato). ✅
- **Anexar/baixar documento** no cliente — cai na pasta do Drive. ✅

---

## 5. 🔒 DEPENDE DE DECISÃO / CLIENTE (não é código imediato)

- **Base de dados de graduação / residência hospitalar / instituição**: hoje é **texto livre** (dá para digitar). Perguntar na reunião se querem **base fechada** ou manter livre. — "a gente fala com ele na reunião".
- **Fusão ESF + DGM** (temas): o Hyago disse que **não precisa** / "já deu certo" pelos temas. — não executar.

---

## 6. ⏭️ CONTA AZUL — o ADVOGADO (Adavio) faz — NÃO MEXER

- Cobrança no Conta Azul, sincronização, "não cria cliente"/erro 400, cobrança pré-preenchida do termo aprovado (só troca forma de pagamento). Tudo isso o Adavio conduz (ele tem acesso ao Conta Azul). **Fora do nosso escopo agora.**

---

## 7. 🎯 Ordem sugerida de execução (nós)

1. **Quick wins de baixo risco:** A3 (linha clicável), A5 (tirar financeiro do pipeline op), A6 (telefone no editar usuário), A8 (admin no responsável), A2 (mais colunas no ver em lista).
2. **Filtros:** A1 + A4 (filtros no ver em lista e no Kanban) — corrigir também o filtro por tema que não filtra.
3. **Bugs:** A10 (nome do tema antigo no topo), A9 (assinatura não cai no operacional — investigar o fluxo de promoção).
4. **Gate servidor:** A7 (checklist + termo).
5. **A11**: confirmar com Adavio se o filtro de pastas é dele ou nosso.
6. **Motor de variáveis (B1) + termo atrelado (C1):** o mais pesado — alinhar divisão com o Adavio (parte owner = revisar modelos Word com `<…>`).

*— Levantamento por Orion, 2026-07-20.*
