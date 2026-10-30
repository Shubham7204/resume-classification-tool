-- RecruiterOS schema. Each table keeps the full domain object (lib/types.ts) in `data`,
-- with the keys, foreign keys and filter columns promoted to real columns.
-- Applied by scripts/migrate.mjs over the direct (unpooled) connection.

create table if not exists openings (
  id          text primary key,
  req_id      text not null,
  source      text not null check (source in ('campus', 'careers')),
  status      text not null check (status in ('open', 'closed')),
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists drives (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists candidates (
  id          text primary key,
  drive_id    text references drives (id) on delete set null,
  email       text,
  usn         text,
  phone       text,
  in_pool     boolean not null default false,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists candidates_drive_id_idx on candidates (drive_id);
create index if not exists candidates_in_pool_idx on candidates (in_pool) where in_pool;
create index if not exists candidates_email_idx on candidates (lower(email));
create index if not exists candidates_usn_idx on candidates (usn);

create table if not exists applications (
  id            text primary key,
  candidate_id  text not null references candidates (id) on delete cascade,
  opening_id    text not null references openings (id) on delete cascade,
  stage         text not null,
  data          jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (candidate_id, opening_id)
);
create index if not exists applications_opening_id_idx on applications (opening_id);
