const { sha1, todayIso, topicPerTipo } = require('./utils');

function catalogHash(offerte) {
  const joined = (offerte || [])
    .map((o) => `${o.id}:${o.hash_contenuto || ''}`)
    .sort()
    .join('|');
  return sha1(joined);
}

function summarize(o) {
  return {
    id: o.id,
    nome: o.nome,
    tipo: o.tipo,
    ente: o.ente,
    link_ufficiale: o.link_ufficiale,
    data_pubblicazione: o.data_pubblicazione || '',
    fonte_scraper: o.fonte_scraper || '',
    hash_contenuto: o.hash_contenuto || '',
    notifica_topics: o.notifica_topics?.length ? o.notifica_topics : [topicPerTipo(o.tipo)],
  };
}

function buildDiff(previousData, nextData, sourceErrors = []) {
  const previousById = new Map((previousData.offerte || []).map((o) => [o.id, o]));
  const nuovi = [];
  const aggiornati = [];
  (nextData.offerte || []).forEach((o) => {
    const before = previousById.get(o.id);
    if (!before) {
      nuovi.push(summarize(o));
      return;
    }
    const prevHash = before.hash_contenuto || sha1(JSON.stringify(before));
    const nextHash = o.hash_contenuto || sha1(JSON.stringify(o));
    if (prevHash !== nextHash) aggiornati.push(summarize(o));
  });
  return {
    generated_at: new Date().toISOString(),
    source_run: 'github-actions-scraper',
    catalog_hash: nextData.catalog_hash || catalogHash(nextData.offerte || []),
    counts: { nuovi: nuovi.length, aggiornati: aggiornati.length },
    nuovi,
    aggiornati,
    errori_fonti: sourceErrors,
  };
}

function nextVersion(previousData, hasChanges) {
  const prev = Number(previousData.versione || 1);
  return hasChanges ? prev + 1 : prev;
}

function nextTopLevelData(previousData, offerte, opts = {}) {
  const hash = catalogHash(offerte);
  const changed = hash !== (previousData.catalog_hash || catalogHash(previousData.offerte || []));
  return {
    ultimo_aggiornamento: changed ? todayIso() : previousData.ultimo_aggiornamento || todayIso(),
    versione: nextVersion(previousData, changed),
    regione_focus: previousData.regione_focus || 'sicilia',
    nota:
      previousData.nota ||
      'Gli annunci e le scadenze cambiano spesso: verifica sempre il link ufficiale prima di candidarti.',
    catalog_hash: hash,
    generated_at: new Date().toISOString(),
    generated_by: 'scripts/scraper/run.js',
    offerte,
    changed,
    source_errors: opts.sourceErrors || [],
  };
}

module.exports = { buildDiff, catalogHash, nextTopLevelData };
