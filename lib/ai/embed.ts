/**
 * Local 1536-dimension embedding using signed feature hashing over word
 * unigrams and bigrams. Deterministic, dependency-free and good enough for
 * lexical retrieval over the document vault via pgvector cosine distance.
 * Swap for a hosted embedding model by replacing this one function.
 */
export const EMBEDDING_DIMS = 1536;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const STOP = new Set("the a an and or of to in on for with by at from is are was were be as it this that these those its into per vs".split(" "));

export function embed(text: string): number[] {
  const v = new Float64Array(EMBEDDING_DIMS);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9.%\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  const feats = [...words, ...words.slice(1).map((w, i) => `${words[i]}_${w}`)];
  for (const f of feats) {
    const h = hash(f);
    v[h % EMBEDDING_DIMS] += h & 0x80000000 ? -1 : 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return Array.from(v, (x) => +(x / norm).toFixed(6));
}
