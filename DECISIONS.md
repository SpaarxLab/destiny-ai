# Career Lab — Decision Record

**Authority:** decisions D-001 through D-007 were selected under Harsh's 2026-09-01
instruction to apply the best defaults and complete foundation setup. Items marked
`OWNER INPUT` remain deliberately unresolved.

## Accepted decisions

### D-001 — One repository root

**Decision:** `/Users/harsh/career-lab` is the canonical Git repository. The Next.js
application remains in `web/`; plans, proof, research, and code share one history.

**Why:** a three-person team needs one review, integration, and rollback boundary. Flattening
the app into the root would add churn without product value.

### D-002 — Runtime and package manager

**Decision:** Node 24, npm, Next.js App Router, TypeScript strict mode.

**Why:** this matches the verified local runtime and current lockfile. Switching package
managers would create noise. Next.js 16 requires Node >=20.9.

### D-003 — Local-first candidate

**Decision:** one schema-versioned local workspace through the entire challenge candidate.
No auth, database, sync, analytics, or remote career-content storage in MVP.

**Why:** it keeps one authority, improves privacy, and focuses learning on agent control,
human collaboration, receipts, and recovery. Server persistence is a separate post-MVP
architecture packet.

### D-004 — Adult participant boundary

**Decision:** recruit adults aged 18+ only for MVP research and demos.

**Why:** the product touches uncertainty and distress. Minor-specific consent and safeguarding
would be a separate, expert-reviewed product profile.

### D-005 — Internal ship target

**Decision:** immutable internal candidate by **29 September 2026**, with a one-week
contingency ending **6 October 2026**. Enter the next official challenge window when announced;
do not let an unknown external date control foundation quality.

### D-006 — Team shape

**Decision:** three stable lanes. Harsh owns Lane C (Agent Surface, Evals, Runtime Proof) and
is integration captain/product authority. The strongest backend/domain teammate owns Lane A;
the strongest product/frontend teammate owns Lane B.

**Why:** Harsh's learning goal is agentic product design. One integration captain prevents
contract drift; lane ownership prevents shared-file chaos.

### D-007 — Research and proof

**Decision:** target five adult participants using pseudonymous IDs and no contact details in
the repository. Three participants must validate the solo board before agent polish; five
complete the candidate study if recruitment succeeds. Report actual counts honestly.

## Owner input still required

1. `OWNER INPUT` — Lane A person's name.
2. `OWNER INPUT` — Lane B person's name.
3. `OWNER INPUT` — safeguarding reviewer for distress copy.
4. `OWNER INPUT` — five participant IDs/recruitment commitments (do not store contact
   details here).
5. `OWNER INPUT` — repository visibility and license:
   - **Recommended:** private during development, MIT + public when the team is ready to
     submit;
   - Apache-2.0 + public at submission;
   - remain private and do not submit until rights/visibility are resolved.

No remote repository is created and no license is granted until item 5 is chosen.
