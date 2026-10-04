import type { WebsiteTheme } from "@/db/schema-production";

/** Five site themes. Each is a set of CSS variables applied to the public site only; the firm's brand colours fill the accents. */
export type ThemeDef = { key: WebsiteTheme; name: string; description: string; vars: Record<string, string>; display: "serif" | "sans"; radius: number };

export const THEMES: Record<WebsiteTheme, ThemeDef> = {
  modern: { key: "modern", name: "Modern", description: "Clean sans-serif, generous white space, rounded photographs.", display: "sans", radius: 10, vars: { "--site-bg": "#FAFAF9", "--site-surface": "#FFFFFF", "--site-ink": "#0A0A0A", "--site-muted": "#6B7280", "--site-line": "#E5E7EB", "--site-hero-ink": "#FFFFFF" } },
  classic: { key: "classic", name: "Classic", description: "Serif headlines, cream paper, framed photographs.", display: "serif", radius: 2, vars: { "--site-bg": "#F8F5EE", "--site-surface": "#FFFDF8", "--site-ink": "#1F1B16", "--site-muted": "#6F665A", "--site-line": "#E4DCCD", "--site-hero-ink": "#FFFDF8" } },
  luxury: { key: "luxury", name: "Luxury", description: "Dark ground, serif display type and gold detail for prime stock.", display: "serif", radius: 0, vars: { "--site-bg": "#0B0D12", "--site-surface": "#13161D", "--site-ink": "#F3EFE6", "--site-muted": "#A39E93", "--site-line": "#262A33", "--site-hero-ink": "#F3EFE6" } },
  minimal: { key: "minimal", name: "Minimal", description: "Black on white, no ornament; the listings carry the page.", display: "sans", radius: 0, vars: { "--site-bg": "#FFFFFF", "--site-surface": "#FFFFFF", "--site-ink": "#111111", "--site-muted": "#777777", "--site-line": "#EAEAEA", "--site-hero-ink": "#FFFFFF" } },
  bold: { key: "bold", name: "Bold", description: "Large type, strong brand colour blocks, high contrast.", display: "sans", radius: 16, vars: { "--site-bg": "#F2F4F8", "--site-surface": "#FFFFFF", "--site-ink": "#0B1220", "--site-muted": "#4B5563", "--site-line": "#D9DEE7", "--site-hero-ink": "#FFFFFF" } },
};

export function themeStyle(theme: WebsiteTheme, brand: { primary: string; accent: string }): Record<string, string> {
  const t = THEMES[theme] ?? THEMES.modern;
  return { ...t.vars, "--site-primary": brand.primary, "--site-accent": brand.accent, "--site-radius": `${t.radius}px`, "--site-display": t.display === "serif" ? "var(--font-display), Georgia, serif" : "var(--font-sans), system-ui, sans-serif" };
}
