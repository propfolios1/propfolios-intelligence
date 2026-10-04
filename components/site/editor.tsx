"use client";

import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import type { BlockType } from "@/db/schema-production";
import { BLOCK_LABEL, BLOCK_TYPES } from "@/lib/website/blocks";
import { cn } from "@/lib/utils";

type Block = { type: BlockType; content: Record<string, unknown>; _id: string };
type Page = { id: string; slug: string; title: string; blocks: { type: BlockType; content: Record<string, unknown> }[]; published: boolean };

const uid = () => Math.random().toString(36).slice(2, 10);
const DEFAULTS: Record<BlockType, Record<string, unknown>> = {
  hero: { headline: "Homes worth moving for.", subheadline: "", imageUrl: null, ctaLabel: "View listings", ctaHref: "/listings" },
  featured_listings: { title: "Featured listings", purpose: "all", limit: 6 },
  agent_grid: { title: "Our agents", intro: "" },
  testimonials: { title: "What clients say", items: [] },
  contact: { title: "Speak to an agent", intro: "" },
  about: { title: "About the firm", body: "" },
  areas: { title: "Areas we cover", intro: "" },
  market_stats: { title: "The market this quarter", intro: "" },
};

function Row({ b, selected, onSelect, onRemove }: { b: Block; selected: boolean; onSelect: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: b._id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-2 rounded-sm border bg-surface px-2 py-2 transition-shadow duration-150", selected ? "border-navy-900" : "border-hairline", isDragging && "z-10 shadow-[0_8px_24px_rgba(10,31,68,0.12)]")}>
      <button type="button" className="cursor-grab touch-none p-1 text-ink-400 hover:text-ink-700" aria-label={`Drag to reorder ${BLOCK_LABEL[b.type]}`} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate text-start text-ui text-ink-900">
        {BLOCK_LABEL[b.type]}
        <span className="ms-2 text-[12px] text-ink-500">{String(b.content.title ?? b.content.headline ?? "")}</span>
      </button>
      <button type="button" onClick={onRemove} className="p-1 text-ink-400 hover:text-danger" aria-label={`Remove ${BLOCK_LABEL[b.type]}`}>
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function BlockForm({ b, onChange }: { b: Block; onChange: (c: Record<string, unknown>) => void }) {
  const c = b.content;
  const text = (k: string, label: string, multi = false, hint?: string) => (
    <FormField label={label} hint={hint}>
      {multi ? <Textarea rows={k === "body" ? 8 : 3} value={String(c[k] ?? "")} onChange={(e) => onChange({ ...c, [k]: e.target.value })} /> : <Input value={String(c[k] ?? "")} onChange={(e) => onChange({ ...c, [k]: e.target.value })} />}
    </FormField>
  );
  if (b.type === "hero")
    return (
      <div className="grid gap-4">
        {text("headline", "Headline")}
        {text("subheadline", "Supporting line", true)}
        <FormField label="Background image URL" hint="A wide photograph, at least 1600 pixels across. Without one the brand colour is used.">
          <Input value={String(c.imageUrl ?? "")} onChange={(e) => onChange({ ...c, imageUrl: e.target.value || null })} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("ctaLabel", "Button label")}
          {text("ctaHref", "Button link", false, "A page path, such as /listings or /contact.")}
        </div>
      </div>
    );
  if (b.type === "featured_listings")
    return (
      <div className="grid gap-4">
        {text("title", "Title")}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Listings shown">
            <Select value={String(c.purpose ?? "all")} onChange={(e) => onChange({ ...c, purpose: e.target.value })}>
              <option value="all">For sale and to let</option>
              <option value="sale">For sale</option>
              <option value="rent">To let</option>
            </Select>
          </FormField>
          <FormField label="Number of listings">
            <Input type="number" min={3} max={24} className="num" value={Number(c.limit ?? 6)} onChange={(e) => onChange({ ...c, limit: Math.max(3, Math.min(24, Number(e.target.value) || 6)) })} />
          </FormField>
        </div>
        <p className="text-[12px] text-ink-500">Listings are read live from the workspace: active and under-offer listings appear, sold and let listings drop off.</p>
      </div>
    );
  if (b.type === "testimonials") {
    const items = (c.items as { quote: string; author: string; context: string }[]) ?? [];
    return (
      <div className="grid gap-4">
        {text("title", "Title")}
        {items.map((t, i) => (
          <div key={i} className="grid gap-2 rounded-sm border border-hairline p-3">
            <Textarea rows={3} placeholder="The client's words, with their permission" value={t.quote} onChange={(e) => onChange({ ...c, items: items.map((x, k) => (k === i ? { ...x, quote: e.target.value } : x)) })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Name" value={t.author} onChange={(e) => onChange({ ...c, items: items.map((x, k) => (k === i ? { ...x, author: e.target.value } : x)) })} />
              <Input placeholder="Context, such as Bought in Dubai Hills" value={t.context} onChange={(e) => onChange({ ...c, items: items.map((x, k) => (k === i ? { ...x, context: e.target.value } : x)) })} />
            </div>
            <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => onChange({ ...c, items: items.filter((_, k) => k !== i) })}>
              Remove
            </Button>
          </div>
        ))}
        <Button size="sm" variant="secondary" className="justify-self-start" onClick={() => onChange({ ...c, items: [...items, { quote: "", author: "", context: "" }] })}>
          Add a client testimonial
        </Button>
        <p className="text-[12px] text-ink-500">Publish only testimonials clients have agreed to share. The block is hidden while it has none.</p>
      </div>
    );
  }
  if (b.type === "about")
    return (
      <div className="grid gap-4">
        {text("title", "Title")}
        {text("body", "Text", true, "Separate paragraphs with a blank line.")}
      </div>
    );
  return (
    <div className="grid gap-4">
      {text("title", "Title")}
      {text("intro", "Introduction", true)}
      <p className="text-[12px] text-ink-500">{b.type === "agent_grid" ? "Shows the firm's administrators and agents." : b.type === "contact" ? "Enquiries arrive as leads sourced to the website, assigned like any other lead." : "Figures are computed live from active listings."}</p>
    </div>
  );
}

export function SiteEditor({ pages, previewBase, token, publishedAt }: { pages: Page[]; previewBase: string; token: string; publishedAt: string | null }) {
  const router = useRouter();
  const [pageId, setPageId] = React.useState(pages[0]?.id ?? "");
  const page = pages.find((p) => p.id === pageId) ?? pages[0]!;
  const [blocks, setBlocks] = React.useState<Block[]>(page.blocks.map((b) => ({ ...b, _id: uid() })));
  const [sel, setSel] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [frameKey, setFrameKey] = React.useState(0);
  const [adding, setAdding] = React.useState<BlockType>("hero");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  React.useEffect(() => {
    setBlocks(page.blocks.map((b) => ({ ...b, _id: uid() })));
    setSel(null);
    setDirty(false);
  }, [page]);

  const update = (next: Block[]) => {
    setBlocks(next);
    setDirty(true);
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = blocks.findIndex((b) => b._id === e.active.id);
    const to = blocks.findIndex((b) => b._id === e.over!.id);
    update(arrayMove(blocks, from, to));
  };
  const save = async () => {
    setBusy("save");
    const res = await fetch(`/api/website/pages/${page.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ blocks: blocks.map(({ type, content }) => ({ type, content })) }) });
    setBusy(null);
    if (!res.ok) return toast.error("Not saved", { description: (await res.json().catch(() => ({}))).error });
    setDirty(false);
    setFrameKey((k) => k + 1);
    router.refresh();
  };
  const publish = async () => {
    if (dirty) await save();
    setBusy("publish");
    const r = await post("/api/website", { action: "publish" }, { fail: "Not published" });
    setBusy(null);
    if (r) {
      toast.success("Website published", { description: "Every page is live with the current drafts." });
      router.refresh();
    }
  };
  const addPage = async () => {
    const title = window.prompt("Page title");
    if (!title) return;
    const r = await post("/api/website", { action: "add_page", title }, { fail: "Page not added" });
    if (r) router.refresh();
  };
  const selected = blocks.find((b) => b._id === sel) ?? null;
  const src = `${previewBase}${page.slug === "home" ? "" : `/${page.slug}`}?preview=${encodeURIComponent(token)}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {pages.map((p) => (
            <button key={p.id} type="button" onClick={() => setPageId(p.id)} className={cn("h-8 rounded-sm border px-3 text-[13px] transition-colors duration-150", p.id === page.id ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline text-ink-700 hover:bg-ink-50")}>
              {p.title}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={addPage}>
            <Plus className="size-3.5" aria-hidden /> Page
          </Button>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="label-caps">Blocks on {page.title}</h2>
            <span className="text-[12px] text-ink-500">Drag to reorder</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b._id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5">
                {blocks.map((b) => (
                  <Row key={b._id} b={b} selected={sel === b._id} onSelect={() => setSel(b._id)} onRemove={() => update(blocks.filter((x) => x._id !== b._id))} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <div className="mt-3 flex gap-2">
            <Select className="h-9 flex-1" value={adding} onChange={(e) => setAdding(e.target.value as BlockType)} aria-label="Block to add">
              {BLOCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BLOCK_LABEL[t]}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const b = { type: adding, content: { ...DEFAULTS[adding] }, _id: uid() };
                update([...blocks, b]);
                setSel(b._id);
              }}
            >
              Add block
            </Button>
          </div>
        </div>
        {selected && (
          <div className="rounded-md border border-hairline bg-surface p-4">
            <h3 className="mb-4 text-ui font-medium text-ink-900">{BLOCK_LABEL[selected.type]}</h3>
            <BlockForm b={selected} onChange={(content) => update(blocks.map((b) => (b._id === selected._id ? { ...b, content } : b)))} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
          <Button variant="secondary" onClick={save} disabled={!dirty || Boolean(busy)}>
            {busy === "save" ? "Saving" : dirty ? "Save draft" : "Draft saved"}
          </Button>
          <Button onClick={publish} disabled={Boolean(busy)}>
            {busy === "publish" ? "Publishing" : "Publish website"}
          </Button>
          <span className="text-[12px] text-ink-500">{publishedAt ? `Last published ${publishedAt.slice(0, 16).replace("T", " ")} UTC` : "Not yet published"}</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-hairline bg-surface">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2 text-[12px] text-ink-500">
          <span>Preview of the saved draft</span>
          <Link href={src} target="_blank" className="text-navy-900 hover:underline">
            Open in a new tab
          </Link>
        </div>
        <iframe key={frameKey} title="Website preview" src={src} className="h-[780px] w-full" />
      </div>
    </div>
  );
}
