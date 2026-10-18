# Backend data tooling

Scripts for importing the media catalog, generating embeddings and preparing demo social data.

| Path | Contents |
| --- | --- |
| `scripts/seed-data.js` | Catalog import, embedding generation and a read-only schema check. |
| `scripts/seed-demo-social.js` | Demo users, friendships, reviews and library entries. |
| `migrations-reference/` | Reference SQL from earlier backend setup. |
| `.env.example` | Names of server-side environment variables required by the tooling. |

The existing Supabase project is shared. Normal frontend development does not require reseeding or applying SQL. Maintainers can use `npm run seed:check` with their own server-side credentials to check the schema. Never commit populated backend credentials.
