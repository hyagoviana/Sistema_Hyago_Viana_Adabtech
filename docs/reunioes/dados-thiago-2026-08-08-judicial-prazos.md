# Complemento Thiago — 2026-08-08 (áudios + tabela de campos Judicial)

> Fonte: 3 áudios + `Documento sem título.docx` (raiz do projeto). Complementa [`dados-thiago-2026-08-08.md`](./dados-thiago-2026-08-08.md) e o épico [`../stories/reuniao-2026-08-07/`](../stories/reuniao-2026-08-07/README.md).

## Áudios (transcrição resumida)

**Áudio 1 — prazos + espelhamento de desabilitados:**
- **Prazo fatal/previsto** precisam ser **revisados**: como a distribuição não era automática, o prazo lançado no sistema era "meio irrelevante". A equipe vai revisar/ajustar isso **manualmente nos próximos dias** (não dá para só apagar a tarefa — tem que remover/alterar manualmente).
- O sistema (ProJuris) tem **muita coisa DESABILITADA**. Quando um tipo está desabilitado, **não deve aparecer para pontuar** nas tarefas — mas o sistema SHV **precisa manter o registro desses tipos**, só para fins de **espelhamento/andamentos** (a informação aparece, mas não entra na pontuação). → confirma M17/M12.

**Áudio 2 — pendências dele:**
- **Conta Azul:** precisa **fechar algumas ideias antes** (F4/CA seguem em espera).
- **Trello:** vai procurar login/senha admin e manda depois. **Não é urgente** — é só para eu poder olhar/testar (F1).

**Áudio 3 — tabela de campos Judicial:**
- Montou uma tabela dos campos para **espelhar do ProJuris → aba Judicial** do SHV (abaixo).
- Exemplo de processo com marcadores: **PRO.0007684 — 1010579-63.2026.4.01.3702**.

## Notas do docx (fora da tabela)

- **DILIGÊNCIA e BALCÃO:** considerar o tipo [Diligência/Balcão]. Remover um dos dois exige **realterar manualmente** as vinculações de tarefas já existentes antes de remover. Então **[Balcão] permanece no sistema provisoriamente** (~até quarta).
- **Tipos de tarefas ERRADOS:** existem tipos indevidos a corrigir manualmente na semana (ex.: "análise processual" = mesmo que "análise de caso").
- **Tipos DESABILITADOS:** ele vai repassar para corrigir o que for possível (volume grande); alguns podem ter que ficar por consumo de tempo. Nesse caso o SHV deve **ter o registro desses tipos** só para evitar erro no espelhamento na aba de tarefas/judicial.
- **Prazo previsto e prazo fatal** devem ser **espelhados** ProJuris↔sistema, e **já constam nos dados do ProJuris**. → M11.

## Tabela de campos — espelhamento ProJuris ↔ aba Judicial (SHV)

| ITEM | Nome ProJuris | Nome SHV | Observações |
|---|---|---|---|
| Identificador Projuris | Identificador Projuris | Identificador Projuris | Espelhar entre sistemas (**M5 já feito** — coluna `projuris_codigo_processo`) |
| Numeração padrão CNJ | Numeração padrão CNJ | Numeração padrão CNJ | Espelhar (`projuris_numero_processo` já existe) |
| Órgão | Órgão | Órgão | Espelhar |
| Órgão julgador | Órgão julgador | Órgão julgador | Espelhar |
| Classe - CNJ | Classe - CNJ | Classe - CNJ | Espelhar |
| Situação | Situação | Situação | Espelhar |
| Assunto | Assunto | **TEMA (frente)** | Espelhar — mapeia para o TEMA do caso |
| tarefas | tarefas | **tarefas + andamentos** | Ver obs 1 e 2 abaixo |
| andamentos | andamentos | **tarefas + andamentos** | Ver obs 1 e 2 abaixo |
| Monitoramento (Push) | Monitoramento (Push) | Monitoramento (Push) | Espelhar |
| Distribuição | Distribuição | Distribuição | Espelhar |
| Resultado da última decisão | Resultado da última decisão | Resultado da última decisão | Espelhar |
| Tipo da última decisão | Tipo da última decisão | Tipo da última decisão | Espelhar |
| Valor da ação | Valor da ação | **Valor da causa** | Espelhar |
| Honorários Contratuais estimados | Ausente | Honorários Contratuais estimados | **Apenas manter no SHV** (não vem do ProJuris) |
| Honorários Contratuais Provisionados | Ausente | Honorários Contratuais Provisionados | **Apenas manter no SHV** |

**Obs 1 (tarefas/andamentos):** no SHV, lançar em **linha cronológica única** (não em menus separados como no ProJuris).
**Obs 2:** ter um **botão simples** para marcar se aquele andamento/tarefa **também aparece na linha do tempo principal do caso** (menu inicial), não só no menu Judicial.

## Implicações para as stories

- **M5** (identificador ProJuris): ✅ já feito — é a 1ª linha da tabela.
- **Aba Judicial (expansão):** os demais campos (CNJ, órgão, órgão julgador, classe, situação, assunto→tema, monitoramento, distribuição, última decisão, valor da causa) formam uma **nova story de "campos judiciais espelhados"** — depende do **sync ProJuris vivo** (auth/token). Honorários estimados/provisionados são **campos manuais do SHV** (não vêm do ProJuris).
- **tarefas + andamentos na timeline:** linha cronológica única + flag "aparece na linha do tempo principal" — casa com M1 (timeline unificada) e o espelhamento de andamentos do ProJuris.
- **M11** (prazo previsto/fatal): confirmado espelhar ProJuris↔SHV; dado já existe no ProJuris; revisão manual dos prazos será feita pela equipe.
- **M12/M17** (tipos desabilitados): manter **registro** dos tipos desabilitados no SHV (não pontuam, só espelham). Balcão fica provisório (~até quarta).
- **Conta Azul (F4):** em espera — Thiago vai fechar ideias antes.
- **Trello (F1):** login virá depois; não urgente.
