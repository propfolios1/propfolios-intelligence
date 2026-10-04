import "server-only";
import type { z } from "zod";
import type { AgentModule, DefinedAgent } from "../agents/define";
import { BI_AGENTS } from "./bi";
import { BROKERAGE_AGENTS } from "./brokerage";
import { CLIENT_AGENTS } from "./client";
import { COMMISSION_AGENTS } from "./commission";
import { DEAL_AGENTS } from "./deals";
import { FABRIC_AGENTS } from "./fabric";
import { INDIA_AGENTS } from "./india";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyOsAgent = DefinedAgent<z.ZodType<any>, z.ZodType<any>>;

/** Every vertical-OS agent, in catalogue order (numbered from 14; 1 to 13 are the core mandate agents). */
export const OS_AGENTS: AnyOsAgent[] = [...INDIA_AGENTS, ...DEAL_AGENTS, ...COMMISSION_AGENTS, ...CLIENT_AGENTS, ...BI_AGENTS, ...FABRIC_AGENTS, ...BROKERAGE_AGENTS] as unknown as AnyOsAgent[];

export const OS_AGENT_INDEX: Record<string, AnyOsAgent> = Object.fromEntries(OS_AGENTS.map((a) => [a.name, a]));

export const agentNumber = (name: string) => {
  const i = OS_AGENTS.findIndex((a) => a.name === name);
  return i < 0 ? null : 14 + i;
};

export const MODULE_LABEL: Record<AgentModule, string> = { core: "Mandate pipeline", india: "India", deals: "Deal execution", commission: "Commission", client: "Client layer", bi: "Business intelligence", fabric: "OS fabric", brokerage: "Brokerage" };
