# GT Marketing Hub — Walkthrough Video Script (record-from)

> **Deliverable A4** — the 5–10 min narrated screen recording. Audience: the grader.
> Read this top-to-bottom while recording. Each beat has: **Do** (clicks) · **Say** (verbatim) ·
> a **[LIVE]** / **[LOCAL+DB]** tag · what it **Proves**.
> Live URL: https://gt-school-hub.vercel.app · Local: `npm run dev` → http://localhost:3000
> Companion docs: `docs/SUBMISSION.md` (write-up), `docs/06-gt-challenge/WORKFLOW.md` (challenge),
> `docs/audits/STATUS-RUBRICS.md` (the verdict-board rubrics).

---

## 0. Recording plan — read once before you start

**Record from two sources, and say which is which on camera.** The live URL has **no database
attached** (`AUTH_DEV_MODE=true`, in-memory paths), so the cause→effect backbone proofs
(payment *moving*, a cross-program write being *rejected*, parity *dropping*) cannot truly happen
there — `/dev/payments` literally shows `source: seed-fixture`. Record those on a **local
`npm run dev` + seeded Supabase** segment (`[LOCAL+DB]` beats). Record everything genuinely live
(RBAC/403, $365K, Open Data, the public quiz, the methodology surfaces) on the **live URL**
(`[LIVE]` beats). This split *is* the honesty the brief rewards — it's a feature, not an apology.

**All-live fallback** (if you can't stand up local DB in time): keep the `[LOCAL+DB]` beats but
reframe the verb from *"watch it happen"* to *"here's the surface, here's the test that proves it"*
and run the named test on camera (`npx vitest run tests/payments.test.ts`, etc.). Never say
"watch it propagate" over a `seed-fixture` screen.

### Pre-flight checklist (the live URL will bite you otherwise)
- [ ] **Pre-warm every page** seconds before its take. Authenticated requests run a live Supabase
      profile lookup in middleware; under load they hang to a 25s ceiling and **504-cascade across
      all `/m/*` routes**. `/m/status` is the worst offender — pre-warm it or record it warm.
- [ ] **Don't rapid-click or hover the sidebar** (RSC prefetch storm fans out the middleware
      lookups). Click deliberately.
- [ ] **Use 3 separate tabs/sessions**, one per role. **Don't rely on sign-out mid-take**
      (`/api/auth/logout` is slow/fragile).
- [ ] **Log in as Admin** for the methodology, source-drill-down, and `/dev/*` beats (they're
      admin-gated — which is itself part of the hard-gates story).
- [ ] **Do one full dress-rehearsal take and watch it back.** Hunt for the `/m/status` hang and any
      "edit then navigate" beat that returns empty (serverless drops in-memory writes across
      requests).
- [ ] Numbers to expect live: budget **$365,000** / 4 workstreams · nurture banner **"overall
      92.76%"** · GT Challenge KPIs on **/m/gt-challenge** (spend **$8,208** · qualified **12** ·
      CPQL **$684**) · Open Data decision **$41 vs $63 blended**.

**Target ≈ 9:30.** Trim points marked ✂️.

---

## 1. Frame + the dev-auth honesty line — 0:00–0:40 · [LIVE `/login`]

**Do:** Open the live URL → it redirects to `/login` (8 persona cards → 3 roles, password-less,
"Dev auth mode is on" banner visible).

**Say:**
> "I'm Johnny. This is a 48-hour take-home. I went deep on a sync backbone and the modules that
> prove its hardest rules — CRM Ops for data trust, Budget for single-source reconciliation, and
> the role-gated Decision Queue where every cross-module rule lands — plus one end-to-end campaign,
> and I deliberately stubbed the rest. I'll prove the four things you asked to watch, show that data is
> connected front to back with the program gates holding, and I'll name every stand-in as I go.
>
> One thing up front so it's not a gotcha: this public link runs dev-auth — pick any role, no
> password, so you can review all three from one URL. It does **not** weaken the gate. The session
> is a real signed cookie; the role is resolved server-side from the verified user id, never
> trusted from the request; middleware denies by default. Dev mode removes the password, not the
> enforcement — flip one env var, wire an IdP, zero call-site changes."

**Proves:** sequencing judgment up front; disarms the dev-auth question before the grader wonders.

---

## 2. The spine — watch a payment propagate, contaminate nothing — 0:40–2:00 · [LOCAL+DB]

**Do:** Fire one Stripe test webhook. Follow the **same record by ID**: payment → CRM (HubSpot
deal → `closedwon`) → the *correct* program store → visible in the app. Then fire the **same
signed event twice** → one `processed_events` row, **identical payment id**, balance unchanged
(box the unchanged number).

**Say:**
> "This is the foundation everything else rides on. Real Stripe event, real idempotency ledger —
> I send the same signed event twice and the replay is a no-op, not a double-charge: same payment
> id, one ledger row, balance unchanged. On the public link this surface renders deterministic
> seed facts so it runs with no database — you'll see it labeled `seed-fixture`. This is the live
> path, and `payments.test.ts` pins it in CI."

**Proves:** Signal 1 — payment propagates without contamination; idempotency (failure/edge #1);
front-to-back path #1.

---

## 3. Hard gates & no data leaks (the hero beat) — 2:00–3:30 · [LOCAL+DB] + [LIVE]

**Do — no leak [LOCAL+DB]:** As `app_rw` with program A's GUC set, attempt to read program B →
`0 rows`; attempt an INSERT into program B → RLS `WITH CHECK` **rejection**; forge a program id at
the app layer → `ProgramScopeError`.

**Say:**
> "The brief says of program isolation, literally, 'prove this.' So here it is, the way that
> matters — a leak isn't policed by app code, it's rejected by the database. `app_rw` is
> NOSUPERUSER, NOBYPASSRLS; an unset program scope returns zero rows — fail-closed. As program A I
> try to read program B: nothing. I try to *write* into program B: the row-level-security check
> rejects it. And if I forge a program id above the database, the app throws before it ever gets
> there."

**Do — role gate [LIVE]:** Leader tab → `/m/decisions` renders. Operator tab → `/m/decisions` →
redirects to `/forbidden`. Then open `/api/decisions` directly → **403 JSON** (zoom the Network tab
/ the raw JSON).

**Say:**
> "Same discipline at the role layer. The Decision Queue is leadership-only. As a Leader I see the
> queue. As an Operator, the same URL bounces to /forbidden — and critically, the API itself
> returns 403 JSON, not the data. This is server-enforced, not a hidden button. Operators can
> *submit* to the queue; they can never view or act on it."

**Proves:** Signal 3 — role denied DQ; program isolation / no cross-program leak (security); the
"hard gates" the grader cares about, shown as *rejection*, not just a pretty wall.

> ⚠️ **Do NOT click Approve/Reject on a queue card on camera.** The cards render from in-memory
> seed, but the decide API writes to a DB table seeded with *different ids* — a live ruling 404s/500s
> and the card won't change. Show the queue + gate + Open-Data recommendation; demo the actual
> ruling + audit trail via `npx vitest run tests/decisions.test.ts`. (Frame the Decision Queue as the
> role-gated integration sink, not a "deep engine" — the queue itself is a sorted list + status
> update; its strength is the 3-layer gate, the variance auto-flag, the Open-Data flip, and the audit.)

---

## 4. How every number on the board is made — rubric → graph → evals → logs → citation — 3:30–5:30 · [LIVE, Admin]

This is the trust act. Pre-warm `/m/status` first.

**4a · The one-glance answer [LIVE].** **Do:** Open `/m/status` (Exec Verdict Board).
> "This is the executive verdict — leadership's one-glance answer: where we are, are we on track,
> the one binding constraint, and what to do before the Aug 17 cutoff. Now I want to show you that
> nothing on this board is hand-waved."

**4b · It fills a rubric, it doesn't write prose [LIVE].** **Do:** Open the methodology/rubrics
surface (the rubric catalog — `docs/audits/STATUS-RUBRICS.md` made visible, or read it on screen).
> "Every cell answers one fixed question against a falsifiable rubric — in `rubrics.ts`, the single
> definition — filled with the real KPI numbers. Each spine column has a required structure and a
> quality bar, and `checkCellConformance` fails the build if any cell drops below it. The verdict
> isn't authored prose; it's a rubric filled from data."

**4c · The harness that generates it + the evals + the logs [LIVE, Admin].** **Do:** `/dev/agents`
— show the agent-graph diagram, run one trace, show the eval table (node · pass · input · expected
· actual · citations) and the provenance.
> "Here's the machine that writes the weekly verdict: a deterministic draft from the real numbers,
> then an optional LLM rewrite — but it's *gated*, only accepted if it still passes conformance,
> otherwise the deterministic draft stands. Every run is logged with its source — deterministic or
> LLM — its model, a timestamp, and an inputs-hash so I can detect a stale verdict. These eval rows
> show each node's expected-versus-actual and pass/fail, and the citations each claim rests on. The
> same harness backs the Ask-the-Hub agent — role-aware, cited, and it refuses raw PII."

**4d · Every number cites its tab and its source [LIVE, Admin].** **Do:** `/m/dashboard` → point at
the **Source** column → click **`⛁ Supabase`** on the Applicants row → lands on
`/dev/integrations`, the `supabase_app_form` row highlights (authoritative-for, join keys, owner,
row count, stand-in status).
> "And every number declares the one tab that owns it and the one source it comes from. Applicants
> comes from Supabase app_form — click it, and here's that exact connector: what it's authoritative
> for, its join keys, its row count. There's no second definition anywhere; every KPI is computed
> in one file, and the dashboard, the exec board, and the Home widget all read that same one.
> Notice the drill-down itself is admin-only — even provenance respects the role gate."

**4e · Where a number isn't live, it says so [LIVE].** **Do:** Back on `/m/status`, open the
Nurture stage → the SLA cell ("72% · 67 late · worst owner Johnny Chung, 25 of 67").
> "I want to be precise about this one. The SLA reads 72%, 67 late this week. That's a deterministic
> stand-in modeled on HubSpot Conversations — generated from seed, not a live read. So its citation
> says 'stand-in,' and the weekly target shows as a dash, because there's no live SLA series and I
> won't invent one. Real numbers cite their live connector; stand-ins cite themselves as stand-ins.
> That distinction is the whole point of the data strategy."

**Proves:** single source of truth (clicked, not asserted); deterministic + eval-checked + logged
generation; citations to tab + source; honest real-vs-stand-in labeling. ✂️ If long, cut 4b and
fold its one line into 4c.

---

## 5. It all reconciles — budget + the composable Hub — 5:30–6:40 · [LIVE] + [LOCAL+DB]

**Do — budget [edit LOCAL+DB, total LIVE]:** `/m/budget` — highlight **$365,000** across 4
workstreams (Grassroots $210K, Content $90K, Guerrilla, Foundations). Add spend to a workstream →
total still reconciles to $365K → the **>10% variance auto-flags into the Decision Queue** (the
"Guerrilla 12% over plan" item is already there live).

**Say:**
> "A number has to mean the same thing everywhere. The budget reconciles to $365K across four
> workstreams. I add spend to a workstream — the total holds, and when a workstream drifts past 10%
> over plan, the system flags *itself* into the Decision Queue. That's already fired here on
> Guerrilla."

**Do — the Hub [LIVE]:** `/` Home → composable widgets (add/remove/save, role-aware starter pack).
> "And the Hub is composable: each user builds their own command center from the widget library,
> with a role-aware starter pack. Saved-layout is wired; the browser drag-reorder is the one piece
> I'd finish next — it's tracked, not faked."

**Proves:** Signal 2 — budget reconciles + variance→DQ auto-flag; the composable-Home non-negotiable
(honest about the partial).

---

## 6. Front-to-back — the GT Challenge, end to end — 6:40–8:10 · [LIVE] + [LOCAL+DB]

**Do:**
1. `/gifted-quiz` **[LIVE]** — public, no chrome, consent checkbox above submit → take it → result
   **bucket** (framed as a *fit screen*; there is no "not gifted" bucket).
2. `/m/submissions` **[LOCAL+DB for the read-back]** — `received → scored → routed`, resolved
   family, UTM incl. `(not set)`.
3. `/m/gt-challenge` **[LIVE]** — KPI row: spend **$8,208** · qualified **12** · CPQL **$684**;
   spend rolled into its workstream, total still $365K.
4. Operator tab **[LIVE]** — "raise Challenge budget" denied (quick callback to the gate).

**Say:**
> "Here's the whole loop in one motion. A parent takes the public quiz — consent first — and gets a
> fit result, never a pass/fail on a child. That submission becomes a lead, gets scored, and routes
> into the right program store on the same backbone — same isolation, spent not re-solved. Its UTM
> is captured honestly, missing UTM shows as 'not set,' never dropped. The spend rolls into its
> workstream and the total still reconciles. And the cost-per-qualified-lead is *measured* — spend
> divided by counted qualified — not a hard-coded constant. If an Operator tries to raise the
> Challenge budget, the gate denies it. One campaign, all four signals."

**Proves:** front-to-back path #2 (public capture→lead→score→route→KPI); single-source CPQL; budget
+ role gate reused. ✂️ Resubmit-idempotency here is fragile on live (in-memory, cross-request) —
demo it `[LOCAL+DB]` or skip; the payment idempotency in §2 already covers the signal.

---

## 7. Open Data changes a decision + the required failure — 8:10–8:50 · [LIVE]

**Do:** `/m/decisions` → the $18K guerrilla decision → recommendation flips `pilot → approve`
because **Open Data** shows large gifted pools in C/D/F-rated Austin/Dallas districts, **CPQL ~$41
vs $63 blended**. Then show the degrade-to-fixture path (cache → live → stale → fixture).

**Say:**
> "External public-school data isn't decoration — it changes a call. This $18K decision flips from
> 'pilot' to 'approve' because Texas Open Data shows large gifted pools in lower-rated Austin and
> Dallas districts, at about $41 per qualified lead versus $63 blended. And here's a real failure
> path: when the live query is unavailable it degrades — cache, then live, then stale, then a
> fixture — instead of lying or blanking."

**Proves:** Signal 5 / Open-Data-changes-a-decision; failure/edge #2.

---

## 8. Honest close — 8:50–9:30 · [either]

**Say:**
> "To be clear about the stand-ins: the GT Challenge persistence here is an in-memory contract —
> consent gate, idempotent replay, and UTM honesty are all real — with the database migration
> specced as the named next step. Meta, GA4, and summer.gt.school are seeded behind the same
> interfaces, and labeled. The live link runs dev-auth; the CSP ships report-only first. Where I
> went further: an append-only audit trail — who, when, what — written in the same transaction as
> the ruling and enforced by a least-privilege grant; the role-aware, cited Ask-the-Hub agent; and
> rate-limited public capture. `npm run
> verify` is the pure gate — 423 tests, nothing faked green. With another week: the GT Challenge DB
> adapter, browser end-to-end for the demo path and Home drag, and the live integration suite.
> Thanks for watching."

---

## Coverage matrix — nothing the brief asks for is missed

| Brief requirement / your ask | Segment |
|---|---|
| Phase 1 wired / everything connected | §2 spine · §6 GT Challenge (two front-to-back paths) |
| Hard gates: RBAC + Leader-only Decision Queue | §1 dev-auth · §3 (Operator→/forbidden + 403 JSON) |
| Security / data leaks (program isolation) | §3 cross-program write **rejected** by RLS + `ProgramScopeError` |
| Data: real vs stood-in, cited to source | §4d citations · §4e honest stand-in · Appendix fidelity table |
| Roles (3, enforced) | §1 · §3 · §6 callback |
| Executive summary / weekly status | §4a Exec Verdict Board |
| Dashboards | §4d weekly scorecard · §5 composable Home |
| The Hub (composable per-user) | §5 Home widget library + starter pack |
| Rubrics / agent harness graphs / evals / logs | §4b rubric · §4c graph + evals + logs |
| Citations linked to tab + source | §4d `⛁ Source` drill-down |
| Signal: payment propagates, no contamination | §2 |
| Signal: budget reconciles to total | §5 (live edit + variance→DQ) |
| Signal: role denied Decision Queue | §3 |
| Signal: data-confidence banner on parity drop | §3 (live banner) + §4e (parity cited) |
| Open Data query that changes a decision | §7 |
| ≥1 failure/edge case | §2 idempotent no-op · §3 403 · §7 Open Data degrade (three) |
| Challenger campaign end-to-end | §6 |
| Extras (going further, noticed) | §8 audit trail · Ask-the-Hub · rate limiting |
| Sequencing judgment (deep vs stubbed & why) | §1 frame line |

---

## Appendix A — metric fidelity table (so you narrate each accurately)

| Stage · metric | Cited source | Reality | Say it as |
|---|---|---|---|
| Conversion · `deposits` | Supabase app_form | **REAL** | live, cited |
| Acquisition · `applicants` | Supabase app_form | **REAL** | live, cited |
| CRM Ops · `parity_pct` | HubSpot | **REAL** | live, cited |
| Advocacy · `ambassador_influenced` | HubSpot seed | **REAL** series | live, cited |
| Awareness · `conversion_top_channel` | GA4 | **REAL, low-confidence** (UTM drift) | "honestly flagged low-confidence" |
| Dashboard · `event_to_consult` | Manual | **STAND-IN** (fixed) | "manual stand-in, uninstrumented" |
| Nurture · `sla_24h` ("67 late") | (shows HubSpot) | **STAND-IN** from seed | "deterministic stand-in, not a live read" |
| Activation · `engagement_hotwarm` | (shows HubSpot) | **DERIVED** from lead_score | "derived from lead-score bands, no weekly series" |
| Acquisition · CPQL drivers | "estimated" | **authored constants** | "illustrative figures, not computed" |

> Note for honesty: the SLA / engagement / referral cells currently cite "HubSpot" even though
> they're seed-derived. **Narrate them as stand-ins** (as scripted in §4e) — don't click their
> `⛁ HubSpot` source link on camera, since it points at the live connector. (If you later run the
> "fix integrity gaps" pass, this caveat goes away and you can click freely.)

## Appendix B — do NOT claim (a grader will check)
- ❌ "Watch a payment propagate" over the **live** URL → it shows `seed-fixture`. Say it on `[LOCAL+DB]`, or "proven by `payments.test.ts`."
- ❌ "Real-time / bidirectional sync is live" → "built and tested; this URL runs with no DB attached."
- ❌ "Production-ready / secure" → "a 48-hour demo; production needs an IdP, a provisioned DB, and CSP flipped to enforcing."
- ❌ "GT Challenge is fully wired end-to-end" → "the contract is end-to-end and tested; persistence here is in-memory, the DB adapter is the named next step."
- ❌ "The banner appears when I edit parity" on live → the banner renders from seed; the *toggle* is `[LOCAL+DB]` / tested.
- ❌ Ask-the-Hub *agent* citations "link to the module tabs / name the connector" → they link to `/help` guides and cite the spec doc. The tab+connector citations live in `MetricCite` and the Status Ask strip.
