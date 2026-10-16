---
name: dossier-session
description: Work session on a HomePlatform dossier together with Bart - load everything in the dossier, think and write with him, and save the results (HTML pages, ideas, summary, session note) straight into the dossier so they are visible on the Dossiers site. Use when Bart says "verder met dossier X", "laten we aan dossier X werken", "open dossier X" or wants to shape a dossier further.
---
# Working session on a dossier

Goal: Bart and Claude shape a dossier together. Everything that comes out of the session lands in the dossier and is
easy to see on the Dossiers site (Pages open full screen, ideas and the current state at the top).

## Start
1. `.\Dossier.ps1 -Get -Name <slug>` (add `-Env acc` on acceptance) and read `dossier_work\<slug>.md`:
   where things stand, pages, ideas, mails, notes and the last session notes.
2. Give Bart a short status in 3-5 lines (where it stands, what changed since the last session, what is open) and ask
   what he wants to work on, unless he already said.

## During the session
- Answer and think along as usual; when something is worth keeping, save it right away instead of at the end:
  - **An idea** → `.\Dossier.ps1 -AddNote -Name <slug> -Kind idea -Title "<short>" -Text "<one or two lines>"`
  - **A worked-out result** (timeline, comparison, map, plan, memo, talking points) → make a self-contained HTML page
    (inline CSS/JS, `<title>` = the page name, readable in light and dark, works at phone width) and save it with
    `.\Dossier.ps1 -AddPage -Name <slug> -FilePath <page.html>`. A page with the same `<title>` is replaced by the new
    version, so keep the title stable when you update a page.
  - **A source or link** → `-AddNote -Kind link -Title "..." -Url "..." -Text "why it matters"`
  - **A document Bart gives** → `-Upload -Name <slug> -FilePath <file>`
- Tell Bart in one line what you saved ("Saved as page 'LCMS Koers' in the dossier").
- Keep the agreement: no confidential originals (no internal NIPV documents, no figures from the confidential risk
  analysis, no names), only own analyses, summaries and public sources.

## End
1. Update where things stand when the picture changed: write the new text to a .md file and
   `.\Dossier.ps1 -SetSummary -Name <slug> -FilePath <summary.md>`.
2. Session note: `.\Dossier.ps1 -AddNote -Name <slug> -Kind session -Title "Session <date>" -Text "<what we did, what we decided, what is open>"`.
3. Tell Bart where to look: the dossier page on the Dossiers site.
