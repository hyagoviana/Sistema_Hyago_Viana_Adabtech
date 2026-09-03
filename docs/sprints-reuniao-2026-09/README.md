# Plano de Sprints — Ajustes da Reunião 02/09/2026

**Owner do plano:** @pm (Morgan) · **Data:** 03/09/2026
**Fonte:** [`docs/reunioes/levantamento-2026-09-02-ajustes-gerais.md`](../reunioes/levantamento-2026-09-02-ajustes-gerais.md)
**Escopo:** os 16 itens do Thiago **menos** a integração Conta Azul/Asaas (decisão do owner).

---

## Visão geral

7 sprints, ordenadas por **dependência técnica** e **retorno imediato para o escritório**.
As duas trilhas externas (SEI e Trello) ficam no fim porque dependem de terceiros
(site do Ministério da Saúde, quadro do Trello, serviço de CAPTCHA) — se atrasarem, não travam o resto.

| Sprint | Tema | Itens do Thiago | Stories | Tamanho | Depende de |
|---|---|---|---|---|---|
| **S1** | Correções que travam o uso hoje | 2, 4, 11 | 5 | M | — |
| **S2** | Configuração de tema + Drive + ProJuris | 1, 3, 5, 6 | 4 | G | S1 |
| **S3** | Cliente: cadastro, ficha e visão 360 | 7, 8 | 4 | G | S2 (campos) |
| **S4** | Caso: menus, financeiro e fim do "status" | 9, 10, 16 | 4 | G | S1, S2 |
| **S5** | Permissões por perfil | 15 | 4 | G | S4 (nível Configurar usado no "Editar caso") |
| **S6** | Controladoria: casos prioritários | 14 | 1 | M | S1 (motor), S4 (etapas) |
| **S7** | Trilhas externas | 12, 13 | 3 | G | tudo acima + insumos do Thiago |

**Total:** 25 stories.

---

## S1 — Correções que travam o uso hoje

> Cinco defeitos confirmados no código, todos com causa raiz já localizada. É a sprint de maior
> retorno por esforço: três deles são a diferença entre o motor de distribuição ser confiável ou não.

| Story | Item | Descrição | Tam. |
|---|---|---|---|
| S1-01 | 2 | PDF finalizado vai para "Documentos automáticos" (+ backfill dos existentes) | P |
| S1-02 | 11a | Motor não distribui em sábado/domingo nem em dia bloqueado no calendário | P |
| S1-03 | 11b | Andamentos duplicados: 1 card agrupado por processo+publicação, 1 tarefa | G |
| S1-04 | 4/11c | Motor lê o responsável exclusivo do CASO (`directed_executor_id`) | M |
| S1-05 | 8-bug | Campo do tema com `scope='cliente'` aparece na página do cliente | M |

**Critério de saída:** motor rodou uma semana sem distribuir em fim de semana; a fila de andamentos de
um dia real mostra 1 card por publicação; um caso com responsável definido recebe a tarefa nele.

---

## S2 — Configuração de tema + Drive + ProJuris

> Elimina a duplicidade de menus de tema e resolve, de uma vez, a bagunça das pastas do Drive e o
> assunto errado no ProJuris — que são o mesmo problema visto de dois ângulos: falta um lugar único
> onde o tema é configurado.

| Story | Item | Descrição | Tam. |
|---|---|---|---|
| S2-01 | 1 | Menu único de configuração de tema (mata o "Editar tema" da Área de Trabalho) | M |
| S2-02 | 5 | Aba **Integrações** do tema: assunto ProJuris ajustável + rótulos "ProJuris"/"Conta Azul" | M |
| S2-03 | 3 | Criar Judicial no ProJuris usa o assunto do TEMA, não o código do caso | M |
| S2-04 | 6 | Pastas de modelos dentro da pasta do tema (dry-run → migração → validação → lixeira) | G |

**Risco alto — S2-04.** O owner foi explícito: *não quebrar a lógica de Casos e Procurações*.
A story tem gate obrigatório: nenhuma pasta é enviada à lixeira antes de a validação provar que
100% dos vínculos apontam para as novas pastas e que a geração de documento funciona nos dois tipos.

---

## S3 — Cliente: cadastro, ficha e visão 360

| Story | Item | Descrição | Tam. |
|---|---|---|---|
| S3-01 | 8 | Cadastro do cliente vira **página** (`/clientes/novo`, `/clientes/:id/editar`) | G |
| S3-02 | 8 | Estado civil como select (default *solteiro*) + renomear "endereço"/"número endereço" | P |
| S3-03 | 7 | Painel de **dados do cliente** na ficha + botão do Drive enxuto | M |
| S3-04 | 7 | Visão 360: casos com valor + etapa espelhada, rastro comercial e financeiro | G |

---

## S4 — Caso: menus, financeiro e fim do "status"

| Story | Item | Descrição | Tam. |
|---|---|---|---|
| S4-01 | 9 | Menu **"Editar caso"** (tema · urgência · responsável), gateado por *Configurar* | G |
| S4-02 | 9 | Rastro financeiro migra para a aba Financeiro; espaço da ficha recebe vinculados/observações | M |
| S4-03 | 10 | Limpeza da aba Financeiro do caso (remove painel morto de cobrança) | P |
| S4-04 | 16 | Status da etapa sai da tela → gatilho do financeiro vira **Workflow** (com migração) | G |

**Atenção — S4-04.** `stage_role='won'` hoje dispara o financeiro **e** o GANHO comercial. A migração
tem que converter cada etapa `won` existente numa regra de workflow equivalente **antes** de a UI mudar,
com rollback pronto. É a story mais delicada do plano depois da S2-04.

---

## S5 — Permissões por perfil

> A matriz do Thiago substitui a lista de papéis atual. Fatiado em quatro para que o de-para dos
> usuários seja um passo revisável, e não um efeito colateral de um deploy.

| Story | Item | Descrição | Tam. |
|---|---|---|---|
| S5-01 | 15 | Modelo: papéis da matriz, módulo **Cliente**, nível **Configurar**, defaults por papel | G |
| S5-02 | 15 | Tela de permissões **por papel** (matriz editável) + override por usuário preservado | G |
| S5-03 | 15 | Unificar Perfil + Nível de acesso (mantendo Cargo) + filtro "ocultar suspensos" | M |
| S5-04 | 15 | De-para dos usuários atuais + aplicação do nível *Configurar* nas telas | M |

---

## S6 — Controladoria: casos prioritários

| Story | Item | Descrição | Tam. |
|---|---|---|---|
| S6-01 | 14 | Página de casos prioritários (1 linha por processo judicial; adm. = última mudança de etapa) | G |

---

## S7 — Trilhas externas (por último)

| Story | Item | Descrição | Tam. |
|---|---|---|---|
| S7-01 | 13 | **Spike**: viabilidade do CAPTCHA do SEI (comparar serviço pago x Playwright puro) | M |
| S7-02 | 13 | Robô SEI: campo nº do processo, tela de configuração e rotina de consulta | G |
| S7-03 | 12 | **Spike + leitura** Trello: casar cards do quadro Cobrança HV pelo `IDCARDTRELLO` | G |

**Bloqueios externos:** link do SEI + processo de exemplo; acesso admin ao quadro do Trello
(e Premium, se a API exigir). Ambos prometidos pelo Thiago.

---

## Sequenciamento recomendado

```
S1 ──► S2 ──┬──► S3
            ├──► S4 ──► S5 ──► S6
            └──────────────────────► S7
```

S3 e S4 podem correr em paralelo depois da S2 (times/frentes diferentes: cliente x caso).
S7 é independente e pode começar assim que os insumos do Thiago chegarem.

---

## Riscos do plano

| Risco | Impacto | Mitigação |
|---|---|---|
| Migração de pastas do Drive apagar o que está em uso (S2-04) | Alto | Dry-run + validação obrigatória antes da lixeira; lixeira é reversível por 30 dias |
| Fim do `stage_role='won'` quebrar a bifurcação financeira (S4-04) | Alto | Migração converte antes de a UI mudar; rollback versionado |
| De-para de papéis tirar acesso de quem trabalha (S5-04) | Médio | Planilha usuário-a-usuário revisada antes de aplicar |
| CAPTCHA do SEI inviável ou caro (S7-01) | Médio | Spike primeiro; se inviável, entrega só o campo + tela e o robô vira épico futuro |
| Thiago mandar a "listinha" prometida no meio da execução | Médio | Entra como backlog da próxima leva; não replaneja sprint em curso |

---

## Fora do plano (registrado)

Conta Azul / Asaas (venda, contrato recorrente, cobrança, conciliação) · Referências como dicionário
de-para nos documentos · vendedor/comissão na venda do Conta Azul.

— Morgan, planejando o futuro 📊
