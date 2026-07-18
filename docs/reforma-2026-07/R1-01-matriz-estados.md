# R1-01 — Matriz de estados do lifecycle (POR CASO)

> Decisão travada (E1 / doc-mestre §3.4): o estado de vida vive no **CASO**
> (`system_cases.lifecycle ∈ {LEAD, CLIENTE, PERDIDO}`). A **pessoa**
> (`system_clients`) NÃO tem coluna de lifecycle — o status dela é **derivado**
> por caso, via as views `system_clients_leads / _clientes / _perdidos`.
> Uma mesma pessoa pode ser LEAD num caso e CLIENTE em outro simultaneamente.

## Estados

| Estado | Significado | Onde aparece |
|--------|-------------|--------------|
| **LEAD** | Caso sem contrato assinado (pode ter procuração assinada = comercial GANHO). | Pipeline comercial / view `system_clients_leads` |
| **CLIENTE** | Caso com contrato assinado ⇒ entra em operação/financeiro. | Pipeline operacional/financeiro / view `system_clients_clientes` |
| **PERDIDO** | Caso encerrado sem conversão (ou revertido pós-assinatura). | Aba Perdidos / view `system_clients_perdidos` |

## Matriz estado × gatilho

Linha = estado atual do caso · Coluna = gatilho · Célula = estado resultante + coluna(s)/flag(s) carimbadas no MESMO patch.

| Estado atual ↓ / Gatilho → | Criar caso | Procuração assinada (`registrarProcuracaoAssinada`) | Contrato assinado (`promoverCasoOperacional` / `promoverCasoManual`) | Perder (`marcarCasoPerdido`) | Reverter (indireto) |
|---|---|---|---|---|---|
| **(inexistente)** | → **LEAD** (`lifecycle='LEAD'` default; nasce na 1ª etapa comercial/op) | — | — | — | — |
| **LEAD** | — | **LEAD** (segue lead) · `procuracao_assinada_at`, limpa `aguardando_assinatura_at`, `macrostatus_comercial='GANHO'`. **NÃO** toca `lifecycle` nem `assinatura_liberada_at`. | → **CLIENTE** · `lifecycle='CLIENTE'` + `assinatura_liberada_at` (+ `_by`) no mesmo patch, `macrostatus_comercial='GANHO'`, cai na 1ª etapa op se `macrostatus_op` NULL. | → **PERDIDO** · `perdido_at`, `perdido_motivo`, `macrostatus_comercial='PERDIDO'`. | — |
| **CLIENTE** | — | no-op (procuração não regride nem re-promove) | no-op idempotente (já CLIENTE) | → **PERDIDO** (reversão S1-01b) · `perdido_at`, `perdido_motivo`, `macrostatus_comercial='PERDIDO'`. `assinatura_liberada_at` **permanece** (histórico; CHECK permite PERDIDO). | — |
| **PERDIDO** | — | (não previsto) | (não previsto) | no-op idempotente (já PERDIDO) | Reversão PERDIDO→LEAD/CLIENTE é feita fora deste conjunto de RPCs (não há gatilho automático nesta story). |

## Invariantes de banco (CHECKs — NÃO remover)

| CHECK | Regra | Verificado |
|-------|-------|-----------|
| `system_cases_lifecycle_domain_chk` | `lifecycle ∈ {LEAD, CLIENTE, PERDIDO}` | Presente · 0 violações |
| `system_cases_assinatura_lifecycle_chk` | `assinatura_liberada_at NOT NULL ⇒ lifecycle <> 'LEAD'` | Presente · 0 violações |
| `system_cases_perdido_lifecycle_chk` | `perdido_at NOT NULL ⇒ lifecycle = 'PERDIDO'` | Presente · 0 violações |

## Notas-chave

- **Procuração ≠ promoção.** Procuração assinada é evento **comercial** (GANHO) e o
  caso **segue LEAD**. Só o **contrato** promove a CLIENTE. Isso sustenta 1 pessoa → N casos.
- **Contrato ⇒ CLIENTE + `assinatura_liberada_at` no MESMO patch** (o CHECK exige
  `NOT LEAD` sempre que `assinatura_liberada_at` estiver setado).
- **Escrita de lifecycle é RPC-only**, centralizada em `src/lib/cases-service.ts`.
- **Status da pessoa é derivado.** As views fazem `JOIN` agregado por `client_id`
  (`GROUP BY`), então cada aba lista **pessoas distintas** — sem duplicar linha
  quando a pessoa tem vários casos no mesmo lifecycle.
