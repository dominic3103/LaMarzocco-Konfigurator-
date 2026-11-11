# Konfigurator teilen

Am einfachsten für den Empfänger ist ein **ganz normaler Link** (https), der auf jedem Rechner, Tablet und Handy direkt im Browser läuft – ohne Installation, ohne Konto. Nur so funktionieren auch AR (iPhone/iPad mit Safari, Android mit Chrome), der QR-Code für den Wechsel aufs Handy und „Link teilen“ mit der fertigen Konfiguration.

Empfohlen ist **Netlify** (kostenlos, funktioniert mit dem privaten GitHub-Repository, aktualisiert sich bei jeder Änderung von selbst). Das Repository ist dafür vorbereitet (`netlify.toml`).

## Weg A: Netlify mit GitHub verbinden (empfohlen, einmalig ca. 5 Minuten)

1. [app.netlify.com](https://app.netlify.com) öffnen und mit **„Sign up with GitHub“** ein kostenloses Konto anlegen.
2. **„Add new site“ → „Import an existing project“ → „GitHub“** wählen und Netlify den Zugriff erlauben – am besten nur auf das Repository `LaMarzocco-Konfigurator-`.
3. Das Repository auswählen und einstellen:
   - **Branch to deploy:** `claude/zen-albattani-jfzyt8` (dort liegt der aktuelle Stand; `main` enthält noch eine ältere Fassung)
   - **Build command:** leer lassen
   - **Publish directory:** `.` (wird aus `netlify.toml` übernommen)
4. **„Deploy“** klicken. Nach etwa einer Minute steht der Konfigurator unter einer Adresse wie `https://zufalls-name-123.netlify.app`.
5. Unter **„Site configuration“ → „Change site name“** einen schöneren Namen wählen, z. B. `espresso-konfigurator` → `https://espresso-konfigurator.netlify.app` (falls frei).
6. Diesen Link verschicken – fertig.

Jede weitere Änderung, die auf den Branch hochgeladen wird, ist eine Minute später automatisch online.

## Weg B: Ohne GitHub – ZIP per Drag-and-drop

1. Die Datei `konfigurator-website.zip` (fertiges Website-Paket) entpacken.
2. [app.netlify.com/drop](https://app.netlify.com/drop) öffnen und den entpackten Ordner (oder die ZIP-Datei) in das Feld ziehen.
3. Mit einem kostenlosen Konto anmelden, damit die Seite dauerhaft bleibt (ohne Konto wird sie nach kurzer Zeit gelöscht), und wie oben einen Namen vergeben.

Bei späteren Änderungen muss das Paket erneut hochgeladen werden.

## Alternativen

- **Cloudflare Pages** oder **Vercel**: genauso wie Weg A (Repository verbinden, kein Build-Befehl, Ausgabeordner `/`).
- **GitHub Pages**: nur wenn das Repository öffentlich ist (oder mit GitHub Pro). Dann unter **Settings → Pages → „Deploy from a branch“** den Branch und `/ (root)` wählen; `.nojekyll` liegt schon bereit.
- **Eigener Webspace mit https**: den Inhalt des ZIP-Pakets unverändert hochladen.
- **Claude-Artefakt**: eignet sich zum schnellen Ansehen über „Teilen“ auf claude.ai, aber AR, QR-Code und Teilen-Links funktionieren dort nicht vollständig.

## Gut zu wissen

- Wer den Link hat, kann den Konfigurator öffnen. Suchmaschinen werden ausgeschlossen (`noindex`, `robots.txt`), die Seite taucht also nicht bei Google auf. Einen Passwortschutz gibt es bei Netlify erst im bezahlten Tarif.
- Varianten und Einstellungen speichert jeder Besucher nur in seinem eigenen Browser.
- Mit **„Link teilen“** schickt der Empfänger seine fertige Konfiguration zurück – der Link enthält Maschine, Mühle und alle Farben.

## Nachricht zum Verschicken (Vorlage)

> Hi! Hier kannst du dir deine Espressomaschine und Mühle zusammenstellen: **https://DEIN-NAME.netlify.app**
>
> Einfach Maschine und Mühle auswählen, Farben, Holz und Metallteile anpassen und frei drehen. Am Handy kannst du dir das Ergebnis mit „AR ansehen“ in Originalgröße in deine Küche stellen. Wenn du fertig bist, tipp auf „Link teilen“ und schick mir den Link – dann sehe ich genau deine Konfiguration.
