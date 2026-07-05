# Supabase Keep-Alive

Free-tier Supabase projects auto-pause after 7 days of inactivity. To prevent this, we have set up a scheduled GitHub Actions workflow that pings the Supabase project.

## How it works
The workflow `.github/workflows/supabase_keepalive.yml` runs every 3 days. It makes a lightweight authenticated request to the Supabase REST API (querying the `dogs` table with a limit of 1). This counts as activity and keeps the project active.

## Required Secrets
To make this work, you must add the following repository secrets to your GitHub repository:
- `SUPABASE_URL`: The URL of your Supabase project (e.g., `https://your-project-ref.supabase.co`)
- `SUPABASE_ANON_KEY`: The anonymous key for your Supabase project

Go to your repository settings -> Secrets and variables -> Actions to add these secrets.
