# API Inventory

## Backend Routes (FastAPI)

| Method | Route | Purpose | Used By | Auth Required |
|---|---|---|---|---|
| `GET` | `/api/health` | Health check and ML model readiness status | Monitoring | No |
| `GET` | `/api/stats` | Retrieve global registry stats | Frontend | No |
| `POST`| `/api/dogs` | Register a new dog profile | Frontend (`/enroll`) | Yes (Supabase JWT) |
| `GET` | `/api/dogs` | List all dogs owned by the authenticated user | Frontend | Yes (Supabase JWT) |
| `GET` | `/api/dogs/{dog_id}` | Get full profile of a specific dog | Frontend | Yes (Supabase JWT) |
| `PUT` | `/api/dogs/{dog_id}` | Update dog profile | Frontend | Yes (Supabase JWT) |
| `DELETE`| `/api/dogs/{dog_id}`| Delete a dog profile | Frontend | Yes (Supabase JWT) |
| `POST`| `/api/dogs/{dog_id}/enroll` | Process image, extract nose embedding, and save to DB | Frontend (`/enroll`) | Yes (Supabase JWT) |
| `POST`| `/api/dogs/identify` | Process image, extract nose embedding, and find matching dog | Frontend (`/identify`) | No |
| `POST`| `/api/validate-nose` | Validate if an image contains a readable dog nose | Frontend | No |
| `GET` | `/api/user/scan-logs` | Get the user's historical scan activity | Frontend | Yes (Supabase JWT) |
| `GET` | `/api/dogs/{dog_id}/health` | Get the health summary (allergies, vaccines, weight) for identify | Frontend | Yes (Supabase JWT) |
| `GET` | `/api/dogs/{dog_id}/health/{type}` | List health records of a specific type (allergies, visits, etc.) | Frontend | Yes (Supabase JWT) |
| `POST`| `/api/dogs/{dog_id}/health/{type}` | Create a new health record | Frontend | Yes (Supabase JWT) |
| `PUT` | `/api/dogs/{dog_id}/health/{type}/{record_id}` | Update an existing health record | Frontend | Yes (Supabase JWT) |
| `DELETE`| `/api/dogs/{dog_id}/health/{type}/{record_id}` | Delete a health record | Frontend | Yes (Supabase JWT) |

*Note: The `/api/dogs/identify` and `/api/validate-nose` endpoints are public and do not require authentication to facilitate rapid real-time scanning.*
