# Handover: Natus to its owner, at app.natus.world

A live plan, not a record. The product belongs to the person who registered
`natus.world`; this repository, the Supabase project and the paid keys are
currently in Tomas's accounts and move to his. Delete this file when phase 8
is done, and fold whatever is still true into `CLAUDE.md`.

## The shape at the end

```
natus.world        his Lovable landing, unchanged, with an "Entrar" button
app.natus.world    this PWA, on GitHub Pages under his organisation
Supabase           this project, transferred to his organisation, same URL
```

The landing is a separate Lovable site with a waitlist form writing to his
own Supabase project (`pwenxnhohjjrynacxshx`). Nothing here touches it; the
waitlist is his list of first users to invite.

`natus.world` is registered at GoDaddy (2026-03-02, expires 2027-03-02) and
its DNS is GoDaddy's. It carries MX and SPF records for mail — do not touch
them, or the root and `www` records that serve the landing.

## Costs he takes on

| What | Cost |
|---|---|
| GitHub Pages, custom domain, HTTPS | Free while the repository is public |
| Supabase | Free tier. It pauses after inactivity; Pro is USD 25/month |
| Anthropic | Usage. `MONTHLY_BUDGET_USD` caps it, default 50 |
| RapidAPI (Astrologer) | His own subscription |
| DNS records at GoDaddy | Free |

## Phases

Legend: **T** Tomas (with Claude), **O** the owner, **T+O** together.

### 0. Decisions — O, T+O
- [ ] Confirm the subdomain: `app.natus.world`.
- [ ] Name of his GitHub organisation.
- [ ] Whether Tomas stays on as a collaborator after the handover.
- [ ] He has read what he takes on: the costs above, and phase 9.
- [x] A revoked consent hides the reading rather than deleting it (2026-09-25).
- [x] A simulated subscription buys six chat turns a month on top of the free
      three, for now (2026-09-25). See `SUBSCRIBED_QUESTIONS`.

### 1. Database — T — done 2026-09-25
- [x] Audit of schema against code; every defect reproduced against the local
      stack before it was fixed. `pnpm test:db` is the result.
- [x] Four defects in the write path, the chat quota, the budget ceiling, the
      claimed-session key, reference-data drift, missing indexes.
- [x] Clinical exclusion re-applied server-side; subscription ceiling.
- [x] First load after a lapsed token no longer runs the visit offline.

### 2. Prepare the repository — T
- [x] Migrations apply in CI before functions deploy.
- [x] This file.
- [x] Branch `handover/custom-domain`: `VITE_BASE: /` and the docs that name
      the old URL, pushed to GitHub. **Not merged** until phase 5 — merged early it breaks the
      site at `tomasbalmer.github.io/natus-mvp/`.
- [x] A page in Spanish for the owner: what he receives, what to create,
      what it costs, what he does at each step. Published privately as a
      claude.ai artifact from Tomas's account; he shares it when ready.

### 3. His accounts — O
- [ ] GitHub organisation. Invites Tomas as an owner.
- [ ] Supabase organisation. Invites Tomas as **Owner** — required to
      transfer a project into it.
- [ ] Anthropic console: account, credit, a spend limit, an API key.
- [ ] RapidAPI: Astrologer subscription and key.
- [ ] Google Cloud: an empty project, for phase 6.

### 4. Transfer — T+O
- [ ] Supabase: transfer project `khwrauqgwopkgyvbonmp` to his organisation.
      URL and keys do not change, so nothing in the code does.
- [ ] Replace the secrets with his: `supabase secrets set ANTHROPIC_API_KEY=…`
      and `RAPIDAPI_KEY=…`.
- [ ] GitHub: transfer the repository to his organisation.
- [ ] Check the repository's secrets and variables survived; set a new
      `SUPABASE_ACCESS_TOKEN` from an account in his organisation.
- [ ] Push a commit and watch all three jobs go green.

### 5. Domain — T+O
Done after phase 4, because GitHub's domain verification is tied to the
account that owns the repository.
- [ ] O, at GoDaddy, adds exactly two records and changes nothing else:

      | Type  | Name                                   | Value                   |
      |-------|----------------------------------------|-------------------------|
      | CNAME | `app`                                  | `<his-org>.github.io`   |
      | TXT   | `_github-pages-challenge-<his-org>`    | from GitHub, at verify  |

- [ ] Repository → Settings → Pages → custom domain `app.natus.world`; wait
      for the certificate; Enforce HTTPS.
- [ ] Merge `handover/custom-domain` immediately after. Between the two the
      new domain serves a build that expects `/natus-mvp/`.
- [ ] `supabase secrets set ALLOWED_ORIGINS=https://app.natus.world`. Without
      it the browser silently discards every function's answer.
- [ ] Supabase → Authentication → URL configuration: Site URL and a redirect
      URL of `https://app.natus.world/`.
- [ ] Walk it in a browser: onboarding, Soul Map, chat, a comparison,
      "borrar todo", install as a PWA on a phone.

Anybody who installed the PWA or signed in at the old URL starts again at the
new one: the origin changed, and local storage does not follow it.

### 6. Sign-in — T+O
- [ ] OAuth client in **his** Google Cloud project, with
      `https://app.natus.world` as an authorised origin. The consent screen
      shows his brand, which is why it is his project.
- [ ] Decide `REQUIRE_INVITE`. Today the door is open.

### 7. Landing — O
- [ ] In Lovable, a button that opens `https://app.natus.world`. A prompt to
      Lovable is enough; nobody here needs access to it.

### 8. Close — T
- [ ] Revoke Tomas's Anthropic and RapidAPI keys.
- [ ] Adjust Tomas's roles to what phase 0 decided.
- [ ] Delete this file; move what is still true into `CLAUDE.md`.

### 9. Before inviting real people — O
Launch blockers the PDR names, independent of the handover.
- [ ] Telephone every crisis number, then set `verified_at` again. Eight are
      short codes that cannot be dialled from abroad.
- [ ] A clinician reviews `crisis-keywords.json`.
- [ ] Decide the Supabase plan, given the free tier pauses.
