# SSC Assistant — Chat Interface Cutover Plan

**Document owner:** [Name]
**Status:** Draft
**Cutover Date:** [CUTOVER DATE — TBD]
**Notice Window:** 2 weeks prior to Cutover Date

---

## 1. Overview

SSC Assistant is retiring its current ("legacy") chat interface and replacing it with the interface currently available at '/playground'. Concretely:

- The code currently running at '/playground' will become the new default chat experience (replacing legacy chat).
- '/playground' will **continue to exist** as its own route after cutover (for continued testing/preview of future features).
- Users have chat history in legacy chat that will no longer be accessible in the old format after cutover, so they need a window to **export their existing chats** before the switch.

**Goal:** Migrate users from legacy chat to the playground experience with zero data loss risk (via export), minimal disruption, and a clear rollback path if issues arise.

---

## 2. Scope

**In scope:**
- Code change to serve the playground UI/functionality at the primary chat route
- Retaining '/playground' as an independently accessible route post-cutover
- User communication and export window
- QA, go/no-go decision, rollback plan

**Out of scope (confirm/adjust as needed):**
- Building new export functionality (existing export feature is assumed functional and sufficient)
- Data migration of chat history into the new interface. Legacy chat and playground use **separate history stores** (see Section 4.0), so history is exported by users, not auto-migrated.

**Key assumption — VALIDATED (and it's a hard requirement, not a safety net):** Chat history from legacy chat will *not* be automatically carried into the new interface. Confirmed in code: playground persists its own sessions to Azure Table/Blob via 'app/api/playground/routes_playground.py', while legacy chat history is a separate store. These are two different systems, not one backend with two skins. Users who want to keep *legacy* conversations must export them before cutover — the urgency in the messaging is justified.

> ⚠️ **Correction from an earlier draft of this plan:** legacy chat and '/playground' do **not** share the same completion backend. This is a full-stack change, not a frontend-only reskin. See Section 4.0 for details — this materially changes scope, risk, and infra readiness (Section 4.4).

---

## 3. Timeline

| Milestone | Timing | Description |
|---|---|---|
| Kickoff / internal sign-off | T-14 days | Plan finalized, comms drafted, QA environment ready |
| User communication #1 (initial notice) | T-14 days | Announce change, export instructions, cutover date |
| Code freeze on legacy chat | T-7 days (recommended) | No new features added to legacy chat during wind-down |
| User communication #2 (reminder) | T-3 days | Reminder to export before cutover |
| Final export deadline | T-1 day (end of day) | Last call for users to export chats |
| **Cutover** | **T-0** | Legacy chat route repointed to playground code; '/playground' remains live |
| Post-cutover validation | T-0 to T+1 day | Smoke test, monitor error rates/support tickets |
| User communication #3 (confirmation) | T+1 day | Confirm change is live, share support contact for issues |
| Rollback decision window closes | T+3 days | After this, roll-forward-only (fix issues in new code rather than reverting) |

Adjust day offsets to your actual org's change management norms — some teams prefer a full 30-day notice for internal tools; 2 weeks is reasonable for an internal AI assistant with an existing export path.

---

## 4. Technical Cutover Steps

### 4.0 Repo / stack context

Source: [github.com/dto-btn/ssc-assistant](https://github.com/dto-btn/ssc-assistant) (confirmed from the public repo — code-level specifics below should be verified/filled in once the exact routing file is reviewed, since GitHub's directory browser isn't crawlable from here):

- **Monorepo layout**: 'app/api' (Python 3.12, Flask) and 'app/frontend' (npm-based, Vite dev server, React-style — per README dev instructions: 'flask run' for API on port 5001, 'npm run dev' for frontend).
- **Production frontend build**: 'tsc && vite build' output to 'dist/', served via an Azure Linux web app (per the related 'chatbot-frontend' sibling repo pattern — worth confirming this repo builds/deploys the same way).
- **Backend — CORRECTED:** legacy chat and '/playground' do **NOT** share the same completion backend. They use entirely different completion paths:
  - **Legacy chat** ('/') → Flask API → **Azure OpenAI directly** via 'app/api/utils/openai.py::chat_with_data' (RAG over Azure Cognitive Search).
  - **Playground** ('/playground') → **bypasses the Flask chat routes entirely** and streams directly to the standalone **LiteLLM proxy** ('/v1/responses') from 'app/frontend/src/playground/services/providers/azureOpenAIProvider.ts'. Tool-calling and citations go through the **MCP orchestrator** ('ssca-mcp-server'); it also depends on the **memory server** ('ssca-memory-server').
  - **Implication:** making playground the default moves three additional services ('litellm-proxy-standalone', 'ssca-mcp-server', 'ssca-memory-server') onto the **critical path for all users**. This is a full-stack change with real availability, scaling, monitoring, and cost implications — see the new infra-readiness step in Section 4.4. There **is** API reconciliation and infra work to do; this is not a frontend-only reskin.
- **Routing file — IDENTIFIED:** the router is 'app/frontend/src/routes/AppRoutes.tsx', using 'createBrowserRouter' from 'react-router'. Current routes:
  - '/' → 'RootRoute' → 'MainScreen' (legacy chat)
  - '/playground' → 'PlaygroundRoute' → 'Playground' (gated by 'VITE_PLAYGROUND_ON')
  - '/suggest-callback' → 'SuggestCallbackRoute'

  Concrete cutover: point 'path: "/"' at the 'Playground' component (or a thin shared wrapper) while keeping the '/playground' entry pointing at the same component. Both routes then render 'Playground', which cleanly satisfies "preserve '/playground'" (Section 4.1).

### 4.1 Pre-cutover (development & QA)
1. **Inventory routes/components**: Confirm exactly which route(s) currently serve legacy chat (e.g. '/chat' or '/') and which serve '/playground', in 'app/frontend/src'. Since the backend is shared, this is purely a frontend inventory — no API-side differences to reconcile.
2. **Refactor for shared code path**: Rather than copy-pasting playground code into the legacy route, prefer repointing the legacy route to render the same component/module playground uses. This avoids two diverging codebases post-cutover.
3. **Decouple route-specific config**: If '/playground' has playground-only settings (e.g., experimental feature flags, a "you're in playground" banner, different model defaults, a different Azure OpenAI deployment), separate those into route-level config so the primary chat route doesn't inherit playground-only affordances unintentionally.
4. **Preserve '/playground' as a route**: Confirm '/playground' keeps working post-change — likely by having both routes point to the same underlying component with route-specific config, rather than "moving" the code and leaving '/playground' orphaned.
5. **Feature flag — NOTE THE BUILD-TIME CAVEAT**: a playground gate already exists ('VITE_PLAYGROUND_ON', see 'app/frontend/src/routes/PlaygroundRoute.tsx'). ⚠️ 'VITE_*' variables are **inlined by Vite at build time**, so flipping this flag is **not** an instant runtime toggle — it requires a **rebuild + redeploy**. If you want a genuinely instant flip/rollback, either (a) keep the previous build artifact staged for fast redeploy, or (b) move the routing decision to a runtime-evaluated source (e.g. 'server.js', a backend config endpoint, or an App Service app setting read per request). Decide which model you're using before cutover day, because Section 7's rollback timing depends on it.
6. **QA pass**: Functional test on the primary route with the new code — auth (this app uses Microsoft/163dev-style Azure AD auth per the dev setup docs), session handling, and tool-calling. ⚠️ Tool-calling does **not** behave identically to legacy: playground routes tools through the LiteLLM + MCP orchestrator stack, not the Flask/Azure OpenAI path. Test citations, MCP tool routing, and memory-server calls explicitly. Also port over any legacy-chat-only frontend integrations (analytics hooks, custom UI elements).
7. **Export verification**: Confirm the existing export feature works end-to-end from legacy chat *right now*, and that instructions for it are accurate (exact menu path, file format produced, any size/history limits).
8. **Terraform/infra check**: Since infra is managed via Terraform (per repo docs), confirm whether any infra changes (routing rules, Azure web app config, environment variables) are needed to support both routes post-cutover, and fold those into the same PR/change window rather than treating infra as an afterthought.

### 4.2 Backend/infra readiness (NEW — highest-risk item)

Because playground depends on a separate stack (see Section 4.0), making it the default requires these dependencies to be production-ready **before** cutover:

1. **Provision for full production load**: 'litellm-proxy-standalone', 'ssca-mcp-server', and 'ssca-memory-server' must be sized for *all* users, not just playground testers. Validate capacity/scaling.
2. **Health checks & alerting**: each service needs health probes and alerts wired into the same monitoring dashboards used for baseline (error rate/latency).
3. **Terraform-managed prod**: confirm all three services are in the managed prod environment (not just dev/local), with correct env vars and secrets.
4. **Cost/telemetry**: routing all traffic through LiteLLM changes token accounting and budgets, and enables the analytics dashboard for everyone. Confirm budgets/alerts are set.
5. **Dependency failure modes**: define expected UX if LiteLLM/MCP/memory-server is unavailable, and ensure it's not a silent failure.

### 4.3 Cutover day
1. Confirm final go/no-go (Section 6).
2. Route primary chat traffic to playground code (rebuild+redeploy for the build-time flag, or flip the runtime routing source — see Section 4.1 step 5).
3. Verify '/playground' is still independently reachable and functioning.
4. Run smoke tests (see 4.4).
5. Notify internal support/helpdesk that cutover is complete and what to watch for.

### 4.4 Smoke test checklist (post-flip)
- [ ] Primary chat route loads and authenticates correctly
- [ ] New chat sessions can be created and messages sent/received
- [ ] '/playground' route still loads independently
- [ ] No regression in SSO/auth session handling
- [ ] **LiteLLM proxy reachable** and streaming '/v1/responses' correctly
- [ ] **MCP orchestrator ('ssca-mcp-server') tool-calling and citations working**
- [ ] **Memory-server ('ssca-memory-server') calls succeeding**
- [ ] Logging/analytics/telemetry still firing correctly
- [ ] Error rate / latency dashboards show no anomalies vs. baseline (LiteLLM/MCP/memory included)

---

## 5. Communication Plan

| # | Audience | Timing | Channel | Purpose |
|---|---|---|---|---|
| 1 | All users | T-14 days | Email / Teams / Slack announcement | Announce change, explain why, give export instructions and deadline |
| 2 | All users | T-3 days | Same as above | Reminder — last chance to export |
| 3 | All users | T+1 day | Same as above | Confirm change is live, where to get help |
| Internal | Support/Helpdesk | T-7 days | Internal channel | Brief the support team so they can field questions |

Draft for communication #1 is below — adjust tone/branding/links as needed.

---

### 5.1 Draft: Initial Announcement (T-14 days)

> **Subject: SSC Assistant is getting a new chat interface — action needed by [DATE]**
>
> Hi everyone,
>
> Starting **[CUTOVER DATE]**, SSC Assistant's chat interface is changing. The experience currently available in **Playground** will become the new default chat experience. We think it's a better experience overall, and this also lets us retire the older interface we've been maintaining alongside it.
>
> **What's changing:**
> - The current chat screen will be replaced by the Playground interface.
> - Playground will still be available separately at '/playground', in case you want to use it directly.
>
> **What you need to do:**
> Your existing chat history in the current interface **will not automatically carry over**. If you want to keep any of your past conversations, please export them before **[EXPORT DEADLINE — CUTOVER DATE minus 1 day]**.
>
> To export your chats:
> 1. [Insert exact steps/menu path for the **legacy** chat export feature — this is the history at risk. Note: playground has its own separate export ('sessionExport.ts'); make sure these instructions point at legacy chat, not playground.]
> 2. [Insert file format / where it saves]
>
> **Timeline:**
> - Today through [EXPORT DEADLINE]: Export your chats if you want to keep them
> - [CUTOVER DATE]: New interface goes live for everyone
>
> **Questions or issues?** Reach out to [support channel/contact].
>
> Thanks for bearing with us through the change.
> — The SSC Assistant Team

### 5.2 Draft: Reminder (T-3 days)

> **Subject: Reminder — export your SSC Assistant chats by [EXPORT DEADLINE]**
>
> Quick reminder: SSC Assistant's chat interface changes on **[CUTOVER DATE]**. If you have conversations in the current interface you want to keep, please export them by **[EXPORT DEADLINE]** — after that, they won't be retrievable from the old interface.
>
> Export steps: [link or brief steps]
>
> Questions? [support contact]

### 5.3 Draft: Confirmation (T+1 day)

> **Subject: SSC Assistant's new chat interface is now live**
>
> The updated chat interface is now live. Playground remains available separately at '/playground' if you'd like to use it directly.
>
> If you notice anything unexpected, let us know at [support contact] — we're actively monitoring for issues.

---

## 6. Go/No-Go Checklist (complete before cutover)

- [ ] All QA smoke tests pass in staging with production-like data
- [ ] Rollback method tested; revert time known and acceptable (instant flip vs. staged-artifact redeploy per Section 4.1 step 5)
- [ ] Playground backend dependencies (LiteLLM, MCP, memory-server) provisioned for full prod load with health checks/alerts (Section 4.4)
- [ ] Export feature confirmed working and instructions verified accurate (pointing at **legacy** chat export)
- [ ] Communication #1 and #2 sent on schedule
- [ ] Support/helpdesk briefed
- [ ] Rollback plan reviewed and owner assigned
- [ ] Stakeholder sign-off obtained

If any item is unchecked, cutover should be delayed.

---

## 7. Rollback Plan

**Trigger conditions** (any of the following within the first 24–48 hours):
- Primary chat route is inaccessible or throwing errors for a significant share of users
- Critical functionality (auth, message send/receive, model routing) broken
- Data loss or corruption reported

**Rollback steps:**
1. Revert routing to legacy. ⚠️ **Timing depends on the flag model chosen in Section 4.1 step 5:** if using the build-time 'VITE_PLAYGROUND_ON' flag, rollback = **redeploy the previously staged build artifact** (keep it ready), *not* an instant toggle. Only a runtime-evaluated routing source gives a near-instant flip.
2. Notify users via the same channel used for the announcement that the change has been temporarily reverted.
3. Root-cause the issue in a non-production environment before attempting cutover again.
4. Re-run the QA checklist before scheduling a second cutover attempt.

**Rollback window:** Recommend keeping rollback readily available for 3 days post-cutover; after that, prefer fixing forward rather than reverting, to avoid re-confusing users about which interface is current.

---

## 8. Roles & Responsibilities

| Role | Responsibility | Owner |
|---|---|---|
| Cutover lead | Overall go/no-go decision, coordinates cutover day | [Name] |
| Engineering | Code change, feature flag, deploy, rollback execution | [Name] |
| QA | Smoke testing, sign-off | [Name] |
| Comms | Sends user announcements | [Name] |
| Support/Helpdesk | Front-line user questions post-cutover | [Name] |

---

## 9. Open Questions to Resolve Before Finalizing

> Several items from the original draft have now been resolved against the codebase (marked **RESOLVED**). Remaining open items are process/ownership decisions.

1. ~~Does chat history persist on the backend regardless of UI?~~ **RESOLVED — No.** Legacy chat and playground have separate history stores; legacy export is a hard requirement for anyone wanting to keep legacy conversations (Section 3, 4.0).
2. Is there an actual target cutover date yet, or is 2 weeks from plan approval the working target?
3. ~~Are there legacy-chat-only integrations that must be ported?~~ **PARTIALLY RESOLVED.** The major divergence is the completion backend itself (LiteLLM+MCP vs. direct Azure OpenAI), not just UI affordances. Still confirm any analytics hooks / custom UI elements to port.
4. Who is the designated support contact for the end-user communications?
5. ~~Are there frontend-only differences between the two UIs?~~ **RESOLVED — the difference is not frontend-only.** The two UIs run on different backends (Section 4.0). Scope updated accordingly.
6. ~~What is the exact frontend routing file/pattern?~~ **RESOLVED.** 'app/frontend/src/routes/AppRoutes.tsx' ('createBrowserRouter'); see Section 4.0 for current routes and the concrete cutover edit.
7. Does production deployment follow the same 'tsc && vite build' → Azure Linux web app pattern, and does that process need changes to keep both routes live? (Also decide the flag model — build-time vs. runtime — per Section 4.1 step 5.)
8. **NEW:** Are 'litellm-proxy-standalone', 'ssca-mcp-server', and 'ssca-memory-server' provisioned and monitored for full production load in the managed prod environment? (Section 4.4 — highest-risk item.)
