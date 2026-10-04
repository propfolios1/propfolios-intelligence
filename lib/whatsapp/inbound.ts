import type { Inbound } from "./service";

/** Twilio inbound and status callbacks (application/x-www-form-urlencoded). */
export function parseTwilio(p: Record<string, string>): { inbound: Inbound | null; status: { id: string; status: "sent" | "delivered" | "read" | "failed"; error: string | null } | null } {
  if (p.MessageStatus && !p.Body && !p.NumMedia) {
    const st = p.MessageStatus;
    const status = st === "read" ? "read" : st === "delivered" ? "delivered" : st === "failed" || st === "undelivered" ? "failed" : "sent";
    return { inbound: null, status: { id: p.MessageSid ?? p.SmsSid ?? "", status, error: p.ErrorCode ? `Twilio error ${p.ErrorCode}` : null } };
  }
  const media = Number(p.NumMedia ?? 0) > 0;
  const mime = p.MediaContentType0 ?? null;
  const type: Inbound["type"] = !media ? (p.Latitude ? "location" : "text") : mime?.startsWith("image/") ? "image" : mime?.startsWith("audio/") ? "audio" : mime?.startsWith("video/") ? "video" : "document";
  return {
    inbound: { from: (p.From ?? "").replace(/^whatsapp:/, ""), name: p.ProfileName ?? null, type, text: type === "location" ? `Location ${p.Latitude}, ${p.Longitude}` : (p.Body ?? null), caption: media ? (p.Body ?? null) : null, mediaRef: media ? (p.MediaUrl0 ?? null) : null, mime, providerMessageId: p.MessageSid ?? p.SmsMessageSid ?? "" },
    status: null,
  };
}

type CloudMessage = { from: string; id: string; timestamp?: string; type: string; text?: { body: string }; image?: { id: string; mime_type?: string; caption?: string }; document?: { id: string; mime_type?: string; filename?: string; caption?: string }; audio?: { id: string; mime_type?: string }; video?: { id: string; mime_type?: string; caption?: string }; location?: { latitude: number; longitude: number }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }; button?: { text: string } };
type CloudPayload = { entry?: { changes?: { value?: { contacts?: { profile?: { name?: string }; wa_id?: string }[]; messages?: CloudMessage[]; statuses?: { id: string; status: string; timestamp?: string; errors?: { title?: string }[] }[] } }[] }[] };

/** The WhatsApp Cloud API webhook format, as relayed by 360dialog. */
export function parseCloud(body: CloudPayload) {
  const inbound: Inbound[] = [];
  const statuses: { id: string; status: "sent" | "delivered" | "read" | "failed"; at: Date; error: string | null }[] = [];
  for (const e of body.entry ?? [])
    for (const ch of e.changes ?? []) {
      const v = ch.value ?? {};
      const names = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));
      for (const m of v.messages ?? []) {
        const media = m.image ?? m.document ?? m.audio ?? m.video;
        const type = (["text", "image", "document", "audio", "video", "location", "interactive"].includes(m.type) ? m.type : m.type === "button" ? "interactive" : "text") as Inbound["type"];
        inbound.push({
          from: m.from,
          name: names.get(m.from) ?? null,
          type,
          text: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? (m.location ? `Location ${m.location.latitude}, ${m.location.longitude}` : null),
          caption: (media as { caption?: string } | undefined)?.caption ?? null,
          filename: m.document?.filename ?? null,
          mediaRef: media?.id ?? null,
          mime: media?.mime_type ?? null,
          providerMessageId: m.id,
          at: m.timestamp ? new Date(Number(m.timestamp) * 1000) : undefined,
        });
      }
      for (const st of v.statuses ?? []) {
        const status = st.status === "read" ? "read" : st.status === "delivered" ? "delivered" : st.status === "failed" ? "failed" : "sent";
        statuses.push({ id: st.id, status, at: st.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date(), error: st.errors?.[0]?.title ?? null });
      }
    }
  return { inbound, statuses };
}
