import "server-only";
import type { SocialNetwork, SocialResult } from "@/db/schema-production";
import { IntegrationError, request } from "@/lib/integrations/http";

/**
 * Publishing to social networks through each network's own API, with the
 * firm's connected account. Each network has its own rules: Instagram and
 * TikTok need an image; X takes 280 characters; LinkedIn and Facebook take a
 * link. Captions are fitted per network before sending. The sandbox records
 * what would have been posted. Live publishing needs the firm's own approved
 * app or access tokens for each network.
 */

export const LIMITS: Record<SocialNetwork, { caption: number; needsMedia: boolean; label: string }> = {
  instagram: { caption: 2200, needsMedia: true, label: "Instagram" },
  facebook: { caption: 63_206, needsMedia: false, label: "Facebook" },
  linkedin: { caption: 3000, needsMedia: false, label: "LinkedIn" },
  x: { caption: 280, needsMedia: false, label: "X" },
  tiktok: { caption: 4000, needsMedia: true, label: "TikTok" },
};

/** Fits a caption to a network: X counts any link as 23 characters and keeps it at the end. */
export function fitCaption(network: SocialNetwork, caption: string, link: string | null) {
  const lim = LIMITS[network].caption;
  if (network === "x") {
    const room = 280 - (link ? 24 : 0);
    const body = caption.length > room ? `${caption.slice(0, room - 1).replace(/\s+\S*$/, "")}…` : caption;
    return link ? `${body} ${link}` : body;
  }
  const full = link && network !== "instagram" && network !== "tiktok" ? `${caption}\n\n${link}` : caption;
  return full.length > lim ? `${full.slice(0, lim - 1)}…` : full;
}

export function validatePost(networks: SocialNetwork[], caption: string, media: string[]) {
  const problems: string[] = [];
  for (const n of networks) if (LIMITS[n].needsMedia && !media.length) problems.push(`${LIMITS[n].label} needs at least one image.`);
  if (!caption.trim()) problems.push("Write a caption.");
  return problems;
}

export type SocialCreds = { accessToken?: string; pageId?: string; igUserId?: string; orgUrn?: string };

const ok = (url: string | null, ref: string | null): SocialResult => ({ status: "published", url, ref, error: null, at: new Date().toISOString() });

export async function publish(network: SocialNetwork, mode: "live" | "sandbox", creds: SocialCreds, post: { caption: string; link: string | null; media: string[] }, fetcher?: typeof fetch): Promise<SocialResult> {
  const text = fitCaption(network, post.caption, post.link);
  if (LIMITS[network].needsMedia && !post.media.length) return { status: "skipped", url: null, ref: null, error: `${LIMITS[network].label} needs an image.`, at: new Date().toISOString() };
  if (mode === "sandbox") return ok(null, `sandbox-${network}-${Date.now().toString(36)}`);
  const token = creds.accessToken;
  if (!token) return { status: "failed", url: null, ref: null, error: "No access token for this account.", at: new Date().toISOString() };
  try {
    switch (network) {
      case "facebook": {
        const base = `https://graph.facebook.com/v21.0/${creds.pageId}`;
        const r = post.media.length
          ? await request<{ id: string; post_id?: string }>("Facebook", `${base}/photos`, { method: "POST", form: { url: post.media[0]!, caption: text, access_token: token }, fetcher })
          : await request<{ id: string }>("Facebook", `${base}/feed`, { method: "POST", form: { message: text, ...(post.link ? { link: post.link } : {}), access_token: token }, fetcher });
        const id = (r as { post_id?: string }).post_id ?? r.id;
        return ok(`https://www.facebook.com/${id}`, id);
      }
      case "instagram": {
        const base = `https://graph.facebook.com/v21.0/${creds.igUserId}`;
        const c = await request<{ id: string }>("Instagram", `${base}/media`, { method: "POST", form: { image_url: post.media[0]!, caption: text, access_token: token }, fetcher });
        const p = await request<{ id: string }>("Instagram", `${base}/media_publish`, { method: "POST", form: { creation_id: c.id, access_token: token }, fetcher });
        return ok(null, p.id);
      }
      case "linkedin": {
        // LinkedIn answers 201 with an empty body; the post's URN is in the x-restli-id header.
        let urn: string | null = null;
        const capture: typeof fetch = async (u, i) => {
          const r = await (fetcher ?? fetch)(u, i);
          urn = r.headers.get("x-restli-id");
          return r;
        };
        await request("LinkedIn", "https://api.linkedin.com/rest/posts", {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "LinkedIn-Version": "202405", "X-Restli-Protocol-Version": "2.0.0" },
          body: { author: creds.orgUrn, commentary: text, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false },
          fetcher: capture,
        });
        return ok(urn ? `https://www.linkedin.com/feed/update/${urn}` : null, urn);
      }
      case "x": {
        const r = await request<{ data: { id: string } }>("X", "https://api.x.com/2/tweets", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: { text }, fetcher });
        return ok(`https://x.com/i/web/status/${r.data.id}`, r.data.id);
      }
      case "tiktok": {
        const r = await request<{ data: { publish_id: string } }>("TikTok", "https://open.tiktokapis.com/v2/post/publish/content/init/", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: { post_info: { title: text.slice(0, 90), description: text, privacy_level: "PUBLIC_TO_EVERYONE", disable_comment: false, auto_add_music: true }, source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: post.media.slice(0, 35) }, post_mode: "DIRECT_POST", media_type: "PHOTO" },
          fetcher,
        });
        return ok(null, r.data.publish_id);
      }
    }
  } catch (e) {
    return { status: "failed", url: null, ref: null, error: e instanceof IntegrationError ? e.message : (e as Error).message, at: new Date().toISOString() };
  }
}
