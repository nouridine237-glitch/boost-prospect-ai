<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep onboarding in a shared authenticated-layout provider with profile-backed flags and user-scoped activity reads, so welcome appears across entry pages and dismissal persists across devices.
- Store the shared scripts library in public.scripts with authenticated reads and admin-only writes enforced by RLS; load it with user-scoped query options and pass script IDs to the existing AI function so personalization shares quota enforcement and uses owner-scoped prospect context.
- Keep public landing visuals and motion scoped to lp-prefixed classes and illustrative phone components, preserving authenticated screens and pricing logic; use CSS transform/opacity with one IntersectionObserver and a static optimized share image for lightweight rendering.
- SasPay online payments: prices are fixed server-side in saspay.server.ts; webhooks only trigger a re-verification via GET /checkout-sessions/{id}/status/ and the conditional en_attente→valide update is the single activation path (idempotency). Why: webhook payloads are never trusted to activate a plan.
- MCP server lives in src/lib/mcp (one tool per file, OAuth via Lovable Cloud auth, RLS as caller). Why: external assistants act as the signed-in user without privileged keys.
- Referral rewards are granted only by SECURITY DEFINER triggers (first prospect insert, subscription turning paid); client reads only, claim/code creation via server functions. Why: no reward can be triggered from the browser.
- Academy quiz results are scored server-side (`scoreQuiz` in academy.functions.ts) and written only via service-role `record_academy_result` (keeps best score). Leader–member links live in `team_links` (not `referrals`), changed only through SECURITY DEFINER `team_*` functions; leaders read members solely through `team_member_progress()` aggregates. Why: browser scores are untrusted and members' private data must stay private.
- Duplication catalogue is app-managed in a server-only versioned module, delivered only after effective-plan gating; own checklist progress uses duplication_progress and its authenticated SQL writer with ordered days and immutable completed entries. Why: paid content must not ship in free bundles and cross-device progress must not expose member data.
- Video lesson progress lives in `academy_lesson_progress` (owner SELECT only); written solely via service-role `record_lesson_progress` after plan/publication checks, with watched time credited by the server clock between consecutive "playing" reports. Why: opening a lesson or a forged client report must never mark it complete.
