# Daily quests, streaks, points, achievements, and notifications

## Runtime flow

```text
App opens / regains focus
  -> useDailyActivity()
  -> record_daily_activity(timezone)
     -> resolve user's local calendar date
     -> update last_active_date/current_streak idempotently
     -> assign today's three quest rows if missing
     -> mark daily-login quest completed
     -> evaluate streak achievements

User completes a module
  -> user_module_progress changes to completed
  -> handle_completed_module()
     -> complete-one-module quest
     -> first_module / all_modules / first_practice achievements
     -> module_completion notification

User creates a report
  -> practice_reports INSERT
  -> handle_created_report()
     -> submit-one-report quest
     -> first_report / report_contributor achievements

User claims a completed quest
  -> claim_daily_quest(id, local_date)
     -> lock assignment row
     -> verify completed
     -> insert one point-ledger row
     -> increment profiles.points
     -> status becomes claimed
```

## Tables

### `daily_quests`

Canonical fixed quest pool:

- `daily-login`: target 1, reward 10 points
- `complete-one-module`: target 1, reward 50 points
- `submit-one-report`: target 1, reward 25 points

Fields include `quest_type`, `target_value`, `reward_points`, `position`, and `is_active`.

### `user_daily_quests`

One assignment per `(user_id, quest_date, quest_id)`:

- `quest_date`: date derived in `profiles.timezone`, not UTC
- `status`: `not_started | in_progress | completed | claimed`
- `progress_value`, `target_value`
- reward snapshot: `reward_points`
- `completed_at`, `claimed_at`, `updated_at`

Old dates are retained as history. A new local date automatically creates a new assignment set.

### `user_streaks`

Existing streak table now also has:

- `last_active_date date`
- `current_streak`
- `longest_streak`

`last_qualifying_date` remains available for module-completion streak behavior; the new daily streak uses `last_active_date`.

### `profiles`

Added:

- `timezone text`, default `Asia/Jakarta`
- `points integer`, default 0

The browser timezone is passed to `record_daily_activity()`. A database trigger rejects invalid IANA timezone names.

### `user_point_ledger`

Idempotent reward history. The unique `(user_id, reference_key)` prevents the same quest from awarding points twice.

### `notifications`

- `type`: `module_completion | achievement | daily_quest | system`
- `module_id`
- `achievement_code`
- `related_id`
- `is_read`, `read_at`
- `dedupe_key`

`type` separates module notifications from achievement notifications. The UI can therefore render different components without inspecting the message text.

## Streak rules

The server computes the local date as:

```sql
(now() at time zone profiles.timezone)::date
```

Then:

```text
no previous active date       -> current_streak = 1
same local date               -> unchanged (no double increment)
previous local date = today-1 -> current_streak += 1
gap greater than one day      -> current_streak = 1
longest_streak                -> greatest(old longest, current streak)
```

This handles:

- multiple opens/focus events on one day;
- `23:59` and `00:01` in the user's own timezone;
- timezone differences between users;
- DST changes because conversion uses PostgreSQL's IANA timezone catalog.

## Trigger timing

### Daily login quest and streak

Call `record_daily_activity(requested_timezone)`:

- after the app shell mounts;
- whenever the browser regains focus;
- whenever the tab becomes visible.

The implementation already does this in `features/daily/daily-backend.ts`, mounted by `components/layout/app-shell.tsx`.

### Module completion notification and quest

PostgreSQL trigger `user_module_progress_handle_completion` runs after a progress row is inserted or its status changes. It only acts on the transition into `completed`; reopening an already completed module does not reward again.

### Report quest and achievements

PostgreSQL trigger `practice_reports_handle_created` runs after report insertion.

### Achievement notification

PostgreSQL trigger `user_achievements_create_notification` runs after an achievement row is inserted. Current automatic achievements:

- `first_practice`
- `first_module`
- `all_modules`
- `streak_7`
- `first_report`
- `report_contributor`

## Optional scheduled assignment

Assignments are lazy and timezone-safe, so no cron is required. If rows must exist before the user opens the app, schedule the included bulk function every 15 minutes:

```sql
select cron.schedule(
  'assign-daily-quests-timezone-aware',
  '*/15 * * * *',
  'select public.assign_daily_quests_for_all_users();'
);
```

The function derives each user's local date separately. A single UTC midnight job would be incorrect for a global user base.

## Client API and UI

`features/daily/daily-backend.ts` exposes:

- `recordDailyActivity()`
- `loadDailyQuests(questDate)`
- `claimDailyQuest(questId, questDate)`
- `loadNotifications(unreadOnly)`
- `markNotificationRead(notificationId)`
- `loadAchievements()`

`features/daily/daily-activity-provider.tsx` owns the shared Supabase-backed state. The UI is split into:

- `features/daily/daily-quest-panel.tsx` — daily quest cards, progress, points, streak, and claim buttons on the dashboard
- `features/daily/notification-bell.tsx` — global unread notification center in the header
- `features/daily/achievement-panel.tsx` — database-backed achievement/badge state on the profile page

`components/layout/app-shell.tsx` wraps the application with `DailyActivityProvider`, so the quest panel, notification bell, and achievement panel share one synchronized state.

## Existing dependencies

The logic uses tables already available in the project:

- `auth.users`
- `public.profiles`
- `public.modules`
- `public.user_module_progress`
- `public.user_streaks`
- `public.user_achievements`
- `public.practice_reports`

New migration:

- `supabase/migrations/20260925030000_daily_quests_streaks_notifications.sql`
- `supabase/migrations/20260925031000_fix_daily_activity_column_ambiguity.sql`
- `supabase/migrations/20260925032000_backfill_existing_achievements.sql`
- `supabase/migrations/20260925033000_sync_profile_badges.sql`
- `supabase/migrations/20260925034000_protect_profile_badge_projection.sql`
