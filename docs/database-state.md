# Database state: modules, progress, and reports

## Identity and relationships

Supabase Auth remains the credential source of truth. Do not create a second credential table.

```text
auth.users (users)
  1 ── 1 public.profiles (application user projection)
  1 ── N public.user_module_progress
  1 ── N public.practice_attempts
  1 ── N public.practice_reports

public.modules
  1 ── N public.user_module_progress
  1 ── N public.practice_attempts
  1 ── N public.practice_reports (optional report origin)

public.practice_reports
  1 ── N public.report_signals
  1 ── N public.report_investigation_notes
```

- `auth.users.id` and `public.profiles.id` are the same UUID.
- `user_module_progress` has one row per `(user_id, module_id)` and records `not_started`, `in_progress`, or `completed` independently for every module.
- The catalog is the only source for modules displayed to users. A module is visible only when `is_active = true`, `is_published = true`, and `content_key` points to implemented content.
- The current migration publishes only `courier-sms`, `social-engineering`, and `executable-file`. Empty/future slots are not database records and are not rendered.

## Main structures

### `public.modules`

Catalog/configuration only; learning content remains in the feature implementation identified by `content_key`.

- `id text primary key`
- `content_key text`
- localized title/description
- `category`, `route`, `image_path`, `difficulty`, `position`
- `is_active`, `is_published`
- `created_at`, `updated_at`

### `public.user_module_progress`

- `user_id uuid` → `auth.users.id`
- `module_id text` → `public.modules.id`
- `status`: `not_started | in_progress | completed`
- `progress_percentage smallint`: 0–100
- `score smallint`: nullable, 0–100
- `started_at`, `completed_at`, `last_practised_at`, `updated_at`

### `public.practice_reports`

- identity/ownership: `user_id`, `author_username`
- optional provenance: `module_id`, `attempt_id`, `source`
- report content: `title`, `category`, `channel`, `pattern`, `evidence`, `why_risky`, `defanged_url`, `screenshot_data_url`
- workflow: `status`, `review_status`, `reviewed_by`, `reviewed_at`
- sorting/cache: `signal_score`, `created_at`, `updated_at`

`report_signals` stores one signal per `(report_id, user_id)`. A trigger recomputes the cached `practice_reports.signal_score`, so the client cannot inflate it.

Report ownership is determined by comparing `practice_reports.user_id` with `auth.uid()`. Owners can edit every user-authored report field and delete their report. RLS restricts those operations to the owner, while a trigger prevents changes to author identity, source, moderation/review state, `created_at`, and `signal_score`. Related signals and notes cascade when a report is deleted.

## Queries

### Show only implemented/published modules

```sql
select
  module.id,
  module.title_id,
  module.description_id,
  module.category,
  module.route,
  module.image_path,
  module.difficulty,
  module.position,
  progress.status,
  progress.progress_percentage,
  progress.score,
  progress.updated_at
from public.modules as module
left join public.user_module_progress as progress
  on progress.module_id = module.id
 and progress.user_id = (select auth.uid())
where module.is_active = true
  and module.is_published = true
  and module.content_key is not null
order by module.position, module.id
limit 6;
```

### Mark a module as actively being worked on

Use the RPC so a completed module is never accidentally downgraded:

```sql
select * from public.begin_module_progress('courier-sms');
```

### Complete a module

The application calls this in `features/progress/supabase-persistence.ts`:

```sql
insert into public.user_module_progress as progress (
  user_id,
  module_id,
  status,
  progress_percentage,
  score,
  started_at,
  completed_at,
  updated_at,
  last_practised_at
)
values (
  (select auth.uid()),
  'courier-sms',
  'completed',
  100,
  null,
  now(),
  now(),
  now(),
  now()
)
on conflict (user_id, module_id) do update
set status = excluded.status,
    progress_percentage = excluded.progress_percentage,
    score = excluded.score,
    completed_at = excluded.completed_at,
    updated_at = excluded.updated_at,
    last_practised_at = excluded.last_practised_at;
```

### Create a report

```sql
insert into public.practice_reports (
  user_id,
  source,
  title,
  category,
  channel,
  pattern,
  evidence,
  why_risky,
  defanged_url
)
values (
  (select auth.uid()),
  'manual',
  'Parcel SMS with a verification fee',
  'SMS phishing',
  'Text message',
  'Urgency',
  'Observed sender and link evidence.',
  'Urgency pushes the user toward an unverified route.',
  'parcel-check[.]example'
)
returning *;
```

`prepare_practice_report()` overwrites identity and server-managed review/signal fields.

### Edit or delete an owned report

RLS limits both operations to `user_id = auth.uid()`:

```sql
update public.practice_reports
set
  title = 'Updated title',
  category = 'SMS phishing',
  channel = 'Text message',
  pattern = 'Urgency',
  evidence = 'Updated evidence.',
  why_risky = 'Updated risk explanation.',
  defanged_url = 'updated-check[.]example',
  screenshot_data_url = null,
  updated_at = now()
where id = '<report-uuid>'
  and user_id = (select auth.uid())
returning *;

delete from public.practice_reports
where id = '<report-uuid>'
  and user_id = (select auth.uid());
```

The UI exposes **All reports / My reports**, marks owned rows with **YOUR REPORT**, and only renders edit/delete actions when `isOwner` is true.

### Sort reports

```sql
-- newest
order by created_at desc, id desc;

-- oldest
order by created_at asc, id asc;

-- top signal
order by signal_score desc, created_at desc;
```

## Application files

- `supabase/migrations/20260925000000_module_catalog_progress_reports.sql` — schema, seed catalog, constraints, RLS, triggers
- `supabase/migrations/20260925020000_owned_report_management.sql` — owner-only report update/delete policies and system-field protection
- `features/progress/progress.ts` — normalized per-module client state
- `features/progress/supabase-persistence.ts` — remote progress/attempt persistence
- `features/modules/catalog.tsx` — published module query and grid
- `features/reports/reports.ts` — report/signal/note queries and mutations
- `features/reports/report-hub.tsx` — database-backed report UI
- `features/daily/daily-backend.ts` — daily activity, quest, point, and notification client API
- `docs/daily-quests-streaks-notifications.md` — quest/streak/achievement trigger documentation

## Backend coordination

1. Apply the migration before deploying the frontend:
   ```powershell
   npx supabase db push --linked --yes --skip-vault
   ```
2. Developer approval currently belongs in a trusted backend/admin flow using `service_role` or a restricted `SECURITY DEFINER` function. Browser clients can create and manage only their own report content; moderation fields remain protected.
3. Move report screenshots from `screenshot_data_url` to a private Supabase Storage bucket before production-scale uploads. The current column intentionally enforces the existing 500 KB UI limit.
4. If more than six modules are published, decide whether the training page should paginate or raise its visual limit; do not render empty cards.
