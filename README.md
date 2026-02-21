# TaskFlow Gratuit (gestion de taches)

Cette application repond au besoin :
- lister des taches,
- les acquitter,
- conserver un historique accessible depuis n'importe quel ordinateur.

## Stack 100% gratuite

- **Front-end**: HTML/CSS/JS statique.
- **Base de donnees cloud**: **Supabase** (plan gratuit).
- **Hebergement**: GitHub Pages / Netlify / Vercel (gratuits).

## 1) Creer la base Supabase

1. Creez un compte gratuit sur https://supabase.com
2. Creez un projet.
3. Dans l'editeur SQL, executez:

```sql
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.tasks enable row level security;

create policy "Public read tasks"
on public.tasks for select
using (true);

create policy "Public insert tasks"
on public.tasks for insert
with check (true);

create policy "Public update tasks"
on public.tasks for update
using (true)
with check (true);
```

> Option simple: tout le monde avec l'URL du site peut lire/ecrire. Si vous voulez securiser, ajoutez une authentification Supabase ensuite.

## 2) Configurer l'application (fixe dans le code)

1. Ouvrez `app.js`.
2. Renseignez les constantes :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Rechargez la page.

Exemple:

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJ...";
```

## 3) Deployer gratuitement

- Poussez ce dossier sur GitHub.
- Activez GitHub Pages (ou connectez le repo a Netlify/Vercel).
- Votre historique sera partage entre appareils car les donnees sont dans Supabase (cloud).
