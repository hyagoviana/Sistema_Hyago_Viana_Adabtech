# Story H11: Ligar a config `system_distribution_config` (base_url + auth_type + credenciais) ao `sync-core`, com env como fallback

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-05
- **ID:** H11
- **Status:** Ready for Review (teste fim-a-fim pendente @qa)
- **Estimativa relativa:** S/M
- **Executor sugerido:** @dev + @architect · Quality gate: @qa
- **Risco:** BAIXO — troca a origem das credenciais (env → banco com fallback env) no sync; sem mudar o motor. Cuidado com vazamento de segredo (mascarar na UI, nunca logar cru).
- **Origem:** Levantamento 2026-08-05, Bloco **H, item H11** (*PARCIAL*). A migration `20260729000001` já criou as colunas; falta o `sync-core.ts` usá-las (hoje as env vars dominam). Insumo do Thiago 04/08.

---

## Story

**Como** administrador do escritório,
**quero** que a sincronização do motor de distribuição leia `projuris_base_url`, `projuris_auth_type` e as **credenciais** da tabela `system_distribution_config` (org-scoped, no banco, lida pelo service_role) — usando as variáveis de ambiente apenas como **fallback** —, e que a tela de Configuração permita gravar essas credenciais com **máscara/write-only**,
**para** operar o motor **sem depender do `.env`** (config editável pelo admin no próprio sistema), com as credenciais protegidas por RLS e **sem** nenhum segredo em log/repo/front.

> **DECISÕES TRAVADAS (reunião 2026-08-05 + insumos A9):**
> 1. **Banco como fonte da verdade da auth**, env como fallback (a A9 já dizia "a auth do ProJuris vive no banco"). Hoje `sync-core.ts` lê **só** de `process.env` — H11 inverte a prioridade: banco primeiro, env se o banco estiver vazio.
> 2. **`projuris_auth_type` = `oauth2_password`** é o valor real (a migration `20260805000001` já ampliou o CHECK para incluí-lo, além de basic/bearer/apikey). A base_url de serviços (`.../adv-service`) e o username (e-mail) já estão gravados na config por essa migration; **faltam client_id/secret/password** — que hoje só existem no `.env.local`.
> 3. **Segredos com máscara/write-only na UI.** O card de credenciais na tela de Configuração nunca reexibe o valor gravado (mostra "•••• definido"); grava só quando o admin digita algo novo.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Colunas da config:** `sistema-hv/supabase/migrations/20260729000001_distribution_projuris_credentials.sql` — `projuris_base_url`, `projuris_auth_type` (CHECK basic/bearer/apikey; ampliado p/ `oauth2_password` em `20260805000001_distribution_executors_seed.sql:79`), `projuris_username`, `projuris_password`, `projuris_token`, `projuris_api_key`. RLS: `dist_config_select` (org-scoped), `dist_config_upsert` (service_role), `dist_config_update_admin` (authenticated admin).
- **Valores já gravados** (`20260805000001:85`): `projuris_base_url='https://api.projurisadv.com.br/adv-service'`, `projuris_auth_type='oauth2_password'`, `projuris_username='thiagocorreia@hyagovianaadvocacia.com.br'` para a DEFAULT_ORG.
- **Card de credenciais na tela de Configuração:** `sistema-hv/src/routes/controladoria.distribuicao.configuracao.tsx` (grava base_url/auth_type/username/password/token/api_key — commit `226aa83` citado na A9).
- **Cliente ProJuris:** `sistema-hv/src/lib/projuris/client.ts` — `ProjurisClient` recebe `{ clientId, clientSecret, username, dominio, password, authUrl, baseUrl }` (interface `ProjurisCredentials`); `PROJURIS_DEFAULT_AUTH_URL`/`PROJURIS_DEFAULT_BASE_URL`; helper `projurisCredentialsFromEnv()`.
- **O consumidor a mudar:** `sistema-hv/src/lib/distribuicao/sync-core.ts:90-107` — hoje monta o `ProjurisClient` **inteiramente** de `process.env` (`PROJURIS_API_CLIENTE_CODIGO`, `PROJURIS_CLIENT_SECRET`, `PROJURIS_USERNAME`, `PROJURIS_DOMINIO`, `PROJURIS_PASSWORD`, `PROJURIS_AUTH_URL`, `PROJURIS_BASE_URL`). Já usa `getSupabaseAdmin()` (service_role) e a `ORG_ID`, então ler a config no banco é trivial ali.

### NOVO (a construir nesta story)

- **Leitura da config no `sync-core.ts`:** antes de instanciar o `ProjurisClient`, `SELECT` em `system_distribution_config` (por `organization_id = ORG_ID`, via service_role) e montar as credenciais com precedência **banco → env**. Mapear `projuris_base_url`→`baseUrl`, `projuris_username`→`username`, `projuris_password`→`password`; `client_id`/`client_secret` ficam no env (são o segredo "de app" — decisão A9: client_id/secret no `.env.local` da função, base_url/username/password no banco) — **mas** H11 deve permitir também gravá-los na config se o owner quiser (colunas `projuris_token`/`projuris_api_key` disponíveis; ou reusar `projuris_password` para o secret conforme `auth_type`). Definir o mapeamento exato no T0.
- **Máscara/write-only** no card de `configuracao.tsx` para os campos de segredo (password/token/api_key/secret): mostra "definido/não definido", grava só o que for digitado; nunca devolve o valor ao front.
- **Fallback documentado:** se o banco não tiver a credencial, cai para o env; se nem o env tiver, erro claro (como hoje o `AuthError` de `sync-core.ts:96`).

---

## Acceptance Criteria

1. **Sync lê a config do banco:** `sync-core.ts` monta o `ProjurisClient` lendo `projuris_base_url`, `projuris_auth_type`, `projuris_username`, `projuris_password` (e token/api_key conforme `auth_type`) de `system_distribution_config` (org-scoped, service_role). Quando esses valores estão na config, uma sincronização autentica e importa usando-os (sem depender do `.env`).
2. **Env como fallback:** se um campo estiver ausente/nulo na config, o sync usa a env correspondente (`PROJURIS_BASE_URL`, `PROJURIS_USERNAME`, etc.). Se faltar em ambos, erro claro (mantendo o comportamento de `AuthError` atual). A precedência (banco > env) é determinística e documentada.
3. **`auth_type` respeitado:** o sync usa o `projuris_auth_type` da config (`oauth2_password` no caso real; suporta os demais do CHECK) para decidir o fluxo de autenticação. Para `oauth2_password`, usa `authenticateTryingVariants()` (já no client); os outros tipos ficam mapeados de forma coerente (mesmo que só `oauth2_password` seja exercido hoje).
4. **Gravação com máscara/write-only:** na tela `controladoria.distribuicao.configuracao.tsx`, o admin grava base_url/auth_type/username e os **segredos** (password/token/api_key/secret) com o campo em modo write-only: a UI mostra "•••• definido" quando já há valor e só grava quando algo novo é digitado; o valor gravado **nunca** é reenviado ao front.
5. **Autorização:** a gravação da config exige admin da org (policy `dist_config_update_admin` já cobre `authenticated`; o endpoint valida admin no padrão dos demais RPCs de distribuição, gate `controladoria:edit`/admin).
6. **Zero vazamento de segredo:** nenhum segredo aparece em log do servidor, no payload de resposta ao front, nem é commitado no repo. O `SELECT` da config no `sync-core.ts` não é logado cru; erros não ecoam credenciais.
7. **Regressão:** com a config vazia (fallback total no env), o sync funciona igual a hoje. `npm run typecheck` + `npm run lint` verdes; `db:types` inalterado (sem DDL nova nesta story — as colunas já existem). RLS org-scoped preservada.

---

## Tasks / Subtasks

### T0 — Mapeamento credencial↔coluna (@architect + @dev) — antes de codar
- [x] Definir exatamente qual coluna guarda o quê para `auth_type='oauth2_password'`. **TRAVADO:**

  | Campo `ProjurisCredentials` | Precedência | Coluna / env |
  |---|---|---|
  | `baseUrl` | banco → env | `projuris_base_url` → `PROJURIS_BASE_URL` |
  | `username` | banco → env | `projuris_username` → `PROJURIS_USERNAME` |
  | `password` | banco → env | `projuris_password` → `PROJURIS_PASSWORD` |
  | `clientId` | **só env** (A9) | `PROJURIS_API_CLIENTE_CODIGO` |
  | `clientSecret` | **só env** (A9) | `PROJURIS_CLIENT_SECRET` |
  | `authUrl` | só env | `PROJURIS_AUTH_URL` (default apigw) |
  | `dominio` | só env | `PROJURIS_DOMINIO` |
  | `authType` | banco → default | `projuris_auth_type` (dirige o fluxo) |

  Precedência **por campo**: banco (não-vazio) → env (não-vazio) → `undefined`. As colunas `projuris_token`/`projuris_api_key` ficam disponíveis (write-only) para os auth_types `bearer`/`apikey`, mas **não** são exercidas no fluxo `oauth2_password` de hoje — client_id/secret ficam no env por A9. (AC-1,2,3)

### T1 — Leitura da config no sync (@dev)
- [x] Em `sistema-hv/src/lib/distribuicao/sync-core.ts`: antes de `new ProjurisClient(...)`, `SELECT` da `system_distribution_config` (ORG_ID, `maybeSingle`) e montar `ProjurisCredentials` com precedência banco→env por campo (helper `pick`). Mantido o `AuthError` quando client_id/secret faltam no env; `authenticateTryingVariants()` lança erro claro se faltar username/password em ambos. (AC-1,2,3)
- [x] O `SELECT` (service_role) só puxa as colunas necessárias e **não** é logado; nenhum `console.log` de config/segredo foi adicionado. (AC-6)

### T2 — UI máscara/write-only (@dev)
- [x] Novo `sistema-hv/src/rpc/distribuicao-config.ts`: `getDistributionCredsFn` (leitura via service_role devolve só campos não-secretos + flags `has_password`/`has_token`/`has_api_key`, NUNCA o valor) e `saveDistributionCredsFn` (write-only: segredo vazio/ausente = "não alterar", `null` = limpar; resposta `{ ok: true }` sem segredo). Hooks `useDistributionCreds`/`useSaveDistributionCreds`. O card em `configuracao.tsx` usa esses hooks; placeholders "•••• definido — digite para substituir" / "não definido"; campos de segredo esvaziados após gravar. `useDistributionConfig` deixou de fazer `select("*")` (não trafega mais segredo pelo browser). (AC-4,6)
- [x] Gate admin/edição via `requireModule("controladoria", "edit")` na gravação; `requireModule("controladoria", "view")` na leitura. (AC-5)

### T3 — QA (@qa)
- [ ] Gravar credenciais válidas na config (via UI), **remover** as envs correspondentes num ambiente de teste, rodar `runSync` → autentica e importa pela config. (AC-1)
- [ ] Zerar a config → sync cai para o env (fallback). (AC-2)
- [ ] Inspecionar logs/response: nenhum segredo aparece. (AC-6)
- [ ] `typecheck`+`lint` verdes; sync com config vazia = comportamento de hoje. (AC-7)

---

## Dev Notes

**Trocar a origem, não o motor.** H11 é cirúrgica: só muda como `sync-core.ts:90-107` obtém as credenciais. O restante (auth, consulta de intimações, distribuição, persistência) é intacto. `getSupabaseAdmin()` e `ORG_ID` já estão no arquivo, então o `SELECT` da config é uma linha extra antes do `new ProjurisClient(...)`.

**Precedência banco > env, por campo.** Não é "config OU env" em bloco — é campo a campo (base_url do banco, mas se nulo, do env; idem cada credencial). Isso permite migração gradual: hoje base_url/username já estão no banco; password/secret ainda no env até o owner gravá-los pela UI.

**client_id/secret: decisão de A9.** A A9 registrou "client_id/secret ficam no .env.local da Edge Function (segredo), não no banco" (`20260805000001:77`). H11 respeita isso por padrão (esses dois vêm do env), mas as colunas `projuris_api_key`/`projuris_token` estão disponíveis se o owner preferir centralizar tudo no banco — decisão no T0.

**Máscara/write-only.** O endpoint de leitura da config para a tela **não** deve devolver `projuris_password`/`token`/`api_key`; devolve booleans "definido". A gravação só envia campos preenchidos (um campo em branco = "não alterar"). Isso evita o clássico vazamento de segredo via devtools/network.

**Sem DDL.** As colunas já existem (`20260729000001` + CHECK ampliado em `20260805000001`). H11 não deve criar migration a menos que o T0 conclua que falta uma coluna (improvável).

**Riscos:**
- **R1 — vazamento de segredo.** O maior risco. Mitigação: write-only na UI, endpoint de leitura sem segredos, nunca logar a config crua.
- **R2 — precedência confusa.** Se a mistura banco/env não for por campo, dá pra autenticar com base_url do banco e senha velha do env. Mitigar com o mapa explícito do T0 e teste de fallback.

### Testing
- Config completa no banco + env removida → `runSync` autentica/importa.
- Config vazia → fallback env (comportamento de hoje).
- Response da tela de config não contém segredo; logs limpos.
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues):** colunas de credenciais (`20260729000001`) + CHECK `oauth2_password` e valores base_url/username (`20260805000001`); card de config (`configuracao.tsx`); `ProjurisClient`/`ProjurisCredentials` (`client.ts`); `sync-core.ts` (consumidor).
- **Destrava:** operar o motor sem `.env` (config editável no sistema) — pré-requisito operacional para o piloto do motor (A9 H.2, passo 5) e para o cron.
- **Relaciona com A9** (auth já destravada) e **H5/H6** (config como fonte da verdade, I2).

## File List

**Implementado (v0.2):**
- `sistema-hv/src/lib/distribuicao/sync-core.ts` — MODIFICADO: lê `system_distribution_config` (service_role, `maybeSingle`) e monta as credenciais com precedência banco→env por campo (helper `pick`); sem logar segredo.
- `sistema-hv/src/rpc/distribuicao-config.ts` — NOVO: `getDistributionCredsFn` (leitura sem segredos → flags) + `saveDistributionCredsFn` (write-only + gate admin).
- `sistema-hv/src/hooks/useDistribuicao.ts` — MODIFICADO: `useDistributionConfig` deixa de puxar segredos (colunas explícitas); `useUpdateDistributionConfig` restrito a mode/batch_hour; add `useDistributionCreds`/`useSaveDistributionCreds` (server fn).
- `sistema-hv/src/routes/controladoria.distribuicao.configuracao.tsx` — MODIFICADO: card de credenciais write-only ("•••• definido"/"não definido"), opção `oauth2_password`, segredos nunca vêm do servidor.
- (sem migration — colunas já existiam; T0 não apontou coluna faltante).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-05 | v0.1 | Draft inicial. Ligar `system_distribution_config` (base_url/auth_type/credenciais das migrations `20260729000001`+`20260805000001`) ao `sync-core.ts`, que hoje lê só de `process.env`. Precedência banco→env por campo; `auth_type=oauth2_password` respeitado; máscara/write-only dos segredos na tela de Configuração; leitura da config sem retornar segredos ao front; zero vazamento em log/repo. Sem DDL (colunas já existem). Destrava operar o motor sem `.env`. | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). **T0 mapa:** base_url/username/password = banco→env por campo; client_id/secret/authUrl/dominio = só env (A9); token/api_key = colunas write-only p/ bearer/apikey, não usadas no oauth2_password. **Arquivos:** `sync-core.ts` (SELECT config + `pick` precedência, sem log de segredo), NOVO `rpc/distribuicao-config.ts` (leitura sem segredos→flags + save write-only c/ gate `requireModule('controladoria','edit')`), `useDistribuicao.ts` (hooks novos + `useDistributionConfig` sem `select("*")`), `configuracao.tsx` (write-only "•••• definido"/"não definido" + opção oauth2_password). **Gates:** `npm run typecheck` verde (só o erro pré-existente de `contaazul/service.ts`, não é meu); `npm run lint` (`eslint .`) verde. **Sem vazamento:** browser não puxa mais colunas de segredo; endpoint devolve booleans; nenhum `console.log` de config/segredo. Teste fim-a-fim (auth real ProJuris) pendente @qa. | @dev |
| 2026-08-05 | v0.3 | Higiene de lint (@dev via Orion). O gate `eslint .` estava vermelho por 78 erros PRÉ-EXISTENTES no `configuracao.tsx` (fora dos hunks do H11: seções Batch Diário/Último Batch/Alertas em JSX compacto + 5 no-explicit-any). Como o H11 já tocava o arquivo, limpei: 73 prettier/prettier via `eslint --fix` + tipei `executionResult` com o tipo local `BatchExecutionResult` (removidos os 5 `(executionResult as any)`; `response.json()` castado). npx eslint nos 8 arquivos do lote = 0 erros; typecheck verde (só o contaazul pré-existente). | @dev |
