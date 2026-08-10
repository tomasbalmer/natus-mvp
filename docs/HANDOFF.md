# Handing the repository to a new owner

This repository was created under `tomasbalmer` with the expectation of being
transferred. Three separate things look like "the URL" and each moves on its
own track.

```
Local checkout        Repositorios/natus-mvp
                      Nobody else sees it. Irrelevant to the handoff.

GitHub repository     github.com/tomasbalmer/natus-mvp
                      Transfer ownership. Free, two minutes.

Custom domain         Lives at a registrar, not at GitHub.
                      Transferring the repository does NOT move the domain.
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
| Actions secrets | **Do not move.** This project has none |
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
