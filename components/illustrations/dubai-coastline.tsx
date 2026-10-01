import { cn } from "@/lib/utils";

/**
 * The Dubai coast reduced to twelve lines: shoreline, both Palms, the World,
 * the Creek, the Water Canal and Sheikh Zayed Road. One gold point marks Downtown.
 */
export function DubaiCoastline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 560" className={cn("block", className)} role="img" aria-label="Line drawing of the Dubai coastline">
      <g fill="none" stroke="var(--navy-900)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        {/* 1 shoreline */}
        <path d="M8 548 L52 500 L96 462 L140 418 L184 368 L222 330 L258 296 L296 254 L334 210 L370 170 L402 132 L430 96 L472 36" />
        {/* 2 Palm Jumeirah trunk */}
        <path d="M184 368 L136 316" />
        {/* 3–5 fronds */}
        <path d="M168 350 L140 352 M156 338 L128 338 M146 326 L120 322" />
        <path d="M164 346 L166 318 M152 334 L154 306" />
        <path d="M142 322 L144 296" />
        {/* 6 Palm Jumeirah crescent */}
        <path d="M104 340 C 96 290, 134 262, 176 276" />
        {/* 7 Palm Jebel Ali crescent */}
        <path d="M22 470 C 20 436, 52 418, 82 430" />
        {/* 8 Palm Jebel Ali trunk */}
        <path d="M74 482 L44 450" />
        {/* 9 The World */}
        <path d="M248 176 C 236 150, 270 128, 298 140 C 326 152, 318 186, 290 192 C 268 196, 256 190, 248 176 Z" strokeDasharray="1 5" />
        {/* 10 Dubai Creek */}
        <path d="M402 132 C 420 150, 426 176, 452 196 C 462 204, 470 218, 476 236" />
        {/* 11 Dubai Water Canal */}
        <path d="M258 296 C 280 326, 318 332, 336 300 C 344 286, 342 270, 334 258" />
        {/* 12 Sheikh Zayed Road */}
        <path d="M60 560 L204 404 L300 300 L372 222 L444 144 L480 104" strokeDasharray="2 6" stroke="var(--ink-500)" />
      </g>
      {/* Downtown */}
      <circle cx="318" cy="268" r="3.5" fill="var(--gold-500)" />
      <circle cx="318" cy="268" r="9" fill="none" stroke="var(--gold-500)" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
