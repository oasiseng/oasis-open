/**
 * A small example interview: "what do you need?" → a branch per need → contact → evidence → review.
 * Run `node --test` to see the path functions exercise it; wire the steps to your own UI.
 */
import { step, type Interview, type Answers } from './index.ts';

const isLetter = (a: Answers) => a.need === 'letter';
const isDesign = (a: Answers) => a.need === 'design';

export const EXAMPLE: Interview = {
  id: 'example',
  version: 1,
  title: 'Tell us what you need',
  steps: [
    step({
      id: 'need', section: 'Situation', title: 'What do you need?', kind: 'choice', autoAdvance: true,
      options: [
        { value: 'letter', label: 'A letter for a permit or inspection', hint: 'Something already built or installed' },
        { value: 'design', label: 'Drawings for something new', hint: 'An addition, a structure, a remodel' },
        { value: 'other', label: 'Something else', hidden: true },
      ],
    }),
    step({ id: 'letter.who', section: 'Situation', title: 'Who is asking for the letter?', kind: 'choice', showIf: isLetter, options: [{ value: 'ahj', label: 'City or county' }, { value: 'lender', label: 'A lender or buyer' }, { value: 'hoa', label: 'An HOA or insurer' }] }),
    step({ id: 'letter.visible', section: 'Situation', title: 'Is the work still visible?', kind: 'yesno', showIf: isLetter }),
    step({ id: 'design.what', section: 'Situation', title: 'What are you building?', kind: 'multi', min: 1, showIf: isDesign, options: [{ value: 'addition', label: 'Addition' }, { value: 'pergola', label: 'Pergola or patio' }, { value: 'wall', label: 'Removing a wall' }] }),
    step({ id: 'contact', section: 'You', title: 'Where should we send the quote?', kind: 'contact', askPhone: true }),
    step({ id: 'address', section: 'Property', title: 'Project address', kind: 'address' }),
    step({ id: 'story', section: 'Evidence', title: 'Anything else we should know?', kind: 'story', placeholder: 'A few sentences is plenty.' }),
    step({ id: 'files', section: 'Evidence', title: 'Photos or documents', kind: 'upload', accept: 'image/*,application/pdf', max: 10, label: 'Add photos or PDFs', why: 'The engineer quotes from what they can see.' }),
    step({ id: 'review', section: 'Review', title: 'Check and send', kind: 'review' }),
  ],
};
