/**
 * Land mask for the markets map: Natural Earth 1:110m land sampled every
 * 2.5 degrees on an equirectangular grid (144 by 72), each row run-length
 * encoded as alternating counts of sea and land cells in base 36.
 */
const ROWS = [
  "40",
  "40",
  "40",
  "10.9.2.k.25",
  "r.1.2.2.2.8.2.k.d.3.w.2.u",
  "n.1.2.1.1.1.2.2.2.1.8.k.w.3.c.6.r",
  "m.4.8.2.1.1.c.e.t.2.a.c.b.1.f",
  "0.1.8.1.f.5.3.2.1.7.8.c.u.2.4.3.1.l.1.8.b",
  "5.l.1.1.1.1.4.3.1.2.2.3.6.a.i.8.6.1.1.4.1.1.1.16",
  "0.4.2.w.4.5.4.7.7.1.b.9.1.1.2.1i",
  "8.s.1.1.1.1.3.3.5.5.8.1.b.4.1.1q.1",
  "6.s.7.2.9.3.j.5.2.1i.1.5.3",
  "7.4.6.i.6.6.r.5.2.1c.7.1.7",
  "8.1.a.i.4.6.n.1.4.1.1.1.2.1b.7.3.7",
  "k.j.1.9.j.2.1.1.3.1h.6.2.8",
  "l.t.k.1m.g",
  "m.m.1.1.2.3.j.1m.g",
  "m.o.p.d.1.1.1.5.1.y.h",
  "m.m.r.4.1.1.1.5.5.3.1.y.3.1.e",
  "m.l.p.5.4.2.1.4.1.2.1.4.2.u.4.1.f",
  "n.j.q.4.6.1.1.1.2.9.2.p.3.1.5.1.f",
  "n.j.u.4.9.z.3.1.2.2.g",
  "p.g.s.7.a.y.5.1.i",
  "p.1.1.c.t.b.1.3.1.1.1.z.n",
  "q.8.5.1.s.n.1.t.n",
  "s.5.6.1.q.k.1.5.2.q.o",
  "t.4.x.k.1.8.4.k.1.1.n",
  "u.3.3.1.s.m.1.8.4.7.2.6.t",
  "u.4.1.2.6.2.l.l.1.7.6.5.4.4.1.1.s",
  "x.4.s.n.1.4.8.4.6.4.5.1.n",
  "10.3.q.q.b.2.7.5.4.2.m",
  "16.1.1.1.l.n.2.1.a.2.7.1.1.2.t",
  "13.1.1.7.j.p.j.1.a.1.l",
  "15.8.j.5.1.i.c.1.7.1.v",
  "15.b.o.f.k.2.4.2.p",
  "14.c.o.e.m.2.2.3.p",
  "14.e.m.d.n.2.2.3.1.1.3.2.i",
  "14.h.j.c.p.1.6.1.5.4.e",
  "14.i.j.b.q.1.c.4.d",
  "14.i.j.b.v.2.1.1.5.1.f",
  "15.g.k.b.1k",
  "15.f.l.b.3.1.w.2.i",
  "17.d.l.b.2.2.t.6.2.1.e",
  "18.c.l.9.4.2.t.a.d",
  "18.c.l.9.3.2.r.e.c",
  "18.a.o.8.3.2.q.f.c",
  "18.9.p.7.w.g.b",
  "17.9.r.6.x.f.b",
  "17.9.r.5.y.f.b",
  "17.8.s.3.10.4.4.7.b",
  "17.6.27.4.c",
  "17.5.2a.1.b.1.1",
  "16.4.2c.1.a.1.2",
  "17.3.2m.1.3",
  "16.3.2m.1.4",
  "16.3.2r",
  "16.2.4.1.2n",
  "17.2.2r",
  "40",
  "40",
  "40",
  "40",
  "40",
  "40",
  "40",
  "40",
  "40",
  "40",
  "40",
  "40",
  "40",
  "40",
];

export const GRID = { cols: 144, rows: ROWS.length, step: 2.5 };

/** Land cells as [column, row] pairs. */
export function landCells(): [number, number][] {
  const out: [number, number][] = [];
  ROWS.forEach((r, y) => {
    let x = 0;
    r.split(".").forEach((n, i) => {
      const len = parseInt(n, 36);
      if (i % 2 === 1) for (let k = 0; k < len; k++) out.push([x + k, y]);
      x += len;
    });
  });
  return out;
}

/** Longitude and latitude to the 1000 by 500 map frame. */
export const project = (lon: number, lat: number) => ({ x: ((lon + 180) / 360) * 1000, y: ((90 - lat) / 180) * 500 });
