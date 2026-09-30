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
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { STATUS_DOT } from "./status";
import type { MandateStatus } from "@/lib/data/types";
import { MANDATE_STAGES, STAGE_LABEL } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export interface KanbanCard {
  id: string;
  status: MandateStatus;
  client: string;
  property: string;
  deadline: string;
  priority: "Standard" | "Priority";
}

function deadlineLabel(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: `${-days}d ago`, overdue: false, past: true };
  if (days === 0) return { text: "Today", overdue: true, past: false };
  return { text: `${days}d`, overdue: days <= 2, past: false };
}

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
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: to } : c)));
    fetch(`/api/mandates/${id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: to }),
    }).then((r) => {
      if (!r.ok) setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: previous } : c)));
    });
  };

  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="scrollbar-thin -mx-8 overflow-x-auto px-8 pb-4 md:-mx-12 md:px-12 lg:-mx-16 lg:px-16 2xl:-mx-20 2xl:px-20">
        <div className="flex min-w-max gap-3">
          {MANDATE_STAGES.map((stage) => (
            <Column key={stage} stage={stage} cards={byStage.get(stage)!} activeId={activeId} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {active ? <CardBody card={active} lifted /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ stage, cards, activeId }: { stage: MandateStatus; cards: KanbanCard[]; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      aria-label={STAGE_LABEL[stage]}
      className={cn(
        "flex w-[248px] shrink-0 flex-col rounded-card border border-ink-200 bg-ink-50/60 transition-[background-color,border-color] duration-150 ease-brand",
        isOver && "border-navy-200 bg-navy-100",
      )}
    >
      <header className="flex h-11 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[stage])} />
          <span className="text-[13px] font-medium text-ink-800">{STAGE_LABEL[stage]}</span>
        </div>
        <span className="num rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-600 ring-1 ring-ink-200">{cards.length}</span>
      </header>
      <div className="flex min-h-[120px] flex-col gap-2 px-2 pb-2">
        {cards.map((c) => (
          <DraggableCard key={c.id} card={c} dimmed={activeId === c.id} />
        ))}
        {cards.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-control border border-dashed border-ink-200 text-xs text-ink-400">Drop here</div>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ card, dimmed }: { card: KanbanCard; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("outline-none", dimmed && "opacity-40")}>
      <CardBody card={card} />
    </div>
  );
}

function CardBody({ card, lifted }: { card: KanbanCard; lifted?: boolean }) {
  const d = deadlineLabel(card.deadline);
  return (
    <Link
      href={`/analyst/mandates/${card.id}`}
      draggable={false}
      onClick={(e) => lifted && e.preventDefault()}
      className={cn(
        "block h-[84px] rounded-control border border-ink-200 bg-surface px-3 py-2.5 transition-[border-color,transform] duration-150 ease-brand hover:border-ink-300",
        lifted && "scale-[1.02] cursor-grabbing border-ink-300 shadow-float",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-ink-900">{card.client}</span>
        {card.priority === "Priority" && <span className="size-1.5 shrink-0 rounded-full bg-gold-500" title="Priority" />}
      </div>
      <div className="mt-0.5 truncate text-xs text-ink-500">{card.property}</div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[card.status])} />
          <span className="num text-[11px] text-ink-500">{card.id}</span>
        </span>
        <span className={cn("flex items-center gap-1 text-[11px]", d.overdue ? "text-negative" : "text-ink-500")}>
          <CalendarClock className="size-3" />
          <span className="num">{d.text}</span>
        </span>
      </div>
    </Link>
  );
}
