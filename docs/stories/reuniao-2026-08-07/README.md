# Épico — Reunião 2026-08-07 (Thiago × Matheus): Melhorias até segunda + Futuro

Origem: transcrições `Matheus Torquato [0601] Opa, Thiago.txt` + `Dr. Thiago Correia [0000] se tiver.txt` + `docs/reunioes/roteiro-validacao-projuris-thiago.md` (respondido). Anotações-fonte: [`docs/reunioes/reuniao-2026-08-07-melhorias-ate-segunda.md`](../../reunioes/reuniao-2026-08-07-melhorias-ate-segunda.md). Stories pelo @sm (Bob), 2026-08-07.

> Boa parte se apoia no lote **reuniao-2026-08-05** (24 stories já implementadas): ficha com abas Ficha/Financeiro/Judicial (Outlet), motor de distribuição, campos por tema, campos do cliente (B1). Estas stories **refinam** o que já existe.

---

## Trilha 1 — Ficha do caso (front, PODE FAZER JÁ — não depende do Thiago)

| ID | Título | Est. | Risco | Status |
|----|--------|------|-------|--------|
| [M1](M1-timeline-comentarios-unificados.md) | Timeline + comentários num fluxo só (estilo Trello) | L | Médio | Draft¹ |
| [M2](M2-campo-observacoes-caso.md) | Campo "Observações" (texto grande) do caso | S/M | Baixo | Draft |
| [M3](M3-documentos-aba-topo.md) | "Documentos" vira aba no topo (ao lado de Judicial) | M | Baixo | Draft |
| [M4](M4-termo-dentro-financeiro.md) | Termo migra para dentro do Financeiro (+ gate leitura) | M | Médio | Draft |
| [M7](M7-campos-cliente-pagina-lateral.md) | Campos do cliente abrem como página lateral (não pop-up) | S/M | Baixo | Draft |

¹ M1 só aguarda o **print do Trello** como calibração visual — pode começar sem.

## Trilha 2 — Vínculos de identificação (front + 1 migration)

| ID | Título | Est. | Risco | Status |
|----|--------|------|-------|--------|
| [M5](M5-campo-identificador-projuris-judicial.md) | Campo do identificador ProJuris no Judicial (coluna já existe da G1) | S/M | Baixo | Draft |
| [M6](M6-campo-fatura-contaazul-financeiro.md) | Nº da fatura Conta Azul por parcela (Financeiro) | M | Baixo | Draft |

## Trilha 3 — Cadastro / Motor de distribuição

| ID | Título | Est. | Risco | Status |
|----|--------|------|-------|--------|
| [M8](M8-nivel-colaborador-participa-distribuicao.md) | Nível (Estagiário/Júnior/Sênior) + participa; igualar convite=editar | M | Médio | Draft |
| [M9](M9-peso-ajustavel-executor.md) | Peso 100 padrão + reduzir/aumentar (motor usa peso atual) | S/M | Baixo | Draft |
| [M10](M10-manifestacao-por-prazo.md) | Manifestação 5/10/15 — uma lógica por prazo | S/M | Baixo | 🔒 dados² |
| [M11](M11-prazo-previsto-fatal-projuris.md) | Prazo previsto/fatal puxado do ProJuris (+ interno) | M | Baixo | Draft |
| [M13](M13-complexidade-marcador-urgente.md) | Complexo/coletivo de marcador + urgente + recebe-complexidade (4 pessoas) | M | Médio | Draft ⚠️ |
| [M14](M14-excecoes-responsavel-exclusivo.md) | Exceções (3 já semeadas; falta Sustentação Oral→Thiago) | S | Baixo | Draft |
| [M16](M16-times-equipes-writeback.md) | Times/Equipes — distribui p/ sênior, write-back inclui o time | M/L | Médio | Draft |
| [M17](M17-usuarios-arquivados-registro.md) | Usuários arquivados = registro sem acesso (p/ espelho de tarefas) | M | Baixo | Draft |

⚠️ M13 tem interpretação a confirmar (Bruno=Maxwel / Hudson=Wdyson).

² M10 precisa dos 3 códigos ProJuris da Manifestação (depois que o Thiago apagar duplicados).

## 🔒 Bloqueadas — aguardando insumo do Thiago (prontas para executar quando chegar)

| ID | Título | Falta chegar |
|----|--------|--------------|
| [M12](M12-14-tipos-pontuacao.md) | 14 tipos sem pontuação (seed placeholder + tela) | Lista de quais ficam/saem + a pontuação de cada |

> **M15 (importar colaboradores) foi DESBLOQUEADA** — a planilha chegou preenchida em 2026-08-08 (`docs/reunioes/Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx`). Status **Ready**. Restam só: telefones + confirmar Bruno/Hudson. Ver [`docs/reunioes/dados-thiago-2026-08-08.md`](../../reunioes/dados-thiago-2026-08-08.md).

## Trilha 4 — Futuro (pós-segunda, Backlog)

| ID | Título | Est. | Depende |
|----|--------|------|---------|
| [F1](F1-trello-api-importar-comentarios.md) | Trello via API — importar comentários (histórico) | L/XL | login/senha admin Trello |
| [F2](F2-importacao-temas-script.md) | Importação dos demais temas (contrato JSON) | L | dados organizados do Thiago |
| [F3](F3-campos-formula.md) | Campos com fórmula (estilo Excel) | XL | — (adiado) |
| [F4](F4-integracao-contaazul-projuris-campos.md) | Integração Conta Azul + ProJuris (campos) | L | M5/M6 + modelagem CA |
| [F5](F5-criar-tipo-sistema-para-projuris.md) | Criar tipo no sistema → espelha no ProJuris (v2) | M/L | spike endpoint de escrita |
| [F6](F6-permissao-por-cargo-perfil.md) | Permissão/visualização por CARGO/Perfil (não só por pessoa) | L | M8 + spike design |

---

## Ordem sugerida (fim de semana → segunda)
**Front primeiro (independe do Thiago):** M2 → M3 → M4 → M7 → M5 → M6 → M1 (M1 por último ou quando chegar o print). ⚠️ M3 e M4 ambos editam a nav de `casos.$id.tsx` — coordenar (fazer sequencial).
**Motor (conforme os dados chegarem):** M8 → M9 → M11 → M13 → M14 → M10 (dados) → M12 (dados) → M15 (planilha).
**Futuro:** F1–F5 só depois de segunda.

## Achados dos @devs registrados (revisar no kickoff)
- **M4:** as *leituras* do termo (`casos.$id.termo.tsx` / `rpc/termo.ts handle`) hoje são só `requireAuth` — endurecer para `financeiro:view` (senão vaza honorários por URL direta).
- **M5:** encolheu — a coluna já existe (G1 `20260806000006`); falta só a UI. Dúvida: `PRO.0007713` mapeia para `projuris_codigo_processo` ou `projuris_numero_processo`? (spike com Thiago).
- **M8:** o bloco "Distribuição (ProJuris)" só existe no *editar* usuário; `InviteUserDialog.tsx` não tem ID/nível/participa (confirma a observação do Matheus). `system_users` **não tem** coluna `nivel` → migration.
- **M9:** peso no banco é `weight DEFAULT 1.0` (não 100); o motor usa a razão `weight/Σweight`; fila COMPLEX ignora peso. Decidir escala (100 vs 1.0) no T0.
- **M13:** `sync-core.ts` hoje monta `collective/complexity/temporal` fixos em 0/false — este é o buraco real; o `scoring.ts` já consome os 3 sinais.
- **M14:** 3 exceções já semeadas em `20260805000002` (via `exclusive_executor_id` em tipo/tema, honradas pelo `flow-selector`); falta só **Sustentação Oral→Thiago**. A rota `distribuicao/excecoes` é triagem de bloqueio (não é a config de exclusividade).
- **M15:** módulo **'judicial'** pode não estar no CHECK de `system_user_module_perms.module` — conferir.
