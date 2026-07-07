# API Inventory

## Backend Routes (FastAPI)

| Method | Route | Purpose | Used By | Auth Required |
|---|---|---|---|---|
| `GET` | `/health` | Health check and ML model readiness status | Monitoring | No |
| `POST`| `/dogs` | Register a new dog profile | Frontend (`/enroll`) | Yes (Supabase JWT) |
| `GET` | `/dogs` | List all dogs owned by the authenticated user | Frontend | Yes (Supabase JWT) |
| `POST`| `/dogs/{dog_id}/enroll` | Process image, extract nose embedding, and save to DB | Frontend (`/enroll`) | Yes (Supabase JWT) |
| `POST`| `/dogs/identify` | Process image, extract nose embedding, and find matching dog | Frontend (`/identify`) | Yes (Supabase JWT) |

*Note: All `/dogs/*` routes require a valid Supabase JWT token passed via the Authorization header.*
