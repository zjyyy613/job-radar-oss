begin;

-- Extraction bookkeeping only. Frozen Gate/Profile/source semantics are unchanged.
alter table public.jobs
  add column extraction_input_hash text,
  add column extraction_attempt_hash text,
  add column extraction_status text check (extraction_status in ('success','failed')),
  add column extraction_error text,
  add column extraction_attempted_at timestamptz,
  add column extraction_metadata jsonb check (extraction_metadata is null or jsonb_typeof(extraction_metadata) = 'array');
comment on column public.jobs.extraction_input_hash is 'Hash of last valid gates, possibly older than raw_content_hash after a failed extraction.';
comment on column public.jobs.extraction_attempt_hash is 'Cache last attempted content, including invalid output: unchanged JD never automatically calls model again.';
comment on column public.jobs.extraction_metadata is 'Nonblocking verbatim unsupported conditions and compound OR branches. Never executable qualification gates.';

create or replace function public.apply_canonicalization(expected_token text, planned_jobs jsonb) returns jsonb
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
  -- Canonicalization never writes gates; ON CONFLICT preserves last valid extraction.
  if exists (select 1 from jsonb_populate_recordset(null::public.jobs, planned_jobs) j
       where gates is distinct from '[]'::jsonb or extraction_version is not null or extracted_at is not null
         or extractor_type is not null or extraction_attempt_hash is not null or extraction_input_hash is not null
         or extraction_status is not null or extraction_error is not null or extraction_attempted_at is not null
         or extraction_metadata is not null or coalesce(cardinality(source_record_ids),0) = 0
         or canonicalization_trace->>'version' is distinct from 'deterministic-v1') then
    raise exception 'Invalid canonicalization job plan';
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

create function public.write_gate_extraction(job_id uuid, expected_hash text, expected_attempt_hash text, result jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare current_job public.jobs; gate jsonb; evidence jsonb;
begin
  select * into current_job from public.jobs where id = job_id for update;
  if not found or expected_hash is null or current_job.raw_content_hash is distinct from expected_hash
     or current_job.extraction_attempt_hash is distinct from expected_attempt_hash
     or current_job.extraction_attempt_hash = expected_hash then
    raise exception 'Stale extraction snapshot';
  end if;
  if result->>'status' is null or result->>'status' not in ('success','failed') then
    raise exception 'Invalid extraction result';
  end if;
  if result->>'status' = 'success' then
    if jsonb_typeof(result->'gates') is distinct from 'array'
       or jsonb_typeof(result->'metadata') is distinct from 'array'
       or coalesce(result->>'extraction_version','') = ''
       or result->>'extractor_type' is null or result->>'extractor_type' not in ('deterministic','deterministic+deepseek') then
      raise exception 'Invalid extraction success';
    end if;
    -- Runtime TypeScript validator is mandatory; defend the DB boundary against empty/fabricated quotes as well.
    for gate in select value from jsonb_array_elements(result->'gates') loop
      if jsonb_typeof(gate->'evidence') is distinct from 'array' or jsonb_array_length(gate->'evidence') = 0 then
        raise exception 'Gate evidence required';
      end if;
      for evidence in select value from jsonb_array_elements(gate->'evidence') loop
        if coalesce(trim(evidence->>'quote'),'') = '' or evidence->>'source' is null
           or evidence->>'source' not in ('title','description','requirements')
           or position(evidence->>'quote' in coalesce(to_jsonb(current_job)->>(evidence->>'source'),'')) = 0 then
          raise exception 'Ungrounded gate evidence';
        end if;
      end loop;
    end loop;
    update public.jobs set gates=result->'gates', extraction_input_hash=expected_hash,
      extraction_version=result->>'extraction_version', extracted_at=clock_timestamp(),
      extractor_type=result->>'extractor_type', extraction_metadata=result->'metadata'
      where id=job_id;
  end if;
  update public.jobs set extraction_attempt_hash=expected_hash, extraction_status=result->>'status',
    extraction_error=case when result->>'status'='failed' then 'extraction_failed' else null end,
    extraction_attempted_at=clock_timestamp() where id=job_id;
  return (select jsonb_build_object('id',id,'status',extraction_status,'attempt_hash',extraction_attempt_hash,
    'input_hash',extraction_input_hash,'gate_count',jsonb_array_length(gates)) from public.jobs where id=job_id);
end;
$$;
revoke all on function public.write_gate_extraction(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.write_gate_extraction(uuid,text,text,jsonb) to service_role;
commit;
