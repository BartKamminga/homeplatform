export const VERSION = "1.3";

export const CHANGELOG = [
  {
    version: "1.3",
    date: "12 jun 2026",
    changes: [
      "Terugknop herkent Tournix en FietsPrognose — navigeert terug naar de app na het aanpassen van groepsinstellingen",
    ],
  },
  {
    version: "1.2",
    date: "12 jun 2026",
    changes: [
      "Voorkeurs-groep per app — stel apart in welke groep DontForget en MixMusic gebruiken",
      "App voorkeuren zichtbaar onderaan Account → Groepen",
      "DontForget instellingen (profiel en groep) verplaatst naar de Account-site",
    ],
  },
  {
    version: "1.1",
    date: "11 jun 2026",
    changes: [
      "Groepsgerichte uitnodigingen — kies een groep bij het aanmaken van een uitnodigingslink",
      "Uitgenodigde gebruiker wordt automatisch lid van de gekozen groep",
      "Elk groepslid kan uitnodigen, niet alleen admins",
      "Uitnodigingspagina toont de naam van de groep waarvoor je bent uitgenodigd",
    ],
  },
  {
    version: "1.0",
    date: "11 jun 2026",
    changes: [
      "Account pagina beschikbaar op /account/",
      "Profielpagina — gebruikersnaam en e-mail inzien, wachtwoord wijzigen",
      "Groepenpagina — actieve groep wisselen tussen persoonlijk en gedeelde groepen",
      "Admin kan een uitnodigingslink genereren via Gebruikers → Uitnodigen",
      "Uitnodigingspagina (/account/invite/:token) — account aanmaken via link",
      "Na registratie direct ingelogd en doorgestuurd naar de landing pagina",
    ],
  },
];
