# Bahamas VAT + Data Protection — Verified Source Manifest

**Version:** 3.0 — final verification pass · supersedes v2.0 (2026-08-23) and v1.0 (2026-07-31)
**Status:** Engineering working document — **NOT canonical**, not in `DOCUMENT_MANIFEST.md`
**Country:** `BS` · **Owner:** Jamil Nash · **Date:** 2026-08-23
**Scope:** Verification only. **No ingestion. No migration. No publishing. No Nova changes.**

---

## 0. Verification summary

The 2026 discrepancy is **resolved from primary sources**. Both the DIR position and the legislation-index
position were partly right, and the reason they disagreed is itself an architecturally important finding.

| Question                                         | Answer                                                                                                                  | Evidence                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Does an enacted VAT (Amendment) Act, 2026 exist? | **YES** — No. 4 of 2026                                                                                                 | Gazette, assent, Act text — quoted §E |
| Is `2026-0004` the VAT Act?                      | **NO.** `BILLS/2026/2026-0004` is the _National Youth Commission Bill, 2026_. The VAT Act is `AMENDING/2026/2026-0004A` | Both fetched                          |
| Is there a second 2026 VAT amendment?            | **A Bill only** — VAT (Amendment) (No. 2) Bill, 2026. No corresponding Act in the 2026 Acts list                        | §E.4                                  |
| Is the Data Protection Act, 2025 in force?       | **NO** — appointed-day commencement, day not appointed                                                                  | §D                                    |
| Does Ch. 324A remain operative?                  | **YES**, on current evidence                                                                                            | §D                                    |

**v2.0's conclusion that no 2026 Act existed was wrong.** It was based on the DIR page, which is stale. The
correction below is the whole point of this pass.

---

## 1. Evidence rules and the discriminator used

**SHOWN** = quoted from a fetched document · **INDEX** = on a fetched official index · **UNKNOWN** = not established.

Per your rule 8, legal status was **not** inferred from filenames, index labels, or the phrase _"Enacted by
the Parliament of The Bahamas"_ — which appears in Bill templates too. The National Youth Commission
**Bill** fetched in this pass contains `ENACTED BY THE PARLIAMENT OF THE BAHAMAS` and is not law.

**The discriminator actually applied — all four must be present:**

| #   | Marker                                                            | Bill                     | Act           |
| --- | ----------------------------------------------------------------- | ------------------------ | ------------- |
| 1   | Gazette header `OFFICIAL GAZETTE … PUBLISHED BY AUTHORITY` + date | absent                   | present       |
| 2   | Act number `No. N of YYYY`                                        | absent                   | present       |
| 3   | `[Date of Assent - …]`                                            | absent                   | present       |
| 4   | Long title opens `AN ACT TO …`                                    | `A BILL FOR AN ACT TO …` | `AN ACT TO …` |

---

# A. Final verified source manifest

## A.1 Chapter 370A chain — the operative VAT corpus

### 1. Value Added Tax Act (Reprint) — CHAPTER 370A

`https://inlandrevenue.finance.gov.bs/wp-content/uploads/2024/11/Value-Added-Tax-Act.pdf`

```
EXTRAORDINARY OFFICIAL GAZETTE / NASSAU 4th November, 2024
Value Added Tax Act (Reprint) / CHAPTER 370A / Reprinted as at 1st July, 2024
```

`act` · `primary_legislation` · **Auth 5** · consolidated **as at 2024-07-01**
**Role: BASE TEXT. Not current in isolation** — three later Acts amend it.
`freshness_state` → **`changed_pending_assessment`**

### 2. Value Added Tax (Amendment) Act, 2025 — **No. 3 of 2025**

`https://inlandrevenue.finance.gov.bs/wp-content/uploads/2025/07/VALUE-ADDED-TAX-AMENDMENT-ACT-2025.pdf`

```
EXTRAORDINARY OFFICIAL GAZETTE / NASSAU 31st March, 2025
No. 3 of 2025 · [Date of Assent 31st March 2025]
"(2) This Act shall come into operation on the 1st day of April, 2025."
```

**Assent 2025-03-31 · Commencement 2025-04-01 · No varying provision**
Amends **ss. 2, 6, 13, 52, 71, 96A** · **inserts Fourth Schedule** · Auth 5 · `current`

### 3. Value Added Tax (Amendment) (No. 2) Act, 2025 — **No. 45 of 2025**

`https://inlandrevenue.finance.gov.bs/wp-content/uploads/2025/07/VALUE-ADDED-TAX-AMENDMENT-NO.2-ACT-2025-.pdf`

```
EXTRAORDINARY OFFICIAL GAZETTE / NASSAU 1st July, 2025
No. 45 of 2025 · [Date of Assent 27th June, 2025]
"(2) Subject to subsection (3), this Act shall come into operation on the 1st day of July, 2025.
 (3) Section 22(f) of this Act shall come into operation on the 1st day of September, 2025."
```

**Assent 2025-06-27 · Commencement 2025-07-01 · ⚠️ VARYING: s.22(f) from 2025-09-01**
Amends ss. 2, 18, 19, 22A, 27, 38C, 47A, 47B, 50, 57, 58, 81 · **inserts** 38K, 47C, 56A ·
**repeals and replaces ss. 56, 61B, 81A** · amends First, Third, Fourth Schedules · Auth 5 · `current`

### 4. Value Added Tax (Amendment) Act, 2026 — **No. 4 of 2026** ⭐ NEWLY VERIFIED

`https://laws.bahamas.gov.bs/cms/images/LEGISLATION/AMENDING/2026/2026-0004A/2026-0004A.pdf`

```
EXTRAORDINARY OFFICIAL GAZETTE / NASSAU 23rd March, 2026
No.4 of 2026 · [Date of Assent - 23rd March, 2026]
AN ACT TO AMEND THE VALUE ADDED TAX ACT TO EXEMPT QUALIFYING UNPREPARED
FOOD ITEMS AND CERTAIN IMPORTED GOODS FROM VALUE ADDED TAX, AND FOR
CONNECTED PURPOSES
"(2) This Act shall come into operation on the 1st day of April, 2026."
```

**Assent 2026-03-23 · Commencement 2026-04-01 · No varying provision**
Amends **s. 6** (Rates of tax), **Second Schedule** (Exempt Supplies + Exempt Imports),
**Fourth Schedule** · Auth 5 · `current`

> **Directly material to the Island Bites demo.** This Act exempts qualifying **unprepared food items**.
> A food business is precisely the case where the 2024 reprint gives the wrong answer.

## A.2 Data Protection

### 5. Data Protection (Privacy of Personal Information) Act — **CHAPTER 324A** (No. 3 of 2003)

`https://laws.bahamas.gov.bs/cms/images/LEGISLATION/PRINCIPAL/2003/2003-0003/2003-0003.pdf`
_(supplied URL carried a spam querystring; canonical form above)_

```
DATA PROTECTION [CH.324A – 1 / LRO 1/2008 / STATUTE LAW OF THE BAHAMAS
CHAPTER 324A / LIST OF AUTHORISED PAGES 1 - 29 LRO 1/2008
```

`act` · `primary_legislation` · **Auth 5** · consolidated LRO 1/2008
**Status: OPERATIVE** — its repeal is enacted but not commenced. `freshness_state` → **`review_due`**

### 6. Data Protection Act, 2025 — **No. 74 of 2025** ⭐ NEWLY VERIFIED

`https://laws.bahamas.gov.bs/cms/images/LEGISLATION/PRINCIPAL/2025/2025-0074/2025-0074_1.pdf`

```
SUPPLEMENT PART I / OFFICIAL GAZETTE / NASSAU 11th December, 2025 No. 50
No. 74 of 2025 · [Date of Assent - 9th December, 2025]
"… TO REPEAL THE [Data Protection (Privacy of Personal Information) Act]
 (CHAPTER 324A) AND FOR CONNECTED PURPOSES"
"(2) This Act shall come into operation on the date as the Minister may appoint by notice …"
s.101. Repeal of No. 3 of 2003
"'repealed Act' means the Data Protection (Privacy of Personal Information) Act (Ch. 324A);"
```

**Assent 2025-12-09 · Commencement: APPOINTED DAY, NOT YET APPOINTED**
Auth 5 · `freshness_state` → **`changed_pending_assessment`** — enacted, awaiting commencement

---

# B. Amendment / supersession graph

```
                    VALUE ADDED TAX ACT — CHAPTER 370A
                              (base instrument)
                                    │
        ┌───────────────────────────┴────────────────────────────┐
        │  amendments 2015–2024 ── ABSORBED INTO ──►  REPRINT     │
        │                                     gazetted 2024-11-04 │
        │                                  consolidated 2024-07-01│
        └───────────────────────────┬────────────────────────────┘
                                    │
   ┌────────────────────────────────┼────────────────────────────────┐
   │                                │                                │
No. 3 of 2025                 No. 45 of 2025                    No. 4 of 2026
assent 2025-03-31            assent 2025-06-27                 assent 2026-03-23
in force 2025-04-01          in force 2025-07-01               in force 2026-04-01
                             s.22(f) from 2025-09-01
   │                                │                                │
   ├─ s.2                           ├─ s.2, 18, 19, 22A, 27, 38C     ├─ s.6  ⚠ RATES
   ├─ s.6  ⚠ RATES                  ├─ s.47A, 47B, 50, 57, 58, 81    ├─ 2nd Schedule
   ├─ s.13, 52, 71, 96A             ├─ INSERTS 38K, 47C, 56A         │   (Exempt Supplies
   └─ INSERTS 4th Schedule          ├─ REPEALS+REPLACES 56, 61B, 81A │    + Exempt Imports)
                                    └─ 1st, 3rd, 4th Schedules       └─ 4th Schedule

              ✗ VAT (Amendment) Bill 2026 (Feb)  ──► BECAME No. 4 of 2026
              ✗ VAT (Amendment) (No.2) Bill 2026 (Jul) ──► STILL A BILL. NOT LAW.
```

### Provisions amended more than once — highest-risk set

| Provision                 | Touched by                                                                  | Consequence                                                                  |
| ------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **s. 6 — Rates of tax**   | Reprint → **No. 3/2025** → **No. 4/2026**                                   | Three-layer chain. The reprint text of s.6 is **two amendments out of date** |
| **s. 2 — Interpretation** | Reprint → No. 3/2025 → No. 45/2025                                          | Definitions incl. "food store", "taxable activity"                           |
| **Fourth Schedule**       | **Inserted** by No. 3/2025 → amended by No. 45/2025 → amended by No. 4/2026 | **Does not exist at all in the 2024 reprint**                                |
| **s. 56**                 | Reprint → **repealed and replaced** by No. 45/2025                          | Reprint text is repealed law                                                 |
| **ss. 61B, 81A**          | Reprint → repealed and replaced by No. 45/2025                              | Reprint text is repealed law                                                 |
| **Second Schedule**       | Reprint → No. 4/2026                                                        | Exempt supplies/imports — the food exemption                                 |

**The Fourth Schedule case is the sharpest.** A founder asking about reduced-rate items would retrieve
nothing from the reprint, because the Schedule did not exist on 1 July 2024. Retrieval would return zero
chunks and Nova would refuse — which is _honest_ but _wrong_, since the Schedule does exist and is
retrievable from three amending Acts.

### Data Protection chain

```
Data Protection (Privacy of Personal Information) Act — CH. 324A (No. 3 of 2003, LRO 1/2008)
        │  ◄── OPERATIVE
        │
        └── to be repealed by ── Data Protection Act, 2025 (No. 74 of 2025)
                                 assent 2025-12-09
                                 commencement: APPOINTED DAY — NOT APPOINTED
                                 ◄── ENACTED, NOT IN FORCE
```

---

# C. Current vs historical vs bill/draft

## C.1 CURRENT LAW — BS-v0.1 candidate corpus (6 sources)

| #   | Instrument                                       | Auth | Role                      | `freshness_state`            |
| --- | ------------------------------------------------ | ---- | ------------------------- | ---------------------------- |
| 1   | VAT Act Ch. 370A, reprint as at 2024-07-01       | 5    | base                      | `changed_pending_assessment` |
| 2   | VAT (Amendment) Act 2025 — No. 3 of 2025         | 5    | amending                  | `current`                    |
| 3   | VAT (Amendment) (No.2) Act 2025 — No. 45 of 2025 | 5    | amending                  | `current`                    |
| 4   | VAT (Amendment) Act 2026 — No. 4 of 2026         | 5    | amending                  | `current`                    |
| 5   | Data Protection Act Ch. 324A                     | 5    | principal                 | `review_due`                 |
| 6   | Data Protection Act 2025 — No. 74 of 2025        | 5    | **enacted, not in force** | `changed_pending_assessment` |

All six: Authority 5, gazetted, fetched with clean text, assent and commencement SHOWN.

**Source 6 is included deliberately.** It is not current law, but it is the _reason_ source 5 is still
current, and a founder asking about data protection deserves to know a successor exists and has not
commenced. It must be ingested with a status that makes stating it as current law impossible.

## C.2 HISTORICAL / SUPERSEDED — excluded from BS-v0.1

| Class                    | Items                                                                                           | Reason                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Absorbed amendments      | 11 VAT Amendment Acts 2015–2024 (§F)                                                            | Presumptively inside the 2024-07-01 consolidation          |
| Repealed provisions      | ss. 56, 61B, 81A text in the reprint                                                            | Superseded by No. 45/2025                                  |
| Spent transitional rules | VAT-Rule-2015-014 · Transitional Hotel Booking 2015 & 2018 · Transitional Construction Contract | Spent by their own terms; quote the **retiring 7.5% rate** |
| Draft-marked rules       | 2015 rule set headed _"Version for Publication and Comptroller's Approval"_                     | May never have been executed                               |
| Unsigned instruments     | `Transitional-Hotel-Booking.pdf` — blank signature block                                        | Execution unproven                                         |
| Guidance                 | ~25 VAT Guidance PDFs, 2017–2025                                                                | Authority 3 — can never reach 🟢 VERIFIED                  |

## C.3 BILLS / DRAFTS — never registered, never retrievable

| Item                                                   | Status                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| VAT (Amendment) Bill 2026 (Feb, _"to be laid in HOA"_) | **Became No. 4 of 2026.** The Act supersedes it. Excluded                            |
| **VAT (Amendment) (No. 2) Bill 2026** (Jul)            | **STILL A BILL.** Stated commencement 2026-07-01 has passed — no Act found. Excluded |
| VAT (Amendment) Bill 2025 (Feb)                        | Became No. 3 of 2025. Excluded                                                       |
| VAT Amendment Bill 2024 (to Senate)                    | Excluded                                                                             |
| `VAT-FREE-SHOPPING-DRAFT-FINAL-1.pdf`                  | Draft. Excluded                                                                      |

---

# D. Data Protection status — final

| Question                                       | Answer                                                                                                   | Evidence                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------- |
| Does Ch. 324A exist and is it identified?      | **Yes** — Data Protection (Privacy of Personal Information) Act, **No. 3 of 2003**, Ch. 324A, LRO 1/2008 | SHOWN                      |
| Is the file you supplied the right instrument? | **Yes.** No. 74 of 2025 s.101 is headed _"Repeal of No. 3 of 2003"_ — the same instrument                | SHOWN                      |
| Does an enacted 2025 Act exist?                | **Yes** — No. 74 of 2025, assent **2025-12-09**, gazetted 2025-12-11                                     | SHOWN                      |
| Does it repeal Ch. 324A?                       | **Yes**, by long title and s.101                                                                         | SHOWN                      |
| Commencement mechanism?                        | **Appointed day** — _"shall come into operation on the date as the Minister may appoint by notice"_      | SHOWN                      |
| Has an Appointed Day Notice been made?         | **No, on current evidence.** Officially listed under **"Not in Force (Principal)"**                      | INDEX                      |
| Is Ch. 324A operative?                         | **Yes**, on current evidence                                                                             | Derived from the two above |

**Residual risk:** a commencement notice could have been gazetted after the "Not in Force" page was last
built. The register's own listing is the best available evidence and is not a substitute for a search of
Gazette commencement notices from 2025-12-11 to date. **Legal-review item G6.**

---

# E. 2026 VAT discrepancy — resolution

## E.1 What each source actually said

| Source                                       | Says                                                                                | Correct?                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **laws.bahamas.gov.bs**, _Acts by Year 2026_ | `Value Added Tax (Amendment) Act, 2026` → `AMENDING/2026/2026-0004A/2026-0004A.pdf` | ✅ **Correct**                                                       |
| **DIR Legal-VAT page**                       | Lists only 2026 **Bills**                                                           | ⚠️ **Stale** — never replaced the Feb 2026 Bill with the enacted Act |
| Your reading `2026-0004`                     | Reasonable, but the raw number is ambiguous                                         | See E.2                                                              |

## E.2 Why `2026-0004` was ambiguous — three independent numbering namespaces

```
BILLS/2026/2026-0004/2026-0004.pdf          → National Youth Commission BILL, 2026   ← unrelated
PRINCIPAL/2026/2026-0004/2026-0004_1.pdf    → does not resolve (empty)
AMENDING/2026/2026-0004A/2026-0004A.pdf     → VALUE ADDED TAX (AMENDMENT) ACT, 2026  ← the Act
```

The **`A` suffix and the `AMENDING` path segment** are load-bearing. A bare `2026-0004` resolves to a
different instrument in a different namespace. Both were fetched; both are quoted above.

**Manifest consequence:** the record key must be the **full namespaced path**, never a bare year-number.

## E.3 Verified answers to your eight questions

1. **Located** — `AMENDING/2026/2026-0004A/2026-0004A.pdf`.
2. **Enacted Act.** All four discriminators present. Not a mis-indexed Bill.
3. **Assent: 23 March 2026.**
4. **Commencement: 1 April 2026**, unconditional.
5. **No Appointed Day Notice required** — the Act sets its own date.
6. **Yes, a second 2026 instrument exists — but it is a Bill**: VAT (Amendment) (No. 2) Bill, 2026. No
   corresponding Act appears among the 2026 Acts (list runs to `2026-0038A`).
7. **April vs July 2026 DIR material:** the DIR page shows the Feb 2026 Bill (which became No. 4 of 2026,
   in force 1 April 2026) and the July 2026 No. 2 Bill (still a Bill). DIR shows neither as an Act.
8. **No status inferred from filenames or templates.** The National Youth Commission _Bill_ contains
   `ENACTED BY THE PARLIAMENT OF THE BAHAMAS` and is not law — which is exactly why that phrase was
   excluded from the discriminator.

## E.4 🔴 Architectural finding — agency pages are not authoritative for legal status

The DIR Legal-VAT page is an **Authority 3** agency publication and is **demonstrably stale**: it still
presents the Bill that became No. 4 of 2026 and has never published the Act. Its `article:modified_time`
is `2024-04-19` while it links files uploaded in 2026.

The legislation register also warns about its own by-year view:

> **WARNING:** The table below presents the historical initial release version [1] of each Legislation file
> only, and may not be the correct (current) version. All **CURRENT** Legislation is grouped under the
> **LEGISLATION > ACTS [OR] SUBSIDIARY > by Alphabetical Order [OR] by Category** menus.

**Two rules follow, and both should bind the ingestion pipeline:**

- **R1.** Legal status is established **only** from `laws.bahamas.gov.bs` plus the instrument's own gazette
  text. An agency page may supply a copy of a document; it may never establish that document's status.
- **R2.** The _by Year_ view is a historical release listing. Currency comes from _by Alphabetical Order_ /
  _by Category_, or from the Not-in-Force and Repealed registers.

---

# F. Missing sources / outstanding fetches

| #   | Item                                                                | Priority    | Why                                                                                                                     |
| --- | ------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| F1  | `Value-Added-Tax-Amendment-Act-2024.pdf` commencement date          | 🔴 Blocking | Determines whether it is inside the 2024-07-01 consolidation                                                            |
| F2  | Commencement dates for the other 10 amendments 2015–2023            | 🟠 Medium   | Confirms the absorption assumption                                                                                      |
| F3  | Gazette commencement notices 2025-12-11 → today, for No. 74 of 2025 | 🔴 High     | Would flip §D                                                                                                           |
| F4  | **VAT (Withholding Agents) Rules, 2022**                            | 🟠 Medium   | You named it; **not on the DIR index**. Source unlocated                                                                |
| F5  | **VAT (Supply of Real Property) (General) Rules, 2023**             | 🟠 Medium   | DIR has _"Gazetted VAT Rules 2019 — Supply of Real Property (Revised)"_ uploaded 2023/04. Same instrument or different? |
| F6  | Ch. 370A entry under _Index in Alphabetical Order_                  | 🟠 Medium   | The register's own amendment history — independent check on §B                                                          |
| F7  | Any VAT reprint later than 2024-11-04                               | 🟠 Medium   | Would collapse the chain. **None found; assume none**                                                                   |
| F8  | Subsidiary legislation by year, 2021–2023                           | 🟡 Low      | Locates the Rules in F4/F5                                                                                              |
| F9  | `VAT-Rules-Gazetted.pdf` (S.I. 68/2015)                             | 🟡 Low      | **OCR_REQUIRED** — no text layer, no OCR in the repo                                                                    |

**The amendment chain in §B is complete for the three verified amending Acts, but it is not proven
exhaustive.** F1, F2 and F6 close that gap.

---

# G. Outstanding legal-review questions

**Blocking BS-v0.1:**

| #   | Question                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Are No. 3/2025, No. 45/2025 and No. 4/2026 in force as their own texts state, with no later commencement order varying them? _(None appears on Not in Force (Amending) — negative evidence only.)_ |
| G2  | Is the §B chain **exhaustive**, or are there VAT amendments between 2024-07-01 and today not on either index?                                                                                      |
| G3  | Is `Value-Added-Tax-Amendment-Act-2024.pdf` inside or outside the 2024-07-01 consolidation?                                                                                                        |
| G4  | Has an Appointed Day Notice for No. 74 of 2025 been gazetted since 2025-12-11?                                                                                                                     |
| G5  | Does any VAT reprint later than 2024-11-04 exist?                                                                                                                                                  |
| G6  | Confirm Ch. 324A is operative today — i.e. G4 is negative.                                                                                                                                         |

**Blocking P1/P2:**

| #   | Question                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G7  | Are Comptroller's VAT Rules under s.17 **statutory instruments** (Auth 4) or **official guidance** (Auth 3)? _One question, ~24 documents._                                                                                                                                                              |
| G8  | Does _"Version for Publication and Comptroller's Approval"_ mean never executed?                                                                                                                                                                                                                         |
| G9  | May an **unsigned** instrument enter the corpus?                                                                                                                                                                                                                                                         |
| G10 | Spent instruments: excluded, or ingested as `withdrawn` with an `expiry_date`?                                                                                                                                                                                                                           |
| G11 | Crown copyright / reproduction terms. The legislation site states: _"Legislation can be downloaded and printed for private use. Any commercial entity is required to obtain permission to reuse the data…"_ — **🔴 this is a commercial-use restriction and needs a decision before anything is stored** |

> **G11 was not visible before this pass and may be the most commercially significant item in this
> document.** The reuse restriction on the legislation site is explicit.

---

# F. (bis) Proposed Nova amended-provision response structure

_(Deliverable F in your numbering — Option 3, as you directed.)_

## F.1 Principles

1. **Never synthesise a consolidated statute.** A merged text is legal text no gazette published; every
   chunk of it would be uncitable. Forbidden by the citation architecture, not merely undesirable.
2. **Each instrument is its own `knowledge_source`** with its own chunks and its own citation.
3. **Retrieve base provision AND amending instrument**, as **separate claims with separate citations**.
4. **State the operative conclusion only where the evidence establishes it.** Where commencement or status
   cannot be established, emit an explicit `unresolved` item and **refuse to state the current position**.

## F.2 Internal structure

```
AmendedProvisionAnswer
├── baseProvision        claim ─ verbatim quote from Ch. 370A reprint
│                                citation: Ch. 370A, s.X, knowledge_version, chunk_id
├── amendments[]         claim ─ verbatim quote from each amending Act
│                                citation: No. 45 of 2025, s.13, chunk_id
├── amendmentStatus[]    METADATA, not a claim — assent, commencement, varying provisions
├── currentApplicability derived ONLY where every amendment's commencement is established
├── evidence[]           every chunk_id + verbatim quote (ADR-0017 §5.1)
└── unresolved[]         MANDATORY — populated whenever status cannot be established
```

## F.3 Decision rule

```
retrieve base provision chunks
retrieve amending-instrument chunks for that provision

if no amendment affects the provision:
    → OK · single claim · normal path                       (Day 2 behaviour, unchanged)

if amendments exist AND every commencement is established:
    → OK · claim(base) + claim(each amendment)
         · currentApplicability stated from metadata
         · separate citation per instrument

if amendments exist AND any commencement is UNKNOWN:
    → OK · claim(base) + claim(each amendment)
         · currentApplicability = NOT STATED
         · unresolved[]: "Commencement of <instrument> could not be established;
                          the current legal position is not stated."

if the provision was REPEALED AND REPLACED:
    → the replacement text is the claim; the repealed text is presented as superseded,
      never as the operative provision
```

**Never**: merge texts · quote the base alone with a caveat when an amendment is known ·
refuse merely because an amendment exists.

## F.4 What this requires — and does not

**Does not require changing the Day 2 contract or reasoner.** Every element already exists:

| Need                                | Existing mechanism                                                  |
| ----------------------------------- | ------------------------------------------------------------------- |
| Multiple claims, separate citations | `NovaEnvelope.claims[]`, one citation set per claim                 |
| Verbatim quotes                     | `NovaEvidenceRef.quote` — already enforced                          |
| Status could not be established     | `unresolved[]` — already mandatory                                  |
| Refuse to state current position    | Omit `currentApplicability`; the envelope has no field asserting it |

**Requires, on Day 3, in the Assistant Service:**

- a **provision-level amendment index** — `(instrument, provision) → amending instruments`, built from
  manifest metadata, not inferred by a model;
- retrieval that, on hitting a base provision, **also retrieves the amending instruments** for it;
- `amendmentStatus` assembled from source metadata.

**Requires, on the reasoner, only one change** — and it is additive: `reasoningHops` must be permitted to
be **2** for a claim that combines base and amendment. `assertEnvelopeValid` already accepts any integer
≥ 1, and Trust Layer §4.4 maps 2–3 hops to **MEDIUM** Reasoning Confidence. **No contract change; the
Day 2 code already permits it.**

> ⚠️ **Consequence to accept deliberately:** a combined base+amendment claim is `reasoningHops = 2` →
> Reasoning Confidence **MEDIUM** → **🟡 DERIVED, not 🟢 VERIFIED** (Trust Layer §4.6 requires Reasoning
> HIGH for VERIFIED). Keeping base and amendment as **separate single-hop claims** preserves 🟢 VERIFIED on
> each. **Recommendation: keep them separate; let `currentApplicability` be the derived, MEDIUM element.**

---

# H. Revised BS-v0.1 recommendation

**Six sources** (§C.1). All Authority 5, all gazetted, all fetched clean.

| Step | Action                                                                                                                                                | Gate                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 0    | Answer **G1–G6**. Fetch **F1, F3, F6, F7**                                                                                                            | 🔴 Blocks everything                  |
| 0b   | Resolve **G11** — commercial reuse permission                                                                                                         | 🔴 Blocks storage                     |
| 1    | Close **gap 1**: `freshnessState` in `registerSourceSchema` + `insertSource`; test that a source registered without it is **rejected**, not defaulted | Before any write                      |
| 2    | Manifest module with `amendedBy` / `amendedProvisions` / `consolidatedAsAt` / `commencement` / `varyingCommencement`                                  | Data only                             |
| 3    | Offline `scripts/knowledge/fetch-source.ts` — fetch, store, SHA-256. Script, not service                                                              |                                       |
| 4    | Hand-segment six sources by their own `Arrangement of Sections`                                                                                       |                                       |
| 5    | `ingestSource` → draft pack **BS-v0.1** → `runQualityGate` → **STOP**                                                                                 | Publication is human approval (K7 §9) |
| 6    | Day 3 Assistant Service implements §F                                                                                                                 | After corpus approval                 |

## Architecture gaps — status

| Gap                                                       | Status                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1 — `freshness_state` defaults `'current'`, never written | 🔴 **Now proven load-bearing.** The reprint would be recorded `current`; §B proves that false          |
| 2 — `knowledge_source_type` cannot express bill/draft     | 🟠 Migration deferred; Bills excluded regardless                                                       |
| 3 — No fetcher, parser, or OCR                            | 🟠 `ingestSource` takes `drafts: unknown[]`                                                            |
| 4 — No amendment-chain representation in schema           | 🟠 Manifest for now; revisit after BS-v0.1                                                             |
| 5 — **Source-status authority hierarchy not modelled**    | 🔴 **New.** §E.4 R1/R2: a document may come from DIR, but its _status_ may only come from the register |

---

## Sources consulted this pass

**Fetched documents:** VAT (Amendment) Act 2026 (No. 4 of 2026) · Data Protection Act 2025 (No. 74 of 2025)
· National Youth Commission Bill 2026 (`BILLS/2026/2026-0004`) · VAT (Amendment) Act 2025 (No. 3 of 2025) ·
VAT (Amendment) (No.2) Act 2025 (No. 45 of 2025) · VAT Act reprint Ch. 370A · Data Protection Act Ch. 324A
· VAT (Amdt) (No.2) Bill 2026 · VAT-Rule-2015-025 · Transitional-Hotel-Booking 2018 · VAT-Rules-Gazetted.

**Fetched indexes:** `laws.bahamas.gov.bs/cms/` · Acts by Year 2026 · Not in Force (Principal) · Not in
Force (Amending) · DIR _Legal - VAT_.

All retrieved 2026-08-23.
