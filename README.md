# Linea Mini R – 360° Konfigurator

Interaktiver 3D-Konfigurator für die Espressomaschine **Linea Mini R**. Die Maschine lässt sich frei um 360° drehen und in allen sichtbaren Materialien individuell gestalten.

## Funktionen

- **360°-Ansicht**: Drehen per Maus/Touch, Zoomen per Scrollen/Pinch, automatische Rotation sowie Schnellansichten (Front, 3/4, Links, Rechts, Hinten, Oben).
- **Gehäuse**: komplett oder getrennt nach Oberteil, Kopfteil, Unterteil und Basis/Tropfschale.
  - Farbauswahl nach den **IGP-DURA® Pulverlack-Farbkarten**, jeweils mit Name und Farbcode:
    - xal 42 / 4201 *Warm Radiation*: Chiffon Silk, Silver Tinsel, Style 23, Titan Power, Velvet Brown, Style 24, English Bronze, Amaranth Glow
    - xal 42 / 4201 *Tech Cold*: Natural Silver, Fine Palladium, Radiant Silver, Galaxy Depth, Quarzo Fumo, Blued Metal, Jungle Street, Traffic Black
    - xal 42 / 4201 *Brave Colours*: Warm Grey, Admiral Blue, Technical Ceramics, Rare Earth, Jungle Thicket, Rhodonite Stone, Silver Beige, Glory Curry
    - xal 4201 *Style*: xal-Style 21, 22, 23, 25, 26, 30
    - xal 4201 *Trend*: xal-Trend 3, 6
    - xal 4601 *Design*: xal-Design 12, 17, 20, 21
  - Darstellung nach Code-Typ: `A` = Uni, `E` = Effektfarbton mit feinem metallischem Schimmer, `U` = IGP-Effectives® mit Glitzerpartikeln
  - eigene Farbe (Uni oder Metallic) per Farbwähler, z. B. für RAL-Töne
  - Oberflächen: Tiefmatt (wie IGP-DURA® xal 4201), Seidenmatt, Hochglanz und Struktur zum Vergleich
- **Holz**: Paddle, Drehknöpfe und Siebträgergriff, zusammen oder einzeln.
  - Olivenholz, Nussbaum, Eiche, Ahorn, Kirschbaum, Zebrano, Padouk, Wengé, Mooreiche, Makassar, Nuss-Wurzel sowie „Serie Schwarz“ (Kunststoff wie ab Werk)
  - Oberflächen: geölt oder hochglanzlackiert
  - Jede Maserung wird prozedural erzeugt und sieht deshalb je Holzart unterschiedlich aus.
- **Metallakzente**: Schrauben, Dampflanze & Heißwasser, Siebträger, Brühgruppe, Knopfkappen, Manometer-Ringe, Gitter & Tassenablage, Schriftzug – alle zusammen oder jedes Teil einzeln.
  - Edelstahl, Chrom, Schwarzchrom, Gunmetal, Titan, Gold, Roségold, Kupfer, Messing, Bronze, Champagner, Blau PVD
  - Uni-Lacke (Schwarz, Weiß, Grau, Rot, Creme, Marine) und eine eigene Farbe
  - Oberflächen: Hochglanz, Satiniert, Matt
- **Details**: Manometer-Zifferblatt in Weiß oder Schwarz.
- **Bauteile direkt anklicken**: Ein Klick auf ein Teil im 3D-Modell öffnet die passende Auswahl.
- **10 Inspirations-Presets**, **Link teilen** (die komplette Konfiguration steckt in der URL), **Bild speichern** (PNG), **Liste kopieren** (Textzusammenfassung).

## Starten

Das Projekt kommt ohne Build-Schritt aus. Three.js liegt lokal unter `vendor/three/`, es wird also kein CDN benötigt.

Weil der Browser ES-Module nicht direkt von `file://` lädt, braucht es einen einfachen lokalen Webserver:

```bash
# im Projektordner
python3 -m http.server 8000
# danach im Browser öffnen: http://localhost:8000
```

Alternativ `npx serve .` oder die „Live Server“-Erweiterung in VS Code.

### Online stellen (GitHub Pages)

Im Repository unter **Settings → Pages** als Quelle „Deploy from a branch“ wählen, den gewünschten Branch und den Ordner `/ (root)` angeben. Danach ist der Konfigurator unter `https://<benutzer>.github.io/<repository>/` erreichbar.

## Projektstruktur

```
index.html          Seitengerüst, Import-Map für Three.js
css/style.css       Layout und Gestaltung (Desktop und Mobil)
js/main.js          Einstieg: verbindet Modell, Materialien, Viewer und Oberfläche
js/model.js         Prozedurales 3D-Modell der Maschine (Maße in mm, nach Referenzfotos)
js/materials.js     Materialien je Bauteil-Gruppe (Lack, Holz, Metall)
js/textures.js      Prozedurale Texturen: Holzmaserung, Struktur-/Metallic-Lack, Gitter, Manometer
js/viewer.js        Renderer, Licht, 360°-Kamera, Auswahl per Klick, Screenshot
js/ui.js            Konfigurations-Panel
js/data.js          Farbpaletten, Holzarten, Presets, Bauteil-Gruppen
vendor/three/       Three.js r170 (MIT-Lizenz)
```

## Anpassen

- **Farben, Holzarten und Presets** stehen in `js/data.js`. Ein neuer Eintrag erscheint automatisch in der Oberfläche.
- **IGP-Farben** sind in `BODY_COLLECTIONS` hinterlegt: `igp('Code', 'Name', '#hex')`. Die Hex-Werte wurden aus Fotos der Farbkarten gemessen und weißabgeglichen. Es sind also Näherungswerte für den Bildschirm, keine Farbmesswerte. Liegen offizielle RGB/Lab-Werte vor, einfach den Hex-Wert ersetzen.
- **Holzmaserungen** werden über Parameter gesteuert (`style`, `light`/`mid`/`dark`, `freq`, `warp`, `contrast` …). Für `style` gibt es `straight`, `oak`, `zebra`, `olive`, `burl` und `solid`.
- **Geometrie**: Alle Maße stehen in Millimetern in `js/model.js` (Konstante `M` und die einzelnen Bauteil-Abschnitte).

## Hinweis

Das 3D-Modell ist eine eigene, vereinfachte Nachbildung auf Basis von Fotos. Es handelt sich nicht um ein offizielles Produkt des Herstellers. Marken- und Produktnamen gehören ihren jeweiligen Inhabern.
