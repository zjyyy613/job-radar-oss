begin;

create table public.source_records (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_family text not null,
  source_tier text not null check (source_tier in ('authoritative', 'trusted_aggregator', 'discovery')),
  source_job_id text not null,
  source_url text,
  company text not null,
  title text not null,
  location text[] not null default '{}',
  internship_type text,
  recruitment_batch text,
  salary text,
  industry text,
  company_nature text,
  company_size text,
  welfare text[] not null default '{}',
  published_at timestamptz,
  deadline timestamptz,
  description text,
  requirements text,
  apply_url text,
  fetched_at timestamptz not null,
  last_seen_at timestamptz not null,
  raw_hash text not null,
  raw_payload jsonb not null,
  constraint source_records_source_job_unique unique (source, source_job_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  title text not null,
  location text[] not null default '{}',
  internship_type text,
  recruitment_batch text,
  salary text,
  industry text,
  company_nature text,
  company_size text,
  welfare text[] not null default '{}',
  published_at timestamptz,
  deadline timestamptz,
  description text,
  requirements text,
  apply_url text,
  application_status text not null default 'unknown'
    check (application_status in ('open', 'closed', 'unknown')),
  -- Linkage is maintained by canonicalization; UUIDs refer to source_records.id.
  source_record_ids uuid[] not null default '{}',
  -- Full gate validation is performed before writes by validateGate + source grounding.
  gates jsonb not null default '[]'::jsonb check (jsonb_typeof(gates) = 'array'),
  raw_content_hash text,
  extraction_version text,
  extracted_at timestamptz,
  extractor_type text,
  consecutive_missing_count integer not null default 0 check (consecutive_missing_count >= 0)
);

create table public.source_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_family text not null,
  source_tier text not null check (source_tier in ('authoritative', 'trusted_aggregator', 'discovery')),
  full_list boolean not null default false,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  status text not null check (status in ('success', 'partial', 'failed')),
  records_seen integer not null default 0 check (records_seen >= 0),
  records_new integer not null default 0 check (records_new >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  adapter_version text not null,
  error_type text,
  error_message text,
  check (finished_at >= started_at)
);

create index source_runs_source_started_at_idx on public.source_runs (source, started_at desc);

-- Guest reads need no Auth. Raw payloads/audit logs remain server-only.
alter table public.source_records enable row level security;
alter table public.jobs enable row level security;
alter table public.source_runs enable row level security;

revoke all on public.source_records, public.jobs, public.source_runs from public, anon, authenticated;
grant select on public.jobs to anon;
create policy jobs_guest_read on public.jobs for select to anon using (true);
grant select, insert, update, delete on public.source_records, public.jobs, public.source_runs to service_role;

commit;
