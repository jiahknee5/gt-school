# GT Marketing Hub — Product Specification

**v2**

Prepared for: Developer Competition Teams + Logan (Developer)
Prepared by: GT School Marketing (Marketing Lead)
Date: June 26, 2026
Status: Approved for development

## 1. Product overview

### What is it

The GT Marketing Hub is a centralized web application where every GT Anywhere marketing function — grassroots, content, nurture, operations, events, admissions, summer camp — has its own module with task tracking, measurable outcomes, and dashboards. Leadership can monitor all functions, provide input (approve decisions, set goals, leave comments), and customize their personal view.

### Who uses it

- Leadership (designated leadership users) — monitor weekly trends, approve decisions, set goals, customize their Home dashboard
- Marketing operators (the Marketing Lead, the Content Owner, the Grassroots Owner, the Field & Events Owner, the Admissions Owner) — manage their workstreams, track tasks, report outcomes, raise decisions
- Each user has a personal Home view they compose from a widget library
  - Growth Marketing Officer
  - Fractional Chief Marketing Officer
  - Co-founder, GT Anywhere

### Design system

- Brand: GT's "Analog Futurism" visual identity
- Default mode: Light (off-white #FAF7F2 background)
- Dark mode: Toggle available (Navy Deep #002A3A background)
- Typography: Literata (serif, headlines), Inter (sans, UI/body), Inconsolata (monospace, data/metrics) — all Google Fonts
- Colors: Brand Gold #E48B53 (CTAs, accents), Navy Deep #002A3A (headers), Navy Mid #003B5C (buttons, cards), Off-white #FAF7F2 (page bg), Gold 20% #F5DDCD (light card bg)
- Reference: The colors, fonts, and modes listed above are the full brand definition for this exercise — approximate the visual identity from these values (no separate brand guide is provided)

### Tech stack (recommended)

- Framework: Next.js (ideal for Vercel deployment)
- Hosting: Vercel
- Database / auth: TBD (Supabase recommended — already used for GT Anywhere funnel data)
- Data sources: Supabase, HubSpot API, Meta Business Suite API (Facebook + Instagram), X/Twitter API, Google Analytics (GA4), Google Sheets API, summer.gt.school, community.gt.school

## 2. Architecture

### Module list (13 modules)

| # | Module | Owner(s) | Primary data source |
|---|--------|----------|---------------------|
| 1 | Home / Executive Command Center | All (personal) | Aggregates from all modules |
| 2 | Grassroots Engine | the Grassroots Owner | HubSpot + community.gt.school |
| 3 | Content & Thought Leadership | the Content Owner | Google Sheet + HubSpot + Meta Business Suite |
| 4 | Summer Camp | the Content Owner | summer.gt.school + registration form |
| 5 | Nurture & Lifecycle | the Marketing Lead | Supabase app_form + HubSpot |
| 6 | Dashboard / KPI Tracking | the Marketing Lead | Aggregates from all modules + HubSpot dashboards |
| 7 | CRM / Marketing Operations | the Marketing Lead | Supabase + HubSpot |
| 8 | Field Marketing & Events | the Field & Events Owner | Manual entry |
| 9 | Admissions & Voice of Customer | the Field & Events Owner / the Admissions Owner | HubSpot Conversations + manual entry |
| 10 | Budget Tracker | the Budget Owner | Manual entry from function owners |
| 11 | Decision Queue | Leadership only (submit: all) | Manual submission |
| 12 | Resource Library | All | Manual upload + linked docs |
| 13 | Website & Digital Analytics | the Marketing Lead | Google Analytics (GA4) |

### Navigation

- Left sidebar with module list, icon per module
- Top bar: GT logo + "Marketing Hub" + user's name + week-of selector + days-to-cutoff countdown + "+ Add widget" dropdown (on Home only) + Light/Dark toggle
- Each module has its own tab bar for sub-views

### User roles

- Admin (the Marketing Lead) — full access to all modules except Decision Queue decision-making, can edit all workstreams, can submit decisions
- Leader (designated leadership users) — full read access, can customize Home, exclusive access to Decision Queue (view all decisions, approve/reject/respond), can set goals/targets, can comment on any workstream
- Operator (the Content Owner, the Grassroots Owner, the Field & Events Owner, the Admissions Owner) — full access to their own module(s), read access to others, can submit ideas/proposals to Decision Queue from their modules (but cannot view the full queue or act on others' decisions), can edit their workstream rows in the Workstream Health Grid

## 3. Module specifications

### Module 1: Home / Executive Command Center

**Purpose:** Personal, composable dashboard. Each user builds their own Home from a widget library. Leadership's primary monitoring + input surface.

**Widget library:** 32 widgets across 9 categories. Users add/remove via a dropdown picker (compact, scrollable, checkbox per widget, grouped by category, with data source tag per row).

Widget categories and items:

#### Volume & conversion

1. Applicants total + w/w delta — live applicant count from Supabase with weekly trend. Source: Supabase app_form.
2. Deposits vs. Fall goal — progress bar against 180 target. Source: Supabase.
3. Conversion by channel — top 5 sources ranked by applicant-to-deposit %. Source: Supabase.
4. Channel volume mix — where new applicants are coming from this week. Source: Supabase.
5. Volume vs. conversion quadrant — scatter plot flagging volume traps (Facebook) and pre-sold engines (X). Source: Supabase.
6. Deposits per week (8-wk bar) — rolling deposit trend chart. Source: Supabase.

#### Audience & segments

1. T1 / T2 / T3 active counts — tier headcounts with reachability %. Source: Supabase + HubSpot.
2. Engagement tier mix — clicked / opened / cold split with bar visualization. Source: HubSpot.
3. T3 sub-buckets — ESA-planned / ESA-ineligible / no-indicator breakdown. Source: Supabase.
4. Geo mix (TX vs. out-of-state) — 50/50 split tracker. Source: Supabase.
5. Income mix — <$65K / $65-160K / $160K+ distribution. Source: Supabase.
6. Grade mix — K-2 sweet spot vs. dead grades (9-12). Source: Supabase.
7. Top 3 personas by volume — from persona dossier v2. Source: Supabase + dossier.
8. Lead score distribution — histogram of current lead scores. Source: HubSpot.

#### Funnel & pipeline

1. Funnel stages — lead to applicant to shadow to deposit, with drop-off %. Source: Supabase + HubSpot.
2. Pipeline velocity — avg days lead to deposit. Source: HubSpot.
3. Stuck-in-stage — anyone in a stage > N days. Source: HubSpot.
4. 24-hr follow-up SLA — % of new applicants contacted within SLA. Source: HubSpot.

#### Content & engagement

1. Latest email send health — most recent send open / click / unsubscribe. Source: HubSpot.
2. Top content this week — leaderboard by open + click. Source: HubSpot.
3. Content pipeline status — in production / scheduled / live. Source: Google Sheet.
4. Social engagement (FB + IG + X) — latest post engagement. Source: Meta Business Suite (FB + IG) + X/Twitter API.

#### Grassroots & ambassadors

1. Ambassador-influenced enrollments — deposits with ambassador touchpoint. Source: Ambassador DB.
2. P2P calls this week — parent-to-parent call volume. Source: Manual + DB.
3. Events + RSVPs — booked events + RSVP count. Source: Manual.
4. Referral pool size — active referrals in flight from sprints. Source: Ambassador DB.

#### Voice of customer

1. Top objections this week — top 3 from BDR calls + admissions with frequency count. Source: HubSpot Conversations + manual.
2. SMS inbox themes — themes from HubSpot Conversations the GT Anywhere SMS inbox. Source: HubSpot Conversations API.
3. "Haven't heard back" replies — count of follow-up-needed SMS replies. Source: HubSpot Conversations API.
4. Hot families flagged — admissions/ambassador escalations. Source: Manual.
5. Family quote of the week — rotating excerpt from calls/forms. Source: Manual.

#### Narrative & sprint

1. Executive narrative — weekly topline / working / stuck / decisions (4 text fields, editable by the Marketing Lead weekly). Source: Manual.
2. Workstream health grid — one row per workstream with G/Y/R, owner, this week, next week, key metric, decision/ask. Source: Manual + live KPI pull.
3. Decision queue preview — top 2-3 open decisions awaiting leadership. Source: Decision Queue module.
4. Sprint phase tracker — progress bar: Wks 1-2 Build → Launch Grassroots → July Scale → Late-Jul/Aug Push → End-of-Aug Review. Source: Config.
5. Wins log — this-week wins from any workstream. Source: Manual.
6. Risks + blockers — open risk register. Source: Manual.

#### Calendar & budget

1. Days to Aug 17 cutoff — live countdown. Source: Config.
2. Upcoming events — next 30 days from Field Marketing. Source: Manual.
3. Budget burn vs. plan — $ committed / spent / remaining vs. $365K. Source: Manual entry (Budget module).
4. Spend by workstream — pie chart of actual spend. Source: Manual entry (Budget module).

#### Website

1. Website sessions this week — total sessions across gt.school + anywhere.gt.school. Source: Google Analytics.
2. Top landing pages — top 5 pages by traffic. Source: Google Analytics.
3. PDF downloads this week — count + top files. Source: Google Analytics.

**Default starter pack (pre-checked for new users):**

Applicants total, Deposits vs. Fall goal, Conversion by channel, T1/T2/T3 counts, Engagement tier mix, 24-hr SLA, Executive narrative, Workstream health grid

**Customization mechanics:**

- "+ Add widget" button in top bar opens dropdown
- Dropdown: search bar + grouped by category + checkbox per widget + source tag + "Done" button
- Drag-to-reorder widgets on the Home grid
- Each widget can be small (1 col), medium (2 col), or large (full width)
- Layout is private to each user — each person's Home is their own
- Light/Dark mode toggle in top-right nav

**Leadership input surfaces on Home:**

- Decision Queue cards with Approve / Need-info / Reject buttons
- Comments on any Workstream Health row
- Goal/target adjustments

#### Developer reference: Inputs & Outputs

**Inputs:**

- Widget selections per user (stored per user profile)
- Live data feeds from all 12 other modules (aggregated metrics, decision previews, workstream health rows)
- Manual text entry for Executive Narrative, Wins Log, Risks + Blockers

**Expected outputs:**

- Personalized dashboard view (unique per user, saved layout)
- Leadership comments on workstream rows (stored, visible to workstream owners)
- Goal/target adjustments (propagate to Dashboard/KPI module and relevant workstream modules)
- Decision Queue responses — approve / reject / need-info with comment (propagate to Decision Queue module)

### Module 2: Grassroots Engine (the Grassroots Owner)

**Purpose:** Track and manage the parent ambassador program, community outreach, referral sprints, market mapping, and parent community — all grassroots growth activity.

Sub-views (tabs):

#### 2a. Overview

Composable dashboard (same widget-picker pattern as Home, scoped to grassroots widgets).

**Default widgets:**

- Goal tracker — 4 progress bars: X/25 ambassadors active, X/200 warm intros generated, X/50 P2P calls completed, X/30 influenced enrollments
- Ambassador-influenced enrollments — running total + attribution
- Active ambassadors by segment
- P2P calls this week
- Events booked + RSVPs
- Referral pool size (current sprint)
- Testimonials feed — short clips logged for social handoff
- Hot families surfaced — flagged via ambassador
- Market map outreach status — nodes contacted / in-flight / closed

#### 2b. Ambassador roster

CRM-style list of ambassadors with a status pipeline.

**Pipeline stages:** Prospect → Outreached → Onboarded → Active → Champion

**Filters:** segment, persona, status, region, last-touch

**Row columns:** name, segment, status, intros made, P2P calls, last touch, owner

**Detail drawer:** profile + activity log + assigned families

**Bulk actions:** send toolkit, request testimonial, assign segment

#### 2c. Market map

Priority market map of gifted-family nodes. Categories pre-loaded:

- Parent groups, homeschool groups, chess clubs, robotics teams, debate clubs, math circles, science fair networks, private tutors, educational psychologists, testing centers, therapists who work with gifted kids, pediatricians, enrichment centers, local influencers

Each node: contact, status (cold / outreach / in-conversation / active / closed), leads generated, last activity, owner

**View toggle:** category grid or geo map

#### 2d. Referral sprints

2-week sprint cards — the Grassroots Owner defines a sprint window and enlists ambassadors.

**Active sprint card:** window dates, ambassadors enlisted, families identified, conversions

**Sprint history:** archived sprints with results

"Launch new sprint" CTA

#### 2e. Parent community

- Parent-ed event attendance
- Active parents (engaged in any community channel)
- Retention pulse / NPS (if instrumented)
- Forum / community channel activity

#### 2f. Parent-led event calendar

Calendar view of all parent-organized and parent-led events. This is a dedicated calendar showing events created and hosted by ambassadors/parents (coffee chats, Q&As, school visits, virtual sessions). Feeds into the hub-wide marketing calendar but lives here as the source of truth for ambassador events.

Each event: event name, host ambassador, date, location, type (coffee chat / Q&A / school visit / virtual), materials requested, GT support needed, RSVP count, attendance, follow-up families, conversions influenced.

**Note on parent ambassador events:** Ambassadors may create their own events (GT provides support/materials). These events are created and tracked here in the Grassroots module, NOT in Field Marketing. the Field & Events Owner's Field Marketing module gets a read-only cross-link for visibility.

**Data sources:**

- Ambassador list, status, segments: HubSpot (the ambassador-tracking property) + community.gt.school (dual source — must read from both and reconcile)
- Ambassador-influenced enrollments: Supabase app_form joined to ambassador attribution
- P2P calls, events, testimonials, market map: Manual entry (the Grassroots Owner)
- Hot families: Manual entry, flows to Admissions/VoC + Decision Queue

**Leadership input:** Approve toolkit/event budgets via Decision Queue. Comment on goal progress.

**Cross-module links:**

- Ambassador-hosted events live HERE; Field Marketing reads them read-only
- Testimonials logged here auto-create a stub asset in Content & Thought Leadership
- Hot families push into Admissions/VoC + Decision Queue if flagged urgent
- Parent-led event calendar feeds the hub-wide marketing calendar

#### Developer reference: Inputs & Outputs

**Inputs:**

- Ambassador records from HubSpot (the ambassador-tracking property) + community.gt.school (dual source — must reconcile)
- Supabase app_form for enrollment attribution (which deposits had ambassador touchpoint)
- Manual entry: P2P call logs, event details, testimonial clips, market map node updates, hot family flags (all entered by the Grassroots Owner)

**Expected outputs:**

- Ambassador pipeline status board (Prospect → Outreached → Onboarded → Active → Champion) with counts per stage
- Referral sprint results (families identified, conversions per sprint, sprint-over-sprint trend)
- Warm intro count (running total against 200 target)
- Market map outreach progress (nodes contacted / total by category, coverage %)
- Parent-led event calendar (all ambassador-hosted events with dates, RSVPs, attendance, conversions)
- Testimonial assets (auto-stub → Content & Thought Leadership module for the Content Owner's pipeline)
- Hot family flags (→ Admissions/VoC module + Decision Queue for leadership attention)
- Ambassador-influenced enrollment count (running total against 30 target, with attribution chain)
- Goal progress dashboard (4 progress bars: ambassadors, intros, P2P calls, influenced enrollments)

### Module 3: Content & Thought Leadership (the Content Owner)

**Purpose:** Track editorial calendar, content production pipeline, content performance, and thought leadership cadence. Does NOT include summer camp content (that's Module 4).

Sub-views (tabs):

#### 3a. Overview

Composable dashboard.

**Default widgets:**

- Productions in flight — count + on-track ratio
- This-week publish schedule
- Top-performing content this week (leaderboard)
- Substack subscribers + growth
- X/Twitter engagement this week (X is the 42% conversion engine)
- Facebook + Instagram engagement this week (from Meta Business Suite)
- Above Grade Level podcast — episodes shipped, listens
- Content-to-conversion — which pieces drove applicants (UTM attributed)
- Founder content in flight — Pam / Joe / advisors
- Recently captured testimonial assets (flowing from Grassroots)
- Brand voice suggestion count — drafts with auto-suggested edits

#### 3b. Production pipeline

Kanban board.

**Columns:** Concept → In production → Review → Scheduled → Published

**Card fields:** name, owner, type (video / podcast / article / social / email), due date, deliverable link, attachments

**Filters:** channel, owner, persona target, status

**Pre-loaded productions (from planning sheet):** Sizzle Reel for Joe, AGL podcast with Pam, Advisor Series, Thailand videographer, Family Interviews x5, Summer Camp posts (cross-linked to Module 4)

**Production sync:** the Content Owner currently tracks in Google Sheets. The Hub syncs from the sheet (read + write) so neither system is orphaned.

#### 3c. Content calendar

Month grid editorial calendar, color-coded by channel (Substack, X, Instagram, Facebook, Podcast, Email, YouTube).

Drag to reschedule.

Conflict indicator if too many things ship same day.

#### 3d. Performance

Per-piece metrics: reach, click, conversion attribution (Supabase via UTM where instrumented).

Channel breakdown: X/Twitter (42% conversion), Facebook, Instagram, Substack, podcast, email.

Top + bottom performers. "What worked" themes.

#### 3e. Content library

Searchable archive of published pieces. Tags: persona, tier, channel, type, format.

v1 = flat library, no repurposing flags (deferred to v2).

**Brand voice auditor:** Operates in "suggest edits" mode — when a draft is uploaded or linked, the system auto-generates inline rewrite suggestions aligned with GT's brand voice. Not blocking; suggests, doesn't gate.

**Data sources:**

- Production status, owner, due dates: Google Sheet (synced)
- Substack subs + posts: Manual v1 (API later)
- Facebook / Instagram engagement: Meta Business Suite API
- X/Twitter engagement: X/Twitter API (separate from Meta)
- Email content performance: HubSpot
- Podcast listens: Manual v1
- Conversion attribution per piece: Supabase app_form x UTM

**Leadership input:** Approve/kill production concepts. Raise content briefs through Decision Queue. Approve founder appearances + travel.

**Cross-module links:**

- Testimonials from Grassroots → auto-stub production card here
- Top objections from Admissions/VoC → auto-create "answer this in content" brief
- Summer Camp content stays in Module 4; read-only cross-link here for visibility

#### Developer reference: Inputs & Outputs

**Inputs:**

- Google Sheet (the Content Owner's production tracking spreadsheet — synced read + write)
- HubSpot (email send performance: open, click, unsubscribe per email)
- Meta Business Suite API (Facebook + Instagram engagement: reach, impressions, likes, comments, shares, saves, clicks)
- X/Twitter API (engagement: impressions, engagements, engagement rate, link clicks, profile visits)
- Supabase app_form × UTM parameters (conversion attribution — which content piece led to an application)
- Content brief stubs from Admissions/VoC module (auto-generated from top objections)
- Testimonial stubs from Grassroots module (auto-created when the Grassroots Owner logs a testimonial)
- Manual entry: Substack subscriber count, podcast listen counts, founder content status

**Expected outputs:**

- Production pipeline kanban (concept → in production → review → scheduled → published) with card-level detail
- Content calendar (month grid, color-coded by channel, with scheduling + conflict detection)
- Per-piece performance metrics (reach, clicks, conversion attribution per content item)
- Channel performance table (X, Facebook, Instagram, Substack, Email, Podcast — side-by-side metrics)
- Brand voice audit suggestions (inline rewrite recommendations on uploaded drafts)
- Published content library (searchable archive with persona/channel/type tags)
- Top + bottom performer rankings (which content is working, which isn't)
- Content-to-conversion report (which pieces actually drove applications, via UTM)

### Module 4: Summer Camp (the Content Owner)

**Purpose:** Track GT summer camp registrations, capacity, content, and revenue across 4 campuses. Separate audience and timeline from the main Fall enrollment push.

**Camp structure (Summer 2026):**

- 3 campuses running 2-week sessions
- 1 campus running a 1-week session
- Each campus has its own capacity, roster, and waitlist

Sub-views (tabs):

#### 4a. Overview

Composable dashboard.

**Default widgets:**

- Capacity sold — % of seats filled (aggregate + per campus)
- Registrations this week
- Paid vs. lead conversion — registered-to-paid rate
- Days to camp start — countdown
- Top channel for camp signups
- Camp content shipped this week
- Revenue vs. target
- Waitlist / overflow count

#### 4b. Registration funnel

Stages: Lead → Registered (unpaid) → Paid → Attended

Drop-off % per stage. Slice by campus / age group. Filter by source.

#### 4c. Content + campaigns

Camp-only content pipeline (mirrors Module 3, filtered to summer-camp tag).

Active email sequences for camp. Active social pushes. Posts: guide interviews, pilot outcomes, welcome kit content.

#### 4d. Sessions (campus cards)

4 campus cards, each showing: campus name, session dates, duration (1wk or 2wk), capacity, registered, paid, waitlist.

Drill-in: roster + attendance.

**Registration data sources:**

- summer.gt.school — custom GT-built registration app. Primary source of truth for registrations + payments.
- Registration form — alternate intake path (likely Supabase-backed).
- Both must be read and reconciled to avoid double-counting.

No paid acquisition view. Paid ads are paused across all GT marketing, including camp.

**Revenue tracking:** Revenue collected vs. target. Revenue per registered family. Revenue by campus.

**Leadership input:** Approve camp pricing or session changes. Approve adding/closing a session.

**Cross-module links:**

- Camp content archives back to Module 3's library when retired
- Camp is a separate P&L line — does not roll into Module 10 budget (unless leadership decides otherwise)

#### Developer reference: Inputs & Outputs

**Inputs:**

- summer.gt.school registration app (registrations, payments, roster data — primary source of truth)
- Registration form (alternate intake path, likely Supabase-backed — must reconcile with summer.gt.school to avoid double-counting)
- Manual camp content entries (from the Content Owner)

**Expected outputs:**

- Per-campus capacity dashboards (4 campuses: capacity filled %, registered vs. paid, waitlist count)
- Registration funnel with drop-off % per stage (Lead → Registered → Paid → Attended), sliceable by campus and age group
- Revenue collected vs. target (aggregate + per campus)
- Camp-specific content pipeline (filtered subset of Content module's kanban)
- Waitlist counts and overflow alerts
- Top registration channel breakdown (word of mouth, social, email, website — by %)

### Module 5: Nurture & Lifecycle (the Marketing Lead)

**Purpose:** Manage lead segments, email/SMS sequences, engagement tracking, follow-up SLA, and the full contact/child pipeline from lead through onboarding handoff. The most data-rich module — engagement tier is the top conversion predictor (clicked → 52% commit vs. never-clicked 16%).

Sub-views (tabs):

#### 5a. Overview

Composable dashboard.

**Default widgets:**

- T1 / T2 / T3 active counts + reachability
- Engagement tier mix — clicked / opened / cold
- Latest email send health — open / click / unsubscribe
- 24-hr SLA — % new applicants contacted in window
- SMS reply count this week (from the GT Anywhere SMS inbox)
- Top sequence performer — which active sequence is converting
- Cold segment count — never-opened bucket size
- Persona x engagement crosstab — which personas are warming
- Pipeline stage distribution — parent contacts by stage
- Marketing → onboarding handoff count this week

#### 5b. Segments

T1 / T2 / T3 panel:

- T1: messaging-stage cohort (Pamela Hobart + the Marketing Lead own messaging)
- T2: ~3,100 families — email-driven conversion sprint, sales reps assigned ~323 families each, geo-targeting for TX subset
- T3: 1,124 waitlist — 3 sub-buckets: ESA-planned, ESA-ineligible, no indicator. Out-of-pocket segment is largest impact.

**Note on TEFA segments:** TEFA school-selection closed June 1, 2026. The TEFA cohort is frozen until ~2027. TEFA-specific segments are retained as historical reference only. Active segmentation focuses on broader audience attributes (engagement tier, income, geography, grade, persona) beyond the TEFA subset.

**Engagement-tier x attribute matrix:**

Heatmap — rows = engagement tier (clicked / opened / cold), columns = attribute (income / geo / persona / grade). Color shows conversion %.

Key insight baked in: income is the master variable ($160K+ = ~25% conversion regardless of geography). Grade K-2 is the sweet spot (609 apps). Conviction tell = "I follow Alpha on X" (27.4%).

**Segment builder:** pick attribute x engagement combos to create custom audiences for sequences.

#### 5c. Pipeline stages

Parent contact pipeline and child pipeline from HubSpot. This is a core view showing where every contact sits in the journey.

Parent contact pipeline stages: (from HubSpot deal/contact pipeline)

- Displays current stage for each parent contact
- Stage distribution bar (how many contacts at each stage)
- Stuck-in-stage alerts (contacts in a stage > N days)
- Stage velocity (average time per stage)

Child pipeline stages: (from HubSpot)

- Each child record's pipeline stage (separate from parent)
- Parent-child linkage view (parent at stage X, their child at stage Y)

Marketing → Onboarding handoff:

- Count of deals/contacts handed off from marketing to onboarding (weekly, monthly, cumulative)
- Handoff conversion rate (of contacts marketing sends to onboarding, how many actually onboard)
- Handoff velocity (average days from first marketing touch to handoff)

#### 5d. Sequences

Read-only from HubSpot. HubSpot builds and runs every sequence. This view shows:

- Active sequences listed by type: welcome / nurture / re-engagement / event / waitlist
- Per-sequence: audience size, step count, open/click/conversion per step
- Sequence health flag if performance drops below threshold

#### 5e. SMS inbox

Threads from HubSpot Conversations inbox the GT Anywhere SMS inbox (GT Anywhere inbox — (a few hundred threads across ~one hundred-plus responders)).

**Filters:** unread / "haven't heard back" / objection / hot-family

**Auto-theme tagging:** v1 = keyword rules (message contains "cost/price/tuition" → tag Tuition, etc.). v2 = layer LLM classification for messages keywords miss.

Quick reply with template snippets.

Flag-to-hot-family action → pushes to Admissions/VoC + Decision Queue.

#### 5f. SLA tracker

Real-time: applicants entering funnel today, % contacted in 24h.

Late-list: anyone past 24h still uncontacted (red list).

Owner-attributable: shows who's behind on follow-up.

Historical SLA chart (last 30 days).

**Data sources:**

- Funnel / TEFA / income / grade: Supabase app_form (source of truth — NOT HubSpot field values, which are unreliable for TEFA/income/source)
- Pipeline stages (parent + child): HubSpot deal pipeline + contact pipeline
- Engagement (open/click): HubSpot
- Lead score: HubSpot (read-only)
- Sequences: HubSpot (read-only)
- SMS threads: HubSpot Conversations API (the GT Anywhere SMS inbox)
- Persona tag: Supabase + Persona Dossier v2
- Tier assignment: Manual + rule-based
- Onboarding handoff: HubSpot deal stage transitions

**Leadership input:** Approve/kill a sequence. Comment on SLA misses. Flag a thread for personal response.

**Cross-module links:**

- Hot families flagged here → Admissions/VoC + Decision Queue
- Top objections in SMS → Content brief auto-stub in Module 3
- Conversion attribution per piece feeds Module 3 Performance
- Pipeline stage data feeds Dashboard/KPI module
- Handoff count feeds Dashboard/KPI as a core metric

#### Developer reference: Inputs & Outputs

**Inputs:**

- Supabase app_form (funnel data, TEFA status, income, grade — source of truth; NOT HubSpot field values for these)
- HubSpot engagement data (email open/click per contact, sequence enrollment + step completions)
- HubSpot deal pipeline (parent contact pipeline stages, child pipeline stages, deal stage transitions)
- HubSpot lead scores (read-only: the lead-score property, the lead-score threshold property)
- HubSpot Conversations API inbox the GT Anywhere SMS inbox (SMS threads (a few hundred threads across ~one hundred-plus responders))
- HubSpot sequences (read-only: active sequences, per-step performance)
- Persona Dossier v2 (persona tag assignment per contact)
- Manual tier assignment rules (T1/T2/T3 definitions)

**Expected outputs:**

- T1/T2/T3 segment panels with sub-buckets and reachability % (broader than TEFA — covers engagement tier, income, geo, grade, persona)
- Engagement-tier × attribute heatmap (conversion % by segment intersection — the top conversion predictor)
- Pipeline stage distribution (parent contacts + children by HubSpot pipeline stage, with stuck-in-stage alerts)
- Marketing → onboarding handoff count (weekly, monthly, cumulative — how many deals marketing completed)
- Handoff conversion rate (% of handoffs that successfully onboard)
- Sequence health reports (read-only from HubSpot: per-sequence open/click/conversion, health flags)
- SMS auto-theme tags (tuition, accreditation, scheduling, "haven't heard back," ready to enroll, etc.)
- SLA compliance report (% of new applicants contacted within 24hr, late-contact list, owner-attributable breakdown)
- Hot family flags (→ Admissions/VoC module + Decision Queue)
- Objection themes from SMS (→ Content brief stubs for the Content Owner's pipeline)
- Cold segment alert (count of contacts who never opened — trigger for re-engagement sequence)

### Module 6: Dashboard / KPI Tracking (the Marketing Lead)

**Purpose:** The canonical, shared scorecard. Where Home is personal, this is the fixed board everyone references in the Monday meeting. "Are we hitting our numbers" — versioned by week.

Also available as a Home widget — the scorecard table can be added to any leader's Home via the widget picker, so they don't have to navigate to this module to see it.

Sub-views (tabs):

#### 6a. Scorecard

The canonical weekly KPI table (shared, identical for all users).

One row per metric: this week / last week / delta / 4-wk trend sparkline / target / status (on-track / watch / at-risk).

Core metrics: applicants, deposits, conversion by top channel, engagement-tier mix, 24-hr SLA, objections logged, event-to-consult, ambassador-influenced enrollments, marketing → onboarding handoffs.

#### 6b. Trends

Line charts per KPI, selectable, 4 / 8 / 12-week windows.

Compare two metrics on one chart.

Event annotations deferred to v2.

#### 6c. SLA & ops health

24-hr follow-up SLA — current + 30-day chart, owner-attributable.

Event-to-consult conversion — currently uninstrumented; flagged as a gap; manual entry v1.

Tracking gaps register — known measurement holes (UTM broken, events untracked, SMS send-rate via Reconnectext unmeasurable).

#### 6d. Goal pacing

Each Fall target with required weekly run-rate vs. actual run-rate.

"At this pace you'll land at X by Aug 17" projection.

Per-workstream goal pacing (ambassador goals, content goals, etc.).

#### 6e. HubSpot dashboard mirror

Synced views of existing HubSpot reports and dashboards within the Hub. Pulls data from HubSpot's reporting API to mirror saved dashboard widgets, report data, and saved filters — so leadership doesn't need to log into HubSpot separately.

**Goals/targets:** Set by leadership. Every marketing function has its own goals — already defined. These are input fields leadership can edit; changes are logged.

**Data sources:** Aggregates from each module's primary metric. SLA from HubSpot. Data freshness from each connector's last-sync timestamp. Goals/targets from config (leadership-editable). HubSpot Reporting API (for dashboard mirror).

**Cross-module note:** This module READS from all others — it doesn't own data. Every number's source of truth is its home module.

#### Developer reference: Inputs & Outputs

**Inputs:**

- Aggregated metrics pulled from every other module's primary data source (applicants from Supabase, engagement from HubSpot, ambassador data from Grassroots, etc.)
- Leadership-editable goal/target values (stored in Hub config, editable by designated leadership users)
- HubSpot Reporting API (existing HubSpot dashboards and saved reports)
- Pipeline stage + handoff data from Nurture module
- Each connector's last-sync timestamp (for data freshness indicators)

**Expected outputs:**

- Canonical weekly scorecard (shared, identical for all users — one row per KPI with this week / last week / delta / trend / target / status)
- KPI trend charts (4 / 8 / 12-week windows, selectable, with compare-two-metrics option)
- Goal pacing projections ("at this pace → X by Aug 17" per metric)
- SLA & ops health view (24-hr SLA current + 30-day chart, owner-attributable, tracking gaps register)
- HubSpot dashboard mirror (synced views of existing HubSpot reports within the Hub)
- "Biggest mover" and "red flags" callout cards (auto-identified from weekly delta data)
- Data freshness indicators (last sync per connector — Supabase, HubSpot, Meta, etc.)

### Module 7: CRM / Marketing Operations (the Marketing Lead)

**Purpose:** Data infrastructure health. UTM attribution, lead scoring visibility, Supabase-HubSpot sync parity, data quality queue.

Sub-views (tabs):

#### 7a. Overview

Composable dashboard.

**Default widgets:**

- Sync parity score — % of records matching Supabase to HubSpot (~98% overall, but specific fields unreliable)
- UTM attribution health — % of leads with valid UTM resolution (currently broken — permanent red flag until fixed)
- Lead score distribution — histogram of the lead-score property
- Open data quality issues — queue count
- Last sync timestamps — per connector
- Field reliability flags — which HubSpot fields are unreliable (e.g. TEFA, income, source). Treat the specific unreliable fields as a modeling decision you make and document

#### 7b. Source tracking

UTM parameter health: % of new leads with each UTM tag resolved (source / medium / campaign / content).

Broken UTM drill-in: leads with missing or malformed UTMs.

Attribution chain visualization: how a lead's source gets from form submission → Supabase → HubSpot.

Fix log: UTM fixes applied, when, by whom.

#### 7c. Lead scoring

Read-only from HubSpot. Hub displays, does not edit.

Current scoring model: which properties/behaviors contribute to the lead-score property and the lead-score threshold property.

Score distribution histogram. Score tier breakdown. Score-to-conversion correlation (validates model).

Change log: when scoring rules were last updated.

#### 7d. Sync parity

Overall parity: X% of records in sync.

Field-level parity: for each synced field, % matching.

Known unreliable fields flagged: TEFA status, income, source.

Drift alerts: fields falling below threshold.

Rule of truth reminder: "Supabase app_form is the source of truth for funnel/TEFA/income" — visible on the page, always.

#### 7e. Data quality queue

Open issues: description, severity, owner, created date.

Categories: UTM, sync, scoring, tracking, other.

Resolution log: closed issues with fix description.

Auto-detection (v1): System auto-detects sync drift + UTM breakage and creates queue items automatically. Not manual-only — auto-detect is the core value of this module.

**Leadership input:** Approve a scoring model change. Acknowledge a data quality issue. Prioritize a fix.

**Cross-module links:**

- Sync parity feeds all modules' data confidence — if parity drops, all modules show a "data confidence warning" banner
- UTM health impacts Module 3 (Content performance) and Module 5 (Nurture attribution)
- Lead scoring feeds Module 5 (Nurture segments) and Module 6 (KPI scorecard)

#### Developer reference: Inputs & Outputs

**Inputs:**

- Supabase app_form (all synced fields — the source of truth for funnel/TEFA/income)
- HubSpot contact records (all synced properties, lead scores: the lead-score property, the lead-score threshold property)
- UTM parameters from form submissions (captured at form level, resolved through Supabase → HubSpot chain)
- Each connector's sync status and last-sync timestamp

**Expected outputs:**

- Sync parity score (overall % + field-level % matching between Supabase and HubSpot)
- UTM health report (% valid per parameter: source, medium, campaign, content — with drill-in to broken/missing UTMs)
- Lead score distribution histogram + score-to-conversion correlation table
- Data quality issue queue (auto-detected sync drift + UTM breakage + manually filed issues, with severity/owner/status)
- Data confidence warning banners (→ broadcast to ALL other modules if sync parity drops below threshold)
- Attribution chain visualization (form → Supabase → HubSpot flow with status indicators per step)
- Fix/resolution log (closed issues with fix description, who, when)
- Field reliability flags (which HubSpot fields are unreliable — TEFA, income, source — always visible)

### Module 8: Field Marketing & Events (the Field & Events Owner)

**Purpose:** Track and manage GT-organized external events — Shadow Days, chess tournaments, AMAs, community events, festivals. Does NOT include ambassador-hosted events (those live in Module 2 Grassroots, with read-only cross-link here).

Sub-views (tabs):

#### 8a. Overview

Composable dashboard.

**Default widgets:**

- Upcoming events (next 30 days)
- Events completed this month
- Total RSVPs vs. attendance
- Event-to-consult conversion (manual entry v1)
- Top event type by attendance

#### 8b. Event tracker

List view of all events: name, type (Shadow Day / chess / AMA / community / festival / webinar), date, venue, RSVP count, attendance, consults booked, owner, status (planning / confirmed / completed / cancelled).

**Filters:** type, date range, status, owner.

**Detail view:** full event card with notes, materials, budget, follow-up actions.

#### 8c. Calendar

Month grid of all events, color-coded by type.

Includes read-only cross-link to ambassador-hosted events from Module 2.

#### 8d. Priority events recommendation

the Field & Events Owner proposes events → leadership approves via Decision Queue.

**Recommendation card:** event name, type, date, rationale, expected attendance, budget ask, target persona.

**Event-to-consult tracking:** Currently uninstrumented. v1 = manual entry per event ("how many RSVPs booked a consult?"). Auto-tracking deferred.

**Ambassador-hosted events:** Created and tracked in Module 2 (Grassroots). the Field & Events Owner's module shows read-only cross-link for visibility. The Grassroots module supports ambassador event creation with fields for: event name, host ambassador, date, location, type (coffee chat / Q&A / school visit / virtual), materials requested, GT support needed, RSVP count, attendance, follow-up families, conversions influenced.

**Data sources:** Manual entry. No API to wire v1.

**Leadership input:** Approve event proposals via Decision Queue. Set event budget.

#### Developer reference: Inputs & Outputs

**Inputs:**

- Manual entry by the Field & Events Owner: event name, type, date, venue, RSVP count, attendance, consults booked, status, notes, materials, budget
- Read-only ambassador event cross-link from Grassroots module (Module 2) — for calendar visibility only

**Expected outputs:**

- Event tracker table (all events with full detail: name, type, date, venue, RSVPs, attendance, consults, owner, status)
- Monthly event calendar (color-coded by event type, includes ambassador events as read-only overlay)
- Event-to-consult metrics (manual v1: consults booked per event, conversion rate RSVPs → consults)
- Priority event recommendation cards (→ Decision Queue for leadership approval, with event name, rationale, expected attendance, budget ask, target persona)
- Top event type analysis (which event types drive the most attendance and consults)

### Module 9: Admissions & Voice of Customer (the Field & Events Owner / the Admissions Owner)

**Purpose:** Track admission pipeline numbers, surface family objections, and close the feedback loop from admissions back to marketing. "What are families actually saying, and what content do we need to answer it?"

Sub-views (tabs):

#### 9a. Overview

Composable dashboard.

**Default widgets:**

- Admission numbers — applicants, Shadow Days completed, offers extended, deposits (by week)
- Top 3 objections this week with frequency
- Objection theme trend (4-week)
- Feedback-to-marketing items open
- Notable family quotes
- Objection-to-resolution time (how fast does marketing respond with content)
- Content bridge hit rate (of briefs sent to the Content Owner, how many got produced)

#### 9b. Objection log

Every surfaced objection tagged by:

- Theme: accreditation / cost / "is my kid gifted enough" / scheduling / curriculum / social / tech requirements / other
- Frequency count (this week + cumulative)
- Trend: ↑ increasing / → stable / ↓ decreasing (4-week comparison)
- Source: BDR call / SMS / event / form / other
- Example verbatim quote

Sortable by frequency. Filterable by theme, source, date range.

#### 9c. Objection-to-content bridge

Top objections auto-generate a content brief stub in Module 3 (Content & Thought Leadership).

Brief fields: objection theme, verbatim examples, suggested content angle, target persona, urgency.

the Content Owner sees these in her production pipeline as "brief from admissions."

Tracking: bridge hit rate — of all briefs sent, how many resulted in published content, and did the objection frequency decrease afterward.

#### 9d. Voice of Families

Qualitative feed: notable quotes, sentiment themes, escalations.

Rotating "quote of the week" (also available as a Home widget).

Family sentiment score: positive / negative / neutral ratio over time (tracked per week).

#### 9e. Feedback-to-marketing loop

the Field & Events Owner/the Admissions Owner flag "marketing needs to know X" → appears as a chip in the Marketing Lead's Nurture module + Decision Queue if actionable.

Categories: messaging gap / persona mismatch / objection pattern / positive signal / urgent.

Closure rate: of items flagged, how many were actioned within 7 days.

**Data sources:**

- HubSpot Conversations inbox (SMS/chat threads — primary)
- BDR call notes (manual entry — calls will be less frequent but still occur)
- Event follow-up notes (manual, from the Field & Events Owner)
- Application form comment fields
- Shadow Day feedback surveys
- Read.ai transcripts (optional/secondary — available if calls are recorded, but not a primary input)

**Leadership input:** Comment on objection patterns. Prioritize content brief responses.

#### Developer reference: Inputs & Outputs

**Inputs:**

- HubSpot Conversations inbox (SMS/chat threads — primary source of family voice data)
- BDR call notes (manual entry by the Field & Events Owner/the Admissions Owner — less frequent but still occurring)
- Event follow-up notes (manual, from the Field & Events Owner after each event)
- Application form comment fields (free-text from Supabase app_form)
- Shadow Day feedback surveys (manual or form-based)
- Read.ai transcripts (optional/secondary — available when calls are recorded)

**Expected outputs:**

- Objection frequency dashboard (objection theme × week, with trend arrows ↑→↓ and 4-week comparison)
- Objection log table (theme, frequency, trend, source, example quote — sortable + filterable)
- Content brief stubs (auto-generated → Content & Thought Leadership pipeline for the Content Owner; fields: objection theme, verbatim examples, suggested angle, target persona, urgency)
- Content bridge hit rate (of briefs sent to Content, how many got produced? Did the objection frequency decrease afterward?)
- Objection-to-resolution time (days from objection first surfaced → content published to address it)
- Family sentiment score (positive / negative / neutral ratio, trended per week)
- Family quotes feed + rotating quote of the week (→ also available as Home widget)
- Feedback-to-marketing items with closure rate (of items flagged → items actioned within 7 days)
- Admission pipeline numbers (applicants, Shadow Days completed, offers extended, deposits — by week)

### Module 10: Budget Tracker (the Budget Owner)

**Purpose:** Track marketing budget plan vs. committed vs. actual vs. remaining, by workstream. Each function owner enters their own spend data; the Hub calculates cumulative and per-workstream breakdowns.

Sub-views (tabs):

#### 10a. Budget table

Workstream rows with columns: recommended / planned / committed / actual spend / remaining.

Pre-loaded workstreams and recommended budgets:

| Workstream | Recommended |
|------------|-------------|
| Grassroots marketing | $210,000 |
| Thought leadership + content engine | $90,000 |
| Guerrilla / earned media bets | $40,000 |
| Marketing foundations + operations | $25,000 |
| Total | $365,000 |

#### 10b. Burn chart

Cumulative spend vs. plan over time (line chart, weekly).

#### 10c. Spend by workstream

Pie chart of actual spend allocation.

#### 10d. Variance alerts

Flag if any workstream is >10% over plan. Auto-surfaces to Decision Queue.

**Data source:** Manual entry from each function owner. Each workstream owner (the Grassroots Owner, the Content Owner, the Field & Events Owner, the Marketing Lead) enters their committed and actual spend. No Google Sheet — the Hub is the system of record for budget tracking.

**Leadership input:** Approve budget reallocation requests via Decision Queue. Adjust planned amounts.

#### Developer reference: Inputs & Outputs

**Inputs:**

- Manual entries from each function owner:
- Recommended/planned amounts (pre-loaded, leadership-editable)
  - the Grassroots Owner: Grassroots marketing spend (committed + actual)
  - the Content Owner: Content + thought leadership spend (committed + actual)
  - the Field & Events Owner: Field marketing / events spend (committed + actual)
  - the Marketing Lead: Marketing foundations + operations spend (committed + actual)
  - Leadership: Guerrilla / earned media bets spend (committed + actual)

**Expected outputs:**

- Budget table by workstream (recommended / planned / committed / actual spend / remaining — per workstream + total)
- Cumulative burn chart (actual spend vs. planned pace over time, weekly resolution)
- Workstream spend breakdown (% allocation — which workstream is consuming what share of total spend)
- Variance alerts (→ auto-flag to Decision Queue if any workstream exceeds plan by >10%)
- Budget health indicator (on-track / watch / at-risk per workstream)
- Total remaining budget and projected burn-out date at current pace

### Module 11: Decision Queue

**Purpose:** The asynchronous decision management system. Any team member can submit ideas, proposals, or decisions (with or without a budget ask). Leadership reviews and decides. This is the hub's async communication layer for marketing decisions.

**Access control:**

- Submit (all users): Any team member (the Marketing Lead, the Content Owner, the Grassroots Owner, the Field & Events Owner, the Admissions Owner) can submit a decision/proposal/idea from their own module or from a general submission form. Submitters can see the status of their own submissions.
- View + Decide (leadership only): Only a Leadership member (Growth Marketing Officer), the Budget Owner (fractional CMO), and the co-founder of GT Anywhere can access the full Decision Queue module, view all pending decisions, and take action (approve / reject / need-info). This module page is NOT accessible to marketing operators.

Sub-views (tabs):

#### 11a. Active decisions

Full list of open decisions. Filterable by owner / workstream / due date / priority.

Each decision card:

- Question / decision name
- Raised by (which workstream owner)
- Workstream it belongs to
- Recommendation (what the owner thinks the answer should be)
- Budget ask (if applicable — dollar amount requested)
- Due date
- Priority (urgent / normal)
- Leadership response field: Approve / Reject / Need-more-info + comment text
- Status: Open → Decided → In-flight
- Resolution date

#### 11b. History

Searchable archive of past decisions with outcomes.

Filterable by workstream, date range, outcome (approved / rejected / info-requested).

#### 11c. Raise flow

Any workstream owner can raise a decision from their own module → lands here + chips on Home's Decision Queue preview.

Raise form: question, recommendation, budget ask (optional), due date, workstream, priority.

**Notifications:**

- v1: In-app badge (red dot on Decision Queue nav item when new decisions land) — visible to leadership only
- v2 (deferred): Browser push notifications

**Cross-module links:** Decision Queue cards also appear on Home (preview widget — leadership only). Decisions reference back to their source workstream module.

#### Developer reference: Inputs & Outputs

**Inputs:**

- Decision/proposal submissions from any team member (manual form: question, recommendation, budget ask, due date, workstream, priority)
- Auto-flags from Budget module (variance >10% triggers automatic decision item)
- Hot family escalations from Nurture/Grassroots modules
- Event proposals from Field Marketing module (the Field & Events Owner's priority recommendations)
- Budget reallocation requests from any workstream

**Expected outputs:**

- Active decision cards with leadership response fields (approve / reject / need-info + comment text)
- Decision history archive (searchable by workstream, date, outcome — full audit trail)
- Resolution status notifications back to source module (submitter sees outcome of their proposal)
- In-app badge count on sidebar nav (for leadership — count of pending decisions)
- Decision preview widget on Home (top 2-3 open decisions for leadership's Home dashboard)

### Module 12: Resource Library

**Purpose:** Flat reference shelf of linked documents, strategy materials, persona dossiers, and Brainlifts. Simple, useful — no automation.

**Features:**

- Linked docs (pre-loaded from planning sheet):
- Persona dossier v2 — link + summary card
- Brainlift artifacts — any relevant Brainlifts
- Search + tags: filter by type (strategy / data / creative / persona / playbook), owner, date
- Upload: team members can add new resources with tags
- No automation, no versioning — just a clean organized shelf
  - Go-Forward Marketing Plan
  - Suggested Prios (presentation)
  - Brand Strategy
  - Outcomes/Results Tracker

#### Developer reference: Inputs & Outputs

**Inputs:**

- Manual file upload (team members upload documents with tags)
- Linked Google Docs / Sheets / Slides URLs (pre-loaded reference documents)
- Pre-loaded resources: a set of illustrative reference documents (e.g. a marketing plan, a brand strategy, an outcomes/results tracker, a persona dossier). These are not provided to you — mock them as sample uploads so the library has content to display and filter

**Expected outputs:**

- Searchable, tag-filterable document shelf (filter by: strategy / data / creative / persona / playbook)
- File type badges (DOC, SHEET, SLIDES, PDF, MD, HTML)
- Owner + date metadata per resource
- Upload confirmation (new resources appear immediately in the library with assigned tags)

### Module 13: Website & Digital Analytics

**Purpose:** Track website performance across gt.school and anywhere.gt.school. Understand how visitors interact with GT's web properties — which pages drive traffic, which PDFs get downloaded, where visitors convert, and how the websites support the broader marketing funnel.

Sub-views (tabs):

#### 13a. Overview

Composable dashboard.

**Default widgets:**

- Total sessions this week (aggregate across both sites)
- Sessions by site (gt.school vs. anywhere.gt.school, side-by-side)
- Bounce rate by site
- Average session duration
- New vs. returning visitors
- PDF downloads this week (count + top files)
- Top 5 landing pages by traffic

#### 13b. Subpage performance

Table of all pages across both sites, sortable by:

- Pageviews (total + weekly trend)
- Unique visitors
- Average time on page
- Bounce rate
- Exit rate
- Conversion events (form submissions, PDF downloads)

Filters: by site (gt.school / anywhere.gt.school), by page type (landing page / blog / resource / form / about), date range.

#### 13c. Traffic sources

Where website visitors are coming from:

- Organic search
- Direct
- Social (broken down by platform: X, Facebook, Instagram)
- Email (from marketing sequences)
- Referral (which sites link to GT)
- UTM-tagged campaigns (connects back to Module 7 CRM Ops for attribution chain)

Source × page matrix: which traffic sources land on which pages.

#### 13d. PDF & download tracking

Every downloadable asset tracked:

- File name
- Download count (weekly + cumulative)
- Referring page (which page was the visitor on when they downloaded)
- Source (how did the downloader originally arrive — organic, social, email, direct)

Top downloads ranked. Download trend over time.

#### 13e. Conversion paths

User flow visualization: where do visitors go after the homepage? Which paths lead to application form submissions?

Key conversion pages identified (pages with highest form-submission rate).

Cross-site analysis: do visitors start on gt.school and end up on anywhere.gt.school (or vice versa)?

**Data sources:**

- Google Analytics (GA4) for gt.school
- Google Analytics (GA4) for anywhere.gt.school
- Both sites tracked with the same or linked GA4 properties for cross-site analysis

**Leadership input:** Request analysis on specific pages or campaigns. Flag underperforming pages for content refresh.

**Cross-module links:**

- UTM-tagged traffic connects to Module 7 (CRM Ops) — the website is where UTM parameters originate
- Top landing pages feed Module 3 (Content) — which content pages drive the most traffic
- PDF download data feeds Module 12 (Resource Library) — which resources are most accessed
- Conversion paths feed Module 5 (Nurture) — understanding the digital journey before a lead enters the funnel

#### Developer reference: Inputs & Outputs

**Inputs:**

- Google Analytics (GA4) for gt.school (pageviews, sessions, users, events, conversions, traffic sources, user flow)
- Google Analytics (GA4) for anywhere.gt.school (same data set, separate property or view)
- GA4 event tracking (PDF downloads, form submissions, outbound link clicks — must be configured as GA4 events)

**Expected outputs:**

- Site performance dashboard (sessions, pageviews, bounce rate, avg duration — per site + aggregate)
- Subpage performance table (every page ranked by traffic, time on page, bounce rate, conversion events)
- Traffic source breakdown (organic / direct / social / email / referral / UTM-tagged — with platform-level detail for social)
- PDF download tracking (file name, download count, referring page, visitor source — ranked + trended)
- Conversion path visualization (user flow from landing page → application form, with drop-off points)
- Cross-site analysis (gt.school ↔ anywhere.gt.school visitor flow)
- Top landing pages report (→ feeds Content module for performance context)
- UTM source validation (→ feeds CRM Ops module for attribution chain health)

## 4. Cross-module rules

### Single source of truth

Every number displayed in the Hub has exactly one authoritative source:

- Funnel / TEFA / income / grade: Supabase app_form (NOT HubSpot field values)
- Pipeline stages (parent + child): HubSpot deal pipeline + contact pipeline
- Email engagement, sequences, lead score: HubSpot
- Social metrics: Meta Business Suite (Facebook + Instagram) + X/Twitter API (X)
- Ambassador data: HubSpot + community.gt.school (both, reconciled)
- Camp registrations: summer.gt.school + registration form (both, reconciled)
- Production tracking: Google Sheet (the Content Owner's)
- Budget: Manual entry in the Hub (Module 10 — no Google Sheet)
- Website analytics: Google Analytics (GA4) for gt.school + anywhere.gt.school

### Auto-created cross-links

- Testimonial logged in Grassroots → auto-stub production card in Content
- Top objection in Admissions/VoC → auto-create content brief in Content
- Hot family flagged anywhere → chip in Admissions/VoC + Decision Queue
- Budget variance > 10% → auto-flag in Decision Queue
- Sync parity drop → data-confidence warning banner on all modules
- Parent-led event created in Grassroots → read-only cross-link in Field Marketing calendar

### Data confidence

If Supabase-HubSpot sync parity drops below threshold, all modules that consume HubSpot data show a subtle "data confidence warning" banner linking to Module 7 (CRM Ops) for details.

## 5. Meeting integration

The Hub is designed to power the weekly marketing meeting. Meeting agenda (from the planning sheet) maps directly:

| Agenda item | Time | Owner | Hub module |
|-------------|------|-------|------------|
| 1. Exec-level recap | 5 min | the Budget Owner / Dave | Home (Executive narrative) |
| 2. Dashboard scan | 10 min | the Marketing Lead | Module 6 (Scorecard) |
| 3. Grassroots Growth Engine | 15 min | the Grassroots Owner | Module 2 |
| 4. Thought Leadership & Content | 15 min | the Content Owner | Module 3 |
| 5. Nurture / Ops / Reporting | 15 min | the Marketing Lead | Modules 5 + 7 |
| 6. Admissions / feedback loop | 10 min | the Field & Events Owner / the Admissions Owner | Module 9 |
| 7. Website & digital review | 5 min | the Marketing Lead | Module 13 |
| 8. Decisions + next actions | 5 min | the Budget Owner / Dave | Module 11 |

## 6. Sprint timeline

The Hub tracks GT Anywhere's marketing sprint from June through end of August 2026:

| Phase | Focus | Key actions |
|-------|-------|-------------|
| Weeks 1-2 | Build system | Grassroots: review ambassador list + targets. Nurture: build CRM source tracking + KPI dashboard. Content: set editorial calendar. |
| Weeks 3-4 | Launch grassroots | Train ambassadors, launch first events, begin P2P matching, deploy thought leadership. |
| July | Scale and deploy | Weekly GT experience sessions, publish parent playbook, clip/distribute expert content, retargeting sequences. |
| Late July-August | Conversion push | Guerrilla/earned bet, ambassadors for warm follow-up, proof assets, parent panels, tighten admissions handoff. |
| End of August | Review and decide | Assess enrollments, source quality, CAC by channel, ambassador impact, content performance. Decide fall operating model. |

## 7. Deployment

- Platform: Vercel
- URL: TBD (suggest: hub.gt.school or marketing.gt.school)
- Framework: Next.js (recommended for Vercel)
- Authentication: Required — needs user accounts for personal Home views + role-based access (leadership vs. operator vs. admin). Decision Queue module must be gated to leadership role only.
- Mobile: Responsive design (leadership may check on phone)

## 8. Known gaps and deferred items

| Item | Status | Notes |
|------|--------|-------|
| Browser push notifications for Decision Queue | Deferred to v2 | In-app badge v1 |
| Event-to-consult conversion tracking | Uninstrumented | Manual entry v1 |
| UTM attribution | Broken | Needs rebuild — Module 7 tracks the fix |
| SMS send-rate via Reconnectext | Unmeasurable | External platform, not synced to HubSpot |
| Event annotations on trend charts | Deferred to v2 | |
| Content repurposing flags | Deferred to v2 | |
| Substack / podcast API integrations | Manual v1 | API connections later |
| LLM-based SMS auto-themes | Deferred to v2 | Keyword rules v1 |
| Persona early-signal detection | Deferred | Deeper persona-to-pipeline signal work planned separately |
| GA4 cross-site linking | TBD | Requires both gt.school + anywhere.gt.school on same or linked GA4 property |

## 9. Reference documents

You receive exactly two documents for this exercise: the Technical Project Brief and this Product Specification. Everything you need to build the project is contained in these two documents plus the public web.

This spec occasionally names internal artifacts that a real team would maintain — a marketing plan, a brand strategy, an outcomes/results tracker, a persona dossier, a sync-parity explainer, an engagement analysis. None of these are provided, and you do not need them. Each is fully described in context where it matters. Where the product depends on such an artifact, treat it as data you design, mock, or generate yourself (see "Your test data is part of the deliverable" in the Brief), and write down any assumptions you make.
