# interview-dsl

A tiny declarative DSL for tap-first intake interviews: the kind of form where each screen asks one question with big tappable options, a single choice advances on its own, and a half-finished interview is still a usable lead because contact details were captured early.

An interview is an ordered list of steps. Every step is plain data except `next` and `showIf`, which may be functions of the answers so far. That keeps interviews serializable, testable and easy to reason about, while still allowing real branching.

```ts
import { step, path, nextStepId, type Interview } from './src/index.ts';

const iv: Interview = {
  id: 'example', version: 1, title: 'Tell us what you need',
  steps: [
    step({ id: 'need', section: 'Situation', title: 'What do you need?', kind: 'choice', autoAdvance: true,
      options: [{ value: 'letter', label: 'A letter for a permit' }, { value: 'design', label: 'Drawings for something new' }] }),
    step({ id: 'letter.who', section: 'Situation', title: 'Who is asking?', kind: 'choice', showIf: (a) => a.need === 'letter', options: [/* … */] }),
    step({ id: 'contact', section: 'You', title: 'Where should we send the quote?', kind: 'contact', askPhone: true }),
    step({ id: 'files', section: 'Evidence', title: 'Photos or documents', kind: 'upload', accept: 'image/*,application/pdf', max: 10, label: 'Add files', why: 'The engineer quotes from what they can see.' }),
    step({ id: 'review', section: 'Review', title: 'Check and send', kind: 'review' }),
  ],
};

path(iv, { need: 'design' }); // ['need', 'contact', 'files', 'review'] — letter.who skipped
```

## Step kinds

`choice` (one tile; `autoAdvance` moves on at the tap), `multi` (several tiles, optional `min`), `yesno`, `text` (with `inputType` text / number / date), `story` (the one free-text box, meant to be read by a model), `contact`, `address`, `upload` (inline, with a one-line `why`), `info` (a screen with a body and a call to action) and `review`.

Options can be `hidden` (valid for presets and deep links, not shown as a tile) and can carry `also`, extra answers a shortcut tile sets so the steps they answer are skipped.

## Functions

- `nextStepId(interview, currentId, answers)`: the next visible step id, honouring `next` and `showIf`, or `END`.
- `path(interview, answers, from?)`: the ordered list of step ids a given answer set visits, for progress bars and review screens.
- `step(s)`: an identity helper that gives you type inference per step kind.

See `src/example.ts` and `src/index.test.ts` for a complete interview and the branches it takes. The rendering layer (tiles, uploads, resume links) is yours to write; this package only owns the graph.

## Design rules it encodes

- One question per screen. Big tappable options. Single choice auto-advances.
- Contact is captured by step three or four, so an abandoned interview is still a lead you can follow up.
- Free text is rare and optional; when present it is the story, extracted by a model into fields with provenance, never used to decide price or eligibility.
- Uploads are inline, never a wall of file inputs.
- A step may carry a `brand`, so one interview can switch skin mid-way (a sister brand for one path).
