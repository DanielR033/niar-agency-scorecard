-- NIAR Agency Readiness Scorecard — Supabase schema
--
-- Security model (CLAUDE.md, non-negotiable): the anon key ships in the
-- GitHub Pages source and is readable by anyone who views it. The design
-- does not hide it — it removes its power. Concretely:
--   * anon may INSERT into `responses` and nothing else on that table.
--   * anon has NO direct grants on `sessions` at all — not even SELECT.
--   * The respondent form learns an agency's name via `get_session_info`,
--     a SECURITY DEFINER function that returns only non-sensitive fields
--     (never facilitator_key).
--   * The facilitator dashboard reads responses only via
--     `get_session_responses`, a SECURITY DEFINER function requiring BOTH
--     the session code and the facilitator key, returning only that
--     session's rows.
--   * Session codes are short and human-typeable; facilitator keys are
--     long and random — see the generation note near the bottom.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists sessions (
  code             text primary key,
  agency_name      text not null,
  facilitator_key  text not null,
  is_rebaseline    boolean not null default false,
  prior_scores     jsonb,            -- 8-key dimension-score map, or null
  prior_assessed_at text,            -- free-text label ("2023"), or null
  created_at       timestamptz not null default now()
);

comment on table sessions is
  'One row per live session. No anon grants at all — read only through get_session_info / get_session_responses.';

create table if not exists responses (
  id            uuid primary key default gen_random_uuid(),
  session_code  text not null references sessions(code),
  role_band     text not null check (role_band in ('leadership', 'technical', 'operational', 'unassigned')),
  answers       jsonb not null,
  submitted_at  timestamptz not null default now()
);

comment on table responses is
  'Anon may INSERT only. The foreign key to sessions is enforced with the table owner''s privileges, not the caller''s, so anon can insert without any grant on sessions.';

create index if not exists responses_session_code_idx on responses (session_code);

create table if not exists progress (
  id            uuid primary key default gen_random_uuid(),
  session_code  text not null references sessions(code),
  client_id     text not null,
  block_id      text not null,
  block_index   int not null,
  block_total   int not null,
  updated_at    timestamptz not null default now()
);

comment on table progress is
  'Best-effort chapter-level heartbeat pings from the respondent form (single-page mobile layout only). Anon may INSERT only, same as responses. Never holds answer content — block id/index only. Read only through get_session_progress.';

create index if not exists progress_session_code_idx on progress (session_code);

-- ---------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------

alter table sessions enable row level security;
alter table responses enable row level security;
alter table progress enable row level security;

-- sessions: no policy for anon at all — RLS with zero matching policies
-- means zero rows, for every operation, for that role. Deliberate: all
-- session reads happen through the two SECURITY DEFINER functions below,
-- which bypass RLS by running as their owner.

-- responses: anon may insert, and read/update/delete nothing.
create policy responses_insert_anon on responses
  for insert
  to anon
  with check (true);

-- progress: same shape as responses — anon may insert, nothing else.
create policy progress_insert_anon on progress
  for insert
  to anon
  with check (true);

-- (No select/update/delete policy for anon is created, so those
-- operations return zero rows / are rejected for that role under RLS.)

revoke all on sessions from anon;
revoke all on responses from anon;
revoke all on progress from anon;
grant insert on responses to anon;
grant insert on progress to anon;

-- ---------------------------------------------------------------------
-- RPCs (SECURITY DEFINER — run as the function owner, bypassing RLS,
-- so they can read tables anon otherwise cannot touch directly)
-- ---------------------------------------------------------------------

-- Public: returns only what the respondent form needs to render A1 and
-- the MTW-style re-baseline framing. Never returns facilitator_key.
create or replace function get_session_info(p_code text)
returns table (
  agency_name       text,
  is_rebaseline     boolean,
  prior_scores      jsonb,
  prior_assessed_at text
)
language sql
security definer
set search_path = public
as $$
  select agency_name, is_rebaseline, prior_scores, prior_assessed_at
  from sessions
  where code = p_code;
$$;

revoke all on function get_session_info(text) from public;
grant execute on function get_session_info(text) to anon;

-- Facilitator-only: requires the session code AND the facilitator key.
-- Wrong key or wrong code returns zero rows — the function does not
-- distinguish "session not found" from "wrong key" in its response, so a
-- caller can't use it to probe which session codes exist.
create or replace function get_session_responses(p_code text, p_key text)
returns setof responses
language sql
security definer
set search_path = public
as $$
  select r.*
  from responses r
  join sessions s on s.code = r.session_code
  where s.code = p_code
    and s.facilitator_key = p_key;
$$;

revoke all on function get_session_responses(text, text) from public;
grant execute on function get_session_responses(text, text) to anon;

-- Facilitator-only, same key requirement as get_session_responses. Returns
-- raw pings (not deduped to latest-per-client) — the dashboard collapses
-- to one row per client_id client-side, same shape as get_session_responses
-- keeps aggregation logic out of SQL. Capped to the last hour so a session
-- left open overnight can't grow the response payload unbounded.
create or replace function get_session_progress(p_code text, p_key text)
returns setof progress
language sql
security definer
set search_path = public
as $$
  select p.*
  from progress p
  join sessions s on s.code = p.session_code
  where s.code = p_code
    and s.facilitator_key = p_key
    and p.updated_at > now() - interval '1 hour';
$$;

revoke all on function get_session_progress(text, text) from public;
grant execute on function get_session_progress(text, text) to anon;

-- ---------------------------------------------------------------------
-- Seeding a session (run manually per agency, not from client code)
-- ---------------------------------------------------------------------
--
-- Session codes: short, human-typeable (e.g. 'MEB2026'). Facilitator
-- keys: long and random — generate with, e.g.:
--   select encode(gen_random_bytes(18), 'base64');
--
-- insert into sessions (code, agency_name, facilitator_key, is_rebaseline, prior_scores, prior_assessed_at)
-- values (
--   'MTW2026',
--   'Ministry of Transport and Works',
--   '<paste a generated facilitator key here>',
--   true,
--   '{"tech_infrastructure":1.5,"interoperability":1.0,"data_management":1.5,"metadata_discoverability":1.0,"security_access":2.0,"operational_processes":1.5,"governance_roles":1.0,"human_capacity":2.0}',
--   '2023'
-- );
