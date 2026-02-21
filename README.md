# TaskFlow Gratuit (gestion de tâches)

Cette application répond au besoin :
- lister des tâches,
- les acquitter,
- conserver un historique accessible depuis n'importe quel ordinateur.

## Stack 100% gratuite

- **Front-end**: HTML/CSS/JS statique.
- **Base de données cloud**: **Supabase** (plan gratuit).
- **Hébergement**: GitHub Pages / Netlify / Vercel (gratuits).

## 1) Créer la base Supabase

1. Créez un compte gratuit sur https://supabase.com
2. Créez un projet.
3. Dans l'éditeur SQL, exécutez:

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

> Option simple: tout le monde avec l'URL du site peut lire/écrire. Si vous voulez sécuriser, ajoutez une authentification Supabase ensuite.

## 2) Configurer l'application

1. Ouvrez le site.
2. Cliquez sur **Configurer Supabase**.
3. Renseignez:
   - l'URL du projet (`Project URL`),
   - la clé publique (`anon public key`).

Ces valeurs sont sauvegardées dans le navigateur local (`localStorage`).

## 3) Déployer gratuitement

- Poussez ce dossier sur GitHub.
- Activez GitHub Pages (ou connectez le repo à Netlify/Vercel).
- Votre historique sera partagé entre appareils car les données sont dans Supabase (cloud).
