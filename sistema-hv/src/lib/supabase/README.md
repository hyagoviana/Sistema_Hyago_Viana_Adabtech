# Supabase clients

Dois clientes — escolha pelo contexto:

| Arquivo | Uso | Chave | RLS |
|---|---|---|---|
| `browser.ts` | Código React no navegador | `VITE_SUPABASE_ANON_KEY` | Respeitada |
| `server.ts` | Server functions, scripts, jobs | `SUPABASE_SERVICE_ROLE_KEY` | **Bypassa** |

⚠️ **Nunca** importe `server.ts` em arquivos que rodam no browser — `SUPABASE_SERVICE_ROLE_KEY` é segredo absoluto.

## Tipos

`types.ts` está como placeholder. Após aplicar a migration no projeto remoto, regere com:

```bash
npm run db:types
```

(precisa `SUPABASE_ACCESS_TOKEN` no env ou login interativo `npx supabase login`).
