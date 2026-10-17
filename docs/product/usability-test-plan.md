# Usability test plan: Bahamas pilot

**Status:** Planned. No sessions have been run, and the targets below are targets, not
results.

## Who

8–10 people in The Bahamas who have a business idea or run a small, informal business,
and who do not use business software day to day. Mix of age, island, and phone vs.
laptop. At least half should do the test on their own phone.

## Setup

- 30 minutes per person, one facilitator, think-aloud.
- Homepage: a build with `WAITLIST_ONLY_MODE=true` (what the public sees).
- App tasks: a staging build with `WAITLIST_ONLY_MODE=false` and a fresh test account
  per person. Never use real customer data. Delete the test accounts afterwards.
- Record: completion (yes / with help / no), time, where they hesitated, their words.

## Tasks

| #   | Task                                                                                       | Success looks like                                             |
| --- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1   | Look at the homepage for 10 seconds, then look away. "What is Islanda meant to help with?" | Mentions starting/organising a business in The Bahamas         |
| 2   | "Can you use it today? What would you do next?"                                            | Says it is not open yet / early access, and names the waitlist |
| 3   | "Which of these can you do today, and which are not ready?" (point at the page)            | Separates the "today" list from "building next"                |
| 4   | Join the waitlist.                                                                         | Submits, and can say what happens next                         |
| 5   | (App) Add your business idea.                                                              | Reaches Build my business and creates a business unaided       |
| 6   | Answer the five questions. Stop after question 2, come back, and finish.                   | Resumes where they left off; reaches Home                      |
| 7   | "Where is everything you've told Islanda?"                                                 | Finds My Business or Business details                          |
| 8   | Add a photo of a receipt as a document.                                                    | Uploads; can say whether Islanda read it (it did not)          |
| 9   | Ask Nova: "When do I need to register for VAT?" "Where did that answer come from?"         | Opens or names the source document                             |
| 10  | Ask Nova something it can't answer (e.g. a food licence). "What did Nova tell you?"        | Understands Nova did not find it, and where to check instead   |

## Targets

- ≥ 80% can explain what Islanda is for after 10 seconds (task 1).
- ≥ 80% can tell available features from ones still being built (task 3).
- ≥ 90% find the correct next action (tasks 2 and 5).
- Report anything a participant reads as an official government service, or as legal
  advice, as a critical issue, whatever the count.
