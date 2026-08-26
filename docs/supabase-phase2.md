# Supabase Phase 2

Create a local `.env.local` file containing only:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

These are intentionally public client values. Do not add a database password, `service_role` key, or any secret to the app, a `.env` file committed to Git, or a mobile build.

Apply `supabase/migrations/202608270001_phase2_identity_and_rls.sql` through the Supabase CLI (`supabase db push`) or the Supabase SQL Editor using a database-owner session. The migration creates the identity and organization tables, an Auth-to-profile trigger, and RLS policies. The app connects only with Supabase Auth's persisted user session and the publishable key.

To create a safe test user, create it in Supabase Auth (Dashboard or an authorized server workflow), then use an administrator database session to assign its generated `profiles` row to an organization, assign one or more rows in `user_roles`, and create its `employees` row. Never make an app client responsible for role assignment.

RLS is the authorization boundary: users can read only their own employee/profile data, direct managers can read direct reports in the same organization, HR/admin can operate inside their own organization, and recruiters have no broad employee policy. `profiles` lets a user update only `display_name` and `avatar_path`; employee employment data is HR/admin managed. Test the policies with different signed-in users after applying the migration, including denied cross-employee, cross-manager, and recruiter requests.
