# Routing Intelligence

## Frontend Routes (Next.js App Router)
| Route | File | Purpose | Auth Required |
|---|---|---|---|
| `/` | `app/page.tsx` | Landing page / Home | No |
| `/login` | `app/login/page.tsx` | User authentication | No |
| `/enroll` | `app/enroll/page.tsx` | Register a new dog and capture nose print | Yes |
| `/identify` | `app/identify/page.tsx` | Identify a dog from a photo | Yes |

*Note: Frontend routes assume typical Next.js structure based on directory names (`login`, `enroll`, `identify`, `components`).*
