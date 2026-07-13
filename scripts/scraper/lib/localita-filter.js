/**
 * Filtro località lavoro — Messina (stessa logica dell'app).
 */
const { compactText } = require('./utils');

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

function testoLocalita(offerta) {
  return compactText(
    [offerta.nome, offerta.descrizione_breve, offerta.ente, offerta.sede, offerta.partecipazione, offerta.modalita]
      .join(' ')
  ).toLowerCase();
}

function isLavoroRemoto(offerta) {
  const text = testoLocalita(offerta);
  return /remot|smart\s*work|da casa|full remote|lavoro da casa|telelavoro|work from home/.test(text);
}

function isPerMessinaLavoro(offerta, profilo) {
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

module.exports = {
  isPerMessinaLavoro,
  isLavoroRemoto,
  testoLocalita,
};
