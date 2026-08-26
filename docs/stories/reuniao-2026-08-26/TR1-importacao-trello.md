# Story TR1: Importar do Trello — descrição vira Observações, comentários viram linha do tempo

**Épico:** Reunião 2026-08-26 · **ID:** TR1 · **Onda:** 4 · **Status:** Draft (BLOQUEADA — falta credencial)
**Executor:** @dev · Quality gate: @qa
**Risco:** MÉDIO — importação em dados reais. Mitigado pelo piloto de 29 casos e pelo dry-run.

---

## Story

**Como** Thiago, que quer o time fora do Trello,
**quero** trazer para o SHV **só o histórico que importa** de cada card — a **descrição** e os **comentários** —
**para que** o pessoal tenha o passado à mão no sistema e pare de voltar no Trello.

Ele foi específico sobre o recorte: "a gente não quer puxar tudo que exista. A gente só importaria a descrição, que vai vir aqui para observações, como comentário de observações, e os comentários, que vão vir como se fosse um comentário sendo registrado aqui na data e tal."

E sobre o piloto: "eu deixei um tema bem pequenininho, 29 casos ali, para a gente fazer esse teste."

---

## BLOQUEIO (resolver antes de começar)

1. **Credenciais da API do Trello** (API key + token) — o Matheus ficou de dizer exatamente o que precisa; o Thiago gera.
2. **Identificação do board/lista** de origem do tema-piloto.
3. **Onde está o ID do card no SHV.** O Thiago disse que já mandou o time preencher, em cada caso, um campo com o **ID do card** ("não é um campo que vai ficar de fato no sistema, mas só para a gente trabalhar na exportação"). **Confirmar qual campo é** (provavelmente um campo do tema em `canonical_fields`) antes de escrever o casamento.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Campo Observações do caso:** coluna `system_cases.observacoes` (story M2, implementada em 08/08) — é o destino da **descrição** do card.
- **Notas/linha do tempo:** `src/lib/notes-service.ts` (`createCaseNote(caseId, body, autor, scope)`) e `system_case_events` — destino dos **comentários**.
- **Import com dry-run:** `sistema-hv/scripts/import-mais-medicos.py` é o molde de ETL idempotente (`--dry-run` → `--commit`), inclusive com relatório por entidade. A planilha-fonte agora vive em `material/planilhas/`.
- **Serviço de importação do app:** `src/lib/import-service.ts` + `src/routes/configuracoes.importacao.tsx` (importação por planilha) — **referência de padrão**, não necessariamente o caminho (este ETL é script, não tela).
- **Campos do tema:** `canonical_fields` do caso guarda os valores por chave (é onde deve estar o ID do card).

### NOVO

1. Cliente da API do Trello (leitura: cards do board, `desc`, `actions` do tipo `commentCard`).
2. Script de importação com dry-run: casa card ↔ caso pelo ID, escreve Observações e cria as notas.
3. Marcação de idempotência para não duplicar comentário em reexecução.

---

## Acceptance Criteria

1. **Casamento explícito.** Cada card é ligado a um caso pelo **ID do card** guardado no caso. Card sem caso correspondente é **relatado** e ignorado — nunca cria caso novo.
2. **Descrição → Observações.** A `desc` do card é gravada em `system_cases.observacoes`. Se o caso já tiver observações, o texto do Trello é **acrescentado** com um cabeçalho de origem, nunca sobrescreve.
3. **Comentários → linha do tempo.** Cada comentário do card vira uma nota do caso, preservando **data original** e **autor** (como texto, no padrão que o ETL Mais Médicos já usa para autoria).
4. **Idempotente.** Rodar duas vezes não duplica nada: cada comentário importado é marcado (id do comentário do Trello guardado no registro) e pulado na segunda passada.
5. **Dry-run obrigatório.** O script roda por padrão em `--dry-run`, imprimindo: cards lidos, casados, sem caso, comentários a criar, observações a escrever. Só `--commit` escreve.
6. **Piloto primeiro.** A primeira execução é no tema de **29 casos** indicado pelo Thiago, e o resultado é conferido com ele antes de qualquer outro tema.
7. **Só o que foi pedido.** Não importar checklists, anexos, etiquetas, membros, datas de vencimento ou movimentação entre listas.
8. **Relatório.** Ao fim, arquivo/saída com o que foi feito por caso, para conferência.

---

## Tasks / Subtasks

### T1 — Destravar (@dev + owner)
- [ ] Levantar exatamente quais credenciais/escopos a API do Trello exige e passar a lista ao Thiago. (BLOQUEIO 1)
- [ ] Confirmar o board/lista do piloto e a chave do campo com o ID do card. (BLOQUEIO 2, 3)

### T2 — Cliente da API (@dev)
- [ ] `src/lib/trello/client.ts`: listar cards do board, ler `desc` e `actions?filter=commentCard` (com paginação). Credenciais por env, **fora do git**. (AC-1, AC-3)

### T3 — Script (@dev)
- [ ] `sistema-hv/scripts/import-trello.ts` com `--dry-run` (padrão), `--commit`, `--board`, `--tema`. Relatório final. (AC-5, AC-8)
- [ ] Casamento pelo ID do card; append em Observações; nota por comentário com data/autor originais; marcação de idempotência. (AC-1..AC-4)

### T4 — QA (@qa)
- [ ] Dry-run no piloto: números batem com o Trello. (AC-5, AC-6)
- [ ] Commit no piloto; conferir 3 casos manualmente (observações + comentários com data certa). (AC-2, AC-3)
- [ ] Rodar de novo: nada é duplicado. (AC-4)

---

## Dev Notes

- **Espelhamento contínuo NÃO é o objetivo.** O Thiago foi direto: "eu nem queria colocar para espelhar… é só para ter o histórico, deixar o povo botado aqui, porque senão eles não acostumam." Importação é **uma vez por tema**, não sincronização.
- **Escopo mínimo protege o prazo.** Cada campo a mais do Trello é mais chance de o piloto atrasar. Se aparecer pedido de anexo/etiqueta, vira story nova.
- **Autoria como texto** (o Trello tem usuários que não existem no SHV) — mesmo caminho já usado na importação Mais Médicos.
- **Guardar o id do comentário** do Trello é o que garante o AC-4; sem isso, reexecutar polui o caso.

## Testing

- Piloto de 29 casos, conferência com o Thiago, reexecução.

## Dependências

- **M2** (campo Observações) — já implementado.
- **D1** ajuda (pastas padronizadas), mas não bloqueia.
- **Credenciais do Trello** — bloqueio externo.

## File List

**Novos**
- `sistema-hv/src/lib/trello/client.ts`
- `sistema-hv/scripts/import-trello.ts`

**Alterados**
- `sistema-hv/src/lib/notes-service.ts` (só se precisar aceitar data/autor originais)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial; bloqueada por credenciais | @sm (River) |
