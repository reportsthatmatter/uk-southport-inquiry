/**
 * Reads the "accessible" HTML edition of a gov.uk inquiry report (the
 * `details.body` of its content-API record: govspeak rendered to HTML) into the
 * blocks the hybrid source mode serves (@rtm/ingest `cleanEdition`).
 *
 * Generic to gov.uk govspeak, so it can be lifted into @rtm/ingest
 * (reportsthatmatter-pbou). What the markup means:
 *
 * - `<h2>` is a part label ("Foreword", "Chapter 3"); when an `<h3>` follows
 *   straight away it is that part's title and the two are served as one
 *   heading, "Chapter 3: The victims and the impact of the attack", the way
 *   other UK inquiry reports title their chapters. `<h4>`, `<h5>`, `<h6>` are
 *   the levels below.
 * - A heading that is a figure or table title ("Figure 2: Internal plan") is a
 *   caption: a float paragraph, not a heading.
 * - A numbered paragraph is "<p>12.    text": the number stays at the head of
 *   the text, spaces collapsed ("12. text"); lettered items ("a.     text")
 *   likewise. A `<blockquote>` is a quotation, its paragraphs (which carry the
 *   quoted document's own numbers) joined into one block.
 * - `<sup id="fnref:N"><a class="footnote">` is note N; `<div class="footnotes">`
 *   at the end holds the list (`<li id="fn:N">`, with a "↩" back-link that is
 *   not text). A marker inside a heading cannot sit on the heading, so it moves
 *   to the end of the next paragraph (`headingNotes`).
 * - `<figure>` holds an image: nothing is served, the caption comes from the
 *   heading beside it. A `<table>` is data (`thead` is its header; a row's
 *   `<th scope="row">` is its first cell).
 * - `<div class="call-to-action">` is govspeak's call-out: before the first
 *   heading it is the title page and imprint; after, a boxed passage.
 *
 * Anything specific to one report is in `SOUTHPORT` at the foot, kept apart.
 */
import { htmlEvents, inlineMarkdown, inlineText, type Edition, type EditionBlock, type EditionNote, type HtmlEvent, type InlinePiece } from "@rtm/ingest";

export type GovukOptions = {
  /** Joins an h2 part label with the h3 title after it. */
  joinPartTitle: (label: string, title: string) => string | undefined;
  /** A heading that is really a caption (a figure or table title). */
  isCaption: (text: string) => boolean;
  /** Report-specific text fixes, applied to each served block's text before it is emitted. */
  fixText?: (text: string) => string;
  /** A heading the HTML merged that the PDF sets as several: its parts, or undefined. */
  splitHeading?: (text: string) => string[] | undefined;
};

const hasText = (pieces: InlinePiece[]) => pieces.some((p) => "text" in p && p.text.trim());
const plain = (pieces: InlinePiece[]) => inlineMarkdown(pieces.map((p) => ("marker" in p ? p : { text: p.text })));

export const PART_LABEL = /^(?:Chapter|Part|Appendix|Annex|Section)\b/i;
export const CAPTION = /^(?:Figure|Table|Map|Chart|Image|Photograph|Diagram|Box)\s+\d+\b/i;

/** The default govspeak options: "Chapter 1" + "Title" → "Chapter 1: Title". */
export const GOVUK_DEFAULTS: GovukOptions = {
  joinPartTitle: (label, title) => (PART_LABEL.test(label) ? `${label}: ${title}` : undefined),
  isCaption: (text) => CAPTION.test(text),
};

function nextContent(events: HtmlEvent[], at: number): HtmlEvent | undefined {
  for (let i = at + 1; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "text" && !e.text.trim()) continue;
    return e;
  }
  return undefined;
}

export function readGovukHtml(html: string, options: GovukOptions = GOVUK_DEFAULTS): Edition {
  const events = htmlEvents(html);
  const blocks: EditionBlock[] = [];
  const notes: EditionNote[] = [];
  const fix = options.fixText ?? ((t: string) => t);

  type Cur = { kind: "paragraph" | "item"; pieces: InlinePiece[] };
  let cur: Cur | null = null;
  let heading: { tag: string; pieces: InlinePiece[]; markers: string[] } | null = null;
  /** An h2 label waiting for its h3 title. */
  let pendingLabel: string | null = null;
  /** Markers lifted off headings, due at the end of the next paragraph. */
  let carried: string[] = [];
  let list: string[] | null = null;
  /** The last numbered paragraph's number in this part (restarts at each h2). */
  let lastNumber = 0;
  let inUl = false;
  let quote: string[] | null = null;
  let em = 0;
  let strong = 0;
  let sup: string | null = null;
  let skip = 0; // depth inside <figure>
  const divs: string[] = [];
  let seenHeading = false;
  let table: { rows: string[][]; header: boolean; row: InlinePiece[][] | null; cell: InlinePiece[] | null; inHead: boolean } | null = null;
  let note: { label: string; pieces: InlinePiece[] } | null = null;
  let backlink = 0;

  const emit = (block: EditionBlock) => {
    if ("text" in block && block.kind !== "heading") block.text = fix(block.text);
    blocks.push(block);
  };
  const closeList = () => {
    if (list?.length) emit({ kind: "list", items: list });
    list = null;
  };
  const flush = () => {
    const c = cur;
    cur = null;
    if (!c || !hasText(c.pieces)) return;
    if (c.kind === "item") {
      (list ??= []).push(fix(inlineMarkdown(c.pieces)));
      return;
    }
    const text0 = inlineMarkdown(c.pieces);
    const num = quote ? null : /^(\d+)\.\s/.exec(text0);
    if (num) {
      // "86. text" is the report's next numbered paragraph; a "1." that is not the next number is an
      // item inside one (the parts of an offence, a list of sections), kept as a list so that its
      // numbers are not taken for the report's own
      if (Number(num[1]) === lastNumber + 1) lastNumber++;
      else {
        (list ??= []).push(fix(text0));
        return;
      }
    }
    closeList();
    if (carried.length) {
      c.pieces.push(...carried.map((marker) => ({ marker })));
      carried = [];
    }
    const text = inlineMarkdown(c.pieces);
    if (quote) quote.push(text);
    else emit({ kind: "paragraph", text });
  };
  const add = (piece: InlinePiece) => {
    if (note) {
      if (backlink === 0) note.pieces.push(piece);
      return;
    }
    if (heading) {
      if ("marker" in piece) heading.markers.push(piece.marker);
      else heading.pieces.push(piece);
      return;
    }
    if (table) {
      table.cell?.push(piece);
      return;
    }
    if (!cur) {
      if ("text" in piece && !piece.text.trim()) return;
      cur = { kind: inUl ? "item" : "paragraph", pieces: [] };
    }
    cur.pieces.push(piece);
  };
  const emitHeading = (level: number, text: string, markers: string[]) => {
    carried.push(...markers);
    for (const part of options.splitHeading?.(text) ?? [text]) emit({ kind: "heading", level, text: part });
  };
  const closeHeading = () => {
    const h = heading!;
    heading = null;
    const text = plain(h.pieces);
    if (!text) return;
    seenHeading = true;
    if (h.tag === "h2") {
      lastNumber = 0;
      if (pendingLabel) emitHeading(2, pendingLabel, []);
      if (nextContent(events, i)?.kind === "start" && (nextContent(events, i) as { tag?: string }).tag === "h3") {
        pendingLabel = text;
        carried.push(...h.markers);
      } else {
        pendingLabel = null;
        emitHeading(2, text, h.markers);
      }
      return;
    }
    if (h.tag === "h3" && pendingLabel) {
      const label = pendingLabel;
      pendingLabel = null;
      emitHeading(2, options.joinPartTitle(label, text) ?? `${label}: ${text}`, h.markers);
      return;
    }
    if (options.isCaption(text)) {
      // a figure or table title: a caption, which the PDF sets where its page had room
      const pieces: InlinePiece[] = [{ text }, ...h.markers.map((marker) => ({ marker }))];
      emit({ kind: "paragraph", text: inlineMarkdown(pieces), float: true });
      return;
    }
    const level = { h3: 3, h4: 3, h5: 4, h6: 5 }[h.tag] ?? 3;
    emitHeading(level, text, h.markers);
  };

  let i = 0;
  for (; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "text") {
      if (skip) continue;
      if (sup !== null) continue; // the "[footnote N]" link text
      if (note) {
        if (backlink === 0) note.pieces.push({ text: e.text });
        continue;
      }
      add({ text: e.text, em: em > 0, strong: strong > 0 && !heading });
      continue;
    }
    const tag = e.tag;
    if (e.kind === "start") {
      if (skip) {
        if (tag === "figure") skip++;
        continue;
      }
      switch (tag) {
        case "figure":
          flush();
          skip = 1;
          break;
        case "div": {
          const cls = e.attrs.class ?? "";
          flush();
          divs.push(cls);
          // a call-out after the first heading is a boxed passage: one quotation, so the
          // numbered points inside it (1., 2.) are not taken for the report's own paragraphs
          if (cls === "call-to-action" && seenHeading) quote = [];
          break;
        }
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          flush();
          closeList();
          heading = { tag, pieces: [], markers: [] };
          break;
        case "p":
          if (note) {
            if (note.pieces.length) note.pieces.push({ text: " " });
          } else if (heading) add({ text: " " });
          else if (table) table.cell?.push({ text: " " });
          else {
            flush();
            cur = { kind: inUl ? "item" : "paragraph", pieces: [] };
          }
          break;
        case "blockquote":
          flush();
          quote = [];
          break;
        case "ul":
          flush();
          closeList();
          list = [];
          inUl = true;
          break;
        case "li":
          if (divs.includes("footnotes")) note = { label: /(\d+)$/.exec(e.attrs.id ?? "")?.[1] ?? "", pieces: [] };
          else {
            flush();
            cur = { kind: "item", pieces: [] };
          }
          break;
        case "br":
          add({ text: " " });
          break;
        case "strong":
        case "b":
          strong++;
          break;
        case "em":
        case "i":
          em++;
          break;
        case "sup":
          sup = /(\d+)$/.exec(e.attrs.id ?? "")?.[1] ?? "";
          break;
        case "a":
          if ((e.attrs.class ?? "").includes("reversefootnote")) backlink++;
          break;
        case "table":
          flush();
          table = { rows: [], header: false, row: null, cell: null, inHead: false };
          break;
        case "thead":
          if (table) table.inHead = true;
          break;
        case "tr":
          if (table) table.row = [];
          break;
        case "td":
        case "th":
          if (table) table.cell = [];
          break;
      }
      continue;
    }
    // end tags
    if (skip) {
      if (tag === "figure") skip--;
      continue;
    }
    switch (tag) {
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        if (heading) closeHeading();
        break;
      case "p":
        if (!note && !heading && !table) flush();
        break;
      case "li":
        if (note) {
          notes.push({ label: note.label, text: inlineText(note.pieces).replace(/\s+/g, " ").trim() });
          note = null;
        } else flush();
        break;
      case "ul":
        flush();
        closeList();
        inUl = false;
        break;
      case "blockquote":
        flush();
        if (quote?.length) emit({ kind: "quote", text: quote.join("\n\n") });
        quote = null;
        break;
      case "strong":
      case "b":
        strong = Math.max(0, strong - 1);
        break;
      case "em":
      case "i":
        em = Math.max(0, em - 1);
        break;
      case "sup":
        if (sup) add({ marker: sup });
        sup = null;
        break;
      case "a":
        if (backlink) backlink--;
        break;
      case "td":
      case "th":
        if (table?.row && table.cell) {
          table.row.push(table.cell);
          table.cell = null;
        }
        break;
      case "tr":
        if (table?.row) {
          table.rows.push(table.row.map((cell) => inlineMarkdown(cell)));
          if (table.inHead) table.header = true;
          table.row = null;
        }
        break;
      case "thead":
        if (table) table.inHead = false;
        break;
      case "table":
        if (table) {
          emit({ kind: "table", rows: table.rows, header: table.header });
          table = null;
        }
        break;
      case "div": {
        flush();
        const cls = divs.pop();
        if (cls === "call-to-action" && quote) {
          if (quote.length) emit({ kind: "quote", text: quote.join("\n\n") });
          quote = null;
        }
        break;
      }
    }
  }
  flush();
  closeList();
  return { blocks, notes };
}

// — Southport Inquiry only —

/**
 * The Southport Inquiry's Phase 1 report, Volume 1 (HC 1768-I). Everything
 * here is about this report and not about gov.uk's HTML.
 */
export const SOUTHPORT: GovukOptions = {
  ...GOVUK_DEFAULTS,
  // Chapter 3 gives Child J and Child S one paragraph under two stacked headings (PDF p.99, folio 92,
  // and the contents list both); the HTML ran them into one "Child J Child S".
  splitHeading: (text) => (text === "Child J Child S" ? ["Child J", "Child S"] : undefined),
};

/** The report's own reader, for `cleanEdition({ read })`. */
export function readSouthportHtml(files: Array<{ path: string; text: string }>): Edition {
  const html = files.filter((f) => f.path.endsWith(".html"));
  const tags = files.find((f) => f.path.endsWith("blocks.jsonl"));
  const edition = readGovukHtml(html.map((f) => f.text).join("\n"), SOUTHPORT);
  if (tags) joinByTags(edition.blocks, tags.text);
  joinSplitParagraphs(edition.blocks);
  // The PDF's contents (pp.4-7) and its note on the two volumes (p.7) sit between the imprint and the
  // Foreword; the HTML has neither. The PDF's own blocks fill the gap (cleanEdition fillGaps).
  const first = edition.blocks.findIndex((b) => b.kind === "heading");
  edition.blocks.splice(first, 0, { kind: "gap", reason: "contents and the note on the two volumes (PDF pp.4-7), which the HTML edition does not carry" });
  return edition;
}

/**
 * Ten sentences the HTML edition breaks across two `<p>`s (each at a line or page turn of the PDF,
 * where the PDF runs on in one paragraph). Named by the opening words of the second half, with the
 * PDF page; each must be found exactly once, or the build fails.
 */
export const SOUTHPORT_SPLITS: ReadonlyArray<readonly [string, number]> = [
  ["(and, on occasion, unlawful) online activity", 20],
  ["AR would not have been at liberty", 24],
  ["not have been visible to users", 121],
  ["\u201cI owe everything to Heidi", 128],
  ["Mr Jonathan Cape,", 129],
  ["violent outburst. The WhatsApp messages", 186],
  ["1.4 kilograms or more.", 190],
  ["a \u2018Anglo Arms Kukri machete\u2019", 203],
  ["/ OWA 2019 market.", 230],
  ["It is manifestly unsuitable for viewing by children.", 260],
];

/** Rejoins each `SOUTHPORT_SPLITS` paragraph to the one before it. */
export function joinSplitParagraphs(blocks: EditionBlock[], splits = SOUTHPORT_SPLITS): void {
  for (const [opening, page] of splits) {
    const at = blocks.flatMap((b, i) => (b.kind === "paragraph" && b.text.startsWith(opening) ? [i] : []));
    if (at.length === 0 && blocks.some((b) => b.kind === "paragraph" && b.text.includes(` ${opening}`))) continue; // already rejoined by joinByTags
    if (at.length !== 1) throw new Error(`govuk-html: split at PDF p.${page} ("${opening}") found ${at.length} times`);
    const i = at[0];
    const prev = blocks[i - 1];
    if (prev?.kind !== "paragraph") throw new Error(`govuk-html: split at PDF p.${page}: the block before is not a paragraph`);
    blocks.splice(i - 1, 2, { ...prev, text: `${prev.text} ${(blocks[i] as typeof prev).text}` });
  }
}

const tagNorm = (s: string) =>
  s
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/[\\*_]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** A paragraph that opens with the report's own number or a list label ("12.", "b.", "iv.") starts a block. */
const LABELLED = /^(?:\d+\.|[a-z]\.|[ivx]+\.)\s/;

/**
 * The HTML edition breaks a paragraph wherever the PDF has a forced line break inside it (PDF p.186,
 * para 32 of Chapter 5: "…manufacture ricin. / He also ordered ‘Food Storage Containers’", one
 * paragraph on the page, two `<p>`s in the HTML), about a hundred times in the volume. The tagged PDF
 * is the authority on paragraphs: its structure tree (reference/blocks.jsonl, built from the PDF's tags
 * by the site's scripts/score/reference.py, pinned in ingest.ts) has each as one P or LI element. Two
 * consecutive edition paragraphs are joined when one tagged paragraph runs from the end of the first
 * straight into the start of the second, and the second opens with no number or list label.
 */
export function joinByTags(blocks: EditionBlock[], jsonl: string): number {
  const tagged = jsonl
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as { type: string; text: string })
    .filter((r) => r.type === "paragraph" || r.type === "quote" || r.type === "list")
    .map((r) => tagNorm(r.text))
    .join("\n");
  let joined = 0;
  for (let i = blocks.length - 1; i > 0; i--) {
    const a = blocks[i - 1];
    const b = blocks[i];
    if (a.kind !== "paragraph" || b.kind !== "paragraph" || a.float || b.float) continue;
    if (LABELLED.test(b.text)) continue;
    const tail = tagNorm(a.text).slice(-40);
    const head = tagNorm(b.text).slice(0, 40);
    if (tail.length < 20 || head.length < 10 || !tagged.includes(`${tail} ${head}`)) continue;
    blocks.splice(i - 1, 2, { ...a, text: `${a.text} ${b.text}` });
    joined++;
  }
  return joined;
}
