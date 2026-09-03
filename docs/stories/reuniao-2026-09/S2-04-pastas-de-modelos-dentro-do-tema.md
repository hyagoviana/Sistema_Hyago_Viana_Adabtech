# Story S2-04: Modelos dentro da pasta do tema no Drive

- **Sprint:** S2 — Configuração de tema + Drive + ProJuris
- **ID:** S2-04 · **Item do Thiago:** 6
- **Status:** Draft
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
