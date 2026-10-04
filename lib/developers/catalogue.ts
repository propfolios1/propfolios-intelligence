/**
 * Developers the firm can sync inventory from. None of these developers
 * publishes an open inventory API; brokers receive availability and price
 * lists through the developer's broker programme (a feed, a portal export or a
 * spreadsheet from the channel manager). Nakhla connects to whatever the
 * developer provides: a feed URL (CSV, JSON or XML), an authenticated JSON
 * endpoint, or an uploaded price list, and records every change between syncs.
 */

export interface DeveloperEntry {
  key: string;
  name: string;
  market: "AE" | "IN";
  city: string;
  note: string;
}

export const DEVELOPERS: DeveloperEntry[] = [
  { key: "emaar", name: "Emaar Properties", market: "AE", city: "Dubai", note: "Master developer of Downtown Dubai, Dubai Hills Estate and Dubai Creek Harbour; listed on the Dubai Financial Market." },
  { key: "damac", name: "DAMAC Properties", market: "AE", city: "Dubai", note: "Branded residences and villa communities including DAMAC Hills and DAMAC Lagoons." },
  { key: "aldar", name: "Aldar Properties", market: "AE", city: "Abu Dhabi", note: "Abu Dhabi's largest developer: Saadiyat, Yas and Al Reem; listed on ADX." },
  { key: "nakheel", name: "Nakheel", market: "AE", city: "Dubai", note: "Developer of Palm Jumeirah, Palm Jebel Ali and Dubai Islands." },
  { key: "sobha", name: "Sobha Realty", market: "AE", city: "Dubai", note: "Vertically integrated developer of Sobha Hartland and Sobha One." },
  { key: "danube", name: "Danube Properties", market: "AE", city: "Dubai", note: "Furnished apartments sold on long post-handover payment plans." },
  { key: "binghatti", name: "Binghatti Developers", market: "AE", city: "Dubai", note: "Architect-led towers in Business Bay, JVC and Al Jaddaf." },
  { key: "ellington", name: "Ellington Properties", market: "AE", city: "Dubai", note: "Design-led boutique residences in Downtown, JVC and Dubai Hills." },
  { key: "lodha", name: "Lodha (Macrotech Developers)", market: "IN", city: "Mumbai", note: "Mumbai Metropolitan Region developer; listed on NSE and BSE." },
  { key: "oberoi", name: "Oberoi Realty", market: "IN", city: "Mumbai", note: "Premium residential and mixed-use developer in Mumbai; listed on NSE and BSE." },
  { key: "prestige", name: "Prestige Group", market: "IN", city: "Bengaluru", note: "Residential, office and retail developer across South India and Mumbai; listed on NSE and BSE." },
  { key: "sun-estates", name: "Sun Estates", market: "IN", city: "India", note: "Connect the inventory feed or price list shared by the developer's sales team." },
  { key: "acron", name: "Acron", market: "IN", city: "Goa", note: "Luxury villa and residence developer in Goa." },
  { key: "veera", name: "Veera", market: "IN", city: "India", note: "Connect the inventory feed or price list shared by the developer's sales team." },
];

export const developerByKey = (k: string) => DEVELOPERS.find((d) => d.key === k) ?? null;
