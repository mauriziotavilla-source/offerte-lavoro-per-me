/**
 * Bridge verso il plugin Android OfferteNotifications (iscrizione topic Firebase).
 * Copyright © 2026 Maurizio Tavilla
 */

let pluginCache = null;

export function getOfferteNotificationsPlugin() {
  if (pluginCache) return pluginCache;
  const cap = window.Capacitor;
  if (!cap) {
    throw new Error('Capacitor non disponibile (usa l\'app Android compilata).');
  }
  if (typeof cap.registerPlugin === 'function') {
    pluginCache = cap.registerPlugin('OfferteNotifications');
    return pluginCache;
  }
  if (typeof cap.nativePromise === 'function') {
    pluginCache = {
      syncTopics: (opts) => cap.nativePromise('OfferteNotifications', 'syncTopics', opts),
      getTopics: () => cap.nativePromise('OfferteNotifications', 'getTopics', {}),
    };
    return pluginCache;
  }
  throw new Error('Sincronizzazione topic non disponibile su questo dispositivo.');
}
