# Lavoro & Concorsi per Me

Motore di ricerca **personalizzato** per trovare **offerte di lavoro**, **concorsi pubblici** e **posizioni riservate alle categorie protette (L. 68/99)** ritagliati sul tuo profilo professionale (contabile, ragioniere, commercialista, consulenza informatica), con **notifiche push** quando arrivano novità.

Questo progetto ricalca l'architettura del progetto **Fonti di Finanziamento**.

© 2026 **Maurizio Tavilla**. Tutti i diritti riservati.

---

## Cosa fa

- Mostra le offerte/concorsi in schede chiare, divise per **tipo** (Lavoro / Concorsi / Categorie protette).
- Filtra per **testo**, **tipo**, **area professionale**, **stato**, **scadenza** e **solo Sicilia/remoto**.
- Salva i **preferiti**, una **checklist** per ogni candidatura, e ti fa **esportare in CSV** o **stampare in PDF**.
- Uno **scraper** automatico (su GitHub) cerca nuove offerte sui portali e ti invia **notifiche push** su Android.
- Tutto è tarato sul tuo **profilo** (`data/profilo.json`), estratto dal tuo curriculum.

---

## Struttura del progetto

| Cartella / file | A cosa serve |
|---|---|
| `index.html` | La pagina principale dell'app |
| `css/styles.css`, `css/mobile.css` | Grafica e layout (anche su telefono) |
| `js/app.js` | Logica: filtri, schede, calendario, preferiti, checklist, export, stampa |
| `js/store.js` | Carica le offerte (file locale + aggiornamento online + offerte aggiunte da te) |
| `js/push-notifications.js` | Gestione notifiche push Android |
| `data/profilo.json` | **Il tuo profilo** (titoli, parole chiave, aree) — il cuore della personalizzazione |
| `data/offerte.json` | Database delle offerte/concorsi (esempi di partenza + risultati scraper) |
| `data/fonti.json` | Tipi, aree professionali e portali ufficiali |
| `data/novita.json` | Elenco delle novità (usato dalle notifiche) |
| `data/aggiornamento.json` | URL per scaricare gli aggiornamenti online |
| `scripts/avvia_server.py` | Avvia l'app nel browser |
| `scripts/prossime_scadenze.py` | Elenco scadenze in console |
| `scripts/scraper/` | Lo scraper Node.js (cerca offerte) e l'invio notifiche |
| `.github/workflows/scraper.yml` | Automazione: esegue lo scraper ogni 6 ore |
| `AVVIA_APP.bat` | Doppio clic per avviare l'app su Windows |

---

## Come avviare l'app (Windows)

### Metodo veloce
Doppio clic su **`AVVIA_APP.bat`**. Si apre il browser sull'app.

### Metodo manuale
1. Apri il terminale in questa cartella.
2. Esegui:

```bash
python scripts/avvia_server.py
```

3. Si apre `http://localhost:8080`. Per fermare: `Ctrl+C`.

> Serve un piccolo server perché, aprendo `index.html` con doppio clic, il browser per sicurezza non carica i file JSON.

---

## Come aggiungere un'offerta a mano

1. Clicca **➕ Aggiungi offerta**.
2. Compila titolo, descrizione, requisiti, tipo, aree, link ufficiale, ecc.
3. L'offerta resta salvata **sul tuo PC** (nel browser) con il badge **Tua**.

---

## Notifiche push e scraper automatico

Per ricevere le notifiche e gli aggiornamenti automatici servono **GitHub** (gratis) e **Firebase** (gratis). I passaggi dettagliati sono nella **[GUIDA_PASSO_PASSO.md](GUIDA_PASSO_PASSO.md)**.

In sintesi:
1. Carichi il progetto su un repository GitHub.
2. Imposti i *secret* `FIREBASE_SERVICE_ACCOUNT_JSON` (per le push) ed eventuali altri.
3. GitHub esegue `scripts/scraper/run.js` ogni 6 ore, aggiorna `data/offerte.json` e `data/novita.json`, poi invia le push con `scripts/scraper/send-push.js`.
4. L'app (anche come APK Android) scarica i nuovi dati e riceve le notifiche.

### Provare lo scraper sul tuo PC

```bash
cd scripts
npm install
npm run scraper:dry     # anteprima, non salva nulla
npm run scraper:run     # salva data/offerte.json e data/novita.json
```

---

## Importante

- Gli annunci e le scadenze **cambiano spesso**: verifica sempre il link ufficiale prima di candidarti.
- Alcuni grandi portali (Indeed, LinkedIn, Subito) bloccano i robot o caricano gli annunci con JavaScript: per quelli usa i link nella colonna "Portali" e poi **➕ Aggiungi offerta**.
- Il file con le chiavi Firebase **non va mai** caricato pubblicamente (è già escluso nel `.gitignore`).

---

© 2026 **Maurizio Tavilla**. Tutti i diritti riservati.
