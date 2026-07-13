/**
 * App "Lavoro & Concorsi per Me"
 * Motore di ricerca personalizzato di offerte di lavoro, concorsi pubblici
 * e posizioni per categorie protette, basato sul profilo del candidato.
 *
 * Copyright © 2026 Maurizio Tavilla. Tutti i diritti riservati.
 */

import {
  loadAllOfferte,
  refreshOfferteOnline,
  saveCustomOfferta,
  deleteCustomOfferta,
  slugId,
  enrichOfferta,
  labelFonteDati,
} from './store.js';
import {
  applyPushPreferences,
  describePushStatus,
  getPushPreferences,
  GIORNI_BADGE_NEW,
  initPushNotificationListeners,
  isNewFromPush,
  isPushSupported,
  savePushPreferences,
  setOnNewMarked,
  setPushDeepLinkHandler,
  syncNewBadgeFromNovitaOnline,
} from './push-notifications.js';
import { passaFiltroProfilo } from './profile-filter.js';
import { isPerMessinaLavoro } from './localita-filter.js';
import {
  isNascostaPerScadenza,
  isScadutaPerData,
  statoEffettivo,
} from './offerta-retention.js';
import {
  reconcilePreferitiConCatalogo,
  isPreferitoSalvato,
  togglePreferitoSalvato,
  risolviPreferitiPerVista,
  contaPreferiti,
} from './preferiti-store.js';

const STORAGE_CHECKLIST = 'lavoro_checklist';
const STORAGE_ORDINAMENTO = 'lavoro_ordinamento';
const STORAGE_FILTRO_SICILIA = 'lavoro_filtro_sicilia';

/** Città/province/comuni siciliani riconosciuti nel testo del bando */
const SEGNALI_SICILIA = [
  'sicil', 'messina', 'catania', 'palermo', 'siracusa', 'ragusa', 'trapani',
  'agrigento', 'enna', 'caltanissetta', 'santa venerina', 'taormina', 'milazzo',
  'barcellona pozzo', 'giarre', 'acireale', 'paternò', 'modica', 'gela',
];

const TIPI_ORDINE = ['lavoro', 'concorso', 'categoria_protetta'];
const ORDINI = ['urgente', 'scadenza', 'nome', 'recente'];

let offerte = [];
let fonti = null;
let profilo = null;
let offertaCorrente = null;
let categoriaAttiva = 'tutti';
let pendingPushId = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ----------------------------- Caricamento ----------------------------- */
async function applicaDati(data, opts = {}) {
  offerte = data.offerte;
  $('#data-aggiornamento').textContent = data.ultimo_aggiornamento || '—';
  const statoEl = $('#stato-aggiornamento');
  if (statoEl) {
    statoEl.textContent = ` · ${labelFonteDati(data.fonte)}`;
    statoEl.className = `stato-aggiornamento stato-${data.fonte || 'locale'}`;
  }
  if (opts.notify) {
    if (data.messaggio) showToast(data.messaggio);
    else if (data.fonte === 'online') showToast('Elenco offerte aggiornato da internet.');
  }
  await syncNewBadgeOnline();
  reconcilePreferitiConCatalogo(offerte);
  renderOfferte();
  aggiornaContatorePreferiti();
  flushPendingPushDeepLink();
}

function flushPendingPushDeepLink() {
  if (!pendingPushId || !offerte.length) return;
  const id = pendingPushId;
  pendingPushId = null;
  void apriDaNotifica(id);
}

function setupPushDeepLink() {
  if (!isPushSupported()) return;
  setOnNewMarked(() => {
    if (offerte.length) renderOfferte();
  });
  initPushNotificationListeners();
  setPushDeepLinkHandler((id) => {
    if (!id) return;
    if (!offerte.length) {
      pendingPushId = id;
      return;
    }
    void apriDaNotifica(id);
  });
}

async function apriDaNotifica(id) {
  if (!id) return;
  mostraVista('lista');
  let o = offerte.find((x) => x.id === id);
  if (!o) {
    try {
      const data = await refreshOfferteOnline();
      await applicaDati(data, { notify: false });
      o = offerte.find((x) => x.id === id);
    } catch (err) {
      console.warn('Deep link: aggiornamento non riuscito', err);
    }
  }
  if (!o) {
    showToast('Offerta non trovata. Prova «Controlla aggiornamenti online».');
    return;
  }
  apriModale(id);
}

async function controllaAggiornamentoOnline() {
  const btn = $('#btn-aggiorna-online');
  const testoOrig = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Controllo in corso…';
  }
  try {
    const data = await refreshOfferteOnline();
    await applicaDati(data, { notify: true });
  } catch (err) {
    console.error(err);
    showToast('Aggiornamento non riuscito. Controlla internet e l\'URL in data/aggiornamento.json');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = testoOrig || '🔄 Controlla aggiornamenti online';
    }
  }
}

async function init() {
  setupPushDeepLink();
  try {
    const [data, resFonti, resProfilo] = await Promise.all([
      loadAllOfferte(),
      fetch('data/fonti.json'),
      fetch('data/profilo.json').catch(() => null),
    ]);
    fonti = await resFonti.json();
    profilo = resProfilo && resProfilo.ok ? await resProfilo.json() : null;
    setupProfilo();
    setupFiltri();
    setupPushSettings();
    setupCategorieNav();
    setupPortali();
    setupPortaliSicilia();
    setupEventi();
    setupFormNuovaOfferta();
    setupMobile();
    await applicaDati(data);
  } catch (err) {
    console.error(err);
    const msg = isMobileApp()
      ? 'Errore nel caricamento dei dati. Chiudi e riapri l\'app.'
      : 'Errore nel caricamento. Avvia il server: <code>python scripts/avvia_server.py</code>';
    $('#lista-offerte').innerHTML = `<p class="empty-state">${msg}</p>`;
  }
}

function isMobileApp() {
  return (
    document.documentElement.classList.contains('mobile-app') ||
    window.Capacitor?.isNativePlatform?.() === true ||
    window.matchMedia('(max-width: 768px)').matches
  );
}

function isNativeApp() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

/* ----------------------------- Profilo ----------------------------- */
function setupProfilo() {
  if (!profilo?.candidato) return;
  const c = profilo.candidato;
  $('#profilo-nome').textContent = c.nome || '—';
  const ts = profilo.titolo_studio?.descrizione || (profilo.titoli || [])[0] || '';
  const dett = [c.citta, ts].filter(Boolean).join(' · ');
  $('#profilo-dett').textContent = dett;
  const notaFiltro = profilo.titolo_studio?.equivalente_laurea === false
    ? 'Mostriamo solo concorsi adatti al diploma (niente laurea, medici, ingegneri, ecc.).'
    : '';
  if (notaFiltro) {
    const el = $('#profilo-dett');
    el.innerHTML = `${escapeHtml(dett)}<br /><small class="muted">${escapeHtml(notaFiltro)}</small>`;
  }
  const tags = (profilo.profili_target || []).slice(0, 4);
  $('#profilo-tags').innerHTML = tags
    .map((t) => `<span class="settore-tag">${escapeHtml(t)}</span>`)
    .join('');
}

/* ----------------------------- Mobile ----------------------------- */
function setupMobile() {
  const native = window.Capacitor?.isNativePlatform?.() === true;
  // mobile-app = solo APK/Capacitor (layout flex fisso). Il browser stretto usa @media in mobile.css.
  if (native) document.documentElement.classList.add('mobile-app');

  const sidebar = $('#sidebar');
  const overlay = $('#sidebar-overlay');

  function openSidebar() {
    sidebar?.classList.add('is-open');
    overlay?.classList.add('is-visible');
    overlay?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
  }
  function closeSidebar() {
    sidebar?.classList.remove('is-open');
    overlay?.classList.remove('is-visible');
    overlay?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
  }

  $('#btn-menu-mobile')?.addEventListener('click', openSidebar);
  overlay?.addEventListener('click', closeSidebar);

  $$('.bottom-nav-btn[data-mobile-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.mobileView;
      if (v === 'filtri') {
        openSidebar();
        return;
      }
      closeSidebar();
      mostraVista(v);
    });
  });

  $('#btn-mobile-add')?.addEventListener('click', () => {
    closeSidebar();
    apriFormNuovaOfferta();
  });

  if (native) {
    closeSidebar();
    mostraVista('lista');
  }
}

/* ----------------------------- Navigazione categorie ----------------------------- */
function setupCategorieNav() {
  const nav = $('#nav-categorie');
  if (!nav || !fonti) return;
  const tabs = [
    { id: 'tutti', label: 'Tutte', icon: '📋' },
    ...(fonti.tipi || []).map((t) => ({
      id: t.id,
      label: t.nome,
      icon: t.id === 'lavoro' ? '💼' : t.id === 'concorso' ? '🏛️' : '♿',
    })),
  ];
  nav.innerHTML = tabs
    .map(
      (t) =>
        `<button type="button" class="tab-cat ${t.id === 'tutti' ? 'active' : ''}" data-cat="${t.id}">${t.icon} ${escapeHtml(t.label)}</button>`
    )
    .join('');

  nav.querySelectorAll('.tab-cat').forEach((btn) => {
    btn.addEventListener('click', () => {
      categoriaAttiva = btn.dataset.cat;
      nav.querySelectorAll('.tab-cat').forEach((b) => b.classList.toggle('active', b === btn));
      if (categoriaAttiva !== 'tutti') {
        $$('#filtro-tipo input').forEach((i) => {
          i.checked = i.value === categoriaAttiva;
        });
      } else {
        $$('#filtro-tipo input').forEach((i) => (i.checked = true));
      }
      renderOfferte();
    });
  });
}

/* ----------------------------- Filtri ----------------------------- */
function setupFiltri() {
  const tipoEl = $('#filtro-tipo');
  fonti.tipi.forEach((t) => {
    const label = document.createElement('label');
    label.className = 'chip';
    label.innerHTML = `<input type="checkbox" value="${t.id}" checked /> ${escapeHtml(t.nome)}`;
    tipoEl.appendChild(label);
  });

  const areaEl = $('#filtro-area');
  fonti.aree.forEach((a) => {
    const label = document.createElement('label');
    label.className = 'chip';
    label.innerHTML = `<input type="checkbox" value="${a.id}" checked /> ${a.icona} ${escapeHtml(a.nome)}`;
    areaEl.appendChild(label);
  });

  const filtroSiciliaEl = $('#filtro-sicilia');
  if (filtroSiciliaEl) {
    const salvato = localStorage.getItem(STORAGE_FILTRO_SICILIA);
    filtroSiciliaEl.checked = salvato === null ? true : salvato === '1';
    filtroSiciliaEl.addEventListener('change', () => {
      localStorage.setItem(STORAGE_FILTRO_SICILIA, filtroSiciliaEl.checked ? '1' : '0');
      syncCategoriaDaFiltri();
      renderOfferte();
    });
  }

  ['filtro-testo', 'filtro-solo-scadenze', 'vista-raggruppata'].forEach((id) => {
    $(`#${id}`)?.addEventListener('input', () => {
      syncCategoriaDaFiltri();
      renderOfferte();
    });
    $(`#${id}`)?.addEventListener('change', () => {
      syncCategoriaDaFiltri();
      renderOfferte();
    });
  });

  $$('#filtro-tipo input, #filtro-area input, #filtro-stato input').forEach((el) => {
    el.addEventListener('change', () => {
      syncCategoriaDaFiltri();
      renderOfferte();
    });
  });

  $('#filtro-ordinamento')?.addEventListener('change', () => {
    const v = $('#filtro-ordinamento')?.value;
    if (ORDINI.includes(v)) localStorage.setItem(STORAGE_ORDINAMENTO, v);
    renderOfferte();
  });

  const ordSalvato = localStorage.getItem(STORAGE_ORDINAMENTO);
  if (ORDINI.includes(ordSalvato) && $('#filtro-ordinamento')) {
    $('#filtro-ordinamento').value = ordSalvato;
  }

  $('#btn-reset')?.addEventListener('click', resetFiltri);
  $('#btn-aggiorna-online')?.addEventListener('click', controllaAggiornamentoOnline);
}

function syncCategoriaDaFiltri() {
  const checked = [...$$('#filtro-tipo input:checked')].map((i) => i.value);
  const nav = $('#nav-categorie');
  if (!nav) return;
  if (checked.length === fonti.tipi.length) categoriaAttiva = 'tutti';
  else if (checked.length === 1) categoriaAttiva = checked[0];
  else categoriaAttiva = 'multi';
  nav.querySelectorAll('.tab-cat').forEach((b) => {
    if (categoriaAttiva === 'multi') {
      b.classList.toggle('active', b.dataset.cat !== 'tutti' && checked.includes(b.dataset.cat));
    } else {
      b.classList.toggle('active', b.dataset.cat === categoriaAttiva);
    }
  });
}

function resetFiltri() {
  $('#filtro-testo').value = '';
  $('#filtro-solo-scadenze').checked = false;
  $('#filtro-sicilia').checked = true;
  localStorage.setItem(STORAGE_FILTRO_SICILIA, '1');
  $$('#filtro-tipo input, #filtro-area input').forEach((i) => (i.checked = true));
  $$('#filtro-stato input').forEach((i) => {
    i.checked = i.value !== 'chiuso';
  });
  $('#vista-raggruppata').checked = true;
  if ($('#filtro-ordinamento')) {
    $('#filtro-ordinamento').value = 'urgente';
    localStorage.setItem(STORAGE_ORDINAMENTO, 'urgente');
  }
  categoriaAttiva = 'tutti';
  $('#nav-categorie')?.querySelectorAll('.tab-cat').forEach((b) => {
    b.classList.toggle('active', b.dataset.cat === 'tutti');
  });
  renderOfferte();
}

/* ----------------------------- Notifiche push ----------------------------- */
function setupPushSettings() {
  const btn = $('#btn-attiva-push');
  const btnDisattiva = $('#btn-disattiva-push');
  const statusEl = $('#push-status');
  if (!btn || !btnDisattiva || !statusEl) return;

  const ids = {
    offerte_lavoro: '#push-cat-lavoro',
    concorsi_pubblici: '#push-cat-concorso',
    categorie_protette: '#push-cat-protetta',
  };

  let prefs = getPushPreferences();
  const aggiornaUi = () => {
    statusEl.textContent = describePushStatus(prefs);
    btn.textContent = prefs.enabled ? 'Aggiorna notifiche Android' : 'Attiva notifiche Android';
    btnDisattiva.disabled = !prefs.enabled;
  };

  Object.entries(ids).forEach(([topic, selector]) => {
    const input = $(selector);
    if (!input) return;
    input.checked = !!prefs.categorie?.[topic];
    input.addEventListener('change', () => {
      prefs = { ...prefs, categorie: { ...prefs.categorie, [topic]: input.checked } };
      savePushPreferences(prefs);
      aggiornaUi();
    });
  });

  aggiornaUi();
  if (!isPushSupported()) {
    btn.disabled = true;
    btnDisattiva.disabled = true;
    btn.textContent = 'Push disponibili solo su Android';
    return;
  }

  if (prefs.enabled) {
    applyPushPreferences(prefs, showToast)
      .then((result) => {
        prefs = result.prefs;
        aggiornaUi();
      })
      .catch((err) => {
        console.warn('Sync push iniziale non riuscita', err);
        aggiornaUi();
      });
  }

  btn.addEventListener('click', async () => {
    prefs = { ...prefs, enabled: true };
    btn.disabled = true;
    const testoOrig = btn.textContent;
    btn.textContent = '⏳ Attivazione…';
    try {
      const result = await applyPushPreferences(prefs, showToast);
      prefs = result.prefs;
      aggiornaUi();
      showToast('Notifiche Android attivate per le categorie selezionate.');
    } catch (err) {
      console.error(err);
      prefs = { ...prefs, enabled: false };
      savePushPreferences(prefs);
      aggiornaUi();
      showToast(err.message || 'Attivazione notifiche non riuscita.');
    } finally {
      btn.disabled = false;
      btn.textContent = testoOrig || 'Attiva notifiche Android';
      aggiornaUi();
    }
  });

  btnDisattiva.addEventListener('click', async () => {
    const prefsOff = { ...prefs, enabled: false };
    btn.disabled = true;
    btnDisattiva.disabled = true;
    const testoOrig = btnDisattiva.textContent;
    btnDisattiva.textContent = '⏳ Disattivazione…';
    try {
      const result = await applyPushPreferences(prefsOff, showToast);
      prefs = result.prefs;
      aggiornaUi();
      showToast('Notifiche Android disattivate.');
    } catch (err) {
      console.error(err);
      aggiornaUi();
      showToast(err.message || 'Disattivazione notifiche non riuscita.');
    } finally {
      btn.disabled = false;
      btnDisattiva.textContent = testoOrig || 'Disattiva notifiche Android';
      aggiornaUi();
    }
  });
}

/* ----------------------------- Portali ----------------------------- */
function setupPortali() {
  const ul = $('#lista-portali');
  if (!ul || !fonti) return;
  const links = [];
  fonti.tipi.forEach((t) => (t.portali || []).forEach((p) => links.push(p)));
  ul.innerHTML = links
    .slice(0, 8)
    .map((p) => `<li><a href="${p.url}" target="_blank" rel="noopener">${escapeHtml(p.nome)} ↗</a></li>`)
    .join('');
}

function setupPortaliSicilia() {
  const ul = $('#lista-portali-sicilia');
  const sic = fonti?.sicilia;
  if (!ul || !sic?.portali) return;
  ul.innerHTML = sic.portali
    .map((p) => `<li><a href="${p.url}" target="_blank" rel="noopener">${escapeHtml(p.nome)} ↗</a></li>`)
    .join('');
}

/* ----------------------------- Eventi ----------------------------- */
function setupEventi() {
  $('#btn-lista')?.addEventListener('click', () => mostraVista('lista'));
  $('#btn-calendario')?.addEventListener('click', () => mostraVista('calendario'));
  $('#btn-preferiti')?.addEventListener('click', () => mostraVista('preferiti'));
  $('#btn-export')?.addEventListener('click', exportCSV);
  $('#btn-nuovo-bando')?.addEventListener('click', () => apriFormNuovaOfferta());
  $('#btn-nuovo-bando-side')?.addEventListener('click', () => apriFormNuovaOfferta());
  $('#btn-scopri-portali')?.addEventListener('click', () => {
    $('#panel-scopri')?.scrollIntoView({ behavior: 'smooth' });
  });
  $('#modal-chiudi')?.addEventListener('click', () => $('#modal-bando').close());
  $('#modal-preferito')?.addEventListener('click', togglePreferitoModal);
  $('#form-chiudi')?.addEventListener('click', () => $('#modal-form').close());

  document.addEventListener('click', (e) => {
    const card = e.target.closest('.bando-card');
    if (!card) return;
    if (e.target.closest('.btn-fav')) {
      e.preventDefault();
      e.stopPropagation();
      togglePreferito(card.dataset.id);
      return;
    }
    if (e.target.closest('.btn-card-share')) {
      e.preventDefault();
      e.stopPropagation();
      condividiOfferta(card.dataset.id);
      return;
    }
    if (e.target.closest('.btn-card-link') || e.target.closest('a.card-titolo-link')) return;
    if (e.target.closest('.btn-card-dettagli') || e.target.closest('.bando-card-body')) {
      apriModale(card.dataset.id);
    }
  });

  document.addEventListener('click', (e) => {
    const riga = e.target.closest('.scadenza-riga');
    if (riga && !e.target.closest('a')) apriModale(riga.dataset.id);
  });

  $('#modal-condivide')?.addEventListener('click', () => {
    if (offertaCorrente) condividiOfferta(offertaCorrente.id);
  });

  const btnStampa = $('#modal-stampa');
  if (isNativeApp()) {
    if (btnStampa) btnStampa.hidden = true;
  } else {
    btnStampa?.addEventListener('click', () => {
      if (offertaCorrente) stampaScheda(offertaCorrente);
    });
  }
}

function mostraVista(vista) {
  $('#vista-lista').hidden = vista !== 'lista';
  $('#vista-calendario').hidden = vista !== 'calendario';
  $('#vista-preferiti').hidden = vista !== 'preferiti';
  $('#btn-lista').hidden = vista === 'lista';
  $('#btn-calendario').hidden = vista === 'calendario';
  $('#btn-preferiti').hidden = vista === 'preferiti';
  $$('.bottom-nav-btn[data-mobile-view]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mobileView === vista);
  });
  if (vista === 'calendario') renderCalendario();
  if (vista === 'preferiti') renderPreferiti();
  if (vista === 'lista') renderOfferte();
  const navCat = $('#nav-categorie');
  if (navCat) navCat.hidden = vista !== 'lista';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ----------------------------- Filtri/dati ----------------------------- */
function isPerSicilia(o) {
  const sede = (o.sede || '').toLowerCase();
  const modalita = (o.modalita || '').toLowerCase();
  const testo = [
    o.nome,
    o.ente,
    o.descrizione_breve,
    o.sede,
    o.partecipazione,
  ]
    .join(' ')
    .toLowerCase();

  if (o.regioni_ammesse?.includes('sicilia')) return true;
  if (sede.includes('sicil') || sede.includes('messina')) return true;
  if (SEGNALI_SICILIA.some((s) => testo.includes(s))) return true;
  if (modalita.includes('remoto') || sede.includes('remoto') || sede.includes('smart working')) return true;
  return false;
}

/** Filtro località: lavoro → Messina (+ remoto); categorie protette → Sicilia; concorsi → sempre visibili */
function passaFiltroLocalita(o) {
  const soloLocalita = $('#filtro-sicilia')?.checked;
  if (!soloLocalita) return true;
  if (o.tipo === 'concorso') return true;
  if (o.tipo === 'lavoro') return isPerMessinaLavoro(o, profilo);
  return isPerSicilia(o);
}

function badgeLocalita(o) {
  if (o.tipo === 'lavoro') {
    return isPerMessinaLavoro(o, profilo) ? '<span class="pill-sicilia">✓ Messina/Remoto</span>' : '';
  }
  return isPerSicilia(o) ? '<span class="pill-sicilia">✓ Sicilia/Remoto</span>' : '';
}

function getFiltrate(lista = offerte) {
  const testo = ($('#filtro-testo')?.value || '').toLowerCase().trim();
  const tipi = [...$$('#filtro-tipo input:checked')].map((i) => i.value);
  const aree = [...$$('#filtro-area input:checked')].map((i) => i.value);
  const stati = [...$$('#filtro-stato input:checked')].map((i) => i.value);
  const soloFuture = $('#filtro-solo-scadenze')?.checked;

  return lista.filter((o) => {
    if (!passaFiltroProfilo(o, profilo)) return false;
    if (isNascostaPerScadenza(o, isPreferito(o.id))) return false;
    if (!passaFiltroLocalita(o)) return false;
    if (!tipi.includes(o.tipo)) return false;
    if (!stati.includes(statoEffettivo(o))) return false;
    if (!(o.aree || []).some((a) => aree.includes(a))) return false;
    if (testo) {
      const hay = [
        o.nome,
        o.ente,
        o.descrizione_breve,
        o.partecipazione,
        o.sede,
        o.contratto,
        ...(o.profili || []),
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(testo)) return false;
    }
    if (soloFuture) {
      const prossima = getProssimaScadenza(o);
      if (!prossima || prossima < oggi()) return false;
    }
    return true;
  });
}

function getOrdinamento() {
  const el = $('#filtro-ordinamento');
  const v = el?.value || localStorage.getItem(STORAGE_ORDINAMENTO) || 'urgente';
  return ORDINI.includes(v) ? v : 'urgente';
}

function ordina(lista, modo) {
  const arr = [...lista];
  if (modo === 'nome') return arr.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'));
  if (modo === 'recente') {
    return arr.sort((a, b) => (b.data_pubblicazione || '').localeCompare(a.data_pubblicazione || ''));
  }
  if (modo === 'scadenza') {
    return arr.sort((a, b) => {
      const da = getProssimaScadenza(a);
      const db = getProssimaScadenza(b);
      if (!da && !db) return (a.nome || '').localeCompare(b.nome || '', 'it');
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
  }
  return arr.sort((a, b) => {
    const pa = prioritaUrgente(a);
    const pb = prioritaUrgente(b);
    if (pa !== pb) return pa - pb;
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });
}

function prioritaUrgente(o) {
  if (o.stato === 'chiuso') return 100000;
  const prossima = getProssimaScadenza(o);
  if (!prossima) {
    if (o.stato === 'in_arrivo') return 60000;
    if (o.stato === 'aperto') return 50000;
    return 70000;
  }
  const g = giorniAllaScadenza(prossima);
  if (g >= 0) return g;
  return 90000 + Math.abs(g);
}

function getFiltrateOrdinate(lista = offerte) {
  return ordina(getFiltrate(lista), getOrdinamento());
}

/* ----------------------------- Date/util ----------------------------- */
function oggi() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function parseData(str) {
  if (!str) return null;
  const d = new Date(str + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}
function getProssimaScadenza(o) {
  const date = (o.scadenze || []).map((s) => parseData(s.data)).filter((d) => d && d >= oggi());
  if (!date.length) {
    const passate = (o.scadenze || []).map((s) => parseData(s.data)).filter(Boolean);
    if (passate.length) return passate.sort((a, b) => b - a)[0];
    return null;
  }
  return date.sort((a, b) => a - b)[0];
}
function isScaduta(o) {
  return isScadutaPerData(o) || (o.stato === 'chiuso' && !ultimaScadenzaConcorso(o));
}

function ultimaScadenzaConcorso(o) {
  const date = (o.scadenze || []).map((s) => parseData(s.data)).filter(Boolean);
  if (!date.length) return null;
  return date.sort((a, b) => b - a)[0];
}
function formatData(d) {
  if (!d) return '—';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}
function giorniAllaScadenza(d) {
  if (!d) return null;
  return Math.ceil((d - oggi()) / (1000 * 60 * 60 * 24));
}
function labelTipo(id) {
  return fonti?.tipi.find((t) => t.id === id)?.nome || id;
}
function labelStato(s) {
  return { aperto: 'Aperto', in_arrivo: 'In arrivo', chiuso: 'Chiuso' }[s] || s;
}
function labelOrdinamento(id) {
  return { urgente: 'Più urgenti', scadenza: 'Data scadenza', nome: 'Titolo A→Z', recente: 'Più recenti' }[id] || id;
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
function areaTags(o) {
  return (o.aree || [])
    .map((id) => fonti?.aree.find((a) => a.id === id))
    .filter(Boolean)
    .map((a) => `<span class="settore-tag">${a.icona} ${escapeHtml(a.nome)}</span>`)
    .join('');
}
function isNuova(o) {
  return isNewFromPush(o.id);
}
async function syncNewBadgeOnline() {
  try {
    const res = await fetch('data/aggiornamento.json');
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg.offerte_url) await syncNewBadgeFromNovitaOnline(cfg.offerte_url, cfg.timeout_secondi || 12);
  } catch (err) {
    console.warn('Sync badge New non riuscita', err);
  }
}

/* ----------------------------- Render lista ----------------------------- */
function renderOfferte() {
  const filtrate = getFiltrateOrdinate();
  const container = $('#lista-offerte');
  const empty = $('#nessun-risultato');
  const customCount = offerte.filter((o) => o.fonte === 'utente').length;
  const ordLabel = labelOrdinamento(getOrdinamento());

  $('#stats-bar').innerHTML = `
    <strong>${filtrate.length}</strong> offerte visualizzate su <strong>${offerte.length}</strong> totali
    ${customCount ? ` · <span class="stats-custom">${customCount} aggiunte da te</span>` : ''}
    <span class="stats-ordina-label"> · Ordine: <strong>${ordLabel}</strong></span>
  `;

  if (!filtrate.length) {
    container.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const raggruppa = $('#vista-raggruppata')?.checked;
  if (raggruppa) {
    container.className = 'bandi-per-categoria';
    container.innerHTML = renderRaggruppato(filtrate);
  } else {
    container.className = 'bandi-grid';
    container.innerHTML = filtrate.map((o) => cardHTML(o)).join('');
  }
}

function renderRaggruppato(filtrate) {
  const gruppi = {};
  filtrate.forEach((o) => {
    if (!gruppi[o.tipo]) gruppi[o.tipo] = [];
    gruppi[o.tipo].push(o);
  });
  const modo = getOrdinamento();
  return TIPI_ORDINE.filter((tipo) => gruppi[tipo]?.length)
    .map((tipo) => {
      const sorted = ordina(gruppi[tipo], modo);
      return `
      <section class="gruppo-categoria">
        <h2 class="gruppo-titolo">
          <span class="pill pill-${tipo}">${escapeHtml(labelTipo(tipo))}</span>
          <span class="gruppo-count">${sorted.length} offerte</span>
        </h2>
        <div class="bandi-grid">${sorted.map((o) => cardHTML(o)).join('')}</div>
      </section>`;
    })
    .join('');
}

function cardHTML(o, opts = {}) {
  const { showPreferitiExpiredBadge = false } = opts;
  const prossima = getProssimaScadenza(o);
  const giorni = prossima ? giorniAllaScadenza(prossima) : null;
  const futura = prossima && prossima >= oggi();
  const scaduto = isScaduta(o);

  let scadenzaClass = 'scadenza-neutra';
  let scadenzaLabel = 'Scadenza';
  let scadenzaTesto = 'Da definire – consulta l\'annuncio';

  if (prossima) {
    scadenzaTesto = formatData(prossima);
    if (futura) {
      if (giorni <= 15) scadenzaClass = 'urgente';
      else if (giorni <= 45) scadenzaClass = 'soon';
      scadenzaTesto += ` · tra ${giorni} giorni`;
    } else {
      scadenzaClass = 'scadenza-passata';
      scadenzaLabel = 'Ultima scadenza';
      scadenzaTesto += ' (passata)';
    }
  } else if (o.stato === 'aperto') {
    scadenzaTesto = 'Candidatura aperta – senza data fissa';
    scadenzaClass = 'soon';
  }

  const pref = isPreferito(o.id);
  const link = (o.link_ufficiale || '').trim();
  const hasLink = link.startsWith('http');
  const newTitle = `Nuova offerta: visibile per ${GIORNI_BADGE_NEW} giorni`;
  const badgeNew = isNuova(o) ? `<span class="pill-new" title="${newTitle}">New</span>` : '';
  const badgeSicilia = badgeLocalita(o);
  const badgeCustom = o.fonte === 'utente' ? '<span class="pill-custom">Tua</span>' : '';
  const badgeArchiviato = o.archiviato ? '<span class="pill-custom">Archiviata</span>' : '';
  const badgeScaduto =
    showPreferitiExpiredBadge && scaduto ? '<span class="pill pill-inline pill-scaduto">Scaduta</span>' : '';

  return `
    <article class="bando-card" role="listitem" data-id="${escapeHtml(o.id)}">
      <div class="bando-card-header">
        <div class="pills-row">
          <span class="pill pill-${o.tipo}">${escapeHtml(labelTipo(o.tipo))}</span>
          ${badgeNew}${badgeSicilia}${badgeCustom}${badgeArchiviato}${badgeScaduto}
          <span class="stato-badge stato-${o.stato}">${labelStato(o.stato)}</span>
        </div>
        <button type="button" class="btn-fav ${pref ? 'active' : ''}" aria-label="Preferito">${pref ? '★' : '☆'}</button>
      </div>

      <div class="bando-card-body">
        <h3 class="card-titolo">
          ${
            hasLink
              ? `<a class="card-titolo-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(o.nome)} ↗</a>`
              : escapeHtml(o.nome)
          }
        </h3>
        <p class="programma">${escapeHtml(o.ente)}${o.sede ? ' · ' + escapeHtml(o.sede) : ''}</p>

        <p class="card-descrizione">${escapeHtml(o.descrizione_breve)}</p>

        <div class="card-info-row ${scadenzaClass}">
          <span class="card-info-label">📅 ${scadenzaLabel}</span>
          <span class="card-info-value">${escapeHtml(scadenzaTesto)}</span>
        </div>

        <div class="card-info-row card-partecipazione">
          <span class="card-info-label">📌 Requisiti</span>
          <span class="card-info-value">${escapeHtml(o.partecipazione)}</span>
        </div>

        <div class="bando-meta">${areaTags(o)}</div>
      </div>

      <footer class="card-footer">
        <button type="button" class="btn btn-ghost btn-sm btn-card-dettagli">Scheda completa</button>
        <div class="card-footer-actions">
          <button type="button" class="btn btn-share btn-sm btn-card-share" data-id="${escapeHtml(o.id)}" aria-label="Condividi">🔗 Condividi</button>
          ${
            hasLink
              ? `<a class="btn btn-primary btn-sm btn-card-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Candidati →</a>`
              : ''
          }
        </div>
      </footer>
    </article>
  `;
}

/* ----------------------------- Condivisione ----------------------------- */
function isShareCancelled(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('cancel') || msg.includes('annull') || msg.includes('dismiss');
}

async function shareContent(payload) {
  const { title, text, url } = payload;
  const fullText = [text, url].filter(Boolean).join('\n\n');
  if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.nativePromise) {
    try {
      await window.Capacitor.nativePromise('Share', 'share', { title, text, url: url || undefined });
      return { ok: true, method: 'native' };
    } catch (err) {
      if (isShareCancelled(err)) return { ok: false, cancelled: true };
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: url || undefined });
      return { ok: true, method: 'web-share' };
    } catch (err) {
      if (isShareCancelled(err)) return { ok: false, cancelled: true };
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(fullText);
    return { ok: true, method: 'clipboard' };
  }
  return { ok: false };
}

async function condividiOfferta(id) {
  const o = offerte.find((x) => x.id === id);
  if (!o) return;
  const prossima = getProssimaScadenza(o);
  const scadenza = prossima ? formatData(prossima) : 'Da verificare sull\'annuncio';
  const text = [
    `💼 ${o.nome}`,
    o.ente ? `Ente/Azienda: ${o.ente}` : '',
    `Tipo: ${labelTipo(o.tipo)} · Stato: ${labelStato(o.stato)}`,
    `Sede: ${o.sede || '—'} · Scadenza: ${scadenza}`,
    '',
    o.descrizione_breve || '',
    '',
    '— App Lavoro & Concorsi per Me © Maurizio Tavilla',
  ]
    .filter((l) => l !== '')
    .join('\n');
  try {
    const result = await shareContent({ title: o.nome, text, url: (o.link_ufficiale || '').startsWith('http') ? o.link_ufficiale : '' });
    if (result.cancelled) return;
    if (result.method?.startsWith('clipboard')) showToast('Testo copiato negli appunti.');
    else if (result.ok) showToast('Condivisione avviata.');
    else showToast('Impossibile condividere su questo dispositivo.');
  } catch (err) {
    console.error(err);
    showToast('Impossibile condividere. Riprova.');
  }
}

/* ----------------------------- Modale dettaglio ----------------------------- */
function apriModale(id) {
  const o = offerte.find((x) => x.id === id);
  if (!o) return;
  offertaCorrente = o;

  const link = (o.link_ufficiale || '').trim();
  const badgeNew = isNuova(o) ? ' <span class="pill-new pill-new-inline">New</span>' : '';

  $('#modal-titolo').innerHTML = link.startsWith('http')
    ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(o.nome)} ↗</a>`
    : escapeHtml(o.nome);
  $('#modal-programma').innerHTML = `${escapeHtml(o.ente || '')}${o.sede ? ' · ' + escapeHtml(o.sede) : ''}${badgeNew}`;
  $('#modal-livello').className = `pill pill-${o.tipo}`;
  $('#modal-livello').textContent = labelTipo(o.tipo);
  $('#modal-link').href = link || '#';
  $('#modal-link').hidden = !link.startsWith('http');

  const checklistState = getChecklistState(o.id);

  $('#modal-body').innerHTML = `
    <section class="modal-intro">
      <h3>Di cosa si tratta</h3>
      <p>${escapeHtml(o.descrizione_breve)}</p>
    </section>

    <section class="modal-intro">
      <h3>Requisiti di partecipazione</h3>
      <p>${escapeHtml(o.partecipazione)}</p>
    </section>

    <div class="info-grid">
      <div class="info-box"><strong>Retribuzione</strong><span class="info-valore">${escapeHtml(o.retribuzione || '—')}</span></div>
      <div class="info-box"><strong>Contratto</strong><span class="info-valore">${escapeHtml(o.contratto || '—')}</span></div>
      <div class="info-box"><strong>Stato</strong><span class="info-valore stato-${o.stato}">${labelStato(o.stato)}</span></div>
      <div class="info-box"><strong>Sede</strong><span class="info-valore">${escapeHtml(o.sede || '—')}</span></div>
      ${o.modalita ? `<div class="info-box"><strong>Modalità</strong><span class="info-valore">${escapeHtml(o.modalita)}</span></div>` : ''}
      ${o.data_pubblicazione ? `<div class="info-box"><strong>Pubblicata</strong><span class="info-valore">${escapeHtml(formatData(parseData(o.data_pubblicazione)))}</span></div>` : ''}
    </div>

    <section>
      <h3>Scadenze e fasi</h3>
      <ul class="lista-scadenze">
        ${(o.scadenze || [])
          .map((s) => {
            const d = parseData(s.data);
            const cls = d && d < oggi() ? 'scaduta' : d && giorniAllaScadenza(d) <= 15 ? 'urgente' : '';
            return `<li class="${cls}"><strong>${escapeHtml(s.fase)}</strong>: ${
              s.data ? formatData(d) : 'Da definire'
            }${s.note ? ` <em>(${escapeHtml(s.note)})</em>` : ''}</li>`;
          })
          .join('') || '<li>Nessuna scadenza indicata – verifica l\'annuncio ufficiale</li>'}
      </ul>
    </section>

    <section>
      <h3>Requisiti</h3>
      <ul>${(o.requisiti || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('') || '<li>Vedi annuncio ufficiale</li>'}</ul>
    </section>

    <section>
      <h3>Documenti da preparare</h3>
      <ul>${(o.documenti || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('') || '<li>Vedi annuncio ufficiale</li>'}</ul>
    </section>

    ${
      o.profili?.length
        ? `<section><h3>Profili richiesti</h3><ul>${o.profili.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></section>`
        : ''
    }

    <section>
      <h3>Checklist per la candidatura (salvata sul tuo PC)</h3>
      <ul class="checklist" id="modal-checklist">
        ${(o.checklist || [])
          .map(
            (item, i) => `
          <li>
            <input type="checkbox" id="chk-${escapeHtml(o.id)}-${i}" data-offerta="${escapeHtml(o.id)}" data-idx="${i}" ${checklistState[i] ? 'checked' : ''} />
            <label for="chk-${escapeHtml(o.id)}-${i}">${escapeHtml(item)}</label>
          </li>`
          )
          .join('')}
      </ul>
    </section>
    ${o.fonte === 'utente' ? `<p class="modal-nota-user">Offerta aggiunta da te il ${escapeHtml(o.aggiunto_il || '')}. <button type="button" class="btn-link" id="btn-elimina-offerta">Rimuovi</button></p>` : ''}
  `;

  $$('#modal-checklist input').forEach((inp) => {
    inp.addEventListener('change', () => salvaChecklistItem(inp.dataset.offerta, inp.dataset.idx, inp.checked));
  });
  $('#btn-elimina-offerta')?.addEventListener('click', () => {
    if (confirm('Rimuovere questa offerta dalla tua lista?')) {
      deleteCustomOfferta(o.id);
      $('#modal-bando').close();
      ricarica();
    }
  });

  aggiornaBtnPreferitoModal();
  $('#modal-bando').showModal();
  requestAnimationFrame(() => {
    const body = $('#modal-bando .modal-body');
    if (body) body.scrollTop = 0;
  });
}

async function ricarica() {
  const data = await loadAllOfferte();
  offerte = data.offerte;
  renderOfferte();
}

function aggiornaBtnPreferitoModal() {
  const btn = $('#modal-preferito');
  if (!btn || !offertaCorrente) return;
  btn.textContent = isPreferito(offertaCorrente.id) ? '★ Rimuovi dai preferiti' : '☆ Salva nei preferiti';
}

/* ----------------------------- Form nuova offerta ----------------------------- */
function setupFormNuovaOfferta() {
  const form = $('#form-nuovo-bando');
  if (!form || !fonti) return;

  const areeField = $('#form-aree');
  areeField.innerHTML = fonti.aree
    .map(
      (a) => `<label class="chip"><input type="checkbox" name="aree" value="${a.id}" /> ${a.icona} ${escapeHtml(a.nome)}</label>`
    )
    .join('');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const nome = fd.get('nome')?.toString().trim();
    if (!nome) return alert('Inserisci il titolo dell\'offerta.');
    const aree = [...form.querySelectorAll('input[name="aree"]:checked')].map((i) => i.value);
    if (!aree.length) return alert('Seleziona almeno un\'area professionale.');

    const scadenzaData = fd.get('scadenza_data')?.toString() || null;
    const scadenzaFase = fd.get('scadenza_fase')?.toString() || 'Invio candidatura';
    const tipo = fd.get('tipo')?.toString() || 'lavoro';

    const nuova = enrichOfferta({
      id: slugId(nome),
      nome,
      ente: fd.get('ente')?.toString() || 'Da definire',
      tipo,
      aree,
      stato: fd.get('stato')?.toString() || 'aperto',
      sede: fd.get('sede')?.toString() || 'Messina',
      modalita: '',
      contratto: fd.get('contratto')?.toString() || '',
      retribuzione: fd.get('retribuzione')?.toString() || '',
      descrizione_breve: fd.get('descrizione_breve')?.toString() || '',
      partecipazione: fd.get('partecipazione')?.toString() || '',
      data_pubblicazione: fd.get('data_pubblicazione')?.toString() || '',
      regioni_ammesse: ['sicilia'],
      link_ufficiale: fd.get('link_ufficiale')?.toString().trim() || '',
      scadenze: scadenzaData ? [{ fase: scadenzaFase, data: scadenzaData, note: '' }] : [],
      requisiti: (fd.get('requisiti')?.toString() || '').split('\n').map((s) => s.trim()).filter(Boolean),
      documenti: [],
      profili: [],
      checklist: ['Leggere l\'annuncio ufficiale', 'Aggiornare il CV', 'Inviare la candidatura'],
      fonte: 'utente',
    });

    saveCustomOfferta(nuova);
    $('#modal-form').close();
    form.reset();
    await ricarica();
    apriModale(nuova.id);
  });
}

function apriFormNuovaOfferta() {
  $('#modal-form').showModal();
  requestAnimationFrame(() => {
    const body = $('#modal-form .modal-body');
    if (body) body.scrollTop = 0;
  });
}

/* ----------------------------- Preferiti ----------------------------- */
function isPreferito(id) {
  const live = offerte.find((o) => o.id === id);
  return isPreferitoSalvato(live || id, offerte);
}
function togglePreferito(id) {
  const offerta = offerte.find((o) => o.id === id);
  if (!offerta) {
    showToast('Offerta non trovata nell\'elenco attuale.');
    return;
  }
  const result = togglePreferitoSalvato(offerta, offerte);
  if (result.message) showToast(result.message);
  aggiornaContatorePreferiti();
  renderOfferte();
  if (!$('#vista-preferiti')?.hidden) renderPreferiti();
}
function togglePreferitoModal() {
  if (!offertaCorrente) return;
  togglePreferito(offertaCorrente.id);
  aggiornaBtnPreferitoModal();
}
function aggiornaContatorePreferiti() {
  const el = $('#count-preferiti');
  if (el) el.textContent = String(contaPreferiti());
}
function renderPreferiti() {
  const lista = ordina(risolviPreferitiPerVista(offerte), getOrdinamento());
  const grid = $('#lista-preferiti');
  const empty = $('#preferiti-vuoti');
  if (!lista.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.className = 'bandi-grid';
  grid.innerHTML = lista.map((o) => cardHTML(o, { showPreferitiExpiredBadge: true })).join('');
}

/* ----------------------------- Checklist ----------------------------- */
function getChecklistState(id) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_CHECKLIST) || '{}')[id] || {};
  } catch {
    return {};
  }
}
function salvaChecklistItem(id, idx, checked) {
  const all = JSON.parse(localStorage.getItem(STORAGE_CHECKLIST) || '{}');
  if (!all[id]) all[id] = {};
  all[id][idx] = checked;
  localStorage.setItem(STORAGE_CHECKLIST, JSON.stringify(all));
}

/* ----------------------------- Calendario ----------------------------- */
function renderCalendario() {
  const container = $('#calendario-scadenze');
  const eventi = [];
  getFiltrateOrdinate().forEach((o) => {
    (o.scadenze || []).forEach((s) => {
      const d = parseData(s.data);
      if (!d) return;
      if (d < oggi() && !isPreferito(o.id)) return;
      eventi.push({ data: d, offerta: o, fase: s.fase, note: s.note, futura: d >= oggi() });
    });
  });
  eventi.sort((a, b) => a.data - b.data);

  if (!eventi.length) {
    container.innerHTML = '<p class="empty-state">Nessuna scadenza nelle offerte filtrate. Molti annunci di lavoro non hanno una data fissa.</p>';
    return;
  }
  const futuri = eventi.filter((e) => e.futura);
  const passati = eventi.filter((e) => !e.futura).slice(-5);
  container.innerHTML =
    (futuri.length ? `<h3 class="cal-sub">Prossime scadenze</h3>${renderEventiCal(futuri)}` : '') +
    (passati.length ? `<h3 class="cal-sub">Scadenze recenti</h3>${renderEventiCal(passati)}` : '');
}

function renderEventiCal(items) {
  return items
    .map(
      (e) => `
    <div class="scadenza-riga ${e.futura ? '' : 'passata'}" data-id="${escapeHtml(e.offerta.id)}" role="button" tabindex="0">
      <span class="scadenza-data">${formatData(e.data)}</span>
      <div>
        <strong>${escapeHtml(e.offerta.nome)}</strong>
        <span class="pill pill-${e.offerta.tipo}" style="font-size:0.65rem;margin-left:0.35rem">${escapeHtml(labelTipo(e.offerta.tipo))}</span><br/>
        <small>${escapeHtml(e.fase)}${e.note ? ' – ' + escapeHtml(e.note) : ''}</small>
      </div>
      ${(e.offerta.link_ufficiale || '').startsWith('http') ? `<a href="${escapeHtml(e.offerta.link_ufficiale)}" class="scadenza-link" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a>` : ''}
    </div>`
    )
    .join('');
}

/* ----------------------------- Export CSV ----------------------------- */
function exportCSV() {
  const filtrate = getFiltrateOrdinate();
  const righe = [
    ['Titolo', 'Ente/Azienda', 'Tipo', 'Aree', 'Stato', 'Sede', 'Requisiti', 'Scadenza', 'Link'].join(';'),
  ];
  filtrate.forEach((o) => {
    const prossima = getProssimaScadenza(o);
    righe.push(
      [
        o.nome,
        o.ente,
        labelTipo(o.tipo),
        (o.aree || []).join(', '),
        labelStato(o.stato),
        o.sede,
        o.partecipazione,
        prossima ? formatData(prossima) : '',
        o.link_ufficiale || '',
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';')
    );
  });
  const blob = new Blob(['\ufeff' + righe.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `offerte-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ----------------------------- Stampa / PDF ----------------------------- */
function stampaScheda(o) {
  const link = (o.link_ufficiale || '').trim();
  const scadenze = (o.scadenze || [])
    .map((s) => {
      const d = parseData(s.data);
      return `<li><strong>${escapeHtml(s.fase)}</strong>: ${s.data ? formatData(d) : 'Da definire'}${s.note ? ` (${escapeHtml(s.note)})` : ''}</li>`;
    })
    .join('');
  const lista = (arr, vuoto) =>
    arr && arr.length ? `<ul>${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : `<p>${vuoto}</p>`;

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8" />
  <title>${escapeHtml(o.nome)}</title>
  <style>
    body { font-family: "Segoe UI", system-ui, sans-serif; color:#1a1a1a; line-height:1.5; padding:1.5cm 1.8cm; font-size:11pt; }
    h1 { font-size:1.35rem; margin:0 0 .35rem; }
    h2 { font-size:.95rem; color:#2563eb; border-bottom:1px solid #ddd; padding-bottom:.2rem; margin:1.1rem 0 .4rem; }
    .badge { display:inline-block; padding:.15rem .5rem; border-radius:4px; font-size:.75rem; background:#e8eef5; margin-right:.35rem; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:.5rem 1rem; margin:.5rem 0 1rem; }
    .grid div { padding:.45rem .6rem; background:#f5f7fa; border-radius:4px; font-size:.9rem; }
    .grid strong { display:block; font-size:.72rem; color:#666; text-transform:uppercase; }
    ul { margin:.35rem 0 .5rem 1.1rem; } li { margin-bottom:.25rem; }
    .url { word-break:break-all; color:#2563eb; }
    footer { margin-top:2rem; padding-top:.75rem; border-top:1px solid #ccc; font-size:.75rem; color:#666; text-align:center; }
  </style></head><body>
    <p><strong>Lavoro &amp; Concorsi per Me</strong> · Scheda offerta · ${new Date().toLocaleString('it-IT')}</p>
    <h1>${escapeHtml(o.nome)}</h1>
    <p><span class="badge">${escapeHtml(labelTipo(o.tipo))}</span><span class="badge">${escapeHtml(labelStato(o.stato))}</span> ${escapeHtml(o.ente || '')}</p>
    <h2>Di cosa si tratta</h2><p>${escapeHtml(o.descrizione_breve || '—')}</p>
    <h2>Requisiti di partecipazione</h2><p>${escapeHtml(o.partecipazione || '—')}</p>
    <div class="grid">
      <div><strong>Retribuzione</strong>${escapeHtml(o.retribuzione || '—')}</div>
      <div><strong>Contratto</strong>${escapeHtml(o.contratto || '—')}</div>
      <div><strong>Sede</strong>${escapeHtml(o.sede || '—')}</div>
      <div><strong>Stato</strong>${escapeHtml(labelStato(o.stato))}</div>
    </div>
    <h2>Scadenze</h2><ul>${scadenze || '<li>Nessuna scadenza indicata</li>'}</ul>
    <h2>Requisiti</h2>${lista(o.requisiti, 'Vedi annuncio')}
    <h2>Documenti</h2>${lista(o.documenti, 'Vedi annuncio')}
    <h2>Link ufficiale</h2><p class="url">${link.startsWith('http') ? `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>` : '—'}</p>
    <footer>© 2026 Maurizio Tavilla · Lavoro &amp; Concorsi per Me</footer>
  </body></html>`;

  let frame = document.getElementById('print-frame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'print-frame';
    frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;';
    document.body.appendChild(frame);
  }
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      showToast('Dialogo di stampa aperto. Per il PDF scegli "Salva come PDF".');
    } catch (err) {
      console.warn('Stampa non riuscita', err);
      showToast('Stampa non disponibile su questo dispositivo.');
    }
  }, 400);
}

/* ----------------------------- Toast ----------------------------- */
function showToast(message) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'app-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('is-visible'), 3000);
}

init();
