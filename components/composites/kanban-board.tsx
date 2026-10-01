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
import { LiveDot } from "@/components/ui/live-dot";
import { toast } from "@/components/ui/toaster";
import { MANDATE_STAGES, STAGE_LABEL, type MandateStage as MandateStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

export interface KanbanCard {
  id: string;
  reference: string;
  status: MandateStatus;
  client: string;
  property: string;
  deadline: string | null;
  updatedAt: string;
  running: boolean;
  priority: "standard" | "priority";
}

function deadline(iso: string | null) {
  if (!iso) return { text: "", tone: "text-ink-500" };
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), tone: "text-ink-500" };
  if (days === 0) return { text: "today", tone: "text-danger" };
  return { text: `${days}d`, tone: days <= 2 ? "text-danger" : "text-ink-700" };
}

const isLive = (c: KanbanCard) => c.running;

/**
 * Pipeline board. 320px columns, 20px apart, counts as mono superscripts.
 * A dragged card lifts 2px and takes an ink border; the landing slot shows
 * as a 2px dashed gold line.
 */
export function KanbanBoard({ cards: initial }: { cards: KanbanCard[] }) {
  const [cards, setCards] = React.useState(initial);
  const [activeId, setActiveId] = React.useState<string | null>(null);
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
    // optimistic move; rolled back with the server's reason if the transition is not allowed
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: to } : c)));
    fetch(`/api/mandates/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: to }) }).then(async (r) => {
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: previous } : c)));
        toast.error(`${card.reference} was not moved`, { description: json.error ?? "Retry." });
      } else {
        toast.success(`${card.reference} moved to ${STAGE_LABEL[to]}`);
      }
    });
  };

  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="scrollbar-thin pb-6 md:-mx-12 md:overflow-x-auto md:px-12 xl:-mx-20 xl:px-20">
        <div className="flex flex-col gap-8 md:min-w-max md:flex-row md:gap-5">
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
    <section ref={setNodeRef} aria-label={STAGE_LABEL[stage]} className="flex w-full shrink-0 flex-col md:w-72">
      <header className="flex h-10 items-baseline justify-between border-b border-ink-200">
        <h3 className="text-small font-medium text-ink-900">
          {STAGE_LABEL[stage]}
          <sup className="num ml-1 text-axis font-normal text-ink-500">{cards.length}</sup>
        </h3>
      </header>
      <div className="flex flex-col pt-3 md:min-h-[200px]">
        {cards.map((c) => (
          <DraggableCard key={c.id} card={c} dimmed={activeId === c.id} />
        ))}
        <div
          aria-hidden
          className={cn("mt-1 border-t border-dashed border-gold-500 transition-opacity duration-120", showDrop ? "opacity-100" : "opacity-0")}
        />
        {cards.length === 0 && !showDrop && <p className="pt-4 text-small text-ink-500">Nothing at this stage.</p>}
      </div>
    </section>
  );
}

function DraggableCard({ card, dimmed }: { card: KanbanCard; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("mb-2 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500", dimmed && "opacity-30")}>
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
        "block h-[88px] rounded-md border bg-surface px-4 py-3 shadow-card transition-[border-color,transform] duration-120 ease-[ease] hover:-translate-y-px hover:border-ink-500",
        lifted ? "-translate-y-0.5 cursor-grabbing border-ink-400 shadow-float" : "border-ink-200",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-ui font-medium text-ink-900">{card.client}</span>
        <span className={cn("num shrink-0 text-small", d.tone)}>{d.text}</span>
      </div>
      <div className="mt-0.5 truncate text-small text-ink-700">{card.property}</div>
      <div className="mt-2 flex items-center gap-2">
        {live ? <LiveDot label="Agents running" /> : <span className={cn("size-1.5 rounded-full", card.status === "DELIVERED" ? "bg-success" : "bg-ink-400")} aria-hidden />}
        <span className="num text-axis text-ink-500">{card.reference}</span>
        {card.priority === "priority" && <span className="eyebrow ml-auto text-gold-600">Priority</span>}
      </div>
    </Link>
  );
}
