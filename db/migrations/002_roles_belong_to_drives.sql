-- Campus roles now belong to a single drive (opening.driveId) instead of drives listing roles
-- (drive.openingIds). Drives must exist before their roles, so the app writes drives first.

alter table openings add column if not exists drive_id text references drives (id) on delete cascade;
create index if not exists openings_drive_id_idx on openings (drive_id);

-- Backfill from the old drive.openingIds lists.
update openings o
set drive_id = d.id,
    data = jsonb_set(o.data, '{driveId}', to_jsonb(d.id))
from drives d
where o.source = 'campus' and d.data -> 'openingIds' ? o.id;

update drives set data = data - 'openingIds' where data ? 'openingIds';
