"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import * as React from "react";
import { LiveDot } from "@/components/primitives/live-dot";
import type { MandateStatus } from "@/lib/data/types";
import { MANDATE_STAGES, STAGE_LABEL } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export interface KanbanCard {
  id: string;
  status: MandateStatus;
  client: string;
  property: string;
  deadline: string;
  updatedAt: string;
  priority: "Standard" | "Priority";
}

function deadline(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), tone: "text-ink-3" };
  if (days === 0) return { text: "today", tone: "text-red" };
  return { text: `${days}d`, tone: days <= 2 ? "text-red" : "text-ink-2" };
}

/** An agent is working on the mandate if it moved in the last three hours. */
function isLive(c: KanbanCard) {
  return c.status !== "intake" && c.status !== "delivered" && Date.now() - new Date(c.updatedAt).getTime() < 3 * 3_600_000;
}

/**
 * Pipeline board. 320px columns, 20px apart, counts as mono superscripts.
 * A dragged card lifts 2px and takes an ink border; the landing slot shows
 * as a 2px dashed gold line.
 */
export function KanbanBoard({ cards: initial }: { cards: KanbanCard[] }) {
  const [cards, setCards] = React.useState(initial);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string>();
  const dndId = React.useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const byStage = React.useMemo(() => {
    const map = new Map<MandateStatus, KanbanCard[]>(MANDATE_STAGES.map((s) => [s, []]));
    cards.forEach((c) => map.get(c.status)!.push(c));
    return map;
  }, [cards]);

  const active = activeId ? cards.find((c) => c.id === activeId) : undefined;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as MandateStatus | undefined;
    const id = String(e.active.id);
    const card = cards.find((c) => c.id === id);
    if (!to || !card || card.status === to) return;
    const previous = card.status;
    setError(undefined);
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: to } : c)));
    fetch(`/api/mandates/${id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: to }) }).then((r) => {
      if (!r.ok) {
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: previous } : c)));
        setError(`Could not move ${id}. Retry.`);
      }
    });
  };

  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      {error && <p className="mb-4 text-small text-red">{error}</p>}
      <div className="scrollbar-thin -mx-6 overflow-x-auto px-6 pb-6 md:-mx-12 md:px-12 xl:-mx-20 xl:px-20">
        <div className="flex min-w-max gap-5">
          {MANDATE_STAGES.map((stage) => (
            <Column key={stage} stage={stage} cards={byStage.get(stage)!} activeId={activeId} activeFrom={active?.status} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>{active ? <CardBody card={active} lifted /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ stage, cards, activeId, activeFrom }: { stage: MandateStatus; cards: KanbanCard[]; activeId: string | null; activeFrom?: MandateStatus }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const showDrop = isOver && activeFrom !== stage;
  return (
    <section ref={setNodeRef} aria-label={STAGE_LABEL[stage]} className="flex w-80 shrink-0 flex-col">
      <header className="flex h-10 items-baseline justify-between border-b border-ink">
        <h3 className="text-small font-medium text-ink">
          {STAGE_LABEL[stage]}
          <sup className="num ml-1 text-axis font-normal text-ink-3">{cards.length}</sup>
        </h3>
      </header>
      <div className="flex min-h-[200px] flex-col pt-3">
        {cards.map((c) => (
          <DraggableCard key={c.id} card={c} dimmed={activeId === c.id} />
        ))}
        <div
          aria-hidden
          className={cn("mt-1 border-t-2 border-dashed border-gold transition-opacity duration-120", showDrop ? "opacity-100" : "opacity-0")}
        />
        {cards.length === 0 && !showDrop && <p className="pt-4 text-small text-ink-3">Nothing at this stage.</p>}
      </div>
    </section>
  );
}

function DraggableCard({ card, dimmed }: { card: KanbanCard; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("mb-2 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold", dimmed && "opacity-30")}>
      <CardBody card={card} />
    </div>
  );
}

function CardBody({ card, lifted }: { card: KanbanCard; lifted?: boolean }) {
  const d = deadline(card.deadline);
  const live = isLive(card);
  return (
    <Link
      href={`/analyst/mandates/${card.id}`}
      draggable={false}
      onClick={(e) => lifted && e.preventDefault()}
      className={cn(
        "block h-[84px] rounded-sm border bg-paper px-4 py-3 transition-[border-color,transform] duration-120 ease-[ease] hover:-translate-y-px hover:border-ink-3",
        lifted ? "-translate-y-0.5 cursor-grabbing border-ink bg-white" : "border-rule",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-ui font-medium text-ink">{card.client}</span>
        <span className={cn("num shrink-0 text-small", d.tone)}>{d.text}</span>
      </div>
      <div className="mt-0.5 truncate text-small text-ink-2">{card.property}</div>
      <div className="mt-2 flex items-center gap-2">
        {live ? <LiveDot label="Agent running" /> : <span className={cn("size-1.5 rounded-full", card.status === "delivered" ? "bg-green" : "bg-ink-3")} aria-hidden />}
        <span className="num text-axis text-ink-3">{card.id}</span>
        {card.priority === "Priority" && <span className="eyebrow ml-auto text-ink-3">Priority</span>}
      </div>
    </Link>
  );
}
