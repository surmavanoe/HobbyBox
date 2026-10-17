-- HOBBYBOX full public schema snapshot
-- Generated from Supabase project smeucssdhwbfoiaethcm.
--
-- USE THIS ONLY WHEN BOOTSTRAPPING A NEW SUPABASE PROJECT.
-- Do NOT run it against the existing project: its objects already exist.
--
-- It creates the media tables, vector search RPC, profiles/library/reviews/
-- friendships, triggers, RLS policies and grants.
-- After running it: deploy supabase/functions/omni-search, set the
-- GEMINI_API_KEY function secret, then run npm run seed and npm run seed:social.

create schema if not exists public;
create extension if not exists vector;
set search_path = public, extensions;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public, extensions', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'handle', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_media"("query_embedding" "vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" "uuid", "title" "text", "format" "text", "synopsis" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  select
    media_items.id,
    media_items.title,
    media_items.format,
    media_items.synopsis,
    1 - (media_embeddings.embedding <=> query_embedding) as similarity
  from media_items
  join media_embeddings on media_items.id = media_embeddings.media_item_id
  where 1 - (media_embeddings.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;


ALTER FUNCTION "public"."match_media"("query_embedding" "vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friend_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'accepted'::"text" NOT NULL,
    CONSTRAINT "friendships_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."library_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_item_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "rating" integer,
    "review" "text",
    "progress" numeric,
    "is_rewatch" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "library_entries_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "library_entries_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'in_progress'::"text", 'completed'::"text", 'dropped'::"text"])))
);


ALTER TABLE "public"."library_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "media_item_id" "uuid",
    "embedding" "vector"(1536)
);


ALTER TABLE "public"."media_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "format" "text" NOT NULL,
    "synopsis" "text",
    "external_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "poster_url" "text",
    "release_year" integer,
    "genres" "text"[],
    "runtime_minutes" integer,
    "episode_count" integer,
    "page_count" integer,
    "issue_count" integer,
    "external_source" "text",
    "external_url" "text",
    "average_rating" numeric(3,1),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."media_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "handle" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_item_id" "uuid",
    "rating" integer,
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_rewatch" boolean DEFAULT false NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "reviews_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'friends'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."library_entries"
    ADD CONSTRAINT "library_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."library_entries"
    ADD CONSTRAINT "library_entries_user_id_media_item_id_key" UNIQUE ("user_id", "media_item_id");



ALTER TABLE ONLY "public"."media_embeddings"
    ADD CONSTRAINT "media_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_items"
    ADD CONSTRAINT "media_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



CREATE INDEX "friendships_friend_status_idx" ON "public"."friendships" USING "btree" ("friend_id", "status");



CREATE UNIQUE INDEX "friendships_pair_idx" ON "public"."friendships" USING "btree" (LEAST("user_id", "friend_id"), GREATEST("user_id", "friend_id"));



CREATE INDEX "friendships_user_status_idx" ON "public"."friendships" USING "btree" ("user_id", "status");



CREATE INDEX "library_entries_media_idx" ON "public"."library_entries" USING "btree" ("media_item_id");



CREATE INDEX "library_entries_status_idx" ON "public"."library_entries" USING "btree" ("user_id", "status");



CREATE INDEX "library_entries_user_idx" ON "public"."library_entries" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "media_items_format_idx" ON "public"."media_items" USING "btree" ("format");



CREATE INDEX "media_items_genres_gin_idx" ON "public"."media_items" USING "gin" ("genres");



CREATE INDEX "media_items_release_year_idx" ON "public"."media_items" USING "btree" ("release_year");



CREATE INDEX "reviews_media_idx" ON "public"."reviews" USING "btree" ("media_item_id", "created_at" DESC);



CREATE INDEX "reviews_user_idx" ON "public"."reviews" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "library_entries_set_updated_at" BEFORE UPDATE ON "public"."library_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."library_entries"
    ADD CONSTRAINT "library_entries_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."library_entries"
    ADD CONSTRAINT "library_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_embeddings"
    ADD CONSTRAINT "media_embeddings_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can browse media catalog" ON "public"."media_items" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friendships_own_read" ON "public"."friendships" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("friend_id" = "auth"."uid"())));



CREATE POLICY "friendships_own_write" ON "public"."friendships" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."library_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "library_entries_own_all" ON "public"."library_entries" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."media_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "media_items_public_read" ON "public"."media_items" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_authenticated_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_self_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_own_write" ON "public"."reviews" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reviews_public_read" ON "public"."reviews" FOR SELECT TO "authenticated", "anon" USING ((("visibility" = 'public'::"text") OR ("user_id" = "auth"."uid"())));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_media"("query_embedding" "vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_media"("query_embedding" "vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_media"("query_embedding" "vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."library_entries" TO "anon";
GRANT ALL ON TABLE "public"."library_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."library_entries" TO "service_role";



GRANT ALL ON TABLE "public"."media_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."media_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."media_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."media_items" TO "anon";
GRANT ALL ON TABLE "public"."media_items" TO "authenticated";
GRANT ALL ON TABLE "public"."media_items" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







