/**
 * Built-in templates, installed into each workspace as editable drafts. They
 * follow the structure and key terms of each market's standard form; they are
 * not the official forms themselves. Where a regulator prescribes a form (RERA
 * Forms A, B and F in Dubai; CEA prescribed agreements in Singapore; the
 * MahaRERA model agreement for sale) the firm should use or attach the
 * official form, and a lawyer should review every template before first use.
 *
 * Context available to every template (built from the deal, the firm and
 * values entered when the contract is drafted):
 *   reference, date, currency, price, deposit, depositPct, balance,
 *   completionDays, completionDate, conditions[]
 *   buyer.{name, nationality, residency, isNri, isCompany, email, idNumber, address}
 *   seller.{...same}
 *   property.{name, unit, community, city, permit, titleNumber, areaSqft, carpetAreaSqm, parking}
 *   firm.{name, licence, orn, address, email}
 *   agent.{name, brn, email}
 *   commission.{pct, amount, payer, vatPct}
 *   listing.{exclusive, termDays, askingPrice}
 */

export type TemplateKey = "ae_form_a" | "ae_form_b" | "ae_form_f" | "in_maharera_afs" | "gb_sale_contract" | "sg_cea_sale" | "custom";

export interface BuiltIn {
  key: TemplateKey;
  name: string;
  jurisdiction: "AE" | "IN" | "GB" | "SG" | "ANY";
  kind: "listing_agreement" | "buyer_agreement" | "sale_mou" | "agreement_for_sale" | "sale_contract" | "agency_agreement" | "custom";
  parties: ("buyer" | "seller" | "advisor")[];
  description: string;
  officialNote: string;
  body: string;
  /** Variables a person must supply (others come from the deal). */
  inputs: { path: string; label: string; type: "text" | "number" | "date" | "boolean"; default?: string | number | boolean }[];
}

const execution = `
<h3>Execution</h3>
<p>Signed electronically. Each signature records the signer's verified email address, the time and the network address, and the document's content hash is fixed at the moment of the first signature.</p>`;

export const BUILT_INS: BuiltIn[] = [
  {
    key: "ae_form_a",
    name: "Form A: Agreement between seller and broker",
    jurisdiction: "AE",
    kind: "listing_agreement",
    parties: ["seller", "advisor"],
    description: "Appoints the firm to market a property for sale in Dubai, on an exclusive or non-exclusive basis, with the commission and term.",
    officialNote: "Structured on RERA Form A. Dubai listings require the official Form A, generated through the DLD's systems, before a Trakheesi permit is issued; use this agreement alongside it for the firm's own terms.",
    inputs: [
      { path: "listing.exclusive", label: "Exclusive appointment", type: "boolean", default: true },
      { path: "listing.termDays", label: "Term, days", type: "number", default: 90 },
      { path: "listing.askingPrice", label: "Asking price", type: "number" },
      { path: "commission.pct", label: "Commission, %", type: "number", default: 2 },
    ],
    body: `<h2>Agreement between Seller and Broker (Form A)</h2>
<p><strong>Reference</strong> {{reference}} · <strong>Date</strong> {{date | long}}</p>
<h3>1. Parties</h3>
<p><strong>{{seller.name}}</strong>{{#if seller.isCompany}}, a company{{/if}} (the Seller), and <strong>{{firm.name}}</strong>, ORN {{firm.orn}}, acting through {{agent.name}}, BRN {{agent.brn}} (the Broker).</p>
<h3>2. Property</h3>
<p>{{property.unit}}, {{property.name}}, {{property.community}}, {{property.city}}, title deed or Oqood number {{property.titleNumber}}.</p>
<h3>3. Appointment</h3>
<p>The Seller appoints the Broker {{#if listing.exclusive}}as exclusive agent{{else}}on a non-exclusive basis{{/if}} to market the Property for sale at an asking price of {{listing.askingPrice | money}} for {{listing.termDays}} days from the date of this agreement.</p>
{{#if listing.exclusive}}<p>During the term the Seller shall not appoint another broker for the Property. A sale to a buyer introduced by the Broker within the term, or within 30 days after it, entitles the Broker to the commission.</p>{{/if}}
<h3>4. Commission</h3>
<p>On completion of a sale, the Seller pays the Broker {{commission.pct}}% of the sale price, plus VAT at {{commission.vatPct}}%.</p>
<h3>5. Seller's obligations</h3>
<p>The Seller confirms ownership of the Property, that the information given to the Broker is accurate, and that the Property may lawfully be sold. The Seller shall provide the documents needed for the advertising permit and the developer's no-objection certificate.</p>
<h3>6. Broker's obligations</h3>
<p>The Broker shall obtain the advertising permit before marketing, advertise only accurate information, present all offers promptly and keep the Seller informed.</p>
<h3>7. Governing law</h3>
<p>The laws of the Emirate of Dubai and the federal laws of the United Arab Emirates. Disputes are referred to the Dubai Courts.</p>${execution}`,
  },
  {
    key: "ae_form_b",
    name: "Form B: Agreement between buyer and broker",
    jurisdiction: "AE",
    kind: "buyer_agreement",
    parties: ["buyer", "advisor"],
    description: "Appoints the firm to find a property for a buyer in Dubai, with the buyer's requirements, budget and commission.",
    officialNote: "Structured on RERA Form B. Use the official Form B issued through the DLD's systems where required.",
    inputs: [
      { path: "requirements", label: "Buyer's requirements", type: "text", default: "Two-bedroom apartment in Dubai Marina or Jumeirah Lake Towers" },
      { path: "commission.pct", label: "Commission, %", type: "number", default: 2 },
      { path: "listing.termDays", label: "Term, days", type: "number", default: 60 },
    ],
    body: `<h2>Agreement between Buyer and Broker (Form B)</h2>
<p><strong>Reference</strong> {{reference}} · <strong>Date</strong> {{date | long}}</p>
<h3>1. Parties</h3>
<p><strong>{{buyer.name}}</strong> (the Buyer), and <strong>{{firm.name}}</strong>, ORN {{firm.orn}}, acting through {{agent.name}}, BRN {{agent.brn}} (the Broker).</p>
<h3>2. Requirements</h3>
<p>{{requirements}}, with a budget of up to {{price | money}}.</p>
<h3>3. Term</h3>
<p>{{listing.termDays}} days from the date of this agreement.</p>
<h3>4. Commission</h3>
<p>If the Buyer purchases a property introduced by the Broker during the term, the Buyer pays the Broker {{commission.pct}}% of the purchase price, plus VAT at {{commission.vatPct}}%, on transfer.</p>
<h3>5. Due diligence</h3>
<p>The Buyer shall provide identity documents and evidence of the source of funds required by the UAE anti-money-laundering laws before any offer is made.</p>
<h3>6. Governing law</h3>
<p>The laws of the Emirate of Dubai and the federal laws of the United Arab Emirates.</p>${execution}`,
  },
  {
    key: "ae_form_f",
    name: "Form F: Memorandum of understanding between buyer and seller",
    jurisdiction: "AE",
    kind: "sale_mou",
    parties: ["buyer", "seller", "advisor"],
    description: "The agreed sale terms between buyer and seller in Dubai: price, deposit, transfer date, mortgage and default.",
    officialNote: "Structured on RERA Form F (Contract F, MOU). The DLD-issued Form F is the document registered with the Trustee Office; this draft records the agreed terms for review before it is completed.",
    inputs: [
      { path: "mortgage.buyer", label: "Buyer is financing with a mortgage", type: "boolean", default: false },
      { path: "mortgage.seller", label: "Property is mortgaged by the seller", type: "boolean", default: false },
    ],
    body: `<h2>Memorandum of Understanding (Form F)</h2>
<p><strong>Reference</strong> {{reference}} · <strong>Date</strong> {{date | long}}</p>
<h3>1. Parties</h3>
<p><strong>{{seller.name}}</strong> (the Seller) and <strong>{{buyer.name}}</strong> (the Buyer), introduced by {{firm.name}}, ORN {{firm.orn}}.</p>
<h3>2. Property</h3>
<p>{{property.unit}}, {{property.name}}, {{property.community}}, {{property.city}}, title deed or Oqood number {{property.titleNumber}}{{#if property.areaSqft}}, approximately {{property.areaSqft | number}} square feet{{/if}}{{#if property.parking}}, with {{property.parking}} parking{{/if}}.</p>
<h3>3. Price</h3>
<p>{{price | money}} ({{price | words}} {{currency}}).</p>
<h3>4. Security deposit</h3>
<p>The Buyer pays a security deposit of {{depositPct}}% ({{deposit | money}}) on signing, by cheque in the name of the Seller, held by the Broker until transfer.</p>
<h3>5. Transfer</h3>
<p>Transfer shall take place at a Dubai Land Department Trustee Office on or before {{completionDate | long}}. The balance of {{balance | money}} is paid on transfer by manager's cheque.</p>
{{#if mortgage.buyer}}<p>The Buyer is purchasing with mortgage finance. If the Buyer's bank declines finance despite the Buyer's reasonable efforts, the deposit is returned in full.</p>{{/if}}
{{#if mortgage.seller}}<p>The Property is mortgaged. The Seller shall obtain the bank's liability letter, and the Buyer may pay the outstanding amount directly to the Seller's bank before transfer, deducted from the price.</p>{{/if}}
<h3>6. Fees</h3>
<p>The Dubai Land Department transfer fee of 4% and the trustee fee are paid by the Buyer. The developer's no-objection certificate is obtained and paid for by the Seller.</p>
{{#if conditions}}<h3>7. Special conditions</h3><ol>{{#each conditions}}<li>{{this}}</li>{{/each}}</ol>{{/if}}
<h3>Default</h3>
<p>If the Buyer fails to complete, the Seller retains the deposit. If the Seller fails to complete, the Seller returns the deposit and pays the Buyer an equal amount as compensation. Each party pays the Broker the commission agreed with it.</p>
<h3>Governing law</h3>
<p>The laws of the Emirate of Dubai and the federal laws of the United Arab Emirates, including Law No. 7 of 2006 concerning Real Property Registration.</p>${execution}`,
  },
  {
    key: "in_maharera_afs",
    name: "Agreement for Sale (Maharashtra, MahaRERA)",
    jurisdiction: "IN",
    kind: "agreement_for_sale",
    parties: ["buyer", "seller", "advisor"],
    description: "Agreement for sale of an apartment in a MahaRERA-registered project: carpet area, payment plan, possession and the RERA remedies. Adds the FEMA clause when the purchaser is a non-resident.",
    officialNote: "Follows the structure of the model agreement for sale under the Maharashtra RERA rules. For a registered project the promoter's agreement must conform to the model form and be registered under the Registration Act 1908 with stamp duty paid.",
    inputs: [
      { path: "possessionDate", label: "Possession date", type: "date" },
      { path: "property.carpetAreaSqm", label: "Carpet area, square metres", type: "number" },
      { path: "reraNumber", label: "MahaRERA project registration", type: "text" },
    ],
    body: `<h2>Agreement for Sale</h2>
<p><strong>Reference</strong> {{reference}} · <strong>Date</strong> {{date | long}}</p>
<h3>1. Parties</h3>
<p><strong>{{seller.name}}</strong> (the Promoter or Vendor) and <strong>{{buyer.name}}</strong>{{#if buyer.isNri}}, a person resident outside India{{/if}} (the Allottee or Purchaser).</p>
<h3>2. Apartment</h3>
<p>Apartment {{property.unit}} in {{property.name}}, {{property.community}}, {{property.city}}, in the project registered with MahaRERA under number {{reraNumber}}, with a carpet area of {{property.carpetAreaSqm}} square metres as defined in section 2(k) of the Real Estate (Regulation and Development) Act 2016.</p>
<h3>3. Consideration</h3>
<p>The total consideration is {{price | money}} (Rupees {{price | words}} only), payable as set out in Schedule 1. The Promoter shall not accept more than ten per cent of the consideration as an advance before this agreement is registered (section 13 of the Act).</p>
<h3>4. Possession</h3>
<p>Possession shall be handed over on or before {{possessionDate | long}}. If the Promoter fails to do so, the Allottee may withdraw and receive a refund with interest, or continue and receive interest for each month of delay, at the rate prescribed under the Maharashtra rules (section 18 of the Act).</p>
<h3>5. Defects</h3>
<p>Structural defects or defects in workmanship, quality or services notified within five years of possession shall be rectified by the Promoter without charge within thirty days (section 14(3) of the Act).</p>
<h3>6. Stamp duty and registration</h3>
<p>Stamp duty under the Maharashtra Stamp Act 1958 and the registration charges are borne by the Allottee. This agreement shall be registered under the Registration Act 1908.</p>
<h3>7. Tax deducted at source</h3>
<p>{{#if seller.isNri}}The Vendor is a non-resident; the Purchaser shall deduct tax at source under section 195 of the Income-tax Act 1961 at the applicable rate and furnish the certificate.{{else}}Where the consideration is fifty lakh rupees or more, the Purchaser shall deduct tax at source under section 194-IA of the Income-tax Act 1961 and deposit it within the prescribed time.{{/if}}</p>
{{#if buyer.isNri}}<h3>8. Foreign exchange</h3>
<p>The Allottee, being a person resident outside India, confirms that the consideration is paid by inward remittance through banking channels or from the Allottee's NRE, NRO or FCNR(B) account, in accordance with the Foreign Exchange Management Act 1999 and the Foreign Exchange Management (Non-debt Instruments) Rules 2019, and that the apartment is not agricultural land, a plantation property or a farm house. The Allottee shall be responsible for compliance with those rules on any later transfer or repatriation of sale proceeds.</p>{{/if}}
{{#if conditions}}<h3>Special conditions</h3><ol>{{#each conditions}}<li>{{this}}</li>{{/each}}</ol>{{/if}}
<h3>Disputes</h3>
<p>Disputes relating to this agreement are first referred to MahaRERA under the Act, and otherwise to the courts at {{property.city}}.</p>${execution}`,
  },
  {
    key: "gb_sale_contract",
    name: "Contract for sale (England and Wales)",
    jurisdiction: "GB",
    kind: "sale_contract",
    parties: ["buyer", "seller"],
    description: "Contract for the sale of freehold or leasehold residential property, incorporating the Standard Conditions of Sale by reference with special conditions.",
    officialNote: "Incorporates the Standard Conditions of Sale (fifth edition, 2018 revision) by reference, as conveyancers commonly do; the conditions themselves are not reproduced. Exchange and completion are handled by each party's conveyancer.",
    inputs: [
      { path: "tenure", label: "Tenure (freehold or leasehold)", type: "text", default: "freehold" },
      { path: "contractRatePct", label: "Contract rate above base rate, %", type: "number", default: 4 },
    ],
    body: `<h2>Contract for Sale</h2>
<p><strong>Reference</strong> {{reference}} · <strong>Date</strong> {{date | long}}</p>
<p>This contract incorporates the Standard Conditions of Sale (fifth edition, 2018 revision). Where there is a conflict between those conditions and this contract, this contract prevails.</p>
<h3>Particulars</h3>
<ol>
<li><strong>Seller</strong>: {{seller.name}}</li>
<li><strong>Buyer</strong>: {{buyer.name}}</li>
<li><strong>Property</strong> ({{tenure}}): {{property.unit}} {{property.name}}, {{property.community}}, {{property.city}}, registered at HM Land Registry under title number {{property.titleNumber}}</li>
<li><strong>Purchase price</strong>: {{price | money}}</li>
<li><strong>Deposit</strong>: {{deposit | money}} ({{depositPct}}%)</li>
<li><strong>Completion date</strong>: {{completionDate | long}}</li>
<li><strong>Contract rate</strong>: {{contractRatePct}}% above the Bank of England base rate</li>
</ol>
<h3>Special conditions</h3>
<ol>
<li>The Property is sold with vacant possession on completion.</li>
<li>The Seller sells with full title guarantee.</li>
{{#if tenure == "leasehold"}}<li>The Property is sold subject to the lease under which it is held. The Seller shall provide the landlord's management information and arrange any landlord's consent required for the assignment.</li>{{/if}}
{{#each conditions}}<li>{{this}}</li>{{/each}}
</ol>
<h3>Stamp Duty Land Tax</h3>
<p>The Buyer is responsible for any Stamp Duty Land Tax and the land transaction return.</p>${execution}`,
  },
  {
    key: "sg_cea_sale",
    name: "Estate agency agreement for the sale of residential property (Singapore)",
    jurisdiction: "SG",
    kind: "agency_agreement",
    parties: ["seller", "advisor"],
    description: "Appoints the estate agency to sell a private residential property in Singapore, with the commission, term and the agent's duties under the Estate Agents Act.",
    officialNote: "Follows the CEA prescribed estate agency agreement for the sale of residential property. The prescribed form must be used for HDB and private residential sales; this draft records the firm's terms for review alongside it.",
    inputs: [
      { path: "listing.exclusive", label: "Exclusive appointment", type: "boolean", default: true },
      { path: "listing.termDays", label: "Term, days", type: "number", default: 90 },
      { path: "commission.pct", label: "Commission, %", type: "number", default: 2 },
    ],
    body: `<h2>Estate Agency Agreement for the Sale of Residential Property</h2>
<p><strong>Reference</strong> {{reference}} · <strong>Date</strong> {{date | long}}</p>
<h3>1. Parties</h3>
<p><strong>{{seller.name}}</strong> (the Client) and <strong>{{firm.name}}</strong>, CEA licence {{firm.licence}}, represented by {{agent.name}}, CEA registration {{agent.brn}} (the Estate Agent).</p>
<h3>2. Property</h3>
<p>{{property.unit}}, {{property.name}}, {{property.community}}, Singapore.</p>
<h3>3. Appointment and term</h3>
<p>The Client appoints the Estate Agent {{#if listing.exclusive}}as sole agent{{else}}as a non-exclusive agent{{/if}} for {{listing.termDays}} days to sell the Property at a price of {{price | money}} or another price the Client accepts.</p>
<h3>4. Commission</h3>
<p>The Client pays the Estate Agent {{commission.pct}}% of the sale price, plus GST at {{commission.vatPct}}%, on completion. Commission is payable only to the estate agency, never to the salesperson directly.</p>
<h3>5. Estate Agent's duties</h3>
<p>The Estate Agent shall act in the Client's interest, disclose any conflict of interest, not represent both buyer and seller in the same transaction, and carry out customer due diligence as required under the Estate Agents (Prevention of Money Laundering and Financing of Terrorism) Regulations.</p>
<h3>6. Disputes</h3>
<p>Disputes are first referred to the CEA's dispute resolution scheme, and otherwise to the courts of Singapore.</p>${execution}`,
  },
  {
    key: "custom",
    name: "Custom agreement",
    jurisdiction: "ANY",
    kind: "custom",
    parties: ["buyer", "seller", "advisor"],
    description: "A blank starting point with the parties, property and price; add the firm's own clauses.",
    officialNote: "A starting point for the firm's own agreements. Have it reviewed by a lawyer licensed in the relevant jurisdiction before use.",
    inputs: [],
    body: `<h2>Agreement</h2>
<p><strong>Reference</strong> {{reference}} · <strong>Date</strong> {{date | long}}</p>
<h3>1. Parties</h3>
<p><strong>{{seller.name}}</strong> and <strong>{{buyer.name}}</strong>, with {{firm.name}} as adviser.</p>
<h3>2. Property</h3>
<p>{{property.name}}, {{property.community}}, {{property.city}}.</p>
<h3>3. Price</h3>
<p>{{price | money}}.</p>
{{#if conditions}}<h3>4. Conditions</h3><ol>{{#each conditions}}<li>{{this}}</li>{{/each}}</ol>{{/if}}${execution}`,
  },
];

export const JURISDICTION_NAME = { AE: "United Arab Emirates", IN: "India", GB: "United Kingdom", SG: "Singapore", ANY: "Any jurisdiction" } as const;
