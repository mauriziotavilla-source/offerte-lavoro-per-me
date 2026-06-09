# Guida passo-passo (per chi parte da zero)

Ciao Maurizio! Questa guida ti accompagna con calma, senza dare nulla per scontato.
Leggila una volta tutta, poi rifalla con le mani sulla tastiera.

---

## 1. Provare subito l'app sul tuo PC

1. Assicurati di avere **Python** installato. Per controllare, apri il **Prompt dei comandi** e scrivi:

   ```
   python --version
   ```

   Se vedi un numero (es. `Python 3.12`), sei a posto. Se dà errore, scarica Python da
   <https://www.python.org/downloads/> e durante l'installazione spunta **"Add Python to PATH"**.

2. Apri la cartella del progetto e fai **doppio clic su `AVVIA_APP.bat`**.
   Si apre una finestra nera (è il "server", lasciala aperta) e poi il browser con l'app.

3. Per chiudere: chiudi la finestra nera.

**Cosa puoi già fare senza altro:** filtrare le offerte di esempio, salvarne nei preferiti,
usare la checklist, aggiungere offerte trovate a mano, esportare in CSV, stampare in PDF.

> Le notifiche push e l'aggiornamento automatico richiedono i passi successivi (GitHub + Firebase).

---

## 2. Personalizzare il tuo profilo

Tutto parte dal file **`data/profilo.json`**: l'ho già compilato leggendo il tuo curriculum
(titoli, parole chiave come "contabile", "ragioniere", "categorie protette", città Messina…).

Se vuoi aggiungere o togliere parole chiave, apri il file con un editor di testo e modifica
gli elenchi `parole_chiave_match` (parole che ti interessano) e `parole_chiave_escludi`
(parole da evitare). Salva e riavvia l'app.

---

## 3. Aggiungere offerte a mano (subito utile)

1. Nell'app clicca **➕ Aggiungi offerta**.
2. Quando trovi un annuncio o un concorso interessante su un portale (i link sono nella
   colonna a destra "Portali"), copia il **titolo**, il **link** e i dati principali.
3. Incollali nel modulo, scegli il **tipo** (Lavoro / Concorso / Categoria protetta) e
   le **aree**. Salva.

Le offerte aggiunte restano salvate sul tuo PC con il badge **Tua**.

---

## 4. (Avanzato) Aggiornamento automatico + notifiche push

Questa parte richiede due servizi gratuiti: **GitHub** e **Firebase**.
È la stessa logica del tuo progetto "Fonti di Finanziamento".

### 4.1 Mettere il progetto su GitHub

1. Crea un account su <https://github.com> (se non ce l'hai).
2. Crea un **nuovo repository** (es. `offerte-lavoro-per-me`).
3. Carica i file di questa cartella nel repository.
   (Puoi farlo dal sito con "Add file → Upload files", oppure con Git.)

> Il file `.gitignore` evita già di caricare le chiavi segrete e `node_modules`.

### 4.2 Far girare lo scraper da solo (GitHub Actions)

Nel progetto c'è già `.github/workflows/scraper.yml`: dice a GitHub di eseguire lo scraper
**ogni 6 ore**. Dopo aver caricato il progetto:

- Vai sul repository → scheda **Actions** → autorizza i workflow.
- Puoi anche avviarlo a mano con **"Run workflow"** (pulsante a destra) per provarlo.

Lo scraper aggiorna `data/offerte.json` e `data/novita.json` e fa un commit automatico.

### 4.3 Collegare l'app agli aggiornamenti online

1. Apri `data/aggiornamento.json`.
2. Metti in `offerte_url` l'indirizzo **RAW** del tuo `offerte.json`, ad esempio:

   ```
   https://raw.githubusercontent.com/TUO-UTENTE/offerte-lavoro-per-me/main/data/offerte.json
   ```

3. Imposta `"abilitato": true`.

Da quel momento l'app, all'avvio e con il pulsante **🔄 Controlla aggiornamenti online**,
scarica le offerte più recenti.

### 4.4 Notifiche push (Android) con Firebase

Le notifiche push arrivano solo nell'**app Android** (APK) compilata con Firebase.
Sul browser e sul PC vedrai comunque il badge **New** sulle offerte nuove.

Passi principali:

1. Vai su <https://console.firebase.google.com> e crea un progetto (gratis).
2. Crea una **chiave service account**: Impostazioni progetto → Account di servizio →
   *Genera nuova chiave privata*. Scarichi un file `.json`.
3. Su GitHub: repository → **Settings → Secrets and variables → Actions → New repository secret**.
   - Nome: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - Valore: incolla **tutto il contenuto** del file `.json`.
4. Lo scraper, quando trova nuove offerte, invia le push ai "topic":
   - `offerte_lavoro`
   - `concorsi_pubblici`
   - `categorie_protette`
5. L'app Android si iscrive ai topic in base alle caselle che spunti nel pannello
   "Notifiche Android".

> Per **trasformare l'app in APK Android** si usa Capacitor (come in Fonti di Finanziamento).
> È un passaggio in più: quando vorrai farlo, chiedimelo e ti preparo i file (cartella `mobile/`).

---

## 5. Provare lo scraper sul tuo PC (facoltativo)

Serve **Node.js** (<https://nodejs.org>). Poi:

```
cd scripts
npm install
npm run scraper:dry      (anteprima: non salva nulla)
npm run scraper:run      (salva i file aggiornati)
```

E per simulare una notifica di prova (serve la chiave Firebase nelle variabili d'ambiente):

```
npm run scraper:push:test
```

---

## 6. Domande frequenti

**Devo lasciare il PC acceso per ricevere le offerte?**
No: lo scraper gira su GitHub, nel cloud. Tu ricevi le notifiche sul telefono.

**Le offerte di esempio sono reali?**
Sono modelli realistici per farti vedere come funziona. Le offerte vere arrivano dallo
scraper e da quelle che aggiungi tu.

**Perché alcune fonti dello scraper sono "enabled: false"?**
Perché quei portali (es. inPA, Jobmetoo) caricano i dati con JavaScript o bloccano i robot.
Restano come link da consultare a mano. Possiamo attivare/aggiungere fonti man mano.

---

Se ti blocchi su un passaggio, scrivimi a che punto sei e ti guido. Buona ricerca! 💼
