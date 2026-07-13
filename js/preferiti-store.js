/**
 * Preferiti persistenti: salva snapshot dell'offerta, non solo l'id
 * (così restano visibili anche dopo aggiornamenti catalogo o cambio id).
 * Copyright © 2026 Maurizio Tavilla
 */

const STORAGE_V2 = 'lavoro_preferiti_v2';
const STORAGE_V1 = 'lavoro_preferiti';

export function canonicalPreferitoUrl(url) {
  return String(url || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '');
}

function emptyStore() {
  return { version: 2, items: [] };
}

function snapshotOfferta(offerta) {
  return {
    id: offerta.id,
    link_ufficiale: offerta.link_ufficiale || '',
    url_origine: offerta.url_origine || '',
    nome: offerta.nome || 'Offerta salvata',
    ente: offerta.ente || '',
    tipo: offerta.tipo || 'lavoro',
    sede: offerta.sede || '',
    descrizione_breve: offerta.descrizione_breve || '',
    partecipazione: offerta.partecipazione || '',
    scadenze: Array.isArray(offerta.scadenze) ? offerta.scadenze : [],
    aree: Array.isArray(offerta.aree) ? offerta.aree : ['amministrazione'],
    stato: offerta.stato || 'aperto',
    fonte: offerta.fonte || offerta.fonte_scraper || 'preferito',
    saved_at: new Date().toISOString().slice(0, 10),
  };
}

/** @returns {{ version: number, items: object[] }} */
export function loadPreferitiStore() {
  try {
    const rawV2 = localStorage.getItem(STORAGE_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed?.version === 2 && Array.isArray(parsed.items)) return parsed;
    }
    const rawV1 = localStorage.getItem(STORAGE_V1);
    if (rawV1) {
      const ids = JSON.parse(rawV1);
      if (Array.isArray(ids)) {
        const migrated = { version: 2, items: ids.filter(Boolean).map((id) => ({ id: String(id) })) };
        savePreferitiStore(migrated);
        return migrated;
      }
    }
  } catch (err) {
    console.warn('Preferiti: lettura non riuscita', err);
  }
  return emptyStore();
}

/** @returns {boolean} */
export function savePreferitiStore(store) {
  try {
    localStorage.setItem(STORAGE_V2, JSON.stringify(store));
    return true;
  } catch (err) {
    console.warn('Preferiti: salvataggio non riuscito', err);
    return false;
  }
}

function samePreferito(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  const ua = canonicalPreferitoUrl(a.link_ufficiale || a.url_origine);
  const ub = canonicalPreferitoUrl(b.link_ufficiale || b.url_origine);
  return Boolean(ua && ub && ua === ub);
}

export function reconcilePreferitiConCatalogo(offerte = []) {
  const store = loadPreferitiStore();
  let changed = false;
  const nextItems = store.items.map((entry) => {
    const live = offerte.find((o) => o.id === entry.id);
    if (live) {
      if (!entry.nome) {
        changed = true;
        return snapshotOfferta(live);
      }
      return entry;
    }
    const url = canonicalPreferitoUrl(entry.link_ufficiale || entry.url_origine);
    if (url) {
      const byUrl = offerte.find((o) => canonicalPreferitoUrl(o.link_ufficiale) === url);
      if (byUrl) {
        changed = true;
        return { ...snapshotOfferta(byUrl), saved_at: entry.saved_at || byUrl.saved_at };
      }
    }
    return entry;
  });
  if (changed) savePreferitiStore({ version: 2, items: nextItems });
  return nextItems;
}

export function getPreferitiIds() {
  return loadPreferitiStore().items.map((x) => x.id).filter(Boolean);
}

export function isPreferitoSalvato(offertaOrId, offerte = []) {
  const store = loadPreferitiStore();
  let target = null;
  if (typeof offertaOrId === 'string') {
    target = { id: offertaOrId };
    const live = offerte.find((o) => o.id === offertaOrId);
    if (live) target = live;
  } else {
    target = offertaOrId;
  }
  if (!target) return false;
  return store.items.some((entry) => samePreferito(entry, target));
}

/** @returns {{ ok: boolean, added: boolean, message?: string }} */
export function togglePreferitoSalvato(offerta, offerte = []) {
  if (!offerta?.id) return { ok: false, added: false, message: 'Offerta non valida.' };
  const store = loadPreferitiStore();
  const idx = store.items.findIndex((entry) => samePreferito(entry, offerta));
  if (idx >= 0) {
    store.items.splice(idx, 1);
    const ok = savePreferitiStore(store);
    return {
      ok,
      added: false,
      message: ok ? 'Rimossa dai preferiti.' : 'Impossibile aggiornare i preferiti su questo dispositivo.',
    };
  }
  store.items.push(snapshotOfferta(offerta));
  const ok = savePreferitiStore(store);
  return {
    ok,
    added: true,
    message: ok ? 'Salvata nei preferiti.' : 'Impossibile salvare i preferiti su questo dispositivo.',
  };
}

/** Restituisce le offerte da mostrare in vista Preferiti (catalogo live + archivio) */
export function risolviPreferitiPerVista(offerte = []) {
  const store = loadPreferitiStore();
  const out = [];
  const seen = new Set();

  store.items.forEach((entry) => {
    const live = offerte.find((o) => samePreferito(entry, o));
    const item = live || (entry.nome ? { ...entry, archiviato: !live } : null);
    if (!item) return;
    const key = item.id || canonicalPreferitoUrl(item.link_ufficiale) || item.nome;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });

  return out;
}

export function contaPreferiti() {
  return loadPreferitiStore().items.length;
}
