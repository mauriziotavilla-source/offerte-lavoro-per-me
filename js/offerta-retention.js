/**
 * Logica scadenze: i concorsi restano visibili fino al giorno della scadenza incluso.
 * Copyright © 2026 Maurizio Tavilla
 */

export function oggi() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseDataOfferta(str) {
  if (!str) return null;
  const d = new Date(`${str}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ultimaScadenza(offerta) {
  const date = (offerta.scadenze || []).map((s) => parseDataOfferta(s.data)).filter(Boolean);
  if (!date.length) return null;
  return date.sort((a, b) => b - a)[0];
}

/** True solo dopo il giorno di scadenza (non prima) */
export function isScadutaPerData(offerta) {
  const ultima = ultimaScadenza(offerta);
  if (ultima) return ultima < oggi();
  return false;
}

/**
 * Stato usato dai filtri UI: un concorso resta "aperto" finché la data non è passata,
 * anche se il sito lo marca già come "scaduto".
 */
export function statoEffettivo(offerta) {
  const tipo = String(offerta.tipo || '').toLowerCase();
  const isConcorso = tipo === 'concorso' || tipo === 'categoria_protetta';
  if (isConcorso && !isScadutaPerData(offerta)) return 'aperto';
  return offerta.stato || 'aperto';
}

export function isNascostaPerScadenza(offerta, isPreferito = false) {
  if (isPreferito) return false;
  if (isScadutaPerData(offerta)) return true;
  const tipo = String(offerta.tipo || '').toLowerCase();
  const isConcorso = tipo === 'concorso' || tipo === 'categoria_protetta';
  if (isConcorso) return false;
  if (offerta.stato === 'chiuso') return true;
  return false;
}

function canonicalUrl(url) {
  return String(url || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '');
}

/** Unisce elenco online con cache locale tenendo i bandi non ancora scaduti */
export function mergeRetainingOpen(remoteList, localList) {
  const byId = new Set((remoteList || []).map((o) => o.id));
  const byUrl = new Set(
    (remoteList || []).map((o) => canonicalUrl(o.link_ufficiale)).filter(Boolean)
  );
  const extra = (localList || []).filter((o) => {
    if (byId.has(o.id)) return false;
    const url = canonicalUrl(o.link_ufficiale);
    if (url && byUrl.has(url)) return false;
    if (isScadutaPerData(o)) return false;
    if (o.fonte === 'utente') return false;
    return true;
  });
  return [...(remoteList || []), ...extra];
}
