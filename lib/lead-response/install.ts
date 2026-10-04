import "server-only";
import { onInbound } from "@/lib/whatsapp/service";
import { respond } from "./service";

/**
 * Connects the assistant to WhatsApp: imported for its side effect by every
 * route that receives inbound WhatsApp messages. While a conversation is in
 * assistant mode the assistant replies; once an agent takes over it only
 * records the lead's messages.
 */
const hook: Parameters<typeof onInbound>[0] = async (db, { account, conversation, message }) => {
  if (!conversation.leadId) return false;
  const text = message.content.text ?? message.content.caption ?? "";
  if (!text && message.type !== "text") return false;
  const r = await respond(db, { tenantId: account.tenantId, leadId: conversation.leadId, channel: "whatsapp", text, externalRef: conversation.id, receivedAt: message.createdAt });
  return r.skipped === null || r.skipped === "with_agent";
};

onInbound(hook);

export const leadResponseInstalled = true;
