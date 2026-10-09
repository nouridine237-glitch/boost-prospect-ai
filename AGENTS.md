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
