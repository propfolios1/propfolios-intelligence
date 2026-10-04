import Link from "next/link";
import { Eyebrow, Heading, Lead, Reveal, Section } from "./motion";

const SOURCES = ["Follow Up Boss", "Salesforce", "Propertybase", "HubSpot", "Zoho CRM", "kvCORE", "Any CSV"];
const STEPS = [
  ["Connect", "Authorise your CRM, or upload a CSV. Credentials are sealed and can be removed afterwards."],
  ["Map", "Columns are matched to Nakhla fields by name; stages, sources and intent are mapped value by value."],
  ["Dry run", "Every record is validated and de-duplicated, and the report shows what will be created, merged or skipped."],
  ["Import", "Records keep their original dates and source IDs. For 24 hours, the whole import can be undone."],
];

export function Migration() {
  return (
    <Section id="migration" label="Migration" className="border-y border-hairline bg-surface" grid>
      <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Reveal>
          <Eyebrow gold>Switching</Eyebrow>
          <Heading className="mt-4">Move in a day, not a quarter.</Heading>
          <Lead className="mt-6">Bring your leads and listings across yourself, with nothing written until you have seen the dry run. Enterprise firms get our team alongside.</Lead>
          <ul className="mt-8 flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <li key={s} className="rounded-full border border-hairline bg-canvas px-3 py-1 text-[13px] text-ink-700">
                {s}
              </li>
            ))}
          </ul>
          <Link href="/docs/migration" className="mt-8 inline-block text-[14px] text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
            Read the migration guide
          </Link>
        </Reveal>
        <ol className="grid gap-px self-start overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2">
          {STEPS.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 0.06} className="bg-surface p-6">
              <span className="num text-[13px] text-gold-600">0{i + 1}</span>
              <h3 className="mt-3 text-[18px] font-medium text-navy-900">{t}</h3>
              <p className="mt-2 text-[14px] leading-[1.55] text-ink-700">{d}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}
