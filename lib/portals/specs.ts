import type { MarketCode } from "@/lib/markets";

/**
 * Portal publishing specifications. Each portal has a transport (how a
 * listing is sent), an authentication scheme, the credential fields a firm
 * enters, rate limits, and a default field map from Nakhla listing fields to
 * the portal's own field names.
 *
 * Rightmove (Real Time Datafeed) and Zoopla (Real-time Listings) publish
 * their API specifications to member agents; both authenticate with a TLS
 * client certificate issued per branch. Bayut, Dubizzle, Property Finder,
 * MagicBricks, 99acres and Housing.com expose listing APIs to partner
 * agencies under agreement: the base URL and keys come from the portal's
 * partner onboarding, and the default field names follow each portal's
 * published listing feed specification. Every field mapping can be edited
 * per firm in Administration > Portals without code changes.
 */

export type ListingSource =
  | "reference"
  | "title"
  | "description"
  | "purpose"
  | "propertyType"
  | "price"
  | "currency"
  | "city"
  | "community"
  | "bedrooms"
  | "bathrooms"
  | "area"
  | "areaSqm"
  | "permitNumber"
  | "photoUrls"
  | "photoObjects"
  | "agentName"
  | "agentEmail"
  | "agentPhone"
  | "rentPeriod"
  | "status"
  | "listedAt"
  | "features"
  | "branchId"
  | "networkId"
  | "const";

export type FieldRule = { target: string; source: ListingSource; value?: string | number | boolean; map?: Record<string, string | number | boolean>; required?: boolean };

export type Transport = "rest" | "rtdf" | "zoopla";
export type Auth = "api_key" | "client_credentials" | "mtls";

export interface PortalSpec {
  key: string;
  name: string;
  market: MarketCode;
  transport: Transport;
  auth: Auth;
  /** Fields the firm enters when connecting. Secret fields are sealed at rest. */
  credentials: { key: string; label: string; secret: boolean; multiline?: boolean; hint?: string }[];
  /** A documented production host, when the portal publishes one; otherwise the partner programme supplies it. */
  defaultBaseUrl: string | null;
  sandboxBaseUrl?: string | null;
  rateLimitPerMinute: number;
  fieldMap: FieldRule[];
  /** Where the firm obtains access. */
  access: string;
}

const UAE_TYPES = { Apartment: "AP", Villa: "VH", Townhouse: "TH", Penthouse: "PH", Office: "OF", Condominium: "AP", House: "VH" };

const rest = (key: string, name: string, market: MarketCode, fieldMap: FieldRule[], access: string, rate = 60): PortalSpec => ({
  key,
  name,
  market,
  transport: "rest",
  auth: "api_key",
  credentials: [
    { key: "baseUrl", label: "API base URL", secret: false, hint: "From the portal's partner onboarding." },
    { key: "apiKey", label: "API key", secret: true },
    { key: "accountId", label: "Agency or account ID", secret: false },
  ],
  defaultBaseUrl: null,
  rateLimitPerMinute: rate,
  fieldMap,
  access,
});

export const PORTAL_SPECS: Record<string, PortalSpec> = {
  propertyfinder: {
    ...rest(
      "propertyfinder",
      "Property Finder",
      "AE",
      [
        { target: "reference_number", source: "reference", required: true },
        { target: "offering_type", source: "purpose", map: { sale: "RS", rent: "RR" }, required: true },
        { target: "property_type", source: "propertyType", map: UAE_TYPES, required: true },
        { target: "price", source: "price", required: true },
        { target: "rental_period", source: "rentPeriod", map: { annual: "Y", monthly: "M" } },
        { target: "city", source: "city", required: true },
        { target: "community", source: "community", required: true },
        { target: "title_en", source: "title", required: true },
        { target: "description_en", source: "description", required: true },
        { target: "bedroom", source: "bedrooms" },
        { target: "bathroom", source: "bathrooms" },
        { target: "size", source: "area" },
        { target: "permit_number", source: "permitNumber", required: true },
        { target: "photo", source: "photoUrls" },
        { target: "agent.name", source: "agentName" },
        { target: "agent.email", source: "agentEmail" },
        { target: "agent.phone", source: "agentPhone" },
      ],
      "Property Finder issues API credentials to agencies on its enterprise programme; ask your account manager for API access.",
    ),
    auth: "client_credentials",
    credentials: [
      { key: "baseUrl", label: "API base URL", secret: false, hint: "From Property Finder's partner onboarding." },
      { key: "clientId", label: "Client ID", secret: false },
      { key: "clientSecret", label: "Client secret", secret: true },
      { key: "accountId", label: "Agency ID", secret: false },
    ],
  },
  bayut: rest(
    "bayut",
    "Bayut",
    "AE",
    [
      { target: "Property_Ref_No", source: "reference", required: true },
      { target: "Permit_Number", source: "permitNumber", required: true },
      { target: "Property_purpose", source: "purpose", map: { sale: "Buy", rent: "Rent" }, required: true },
      { target: "Property_Type", source: "propertyType", required: true },
      { target: "Price", source: "price", required: true },
      { target: "Rent_Frequency", source: "rentPeriod", map: { annual: "Yearly", monthly: "Monthly" } },
      { target: "City", source: "city", required: true },
      { target: "Locality", source: "community", required: true },
      { target: "Property_Title", source: "title", required: true },
      { target: "Web_Remarks", source: "description", required: true },
      { target: "Bedrooms", source: "bedrooms" },
      { target: "No_of_Bathroom", source: "bathrooms" },
      { target: "Property_Size", source: "area" },
      { target: "Property_Size_Unit", source: "const", value: "SQFT" },
      { target: "Images", source: "photoUrls" },
      { target: "Listing_Agent", source: "agentName" },
      { target: "Listing_Agent_Email", source: "agentEmail" },
      { target: "Listing_Agent_Phone", source: "agentPhone" },
    ],
    "Bayut and Dubizzle share the Dubizzle Group partner programme; request API access through your Bayut account manager.",
  ),
  dubizzle: rest(
    "dubizzle",
    "Dubizzle",
    "AE",
    [
      { target: "reference_number", source: "reference", required: true },
      { target: "permit_number", source: "permitNumber", required: true },
      { target: "listing_type", source: "purpose", map: { sale: "sale", rent: "rent" }, required: true },
      { target: "category", source: "propertyType", required: true },
      { target: "price", source: "price", required: true },
      { target: "rent_frequency", source: "rentPeriod", map: { annual: "yearly", monthly: "monthly" } },
      { target: "city", source: "city", required: true },
      { target: "neighbourhood", source: "community", required: true },
      { target: "title", source: "title", required: true },
      { target: "description", source: "description", required: true },
      { target: "bedrooms", source: "bedrooms" },
      { target: "bathrooms", source: "bathrooms" },
      { target: "size_sqft", source: "area" },
      { target: "photos", source: "photoUrls" },
      { target: "contact.name", source: "agentName" },
      { target: "contact.phone", source: "agentPhone" },
    ],
    "Dubizzle Property access is arranged through the Dubizzle Group partner programme, alongside Bayut.",
  ),
  magicbricks: rest(
    "magicbricks",
    "MagicBricks",
    "IN",
    [
      { target: "propertyRefId", source: "reference", required: true },
      { target: "transactionType", source: "purpose", map: { sale: "Sale", rent: "Rent" }, required: true },
      { target: "propertyType", source: "propertyType", required: true },
      { target: "price", source: "price", required: true },
      { target: "city", source: "city", required: true },
      { target: "locality", source: "community", required: true },
      { target: "reraRegistrationNo", source: "permitNumber", required: true },
      { target: "title", source: "title", required: true },
      { target: "description", source: "description", required: true },
      { target: "bedrooms", source: "bedrooms" },
      { target: "bathrooms", source: "bathrooms" },
      { target: "carpetArea", source: "area" },
      { target: "areaUnit", source: "const", value: "sqft" },
      { target: "images", source: "photoUrls" },
      { target: "contactName", source: "agentName" },
      { target: "contactMobile", source: "agentPhone" },
    ],
    "MagicBricks provides listing API access to agents on its prime and partner packages.",
  ),
  "99acres": rest(
    "99acres",
    "99acres",
    "IN",
    [
      { target: "xid", source: "reference", required: true },
      { target: "res_com", source: "const", value: "R" },
      { target: "preference", source: "purpose", map: { sale: "S", rent: "R" }, required: true },
      { target: "property_type", source: "propertyType", required: true },
      { target: "price", source: "price", required: true },
      { target: "city", source: "city", required: true },
      { target: "locality", source: "community", required: true },
      { target: "rera_registration_number", source: "permitNumber", required: true },
      { target: "description", source: "description", required: true },
      { target: "bedroom_num", source: "bedrooms" },
      { target: "bathroom_num", source: "bathrooms" },
      { target: "carpet_area", source: "area" },
      { target: "photos", source: "photoObjects" },
      { target: "contact_name", source: "agentName" },
      { target: "contact_mobile", source: "agentPhone" },
    ],
    "99acres (Info Edge) enables API listing for agents on its paid plans; ask your sales manager for API credentials.",
  ),
  housing: rest(
    "housing",
    "Housing.com",
    "IN",
    [
      { target: "external_id", source: "reference", required: true },
      { target: "service", source: "purpose", map: { sale: "buy", rent: "rent" }, required: true },
      { target: "apartment_type", source: "propertyType", required: true },
      { target: "price", source: "price", required: true },
      { target: "city", source: "city", required: true },
      { target: "locality", source: "community", required: true },
      { target: "rera_id", source: "permitNumber", required: true },
      { target: "title", source: "title", required: true },
      { target: "description", source: "description", required: true },
      { target: "bhk", source: "bedrooms" },
      { target: "bathrooms", source: "bathrooms" },
      { target: "area", source: "area" },
      { target: "images", source: "photoUrls" },
      { target: "seller_name", source: "agentName" },
      { target: "seller_phone", source: "agentPhone" },
    ],
    "Housing.com offers listing integration to partner brokers; request it through your Housing.com account manager.",
  ),
  rightmove: {
    key: "rightmove",
    name: "Rightmove",
    market: "GB",
    transport: "rtdf",
    auth: "mtls",
    credentials: [
      { key: "baseUrl", label: "Datafeed host", secret: false, hint: "Rightmove's Real Time Datafeed host; the test host is issued with your certificate." },
      { key: "networkId", label: "Network ID", secret: false },
      { key: "branchId", label: "Branch ID", secret: false },
      { key: "certificate", label: "Client certificate (PEM)", secret: true, multiline: true },
      { key: "privateKey", label: "Private key (PEM)", secret: true, multiline: true },
    ],
    defaultBaseUrl: "https://adfapi.rightmove.co.uk",
    rateLimitPerMinute: 60,
    fieldMap: [
      { target: "network.network_id", source: "networkId", required: true },
      { target: "branch.branch_id", source: "branchId", required: true },
      { target: "branch.channel", source: "purpose", map: { sale: 1, rent: 2 }, required: true },
      { target: "property.agent_ref", source: "reference", required: true },
      { target: "property.published", source: "const", value: true },
      { target: "property.property_type", source: "propertyType", map: { Apartment: 28, Flat: 28, House: 1, Townhouse: 3, Penthouse: 29, Condominium: 28, Villa: 4 }, required: true },
      { target: "property.status", source: "status", map: { active: 1, under_offer: 3, sold: 2, let: 2, draft: 1, withdrawn: 1 } },
      { target: "property.address.town", source: "city", required: true },
      { target: "property.address.display_address", source: "community", required: true },
      { target: "property.price_information.price", source: "price", required: true },
      { target: "property.details.summary", source: "title", required: true },
      { target: "property.details.description", source: "description", required: true },
      { target: "property.details.bedrooms", source: "bedrooms" },
      { target: "property.details.bathrooms", source: "bathrooms" },
      { target: "property.media", source: "photoObjects" },
    ],
    access: "Rightmove issues a client certificate and network and branch IDs to member agents for the Real Time Datafeed; request them from Rightmove's data services team.",
  },
  zoopla: {
    key: "zoopla",
    name: "Zoopla",
    market: "GB",
    transport: "zoopla",
    auth: "mtls",
    credentials: [
      { key: "baseUrl", label: "Real-time Listings host", secret: false },
      { key: "branchId", label: "Branch reference", secret: false },
      { key: "certificate", label: "Client certificate (PEM)", secret: true, multiline: true },
      { key: "privateKey", label: "Private key (PEM)", secret: true, multiline: true },
    ],
    defaultBaseUrl: "https://realtime-listings-api.webservices.zpg.co.uk/live",
    sandboxBaseUrl: "https://realtime-listings-api.webservices.zpg.co.uk/sandbox",
    rateLimitPerMinute: 60,
    fieldMap: [
      { target: "branch_reference", source: "branchId", required: true },
      { target: "listing_reference", source: "reference", required: true },
      { target: "category", source: "const", value: "residential" },
      { target: "life_cycle_status", source: "status", map: { active: "available", under_offer: "under_offer", sold: "sold_subject_to_contract", let: "let_agreed", draft: "available", withdrawn: "available" } },
      { target: "pricing.transaction_type", source: "purpose", map: { sale: "sale", rent: "rent" }, required: true },
      { target: "pricing.price", source: "price", required: true },
      { target: "pricing.currency_code", source: "currency" },
      { target: "pricing.rent_frequency", source: "rentPeriod", map: { monthly: "per_month", annual: "per_year" } },
      { target: "property_type", source: "propertyType", map: { Apartment: "flat", House: "detached", Townhouse: "town_house", Penthouse: "penthouse", Condominium: "flat", Villa: "detached" }, required: true },
      { target: "location.town_or_city", source: "city", required: true },
      { target: "location.street_name", source: "community", required: true },
      { target: "location.country_code", source: "const", value: "GB" },
      { target: "summary_description", source: "title", required: true },
      { target: "detailed_description.0.text", source: "description", required: true },
      { target: "total_bedrooms", source: "bedrooms" },
      { target: "bathrooms", source: "bathrooms" },
      { target: "content", source: "photoObjects" },
    ],
    access: "Zoopla issues Real-time Listings API certificates to member branches through its integration team; the sandbox host is used until certification.",
  },
};

export const PORTAL_KEYS = Object.keys(PORTAL_SPECS);
