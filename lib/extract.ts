import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const ExtractedSchema = z.object({
  profile: z.object({
    fullName: z.string().nullable(),
    dateOfBirth: z.string().nullable().describe("YYYY-MM-DD"),
    sex: z.string().nullable().describe("Male, Female or Other"),
    nationality: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    passportNumber: z.string().nullable().describe("Current passport number"),
    nationalId: z.string().nullable().describe("National ID / NIC number"),
    passportIssueDate: z.string().nullable().describe("YYYY-MM-DD"),
    passportExpiryDate: z.string().nullable().describe("YYYY-MM-DD"),
    previousPassports: z.array(z.string()).describe("Older passport numbers"),
  }),
  trips: z.array(
    z.object({
      countryCode: z.string().describe("ISO 3166-1 alpha-2 country code, e.g. TH, GB, AE"),
      city: z.string().nullable().describe("City if the document names one, e.g. Dubai, London"),
      departureDate: z.string().describe("YYYY-MM-DD"),
      returnDate: z.string().nullable().describe("YYYY-MM-DD"),
      purpose: z.string(),
      passportNumber: z.string().nullable(),
      notes: z.string().nullable(),
    }),
  ),
  issues: z.array(z.string()).describe("Problems found in the document that the admin should check"),
});

export type Extracted = z.infer<typeof ExtractedSchema>;

const INSTRUCTIONS = `You are reading a personal immigration / travel history document (it may be a table, a letter, a passport page or a photo of one).
Extract the traveller's personal details and EVERY individual trip.

Rules:
- One trip per journey per country. If a row lists several countries for one journey (e.g. Netherlands, Belgium, France), output one trip per country with the same dates and a short note.
- When a row lists several visits to the same country, output each visit as its own trip, pairing departure and return dates in order.
- countryCode must be the ISO 3166-1 alpha-2 code. Map cities to their country (Dubai -> AE with city "Dubai", London -> GB with city "London").
- Dates must be YYYY-MM-DD. If a year is missing, infer it from the departure date and add a note saying so.
- If a return date is before its departure date, or a date is ambiguous (e.g. "21 June 2018/25 June 2018"), choose the most plausible reading, explain it in that trip's notes, and add a line to issues.
- Passport numbers in upper case without spaces. If the document lists several passport numbers without saying which is current, treat the first as current and the rest as previous, and mention that in issues.
- Use null for anything not in the document. Never invent personal details.`;

const VisaSchema = z.object({
  countryCode: z.string().nullable().describe("ISO 3166-1 alpha-2 code of the country that issued the visa"),
  visaType: z.string().nullable().describe("e.g. Tourist, Business, Student (subclass 500), Work, Transit"),
  visaFormat: z.string().nullable().describe("e-Visa, Paper visa (sticker/stamp in passport), Visa on arrival, or ETA"),
  visaNumber: z.string().nullable(),
  issueDate: z.string().nullable().describe("YYYY-MM-DD"),
  expiryDate: z.string().nullable().describe("YYYY-MM-DD"),
  travelFrom: z.string().nullable().describe("YYYY-MM-DD: first date travel/entry is allowed, if shown"),
  travelTo: z.string().nullable().describe("YYYY-MM-DD: last date travel/entry is allowed, if shown"),
  purpose: z.string().nullable().describe("Purpose of visit, e.g. Tourism, Business, Study"),
  entries: z.string().nullable().describe("Single, Double or Multiple"),
  stayDays: z.number().nullable().describe("Maximum days per stay"),
  issuedAt: z.string().nullable().describe("Place, embassy or authority that issued it"),
  passportNumber: z.string().nullable(),
});

const PageVisasSchema = z.object({ visas: z.array(VisaSchema) });

/**
 * Reads EVERY visa on one passport page / visa document image with Claude (a page can hold several
 * visa stickers). Entry / exit stamps are not visas and are left out. Needs ANTHROPIC_API_KEY.
 */
export async function extractVisasOnPage(bytes: Buffer, mediaType: string): Promise<z.infer<typeof VisaSchema>[]> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 6000,
    output_config: { effort: "low", format: zodOutputFormat(PageVisasSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: bytes.toString("base64") },
          },
          {
            type: "text",
            text:
              "This is a scanned passport page or visa document. List every VISA on it (visa stickers, e-visas, grant notices, visas on arrival); " +
              "a page can hold more than one. Do not list entry/exit stamps as visas. For each visa give the issuing country as an ISO 3166-1 alpha-2 code, " +
              "dates as YYYY-MM-DD, and use null for anything not shown; never guess. If there is no visa on the page, return an empty list.",
          },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Could not read the page.");
  return response.parsed_output.visas;
}

/** Reads a visa (sticker photo, e-visa, grant letter) with Claude. Needs ANTHROPIC_API_KEY. */
export async function extractVisa(bytes: Buffer, mediaType: string): Promise<z.infer<typeof VisaSchema>> {
  const client = new Anthropic();
  const data = bytes.toString("base64");
  const source =
    mediaType === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({
          type: "image",
          source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data },
        } as const);
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(VisaSchema) },
    messages: [
      {
        role: "user",
        content: [
          source,
          {
            type: "text",
            text: "This is a visa (sticker, e-visa or grant notice). Extract its details. Dates as YYYY-MM-DD. Use null for anything not shown; never guess.",
          },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Could not read the visa.");
  return response.parsed_output;
}

export async function extractFromDocument(bytes: Buffer, mediaType: string): Promise<Extracted> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const data = bytes.toString("base64");
  const source =
    mediaType === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({
          type: "image",
          source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data },
        } as const);

  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(ExtractedSchema) },
    messages: [{ role: "user", content: [source, { type: "text", text: INSTRUCTIONS }] }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The document could not be processed.");
  }
  if (!response.parsed_output) {
    throw new Error("Could not read structured data from the document. Try a clearer file.");
  }
  return response.parsed_output;
}
