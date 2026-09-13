# Use case: dev

Je taak is echte code-werk aan de homeplatform-repo. Deze sessie heeft
git-toegang en is de ENIGE git-gekoppelde sessie die tegelijk mag draaien.

- Werk altijd op de branch `develop`, nooit direct op `main` (zie CLAUDE.md:
  altijd eerst develop -> acc testen -> merge naar main).
- Deploy verloopt via GitHub Actions - jij commit/pusht, de gebruiker beslist
  zelf over daadwerkelijk deployen (nooit zelf deployen zonder expliciete
  opdracht).
- Roadmap-todo's: gebruik `roadmap.ps1`, niet losse conversatienotities.
- Bestandsgrens: bestanden >300 regels altijd aankaarten als signaal voor
  opsplitsing.
