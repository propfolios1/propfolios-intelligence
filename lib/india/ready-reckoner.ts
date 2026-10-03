/**
 * Ready Reckoner (Annual Statement of Rates) zones used by the demonstration
 * dataset, 2026-27, residential, in rupees per square metre of built-up
 * area. Indicative values for the zones the seed covers; the authoritative
 * table is published each 1 April by IGR Maharashtra.
 */
export const READY_RECKONER_YEAR = 2026;

export const READY_RECKONER: { zone: string; locality: string; residentialPerSqm: number; commercialPerSqm: number; landPerSqm: number }[] = [
  { zone: "Worli 7/34", locality: "Worli", residentialPerSqm: 506_000, commercialPerSqm: 612_000, landPerSqm: 214_000 },
  { zone: "Lower Parel 5/22", locality: "Lower Parel", residentialPerSqm: 412_000, commercialPerSqm: 498_000, landPerSqm: 178_000 },
  { zone: "Malabar Hill 3/11", locality: "Malabar Hill", residentialPerSqm: 842_000, commercialPerSqm: 920_000, landPerSqm: 361_000 },
  { zone: "Prabhadevi 7/29", locality: "Prabhadevi", residentialPerSqm: 468_000, commercialPerSqm: 560_000, landPerSqm: 192_000 },
  { zone: "Bandra East 22/104", locality: "Bandra East (BKC)", residentialPerSqm: 341_000, commercialPerSqm: 488_000, landPerSqm: 148_000 },
  { zone: "Khar West 20/96", locality: "Khar West", residentialPerSqm: 432_000, commercialPerSqm: 506_000, landPerSqm: 181_000 },
  { zone: "Marine Lines 2/7", locality: "Marine Lines", residentialPerSqm: 556_000, commercialPerSqm: 640_000, landPerSqm: 233_000 },
  { zone: "Mahalaxmi 6/27", locality: "Mahalaxmi", residentialPerSqm: 514_000, commercialPerSqm: 598_000, landPerSqm: 219_000 },
  { zone: "Andheri West 33/148", locality: "Andheri West", residentialPerSqm: 268_000, commercialPerSqm: 331_000, landPerSqm: 112_000 },
  { zone: "Goregaon East 41/192", locality: "Goregaon East", residentialPerSqm: 231_000, commercialPerSqm: 296_000, landPerSqm: 96_000 },
  { zone: "Borivali East 51/239", locality: "Borivali East", residentialPerSqm: 214_000, commercialPerSqm: 262_000, landPerSqm: 88_000 },
  { zone: "Powai 113/534", locality: "Powai", residentialPerSqm: 258_000, commercialPerSqm: 322_000, landPerSqm: 104_000 },
  { zone: "Mulund West 128/598", locality: "Mulund West", residentialPerSqm: 196_000, commercialPerSqm: 238_000, landPerSqm: 79_000 },
];

/** Goa minimum land values (Collector's rates), rupees per square metre, by village. */
export const GOA_MINIMUM_VALUE: Record<string, number> = { Assagao: 38_000, Aldona: 21_000, Porvorim: 32_000, Siolim: 26_000, Panaji: 54_000, Candolim: 41_000, Vagator: 44_000, Moira: 16_000, Benaulim: 24_000, Margao: 36_000, Colva: 30_000, Anjuna: 40_000 };
