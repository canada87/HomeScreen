# 🏠 HomeScreen - Self-Hosted Personal Dashboard

**HomeScreen** è una web app elegante, moderna e self-hostabile, progettata come pannello di controllo centrale per il tuo server domestico o VPS. Ti permette di raccogliere link del browser organizzati in categorie, creare post-it rapidi e tenere traccia di liste di attività da completare.

L'applicazione supporta **multi-utenza** ed è dotata di un **pannello amministratore** per gestire gli accessi. È ottimizzata per girare in un singolo container Docker ed essere esposta in sicurezza su internet tramite **Cloudflare Tunnels**.

---

## ✨ Caratteristiche principali

*   **Design Premium & Glassmorphism**: Un'interfaccia scura, moderna e responsiva ispirata alle ultime tendenze di design, arricchita da transizioni e micro-animazioni.
*   **Dashboard Multiple**: Possibilità di creare più dashboard tematiche (es. *Lavoro*, *Casa*, *Intrattenimento*) ed effettuare il ciclo/switch rapido tra di esse tramite schede nell'header.
*   **Widget Bookmarks (Collegamenti)**:
    *   Visualizzazione personalizzabile in **Griglia** (icone grandi) o **Lista** (riga compatta con URL visibile).
    *   Risoluzione automatica della Favicon del sito tramite proxy backend (per evitare blocchi CORS).
    *   Supporto a icone preimpostate.
    *   Possibilità di caricare **immagini personalizzate** (JPEG/PNG) ridimensionate in Base64 e salvate direttamente nel database per la massima portabilità.
*   **Widget Post-It (Note rapide)**:
    *   Note testuali con salvataggio automatico (in tempo reale sul fuoco o con un ritardo di digitazione di 1 secondo).
    *   Scelta della palette colore (Giallo, Blu, Verde, Rosa, Viola, Grigio Scuro).
*   **Widget Todo (Checklist)**:
    *   Liste puntate di attività con caselle di controllo.
    *   Indicatore visivo e percentuale di completamento dinamici.
*   **Autenticazione & Gestione Utenti**:
    *   Autenticazione sicura tramite token JWT.
    *   **Pannello Admin**: Accessibile solo agli amministratori, consente di creare, modificare o eliminare utenti e reimpostare le password.

---

## 🏗️ Struttura del Progetto

Il progetto utilizza un'architettura monorepo pulita:

```
HomeScreen/
├── Dockerfile                  # Costruisce il frontend ed assembla il server Express
├── docker-compose.yml          # Configurazione container con volume persistente
├── package.json                # Script di sviluppo per la radice
├── backend/
│   ├── db.js                   # Schema SQLite e query asincrone
│   ├── server.js               # Server Node.js Express & API REST
│   └── public/                 # File compilati di React (creati in build time)
└── frontend/
    ├── src/                    # Codice sorgente React
    │   ├── App.jsx             # Controller viste, login e switch dashboard
    │   ├── index.css           # Variabili CSS ed estetica glassmorphic
    │   ├── components/         # Componenti UI (Dashboard, Widget, AdminPanel)
    │   └── utils/api.js        # Chiamate API centralizzate
    └── package.json            # Dipendenze frontend (React, Lucide icons, Vite)
```

---

## 🚀 Come Avviare l'Applicazione

### Metodo A: Con Docker Compose (Consigliato per il Self-Hosting)

Questa opzione compila l'applicazione all'interno di un unico container Docker leggero ed espone la porta `3000`.

1.  Assicurati che Docker e Docker Compose siano installati sul server.
2.  Avvia l'applicazione con il comando:
    ```bash
    docker compose up -d --build
    ```
3.  Il servizio sarà disponibile all'indirizzo `http://localhost:3000`. Puoi configurare il tuo tunnel Cloudflare per puntare a questa porta.
4.  Tutti i dati (utenti, preferenze, post-it e icone personalizzate) verranno memorizzati nel file `./data/homescreen.db`. Eseguire il backup del servizio significa copiare questo singolo file!

### Metodo B: Esecuzione in Locale per lo Sviluppo (npm)

Se desideri testare o modificare il codice in locale senza Docker:

1.  Dalla cartella principale del progetto, installa tutte le dipendenze per frontend e backend:
    ```bash
    npm run install:all
    ```
2.  Avvia il backend (in ascolto sulla porta `3000`):
    ```bash
    npm run dev:backend
    ```
3.  Avvia il server di sviluppo frontend Vite (in ascolto su `http://localhost:5173` con HMR):
    ```bash
    npm run dev:frontend
    ```

---

## 🔑 Credenziali di Primo Accesso

Al primo avvio, l'applicazione inizializza automaticamente un utente amministratore predefinito:

*   **Username**: `admin`
*   **Password**: `adminadmin`

> [!WARNING]
> Per motivi di sicurezza, accedi immediatamente e cambia la password dell'amministratore cliccando sull'icona della chiave (**Change Password**) in alto a destra nell'header.

---

## 🌐 Configurazione con Cloudflare Tunnel

Se utilizzi Cloudflare Tunnel per esporre la dashboard all'esterno:
1.  Nel portale Cloudflare Zero Trust, crea un nuovo Tunnel.
2.  Associa un tuo dominio o sottodominio (es. `dashboard.tuodominio.it`).
3.  Configura l'indirizzo del servizio come:
    *   **Type**: `HTTP`
    *   **URL**: `localhost:3000` (o l'IP privato del server su cui gira Docker, es. `192.168.1.100:3000`).
