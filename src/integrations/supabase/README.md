# Supabase integration files

| File | Contents |
| --- | --- |
| `client.ts` | Generated Supabase client configured with the web environment variables. |
| `types.ts` | Generated TypeScript types for the database schema. |
| `previewAuthStorage.ts` | Authentication storage used by the Lovable web preview. |

These files belong to the generated web integration. The active Expo application accesses the backend through `expo/lib/mediaService.ts`. Generated files should be maintained through their generating workflow.
