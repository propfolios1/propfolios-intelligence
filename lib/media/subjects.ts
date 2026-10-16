/**
 * What a property looks like, as a photographic subject. Pure and
 * deterministic: the same property always asks for the same search and is
 * always given the same photograph and the same illustrated scene.
 */

export type SceneKey = "dubai" | "abu-dhabi" | "mumbai" | "goa" | "bengaluru" | "delhi-ncr" | "pune" | "london" | "singapore" | "sydney" | "new-york" | "toronto" | "city";

export interface ScenePalette {
  /** Sky gradient, top to horizon. */
  sky: [string, string, string];
  sun: string;
  /** Water band below the skyline; null for an inland city. */
  water: string | null;
  far: string;
  near: string;
  /** Lit windows. */
  glow: string;
  /** Silhouette features drawn on the skyline. */
  landmark: "spire" | "twin" | "dome" | "palms" | "sail" | "clock" | "none";
}

export const SCENES: Record<SceneKey, ScenePalette> = {
  dubai: { sky: ["#3B1E6E", "#C2457A", "#FFB070"], sun: "#FFE3A3", water: "#2B2F6B", far: "#6A3C82", near: "#24154A", glow: "#FFD27A", landmark: "spire" },
  "abu-dhabi": { sky: ["#0E4F6E", "#2FA3A0", "#F7D38A"], sun: "#FFF1C2", water: "#0F5A6B", far: "#2D7C8A", near: "#0B3A4F", glow: "#FFE29A", landmark: "dome" },
  mumbai: { sky: ["#5A1F5C", "#E2556B", "#FFB36B"], sun: "#FFE0A0", water: "#3A2560", far: "#8A3E70", near: "#2E1440", glow: "#FFC870", landmark: "twin" },
  goa: { sky: ["#0B7A8F", "#3CC6B8", "#FFD98A"], sun: "#FFF4C8", water: "#0A6E7E", far: "#1E9A8E", near: "#0C4F4A", glow: "#FFE7A0", landmark: "palms" },
  bengaluru: { sky: ["#1F3B73", "#4F8BD6", "#A8E0C8"], sun: "#F4FFD8", water: null, far: "#3E6BA8", near: "#162B54", glow: "#F2E59A", landmark: "none" },
  "delhi-ncr": { sky: ["#4A2A6A", "#C86A8A", "#F6C28B"], sun: "#FFE6B0", water: null, far: "#7A4C7E", near: "#2B1A44", glow: "#FFD38A", landmark: "dome" },
  pune: { sky: ["#244A6E", "#5FA0C8", "#F0D49A"], sun: "#FFF2C4", water: null, far: "#3F7096", near: "#1A3350", glow: "#FFE09A", landmark: "none" },
  london: { sky: ["#1E2A55", "#5C6FB0", "#F2B9A0"], sun: "#FFE2C8", water: "#27345E", far: "#4A5890", near: "#141C3C", glow: "#FFD9A0", landmark: "clock" },
  singapore: { sky: ["#123A6B", "#2F86B8", "#F5B6C8"], sun: "#FFE8F0", water: "#163E6A", far: "#3A6E9E", near: "#0D2648", glow: "#FFE0B0", landmark: "sail" },
  sydney: { sky: ["#0C3C78", "#3A9BD8", "#FFD0A0"], sun: "#FFF2D0", water: "#0E4680", far: "#3378B0", near: "#0A2A55", glow: "#FFE4A8", landmark: "sail" },
  "new-york": { sky: ["#2A1F5E", "#8A4FB0", "#FFA88A"], sun: "#FFE0C0", water: "#2A2B66", far: "#5E4A90", near: "#1A1440", glow: "#FFD490", landmark: "spire" },
  toronto: { sky: ["#163A66", "#4A84C4", "#FFC9A8"], sun: "#FFEBD6", water: "#1A4270", far: "#3E6A9E", near: "#0F2546", glow: "#FFE0A8", landmark: "spire" },
  city: { sky: ["#23306B", "#6A63C8", "#FFB59A"], sun: "#FFE6CC", water: null, far: "#4E57A0", near: "#18204A", glow: "#FFD9A0", landmark: "none" },
};

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

export type SceneMood = "golden" | "day" | "night";

/**
 * The city's palette at one of three times of day, chosen by the property,
 * so a page of illustrated cards for one city does not repeat itself.
 */
export function paletteFor(key: SceneKey, seed: string): ScenePalette & { mood: SceneMood } {
  const base = SCENES[key];
  const mood: SceneMood = (["golden", "day", "night"] as const)[hash32(`mood:${seed}`) % 3]!;
  if (mood === "golden") return { ...base, mood };
  if (mood === "day") {
    return {
      ...base,
      mood,
      sky: [mixHex(base.sky[0], "#3E8FD8", 0.75), mixHex(base.sky[1], "#8CCBF2", 0.7), mixHex(base.sky[2], "#FFF2D6", 0.6)],
      sun: "#FFFBEA",
      water: base.water ? mixHex(base.water, "#2F7FC0", 0.6) : null,
      far: mixHex(base.far, "#8FB3D6", 0.55),
      near: mixHex(base.near, "#294766", 0.45),
      glow: mixHex(base.glow, "#C9DDF0", 0.7),
    };
  }
  return {
    ...base,
    mood,
    sky: [mixHex(base.sky[0], "#070B24", 0.7), mixHex(base.sky[1], "#231C55", 0.65), mixHex(base.sky[2], "#5E3F84", 0.55)],
    sun: "#F3F0E4",
    water: base.water ? mixHex(base.water, "#0A0F2E", 0.6) : null,
    far: mixHex(base.far, "#2A2660", 0.5),
    near: mixHex(base.near, "#0B0A22", 0.5),
    glow: mixHex(base.glow, "#FFE7A8", 0.3),
  };
}

const CITY_SCENE: Record<string, SceneKey> = {
  dubai: "dubai",
  "abu dhabi": "abu-dhabi",
  sharjah: "dubai",
  "ras al khaimah": "abu-dhabi",
  mumbai: "mumbai",
  "navi mumbai": "mumbai",
  thane: "mumbai",
  goa: "goa",
  panaji: "goa",
  margao: "goa",
  vagator: "goa",
  siolim: "goa",
  porvorim: "goa",
  moira: "goa",
  colva: "goa",
  candolim: "goa",
  benaulim: "goa",
  assagao: "goa",
  anjuna: "goa",
  aldona: "goa",
  bengaluru: "bengaluru",
  bangalore: "bengaluru",
  gurugram: "delhi-ncr",
  gurgaon: "delhi-ncr",
  noida: "delhi-ncr",
  delhi: "delhi-ncr",
  "new delhi": "delhi-ncr",
  pune: "pune",
  london: "london",
  singapore: "singapore",
  sydney: "sydney",
  melbourne: "sydney",
  "new york": "new-york",
  manhattan: "new-york",
  brooklyn: "new-york",
  miami: "new-york",
  toronto: "toronto",
  vancouver: "toronto",
};

/** Communities with a recognisable photographic identity of their own. */
const COMMUNITY_QUERY: Record<string, string> = {
  "dubai marina": "dubai marina",
  "jumeirah beach residence": "dubai marina",
  "downtown dubai": "burj khalifa downtown dubai",
  "business bay": "dubai business bay",
  "palm jumeirah": "palm jumeirah",
  "dubai creek harbour": "dubai creek",
  "dubai hills estate": "dubai skyline",
  "saadiyat island": "saadiyat island",
  "yas island": "yas island abu dhabi",
  "al reem island": "abu dhabi skyline",
  "al maryah island": "abu dhabi skyline",
  worli: "mumbai skyline",
  "lower parel": "mumbai skyline",
  bandra: "bandra worli sea link",
  "bandra west": "bandra worli sea link",
  "marine drive": "marine drive mumbai",
  mayfair: "mayfair london",
  kensington: "kensington london",
  chelsea: "chelsea london townhouse",
  "canary wharf": "canary wharf",
  "marina bay": "marina bay singapore",
};

const CITY_QUERY: Partial<Record<SceneKey, string>> = {
  dubai: "dubai skyline",
  "abu-dhabi": "abu dhabi skyline",
  mumbai: "mumbai skyline",
  goa: "goa beach villa",
  bengaluru: "bengaluru city",
  "delhi-ncr": "gurugram skyline",
  pune: "pune city",
  london: "london skyline",
  singapore: "singapore skyline",
  sydney: "sydney harbour",
  "new-york": "manhattan skyline",
  toronto: "toronto skyline",
};

export interface PhotoInput {
  /** Stable identity: property or listing id, slug or reference. */
  seed: string;
  city: string;
  community?: string | null;
  /** properties.asset_class or listings.property_type. */
  kind?: string | null;
}

export interface PhotoSubject {
  seed: string;
  query: string;
  scene: SceneKey;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export function sceneFor(city: string): SceneKey {
  return CITY_SCENE[norm(city)] ?? "city";
}

/**
 * The Unsplash search a property is illustrated with. Villas are shown as
 * villas, branded towers as towers, and a few well-known communities as
 * themselves; everything else as its city.
 */
export function subjectFor(p: PhotoInput): PhotoSubject {
  const scene = sceneFor(p.city);
  const kind = norm(p.kind);
  const community = norm(p.community);
  const city = p.city.trim();
  let query: string;
  if (/villa|townhouse|bungalow|plot/.test(kind)) query = scene === "goa" ? "goa villa pool" : scene === "dubai" || scene === "abu-dhabi" ? "luxury villa pool" : scene === "london" ? "london townhouse" : "modern villa exterior";
  else if (COMMUNITY_QUERY[community]) query = COMMUNITY_QUERY[community]!;
  else if (/branded|serviced|penthouse/.test(kind)) query = `${city} luxury tower`.toLowerCase();
  else query = CITY_QUERY[scene] ?? `${city} architecture`.toLowerCase();
  return { seed: p.seed, query, scene };
}

/** FNV-1a: a stable 32-bit hash for picking among search results. */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickIndex(seed: string, n: number): number {
  return n <= 0 ? -1 : hash32(seed) % n;
}

/** A small deterministic generator, for drawing the same scene twice. */
export function seeded(seed: string) {
  let a = hash32(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SceneBuilding {
  x: number;
  w: number;
  h: number;
  layer: "far" | "near";
  windows: { x: number; y: number }[];
}

export interface SceneGeometry {
  width: number;
  height: number;
  horizon: number;
  sun: { x: number; y: number; r: number };
  buildings: SceneBuilding[];
  landmarkX: number;
}

/**
 * Skyline geometry on a canvas 250 high and 400 wide by default (wider for banners). Far towers are taller and paler,
 * near blocks are lower and carry lit windows. Inland cities sit their
 * skyline lower, on the ground line, instead of on a waterfront.
 */
export function buildScene(seed: string, key: SceneKey, width = 400): SceneGeometry {
  const rnd = seeded(`${key}:${seed}`);
  const height = 250;
  const horizon = SCENES[key].water ? 186 : 214;
  const buildings: SceneBuilding[] = [];
  for (const layer of ["far", "near"] as const) {
    let x = -10 + rnd() * 12;
    while (x < width + 10) {
      const w = layer === "far" ? 14 + rnd() * 22 : 18 + rnd() * 30;
      const h = layer === "far" ? 50 + rnd() * 90 : 24 + rnd() * 62;
      const windows: { x: number; y: number }[] = [];
      if (layer === "near") {
        for (let wy = horizon - h + 6; wy < horizon - 6; wy += 9) {
          for (let wx = x + 4; wx < x + w - 5; wx += 7) if (rnd() > 0.62) windows.push({ x: wx, y: wy });
        }
      }
      buildings.push({ x, w, h, layer, windows });
      x += w + (layer === "far" ? 2 + rnd() * 10 : 1 + rnd() * 6);
    }
  }
  return { width, height, horizon, sun: { x: width * (0.15 + rnd() * 0.7), y: 70 + rnd() * 50, r: 18 + rnd() * 14 }, buildings, landmarkX: width * (0.22 + rnd() * 0.56) };
}
