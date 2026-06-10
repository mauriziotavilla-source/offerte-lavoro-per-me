/**
 * Fonti monitorate dallo scraper.
 *
 * Ogni fonte ha:
 *  - id: identificativo unico
 *  - enabled: true/false (se false viene saltata)
 *  - parser: 'htmlLinks' (legge i link di una pagina) oppure 'rss' (feed RSS/Atom)
 *  - tipo: 'lavoro' | 'concorso' | 'categoria_protetta'  (decide il colore e il topic notifiche)
 *  - url: pagina o feed da leggere
 *  - selectors: (solo htmlLinks) selettori CSS dei link da prendere
 *  - includeKeywords: tiene solo i risultati che contengono almeno una di queste parole
 *  - excludeKeywords: scarta i risultati che contengono una di queste parole
 *  - defaultAree / sede / regioni_ammesse / profili: campi precompilati
 *
 * NOTA: alcuni grandi portali (Indeed, LinkedIn, Subito) caricano gli annunci
 * con JavaScript o bloccano i robot: per quelli lo scraper automatico spesso
 * non funziona. Restano comunque utili come link nella colonna "portali" dell'app,
 * dove puoi cercare a mano e poi usare "➕ Aggiungi offerta".
 */

const PAROLE_PROFILO = [
  'contabil',
  'ragionier',
  'commercialist',
  'fiscal',
  'tributar',
  'bilancio',
  'amministrat',
  'segreteria',
  'revisor',
  'economico',
  'finanziar',
  'paghe',
  'controllo di gestione',
  'data entry',
  'software gestionale',
];

module.exports = [
  {
    id: 'gazzetta-via-concorsipubblici',
    enabled: true,
    parser: 'htmlLinks',
    tipo: 'concorso',
    ente: 'Gazzetta Ufficiale (via ConcorsiPubblici.com)',
    sede: 'Italia',
    url: 'https://www.concorsipubblici.com/concorsi/gazzetta-ufficiale',
    selectors: ['a'],
    includeKeywords: [...PAROLE_PROFILO, 'istruttore', 'ragioneria', 'collocamento mirato', 'legge 68'],
    excludeKeywords: [
      'privacy', 'cookie', 'accessibilita', 'tipologia concorso', 'archivio concorsi',
      'veterinar', 'medico', 'infermier', 'ingegner', 'laurea', 'funzionario',
    ],
    defaultAree: ['contabilita', 'amministrazione'],
    profili: ['Profilo contabile/amministrativo'],
    regioni_ammesse: ['tutta_italia'],
    nota: 'La pagina ufficiale gazzettaufficiale.it/30giorni/concorsi elenca solo numeri PDF, non i titoli dei bandi. Usiamo l\'aggregatore che indicizza la 4ª Serie Concorsi.',
  },
  {
    id: 'concorsipubblici-sicilia',
    enabled: true,
    parser: 'htmlLinks',
    tipo: 'concorso',
    ente: 'ConcorsiPubblici.com - Sicilia',
    sede: 'Sicilia',
    url: 'https://www.concorsipubblici.com/concorsi/regione/loc/sicilia',
    selectors: ['a'],
    includeKeywords: [...PAROLE_PROFILO, 'istruttore', 'ragioneria', 'collocamento mirato', 'legge 68'],
    excludeKeywords: [
      'privacy', 'cookie', 'tipologia concorso', 'archivio concorsi',
      'veterinar', 'medico', 'infermier', 'ingegner', 'laurea', 'funzionario',
    ],
    defaultAree: ['amministrazione', 'contabilita'],
    profili: ['Istruttore/Funzionario'],
    regioni_ammesse: ['sicilia'],
  },
  {
    id: 'regione-sicilia-concorsi',
    enabled: true,
    parser: 'htmlLinks',
    tipo: 'concorso',
    ente: 'Regione Siciliana',
    sede: 'Sicilia',
    url: 'https://www.regione.sicilia.it/istituzioni/regione/strutture-regionali/assessorato-autonomie-locali-funzione-pubblica/dipartimento-funzione-pubblica-personale/bandi-concorso',
    selectors: ['main a', 'article a', '.views-row a'],
    includeKeywords: [...PAROLE_PROFILO, 'istruttore', 'ragioneria', 'collocamento mirato', 'legge 68'],
    excludeKeywords: [
      'privacy', 'cookie', 'accessibilita', 'amministrazione trasparente',
      'veterinar', 'medico', 'infermier', 'ingegner', 'laurea', 'funzionario',
    ],
    defaultAree: ['amministrazione', 'contabilita'],
    profili: ['Istruttore/Funzionario'],
    regioni_ammesse: ['sicilia'],
    nota: 'URL aggiornato 06/2026: il vecchio /la-regione-informa/concorsi non esiste più.',
  },
  {
    id: 'inpa-concorsi',
    enabled: false,
    parser: 'htmlLinks',
    tipo: 'concorso',
    ente: 'inPA - Portale del Reclutamento',
    sede: 'Italia',
    url: 'https://www.inpa.gov.it/',
    selectors: ['a'],
    includeKeywords: PAROLE_PROFILO,
    excludeKeywords: ['privacy', 'cookie'],
    defaultAree: ['amministrazione', 'contabilita'],
    profili: ['Pubblico impiego'],
    regioni_ammesse: ['tutta_italia'],
    nota: 'inPA carica i risultati con JavaScript: lo scraper di pagina spesso non li vede. Tienilo come link manuale.',
  },
  {
    id: 'categorie-protette-jobmetoo',
    enabled: false,
    parser: 'htmlLinks',
    tipo: 'categoria_protetta',
    ente: 'Jobmetoo (categorie protette)',
    sede: 'Italia',
    url: 'https://www.jobmetoo.com/',
    selectors: ['a'],
    includeKeywords: PAROLE_PROFILO,
    excludeKeywords: ['privacy', 'cookie'],
    defaultAree: ['amministrazione', 'contabilita'],
    profili: ['Categorie protette'],
    regioni_ammesse: ['tutta_italia'],
    nota: 'Portale dedicato alle categorie protette: spesso richiede login o usa JavaScript.',
  },
];
