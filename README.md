# Gestionnaire de taches partage

Cette application fonctionne en mode client + serveur:
- Frontend: `index.html`, `styles.css`, `app.js`
- Backend: `server.js`
- Stockage: JSON sur disque serveur (`DATA_DIR/tasks.json`)

## Lancer en local

Prerequis: Node.js 18+

```powershell
cd c:\Users\MA2M_2\App
npm start
```

Puis ouvrir `http://localhost:3000`.

## Acces depuis n'importe quel ordinateur via Internet (Render)

Le projet est pret avec `render.yaml`.

1. Pousse ce dossier sur un repo GitHub.
2. Va sur Render: `https://dashboard.render.com`.
3. Clique `New` puis `Blueprint`.
4. Connecte ton repo et valide le deploy.
5. Render va creer:
- un service web Node
- un disque persistant monte sur `/var/data`
- la variable `DATA_DIR=/var/data`

Une fois le deploy termine, tu obtiens une URL publique du type:
- `https://task-manager-shared.onrender.com`

Tous les ordinateurs (meme hors reseau local) utilisent cette URL et partagent le meme historique.

## Option VPS (alternative)

Si tu preferes un VPS (OVH/Hetzner/DigitalOcean):
1. Copier le projet sur le serveur.
2. Lancer avec `npm start` (ou PM2/systemd).
3. Mettre Nginx/Caddy devant avec HTTPS.
4. Pointer un nom de domaine.
