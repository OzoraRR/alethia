# Edit profile and admin console

## Profile editing

Route: `/profile/edit`

- Avatar upload remains in Supabase Storage bucket `avatars`; `profiles.avatar_path` is updated transactionally.
- Password change uses `supabase.auth.changePassword(currentPassword, newPassword)`.
- Username change uses `change_username(text)`, which validates format/uniqueness, updates `profiles.username`, and synchronizes `auth.users.raw_user_meta_data`.
- Earned badges come from `user_achievements`. Display choices are stored in `user_profile_badges` through `set_profile_badge(text, boolean)`.

## Back navigation

Authenticated completion/back links target `/dashboard`. The landing page remains available for logged-out entry and the user login page only.

## Admin authentication

Admin credentials are separate from Supabase user auth:

```text
Username: Alethia
Password: ptihhhhjaya
```

Only a bcrypt hash is stored in `admin_accounts`. Plaintext exists only in the seed migration requested for the hackathon.

Flow:

1. `POST /api/admin/login` calls `admin_login` with username, password, and request IP.
2. The database rate-limits five failed attempts per username/IP hash per 15 minutes.
3. A random 256-bit token is returned; only its SHA-256 hash is stored in `admin_sessions`.
4. The raw token is stored in an httpOnly, SameSite=Strict cookie.
5. `/admin/dashboard` verifies the cookie against the database on every server render.
6. Every admin mutation re-verifies the session inside a SECURITY DEFINER RPC.

Set this in deployed HTTPS environments:

```env
ADMIN_COOKIE_SECURE=true
```

## Admin sections

- Reports: list every report and update triage/review status.
- Modules: create or edit module catalog metadata. New content is a draft unless a real `content_key` is supplied. Executable training content is not uploaded through the database.
- Daily quests: create/edit active quest definitions, targets, and point rewards.

## Security

- `/admin` has no register flow.
- Ordinary user sessions cannot access `/admin/dashboard`.
- Admin tables have RLS enabled and all direct anon/authenticated/service-role privileges revoked.
- Admin mutation functions require a valid unexpired database session token.
- Report moderation fields remain immutable to normal users; only the verified admin RPC can change them.
- Rotate the requested launch password after the hackathon and move it to a secret manager.
