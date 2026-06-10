/**
 * Mantiene le offerte/concorsi fino alla scadenza (incluso il giorno della scadenza).
 */
const { compactText } = require('./utils');

function oggi() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseData(str) {
  if (!str) return null;
  const d = new Date(`${str}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ultimaScadenza(offerta) {
  const date = (offerta.scadenze || []).map((s) => parseData(s.data)).filter(Boolean);
  if (!date.length) return null;
  return date.sort((a, b) => b - a)[0];
}

function isScaduta(offerta) {
  const ultima = ultimaScadenza(offerta);
  if (ultima) return ultima < oggi();
  return String(offerta.stato || '').toLowerCase() === 'chiuso';
}

function isManuale(offerta) {
  const fonte = String(offerta.fonte_scraper || offerta.fonte || '').toLowerCase();
  return fonte === 'manual_seed' || fonte === 'utente' || offerta.fonte === 'utente';
}

/** Conserva nel catalogo i bandi già raccolti finché non sono scaduti */
function shouldRetainPrevious(offerta) {
  if (isManuale(offerta)) return false;
  if (!offerta.fonte_scraper) return false;
  return !isScaduta(offerta);
}

function canonicalUrl(url) {
  return String(url || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '');
}

function mergeRetainingOpen(remoteList, localList) {
  const byId = new Set((remoteList || []).map((o) => o.id));
  const byUrl = new Set(
    (remoteList || []).map((o) => canonicalUrl(o.link_ufficiale)).filter(Boolean)
  );
  const extra = (localList || []).filter((o) => {
    if (byId.has(o.id)) return false;
    const url = canonicalUrl(o.link_ufficiale);
    if (url && byUrl.has(url)) return false;
    return shouldRetainPrevious(o);
  });
  return [...(remoteList || []), ...extra];
}

module.exports = {
  isScaduta,
  shouldRetainPrevious,
  mergeRetainingOpen,
  canonicalUrl,
};
