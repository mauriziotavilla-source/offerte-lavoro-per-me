const { compactText, sha1, slugify, todayIso, topicPerTipo, unique } = require('./utils');

/** Parole chiave -> area professionale */
const KEYWORD_TO_AREA = [
  { terms: ['contabil', 'ragionier', 'bilancio', 'partita doppia'], area: 'contabilita' },
  { terms: ['fiscal', 'tributar', 'iva', 'dichiaraz', '730', 'redditi'], area: 'fiscale' },
  { terms: ['amministrat', 'segreteria', 'back office', 'data entry'], area: 'amministrazione' },
  { terms: ['revisor', 'revision', 'sindaco', 'collegio'], area: 'revisione' },
  { terms: ['controllo di gestione', 'controller', 'budget', 'reporting'], area: 'controllo-gestione' },
  { terms: ['paghe', 'buste paga', 'contributi', 'cedolino', 'consulente del lavoro'], area: 'paghe' },
  { terms: ['software', 'gestionale', 'informatic', 'applicativo', 'sistemista', 'analista'], area: 'consulenza-informatica' },
  { terms: ['mediator', 'mediazione', 'conciliaz'], area: 'mediazione' },
];

function inferAree(text, source) {
  const hay = compactText(text).toLowerCase();
  const matched = KEYWORD_TO_AREA.filter((i) => i.terms.some((t) => hay.includes(t))).map((i) => i.area);
  return unique([...(source.defaultAree || []), ...matched]).slice(0, 4);
}

function inferStato(item) {
  const hay = compactText(`${item.title} ${item.summary}`).toLowerCase();
  if (/\bscadut[oaie]\b/.test(hay) || /\bchius[oa]\b/.test(hay) || hay.includes('graduatoria definitiva')) {
    return 'chiuso';
  }
  if (hay.includes('apert') || hay.includes('attivo') || hay.includes('candidat')) return 'aperto';
  if (hay.includes('in arrivo') || hay.includes('prossim') || hay.includes('in pubblicazione')) return 'in_arrivo';
  return 'aperto';
}

function defaultChecklist(tipo) {
  if (tipo === 'concorso' || tipo === 'categoria_protetta') {
    return [
      'Aprire il bando ufficiale e leggere requisiti e riserve',
      'Verificare titolo di studio e requisiti generali',
      'Preparare SPID e documentazione',
      'Presentare domanda (inPA) entro la scadenza',
    ];
  }
  return [
    'Aprire l\'annuncio e leggere i requisiti',
    'Aggiornare il CV per questa posizione',
    'Inviare la candidatura',
  ];
}

function makeFingerprint(payload) {
  return sha1(
    JSON.stringify({
      nome: payload.nome,
      ente: payload.ente,
      tipo: payload.tipo,
      sede: payload.sede,
      link_ufficiale: payload.link_ufficiale,
      data_pubblicazione: payload.data_pubblicazione,
      scadenze: payload.scadenze,
      descrizione_breve: payload.descrizione_breve,
    })
  );
}

function inferSede(source, item, descrizione) {
  const testo = compactText(`${item.summary || ''} ${item.rawText || ''} ${descrizione}`).toLowerCase();
  if (testo.includes('messina')) return 'Messina';
  if (testo.includes('sicil')) return 'Sicilia';
  if ((item.summary || '').toLowerCase().includes('remote') || testo.includes('remoto')) return 'Remoto';
  return source.sede || 'Da definire';
}

function normalizeItem(source, item) {
  const nome = compactText(item.title);
  const descrizione = compactText(item.summary || item.rawText || nome).slice(0, 260);
  const tipo = source.tipo || 'lavoro';
  const sede = inferSede(source, item, descrizione);
  const payload = {
    id: `${source.id}-${slugify(nome)}`,
    nome,
    ente: source.ente || source.programma || source.id,
    tipo,
    aree: inferAree(`${nome} ${descrizione}`, source),
    stato: inferStato(item),
    sede,
    modalita: '',
    contratto: '',
    retribuzione: '',
    descrizione_breve: descrizione,
    partecipazione:
      source.partecipazione ||
      `Verifica i requisiti sull'annuncio ufficiale. Sede indicativa: ${source.sede || 'da definire'}.`,
    scadenze: item.publishedAt ? [{ fase: 'Invio candidatura', data: item.publishedAt, note: '' }] : [],
    requisiti: ['Verificare requisiti sull\'annuncio ufficiale'],
    documenti: ['Curriculum aggiornato'],
    profili: source.profili || [],
    link_ufficiale: item.url,
    checklist: defaultChecklist(tipo),
    regioni_ammesse: source.regioni_ammesse || [],
    data_pubblicazione: item.publishedAt || '',
    fonte_scraper: source.id,
    url_origine: source.url,
    rilevato_il: todayIso(),
    notifica_topics: [topicPerTipo(tipo)],
  };
  payload.hash_contenuto = makeFingerprint(payload);
  return payload;
}

function normalizeSourceItems(source, items) {
  return items.map((item) => normalizeItem(source, item));
}

module.exports = { makeFingerprint, normalizeItem, normalizeSourceItems };
