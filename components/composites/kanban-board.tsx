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
import { Plus } from "lucide-react";
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

/** Days in the current stage, from the last stage change. */
function inStage(iso: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return days === 0 ? "today" : `${days}d`;
}

const DOT: Record<MandateStatus, string> = {
  INTAKE: "bg-ink-400",
  RESEARCH: "bg-gold-500",
  UNDERWRITING: "bg-gold-500",
  DUE_DILIGENCE: "bg-gold-500",
  DEBATE: "bg-gold-500",
  MEMO: "bg-gold-500",
  REVIEW: "bg-gold-500",
  DELIVERED: "bg-success",
};

/**
 * Pipeline board, Linear style. 280px columns 12px apart, no column fill or
 * border. Cards are 60px: client and time in stage, then property and
 * reference. A dragged card lifts 2px with a soft shadow, never rotates or
 * scales; the landing slot is a dashed navy-300 box on navy-50.
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
    // Optimistic move; rolled back with the server's reason if the transition is not allowed.
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: to, updatedAt: new Date().toISOString() } : c)));
    fetch(`/api/mandates/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: to }) }).then(async (r) => {
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: previous } : c)));
        toast.error(`${card.reference} stays in ${STAGE_LABEL[previous]}`, { description: json.error ?? "The move was refused. Retry, or run the stage from the mandate." });
      }
    });
  };

  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="scrollbar-thin pb-4 md:-mx-12 md:overflow-x-auto md:px-12 xl:-mx-20 xl:px-20">
        <div className="flex flex-col gap-6 md:min-w-max md:flex-row md:gap-3">
          {MANDATE_STAGES.map((stage) => (
            <Column key={stage} stage={stage} cards={byStage.get(stage)!} activeId={activeId} activeFrom={active?.status} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>{active ? <CardBody card={active} lifted /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ stage, cards, activeId, activeFrom }: { stage: MandateStatus; cards: KanbanCard[]; activeId: string | null; activeFrom?: MandateStatus }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const showDrop = isOver && activeFrom !== stage;
  return (
    <section ref={setNodeRef} aria-label={STAGE_LABEL[stage]} className="group/col flex w-full shrink-0 flex-col md:w-[280px]">
      <header className="flex h-8 items-center gap-2">
        <h3 className="label-caps">{STAGE_LABEL[stage]}</h3>
        <span className="num text-axis text-ink-500">{cards.length}</span>
        {stage === "INTAKE" && (
          <Link href="/analyst/mandates/new" aria-label="Create mandate" title="Create mandate" className="ms-auto flex size-6 items-center justify-center rounded-sm text-ink-500 opacity-0 transition-[opacity,background-color] duration-150 group-hover/col:opacity-100 hover:bg-ink-100 hover:text-ink-900 focus-visible:opacity-100">
            <Plus className="size-3.5 stroke-[1.5]" aria-hidden />
          </Link>
        )}
      </header>
      <div className="flex flex-col gap-2 pt-2 md:min-h-[200px]">
        {cards.map((c) => (
          <DraggableCard key={c.id} card={c} dimmed={activeId === c.id} />
        ))}
        <div aria-hidden className={cn("h-[60px] rounded-md border-2 border-dashed border-navy-300 bg-navy-50 transition-opacity duration-100", showDrop ? "opacity-100" : "hidden opacity-0")} />
        {cards.length === 0 && !showDrop && <p className="pt-2 text-meta text-ink-400">No mandates at this stage</p>}
      </div>
    </section>
  );
}

function DraggableCard({ card, dimmed }: { card: KanbanCard; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("rounded-md", dimmed && "opacity-30")}>
      <CardBody card={card} />
    </div>
  );
}

function CardBody({ card, lifted }: { card: KanbanCard; lifted?: boolean }) {
  return (
    <Link
      href={`/analyst/mandates/${card.id}`}
      draggable={false}
      onClick={(e) => lifted && e.preventDefault()}
      className={cn(
        "flex h-[60px] cursor-grab flex-col justify-center rounded-md border bg-surface px-3 transition-[border-color,transform,box-shadow] duration-150",
        lifted ? "-translate-y-0.5 cursor-grabbing border-ink-300 shadow-drag" : "border-hairline hover:border-ink-200",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-ui font-medium text-ink-900">{card.client}</span>
        {card.running ? <LiveDot label="Agents running" /> : <span className={cn("size-1.5 shrink-0 rounded-full", DOT[card.status])} aria-hidden />}
        <span className="num shrink-0 text-axis text-ink-400" title="Time in stage">
          {inStage(card.updatedAt)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-meta text-ink-500">{card.property}</span>
        <span className="num shrink-0 text-axis text-ink-400">{card.reference}</span>
      </div>
    </Link>
  );
}
