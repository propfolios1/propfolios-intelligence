import { z } from "zod";
import type { BlockType } from "@/db/schema-production";

/**
 * Block types and their content. Blocks that show firm data (featured
 * listings, agents, areas, market statistics) read it live when the page
 * renders, so the site never goes stale; the content here only configures them.
 */
export const BLOCK_SCHEMAS = {
  hero: z.object({ headline: z.string().min(2).max(140), subheadline: z.string().max(280).default(""), imageUrl: z.string().url().nullable().default(null), ctaLabel: z.string().max(40).default("View listings"), ctaHref: z.string().max(200).default("/listings") }),
  featured_listings: z.object({ title: z.string().max(80).default("Featured listings"), purpose: z.enum(["all", "sale", "rent"]).default("all"), limit: z.number().int().min(3).max(24).default(6) }),
  agent_grid: z.object({ title: z.string().max(80).default("Our agents"), intro: z.string().max(400).default("") }),
  testimonials: z.object({ title: z.string().max(80).default("What clients say"), items: z.array(z.object({ quote: z.string().min(10).max(600), author: z.string().min(2).max(80), context: z.string().max(80).default("") })).max(12).default([]) }),
  contact: z.object({ title: z.string().max(80).default("Speak to an agent"), intro: z.string().max(400).default("") }),
  about: z.object({ title: z.string().max(80).default("About the firm"), body: z.string().max(4000).default("") }),
  areas: z.object({ title: z.string().max(80).default("Areas we cover"), intro: z.string().max(400).default("") }),
  market_stats: z.object({ title: z.string().max(80).default("The market this quarter"), intro: z.string().max(400).default("") }),
} satisfies Record<BlockType, z.ZodType>;

export const BLOCK_LABEL: Record<BlockType, string> = { hero: "Hero", featured_listings: "Featured listings", agent_grid: "Agent grid", testimonials: "Testimonials", contact: "Contact form", about: "About", areas: "Areas", market_stats: "Market statistics" };
export const BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS) as BlockType[];

export type Block = { type: BlockType; content: Record<string, unknown> };

export function parseBlock(b: { type: string; content: unknown }): Block {
  const schema = BLOCK_SCHEMAS[b.type as BlockType];
  if (!schema) throw new Error(`Unknown block type ${b.type}.`);
  return { type: b.type as BlockType, content: schema.parse(b.content ?? {}) as Record<string, unknown> };
}

/** The pages a new site starts with, written from the firm's own name and market. */
export function defaultPages(firm: string, market: string, city: string): { slug: string; title: string; blocks: Block[] }[] {
  return [
    {
      slug: "home",
      title: firm,
      blocks: [
        { type: "hero", content: { headline: `Property in ${city}, advised properly.`, subheadline: `${firm} buys, sells and lets homes across ${market}. Every listing below is live and current.`, imageUrl: null, ctaLabel: "View listings", ctaHref: "/listings" } },
        { type: "featured_listings", content: { title: "Featured listings", purpose: "all", limit: 6 } },
        { type: "market_stats", content: { title: "The market this quarter", intro: "Figures from the firm's live listings, updated whenever a listing changes." } },
        { type: "agent_grid", content: { title: "Our agents", intro: "" } },
        { type: "contact", content: { title: "Speak to an agent", intro: "Tell us what you are looking for; an agent replies within the working day." } },
      ],
    },
    { slug: "listings", title: "Listings", blocks: [{ type: "featured_listings", content: { title: "All listings", purpose: "all", limit: 24 } }] },
    { slug: "areas", title: "Areas", blocks: [{ type: "areas", content: { title: "Areas we cover", intro: `Communities where ${firm} has listings today.` } }, { type: "market_stats", content: { title: "Prices by community", intro: "" } }] },
    { slug: "about", title: "About", blocks: [{ type: "about", content: { title: `About ${firm}`, body: `${firm} is a licensed real estate brokerage in ${market}.` } }, { type: "agent_grid", content: { title: "The team", intro: "" } }] },
    { slug: "contact", title: "Contact", blocks: [{ type: "contact", content: { title: "Contact", intro: "Send a message and an agent will reply within the working day." } }] },
  ];
}
