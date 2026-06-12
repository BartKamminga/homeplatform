// frontend/sites/dontforget/src/changelog.jsx

export const VERSION = "1.4";

export const CHANGELOG = [
  {
    version: "1.4",
    date: "12 jun 2026",
    changes: [
      "Instellingen gesynchroniseerd — standaard moment, herhaling, foto verplicht en geschiedenis bewaren worden opgeslagen in je account",
      "Instellingen zijn nu zichtbaar op elk apparaat en elke browser",
    ],
  },
  {
    version: "1.3",
    date: "12 jun 2026",
    changes: [
      "Profiel en groepsinstellingen verplaatst naar de Account-site",
      "Instellingen toont directe link naar Account → Groepen & app-voorkeuren",
      "DontForget gebruikt nu de voorkeurs-groep die je instelt in Account",
    ],
  },
  {
    version: "1.2",
    date: "11 jun 2026",
    changes: [
      "Geluidsopname toevoegen aan een taak via de microfoon",
      "Opname starten en stoppen met een timer, direct terugluisteren",
      "Opname verwijderen of vervangen bij het bewerken van een taak",
      "Microfoon-indicator zichtbaar in het taakoverzicht",
    ],
  },
  {
    version: "1.1",
    date: "11 jun 2026",
    changes: [
      "Taken per groep — elke groep heeft een eigen takenlijst, persoonlijk blijft apart",
      "Groepswisselaar in Instellingen → Huishouden",
      "Ledenantal van de actieve groep zichtbaar in Leden",
      "Herhaaltaken verschijnen automatisch opnieuw na hun periode (dag/week/maand)",
    ],
  },
  {
    version: "1.0",
    date: "10 jun 2026",
    changes: [
      "Login scherm direct in de app — niet meer doorgestuurd naar admin",
      "Toegang instelbaar per groep via de admin omgeving",
      "Geen toegang scherm als je account niet is toegewezen aan DontForget",
    ],
  },
  {
    version: "0.9",
    date: "10 jun 2026",
    changes: [
      "Taken ophalen uit de database — echte data in plaats van voorbeelden",
      "Foto's als thumbnail in het overzicht en op de bewerkpagina",
      "Routines met herhaling: dagelijks, wekelijks (incl. dag keuze), maandelijks",
      "Wekelijkse routines tonen alleen op de ingestelde dag",
      "Taken voor morgen, deze week en deze maand apart zichtbaar",
      "Geschiedenis pagina met afgeronde taken gegroepeerd per dag",
      "Formulier verbeterd: herhaling bovenaan, contextuele opties per type",
      "Foto en omschrijving zij aan zij bovenaan het formulier",
      "Opslaan-icoon in de header van het formulier",
    ],
  },
  {
    version: "0.1.0",
    date: "5 jun 2026",
    changes: [
      "Eerste versie van DontForget",
      "Vandaag pagina — taken per moment (ochtend, middag, avond)",
      "Routines pagina — terugkerende taken beheren",
      "Geschiedenis pagina — wie heeft wat gedaan en wanneer",
      "Taak toevoegen met foto, moment, herhaling en prioriteit",
      "Taak bewerken en verwijderen",
      "Instellingen pagina — profiel, thema, taken en huishouden",
      "4 thema's: light, dark, minimal, retro",
    ],
  },
];
