# Stories — Ajustes da Reunião 02/09/2026

Plano de sprints: [`docs/sprints-reuniao-2026-09/README.md`](../../sprints-reuniao-2026-09/README.md)
Levantamento: [`docs/reunioes/levantamento-2026-09-02-ajustes-gerais.md`](../../reunioes/levantamento-2026-09-02-ajustes-gerais.md)

**Escopo:** os 16 itens do Thiago, **menos** a integração Conta Azul/Asaas.

| Story | Item | Título | Tam. | Status |
|---|---|---|---|---|
| **S1 — Correções que travam o uso hoje** ||||
| [S1-01](S1-01-pdf-na-pasta-documentos-automaticos.md) | 2 | PDF finalizado na pasta "Documentos automáticos" | P | **Ready for Review** |
| [S1-02](S1-02-motor-nao-distribui-fim-de-semana.md) | 11a | Motor não distribui em fim de semana | P | **Ready for Review** |
| [S1-03](S1-03-andamentos-duplicados-card-agrupado.md) | 11b | Andamentos duplicados → card agrupado | G | Draft |
| [S1-04](S1-04-motor-le-responsavel-exclusivo-do-caso.md) | 4 | Motor lê o responsável exclusivo do caso | M | Draft |
| [S1-05](S1-05-campo-do-tema-scope-cliente-aparece-no-cliente.md) | 8 | Campo "do cliente" aparece na página do cliente | M | **Ready for Review** |
| **S2 — Configuração de tema + Drive + ProJuris** ||||
| [S2-01](S2-01-menu-unico-configuracao-de-tema.md) | 1 | Menu único de configuração de tema | M | **Ready for Review** |
| [S2-02](S2-02-aba-integracoes-do-tema-assunto-projuris.md) | 5 | Aba Integrações — assunto ProJuris ajustável | M | Draft |
| [S2-03](S2-03-criar-judicial-usa-assunto-do-tema.md) | 3 | Criar Judicial usa o assunto do tema | M | Draft |
| [S2-04](S2-04-pastas-de-modelos-dentro-do-tema.md) | 6 | Modelos dentro da pasta do tema (risco alto) | G | Draft |
| **S3 — Cliente** ||||
| [S3-01](S3-01-cadastro-do-cliente-vira-pagina.md) | 8 | Cadastro do cliente vira página | G | **Ready for Review** |
| [S3-02](S3-02-estado-civil-select-e-renomear-endereco.md) | 8 | Estado civil em lista + renomear endereço | P | Draft |
| [S3-03](S3-03-painel-de-dados-do-cliente-na-ficha.md) | 7 | Painel de dados do cliente + Drive como botão | M | **Ready for Review** |
| [S3-04](S3-04-visao-360-do-cliente.md) | 7 | Visão 360 do cliente | G | Draft |
| **S4 — Caso** ||||
| [S4-01](S4-01-menu-editar-caso.md) | 9 | Menu "Editar caso" (tema/urgência/responsável) | G | Draft |
| [S4-02](S4-02-rastro-financeiro-migra-para-aba-financeiro.md) | 9 | Rastro financeiro vai para a aba Financeiro | M | **Ready for Review** |
| [S4-03](S4-03-limpeza-aba-financeiro-do-caso.md) | 10 | Limpeza da aba Financeiro do caso | P | **Ready for Review** |
| [S4-04](S4-04-status-da-etapa-vira-workflow.md) | 16 | Status da etapa vira workflow (risco alto) | G | Draft |
| **S5 — Permissões** ||||
| [S5-01](S5-01-modelo-de-permissoes-papeis-modulo-cliente-nivel-configurar.md) | 15 | Papéis da matriz, módulo Cliente, nível Configurar | G | **Ready for Review** |
| [S5-02](S5-02-tela-de-permissoes-por-papel.md) | 15 | Tela de permissões por papel | G | **Ready for Review** |
| [S5-03](S5-03-unificar-perfil-e-nivel-de-acesso.md) | 15 | Unificar Perfil + Nível de acesso; ocultar suspensos | M | **Ready for Review** |
| [S5-04](S5-04-de-para-dos-usuarios-e-gate-configurar.md) | 15 | De-para dos usuários + aplicar Configurar | M | Draft |
| **S6 — Controladoria** ||||
| [S6-01](S6-01-pagina-casos-prioritarios.md) | 14 | Página de casos prioritários | G | **Ready for Review** |
| **S7 — Trilhas externas** ||||
| [S7-01](S7-01-spike-captcha-sei.md) | 13 | Spike: CAPTCHA do SEI | M | Bloqueada |
| [S7-02](S7-02-robo-sei-campo-tela-e-rotina.md) | 13 | Robô SEI: campo, tela e rotina | G | Draft |
| [S7-03](S7-03-integracao-trello-leitura.md) | 12 | Trello: spike + leitura | G | Bloqueada |

**Stories de risco alto** (exigem gate de QA antes do passo irreversível): **S2-04** (lixeira do Drive) e
**S4-04** (fim do `stage_role`).

**Bloqueios externos:** link do SEI + processo de exemplo · acesso admin ao quadro Cobrança HV.

---

## Andamento (03/09/2026)

Implementadas enquanto as perguntas ao Thiago não voltam — as quatro que não dependiam de resposta:
**S1-01**, **S1-02**, **S1-05** (código; backfill retido por 1 decisão) e **S4-03**.
`npx tsc --noEmit`, `eslint` dos arquivos tocados e `npm run test:motor` verdes. Nada commitado ainda.
