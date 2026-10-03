/**
 * Sample land records used by the seed and the parser tests. They follow the
 * layout of certified copies (English with Marathi or Portuguese labels) and
 * describe the demonstration properties; they are not real records.
 */

export function sample712(o: { district: string; taluka: string; village: string; survey: string; hissa: string; area: string; holders: string; other: string; mutation: string; classNo: 1 | 2 }) {
  return `GOVERNMENT OF MAHARASHTRA
गाव नमुना सात (Village Form VII) — 7/12 Extract
जिल्हा District: ${o.district}
तालुका Taluka: ${o.taluka}
गाव Village: ${o.village}
भूमापन क्रमांक Survey No: ${o.survey}
हिस्सा क्रमांक Hissa No: ${o.hissa}
भूधारणा पद्धती Tenure: भोगवटादार वर्ग-${o.classNo === 1 ? "१" : "२"} (Occupant Class ${o.classNo})
एकूण क्षेत्र Total Area: ${o.area} H.R.P.
पोट खराबा Pot Kharaba: 0.01.20
आकारणी Assessment: Rs. 14.50
भोगवटादाराचे नाव: ${o.holders}
इतर अधिकार Other Rights: ${o.other}
फेरफार क्रमांक Mutation No: ${o.mutation}
Non-agricultural use permitted vide Collector order (N.A. order) — अकृषिक`;
}

export function samplePropertyCard(o: { division: string; village: string; cts: string; sheet: string; area: string; tenure: string; holder: string; entries: string[] }) {
  return `CITY SURVEY OFFICE, MUMBAI
मालमत्ता पत्रक (Property Card)
विभाग Division: ${o.division}
गाव Village: ${o.village}
न.भू.क्र C.T.S. No: ${o.cts}
शीट क्रमांक Sheet No: ${o.sheet}
क्षेत्र Area (sq. m): ${o.area}
धारणाधिकार Tenure: ${o.tenure}
धारक Holder: ${o.holder}
${o.entries.join("\n")}`;
}

export function sampleFormI(o: { taluka: string; village: string; survey: string; sub: string; field: string; area: string; landClass: string; occupants: string; tenant: string; mundkar: string; other: string; crop: string; mutation: string }) {
  return `GOVERNMENT OF GOA — DIRECTORATE OF SETTLEMENT AND LAND RECORDS
FORM I & XIV (Record of Rights)
Taluka: ${o.taluka}
Village: ${o.village}
Survey No: ${o.survey}
Sub-Div No: ${o.sub}
Name of the field: ${o.field}
Total Area: ${o.area} sq. mts
Class of land: ${o.landClass}
Name of the Occupant: ${o.occupants}
Name of Tenant: ${o.tenant}
Mundkar: ${o.mundkar}
Other Rights: ${o.other}
Crop: ${o.crop}
Mutation No: ${o.mutation}`;
}

export function sampleComunidade(o: { comunidade: string; aforamento: string; plot: string; foreiro: string; foro: string; area: string; gb: string; admin: string; escritura: string; notary: string; condition: string }) {
  return `CARTA DE AFORAMENTO — Comunidade de ${o.comunidade}
Aforamento No: ${o.aforamento}
Plot No: ${o.plot}
Foreiro: ${o.foreiro}
Foro: Rs. ${o.foro} per annum
Area: ${o.area} sq m
Resolution of the General Body: ${o.gb}
Administrator of Comunidades: ${o.admin}
Escritura de aforamento dated ${o.escritura}
Notary: ${o.notary}
Condition: ${o.condition}`;
}
