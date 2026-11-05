/**
 * Interview DSL. An interview is a graph of steps. Steps are declarative and
 * serializable except for `next`, which may be a function of the answers so far.
 *
 * Design rules:
 *  - One question per screen. Big tappable options. Single-choice auto-advances.
 *  - Contact is captured early (by step 3–4) so a partial interview is a lead.
 *  - Free text is rare and optional; when present it is the *story*, extracted by AI.
 *  - Uploads are inline, never a wall of 25 file inputs.
 *  - Brand may switch mid-interview (`brand` on a step), e.g. a sister brand for one path.
 */
/** A brand/skin id. Your app decides what the strings mean. */
export type Brand = string;

export type Answers = Record<string, unknown>;

export interface Option {
  value: string;
  label: string;
  hint?: string;
  /** small inline SVG name from the icon set, optional */
  icon?: string;
  /** Still a valid answer (presets, triage), but not shown as a tile. */
  hidden?: boolean;
  /** Shortcut tile: tapping it also sets these answers and skips the steps they answer. */
  also?: Answers;
}

interface BaseStep {
  id: string;
  /** progress group label, e.g. "Situation", "You", "Property", "Evidence" */
  section: string;
  title: string;
  subtitle?: string;
  brand?: Brand;
  /** default: next step in array order */
  next?: string | ((a: Answers) => string);
  showIf?: (a: Answers) => boolean;
}

export type Step =
  | (BaseStep & { kind: 'choice'; options: Option[]; autoAdvance?: boolean })
  | (BaseStep & { kind: 'multi'; options: Option[]; min?: number })
  | (BaseStep & { kind: 'yesno' })
  | (BaseStep & { kind: 'text'; placeholder?: string; inputType?: 'text' | 'number' | 'date'; required?: boolean; maxLength?: number })
  | (BaseStep & { kind: 'story'; placeholder?: string; required?: boolean })
  | (BaseStep & { kind: 'contact'; askPhone?: boolean; askCompany?: boolean; askRole?: boolean })
  | (BaseStep & { kind: 'address' })
  | (BaseStep & { kind: 'upload'; accept: string; max: number; label: string; why: string; required?: boolean })
  | (BaseStep & { kind: 'info'; body: string; cta?: string })
  | (BaseStep & { kind: 'review' });

export interface Interview {
  id: string;
  version: number;
  title: string;
  steps: Step[];
}

export const END = '__end__';

/** Resolve the next step id given a step and the answers. */
export function nextStepId(interview: Interview, currentId: string, answers: Answers): string {
  const idx = interview.steps.findIndex((s) => s.id === currentId);
  if (idx < 0) throw new Error(`unknown step ${currentId}`);
  const step = interview.steps[idx]!;
  let target: string;
  if (typeof step.next === 'function') target = step.next(answers);
  else if (typeof step.next === 'string') target = step.next;
  else target = interview.steps[idx + 1]?.id ?? END;
  // skip steps whose showIf is false
  while (target !== END) {
    const t = interview.steps.find((s) => s.id === target);
    if (!t) throw new Error(`unknown next step ${target}`);
    if (!t.showIf || t.showIf(answers)) return target;
    const tIdx = interview.steps.indexOf(t);
    target = typeof t.next === 'string' ? t.next : typeof t.next === 'function' ? t.next(answers) : (interview.steps[tIdx + 1]?.id ?? END);
  }
  return END;
}

/** Ordered list of step ids actually visited for a given answer set (for progress + review). */
export function path(interview: Interview, answers: Answers, from = interview.steps[0]!.id): string[] {
  const out: string[] = [];
  let id = from;
  let guard = 0;
  while (id !== END && guard++ < 200) {
    out.push(id);
    id = nextStepId(interview, id, answers);
  }
  return out;
}

export const step = <S extends Step>(s: S): S => s;
