# Fieldline — a pre-built product skeleton by Shiftmind Build

A field operation — sites, shifts, check-ins, reports, and alerts.

A working, secured, and tested starting point — not a mockup. We adapt it into your product in five working days, deployed to your own cloud and yours to keep.

**Live demos:** https://shiftmindbuild.com/pre-built · **Studio:** https://shiftmindbuild.com

## What this is

One of four pre-built skeletons from [Shiftmind Build](https://shiftmindbuild.com). It is a field operation with a real data model, real access rules, and the tests that prove them. You open the demo, recognise the shape closest to your idea, and we turn it into your product — your names, your fields, your rules.

## The part most skeletons skip: access isolation

Every entity — `sites`, `shifts`, `checkins`, `reports`, `alerts` — declares **explicitly** who may read, create, update, and delete it. The Firestore rules are **deny-by-default**: anything not named is closed. Fields are allow-listed with `hasOnly(...)`, destructive deletes are off by default (`delete: if false`, soft-delete instead), and there is no `allow read, write: if true` anywhere — not even temporarily for testing.

And we don't just assert it — we **prove it**. In `backend/src/tests/isolation/` each entity has its own suite that logs in as one user and checks that another user **cannot** read or write their data. A user who can read someone else's row is the single most expensive bug in a fast MVP, and the one that gives no warning until someone finds it. These tests run in a **blocking pre-push hook**: if isolation breaks, the build fails.

## How it's generated — and why that matters

The data model, the security rules, and the isolation tests all come from **one source**: `backend/blueprint.yaml`. Change the blueprint, regenerate — so the rule and the test that proves it can never drift apart. That is how every Shiftmind build is secure *by default*, not by someone remembering to be careful.

## Stack

- **Backend:** TypeScript, Firebase **Firestore + Auth** (roles via custom claims)
- **Frontend:** Vite
- **Tests:** Vitest + `@firebase/rules-unit-testing` against the Firestore emulator

## Run the tests

```bash
cd backend
npm install
npm test
```

## Make it yours

Open the [live demos](https://shiftmindbuild.com/pre-built), recognise your shape, and we build it out in five working days — on your own Google Cloud project, transferable to you at the end. Start with a free fit check at **[shiftmindbuild.com](https://shiftmindbuild.com)**.

---

<sub>© Shiftmind Build — independent software studio. Part of Shiftmind Studios LLC.</sub>
