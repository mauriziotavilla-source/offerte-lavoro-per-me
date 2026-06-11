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

const MATCH_ORFANI_EQUIPARATI = [
  'orfani di guerra', 'orfano di guerra', 'orfani ed equiparati', 'orfani e equiparati',
  'orfani guerra', 'equiparat', 'art. 8', 'art.8', 'art 8',
  'elenco provinciale orfani', 'collocamento mirato orfani',
];

const ESCLUDI_CAT_PROTETTA_NON_ORFANI = [
  'art. 1', 'art.1', 'art 1', 'art. 18', 'art.18', 'art 18', 'art_18',
  'invalidit', 'disabilit', 'handicap',
  'categorie protette art. 1', 'cat. prot. art.1',
  'appartenente categorie protette art.1', 'appartenente alle cat. prot. art.1',
  'invalidità 46', 'invalidita 46', 'solo art. 18', 'riservato disabil',
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
  const minLen = tipo === 'lavoro' || tipo === 'categoria_protetta' ? 12 : 28;
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

function matchOrfaniEquiparati(text) {
  return MATCH_ORFANI_EQUIPARATI.some((w) => text.includes(w));
}

function isAvvisoCpiMessinaOrfani(offerta, text) {
  const fonte = String(offerta.fonte_scraper || offerta.fonte || '').toLowerCase();
  if (!fonte.includes('l68-enti-pubblici-messina')) return false;
  if (ESCLUDI_CAT_PROTETTA_NON_ORFANI.some((w) => text.includes(w))) return false;
  return /avvis|graduator|l\.68|legge 68|enti pubblici/.test(text);
}

function isFonteOrfaniLinkedIn(offerta, text) {
  const fonte = String(offerta.fonte_scraper || offerta.fonte || '').toLowerCase();
  if (!fonte.includes('orfani-guerra')) return false;
  if (ESCLUDI_CAT_PROTETTA_NON_ORFANI.some((w) => text.includes(w))) return false;
  return true;
}

function esclusoCategoriaNonOrfani(offerta, text, profilo) {
  const extra = (profilo?.parole_chiave_escludi_categoria_protetta || []).map((w) => String(w).toLowerCase());
  const tutte = [...ESCLUDI_CAT_PROTETTA_NON_ORFANI, ...extra];
  return tutte.some((w) => w && text.includes(w));
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
  if (esclusoDaLista(text, profilo)) return false;

  if (tipo === 'categoria_protetta') {
    if (esclusoCategoriaNonOrfani(offerta, text, profilo)) return false;
    if (!matchOrfaniEquiparati(text) && !isAvvisoCpiMessinaOrfani(offerta, text) && !isFonteOrfaniLinkedIn(offerta, text)) return false;
    if (richiedeLaurea(text, profilo)) return false;
    return true;
  }

  if (!matchParoleProfilo(text, profilo)) return false;

  if (tipo === 'concorso') {
    if (!matchForteConcorso(text)) return false;
    if (contestoNonCompatibile(text, tipo)) return false;
    if (professioneNonCompatibile(text)) return false;
    if (richiedeLaurea(text, profilo)) return false;
  }
  return true;
}
