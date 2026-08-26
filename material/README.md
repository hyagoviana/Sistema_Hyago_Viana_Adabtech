# material/ — insumos do cliente (reuniões, documentos, planilhas, design, integrações)

Tudo que chega **de fora** do código (transcrição de reunião, documento do Thiago,
planilha, print, JSON de integração) mora aqui. O que é **produzido por nós**
(stories, PRDs, ADRs, arquitetura) continua em `docs/`.

Os arquivos foram só **movidos e renomeados** (prefixo de data ISO + assunto);
nenhum conteúdo foi alterado. O nome original de cada um está nas tabelas abaixo.

| Pasta | O que guarda |
|---|---|
| `reunioes/` | transcrições das reuniões (Fathom / Meet), 1 arquivo por reunião |
| `documentos/` | documentos de especificação recebidos (Thiago, Iago, owner) |
| `documentos/projeto-inicial/` | os docs de concepção do projeto (FIES, COVID, ESF/DGM, financeiro) |
| `documentos/modelos-termo/` | modelos de Termo de Acerto usados como referência |
| `planilhas/` | bases e planilhas de apoio (.xlsx) |
| `design/` | referências visuais, marca e a repaginada v3 |
| `integracoes/` | material bruto de integrações (n8n, ProJuris, SajAdv) |
| `privado/` | credenciais — **fora do git** (`.gitignore`) |

---

## reunioes/

| Arquivo | Nome original | Assunto |
|---|---|---|
| `2026-06-05_reuniao-adabtech-hyago-viana.txt` | Reunião Adabtech - hyago viana.txt | Estrutura de pastas no Drive, virada arquitetural |
| `2026-07-15_impromptu-meet.txt` | Transcrição sistema hyago.txt | Mapeamento geral do sistema |
| `2026-07-20_alinhamento-sistema-hyago.txt` | Transcriação alinhamento sistema hyago.txt | Alinhamento |
| `2026-07-22_ajustes-sistema-hyago.txt` | ajuste sistema hyago.txt | Filtros por tema (R2-09) |
| `2026-07-29_alinhamento-hyago.txt` | Alinhamento HYAGO - July 29.txt | Alinhamento |
| `2026-08-03_impromptu-meet.txt` | Impromptu Google Meet Meeting - Aug.txt | 8 ajustes + importação Mais Médicos |
| `2026-08-05_impromptu-meet.txt` | Impromptu Google Meet Meeting - Augddd.txt | Melhorias, módulos, gaps ProJuris |
| `2026-08-06_adavio-ajustes-finais.txt` | Adavio Tittoni [0000] É, estamos no.txt | Ajustes finais |
| `2026-08-07_thiago-formulas-e-campos.txt` | Dr. Thiago Correia [0000] se tiver.txt | Campos com fórmula |
| `2026-08-07_matheus-thiago-melhorias.txt` | Matheus Torquato [0601] Opa, Thiago.txt | M1–M14 até segunda |
| `2026-08-10_impromptu-meet.txt` | 15646546Impromptu Google Meet Meeting - Aug.txt | 8 ajustes (kanban, sigilo, importação) |
| `2026-08-19_alinhamento-sistema-hyago.txt` | Reuniao de alinhamento sistema hyag.txt | Reforma da controladoria |
| `2026-08-26_controladoria-financeiro-e-ajustes.txt` | Matheus Torquato [0557] Opa, Thiagã.txt | **Motor validado + 13 ajustes + financeiro** |

## documentos/

| Arquivo | Nome original | Assunto |
|---|---|---|
| `2026-07-06_alinhamento-reuniao.pdf` | Alinahemtno reunbiao hyago.pdf | Alinhamento |
| `2026-07-12_observacoes-sistema-iago.docx` | observações Sistema 120726.docx | Bugs/observações do uso real |
| `2026-08-04_mapeamento-shv-x-projuris.docx` | PROJURIS PARA SISTEMA HVA.docx | De-para SHV ↔ ProJuris |
| `2026-08-08_tipos-de-tarefa-ajustes.docx` | Documento sem título.docx | Diligência/Balcão, tipos errados |
| `2026-08-10_ajustes-motor-distribuicao.md` | ajustes_motor_distribuicao_claude.md | Ajustes do motor |
| `2026-08-11_sistema-mais-medicos.pdf` | Sistema MM.pdf | Base Mais Médicos |
| `2026-08-17_melhorias-gerais.docx` / `.pdf` | Documento sem título (1).docx / .pdf | As 20 melhorias gerais |
| `2026-08-21_controladoria-e-motor.docx` | 21.08 _ Controladoria.docx | Tipo de tarefa/tema como entidade; 2 telas humanas do motor |
| `2026-08-25_financeiro-shv.docx` | 25.08 _ Financeiro SHV.docx | **Financeiro do caso + integração ContaAzul** |
| `2026-08-25_registros-contaazul.docx` | 25.08 - Registros CONTAAZUL.docx | **Passo a passo de registro no ContaAzul** |

## planilhas/

| Arquivo | Nome original | Uso |
|---|---|---|
| `cadastro-colaboradores-sistema-hv.xlsx` | Cadastro-Colaboradores-Sistema-HV (1).xlsx | Cadastro dos colaboradores |
| `MM_BASE_SISTEMA_BETA_v1.xlsx` | (mesmo) | Fonte do ETL Mais Médicos (`sistema-hv/scripts/import-mais-medicos.py`) |
| `regras-pontuacao-dificuldade-operacional.xlsx` | regras pontuação dificuldade operacional (3).xlsx | Pontuação do motor de distribuição |

## integracoes/

- `n8n/` — fluxos exportados (`fluxo-LIVE.json` fica **fora do git**: tem credencial).
- `projuris/application.wadl` — 978 recursos da API; gera `sistema-hv/docs/referencia-api-projuris.md`
  via `sistema-hv/scripts/gerar-referencia-api-projuris.mjs`.
- `sajadv/` — documentação HTML da API SajAdv (páginas salvas + `_files`).

## privado/

`env` — credenciais. **Não versionado** (`.gitignore`). Ver o incidente de
vazamento de 2026-07-06: as chaves precisam ser rotacionadas.
