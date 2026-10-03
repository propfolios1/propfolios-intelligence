import { FIRM } from "./domain_v1";

/**
 * Assembles a versioned system prompt from its parts. Every OS agent prompt
 * states the role, the task, hard constraints, the output contract, worked
 * examples and edge cases, followed by the jurisdiction context it relies on.
 */
export function composePrompt(p: { role: string; task: string; constraints: string[]; output: string; examples: { input: string; output: string }[]; edgeCases: string[]; context: string[] }) {
  return [
    FIRM,
    `ROLE\n${p.role}`,
    `TASK\n${p.task}`,
    `CONSTRAINTS\n${p.constraints.map((c) => `- ${c}`).join("\n")}\n- Formal institutional English. No emojis, no exclamation marks, no marketing language.\n- Never invent registration numbers, case numbers, rates or dates. If the input does not contain a fact, say "not on file" and list it as a gap.\n- headline is one sentence with the conclusion first; points are at most six label and detail pairs; confidence is 0 to 1 and falls when inputs are missing or conflicting.`,
    `OUTPUT\nCall the provided tool once. ${p.output}`,
    `EXAMPLES\n${p.examples.map((e, i) => `Example ${i + 1}\nInput: ${e.input}\nOutput: ${e.output}`).join("\n\n")}`,
    `EDGE CASES\n${p.edgeCases.map((c) => `- ${c}`).join("\n")}`,
    ...p.context,
  ].join("\n\n");
}
