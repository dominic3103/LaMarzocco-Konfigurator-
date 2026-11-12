// ---------------------------------------------------------------------------
// Grafik-Stufe: "2" = fotorealistisches Studio-Update (Vorschau über ?gfx=2)
//
// Bündelt alle Einstellungen des Updates an einer Stelle, damit sie sich
// gemeinsam ein- und ausschalten lassen: Studio-Umgebung mit Softboxen,
// Tone-Mapping, Umgebungsverschattung, Materialien (Lack, Holz, Metall) und
// fotografische Nachbearbeitung (Vignette, Filmkorn).
// ---------------------------------------------------------------------------
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

/** true = neues Grafik-Update aktiv */
export const GFX2 = params.get('gfx') === '2';

/** Einstellungen des Updates */
export const GFX = {
  // Anteil des unverschatteten diffusen Umgebungslichts (Rest kommt verschattet vom Himmel)
  iblDiffuse: GFX2 ? 0.1 : 0.15,
  // Fotografische Nachbearbeitung
  vignette: GFX2 ? 0.22 : 0,
  grain: GFX2 ? 0.012 : 0,
  // Tiefenunschärfe (Blendenradius in m)
  aperture: GFX2 ? 0.0055 : 0.0035,
  // gemittelte Bilder für das Standbild (Handy / Rechner)
  samples: GFX2 ? [48, 96] : [40, 64],
  bloom: GFX2 ? 0.07 : 0.05,
};
