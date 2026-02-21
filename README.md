# TaskFlow Gratuit (gestion de taches)

Cette application permet de :
- lister des taches,
- les acquitter,
- conserver un historique par utilisateur (connexion Google).

## Stack 100% gratuite

- **Front-end**: HTML/CSS/JS statique.
- **Base de donnees cloud**: **Supabase** (plan gratuit).
- **Hebergement**: GitHub Pages / Netlify / Vercel (gratuits).

## 1) Configurer la base et la securite (RLS)

Dans Supabase > SQL Editor, executez :

```sql
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_user_id_idx on public.tasks(user_id);

alter table public.tasks enable row level security;

drop policy if exists "Users can read own tasks" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;
drop policy if exists "Users can update own tasks" on public.tasks;

create policy "Users can read own tasks"
on public.tasks for select
using (auth.uid() = user_id);

create policy "Users can insert own tasks"
on public.tasks for insert
with check (auth.uid() = user_id);

create policy "Users can update own tasks"
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 2) Activer la connexion Google

1. Dans Supabase, ouvrez `Authentication > Providers > Google`.
2. Creez un OAuth Client Google dans Google Cloud Console.
3. Dans Google Cloud, ajoutez cette URI de redirection autorisee :
   - `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
4. Copiez `Client ID` et `Client Secret` dans Supabase (provider Google).
5. Dans Supabase `Authentication > URL Configuration` :
   - `Site URL` = URL de ton site (ex: GitHub Pages)
   - `Redirect URLs` = URL de ton site (et URL locale si besoin)

## 3) Configurer l'application

Dans `app.js`, renseignez :

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJ...";
```

La `anon key` est publique cote front. Ne jamais exposer la `service_role key`.

## 4) Deployer gratuitement

- Poussez ce dossier sur GitHub.
- Activez GitHub Pages (ou connectez le repo a Netlify/Vercel).
- Connectez-vous avec Google depuis le site deploye.

## 5) Installer comme web app (PWA)

- Ouvrez le site sur Chrome/Edge.
- Cliquez sur `Installer l'app` (ou via le menu du navigateur).
- L'application s'ouvre ensuite comme une app autonome (sans barre d'onglets).
