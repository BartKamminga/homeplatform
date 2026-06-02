# Mix Music 🎵

Een zelfgehoste muziekspeler die draait als Docker container op je Synology NAS.
Geeft je een nette webinterface met 4 thema's om je muziekmappen af te spelen,
direct vanuit de NAS — zonder omwegen via SMB of gedeelde schijven.

---

## Inhoudsopgave

1. [Wat heb je nodig?](#1-wat-heb-je-nodig)
2. [Hoe werkt het?](#2-hoe-werkt-het)
3. [Bestanden op de NAS zetten](#3-bestanden-op-de-nas-zetten)
4. [Je muziekpad opzoeken](#4-je-muziekpad-opzoeken)
5. [docker-compose.yml aanpassen](#5-docker-composeyml-aanpassen)
6. [SSH inschakelen op Synology](#6-ssh-inschakelen-op-synology)
7. [Container bouwen en starten via SSH](#7-container-bouwen-en-starten-via-ssh)
8. [Container bouwen via Container Manager UI](#8-container-bouwen-via-container-manager-ui)
9. [Openen in de browser](#9-openen-in-de-browser)
10. [Poort wijzigen](#10-poort-wijzigen)
11. [Externe toegang (optioneel)](#11-externe-toegang-optioneel)
12. [Container bijwerken](#12-container-bijwerken)
13. [Problemen oplossen](#13-problemen-oplossen)
14. [Toetsenbordkoppelingen](#14-toetsenbordkoppelingen)
15. [Ondersteunde bestandsformaten](#15-ondersteunde-bestandsformaten)

---

## 1. Wat heb je nodig?

| Vereiste | Details |
|---|---|
| Synology NAS | DSM 7.0 of hoger |
| Container Manager | Gratis te installeren via Package Center |
| SSH-toegang | Voor bouwen via terminal (aanbevolen) |
| Je muziekmap | Een bestaande map op de NAS met MP3/WAV-bestanden |

> **Heb je Container Manager nog niet?**
> Open DSM → Package Center → zoek op "Container Manager" → Installeren.
> Op oudere DSM-versies heet dit pakket "Docker".

---

## 2. Hoe werkt het?

```
┌─────────────────────────────────────────────────────┐
│  Synology NAS                                       │
│                                                     │
│  /volume1/muziek/          ← jouw muziekbestanden   │
│         │                                           │
│         │ (read-only mount)                         │
│         ▼                                           │
│  Docker container: mixmusic                         │
│  └── Flask webserver (poort 8765)                   │
│         │                                           │
│         │ HTTP                                      │
└─────────┼───────────────────────────────────────────┘
          │
          ▼
  Browser op PC/telefoon
  http://192.168.1.x:8765
```

De container heeft alleen **leesrechten** op je muziekmap (`:ro` = read-only).
Hij kan dus nooit per ongeluk bestanden wijzigen of verwijderen.

---

## 3. Bestanden op de NAS zetten

### Via File Station (geen SSH nodig)

1. Open **File Station** in DSM.
2. Navigeer naar de map `docker` (die bestaat als Container Manager is geïnstalleerd).
   Als de map niet bestaat: maak hem aan via Nieuw → Map maken → noem hem `docker`.
3. Maak binnen `docker` een nieuwe map aan: **mixmusic**
4. Open de map `mixmusic` en upload daar de volgende bestanden uit de ZIP:
   - `Dockerfile`
   - `docker-compose.yml`
   - `server.py`
5. Maak binnen `mixmusic` een map aan genaamd **static**
6. Open de map `static` en upload daar:
   - `index.html`

Het resultaat in File Station:
```
docker/
└── mixmusic/
    ├── Dockerfile
    ├── docker-compose.yml
    ├── server.py
    └── static/
        └── index.html
```

### Via SSH (als je al toegang hebt)

```bash
# Maak de mappenstructuur aan
mkdir -p /volume1/docker/mixmusic/static

# Kopieer bestanden (vanuit de unzipped map op je PC via scp)
scp -r mixmusic/* admin@192.168.1.x:/volume1/docker/mixmusic/
```

---

## 4. Je muziekpad opzoeken

Je hebt het exacte pad van je muziekmap nodig. Zo vind je het:

### Via File Station

1. Navigeer naar je muziekmap in File Station.
2. Klik op de map (niet openen, maar selecteren).
3. Klik rechtsboven op het **ⓘ informatie-icoon** of klik rechtermuisknop → Eigenschappen.
4. Je ziet het pad staan, bijv. `/volume1/muziek/mixes`.

### Via SSH

```bash
# Bekijk welke volumes beschikbaar zijn
ls /volume1/

# Of zoek naar mappen met muziekbestanden
find /volume1 -name "*.mp3" -maxdepth 4 | head -5
```

Noteer het pad. Dat heb je nodig in de volgende stap.

---

## 5. docker-compose.yml aanpassen

Open het bestand `docker-compose.yml` in een teksteditor (Kladblok werkt, maar
gebruik liever Notepad++ of VS Code om opmaakfouten te voorkomen).

Zoek deze regel:
```yaml
      - /volume1/muziek:/music:ro
```

Verander `/volume1/muziek` naar het pad dat je in stap 4 hebt gevonden.

**Voorbeelden:**

| Jouw muziekmap op de NAS | Wat je invult in docker-compose.yml |
|---|---|
| `/volume1/muziek` | `- /volume1/muziek:/music:ro` |
| `/volume1/muziek/mixes` | `- /volume1/muziek/mixes:/music:ro` |
| `/volume2/audio` | `- /volume2/audio:/music:ro` |
| `/volume1/Mijn muziek` | `- "/volume1/Mijn muziek:/music:ro"` *(aanhalingstekens bij spaties!)* |

> **Let op:** Het gedeelte achter de `:` (`:music:ro`) mag je **niet** aanpassen.
> Dat is het pad binnen de container en de `:ro` staat voor read-only.

Sla het bestand op en upload het opnieuw naar de NAS als je het lokaal hebt bewerkt.

---

## 6. SSH inschakelen op Synology

Om de container via de terminal te bouwen heb je SSH nodig.

1. Open **DSM** in je browser.
2. Ga naar **Configuratiescherm** → **Terminal & SNMP**.
3. Zet het vinkje aan bij **SSH-service inschakelen**.
4. Laat poort 22 staan (of kies een andere poort als je dat wilt).
5. Klik op **Toepassen**.

**Verbinding maken vanaf Windows:**
- Open **PowerShell** of **Windows Terminal** en typ:
  ```
  ssh admin@192.168.1.x
  ```
  Vervang `192.168.1.x` door het IP-adres van je NAS.
  Je vindt het IP in DSM → Configuratiescherm → Netwerk, of in je router.

**Verbinding maken vanaf Mac/Linux:**
- Open **Terminal** en typ hetzelfde commando:
  ```
  ssh admin@192.168.1.x
  ```

Typ je wachtwoord als ernaar gevraagd wordt. Bij de eerste verbinding vraagt SSH
of je de host wilt vertrouwen — typ `yes` en druk op Enter.

---

## 7. Container bouwen en starten via SSH

Dit is de aanbevolen methode. Zodra je verbonden bent via SSH:

```bash
# Ga naar de projectmap
cd /volume1/docker/mixmusic

# Controleer of alle bestanden er staan
ls -la
# Je zou moeten zien: Dockerfile  docker-compose.yml  server.py  static/

# Bouw de Docker image en start de container
sudo docker-compose up -d --build
```

Wat er nu gebeurt:
- Docker downloadt de basisimage (Python 3.12 Alpine, ~50 MB) — dit duurt even bij de eerste keer.
- De image wordt gebouwd met jouw bestanden erin.
- De container start op de achtergrond (`-d` = detached).

Verwachte output:
```
Building mixmusic
Step 1/7 : FROM python:3.12-alpine
...
Successfully built abc123def456
Successfully tagged mixmusic_mixmusic:latest
Creating mixmusic ... done
```

**Controleer of de container draait:**
```bash
sudo docker ps
```

Je zou een regel moeten zien met `mixmusic` en de status `Up X seconds`.

**Bekijk de logs als er iets mis gaat:**
```bash
sudo docker-compose logs mixmusic
```

---

## 8. Container bouwen via Container Manager UI

Liever geen SSH? Dit kan ook via de DSM-interface.

1. Open **Container Manager** in DSM.
2. Klik in het linkermenu op **Project**.
3. Klik op **Maken**.
4. Geef het project een naam: `mixmusic`
5. Kies bij "Pad" de map `/volume1/docker/mixmusic` (via de bladermapknop).
6. Container Manager detecteert automatisch het `docker-compose.yml` bestand.
7. Klik op **Volgende** → controleer de instellingen → klik op **Gereed**.
8. De container wordt gebouwd en gestart. Dit zie je in de voortgangsbalk.

> **Let op:** Als je de `docker-compose.yml` hebt gewijzigd nadat de container
> al draaide, moet je het project stoppen en opnieuw bouwen:
> Container Manager → Project → `mixmusic` → Actie → Opnieuw bouwen.

---

## 9. Openen in de browser

Zodra de container draait, open je een browser op je PC, telefoon of tablet en ga je naar:

```
http://<ip-van-nas>:8765
```

**Voorbeeld:** `http://192.168.1.100:8765`

Weet je het IP-adres van je NAS niet?
- Kijk in DSM rechtsbovenin — het staat vermeld naast de hostnaam.
- Of open je router-beheerinterface en zoek naar het apparaat "Synology" of de naam van je NAS.

De pagina laadt direct met je muziekcollectie in de zijbalk.
Als de zijbalk leeg is, zie je een foutmelding met aanwijzingen — controleer dan stap 5 opnieuw.

---

## 10. Poort wijzigen

Standaard gebruikt Mix Music poort **8765**. Als die poort al in gebruik is op je NAS
(door een andere applicatie), kun je dit aanpassen in `docker-compose.yml`:

```yaml
ports:
  - "9000:8765"   # ← verander 8765 (links) naar de gewenste poort
```

Alleen het **linker** getal (voor de `:`) aanpassen. Het rechter getal is de poort
binnen de container en moet op 8765 blijven.

Na wijziging: herstart de container (zie stap 12).

Dan bereikbaar via `http://<ip>:9000`

**Poorten die doorgaans vrij zijn op Synology:**
`8765`, `8766`, `9000`, `9001`, `9090`, `7777`

**Poorten die je moet vermijden** (al in gebruik door DSM):
`5000`, `5001`, `80`, `443`, `22`

---

## 11. Externe toegang (optioneel)

Standaard is Mix Music alleen bereikbaar binnen je thuisnetwerk. Wil je het ook
van buitenaf gebruiken? Hieronder drie opties, van makkelijk naar complexer.

---

### Optie A — Tailscale (aanbevolen, gratis)

Tailscale maakt een beveiligd VPN-netwerk tussen jouw apparaten, zonder
poorten te openen in je router.

**Installatie op de NAS:**

1. Maak een gratis account aan op [tailscale.com](https://tailscale.com).
2. Voeg onderaan je `docker-compose.yml` een tweede service toe:

```yaml
  tailscale:
    image: tailscale/tailscale:latest
    container_name: tailscale
    restart: unless-stopped
    network_mode: host
    cap_add:
      - NET_ADMIN
      - NET_RAW
    volumes:
      - /volume1/docker/tailscale:/var/lib/tailscale
    environment:
      - TS_AUTHKEY=tskey-xxxxxxxxxxxxxxxx   # ← jouw auth key van tailscale.com
      - TS_STATE_DIR=/var/lib/tailscale
```

3. Haal je auth key op via tailscale.com → Settings → Keys → Generate auth key.
4. Herstart het project: `sudo docker-compose up -d --build`
5. Installeer Tailscale ook op je telefoon/laptop via [tailscale.com/download](https://tailscale.com/download).
6. Log in met hetzelfde account.
7. Bereik je NAS via het Tailscale-IP (te zien in je Tailscale-dashboard), bijv.:
   ```
   http://100.x.x.x:8765
   ```

---

### Optie B — Synology VPN Server

Synology biedt een gratis VPN-pakket waarmee je veilig thuis "inbelt".

1. Installeer **VPN Server** via Package Center.
2. Kies protocol: **OpenVPN** (breed ondersteund) of **L2TP/IPSec**.
3. Stel een gebruiker in en exporteer het configuratiebestand.
4. Importeer de configuratie in een VPN-app op je apparaat
   (bijv. OpenVPN Connect voor iOS/Android/Windows).
5. Zodra je verbonden bent met de VPN, gebruik je het gewone lokale adres:
   ```
   http://192.168.1.x:8765
   ```

> Vereist dat je **één poort openzet** in je router voor de VPN.
> Dit is veiliger dan directe toegang, omdat alleen VPN-verkeer doorgelaten wordt.

---

### Optie C — Synology Reverse Proxy met HTTPS

Voor een nette domeinnaam en HTTPS-certificaat (bijv. `muziek.jouwnaam.nl`).

1. Zorg dat je een domeinnaam hebt en dat deze wijst naar het publieke IP van je router.
2. Open DSM → Configuratiescherm → Aanmeldingsportaal → Geavanceerd → Reverse Proxy.
3. Klik op **Maken** en vul in:
   - **Naam:** mixmusic
   - **Protocol bron:** HTTPS
   - **Hostnaam bron:** `muziek.jouwnaam.nl`
   - **Poort bron:** 443
   - **Protocol doel:** HTTP
   - **Hostnaam doel:** `localhost`
   - **Poort doel:** `8765`
4. Ga daarna naar **Beveiligingscertificaat** en voeg een Let's Encrypt certificaat
   toe voor je domeinnaam.
5. Zet poort 80 en 443 open in je router naar het NAS-IP.

Daarna bereikbaar via `https://muziek.jouwnaam.nl`

---

### Vergelijking

| Methode | Veiligheid | Moeilijkheid | Routerpoort nodig? |
|---|---|---|---|
| Tailscale | ✅ Zeer hoog | ⭐ Makkelijk | Nee |
| Synology VPN | ✅ Hoog | ⭐⭐ Gemiddeld | Ja (1 poort) |
| Reverse Proxy + HTTPS | ✅ Hoog | ⭐⭐ Gemiddeld | Ja (80 + 443) |
| Directe poort forwarding | ⚠️ Laag | ⭐ Makkelijk | Ja |

Directe poort forwarding (poort 8765 openzetten in je router) wordt **afgeraden**:
Mix Music heeft geen ingebouwde authenticatie, waardoor iedereen op internet de
speler kan openen en je muziek kan afspelen.

---

## 12. Container bijwerken

Heb je een bestand gewijzigd (bijv. `index.html` of `server.py`)? Dan moet je de
container opnieuw bouwen om de wijzigingen door te voeren.

**Via SSH:**
```bash
cd /volume1/docker/mixmusic

# Stop de huidige container
sudo docker-compose down

# Bouw opnieuw en start
sudo docker-compose up -d --build
```

**Via Container Manager UI:**
1. Container Manager → Project → `mixmusic`
2. Klik op **Stoppen**
3. Klik op **Actie** → **Opnieuw bouwen**
4. Klik op **Starten**

> De container stopt hierbij heel even (enkele seconden). Je muziek of instellingen
> gaan niet verloren — alleen de draaiende applicatie wordt vervangen.

---

## 13. Problemen oplossen

### Container start niet op

Bekijk de foutmeldingen in de logs:
```bash
cd /volume1/docker/mixmusic
sudo docker-compose logs mixmusic
```

Veelvoorkomende oorzaken:
- **Poort al in gebruik:** Kies een andere poort (zie stap 10).
- **Syntaxfout in docker-compose.yml:** Controleer de inspringing (gebruik spaties, geen tabs).
- **Bestand mist:** Controleer of `server.py` en `static/index.html` aanwezig zijn.

---

### Webpagina laadt niet

**Controleer of de container actief is:**
```bash
sudo docker ps | grep mixmusic
```
Als er geen regel verschijnt, draait de container niet. Bekijk de logs (zie hierboven).

**Controleer of de poort bereikbaar is:**
```bash
curl http://localhost:8765/api/health
```
Verwachte output: `{"exists": true, "music_dir": "/music", "status": "ok"}`

Als je `exists: false` ziet, is het muziekpad niet correct gemount (zie volgende punt).

---

### Geen tracks zichtbaar in de speler

**Controleer het muziekpad:**
```bash
# Bestaat de map op de NAS?
ls -la /volume1/muziek

# Zijn er muziekbestanden in de container zichtbaar?
sudo docker exec mixmusic ls /music
```

Als `ls /music` leeg is of een fout geeft, klopt het volume-pad in `docker-compose.yml` niet.
Pas het aan (stap 5) en herbouw de container (stap 12).

**Controleer bestandsrechten:**
```bash
ls -la /volume1/muziek
```
De map moet leesbaar zijn voor de gebruiker die Docker draait.
Als dat niet zo is:
```bash
chmod -R 755 /volume1/muziek
```

---

### "Permission denied" fout in de logs

Synology gebruikt soms AppArmor-profielen die container-toegang beperken.
Voeg aan de service in `docker-compose.yml` toe:
```yaml
    security_opt:
      - no-new-privileges:true
```
En zorg dat de muziekmap eigendom is van de admin-gebruiker:
```bash
chown -R admin:users /volume1/muziek
```

---

### Audio speelt niet af in de browser

- **Safari op iOS/macOS:** WAV-bestanden met hoge sample rates (96kHz+) worden soms
  niet ondersteund. Converteer naar 44.1kHz of gebruik MP3.
- **Firefox:** FLAC wordt ondersteund, maar sommige FLAC-varianten niet. Probeer MP3.
- **Algemeen:** Controleer of het volume in de speler en op je apparaat niet op 0 staat.

---

### Synology meldt "Container Manager is niet beschikbaar"

Dit kan voorkomen als je een oudere NAS hebt (zonder 64-bit CPU).
Controleer je model op [synology.com/compatibility](https://www.synology.com/compatibility).
Modellen ouder dan 2013 ondersteunen Docker mogelijk niet.

---

## 14. Toetsenbordkoppelingen

| Toets | Actie |
|---|---|
| `Spatie` | Play / Pause |
| `→` (pijl rechts) | 10 seconden vooruitspoelen |
| `←` (pijl links) | 10 seconden terugspoelen |
| `↑` (pijl omhoog) | Volume verhogen |
| `↓` (pijl omlaag) | Volume verlagen |

---

## 15. Ondersteunde bestandsformaten

| Formaat | Extensie | Opmerkingen |
|---|---|---|
| MP3 | `.mp3` | Breed ondersteund, werkt overal |
| WAV | `.wav` | Grote bestanden, verliesvrij |
| FLAC | `.flac` | Verliesvrij, niet op alle browsers |
| AAC | `.aac`, `.m4a` | Goed gecomprimeerd, breed ondersteund |
| OGG Vorbis | `.ogg` | Open formaat, werkt goed in Chrome/Firefox |
| Opus | `.opus` | Modern, efficiënt — beperkte browserondersteuning |
| WMA | `.wma` | Windows Media Audio — beperkte ondersteuning op Mac/iOS |

> **Aanbeveling:** MP3 werkt op alle browsers en apparaten zonder problemen.
> FLAC is de beste keuze voor verliesvrije kwaliteit op desktop browsers.

#   M i x M u s i c  
 