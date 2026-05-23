# Supabase — Sistema HV

Schema, migrations e tipos gerados do banco do Sistema HV.

## Estrutura

```
supabase/
├── config.toml                                      # Config mínima do CLI
├── migrations/
│   ├── 20260523000001_init.sql                      # Schema inicial (MVP-Drive)
│   └── 20260523000001_init.rollback.sql             # Reverte a 0001
└── README.md
```

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

- **Migrations** seguem o padrão `YYYYMMDDHHMMSS_<nome>.sql` exigido pelo CLI.
- Cada migration **DEVE** ter um par `.rollback.sql` (ordem inversa de DROP).
- Tabelas têm soft-delete (`deleted_at TIMESTAMPTZ`) — NUNCA `DELETE` direto em código aplicacional, sempre `UPDATE ... SET deleted_at = NOW()`.
- RLS organization-scoped via função `current_organization_id()` (lê JWT claim `organization_id`, com fallback pra org default no MVP single-tenant).

## RLS — modelo mental

```
JWT vem com claim "organization_id" → current_organization_id() retorna esse valor
JWT sem claim ou role anon            → retorna org default '00000000-...0001'
service_role                          → bypassa RLS (cuidado em código server)
```

## Smoke test

Rode `npm run smoke` para validar end-to-end: conecta ao Supabase + cria/baixa/apaga arquivo no Drive.
