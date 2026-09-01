# Packet P0B — Team and Participant Admission

**Status:** P1 ADMITTED — PARTICIPANT RESEARCH STILL BLOCKED
**Owner:** Harsh
**Branch/worktree:** `main`
**Integration destination:** `main`

## Outcome

Every implementation lane has a real human owner before P1. Participant-facing safeguards
remain a separate named gate before research begins.

## Recorded implementation owners

### Lane A

Devarsh owns TypeScript domain modelling, invariants, commands, persistence, and their tests.
This is a bounded lane—not “the backend” as a vague shared area.

### Lane B

Tirth owns interaction design, React, accessibility, the participant board, and browser
journeys.

### Safeguarding reviewer

Preferred order:

1. qualified counsellor, psychologist, or mental-health professional familiar with student
   wellbeing;
2. university/student wellbeing lead with referral experience;
3. defer participant testing until one is available.

A teammate without relevant safeguarding experience is not an adequate substitute.

### Participant mix

Recommended five-person mix:

- three adults currently stuck on a study/career direction;
- one recent graduate facing a first-role decision;
- one early-career adult considering a change.

Use P01–P05 in the repository. Keep names and contact details elsewhere.

### Visibility and license

Recommended: keep the remote private during development, then use MIT and make the submission
repository public only after source ownership, secret scanning, participant-data checks, and
candidate review. Alternatives are Apache-2.0 at submission, or remain private and skip
submission until rights are resolved.

## Admission check

P1 implementation is admitted because all three lanes are named. Participant testing remains
blocked until `DECISIONS.md` and `PROJECT_STATE.md` name the reviewer and
`research/PARTICIPANTS.md` records five non-identifying recruitment commitments.

## Closeout

- verified: Devarsh, Tirth, and Harsh have distinct implementation lanes;
- product implementation: admitted;
- participant research blocked by: reviewer and participant commitments;
- next packet: P1 Command Spine;
- disposition: `P1 START NOW`; research `START AFTER NAMED GATE`.
