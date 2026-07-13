/**
 * Filtra offerte/concorsi in base a data/profilo.json
 * (titolo di studio, parole chiave, esclusioni per non laureati).
 */
const path = require('path');
const { readJson } = require('./io');
const { compactText } = require('./utils');

const ROOT = path.join(__dirname, '..', '..', '..');

/** Professioni / bandi che NON riguardano il profilo contabile-amministrativo */
const ESCLUDI_PROFESSIONI_CONCORSO = [
  'veterinar',
  'medico',
  'infermier',
  'ostetric',
  'ingegner',
  'ingegneria',
  'architet',
  'avvocat',
  'notaio',
  'farmacia',
  'farmacist',
  'biologo',
  'psicolog',
  'agronom',
  'geologo',
  'geometra',
  'perito agrar',
  'educatore',
  'assistente sociale',
  'socio assistenziale',
  'polizia',
  'polizia locale',
  'carabinier',
  'guardia di finanza',
  'vigile del fuoco',
  'magistrat',
  'giudice',
  'professor',
  'docente scuola',
  'insegnante',
  'rettore',
  'dirigente scolastico',
  'istruttore tecnico',
  'istruttori tecnici',
  'collaboratore tecnico',
  'collaboratorio tecnico',
  'istruttore direttivo tecnico',
  'direttivo tecnico',
];

/** Per i concorsi serve almeno un profilo chiaramente compatibile (non solo "amministrativo" generico) */
const MATCH_FORTE_CONCORSO = [
  'contabil',
  'ragionier',
  'ragioneria',
  'fiscal',
  'tributar',
  'revisor',
  'bilancio',
  'paghe',
  'buste paga',
  'economico finanziario',
  'economico-finanziario',
  'segretario amministrativo',
  'istruttore amministrativo',
  'assistente amministrativo',
  'operatore amministrativo',
  'agente amministrativo',
  'addetto amministrativo',
  'coadiutore amministrativo',
  'collaboratore amministrativo',
  'elaborazione dati',
  'data entry',
  'software gestionale',
  'collocamento mirato',
  'legge 68',
  'categorie protette',
  'orfani di guerra',
  'mediatore civile',
];

/** Segnali per orfani di guerra ed equiparati — art. 18 L. 68/99 e art. 7 L. 585/1971 */
const MATCH_ORFANI_EQUIPARATI = [
  'orfani di guerra',
  'orfano di guerra',
  'orfani ed equiparati',
  'orfani e equiparati',
  'orfani guerra',
  'equiparat',
  'art. 18',
  'art.18',
  'art 18',
  'altre categorie protette',
  'legge 585',
  'l. 585',
  '585/1971',
  'art. 7',
  'art.7',
  'elenco provinciale orfani',
  'collocamento mirato orfani',
  // Art. 8 = elenchi/graduatorie CPI (iscrizione collocamento mirato)
  'art. 8',
  'art.8',
  'art 8',
];

/** Art. 1 L.68/99 = invalidità civile/disabilità — NON orfani equiparati */
const ESCLUDI_CAT_PROTETTA_NON_ORFANI = [
  'art. 1',
  'art.1',
  'art 1',
  'cat. prot. art.1',
  'categorie protette art. 1',
  'appartenente categorie protette art.1',
  'appartenente alle cat. prot. art.1',
  'invalidità 46',
  'invalidita 46',
  'riservato disabil',
];

const {
  isCategoriaProtettaScaduta,
} = require('./scadenze-categoria');
const { isPerMessinaLavoro } = require('./localita-filter');

/** Richiedono laurea: da escludere se titolo_studio.livello = diploma */
const ESCLUDI_SE_NON_LAUREATO = [
  'laurea',
  'laureato',
  'laureati',
  'magistrale',
  'specialistica',
  'master universit',
  'dottorato',
  'dottore di ricerca',
  'categoria d',
  'cat. d',
  'categoria b',
  'cat. b',
  'categoria a',
  'cat. a',
];

let profiloCache = null;

function loadProfilo() {
  if (profiloCache) return profiloCache;
  const file = path.join(ROOT, 'data', 'profilo.json');
  profiloCache = readJson(file, {});
  return profiloCache;
}

function testoOfferta(offerta) {
  // Solo titolo e testo del bando: non usare profili/requisiti precompilati dallo scraper
  return compactText([offerta.nome, offerta.descrizione_breve, offerta.ente, offerta.sede].join(' ')).toLowerCase();
}

function isManuale(offerta) {
  const fonte = String(offerta.fonte_scraper || offerta.fonte || '').toLowerCase();
  return fonte === 'manual_seed' || fonte === 'utente' || offerta.fonte === 'utente';
}

function titoloTroppoCorto(offerta) {
  const nome = compactText(offerta.nome || '');
  const tipo = String(offerta.tipo || '').toLowerCase();
  const minLen = tipo === 'lavoro' || tipo === 'categoria_protetta' ? 12 : 28;
  if (nome.length < minLen) return true;
  const junk = [
    'concorsi', 'amministrativo', 'funzionario', 'concorso', 'tipologia concorso',
    'istruttore amministrativo', 'istruttore contabile', 'collaboratore amministrativo',
    'segretario amministrativo', 'tecnico amministrativo',
  ];
  if (junk.includes(nome.toLowerCase())) return true;
  return false;
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
  if (contieneArt1Escluso(text)) return false;
  return /avvis|graduator|l\.68|legge 68|enti pubblici/.test(text);
}

/** Annunci da ricerche LinkedIn dedicate agli orfani di guerra (il titolo spesso non ripete la parola) */
function isFonteOrfaniLinkedIn(offerta, text) {
  const fonte = String(offerta.fonte_scraper || offerta.fonte || '').toLowerCase();
  if (!fonte.includes('orfani-guerra')) return false;
  if (contieneArt1Escluso(text)) return false;
  return true;
}

function contieneArt1Escluso(text) {
  if (/art\.?\s*18/.test(text)) return false;
  if (/art\.?\s*8\b/.test(text)) return false;
  if (/cat\.?\s*prot\.?\s*art\.?\s*1/i.test(text)) return true;
  if (/invalidit[aà]?\s*46/.test(text)) return true;
  return /\bart\.?\s*1\b(?!8)/.test(text);
}

function esclusoCategoriaNonOrfani(offerta, text, profilo) {
  if (contieneArt1Escluso(text)) return true;
  const extra = (profilo.parole_chiave_escludi_categoria_protetta || []).map((w) => String(w).toLowerCase());
  return extra.some((w) => {
    if (!w) return false;
    if (w === 'art. 1' || w === 'art.1') return contieneArt1Escluso(text);
    return text.includes(w);
  });
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
  const livello = String(profilo.titolo_studio?.livello || '').toLowerCase();
  if (livello === 'laurea' || profilo.titolo_studio?.equivalente_laurea === true) return false;

  const extra = (profilo.parole_chiave_escludi_concorsi || []).map((w) => String(w).toLowerCase());
  const tutte = [...ESCLUDI_SE_NON_LAUREATO, ...extra];
  if (tutte.some((w) => text.includes(w))) return true;

  // Funzionario (categoria D) di solito richiede laurea; istruttore/assistente spesso no
  if (text.includes('funzionario') && !text.includes('istruttore') && !text.includes('assistente')) {
    return true;
  }
  if (text.includes('dirigente')) return true;

  return false;
}

function professioneNonCompatibile(text) {
  return ESCLUDI_PROFESSIONI_CONCORSO.some((w) => text.includes(w));
}

function matchParoleProfilo(text, profilo) {
  const match = (profilo.parole_chiave_match || []).map((w) => String(w).toLowerCase());
  if (!match.length) return true;
  return match.some((w) => text.includes(w));
}

function esclusoDaLista(text, profilo) {
  const escludi = [
    ...(profilo.parole_chiave_escludi || []),
    ...(profilo.parole_chiave_escludi_concorsi || []),
  ].map((w) => String(w).toLowerCase());
  return escludi.some((w) => w && text.includes(w));
}

/**
 * @returns {{ ok: boolean, motivo?: string }}
 */
function valutaProfilo(offerta, profilo = null) {
  const p = profilo || loadProfilo();
  if (isManuale(offerta)) return { ok: true };

  const text = testoOfferta(offerta);
  const tipo = String(offerta.tipo || 'lavoro').toLowerCase();

  if (titoloTroppoCorto(offerta)) return { ok: false, motivo: 'titolo_generico' };
  if (esclusoDaLista(text, p)) return { ok: false, motivo: 'parola_esclusa' };

  if (tipo === 'categoria_protetta') {
    if (isCategoriaProtettaScaduta(offerta)) {
      return { ok: false, motivo: 'categoria_protetta_scaduta' };
    }
    if (esclusoCategoriaNonOrfani(offerta, text, p)) {
      return { ok: false, motivo: 'non_orfano_equiparato' };
    }
    const okOrfani =
      matchOrfaniEquiparati(text) ||
      isAvvisoCpiMessinaOrfani(offerta, text) ||
      isFonteOrfaniLinkedIn(offerta, text);
    if (!okOrfani) {
      return { ok: false, motivo: 'non_orfano_equiparato' };
    }
    if (richiedeLaurea(text, p)) return { ok: false, motivo: 'richiede_laurea' };
    return { ok: true };
  }

  if (!matchParoleProfilo(text, p)) return { ok: false, motivo: 'nessuna_parola_profilo' };

  if (tipo === 'concorso') {
    if (!matchForteConcorso(text)) return { ok: false, motivo: 'profilo_concorso_non_specifico' };
    if (contestoNonCompatibile(text, tipo)) return { ok: false, motivo: 'contesto_non_compatibile' };
    if (professioneNonCompatibile(text)) return { ok: false, motivo: 'professione_non_compatibile' };
    if (richiedeLaurea(text, p)) return { ok: false, motivo: 'richiede_laurea' };
  }

  if (tipo === 'lavoro' && !isPerMessinaLavoro(offerta, p)) {
    return { ok: false, motivo: 'fuori_messina' };
  }

  return { ok: true };
}

function filterForProfile(offerte, profilo = null) {
  const p = profilo || loadProfilo();
  return offerte.filter((o) => valutaProfilo(o, p).ok);
}

function filterStats(offerte, profilo = null) {
  const p = profilo || loadProfilo();
  let ok = 0;
  let scartati = 0;
  const motivi = {};
  offerte.forEach((o) => {
    const r = valutaProfilo(o, p);
    if (r.ok) ok += 1;
    else {
      scartati += 1;
      motivi[r.motivo] = (motivi[r.motivo] || 0) + 1;
    }
  });
  return { ok, scartati, motivi };
}

module.exports = {
  filterForProfile,
  filterStats,
  loadProfilo,
  valutaProfilo,
};
