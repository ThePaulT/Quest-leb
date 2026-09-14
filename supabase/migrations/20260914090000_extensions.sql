-- Extensions.
--
-- PostGIS lives in the `extensions` schema (Supabase's convention) rather than
-- `public`, so the Data API never exposes its ~1000 functions as RPC endpoints.
-- Because of that, every PostGIS type and function in later migrations is
-- schema-qualified: do not rely on `extensions` being on the search_path.

create schema if not exists extensions;

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
