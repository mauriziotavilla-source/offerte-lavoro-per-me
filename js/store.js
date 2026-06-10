/**
 * Caricamento offerte: aggiornamento online + cache + file locale + offerte aggiunte da te
 * Copyright © 2026 Maurizio Tavilla
 */

import { mergeRetainingOpen } from './offerta-retention.js';

const STORAGE_CUSTOM = 'lavoro_offerte_custom_v1';
const STORAGE_CACHE = 'lavoro_offerte_cache_v1';
const STORAGE_CACHE_META = 'lavoro_offerte_cache_meta_v1';
const STORAGE_NEW_TRACKER = 'lavoro_new_tracker_v1';
const AUTO_NEW_FALLBACK_COUNT = 6;

const DEFAULT_UPDATE = {
  abilitato: false,
  offerte_url: '',
  timeout_secondi: 12,
};

export function topicPerTipo(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'concorso') return 'concorsi_pubblici';
  if (t === 'categoria_protetta') return 'categorie_protette';
  return 'offerte_lavoro';
}

function normalizzaTopics(topics, offerta) {
  if (!Array.isArray(topics) || !topics.length) return [topicPerTipo(offerta.tipo)];
  return [...new Set(topics.map((x) => String(x || '').trim()).filter(Boolean))];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function enrichOfferta(o) {
  const out = { ...o };
  if (!out.scadenze) out.scadenze = [];
  if (!Array.isArray(out.aree) || !out.aree.length) out.aree = ['amministrazione'];
  if (!out.tipo) out.tipo = 'lavoro';
  if (!out.stato) out.stato = 'aperto';
  out.ente = out.ente || 'Da definire';
  out.sede = out.sede || 'Da definire';
  out.descrizione_breve = out.descrizione_breve || '';
  out.partecipazione = out.partecipazione || 'Verifica i requisiti sull\'annuncio ufficiale.';
  out.contratto = out.contratto || '';
  out.retribuzione = out.retribuzione || '';
  out.requisiti = out.requisiti || [];
  out.documenti = out.documenti || [];
  out.profili = out.profili || [];
  out.checklist = out.checklist || [
    'Aprire il link ufficiale e leggere l\'annuncio',
    'Aggiornare il CV per questa posizione',
    'Inviare la candidatura entro la scadenza',
  ];
  out.regioni_ammesse = out.regioni_ammesse || [];
  out.data_pubblicazione = out.data_pubblicazione || out.data_uscita || '';
  out.fonte_scraper = out.fonte_scraper || '';
  out.url_origine = out.url_origine || out.link_ufficiale || '';
  out.notifica_topics = normalizzaTopics(out.notifica_topics, out);
  return out;
}

function readNewTracker() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_NEW_TRACKER) || 'null');
    if (!raw || typeof raw !== 'object') return { initialized: false, ids: {} };
    return {
      initialized: raw.initialized === true,
      ids: raw.ids && typeof raw.ids === 'object' ? raw.ids : {},
    };
  } catch {
    return { initialized: false, ids: {} };
  }
}

function writeNewTracker(tracker) {
  try {
    localStorage.setItem(
      STORAGE_NEW_TRACKER,
      JSON.stringify({ initialized: tracker.initialized === true, ids: tracker.ids || {} })
    );
  } catch (e) {
    console.warn('Tracker badge New non salvato', e);
  }
}

function applyAutomaticNewMarkers(offerte) {
  const tracker = readNewTracker();
  const idsCorrenti = offerte.map((o) => o.id).filter(Boolean);
  const setCorrenti = new Set(idsCorrenti);
  const nextIds = { ...(tracker.ids || {}) };
  const fallbackDate = todayIso();

  Object.keys(nextIds).forEach((id) => {
    if (!setCorrenti.has(id)) delete nextIds[id];
  });

  if (!tracker.initialized) {
    const fallbackIds = new Set(idsCorrenti.slice(-AUTO_NEW_FALLBACK_COUNT));
    idsCorrenti.forEach((id) => {
      nextIds[id] = fallbackIds.has(id) ? fallbackDate : '';
    });
    writeNewTracker({ initialized: true, ids: nextIds });
    return offerte.map((o) => {
      if (o.data_pubblicazione || o.aggiunto_il || o.prima_vista_il) return o;
      return nextIds[o.id] ? { ...o, prima_vista_il: nextIds[o.id] } : o;
    });
  }

  const oggi = todayIso();
  idsCorrenti.forEach((id) => {
    if (!(id in nextIds)) nextIds[id] = oggi;
  });
  writeNewTracker({ initialized: true, ids: nextIds });
  return offerte.map((o) => {
    if (o.data_pubblicazione || o.aggiunto_il || o.prima_vista_il) return o;
    return nextIds[o.id] ? { ...o, prima_vista_il: nextIds[o.id] } : o;
  });
}

function validaPayload(data) {
  return (
    data &&
    Array.isArray(data.offerte) &&
    data.offerte.length > 0 &&
    data.offerte.every((o) => o && typeof o.id === 'string' && typeof o.nome === 'string')
  );
}

function firmaDati(data) {
  if (data.catalog_hash) return `catalog:${data.catalog_hash}`;
  const ids = (data.offerte || [])
    .map((o) => `${o.id}:${o.hash_contenuto || o.data_pubblicazione || ''}`)
    .sort()
    .join(',');
  return `${data.ultimo_aggiornamento || ''}|${data.versione || ''}|${data.offerte?.length || 0}|${ids.slice(0, 120)}`;
}

function isNewerOrDifferent(remote, local) {
  if (!local) return true;
  if (firmaDati(remote) !== firmaDati(local)) return true;
  const dr = remote.ultimo_aggiornamento || '';
  const dl = local.ultimo_aggiornamento || '';
  if (!dr) return false;
  if (!dl) return true;
  return dr > dl;
}

export function getCustomOfferte() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_CUSTOM) || '[]');
  } catch {
    return [];
  }
}

export function saveCustomOfferta(offerta) {
  const list = getCustomOfferte();
  const idx = list.findIndex((x) => x.id === offerta.id);
  const existing = idx >= 0 ? list[idx] : null;
  const oggiIso = todayIso();
  const enriched = {
    ...enrichOfferta(offerta),
    fonte: 'utente',
    aggiunto_il: existing?.aggiunto_il || offerta.aggiunto_il || oggiIso,
    data_pubblicazione: offerta.data_pubblicazione || existing?.data_pubblicazione || '',
  };
  if (idx >= 0) list[idx] = enriched;
  else list.push(enriched);
  localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(list));
  return enriched;
}

export function deleteCustomOfferta(id) {
  const list = getCustomOfferte().filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(list));
}

export function slugId(nome) {
  const base = (nome || 'offerta')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `custom-${base}-${Date.now().toString(36)}`;
}

function readCache() {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return validaPayload(data) ? data : null;
  } catch {
    return null;
  }
}

function writeCache(data, source) {
  try {
    localStorage.setItem(STORAGE_CACHE, JSON.stringify(data));
    localStorage.setItem(
      STORAGE_CACHE_META,
      JSON.stringify({
        source,
        saved_at: new Date().toISOString(),
        ultimo_aggiornamento: data.ultimo_aggiornamento || '',
        count: data.offerte?.length || 0,
      })
    );
  } catch (e) {
    console.warn('Cache offerte non salvata', e);
  }
}

export function getCacheMeta() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_CACHE_META) || 'null');
  } catch {
    return null;
  }
}

async function loadUpdateConfig() {
  try {
    const res = await fetch('data/aggiornamento.json');
    if (!res.ok) return { ...DEFAULT_UPDATE };
    const cfg = await res.json();
    return { ...DEFAULT_UPDATE, ...cfg };
  } catch {
    return { ...DEFAULT_UPDATE };
  }
}

async function loadBundled() {
  const res = await fetch('data/offerte.json');
  if (!res.ok) throw new Error('File offerte.json locale non trovato');
  const data = await res.json();
  if (!validaPayload(data)) throw new Error('Formato offerte.json non valido');
  return data;
}

async function fetchRemote(url, timeoutSec) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(3, timeoutSec) * 1000);
  const sep = url.includes('?') ? '&' : '?';
  try {
    const res = await fetch(`${url}${sep}t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Server risponde ${res.status}`);
    const data = await res.json();
    if (!validaPayload(data)) throw new Error('JSON remoto non valido');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadAllOfferte(opts = {}) {
  const cfg = await loadUpdateConfig();
  const url = (cfg.offerte_url || '').trim();
  const onlineEnabled = cfg.abilitato !== false && url.startsWith('https://');
  const cached = readCache();
  let remote = null;
  let fonte = 'locale';
  let messaggio = '';

  if (onlineEnabled && navigator.onLine !== false) {
    try {
      remote = await fetchRemote(url, cfg.timeout_secondi || 12);
      const changed = isNewerOrDifferent(remote, cached);
      if (opts.forceRemote || changed || !cached) {
        const mergedOfferte = cached
          ? mergeRetainingOpen(remote.offerte || [], cached.offerte || [])
          : remote.offerte || [];
        remote = { ...remote, offerte: mergedOfferte };
        writeCache(remote, 'online');
        fonte = 'online';
        if (opts.forceRemote && !changed && cached) {
          messaggio = 'Nessuna novità: l\'elenco online è già quello attuale.';
        }
      } else {
        remote = cached;
        fonte = 'cache';
      }
    } catch (err) {
      console.warn('Aggiornamento online fallito:', err);
      messaggio = cached
        ? 'Offline: uso l\'ultima copia salvata.'
        : 'Aggiornamento online non disponibile: uso i dati inclusi nell\'app.';
    }
  } else if (onlineEnabled && navigator.onLine === false) {
    messaggio = 'Sei offline: uso l\'ultima copia disponibile.';
  } else if (cfg.abilitato !== false && url && !url.startsWith('https://')) {
    messaggio = 'URL aggiornamento non valido (serve HTTPS). Controlla data/aggiornamento.json.';
  }

  let data = remote || cached;
  if (!data) {
    data = await loadBundled();
    if (fonte !== 'online') fonte = 'locale';
  }

  let baseOfferte = (data.offerte || []).map(enrichOfferta);
  if (fonte === 'locale' && cached?.offerte?.length) {
    baseOfferte = mergeRetainingOpen(baseOfferte, cached.offerte.map(enrichOfferta)).map(enrichOfferta);
  }
  const base = applyAutomaticNewMarkers(baseOfferte);
  const custom = getCustomOfferte().map(enrichOfferta);
  const ids = new Set(base.map((o) => o.id));
  const merged = [...base, ...custom.filter((c) => !ids.has(c.id))];

  return {
    offerte: merged.sort((a, b) => {
      const da = prossimaData(a);
      const db = prossimaData(b);
      if (da && db) return da - db;
      if (da) return -1;
      if (db) return 1;
      return (a.nome || '').localeCompare(b.nome || '', 'it');
    }),
    ultimo_aggiornamento: data.ultimo_aggiornamento,
    nota: data.nota,
    fonte,
    messaggio,
    online_configurato: onlineEnabled,
  };
}

export async function refreshOfferteOnline() {
  return loadAllOfferte({ forceRemote: true });
}

function prossimaData(o) {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  let best = null;
  for (const s of o.scadenze || []) {
    if (!s.data) continue;
    const d = new Date(s.data + 'T12:00:00');
    if (!isNaN(d) && d >= oggi && (!best || d < best)) best = d;
  }
  return best;
}

export function labelFonteDati(fonte) {
  switch (fonte) {
    case 'online':
      return 'Aggiornato da internet';
    case 'cache':
      return 'Copia salvata sul dispositivo';
    default:
      return 'Dati inclusi nell\'app';
  }
}
