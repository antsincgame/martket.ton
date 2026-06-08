import { describe, it, expect } from 'vitest';
import { buildAssistantReply } from './assistant.js';
import type { InstructionSection } from './instructions.js';
import type { OnboardingChecklist } from './status.js';

const sections: InstructionSection[] = [
  { section: 'kyc', title: 'Verification', body: 'kyc body', order: 40, active: true, source: 'default' },
  { section: 'behavior', title: 'How to behave', body: 'behavior body', order: 50, active: true, source: 'default' },
];

function onboarding(step: string, section: string): OnboardingChecklist {
  return {
    kyc: { status: 'none', ok: false },
    storage: { status: 'unconfigured', connected: false, provider: null },
    catalog: { listings: 0, hasListings: false },
    distribution: { configured: false, verified: false },
    readyToSell: false,
    nextStep: 'do the thing',
    nextAction: {
      step: step as OnboardingChecklist['nextAction']['step'],
      message: 'Complete X',
      section,
      api: null,
      ui: { label: 'X', hint: 'h' },
      external: null,
    },
  };
}

describe('buildAssistantReply — onboarding assistant MVP mockup', () => {
  it('flags mockup, grounds the answer in the next action, and cites the section', () => {
    const r = buildAssistantReply('how do I start selling?', sections, onboarding('kyc', 'kyc'));
    expect(r.assistant).toBe('mockup');
    expect(r.note).toMatch(/LLM/);
    expect(r.answer).toBe('Complete X');
    expect(r.nextAction.step).toBe('kyc');
    expect(r.citation).toEqual({ section: 'kyc', title: 'Verification' });
    expect(r.section?.section).toBe('kyc');
    expect(r.question).toBe('how do I start selling?');
  });

  it('citation is null when no section matches the next action', () => {
    const r = buildAssistantReply('q', sections, onboarding('create_product', 'onboarding'));
    expect(r.citation).toBeNull();
    expect(r.section).toBeNull();
  });
});
