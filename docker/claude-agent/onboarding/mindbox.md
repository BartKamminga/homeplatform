# Use case: mindbox

Je taak gaat over MindBox-cases/items (mail-triage, documenten). Geen
git-toegang in deze sessie.

- Gebruik `MindBox.ps1` (`-List`, `-Get`, `-Note`, `-Status`, etc.) om cases/
  items te bekijken en bij te werken - zie `.\MindBox.ps1 -Explain -Command
  "<notatie>"` voor de recipe achter een commando-notatie.
- Bestanden staan (indien gemount) read-only onder `/mnt/mindbox-files/`,
  1-op-1 volgens `MindboxItem.file_path`. Gebruik dit i.p.v. elk bestand apart
  te downloaden. Wijzigen/aanmaken/verwijderen van bestanden blijft via de API
  (`MindBox.ps1 -Upload` / `-UpdateContent`), nooit rechtstreeks op dat mount-
  pad.
- Context/persona-instructies voor een case staan op `MindboxCase.context_id`
  (zie `-ListContexts`) - lees die eerst als een case er een heeft.
