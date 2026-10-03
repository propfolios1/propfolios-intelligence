import { Mark, mergeAttributes } from "@tiptap/core";

/** Citation mark: a superscript reference to the research dossier, set in mono gold. */
export const Citation = Mark.create({
  name: "citation",
  inclusive: false,
  addAttributes() {
    return { id: { default: null, parseHTML: (el) => el.getAttribute("data-cite"), renderHTML: (a) => ({ "data-cite": a.id }) } };
  },
  parseHTML() {
    return [{ tag: "sup[data-cite]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes, { class: "memo-cite" }), 0];
  },
});

/** Turns "[3]" references in agent-written HTML into citation marks. Idempotent. */
export function markCitations(html: string) {
  return html.replace(/(?<!data-cite=")\[(\d{1,2})\]/g, (_m, n) => `<sup data-cite="${n}">${n}</sup>`);
}
