begin;

-- Internal audit metadata; SourceRecord / qualification contracts are unchanged.
alter table public.source_runs add column record_observations jsonb
  check (record_observations is null or (
    jsonb_typeof(record_observations) = 'object'
    and record_observations ?& array['present','closed']
    and jsonb_typeof(record_observations->'present') = 'array'
    and jsonb_typeof(record_observations->'closed') = 'array'
  ));
comment on column public.source_runs.record_observations is
  'Source-neutral source_job_id lists: present and explicit upstream closed. NULL means no snapshot. full_list=true requires complete coverage of the entire source key across programs. Never backfill absence from current last_seen_at.';

alter table public.jobs add column canonicalization_trace jsonb not null default '{}'
  check (jsonb_typeof(canonicalization_trace) = 'object');

-- One snapshot avoids REST pagination truncation and mixed table revisions.
create function public.canonicalization_snapshot() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare data jsonb;
begin
  if (select count(*) from public.source_records) > 1000
     or (select count(*) from public.source_runs) > 10000 then
    raise exception 'Canonicalization snapshot exceeds M0 bounded runner budget';
  end if;
  select jsonb_build_object(
    'records', coalesce((select jsonb_agg(to_jsonb(r) order by id) from public.source_records r), '[]'::jsonb),
    'runs', coalesce((select jsonb_agg(to_jsonb(r) order by id) from public.source_runs r), '[]'::jsonb),
    'jobs', coalesce((select jsonb_agg(to_jsonb(j) order by id) from public.jobs j), '[]'::jsonb)
  ) into data;
  return data || jsonb_build_object('token', md5(data::text));
end;
$$;

-- A single transaction handles merges/splits without half-written job groups.
create function public.apply_canonicalization(expected_token text, planned_jobs jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; linked uuid[]; result jsonb;
begin
  lock table public.source_records, public.source_runs, public.jobs in share row exclusive mode;
  snapshot := public.canonicalization_snapshot();
  if expected_token is null or snapshot->>'token' <> expected_token then
    raise exception 'Stale canonicalization snapshot; read and plan again';
  end if;
  if jsonb_typeof(planned_jobs) is distinct from 'array' then
    raise exception 'Canonicalization plan must be an array';
  end if;
  -- Task 4 must never erase any later gate-extraction work.
  if exists (select 1 from public.jobs where gates <> '[]'::jsonb or extraction_version is not null
      or extracted_at is not null or extractor_type is not null)
     or exists (select 1 from jsonb_populate_recordset(null::public.jobs, planned_jobs) j
       where gates is distinct from '[]'::jsonb or extraction_version is not null or extracted_at is not null
         or extractor_type is not null or coalesce(cardinality(source_record_ids),0) = 0
         or canonicalization_trace->>'version' is distinct from 'deterministic-v1') then
    raise exception 'Invalid Task 4 job plan or existing extraction metadata';
  end if;
  select array_agg(sid) into linked
    from jsonb_populate_recordset(null::public.jobs, planned_jobs) j cross join unnest(j.source_record_ids) sid;
  if coalesce(cardinality(linked),0) <> (select count(*) from public.source_records)
     or (select count(distinct sid) from unnest(linked) sid) <> coalesce(cardinality(linked),0)
     or exists (select 1 from unnest(linked) sid where not exists (select 1 from public.source_records r where r.id = sid)) then
    raise exception 'Plan must link every source record exactly once';
  end if;
  -- Keep IDs for retained groups; remove only canonical rows superseded by this complete plan.
  insert into public.jobs select * from jsonb_populate_recordset(null::public.jobs, planned_jobs)
  on conflict (id) do update set
    company=excluded.company, title=excluded.title, location=excluded.location,
    internship_type=excluded.internship_type, recruitment_batch=excluded.recruitment_batch,
    salary=excluded.salary, industry=excluded.industry, company_nature=excluded.company_nature,
    company_size=excluded.company_size, welfare=excluded.welfare, published_at=excluded.published_at,
    deadline=excluded.deadline, description=excluded.description, requirements=excluded.requirements,
    apply_url=excluded.apply_url, application_status=excluded.application_status,
    source_record_ids=excluded.source_record_ids, raw_content_hash=excluded.raw_content_hash,
    consecutive_missing_count=excluded.consecutive_missing_count, canonicalization_trace=excluded.canonicalization_trace;
  delete from public.jobs where id not in (select id from jsonb_populate_recordset(null::public.jobs, planned_jobs));
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'source_record_ids',source_record_ids,
    'raw_content_hash',raw_content_hash,'application_status',application_status,
    'consecutive_missing_count',consecutive_missing_count) order by id),'[]'::jsonb) into result from public.jobs;
  return result;
end;
$$;

revoke all on function public.canonicalization_snapshot() from public, anon, authenticated;
revoke all on function public.apply_canonicalization(text,jsonb) from public, anon, authenticated;
grant execute on function public.canonicalization_snapshot() to service_role;
grant execute on function public.apply_canonicalization(text,jsonb) to service_role;
commit;
