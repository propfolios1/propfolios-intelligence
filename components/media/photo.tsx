"use client";

import Image, { type ImageLoaderProps } from "next/image";
import { useState } from "react";
import type { SceneKey } from "@/lib/media/subjects";
import type { UnsplashPhoto } from "@/lib/media/unsplash";
import { cn } from "@/lib/utils";
import { Skyline } from "./skyline";

const UNSPLASH_HOME = "https://unsplash.com/?utm_source=nakhla&utm_medium=referral";

/** Unsplash images are served by imgix: width, quality and format are URL parameters, so no image optimiser sits in between. */
export function unsplashLoader({ src, width, quality }: ImageLoaderProps): string {
  const u = new URL(src);
  u.searchParams.set("w", String(width));
  u.searchParams.set("q", String(quality ?? 72));
  u.searchParams.set("auto", "format");
  u.searchParams.set("fit", "crop");
  return u.toString();
}

export interface PhotoProps {
  /** Stable identity, also used to draw the illustrated fallback. */
  seed: string;
  scene: SceneKey;
  photo: UnsplashPhoto | null;
  /** The firm's own photograph, which takes precedence over Unsplash. */
  ownSrc?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  /** overlay: a small credit in the corner. none: credited elsewhere on the page. */
  credit?: "overlay" | "none";
  className?: string;
  imgClassName?: string;
  /** Illustration canvas width: wider for banners so towers keep their proportions. */
  sceneWidth?: number;
  children?: React.ReactNode;
}

/**
 * A property photograph that always renders something worth looking at: the
 * firm's own image, else an Unsplash photograph (painted in its dominant
 * colour while it loads), else the property's illustrated skyline. A failed
 * load falls through to the next.
 */
export function Photo({ seed, scene, photo, ownSrc, alt, sizes = "(min-width: 1024px) 33vw, 100vw", priority, credit = "overlay", className, imgClassName, sceneWidth, children }: PhotoProps) {
  const [failed, setFailed] = useState<{ own?: boolean; unsplash?: boolean }>({});
  const useOwn = Boolean(ownSrc) && !failed.own;
  const useUnsplash = !useOwn && photo !== null && !failed.unsplash;
  return (
    <div className={cn("relative overflow-hidden", className)} style={useUnsplash ? { backgroundColor: photo!.color } : undefined}>
      {useOwn ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ownSrc!} alt={alt} loading={priority ? "eager" : "lazy"} onError={() => setFailed((f) => ({ ...f, own: true }))} className={cn("absolute inset-0 size-full object-cover", imgClassName)} />
      ) : useUnsplash ? (
        <Image loader={unsplashLoader} src={photo!.src} alt={photo!.alt || alt} fill sizes={sizes} priority={priority} onError={() => setFailed((f) => ({ ...f, unsplash: true }))} className={cn("object-cover", imgClassName)} />
      ) : (
        <Skyline seed={seed} scene={scene} title={alt} width={sceneWidth} className="absolute inset-0" />
      )}
      {children}
      {useUnsplash && credit === "overlay" && (
        <span className="absolute end-2 bottom-2 z-20 max-w-[80%] truncate rounded-full bg-black/45 px-2 py-0.5 text-[10px] leading-4 text-white/90 backdrop-blur-sm">
          Photo by{" "}
          <a href={photo!.author.profileUrl} target="_blank" rel="noreferrer" className="underline decoration-white/40 underline-offset-2 hover:decoration-white">
            {photo!.author.name}
          </a>{" "}
          on{" "}
          <a href={UNSPLASH_HOME} target="_blank" rel="noreferrer" className="underline decoration-white/40 underline-offset-2 hover:decoration-white">
            Unsplash
          </a>
        </span>
      )}
    </div>
  );
}
