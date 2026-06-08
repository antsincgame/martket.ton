import type { InstructionSection } from './instructions.js';
import type { OnboardingChecklist } from './status.js';

export interface AssistantReply {
  assistant: 'mockup';
  note: string;
  question: string;
  answer: string;
  nextAction: OnboardingChecklist['nextAction'];
  citation: { section: string; title: string } | null;
  section: InstructionSection | null;
}

const MOCKUP_NOTE =
  'Deterministic onboarding assistant (MVP mockup). No LLM is connected yet — a grounded ' +
  'local-LLM copilot (LM Studio) is planned. The answer is your current next action plus the ' +
  'instruction section that explains it.';

/**
 * MVP MOCKUP of the onboarding assistant — grounded + deterministic, NO LLM.
 * Returns the agent's current next action and cites the instruction section that
 * explains it, with an honest `assistant: 'mockup'` flag. This lets the MCP
 * surface carry an assistant tool that is honest about its capability while the
 * real grounded copilot (LM Studio) is pending. Pure + exported for tests.
 */
export function buildAssistantReply(
  question: string,
  sections: InstructionSection[],
  onboarding: OnboardingChecklist,
): AssistantReply {
  const relevant = sections.find((s) => s.section === onboarding.nextAction.section) ?? null;
  return {
    assistant: 'mockup',
    note: MOCKUP_NOTE,
    question,
    answer: onboarding.nextAction.message,
    nextAction: onboarding.nextAction,
    citation: relevant ? { section: relevant.section, title: relevant.title } : null,
    section: relevant,
  };
}
