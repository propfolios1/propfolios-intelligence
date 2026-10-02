import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { MEMO_PROMPT_VERSION, MEMO_SYSTEM } from "../prompts/memo_v1";
import { replayMemo, type HouseStyle } from "../replay";
import { memoOutput, type memoInput } from "../schemas";
import { payload, runAgent } from "./_run";

const ALLOWED = /<\/?(h2|h3|p|ul|ol|li|strong|em|blockquote|br)\b[^>]*>/gi;

/** Keeps only the semantic tags the memo editor and PDF renderer support. */
export function sanitiseMemoHtml(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, (tag) => (tag.match(ALLOWED) ? tag.replace(/\s+[a-z-]+="[^"]*"/gi, "") : ""));
}

/** Drafts the client-ready Allocation (or Exit) Memo from the committee's evidence. */
export async function memo(
  input: z.infer<typeof memoInput> & {
    allocationLocal: number;
    houseStyle?: HouseStyle;
    sensitivity?: { driver: string; low: number; high: number }[];
    assumptions?: { assumption: string; basis: string }[];
  },
  ctx: AgentContext,
) {
  const style = input.houseStyle;
  const run = await runAgent({
    agent: "memo",
    action: `memo draft (${MEMO_PROMPT_VERSION})`,
    system: MEMO_SYSTEM,
    user: payload(
      style
        ? `Draft the memo for ${style.brandName}. HOUSE STYLE: ${style.tone} Close with the sign-off "${style.signoff}". Write a complete committee pack: executive summary, recommendation, thesis, returns with every scenario, sensitivity, asset, market, developer, comparable evidence, each due diligence finding, risks, both sides of the debate, regulatory and tax, conditions, next steps, and appendices for assumptions and sources.`
        : "Draft the memo.",
      input,
    ),
    schema: memoOutput,
    toolName: "submit_memo",
    toolDescription: "Submit the memo title, HTML body and key metrics.",
    ctx,
    replay: () => replayMemo(input.context, input.research, input.scenarios, input.findings, input.debate, input.allocationLocal, style, { sensitivity: input.sensitivity, assumptions: input.assumptions }),
    replayMs: 3800,
  });
  run.output.html = sanitiseMemoHtml(run.output.html);
  return run;
}
