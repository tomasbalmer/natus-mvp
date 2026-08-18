# Handing the repository to a new owner

This repository was created under `tomasbalmer` with the expectation of being
transferred. Four separate things look like "the project" and each moves on
its own track.

```
Local checkout        Repositorios/natus-mvp
                      Nobody else sees it. Irrelevant to the handoff.

GitHub repository     github.com/tomasbalmer/natus-mvp
                      Transfer ownership. Free, two minutes.

Custom domain         Lives at a registrar, not at GitHub.
                      Transferring the repository does NOT move the domain.

Supabase project      A separate account, with its own owner and its own
                      billing. It does NOT move with the repository, and
                      the repository is useless to a new owner without it.
```

## Checklist

1. **Current owner** — Settings → General → Transfer ownership → new account.
2. **New owner** — accepts the transfer, then Settings → Pages → enable, source
   GitHub Actions.
3. **New owner** — if using a custom domain: Settings → Pages → Custom domain,
   then add a `CNAME` DNS record pointing the subdomain at
   `<new-owner>.github.io`.
4. **Previous owner** — delete the old DNS record.
5. **Previous owner** — Settings → Pages → Verified domains: remove the domain
   if it was verified at account level. **This step is the one people forget.**
   A domain verified on the old account blocks the new owner from using any
   subdomain of it, with an error that does not explain why.

## What survives the transfer

| | |
|---|---|
| Commit history | Intact |
| Existing clones and remotes | Redirect automatically |
| Issues, pull requests, stars | Move with the repository |
| Actions workflow | Moves with the repository |
| Actions secrets | **Do not move.** `SUPABASE_ACCESS_TOKEN` must be recreated |
| Actions variables | **Do not move.** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REQUIRE_INVITE` |
| Supabase project | Does not move. See below |
| GitHub Pages URL | **Changes**, and does not redirect |

The Pages URL is the only casualty, and only if no custom domain is attached.
With a custom domain the public URL is unaffected by who owns the repository.

## Changing the base path

The build reads `VITE_BASE`, so moving between a subpath and a domain root
requires no source change.

| Situation | `VITE_BASE` |
|-----------|-------------|
| `<owner>.github.io/natus-mvp/` | `/natus-mvp/` |
| Custom domain at the root | unset, or `/` |

It is set in one place: the `Build` step of `.github/workflows/deploy.yml`.
`BrowserRouter` reads the same value through `import.meta.env.BASE_URL`, so
routing follows automatically.

## The Supabase side

Transferring the repository moves none of this. Either the Supabase project is
transferred too — Supabase supports moving a project between organisations —
or a new one is created and these are reapplied.

**Three things are keyed to the public URL, and all three break silently when
it changes.** None of them produces a useful error: the auth redirect returns
somebody to a page that does not exist, and a blocked CORS response looks to
the application exactly like a network failure.

| What | Where | Holds |
|------|-------|-------|
| Redirect allow-list | Supabase → Authentication → URL Configuration | Site URL and every exact URL Google may return to |
| CORS allow-list | Edge Function secret `ALLOWED_ORIGINS` | Comma-separated origins. Scheme and host, no path |
| Google OAuth client | Google Cloud console | Authorised redirect URI, pointing at the Supabase callback |

`ALLOWED_ORIGINS` is configuration rather than source for the same reason
`VITE_BASE` is: changing owner changes the origin, and neither should mean
editing a file. `supabase/functions/_shared/cors.ts` falls back to the two
localhost origins when it is unset — which is the right default for a laptop
and the wrong one for a deployment, where it means the browser silently
discards every answer.

```bash
supabase secrets set ALLOWED_ORIGINS=https://<owner>.github.io
# or, with a custom domain
supabase secrets set ALLOWED_ORIGINS=https://natus.example
```

The other two secrets the functions need:

```bash
supabase secrets set ANTHROPIC_API_KEY=...   # the five model functions
supabase secrets set RAPIDAPI_KEY=...        # natal-chart, via Astrologer
```

Without either, the functions that need them answer `no_model` or
`astrologer_not_configured` and the application degrades to its curated
fixtures rather than failing. That is the designed behaviour, not a fallback
to be relied on.

Deployment is automatic on push to `main`, from the `functions` job in
`.github/workflows/deploy.yml`, which needs a `SUPABASE_ACCESS_TOKEN`
repository **secret**. Without it the job skips, the site still ships, and the
functions stay at whatever version was last deployed by hand.

## Before making the repository public-facing

The repository is public because GitHub Pages requires it on a free plan.
Private repositories need GitHub Pro or a Team organisation.

Two things must be settled before the URL is circulated beyond a small group:

- **Hotline verification.** `data/crisis-resources.json` carries
  `verified_at: null` on every entry, and the crisis screen renders an
  unverified notice while that is the case. The PDR calls telephone
  verification an absolute launch blocker. Verify by calling, not by
  searching, then set the date.
- **Clinical review of the crisis keywords.** `data/crisis-keywords.json` is
  marked `"status": "preliminary"`. It needs a clinical psychologist's review
  before anyone relies on it.
