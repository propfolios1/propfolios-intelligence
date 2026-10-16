import Link from "next/link";
import { Photo } from "@/components/media/photo";
import type { PhotoBundle } from "@/lib/media/unsplash";
import { cn } from "@/lib/utils";
import { TONE, type PortalTone } from "./tiles";

export interface CardStat {
  label: React.ReactNode;
  value: string;
  tone?: PortalTone;
}

/**
 * A property as a photograph first: the image, a status ribbon, the name and
 * where it is, then two or three figures. The whole card is one link.
 */
export function PropertyCard({ seed, media, ownSrc, href, title, place, ribbon, stats, footer, priority }: { seed: string; media: PhotoBundle; ownSrc?: string | null; href: string; title: string; place: string; ribbon?: { label: string; tone: PortalTone }; stats: CardStat[]; footer?: React.ReactNode; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface transition-[transform,box-shadow] duration-250 hover:-translate-y-0.5 hover:shadow-float">
      <Photo seed={seed} scene={media.scene} photo={media.photo} ownSrc={ownSrc} alt={`${title}, ${place}`} className="aspect-[16/10]" imgClassName="transition-transform duration-400 group-hover:scale-[1.03]" sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw" priority={priority}>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/35 to-transparent" />
        {ribbon && <span className={cn("absolute start-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px] leading-none font-medium shadow-float", TONE[ribbon.tone].tile)}>{ribbon.label}</span>}
      </Photo>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-card font-semibold text-ink-900">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        <p className="mt-0.5 text-meta text-ink-500">{place}</p>
        <dl className={cn("mt-4 grid gap-3", stats.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {stats.map((s, i) => (
            <div key={i} className="min-w-0">
              <dt className="truncate text-axis text-ink-500">{s.label}</dt>
              <dd className={cn("num mt-0.5 truncate text-ui font-semibold", s.tone ? TONE[s.tone].ink : "text-ink-900")}>{s.value}</dd>
            </div>
          ))}
        </dl>
        {footer && <div className="relative z-10 mt-4 border-t border-hairline pt-3 text-meta text-ink-500">{footer}</div>}
      </div>
    </article>
  );
}
