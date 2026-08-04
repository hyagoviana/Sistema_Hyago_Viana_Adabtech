# Épico — Reunião 2026-08-03 (Thiago × Adavio): 8 Ajustes

Origem: transcrição `Impromptu Google Meet Meeting - Aug.txt` + considerações do owner. Stories redigidas pelo @sm (Bob) em 2026-08-03.

## Stories

| ID | Título | Estimativa | Risco | Depende de |
|----|--------|-----------|-------|-----------|
| [A1](A1-campos-somente-na-pipeline.md) | Campo criado só na pipeline (no caso só preenche) | S/M | Baixo | — |
| [A2](A2-ocultar-do-filtro.md) | Toggle "Ocultar do filtro" (`hidden_in_filters`) | S | Baixo | — |
| [A3](A3-multiplos-kanbans-por-tema.md) | Múltiplos Kanbans/boards por tema (mesmo caso, etapas próprias) | L/XL | Alto | — (habilita board SISGIMM da A8) |
| [A4](A4-duplicar-ou-mover-caso-entre-temas.md) | Popup duplicar **ou** mover caso entre temas | M | Médio | — |
| [A5](A5-checkbox-auto-avanco-e-checklist-operacional.md) | Checklist no operacional + corrigir checklist financeiro + checkbox auto-avanço | L | Médio/Alto | A6 (timeline) |
| [A6](A6-timeline-topo-e-eventos-completos.md) | Timeline no topo + registrar toda movimentação | M | Médio | — |
| [A7](A7-campos-estruturados-motor-variaveis.md) | Campos estruturados p/ o motor de variáveis | S/M | Baixo/Médio | A1 |
| [A8](A8-importacao-mais-medicos.md) | Importação (ETL) da base Mais Médicos para produção | XL | Alto | A3 (parcelas SISGIMM completas) |

## Ordem sugerida
A1 → A2 → A7 → A6 → A5 → A3 → A8. A4 é independente. A8 pode importar já (op/Contratos) e as parcelas SISGIMM entram quando A3 estiver pronto.

## Decisões do owner travadas
- **A4:** popup deixa o usuário escolher **duplicar ou mover** (igual ao envio p/ financeiro).
- **A5:** mesmo mecanismo do financeiro (checklist vinculado ao Kanban p/ todos do funil) + checkbox exclusivo do caso; o **checklist do financeiro está inativo — precisa reativar**.
- **A6:** timeline registra notas, documentos, assinaturas, mover card e toda a movimentação.
- **A8 / Importação:** CPF marcador (`CL-XXXX`, preencher depois), Opção A p/ múltiplos vínculos (atual nos campos + histórico guardado), parcelas SISGIMM adiadas p/ A3, usuários como texto, **criar pasta Drive** do caso (processo real), **não** pré-vincular modelo de assinatura, **executar direto em produção** após dry-run.

## Fora do escopo destas 8 (aguardando revisão do Thiago)
- Conta Azul / Asaas (revisão).
- Motor de distribuição ProJuris + agenda interna (precisa do relatório de intimações + executores + usuários).
