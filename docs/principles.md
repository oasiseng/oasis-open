# The language model never decides money

One rule shaped the Oasis platform more than any other, and it is the one most worth copying: **the language model fills fields with provenance; deterministic rules decide money, identity, eligibility and routing.**

## What that means in practice

The model reads what the client wrote, the photos and the documents, and records facts: "beam span about 21 ft (from photo 3)", "the inspector's notice cites R502.3 (from the PDF)", "the client says the work is covered". Every fact carries where it came from and how confident the reader was. That is the model's whole job on the way in.

Everything that follows is code you can read and test:

- **Price.** A price table keyed on service, scope class and a few measured facts. The model never proposes a number; if you find yourself asking it for one, stop.
- **Eligibility.** "Can we seal this in that state?" is a lookup against the licence list, not a judgment call.
- **Routing.** Which lane, which partner, which brand: a function of the answers, with a rule id in the trail.
- **Money movement.** Invoices, splits, transfers and refunds are arithmetic on integer cents, idempotent by action key, reviewed by a person when they change.

On the way out, the model may draft words (a quote's intro, a case study, a reminder), and a person approves them. Drafting is not deciding.

## Why

Three reasons, in order of how often they bite.

**Provenance is what you are selling.** A professional's output is an opinion about evidence. When every field says which photo or page it came from, the engineer can check it in seconds, and the record shows what was known when the opinion was given. A number the model "felt" has no provenance and no defence.

**Rules are cheap to test and cheap to run.** A price table has unit tests. A classification function has unit tests. You can replay a year of intakes through a changed rule and see exactly what would move. Nothing about a prompt gives you that, and the model call costs money every time.

**The failure modes are different.** When a rule is wrong it is wrong the same way every time, which makes it findable. When a model is wrong it is wrong confidently and differently each time, which makes it a liability. Keep the model where confident variation is harmless (reading, summarising, drafting) and out of where it is not (charging, promising, qualifying).

## The shape of a project file

A single JSON document per request, schema-versioned, that only ever gains fields. The interview writes answers into it; the reader adds extracted facts with provenance; the rules add verdicts, price mode and route, each with a rule id; the quote, payments and deliverables hang off it; every outbound action has a stable action key so it runs once. Nothing is repurposed, so an old file still reads correctly under a new version.

That file is the contract between every part of the system, and between the system and the person who signs the work.

## Corollaries that fell out of the rule

- Reject ambiguous totals; never substitute zero.
- One writer per business action (the action key), so retries and crashes cannot double-charge or double-send.
- A model that is asked for a structured answer gets a tool schema, and the code tolerates the model declining to use it.
- Owner review is required for any change to prices, scope templates, payment flows or permissions, and the change log says so.
- Anything a client could be charged for, promised, or disqualified from is visible on one page the owner can read before it goes out.
