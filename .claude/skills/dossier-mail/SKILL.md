---
name: dossier-mail
description: Mail round for a HomePlatform dossier - search Bart's Outlook Web in the built-in browser of Claude Desktop with the dossier's mail criteria and propose relevant mails to the dossier for review. Use when Bart asks for a mail round ("start a mail round for dossier X", "zoek mails voor dossier X") or pastes the instruction from the Dossiers site.
---
# Mail round for a dossier

Goal: find mails relevant to one dossier and put them on the dossier page as **proposals**. Bart accepts or
rejects them on the site (Dossiers → the dossier → "Proposed mails"). You never decide for him.

## Rules (always)
- **Read only in Outlook.** Never send, reply, forward, move, flag, delete, mark as read or change settings.
- **Summaries only, no originals** (agreement with Bart, NIPV policy): no copied mail text, no attachments,
  no personal names. Describe the sender as role or organisation ("projectleider hosting", "leverancier", "NIPV-directie").
- Nothing confidential in the summary (no figures from the confidential risk analysis, no HR matters).
- When in doubt whether a mail is relevant: propose it and say why you doubt; Bart decides.

## Steps
1. Load the built-in browser skill (`anthropic-skills:built-in-browser`) if not loaded yet.
2. `.\Dossier.ps1 -Get -Name <slug>` and read `dossier_work\<slug>.md`: the summary, the **mail criteria** and the
   open proposals. No criteria → ask Bart for them and store them with `.\Dossier.ps1 -SetCriteria -Name <slug> -Text "..."`.
3. Open Outlook Web (`https://outlook.office.com/mail/`) in the built-in browser. Bart is signed in himself; if
   not, ask him to sign in. Never type his password.
4. Search per criterion (search box; also the relevant folders and period from the criteria). Read the results as text.
5. For every candidate make a key: `.\Dossier.ps1 -MailRef -Subject "<subject>" -Date "<sent, ISO>" -From "<sender address>"`.
   Check all keys in one go: `.\Dossier.ps1 -CheckRefs -Name <slug> -Refs "ref1,ref2,..."`.
   Skip keys that are `added`, `proposed` or `rejected` (rejected = Bart said no before).
6. Show Bart a short list of the new candidates (subject, date, sender as role, one line why relevant) and ask
   which to propose. Bart may also say "all".
7. Per chosen mail: write a summary of 3-8 lines (what is decided/asked/announced, what it means for the dossier) to a
   temporary .md file, then:
   `.\Dossier.ps1 -AddMail -Name <slug> -Title "<subject>" -Date "<sent, ISO>" -Ref <key> -FilePath <summary.md> -Url "<outlook link to the mail>" -Reason "<why relevant>"`
   (without `-Direct`, so it lands as a proposal).
8. Close with a session note:
   `.\Dossier.ps1 -AddNote -Name <slug> -Kind session -Title "Mail round <date>" -Text "<criteria used, n found, n proposed>"`
   and tell Bart how many proposals wait for him on the dossier page.

## Environment
`-Env prod` is the default; use `-Env acc` for a trial round on acceptance. Without `.dossier.config.<env>.ps1`
the script reuses `.mindbox.config.<env>.ps1`; otherwise run `.\Dossier.ps1 -Setup -Env <env>` once.
