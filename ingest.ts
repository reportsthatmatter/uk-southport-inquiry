import { cleanEdition, furnitureFaces, geometry, pipeline, sequencedNoteOpenings } from "@rtm/ingest";
import { readSouthportHtml } from "./govuk-html.ts";

/**
 * How this report is built. Owned by the report: every decision that shaped
 * its text is named here, and the passes it composes are library code.
 *
 * The text and structure come from the GOV.UK accessible HTML edition of
 * Volume 1 (reference/raw/, the `details.body` of its content-API record; see
 * govuk-html.ts for what its markup means). The PDF is the shadow ingest: the
 * Inquiry's born-digital, tagged InDesign PDF (HC 1768-I, version 2, 268 A4
 * pages, single column) gives the page anchors and the fidelity check. Page
 * citations below are PDF pages; printed folio = PDF page - 7 (PDF p.8 is folio 1;
 * pp.1-7, the cover, title, imprint and contents, carry none).
 *
 * Only the passes that moved a number are declared. Measured one at a time
 * (2026-10-25), layoutPageJoins, quoteListRunOns, layoutMarkers,
 * numberedParagraphs and hangingIndents left full.md byte-identical (the
 * edition supplies the paragraphs and their numbers), so they are not here.
 */
export default pipeline({
  id: "uk-southport-inquiry",
  title: "The Southport Inquiry: Phase 1 report, Volume 1",
  authors: "Sir Adrian Fulford (Chair)",
  published_at: "13 April 2026",
  source_url: "https://www.gov.uk/government/publications/the-southport-inquiry-phase-1-report",
  repo: ".",
  volumes: [
    // HC 1768-I, Volume 1 of 2: Foreword and Chapters 1-6. Version 2 (21 July 2026), the 13 April
    // original (SHA-256 91631b77…15afc, 267 pp.) plus a cover page; no word of the report differs.
    { path: "archive/southport-inquiry-phase-1-volume-1-hc1768-i-v2.pdf", sha256: "c27fdbfc7b76aca70cf72af17349da56ad3b46ab4faf391e83978ed361c87bcf" },
  ],
  passes: [
    cleanEdition({
      dir: import.meta.dirname,
      // Notes are printed at the page foot, numbered 1-641 through the volume: the shadow lifts them
      // out of the page text and the edition's footnote list is aligned to them.
      notes: "page-foot",
      files: [{ path: "reference/raw/volume-1-accessible.html", sha256: "f0e376903f0ad9d3b028066f37d235acf40e20b7c0eb221779768ba3b32f5b15" }],
      read: readSouthportHtml,
    }),
    // Every page but the first seven carries a running head in HelveticaNeueLTPro 15pt grey (#3c3c3b):
    // "The Southport Inquiry Report: Volume 1" and, below it, the chapter ("Chapter 1: Fundamental
    // problems", PDF p.20). Left in, it sits between the edition's words at every page turn (without
    // this pass: 98.91% of edition words aligned, against 99.02%, and 27 more unmatched stretches).
    // The notes at the foot are 15pt too but black (#000000), so the face test spares them.
    furnitureFaces(["HelveticaNeueLTPro|15|#3c3c3b"]),
    // The one stretch of the PDF that is served is the front matter the HTML lacks (the contents, and the
    // note on the two volumes, PDF p.7: four sentences hanging one tab in from a margin). Read against the
    // volume-wide margin they ran into one paragraph; measured per page they stay four.
    geometry("per-page"),
    // Notes at the page foot, "N  text" on one line, N running 1-641 through the volume ("40 T/S:
    // 10/107/17-134/13", PDF p.20, printed 13). Without this pass the shadow finds no notes and only
    // 95.98% of edition words align (the edition's footnote list has nothing to match).
    sequencedNoteOpenings(),
  ],
});
