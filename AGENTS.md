# Water Hub working rules

- This is the independent John project. The separate Jomari/Waste Hub project is outside this workspace.
- Tests, seed data, and demos use local PostgreSQL only. Never load the parent's environment, credentials, or Neon database.
- The user authorized the separate John runtime Neon database. Keep it in ignored `.env`, scoped to `water_hub`; preserve local configuration in ignored `.local/local.env`. No test may target Neon.
- Runtime ports: web 3200/API 4200; separate local demo web 3300/API 4300; local PostgreSQL 54339; disposable integration PostgreSQL 54340.
- Never print or commit `.env`, `.local`, passwords, sessions, or tokens.
- Use explicit on-demand loading; no polling, focus/reconnect refresh, or automatic error retries.
- Keep the network-atlas design distinct from Waste Hub: top navigation, ink-blue overview, DMA network, blue actions. Code-first workflow was selected by the user in this session.
- Required checks: lint, TypeScript, unit tests, isolated local integration tests, production build, local migration and seed verification.

- Code map: `docs/project-map.md`. Frontend route entries stay in `frontend/app`; feature code is in `frontend/src/features`. Backend modules are in `backend/src/modules`; Prisma and tests are under `backend/`.
- Run `npm run check:architecture` after structural changes. Preserve the route/schema/migration/style baseline unless the user authorizes a behavior change.
