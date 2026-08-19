-- Run once in the Supabase SQL Editor after schema.sql. Prints each
-- session's code + facilitator key so you can build the QR/dashboard URLs:
--   index.html?s=CODE
--   facilitator.html?s=CODE&k=FACILITATOR_KEY
--
-- Rename/adjust agency names and codes before running if these aren't
-- final — codes must stay short and easy to type on a phone.

do $$
declare
  v_key text;
begin
  -- DEMO — for testing only, not a real agency.
  v_key := encode(gen_random_bytes(18), 'base64');
  insert into sessions (code, agency_name, facilitator_key, is_rebaseline)
  values ('DEMO', 'Demo Agency', v_key, false)
  on conflict (code) do nothing;
  raise notice 'DEMO -> key: %', v_key;

  -- MEB
  v_key := encode(gen_random_bytes(18), 'base64');
  insert into sessions (code, agency_name, facilitator_key, is_rebaseline)
  values ('MEB', 'Ministry of Environment and Beautification', v_key, false)
  on conflict (code) do nothing;
  raise notice 'MEB -> key: %', v_key;

  -- BSS
  v_key := encode(gen_random_bytes(18), 'base64');
  insert into sessions (code, agency_name, facilitator_key, is_rebaseline)
  values ('BSS', 'Barbados Statistical Service', v_key, false)
  on conflict (code) do nothing;
  raise notice 'BSS -> key: %', v_key;

  -- MTW — re-baseline, prior scores from the original Digital Maturity Assessment.
  v_key := encode(gen_random_bytes(18), 'base64');
  insert into sessions (code, agency_name, facilitator_key, is_rebaseline, prior_scores, prior_assessed_at)
  values (
    'MTW',
    'Ministry of Transport and Works',
    v_key,
    true,
    '{"tech_infrastructure":1.5,"interoperability":1.0,"data_management":1.5,"metadata_discoverability":1.0,"security_access":2.0,"operational_processes":1.5,"governance_roles":1.0,"human_capacity":2.0}',
    '2023'
  )
  on conflict (code) do nothing;
  raise notice 'MTW -> key: %', v_key;
end $$;

-- Confirm what's in the table now (facilitator_key included — this
-- result set is only visible to you in the SQL Editor, never to anon).
select code, agency_name, is_rebaseline, facilitator_key from sessions order by code;
