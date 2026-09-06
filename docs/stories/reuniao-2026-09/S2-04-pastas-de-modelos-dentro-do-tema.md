# Story S2-04: Modelos dentro da pasta do tema no Drive

- **Sprint:** S2 — Configuração de tema + Drive + ProJuris
- **ID:** S2-04 · **Item do Thiago:** 6
- **Status:** CONCLUÍDA (06/09) — QA verde
- **Estimativa relativa:** G — **story de risco alto**
- **Executor sugerido:** @dev · Quality gate: @qa **obrigatório antes do passo de exclusão**

---

## Story

**Como** administrador,
**quero** que os modelos de documento morem **dentro da pasta do tema** (`Casos` e `Procurações`),
**para que** eu pare de manter duas árvores paralelas no Drive e de errar onde subir o modelo novo.

---

## Contexto

Thiago, na reunião (bloco 2, ~19:40): *"Aqui em modelos e temas eu queria unificar essas duas, porque aqui
em temas eu vou ter os temas que estão lá (...) mas eu também tenho ao mesmo tempo essa outra pasta modelo.
Pelo que eu entendi, quando eu vou gerar lá para vincular as pastas de modelo, tá puxando daqui, não tá
puxando de lá. (...) Eu vou sempre ter uma pasta de modelos por tema. Então dentro da pasta do tema eu vou
jogar aqui os modelos desse tipo de caso. (...) Aí eu acho que assim, todas essas daqui vocês podem apagar,
tudo que tá daqui desse negócio de modelo. (...) E colocar para o sistema identificar como pastas padrões
dos modelos essas que estão dentro do tema. Quando a gente cria um tema, ele já vai criar ali essa pasta."*

Hoje o vínculo mora em `system_service_type_folders` (N pastas por tema, com `kind` caso/procuração) e
aponta para pastas dentro de uma **árvore "modelos" global** — legado da documentação do Iago, de quando
a busca era manual.

**Decisão do owner (D3):** migrar, validar e só então mandar a pasta antiga para a lixeira.
Palavras dele: *"mas cuidado aqui para não quebrar a lógica dos casos e procurações"*.

---

## Acceptance Criteria

### Parte 1 — comportamento novo

1. **Criar tema cria a estrutura**: ao criar um tema, o sistema cria (idempotente) no Drive
   `<raiz de temas>/<Nome do tema>/Casos` e `.../Procurações`, e já grava os vínculos em
   `system_service_type_folders`. Tema que já existe ganha a estrutura na primeira vez que for aberto
   na configuração.
2. **Seletor de pasta** na configuração do tema passa a mostrar **as pastas do tema**, não a árvore
   global. Continua sendo possível vincular uma pasta existente do Drive para casos excepcionais.
3. **Geração de documento** (caso e procuração) lê dos vínculos — comportamento atual — e passa a
   encontrar os modelos no novo lugar sem mudança de código no fluxo de geração.
4. A denylist de pastas escondidas do seletor (ajuste de 21/07) continua valendo.

### Parte 2 — migração (3 passos, nesta ordem, sem pular)

5. **Passo A — dry-run obrigatório.** Script `scripts/migrar-modelos-para-tema.ts --dry-run` imprime,
   por tema: pasta origem, pasta destino, arquivos a mover, vínculos a re-apontar, conflitos de nome.
   Nada é escrito. A saída vai anexada ao PR e é aprovada pelo owner.
6. **Passo B — aplicar.** `--apply` move os arquivos (`files.update` com `addParents`/`removeParents`,
   **nunca** copiar — o ID precisa ser preservado) e re-aponta `system_service_type_folders`.
   Idempotente: rodar duas vezes não duplica nada.
7. **Passo C — validação (gate).** Script `--validate` prova, e o QA confere manualmente:
   - todo vínculo ativo aponta para uma pasta **dentro** da pasta do tema;
   - todo modelo listado antes da migração está listado depois (contagem por tema bate);
   - **geração de documento de caso** e **geração de procuração** funcionam em pelo menos um tema real
     de cada tipo, ponta a ponta (gera Word → finaliza PDF → envia ao ZapSign em sandbox).
8. **Passo D — exclusão.** Só depois do gate: a árvore "modelos" antiga vai para a **lixeira** do Drive
   (não `delete` definitivo). Registro no log de auditoria com a lista do que foi enviado à lixeira.
9. **Rollback documentado**: restaurar da lixeira + rodar o script inverso de re-apontamento (o script
   grava um JSON com o mapa origem→destino antes de mover).

### Geral

10. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [ ] Criação idempotente de `Casos`/`Procurações` ao criar/abrir tema (AC 1).
      (`src/lib/service-type-folders-service.ts`, `src/rpc/temas.ts`)
- [ ] Seletor lendo as pastas do tema (AC 2, 4).
- [ ] Script de migração com `--dry-run` / `--apply` / `--validate` e mapa de rollback (AC 5-7, 9).
- [ ] Executar dry-run e anexar saída; aguardar OK do owner.
- [ ] Aplicar, validar com o QA, e só então lixeira (AC 8).
- [ ] Atualizar `docs/architecture/` com a árvore nova do Drive.

---

## Dev Notes

- **A regra de ouro desta story:** nenhuma exclusão antes da validação verde. Se o passo C falhar em
  qualquer tema, para tudo — a pasta antiga fica onde está.
- Reusar `setup-drive-folders.mjs` (idempotente) como referência de estilo para a criação de árvore.
- Cuidado com **nome de tema com barra ou acento** — sanitizar o nome da pasta e guardar o mapa por
  `tema_id`, nunca por nome.
- Conflito de nome de arquivo no destino: **não sobrescrever**; renomear com sufixo e reportar no log.
- Casos/procurações **em uso** (documentos já gerados) apontam para arquivos do Drive por ID — mover
  preserva o ID, então nada quebra. É por isso que é `move`, não `copy`.

## Definition of Done

- [ ] Dry-run aprovado pelo owner
- [ ] Migração aplicada e validada (inclusive geração real de documento nos dois tipos)
- [ ] Pasta antiga na lixeira, com log
- [ ] Rollback testado ao menos uma vez em ambiente de teste

---

## Execução — 06/09/2026

### O que mudou em relação ao rascunho

A resposta B2 do Thiago derrubou o risco alto desta story: os modelos existentes eram todos de teste,
com cópias fora do sistema. E o desenho dele acrescentou uma camada que o rascunho não previa — a
subdivisão por **categoria** dentro de MODELOS. O owner aprovou a árvore em 06/09 e confirmou que
**TIPO continua sendo só pasta no Drive**, sem entidade nova.

### O diagnóstico que mudou o plano

Antes de mexer, medimos: **os 11 vínculos de tipo apontavam todos para `07- Modelos/<TIPO>`** — era de
lá que o sistema lia — enquanto as pastas de mesmo nome dentro do tema eram **cascas vazias** criadas
pelo espelho decorativo (`mirrorFolderIntoTema`). O Drive mostrava uma árvore e o sistema usava outra.
É literalmente a queixa da reunião: *"tá puxando daqui, não tá puxando de lá"*.

Isso permitiu trocar a migração delicada de arquivos (AC 5-9 do rascunho) por algo muito mais seguro:
**mover a pasta do tipo** para dentro do tema. Mover troca o `parents` e **preserva o id**, então os
vínculos — que apontam por id — seguiram válidos sem re-apontamento, e nenhum link já gerado quebrou.

### Árvore final

```
PASTA DO TEMA
└── TIPO
    └── MODELOS
        ├── JUDICIAL
        ├── CONTRATO E PROCURAÇÃO
        └── ADMINISTRATIVO
```

### Aplicado

| Passo | Resultado |
|---|---|
| Pastas de tipo movidas para dentro do tema | 5 |
| Cascas vazias para a lixeira | 5 |
| Estruturas MODELOS criadas | 5 |
| Arquivos de modelo arquivados e inventariados | 71 |
| Resíduos de teste fora das raízes, tirados de circulação | 4 (migration `20260906000003`) |
| Modelos ativos no sistema ao final | 0 — o escritório reconstrói na estrutura nova |

Nada foi apagado: os arquivos estão **movidos** para `_ARQUIVO - modelos legados (2026-09-06)`, as
pastas foram para a **lixeira** (reversível) e `system_drive_archive_log` guarda de onde cada arquivo
veio. Foi o pedido do owner: *"apaga do sistema por enquanto, mas deixa guardado em algum lugar caso
precise voltar com ele"*.

### Fluxo de geração — 3 telas

Tela 1 tipo de caso · Tela 2 categoria · Tela 3 modelo. A tela 2 só aparece para tipo com a estrutura
nova; tipo antigo segue direto do tipo ao modelo. Categoria sem pasta aparece **desabilitada com o
motivo**, em vez de sumir.

### Uma armadilha corrigida no caminho

O soft-delete dos modelos rodava **fora do try** e sobre a lista inteira de alvos. Na primeira execução
o inventário falhou nos 71 por falta de `GRANT`, nada foi movido, e **mesmo assim 58 modelos sumiram do
app** enquanto os arquivos seguiam no lugar — some do sistema um modelo que continua exatamente onde
estava. Agora só saem de circulação os que foram efetivamente movidos.

### QA — `npm run qa:s204`

53 verificações contra o Drive e o banco reais, todas verdes: pasta de cada tipo dentro do tema com id
preservado; MODELOS e as 3 categorias com o nome literal; reexecutar não duplica; os 71 arquivos
continuam abríveis na pasta de arquivo; nenhum modelo ativo aponta para arquivo arquivado; e as
categorias são subpastas **diretas** de MODELOS — se a árvore ganhar um nível, o teste avisa antes de o
modelo sumir do popup.

### Pendências — TODAS fechadas em 06/09

**1. Tema sem pasta no Drive — feito.** "Indenização Mais Médicos" tinha `drive_folder_id` nulo. Pasta
criada, tipo movido para dentro dela, estrutura MODELOS montada. Rodar a fase `--mover` de novo devolveu
"0 pasta(s) movida(s)", o que prova a idempotência. De quebra: a pasta do TEMA também nascia com
`createFolder` cego — o mesmo defeito que gerou as duplicatas — e agora usa `ensureFolderByName`.

**2. Camadas `Casos`/`Procurações` — removidas.** Nova fase `--camadas`. Sobrou pouco dentro delas: 2
arquivos soltos que escaparam da varredura e 4 cascas vazias. A fase arquiva (movendo, com inventário) o
que estiver solto, manda para a lixeira só o que estiver vazio **e** não for referenciado por vínculo
algum — nem soft-deletado, que pode ser refeito — e só então remove a camada e limpa a coluna. Se o
inventário falhar, o arquivo **não** é movido: mover sem registrar é a única perda irreversível.
Resultado: 2 arquivos arquivados, 12 pastas na lixeira.

**3. Procuração vem da categoria — feito.** `listPastasContratoProcuracao` devolve a **união** da
categoria "CONTRATO E PROCURAÇÃO" de cada tipo com os vínculos `kind='procuracao'` legados — união, não
troca: trocar deixaria sem modelo de procuração qualquer tema ainda não migrado. Os três lugares que
derivavam as pastas por conta própria passam a ler do hook `useProcuracaoFolderIds`; antes liam só o
legado, e num tema migrado o popup sairia vazio.

**4. Fluxo duplicado — unificado.** O diálogo virou `DocumentPickerDialog`, um só. As duas cópias já
tinham divergido: só a da ficha avisava sobre placeholder órfão e sabia abrir direto num modo/pasta; só
a da aba oferecia criar a pasta no empty-state. Agora os dois lados têm tudo; o que era específico da
aba virou a prop `permiteCriarPasta`, ligada só lá (a aba é onde se configura o tema, o popup do topo é
atalho).

| Arquivo | Antes | Depois |
|---|---|---|
| CaseDocumentsTab | 1288 | 724 |
| GenerateCaseDocumentFlow | 821 | 326 |
| DocumentPickerDialog | — | 605 |
| **total** | **2109** | **1655** |

QA `npm run qa:s204-picker`: 27 verificações provando que nenhuma capacidade se perdeu na fusão.

### Árvore final no Drive

```
1% fies/          01- Abatimento ESF DGM / MODELOS / {3}
                  02- Abatimento ESF Censo 05 / MODELOS / {3}
                  04- Abatimento Militar / MODELOS / {3}
                  05- Abatimento COVID / MODELOS / {3}
Inadimplência HV/ Cobrança HV - êxitos / MODELOS / {3}
Indenização Mais Médicos/  07 - Indenização Mais Médicos / MODELOS / {3}
Desenrola FIES/            (sem tipo vinculado)
Transferência de Residência Médica/  (sem tipo vinculado)
```

Sem camada intermediária, sem casca vazia, sem árvore paralela. Os dois temas sem tipo ganham a
estrutura assim que o primeiro tipo for vinculado.
