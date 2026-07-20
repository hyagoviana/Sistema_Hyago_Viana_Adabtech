# 📊 Levantamento de Status — Reforma 2026-07 (atualizado 2026-07-20)

> Cruza **(a)** o doc-mestre `reforma-tema-caso-modulos-2026-07-18.md` (baseado nas suas observações + reunião 15/07), **(b)** a transcrição das nossas sessões e **(c)** os pedidos avulsos que você fez durante os testes (fora do arquivo).
> Produção no ar: **www.sistemahyagoviana.com.br** (commit `009a356`, deploy READY). Tudo marcado ✅ está DEPLOYADO.

---

## 1. Resumo executivo

- **Fundação da reforma (B1, B3, B4, B5)**: em grande parte **concluída e no ar**.
- **B2 (TEMA→CASO→TIPO)**: **implementado pela "Opção 1"** (cada TEMA tem um `service_type` interno espelho 1:1) — criação de tema, frentes, pastas, pipeline por tema, `case_code` por tema e o fluxo "Novo tema" estão prontos. Falta só a **fusão/limpeza dos service_types legados** (ESF+DGM etc.) e a **lista definitiva de temas** (depende de você).
- **B6/B7/B8 (Controladoria, Inteligência, Inadimplentes)**: **não iniciados** — bloqueados por API ProIuris/Conta Azul + regras por escrito.
- **Maior pendência que trava valor**: **revisar os modelos Word no Drive** (inserir os `<...>`) — sem isso as variáveis não preenchem (o código já está pronto).

---

## 2. ✅ FEITO — por decisão do doc-mestre (D1–D4)

| # | Decisão | Status | O que foi entregue |
|---|---------|--------|--------------------|
| **D1** | `service_type` → TEMA (fundir ESF+DGM) | 🟡 **Parcial** | TEMA existe como camada (espelho 1:1 de service_type interno); temas criáveis. **Falta** fundir os legados ESF+DGM num só e soft-deletar os órfãos. |
| **D2** | Pipeline op única por tema | ✅ **Feito** | Cada tema tem sua pipeline (motor = service_type interno); Kanban abre pela esteira do tema. |
| **D3** | Permissão por módulo (papel + overrides) | ✅ **Feito** | `permissaoEfetiva`, tabela `system_user_module_perms`, tela de permissões por aba (ver/editar/não ver + "ver valores"), Sidebar e **gates de escrita** respeitando o override. |
| **D4** | Profundidade do documento | ✅ n/a | Fundação detalhada entregue; Controladoria/Inteligência seguem em alto nível. |

---

## 3. ✅ FEITO — por bloco de trabalho

### B1 — Modelo Pessoa / Lead / Cliente por caso ✅
- Lifecycle por caso (LEAD/CLIENTE/PERDIDO); pessoa única em `system_clients`.
- **Modelo 3 estágios** cadastro(lead)→comercial→operacional; Leads = lista, Comercial = Kanban, Clientes = só clientes.
- Ficha ramificada por tema; aba "Casos do cliente" separando efetivados/aguardando/perdidos.
- Documento **combinado** "Contrato e procuração" por caso.

### B3 — Permissões por módulo ✅
- `permissaoEfetiva(papel, overrides, módulo, ação)`; RBAC como fonte única.
- Tela de gestão de usuários + **permissões por aba** (não ver / visualizar / editar) e **chave "ver valores"**.
- Sidebar respeita override; **advogado vê só casos vinculados** (criador/responsável/checklist) em todas as pipelines.
- **Gate de escrita real (view = só leitura, edit = escreve)** no servidor (comercial/operacional/financeiro/sistema) e no front (botões escondidos + drag travado). Base LGPD (`system_consent_records`).

### B4 — Desacoplar Financeiro 🟡 (núcleo feito)
- Gate de **valores ($)** via `podeVerValores`; painel financeiro do cliente só admin/financeiro; módulo `financeiro` restrito por padrão (só admin/financeiro).
- Relatório Financeiro (aba própria); Conta Azul (cobrança + sync cron) e Asaas (parcial).
- **Falta**: espelhamento completo "todos os casos" no painel do cliente e mover 100% do "gerar fatura Conta Azul" para o painel do cliente (cluster Conta Azul ainda parcial).

### B5 — Bugs e ajustes do Hyago
| Item | Status |
|------|--------|
| B1 — busca/lupa não funcionava | ✅ (normaliza acento; busca ampla) |
| B2 — RG 1 dígito a menos | ✅ |
| B4 — erro ao anexar documento | ✅ (upload + magic bytes) |
| B5 — erro ao mover etapa (422) | ✅ (DnD nos Kanbans + fix do 422) |
| A2 — campos FIES estruturados | ✅ (`FiesFields`/canonical) |
| A1 — base graduação/residência | 🟡 (campos profissionais existem; base de dados oficial depende de você) |
| A3 — 15% / R$500 editáveis | 🟡 (`system_case_honorarios` existe; edição no fluxo do termo a finalizar) |
| D1–D4 — variáveis dos documentos | 🟡 **Código pronto** (autofill) — **depende de você revisar os modelos Word** com os `<...>` |

---

## 4. ✅ FEITO — pedidos AVULSOS (fora do doc-mestre, surgidos nos testes)

Estes você pediu direto no chat/durante os testes, não estavam no arquivo:

**Tema / Novo tema (fluxo de criação)**
- Botão/rota renomeados de **"Novo caso" → "Novo tema"** (em lead e cliente).
- Popup enxuto: **removidos** "Situação inicial", "Frente" e "Próximo passo" (situação é derivada do cadastro).
- Após criar, abre a **geração de documentos do tema**: escolher pasta de caso/procuração → documento → variáveis → **Word editável** → **botão "Enviar ao ZapSign"** logo abaixo (vale p/ lead ou cliente).
- Estrutura de pastas no Drive: cada tema cria pasta com subpastas **"Casos"** e **"Procurações"**; excluir tema apaga a pasta; vincular/criar pastas por tema (N:N).
- Editor de tema **limpo**: removida seção "Campos personalizados"; removidos blocos duplicados de "Pasta do tema"; lápis no card abre só o editor.
- "+ Novo tema" no Pipeline; cards do Pipeline = só temas.

**Cadastro / Cliente**
- Chave **"É um cliente"** no cadastro (desligada por padrão) + botão **"Tornar esse lead um cliente"** na ficha.
- Topbar **"+ Novo"** simplificado para abrir só **"Novo cliente"**.
- **Excluir cliente** agora apaga a pasta dele no Drive.
- **Validação de e-mail** no cadastro de lead (DNS/MX + sugestão de typo).

**Busca / Navegação / Visual**
- **Busca global** ampliada: acha temas, páginas/abas, clientes, casos e documentos (com "ramificação").
- Reorganização das abas (5 grupos); abas novas **Relatório Financeiro** e **Permissões**.
- **Excluir categoria/tema** libera o nome (tombstone do slug) com guarda por casos.
- Redesign visual v3 "Apple-grade" (tokens, tipografia, topbar).
- `case_code` com prefixo pelo **nome** do tema (corrigido bug FIES-).

**Operação / manutenção (a seu pedido)**
- **Zerar clientes** do banco para testar do zero + limpeza de **90 pastas órfãs** no Drive.
- Correções de fluxo: procuração revisão+envio direto; filtro de modelos por categoria; checklist reconciliação/multi-responsável; aba Tarefas (agregação + RBAC).

**Infra / Deploy (esta sessão)**
- Diagnóstico e correção do **deploy Vercel**: descoberto que havia **2 projetos** no mesmo repo; a produção real é `sistema-hyago-viana-adabtech` (domínio próprio) e já está no ar com o último commit. Corrigido `rootDirectory` do projeto duplicado via API.

---

## 5. ⏳ FALTANDO (lado do código — dá pra eu fazer)

1. **B2 – fusão dos service_types legados** (D1): unir ESF+DGM num tema só + backfill de `frente_slug` + soft-delete dos service_types órfãos. *(Depende da lista definitiva de temas — item 6.1.)*
2. **B4 – Conta Azul (cluster restante)**: cobrança v2 (venda/link/e-mail/baixa), cron espelhando relatório, excluir parcela com espelho; mover "gerar fatura" 100% para o painel do cliente.
3. **A3 – termo 15%/R$500**: expor a edição desses valores no fluxo do termo (puxando do contrato/honorários).
4. **Gate de escrita — cobertura fina**: checklist (itens) e termo ainda em `requireAuth` no servidor (o front já esconde os botões). Fechar se você quiser 100% à prova de API.
5. **Portal do cliente** (se for do escopo P2): precisa de ADR de auth do cliente.

---

## 6. 🔒 BLOQUEADO / DEPENDE DE VOCÊ (não é código)

**Ações suas no sistema/serviços externos**
- **Revisar os modelos Word no Drive** inserindo os `<...>` nos lugares certos → destrava o preenchimento das variáveis (D1–D4). *(Prioridade nº 1.)*
- **Compartilhar as pastas do Drive** (temas/modelos/procuração) como **Editor** com a Service Account `hv-drive@hv-sistema.iam.gserviceaccount.com`.
- **Cadastrar o webhook do ZapSign** no painel (produção já ativada).
- **Rotacionar os segredos** que vazaram no GitHub (incidente `env`) — obrigatório.
- Definir **MIX/PLA** (regras que ficaram pendentes).
- (Opcional) **Excluir o projeto Vercel duplicado** `sistema-hv` para não confundir deploy.

**Pendências que travam blocos maiores (§9 do doc-mestre)**
1. **Lista definitiva de TEMAS** + frentes/tipos + campos por frente → destrava a fusão B2.
2. **Hierarquia TEMA/CASO/TIPO** confirmada (o desenho/MD que o Dr. Thiago ia mandar).
3. **Regras de distribuição** de tarefas por escrito + **mockup** da Controladoria → destrava B6.
4. **API ProIuris** (credenciais/endpoints) + **Conta Azul** p/ inadimplência → B6/B8.
5. Confirmar **base de dados** de graduação/residência (A1).

---

## 7. 🚫 NÃO INICIADOS (alto nível — dependem do item 6)

- **B6 — Controladoria** (ProIuris, dedup de intimações, distribuição de tarefas com fura-fila, painel de atrasos).
- **B7 — Inteligência** (dashboards com RBAC + IA).
- **B8 — Inadimplentes** (relatório >90 dias + tema de atuação próprio).

---

### Próximo passo sugerido
1. Você **revisa os modelos Word** (`<...>`) e me manda a **lista de temas/frentes**.
2. Eu faço a **fusão B2** (D1) e fecho o **cluster Conta Azul**.
3. Quando vierem ProIuris + regras, atacamos **B6/B8**.

*— Levantamento gerado por Orion, 2026-07-20.*
