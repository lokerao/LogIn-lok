# LogIn project rules

- Before changing Expo code, use the exact Expo SDK 57 documentation: https://docs.expo.dev/versions/v57.0.0/.
- Use React Native, Expo, TypeScript, Expo Router, Supabase Auth, PostgreSQL, Supabase Storage, and Git.
- Keep TypeScript strict and the code simple, maintained, and reusable.
- Treat the APK as inspectable: never include service-role keys, database passwords, private API keys, encryption master keys, or any other privileged secret.
- Only `EXPO_PUBLIC_` values intended for the client may appear in Expo environment files. Supabase authorization must use authenticated sessions and database Row Level Security on every table.
- Never trust role checks in the client for authorization. Employees can access only their own private data; managers, HR, admins, and recruiters require server/database authorization scoped to their organization and permissions. Admins do not receive attendance access.
- Do not build fake backend functionality, custom cryptography, or custom authentication. Do not implement face/photo recognition until explicitly approved.
- Phase 1 is foundation only: no employee, manager, HR, admin, or recruiter business screens; no seeded data.
