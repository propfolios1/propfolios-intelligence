import { describe, expect, it } from "vitest";
import { OS_AGENTS } from "@/lib/ai/os-agents/registry";
import { InMemoryMemoryStore } from "@/lib/ai/memory/store";
import { type AgentRunRecord, withAgentRuntime } from "@/lib/ai/runtime";
import { MockLLMClient } from "@/lib/ai/testing/mock-llm";

const TENANT = "00000000-0000-4000-8000-000000000001";

describe("vertical OS agents", () => {
  it("are uniquely named and carry a versioned prompt", () => {
    const names = OS_AGENTS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    for (const a of OS_AGENTS) {
      expect(a.promptVersion).toMatch(/_v\d+$/);
      expect(a.system.length).toBeGreaterThan(800);
      expect(a.system).toMatch(/EXAMPLES|Example/);
    }
  });

  for (const agent of OS_AGENTS) {
    it(`${agent.name}: validates, audits, costs under $0.50 and stores memory`, async () => {
      const llm = new MockLLMClient();
      const memory = new InMemoryMemoryStore();
      const records: AgentRunRecord[] = [];
      const run = await withAgentRuntime({ llm, memory, recorder: async (r) => void records.push(r), skipControl: true }, () => agent.run(agent.sample, { tenantId: TENANT, actor: "test" }));
      expect(agent.output.safeParse(run.output).success).toBe(true);
      expect(run.output.headline.length).toBeGreaterThan(10);
      expect(run.output.headline).not.toMatch(/!/);
      expect(llm.calls).toHaveLength(1);
      expect(llm.calls[0]!.agent).toBe(agent.name);
      expect(records).toHaveLength(1);
      expect(records[0]!.agent).toBe(agent.name);
      expect(records[0]!.costUsd).toBeLessThan(0.5);
      const last = await memory.list(TENANT, { agentName: agent.name, memoryType: "last_output" });
      expect(last).toHaveLength(1);
    });
  }

  it("uses a fixture when the mock is given one, and rejects output that breaks the schema", async () => {
    const agent = OS_AGENTS[0]!;
    const bad = new MockLLMClient({ [agent.name]: { headline: "x" } });
    await expect(withAgentRuntime({ llm: bad, memory: new InMemoryMemoryStore(), recorder: async () => {}, skipControl: true }, () => agent.run(agent.sample, { tenantId: TENANT, actor: "test" }))).rejects.toThrow();
  });
});
