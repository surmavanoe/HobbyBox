# Supabase backend

| Path | Contents |
| --- | --- |
| `functions/omni-search/index.ts` | Server-side semantic discovery and supported personal/friend filters. |
| `schema.sql` | Snapshot of the database tables, search functions, policies and grants. |
| `migrations/` | Incremental database migration files. |
| `config.toml` | Configuration identifying the connected Supabase project. |

The project uses the existing shared Supabase backend. The schema snapshot and migrations are not commands to run during frontend setup. Provider keys and service-role credentials remain server-side. The [backend contract](../docs/backend-api.md) describes the API and data model.
