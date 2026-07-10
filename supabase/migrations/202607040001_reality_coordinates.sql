-- EndHere V4 Reality Coordinates
-- Evidence remains user-owned. Echoes are clusters of factual coordinates, not interpretations.

do $$
begin
  create type extracted_entity_kind as enum ('OBJECT', 'LOCATION', 'ACTION', 'TIME');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type echo_status as enum ('CANDIDATE', 'ACTIVE', 'ARCHIVED');
exception
  when duplicate_object then null;
end $$;

create table if not exists extracted_entities (
  id uuid primary key default gen_random_uuid(),
  kind extracted_entity_kind not null,
  value text not null,
  normalized_value text not null,
  source text not null default 'reality_extractor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, normalized_value)
);

create index if not exists extracted_entities_kind_idx on extracted_entities(kind);

create table if not exists fragment_extracted_entities (
  fragment_id text not null references fragments(id) on delete cascade,
  extracted_entity_id uuid not null references extracted_entities(id) on delete cascade,
  confidence double precision not null default 1.0 check (confidence >= 0 and confidence <= 1),
  evidence text,
  created_at timestamptz not null default now(),
  primary key (fragment_id, extracted_entity_id)
);

create index if not exists fragment_extracted_entities_entity_idx on fragment_extracted_entities(extracted_entity_id);

create table if not exists echoes (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  label text not null,
  status echo_status not null default 'CANDIDATE',
  evidence_count integer not null default 0 check (evidence_count >= 0),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists echoes_owner_status_last_seen_idx on echoes(owner_id, status, last_seen_at desc);

create table if not exists echo_extracted_entities (
  echo_id uuid not null references echoes(id) on delete cascade,
  extracted_entity_id uuid not null references extracted_entities(id) on delete cascade,
  weight double precision not null default 1.0 check (weight >= 0 and weight <= 1),
  created_at timestamptz not null default now(),
  primary key (echo_id, extracted_entity_id)
);

create index if not exists echo_extracted_entities_entity_idx on echo_extracted_entities(extracted_entity_id);