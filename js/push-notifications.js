/**
 * Notifiche push (Android / Firebase Cloud Messaging)
 * Topic: offerte_lavoro, concorsi_pubblici, categorie_protette
 * Copyright © 2026 Maurizio Tavilla
 */

const STORAGE_PUSH_PREFS = 'lavoro_push_prefs_v1';
const STORAGE_PUSH_TOKEN = 'lavoro_push_token_v1';
const STORAGE_PUSH_NEW = 'lavoro_push_new_v1';
export const GIORNI_BADGE_NEW = 20;

const DEFAULT_PUSH_PREFS = {
  enabled: false,
  categorie: {
    offerte_lavoro: true,
    concorsi_pubblici: true,
    categorie_protette: true,
  },
  last_synced_at: '',
};

let listenersRegistrati = false;
let deepLinkHandler = null;
let pendingId = null;
let onNewMarked = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getPushPlugin() {
  return window.Capacitor?.Plugins?.PushNotifications || null;
}

export function isPushSupported() {
  return window.Capacitor?.isNativePlatform?.() === true && !!getPushPlugin();
}

export function getPushPreferences() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_PUSH_PREFS) || 'null');
    if (!raw) return clone(DEFAULT_PUSH_PREFS);
    return {
      ...clone(DEFAULT_PUSH_PREFS),
      ...raw,
      categorie: {
        ...clone(DEFAULT_PUSH_PREFS).categorie,
        ...(raw.categorie || {}),
      },
    };
  } catch {
    return clone(DEFAULT_PUSH_PREFS);
  }
}

export function savePushPreferences(prefs) {
  localStorage.setItem(STORAGE_PUSH_PREFS, JSON.stringify(prefs));
}

export function selectedPushTopics(prefs) {
  return Object.entries(prefs.categorie || {})
    .filter(([, enabled]) => enabled)
    .map(([topic]) => topic);
}

export function extractIdFromPush(notification) {
  const data = notification?.data || {};
  const id = data.offerta_id || data.bando_id || data.bandoId || '';
  return String(id).trim();
}

function extractIdsFromPush(notification) {
  const data = notification?.data || {};
  const ids = new Set();
  const primary = extractIdFromPush(notification);
  if (primary) ids.add(primary);
  const multi = String(data.offerta_ids || data.bando_ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  multi.forEach((id) => ids.add(id));
  return [...ids];
}

function readNewStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_PUSH_NEW) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeNewStore(store) {
  localStorage.setItem(STORAGE_PUSH_NEW, JSON.stringify(store));
}

function pruneNewStore(store) {
  const maxAge = GIORNI_BADGE_NEW * 24 * 60 * 60 * 1000;
  const now = Date.now();
  Object.keys(store).forEach((id) => {
    const ts = Number(store[id]);
    if (!ts || now - ts > maxAge) delete store[id];
  });
}

export function novitaUrlFromOfferteUrl(offerteUrl) {
  const u = String(offerteUrl || '').trim();
  if (!u) return '';
  if (/\/offerte\.json$/i.test(u)) return u.replace(/\/offerte\.json$/i, '/novita.json');
  return u.replace(/\/[^/]+$/, '/novita.json');
}

export function markAsNew(ids, opts = {}) {
  const list = [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!list.length) return [];
  const onlyIfMissing = opts.onlyIfMissing === true;
  const store = readNewStore();
  const now = Date.now();
  const marked = [];
  list.forEach((id) => {
    if (onlyIfMissing && store[id]) return;
    store[id] = now;
    marked.push(id);
  });
  pruneNewStore(store);
  writeNewStore(store);
  if (marked.length) onNewMarked?.(marked);
  return marked;
}

export function markFromPush(notification) {
  return markAsNew(extractIdsFromPush(notification), { onlyIfMissing: false });
}

export async function syncNewBadgeFromNovitaOnline(offerteUrl, timeoutSec = 12) {
  const novitaUrl = novitaUrlFromOfferteUrl(offerteUrl);
  if (!novitaUrl.startsWith('https://')) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(3, timeoutSec) * 1000);
  const sep = novitaUrl.includes('?') ? '&' : '?';
  try {
    const res = await fetch(`${novitaUrl}${sep}t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const novita = await res.json();
    const ids = (novita?.nuovi || []).map((b) => b.id).filter(Boolean);
    return markAsNew(ids, { onlyIfMissing: true });
  } catch (err) {
    console.warn('novita.json non disponibile per badge New:', err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function isNewFromPush(id) {
  if (!id) return false;
  const store = readNewStore();
  const ts = Number(store[id]);
  if (!ts) return false;
  const giorni = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return giorni >= 0 && giorni < GIORNI_BADGE_NEW;
}

export function setOnNewMarked(callback) {
  onNewMarked = typeof callback === 'function' ? callback : null;
}

function dispatchDeepLink(id) {
  if (!id) return;
  if (deepLinkHandler) {
    deepLinkHandler(id);
    return;
  }
  pendingId = id;
}

export function setPushDeepLinkHandler(handler) {
  deepLinkHandler = typeof handler === 'function' ? handler : null;
  if (pendingId && deepLinkHandler) {
    const id = pendingId;
    pendingId = null;
    deepLinkHandler(id);
  }
}

export function initPushNotificationListeners(onMessage) {
  const plugin = getPushPlugin();
  if (!plugin || listenersRegistrati) return;

  plugin.addListener('registration', (token) => {
    localStorage.setItem(STORAGE_PUSH_TOKEN, token?.value || '');
    onMessage?.('Notifiche registrate sul dispositivo Android.');
  });

  plugin.addListener('registrationError', (error) => {
    console.error('Registrazione push fallita', error);
    onMessage?.('Registrazione notifiche non riuscita.');
  });

  plugin.addListener('pushNotificationReceived', (notification) => {
    markFromPush(notification);
    if (notification?.title) onMessage?.(notification.title);
  });

  plugin.addListener('pushNotificationActionPerformed', (event) => {
    markFromPush(event?.notification);
    const id = extractIdFromPush(event?.notification);
    if (id) dispatchDeepLink(id);
  });

  listenersRegistrati = true;
}

export async function ensurePushRegistration(onMessage) {
  if (!isPushSupported()) {
    throw new Error('Le notifiche push sono disponibili solo nell\'app Android.');
  }
  const plugin = getPushPlugin();
  initPushNotificationListeners(onMessage);
  const check = (await plugin.checkPermissions?.()) || { receive: 'prompt' };
  let receive = check.receive;
  if (receive === 'prompt') {
    const requested = await plugin.requestPermissions();
    receive = requested.receive;
  }
  if (receive !== 'granted') {
    throw new Error('Permesso notifiche non concesso su Android.');
  }
  await plugin.register();
}

export async function syncPushTopics(prefs, onMessage) {
  if (!window.Capacitor?.nativePromise) {
    throw new Error('Sincronizzazione topic non disponibile.');
  }
  const topics = prefs.enabled ? selectedPushTopics(prefs) : [];
  const result = await window.Capacitor.nativePromise('OfferteNotifications', 'syncTopics', {
    topics,
    unsubscribeMissing: true,
  });
  onMessage?.(
    topics.length
      ? `Notifiche attive per ${topics.length} categorie.`
      : 'Notifiche disattivate per tutte le categorie.'
  );
  return result;
}

export async function applyPushPreferences(prefs, onMessage) {
  initPushNotificationListeners(onMessage);
  if (prefs.enabled) {
    await ensurePushRegistration(onMessage);
  }
  const result = await syncPushTopics(prefs, onMessage);
  const next = { ...prefs, last_synced_at: new Date().toISOString() };
  savePushPreferences(next);
  return { ...result, prefs: next };
}

export function describePushStatus(prefs) {
  if (!isPushSupported()) {
    return 'Disponibili solo nell\'app Android compilata con Firebase configurato.';
  }
  if (!prefs.enabled) {
    return 'Notifiche push disattivate. Puoi riattivarle quando vuoi.';
  }
  const attive = selectedPushTopics(prefs).length;
  return attive
    ? `Notifiche attive per ${attive} categorie.${prefs.last_synced_at ? ' Ultima sincronizzazione eseguita.' : ''}`
    : 'Le notifiche sono abilitate ma nessuna categoria è selezionata.';
}
