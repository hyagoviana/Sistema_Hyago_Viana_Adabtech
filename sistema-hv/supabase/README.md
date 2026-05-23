# Supabase — Sistema HV

Schema, migrations e tipos gerados do banco do Sistema HV.

## Estrutura

```
supabase/
├── config.toml                                      # Config mínima do CLI
├── migrations/
│   ├── 00000000000001_legacy.sql … 12_legacy.sql    # Placeholders das migrations antigas do projeto Supabase
│   └── 20260523000001_init.sql                      # Schema inicial (MVP-Drive)
├── rollbacks/
│   └── 20260523000001_init.rollback.sql             # Reverte a 0001 (rodar manualmente no Studio)
└── README.md
```

**Por que existem placeholders `00000000000001_legacy.sql` … `12_legacy.sql`?**
O projeto Supabase tinha 12 migrations aplicadas antes deste sistema (de stacks anteriores). Como o CLI exige arquivo físico pra cada entrada no histórico remoto, criamos placeholders vazios. **Não rode `db push` esperando que façam algo** — elas já foram aplicadas e estão marcadas como `applied` no histórico.

**Por que rollbacks ficam em pasta separada?**
O CLI faz glob `migrations/<timestamp>_*.sql` e tentaria aplicar o rollback como uma migration nova. Manter rollbacks fora desse glob evita esse bug.

## Comandos úteis

```bash
# Aplicar migrations no projeto remoto (precisa SUPABASE_DB_PASSWORD no .env.local)
npm run db:push

# Gerar tipos TypeScript a partir do schema remoto
npm run db:types

# Rollback manual (Studio web ou psql) — não há comando CLI dedicado
# Cole o conteúdo de migrations/*.rollback.sql no SQL Editor.
```

## Convenções

- **Prefixo `system_`** em **todas** as tabelas, views, funções, triggers e policies criadas por este sistema. Distingue do que já existia no projeto Supabase (tabelas de outras stacks/experimentos).
  - Ex: `system_clients`, `system_clients_active`, `system_current_organization_id()`, `trg_system_clients_updated_at`.
- **Migrations** seguem o padrão `YYYYMMDDHHMMSS_<nome>.sql` exigido pelo CLI.
- Cada migration **DEVE** ter um par `.rollback.sql` (ordem inversa de DROP).
- Tabelas têm soft-delete (`deleted_at TIMESTAMPTZ`) — NUNCA `DELETE` direto em código aplicacional, sempre `UPDATE ... SET deleted_at = NOW()`.
- RLS organization-scoped via função `system_current_organization_id()` (lê JWT claim `organization_id`, com fallback pra org default no MVP single-tenant).

## RLS — modelo mental

```
JWT vem com claim "organization_id" → current_organization_id() retorna esse valor
JWT sem claim ou role anon            → retorna org default '00000000-...0001'
service_role                          → bypassa RLS (cuidado em código server)
```

## Smoke test

Rode `npm run smoke` para validar end-to-end: conecta ao Supabase + cria/baixa/apaga arquivo no Drive.
