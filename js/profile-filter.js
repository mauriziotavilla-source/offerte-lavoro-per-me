/**
 * Filtro profilo (stessa logica dello scraper) per l'app web/EXE/APK.
 * Copyright © 2026 Maurizio Tavilla
 */

const ESCLUDI_PROFESSIONI_CONCORSO = [
  'veterinar', 'medico', 'infermier', 'ostetric', 'ingegner', 'ingegneria', 'architet',
  'avvocat', 'notaio', 'farmacia', 'farmacist', 'biologo', 'psicolog', 'agronom',
  'geologo', 'geometra', 'perito agrar', 'educatore', 'assistente sociale', 'socio assistenziale',
  'polizia', 'polizia locale', 'carabinier', 'guardia di finanza', 'vigile del fuoco', 'magistrat',
  'giudice', 'professor', 'docente scuola', 'insegnante', 'rettore', 'dirigente scolastico',
  'istruttore tecnico', 'istruttori tecnici', 'collaboratore tecnico', 'collaboratorio tecnico',
  'istruttore direttivo tecnico', 'direttivo tecnico',
];

const MATCH_FORTE_CONCORSO = [
  'contabil', 'ragionier', 'ragioneria', 'fiscal', 'tributar', 'revisor', 'bilancio', 'paghe',
  'buste paga', 'economico finanziario', 'economico-finanziario', 'segretario amministrativo',
  'istruttore amministrativo', 'assistente amministrativo', 'operatore amministrativo',
  'agente amministrativo', 'addetto amministrativo', 'coadiutore amministrativo',
  'collaboratore amministrativo', 'elaborazione dati', 'data entry', 'software gestionale',
  'collocamento mirato', 'legge 68', 'categorie protette', 'orfani di guerra', 'mediatore civile',
];

const ESCLUDI_SE_NON_LAUREATO = [
  'laurea', 'laureato', 'laureati', 'magistrale', 'specialistica', 'master universit',
  'dottorato', 'dottore di ricerca', 'categoria d', 'cat. d', 'categoria b', 'cat. b',
  'categoria a', 'cat. a',
];

function compact(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function testoOfferta(offerta) {
  return compact([offerta.nome, offerta.descrizione_breve, offerta.ente, offerta.sede].join(' ')).toLowerCase();
}

function isManuale(offerta) {
  const fonte = String(offerta.fonte_scraper || offerta.fonte || '').toLowerCase();
  return fonte === 'manual_seed' || fonte === 'utente' || offerta.fonte === 'utente';
}

function titoloTroppoCorto(offerta) {
  const nome = compact(offerta.nome || '');
  const tipo = String(offerta.tipo || '').toLowerCase();
  const minLen = tipo === 'lavoro' ? 12 : 28;
  if (nome.length < minLen) return true;
  const junk = [
    'concorsi', 'amministrativo', 'funzionario', 'concorso', 'tipologia concorso',
    'istruttore amministrativo', 'istruttore contabile', 'collaboratore amministrativo',
    'segretario amministrativo', 'tecnico amministrativo',
  ];
  return junk.includes(nome.toLowerCase());
}

function matchForteConcorso(text) {
  return MATCH_FORTE_CONCORSO.some((w) => text.includes(w));
}

function contestoNonCompatibile(text, tipo) {
  if (tipo !== 'concorso' && tipo !== 'categoria_protetta') return false;
  if (text.includes('universit')) {
    const okUni = ['contabil', 'ragioneria', 'ragionier', 'economico finanziario'].some((w) => text.includes(w));
    if (!okUni) return true;
  }
  return false;
}

function richiedeLaurea(text, profilo) {
  const livello = String(profilo?.titolo_studio?.livello || '').toLowerCase();
  if (livello === 'laurea' || profilo?.titolo_studio?.equivalente_laurea === true) return false;
  const extra = (profilo?.parole_chiave_escludi_concorsi || []).map((w) => String(w).toLowerCase());
  const tutte = [...ESCLUDI_SE_NON_LAUREATO, ...extra];
  if (tutte.some((w) => text.includes(w))) return true;
  if (text.includes('funzionario') && !text.includes('istruttore') && !text.includes('assistente')) return true;
  if (text.includes('dirigente')) return true;
  return false;
}

function professioneNonCompatibile(text) {
  return ESCLUDI_PROFESSIONI_CONCORSO.some((w) => text.includes(w));
}

function matchParoleProfilo(text, profilo) {
  const match = (profilo?.parole_chiave_match || []).map((w) => String(w).toLowerCase());
  if (!match.length) return true;
  return match.some((w) => text.includes(w));
}

function esclusoDaLista(text, profilo) {
  const escludi = [
    ...(profilo?.parole_chiave_escludi || []),
    ...(profilo?.parole_chiave_escludi_concorsi || []),
  ].map((w) => String(w).toLowerCase());
  return escludi.some((w) => w && text.includes(w));
}

/** @returns {boolean} true se l'offerta è adatta al profilo */
export function passaFiltroProfilo(offerta, profilo) {
  if (!profilo) return true;
  if (isManuale(offerta)) return true;
  const text = testoOfferta(offerta);
  const tipo = String(offerta.tipo || 'lavoro').toLowerCase();
  if (titoloTroppoCorto(offerta)) return false;
  if (!matchParoleProfilo(text, profilo)) return false;
  if (esclusoDaLista(text, profilo)) return false;
  if (tipo === 'concorso' || tipo === 'categoria_protetta') {
    if (!matchForteConcorso(text)) return false;
    if (contestoNonCompatibile(text, tipo)) return false;
    if (professioneNonCompatibile(text)) return false;
    if (richiedeLaurea(text, profilo)) return false;
  }
  return true;
}
