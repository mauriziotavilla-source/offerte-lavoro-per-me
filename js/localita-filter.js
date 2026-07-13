/**
 * Filtro località: offerte di lavoro concentrate su Messina (città di residenza).
 * Copyright © 2026 Maurizio Tavilla
 */

const COMUNI_PROVINCIA_MESSINA = [
  'messina',
  'villafranca tirrena',
  'giarre',
  'santa venerina',
  'taormina',
  'milazzo',
  'barcellona pozzo',
  'termini imerese',
  'patti',
  'lipari',
  'torregrotta',
  'rodì milici',
  'spadafora',
];

const ALTRE_CITTA_ESCLUSE = [
  'catania',
  'palermo',
  'siracusa',
  'ragusa',
  'trapani',
  'agrigento',
  'enna',
  'caltanissetta',
  'reggio calabria',
  'roma',
  'milano',
  'napoli',
  'bari',
  'torino',
  'firenze',
  'bologna',
];

function compact(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

export function testoLocalita(offerta) {
  return compact(
    [offerta.nome, offerta.descrizione_breve, offerta.ente, offerta.sede, offerta.partecipazione, offerta.modalita]
      .join(' ')
  ).toLowerCase();
}

export function isLavoroRemoto(offerta) {
  const text = testoLocalita(offerta);
  return /remot|smart\s*work|da casa|full remote|lavoro da casa|telelavoro|work from home/.test(text);
}

/** True se l'offerta di lavoro è a Messina, provincia limitrofa o da remoto */
export function isPerMessinaLavoro(offerta, profilo) {
  const tipo = String(offerta.tipo || 'lavoro').toLowerCase();
  if (tipo !== 'lavoro') return true;

  const text = testoLocalita(offerta);
  const sede = String(offerta.sede || '').toLowerCase();
  const fonte = String(offerta.fonte_scraper || offerta.fonte || '').toLowerCase();
  const citta = String(profilo?.citta_focus || profilo?.candidato?.citta || 'Messina').toLowerCase();

  if (isLavoroRemoto(offerta)) return true;
  if (fonte.includes('lavoro-messina')) return true;
  if (sede.includes('messina') || text.includes('messina')) return true;
  if (COMUNI_PROVINCIA_MESSINA.some((c) => c !== 'messina' && text.includes(c))) return true;

  if (ALTRE_CITTA_ESCLUSE.some((c) => text.includes(c))) return false;
  if (fonte.includes('lavoro-sicilia')) return false;
  if ((sede === 'sicilia' || sede.includes('sicilia')) && !text.includes(citta)) return false;

  return text.includes(citta);
}
