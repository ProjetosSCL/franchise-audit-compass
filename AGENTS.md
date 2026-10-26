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

## SCL Audit — project rules

- Source of truth for features: `SKILL.md` (root) and `docs/*.md` (PLANO, PAGINAS, DEPARA, PRS, PRD, FUNCTIONS, ESTRUTURA, PROCESSO). Follow the phase order from PLANO.md; before creating any table, function or page, check DEPARA.md to avoid duplicates and name mismatches.
- `db/schemas.sql` is the single source of the data model. Never create tables or columns outside it.
- Single user role: 4 sócios-gestores with identical full access to the 8 franquias. RLS policy on every table is `auth.uid() IS NOT NULL` (no per-franchise scoping). No public signup; email/password sign-in only at `/login`.
- All protected pages live under `src/routes/_authenticated/`; public routes are `/login` and `/reset-password` only.
- The dashboard reference month is a validated URL search parameter, and franchise detail navigation uses canonical franchise IDs from the shared dashboard query; this keeps links tied to real franchises and the selected period.
- No dummy data anywhere; all processing is triggered by manual monthly upload (no cron, webhooks, Make/N8N/Zapier). Never store or display end-customer PII (CPF/CNPJ, phone, address) — LGPD.
- Ingestion and file association use authenticated TanStack server functions, not new Edge Functions, because this project's runtime requires that boundary; parsing helpers stay server-only and Storage receives only allowlisted normalized data.
- Monthly ingestion commits through a service-role-only transactional Postgres function with a franchise/month lock, because replacing either source must not leave partial records or erase the other source.
