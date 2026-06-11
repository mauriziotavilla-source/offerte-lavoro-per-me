/**

 * Scadenze e validità per offerte "orfani equiparati" (categoria_protetta).

 * In assenza di data ufficiale si inferisce dal titolo (es. "mese di LUGLIO 2025", "2026").

 * IMPORTANTE: rilevato_il (data scraping) non va usato per l'anno del bando.

 */

const { compactText } = require('./utils');



const MESI_IT = {

  gennaio: 0, gen: 0, febbraio: 1, feb: 1, marzo: 2, mar: 2, aprile: 3, apr: 3, mag: 4,

  maggio: 4, giu: 5, giugno: 5, lug: 6, luglio: 6, ago: 7, agosto: 7, set: 8, settembre: 8,

  ott: 9, ottobre: 9, nov: 10, novembre: 10, dic: 11, dicembre: 11,

};



function oggi() {

  const d = new Date();

  d.setHours(0, 0, 0, 0);

  return d;

}



function parseIso(str) {

  if (!str) return null;

  const d = new Date(`${String(str).slice(0, 10)}T12:00:00`);

  return Number.isNaN(d.getTime()) ? null : d;

}



function fineMese(anno, meseIdx) {

  return new Date(anno, meseIdx + 1, 0, 12, 0, 0);

}



/** Testo del bando (titolo/descrizione) — esclude rilevato_il per non confondere l'anno di scraping */

function testoBando(offerta) {

  return compactText(

    [offerta.nome, offerta.descrizione_breve, offerta.data_pubblicazione].join(' ')

  ).toLowerCase();

}



function parseMeseAnno(text) {

  const m1 = text.match(/mese\s+(?:di\s+)?([a-zàèéìòù]{3,9})[\s_]+(?:del?\s+)?(20\d{2})/i);

  const m2 = text.match(/mese_di_([a-zàèéìòù]{3,9})_(20\d{2})/i);

  const m = m1 || m2;

  if (!m) return null;

  const mese = MESI_IT[m[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '')];

  const anno = Number(m[2]);

  if (mese === undefined || !anno) return null;

  return fineMese(anno, mese);

}



function parseDdMmmYyyy(text) {

  const m = text.match(/\b(\d{1,2})[-\s]([a-z]{3})[-\s](20\d{2})\b/i);

  if (!m) return null;

  const mese = MESI_IT[m[2].toLowerCase()];

  const anno = Number(m[3]);

  const giorno = Number(m[1]);

  if (mese === undefined) return null;

  return new Date(anno, mese, giorno, 12, 0, 0);

}



function parseIsoInText(text) {

  const m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);

  if (!m) return null;

  return parseIso(`${m[1]}-${m[2]}-${m[3]}`);

}



function parseSlashDate(text) {

  const m = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/);

  if (!m) return null;

  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0);

}



function estraiDateRiferimento(text) {

  const out = [];

  [parseIsoInText, parseSlashDate, parseDdMmmYyyy, parseMeseAnno].forEach((fn) => {

    const d = fn(text);

    if (d) out.push(d);

  });

  return out;

}



function isDocumentoCpiL68(text) {

  return /avvis|l\.68|legge 68|enti pubblici|graduator|cpi messina|elenco\s+(?:provvisorio|definitivo)/.test(text);

}



function annoMassimoBando(text) {

  const anni = (text.match(/\b(20\d{2})\b/g) || []).map(Number);

  return anni.length ? Math.max(...anni) : null;

}



/** Avvisi/graduatorie CPI con anno nel titolo già conclusi rispetto all'anno corrente */

function isAvvisoAnnoScaduto(offerta) {

  const text = testoBando(offerta);

  const annoCorrente = oggi().getFullYear();

  const fonte = String(offerta.fonte_scraper || '').toLowerCase();

  if (/-2025\b|\/2025-/.test(fonte) || fonte.endsWith('2025')) return annoCorrente > 2025;



  if (!isDocumentoCpiL68(text)) return false;



  const maxAnno = annoMassimoBando(text);

  if (maxAnno !== null && maxAnno < annoCorrente) return true;



  if (/\b2025\b/.test(text) && !/\b2026\b/.test(text) && annoCorrente >= 2026) return true;



  return false;

}



/** Fine validità stimata per bandi/avvisi L.68 e annunci orfani equiparati */

function inferFineValidita(offerta) {

  const text = testoBando(offerta);

  const dates = estraiDateRiferimento(text);

  const maxData = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;



  if (/graduatoria\s+definitiva|graduatorie\s+definitive|elenco\s+definitivo/.test(text)) {

    return maxData || (/\b2025\b/.test(text) ? new Date(2025, 11, 31, 12, 0, 0) : maxData);

  }



  const annoMatch = text.match(/\b(20\d{2})\b/g);

  if (annoMatch && isDocumentoCpiL68(text)) {

    const anni = [...new Set(annoMatch.map(Number))].sort((a, b) => b - a);

    const anno = anni[0];

    if (maxData) {

      const fine = new Date(maxData);

      fine.setDate(fine.getDate() + 45);

      return fine;

    }

    if (anno < oggi().getFullYear()) {

      return new Date(anno, 11, 31, 12, 0, 0);

    }

    const mese = parseMeseAnno(text);

    if (mese) {

      const fine = new Date(mese);

      fine.setDate(fine.getDate() + 60);

      return fine;

    }

  }



  const fonte = String(offerta.fonte_scraper || '').toLowerCase();

  if (fonte.includes('linkedin') || fonte.includes('orfani-guerra')) {

    const rilev = parseIso(offerta.rilevato_il || offerta.data_pubblicazione);

    if (rilev) {

      const fine = new Date(rilev);

      fine.setDate(fine.getDate() + 45);

      return fine;

    }

  }



  if (maxData) {

    const fine = new Date(maxData);

    fine.setDate(fine.getDate() + 30);

    return fine;

  }



  const rilev = parseIso(offerta.rilevato_il);

  if (rilev) {

    const fine = new Date(rilev);

    fine.setDate(fine.getDate() + 90);

    return fine;

  }



  return null;

}



function inferScadenzeCategoriaProtetta(offerta) {

  const stored = offerta.scadenze?.[0];

  if (offerta.scadenze?.length && stored?.note && !String(stored.note).includes('Calcolata')) {

    return offerta.scadenze;

  }

  const fine = inferFineValidita(offerta);

  if (!fine) return [];

  return [{ fase: 'Fine validità stimata', data: fine.toISOString().slice(0, 10), note: 'Calcolata dal titolo/testo del bando' }];

}



function isCategoriaProtettaScaduta(offerta) {

  if (String(offerta.tipo || '').toLowerCase() !== 'categoria_protetta') return false;

  const text = testoBando(offerta);

  if (String(offerta.stato || '').toLowerCase() === 'chiuso') return true;

  if (isAvvisoAnnoScaduto(offerta)) return true;

  if (/graduatoria\s+definitiva|graduatorie\s+definitive|elenco\s+definitivo/.test(text) && !/\b2026\b/.test(text)) {

    return true;

  }

  const scadenze = inferScadenzeCategoriaProtetta(offerta);

  const ultima = scadenze.map((s) => parseIso(s.data)).filter(Boolean).sort((a, b) => b - a)[0];

  if (ultima && ultima < oggi()) return true;

  const fine = inferFineValidita(offerta);

  if (fine && fine < oggi()) return true;

  return false;

}



function statoCategoriaProtetta(offerta) {

  if (isCategoriaProtettaScaduta(offerta)) return 'chiuso';

  const text = testoBando(offerta);

  if (/graduatoria\s+provvisoria|in arrivo|prossim/.test(text)) return 'in_arrivo';

  return 'aperto';

}



module.exports = {

  inferFineValidita,

  inferScadenzeCategoriaProtetta,

  isCategoriaProtettaScaduta,

  statoCategoriaProtetta,

};


