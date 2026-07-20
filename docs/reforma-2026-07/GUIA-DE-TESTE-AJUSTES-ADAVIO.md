# 🧪 Guia de teste — ajustes do alinhamento (Adavio) 2026-07-20

> Aguarde o deploy e faça **Ctrl+Shift+R**. Marque `[x]` o que passar; no que falhar, escreva **onde · o que fez · o que esperava · o que aconteceu**.

## A1/A2 — Ver em lista (filtros + colunas)
- [ ] Abra **Casos → Ver em lista**. No topo há **busca** + dropdown **"Todos os temas"** + dropdown **"Todas as etapas"**.
- [ ] Selecionar um **Tema** filtra a lista só para aquele tema (e some os outros).
- [ ] Selecionar uma **Etapa** filtra por etapa operacional.
- [ ] A lista mostra as colunas: Código, Cliente, Tipo, **Tema**, Frente, Operacional, Financeiro, Responsáveis, Município, (Valor se tiver permissão), Criado em — e dá pra **ordenar** clicando no cabeçalho.

retorno:

## A3 — Linha clicável
- [ ] No Ver em lista, **clicar em qualquer parte da linha** abre o caso (não só no código).

retorno:

## A4 — Filtro no Kanban
- [ ] Abra o **Pipeline Operacional** (um tema). No topo há um campo **"Buscar cliente ou código…"** que filtra os cards.

retorno:

## A5 — Sem "Financeiro" no Pipeline Operacional
- [ ] No Pipeline Operacional **não existe mais** o botão/toggle "Financeiro" ao lado — só o operacional. (Financeiro segue na aba própria.)

retorno:

## A6 — Telefone do usuário
- [ ] Em **Permissões/Usuários**, o **telefone** do colaborador aparece na lista (embaixo do e-mail) e no "Editar".
- [ ] (Se estiver vazio) crie um colaborador, faça o onboarding preenchendo o telefone, e confira se aparece.

retorno:

## A7 — Visualizar não edita (servidor)
- [ ] Colaborador com **Operacional = Visualizar**: ao tentar **marcar item de checklist** ou **criar tarefa** → recebe "sem permissão" (403). Botões já escondidos; se forçar, bloqueia.
- [ ] Colaborador com **Financeiro = Visualizar**: ao tentar **elaborar/aprovar termo** ou **dar baixa/excluir parcela** → bloqueia.
- [ ] Quem tem **Editar** no módulo continua conseguindo tudo.

retorno:

## A8 — Admin no responsável
- [ ] Ao criar caso ("Novo tema"), no seletor de **Responsável** o **admin** aparece na lista (além dos advogados).

retorno:

## A9 — Assinatura cai no operacional (bug)
- [ ] Crie um caso por "Novo tema" (cadastro **lead**), gere o documento e **confirme a assinatura** → o caso **aparece na Pipeline Operacional** (numa coluna válida).
- [ ] Crie um caso para um cadastro **já cliente** → aparece direto no operacional.

retorno:

## A10 — Nome do tema atualizado no caso (bug)
- [ ] **Edite o nome de um tema**. Depois abra um **caso desse tema** → o nome do tema no topo/rótulos reflete o **nome novo** (não o antigo). Casos novos usam o nome novo no código.

retorno:

## B1 — Variáveis dos documentos (depende de você)
- [ ] Só vai preencher **se o modelo Word tiver os `<…>`** nos lugares. Com um modelo com placeholders (`<crm>`, `<vínculo institucional>`, campos FIES, etc.), gere e confira o preenchimento. Se algum `<…>` não puxar, me mande o modelo + o campo.

retorno:

## A11 — Filtro de pastas no vínculo de caso do tema
- [ ] No editor do tema, seção **Casos → "Vincular pasta existente"**: **não** aparecem mais pastas de **procuração/contrato/termo/financeiro** (só as de caso). *(A reorganização final das pastas 07/08 no Drive é do escritório.)*

retorno:

## C1 — Termo puxa valores do contrato assinado
- [ ] Gere um documento (contrato/procuração) preenchendo **% de honorários** e **valor da parcela** (o modelo precisa ter esses placeholders: `percentual_honorarios`, `valor_parcela`).
- [ ] **Confirme a assinatura** do documento.
- [ ] Abra **Elaborar Termo de Acerto** → os campos **Honorários (%)** e **Valor da parcela** já vêm **pré-preenchidos com os valores do contrato assinado** (editáveis).
- [ ] Um documento **não assinado** NÃO deve alimentar o termo.

retorno:

---
### Fora deste teste
- **B1** (variáveis) depende dos modelos Word com `<…>`.
- **Conta Azul** — o Adavio conduz.
