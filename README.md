# The Southport Inquiry: Phase 1 report, Volume 1

HC 1768, presented to Parliament on 13 April 2026 under section 26 of the Inquiries Act 2005, by the Chair of the Southport Inquiry, Sir Adrian Fulford. The Inquiry examines the murder of three children and the injury of others at a dance and yoga class in Southport on 29 July 2024, and the agencies' handling of the risk the perpetrator posed. Phase 1 is the report on the facts of the attack and the events leading to it, in two volumes (268 and 510 PDF pages).

This is the report of an inquiry into the murder of children, and the report anonymises child survivors under a Restriction Order. Nothing here adds to what it prints.

## Scope

Volume 1 (HC 1768-I) only, so far, as the report id `uk-southport-inquiry`: the Chair's Foreword and Chapters 1 to 6 (fundamental problems, the overview chronology, the victims and the impact of the attack, the attack, weapons and poisons, online harms). 268 PDF pages. Volume 2 (HC 1768-II, 510 pages, Chapters 7 onwards, the roles of the agencies) is the next unit of this same id, to be added as a second volume in `ingest.ts`. Phase 2 will be a separate report.

## Source

`archive/southport-inquiry-phase-1-volume-1-hc1768-i-v2.pdf`: Volume 1, version 2, as published on GOV.UK (https://www.gov.uk/government/publications/the-southport-inquiry-phase-1-report) and by the Inquiry. Crown copyright 2026, licensed under the Open Government Licence v3.0 (stated on the imprint, PDF p.3). See `datapackage.json`.

## Materials

Checked 2026-10-25 (stage 1 of the preparation pipeline, reportsthatmatter-gqsy.15).

| Need | Source | Role |
| --- | --- | --- |
| Words | GOV.UK accessible HTML edition of Volume 1, `reference/raw/volume-1-accessible.html` (the `details.body` of the content-API record, SHA-256 `f0e37690…5b15`) | served text (`cleanEdition`) |
| Blocks and headings | The same HTML (h2 to h6); the PDF is tagged and its tags are the answer key | served |
| Paragraph numbers | The HTML ("1.    text"); the PDF has them too | HTML; PDF cross-check |
| Notes | The HTML's footnote list (641); the PDF's page-foot notes (641 tagged) | HTML; PDF is the check |
| Page anchors | The PDF's printed folios: printed = PDF page − 7 (PDF p.8 is folio 1) | shadow ingest |
| Citation target | The v2 PDF, SHA-256 `c27fdbfc…c87bcf` | canonical |
| Rejected | The 13 April 2026 original (`…/media/69dccdbdd3e08b8871b66618/31.236_HO_Southport_Inquiry_Volume1_WEB.pdf`, 6,218,195 bytes, SHA-256 `91631b7729b69e42ddbda16d02323269ae3225e28a8252576b15b8decae15afc`, 267 pages; now redirects to v2; Wayback capture 20260413145426) | superseded by v2, which adds a cover page and changes no word of the report |

Sourcing checklist:

1. How the PDF was made: Adobe InDesign 21.1 (Macintosh), Adobe PDF Library 18.0, created 8 April 2026, modified 21 July 2026. Born-digital; A4, single column. Tagged (P 1,752, LI 914, Reference 723, Note 641, TD 603, TH 153). Folios at the page foot, arabic only.
2. Other renditions: the original (rejected above); the Inquiry's own copy of v2 (byte-identical). No large-print or easy-read edition is listed.
3. Official HTML: yes, GOV.UK's "accessible" version (added 15 May 2026), fetched from the content API on 25 October 2026; both the raw JSON and the extracted body are kept.
4. EPUB: none. 5. Wikisource: not checked. 6. Court documents: not applicable (the criminal sentencing remarks are a separate document). 7. US congressional: not applicable.
8. Originals: the Inquiry (info@southport.public-inquiry.uk, printed on the imprint).

Layout notes: running head "The Southport Inquiry Report: Volume 1" with the chapter below it; folio centred at the foot; numbered paragraphs with a hanging indent; notes at the foot, number and text on one line, numbered 1 to 641 through the volume; the chronology (Chapter 2) is one table of 201 rows over pp.22 to 73.

## Build

`ingest.ts` declares how the report is turned into Markdown; `govuk-html.ts` reads the GOV.UK HTML edition (generic to GOV.UK govspeak, with the few Southport-only rules at its foot). Rebuild from the site repo with `pnpm ingest run uk-southport-inquiry`. `fidelity.md` lists every stretch where the HTML and the PDF disagree. `PROCESSING.md` says how the text was made and where it falls short.

## Licence

Text of the report: Crown copyright 2026, Open Government Licence v3.0. Our markup, processing and editorial additions: CC BY 4.0. Code: MIT. Evidence, caveats and the full statement are in [LICENSE](LICENSE); the MIT text is in [LICENSE-MIT](LICENSE-MIT).
