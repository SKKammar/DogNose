# Dog Nose-Print Biometric Identification System
## Complete Build Guide — Architecture, Data, Backend, Frontend, Security, Testing, Deployment

---

## 1. Project Overview

A web-based (PWA) biometric identification system that identifies individual dogs from a photo of
their nose, the way a fingerprint identifies a person. A user captures a live photo of a dog's
nose through the browser; the system detects the nose, extracts a biometric embedding, compares it
against a database of enrolled dogs using vector similarity search, and returns the best match with
a confidence score — or a clear "no match found" if the dog isn't enrolled.

**Core pipeline:** Nose detection (YOLOv8n) → Preprocessing (glare removal, contrast normalization)
→ Embedding extraction (EfficientNet-B3 + ArcFace) → Vector similarity search (pgvector) → Match
decision (calibrated threshold).

**What makes this project stand out:** a genuinely evaluated biometric system (FAR/FRR/EER/ROC/CMC,
not just "accuracy"), a real anti-spoofing/liveness layer, a polished installable web app instead of
a bare notebook demo, and an honest, well-reasoned data strategy you can defend in a viva.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Next.js PWA)                        │
│  Live camera capture → sharpness/liveness gate → upload              │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ HTTPS
┌───────────────────────────────▼───────────────────────────────────────┐
│                      BACKEND API (FastAPI, thin)                     │
│  Auth check (Supabase) → validate upload → run inference             │
└───────┬─────────────────────────────────────────────┬─────────────────┘
        │                                              │
┌───────▼────────────┐                    ┌────────────▼───────────────┐
│  INFERENCE ENGINE   │                    │   SUPABASE                 │
│  ONNX Runtime:      │                    │  - Postgres + pgvector     │
│  1. YOLOv8n detect  │                    │  - Auth (email/OAuth)      │
│  2. Preprocess crop │                    │  - Storage (nose images)   │
│  3. EfficientNet-B3 │◄──embedding────────┤  - Row Level Security      │
│     + ArcFace embed │    (512-dim vec)   │                            │
└─────────────────────┘                    └────────────────────────────┘
```

Training happens offline in Colab/Kaggle notebooks; only the trained, exported ONNX weights are
deployed. The backend never trains — it only runs inference and manages data.

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Nose detector | YOLOv8n (`ultralytics`) | Small, fast, sufficient for single-class detection |
| Annotation/augmentation | Roboflow (free tier) | Handles labeling UI, augmentation, train/val/test split |
| Embedding model | EfficientNet-B3 backbone (ImageNet-pretrained, `timm`) + ArcFace head for training only | Standard transfer learning; ArcFace head is discarded at inference, only the embedding output is used |
| Training compute | Google Colab (free T4) or Kaggle Notebooks (~30 GPU-hrs/week free) | No local CUDA/driver setup required |
| Model export | ONNX (`torch.onnx.export`) | Lightweight runtime dependency, faster cold start than full PyTorch in production |
| Backend API | FastAPI (Python), thin — auth delegated to Supabase | Handles upload validation, inference orchestration, rate limiting |
| Database | Supabase Postgres + pgvector extension | Managed, free tier, native vector similarity search |
| Auth | Supabase Auth (email + optional OAuth) | No hand-rolled JWT/password code |
| File storage | Supabase Storage | Stores processed nose crops (not full-res originals, to save quota) |
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS | Installable PWA, works on desktop and mobile browsers |
| Frontend hosting | Vercel (free tier) | Automatic HTTPS, required for camera access |
| Backend/inference hosting | Render free tier or Hugging Face Spaces (free CPU) | Accept cold-start tradeoff; mitigated in UI (Section 10) |
| Liveness/anti-spoofing | Live camera capture only (no gallery upload) + short motion/focus-shift requirement + sharpness gate | Blocks the obvious "photo of a photo" attack without a full research-grade PAD model |
| CI | GitHub Actions (free) | Scheduled Supabase keep-alive ping + basic test runs |

---

## 4. Data Strategy

### 4.1 Plan A — Public dataset validation first (Weeks 1–2)

1. Download the CVPR 2022 Pet Biometric Challenge dataset (Kaggle) and train the full pipeline
   end-to-end on it (detector, embedder, matcher).
2. In parallel, shoot **5–8 dogs of your own, across 2 separate sessions each**, as an
   out-of-domain check. This is cheap now and tells you the one thing that actually matters: does
   a model trained on someone else's data generalize to your camera, your lighting, your dogs?
3. **Decision checkpoint (end of Week 2):** evaluate the public-trained model against your own
   small out-of-domain set. If FAR/FRR/EER are acceptable and the failure cases (Section 10) look
   manageable, continue on the fast track: fine-tune on public data + your 5–8 dogs. If not,
   branch to Plan B — you've only spent ~2 weeks, and your pipeline/eval code carries over directly.

### 4.2 Plan B — Fully self-collected (fallback)

1. Keep the ImageNet-pretrained EfficientNet-B3 backbone regardless — this is generic pretrained
   visual features, not "someone else's nose dataset," and dropping it would need far more data
   than is feasible to collect solo in this timeframe.
2. Target **25–35 dogs total** (reuse the 5–8 already shot), 30–40 images each, across at least
   2 sessions per dog.
3. Split train/val/test **by session**, never mixing photos of the same dog from the same sitting
   across splits — this is the single most important rule in this whole data plan (see Section
   8.2 for why).
4. Use heavy augmentation (`albumentations`: rotation, brightness/contrast jitter, blur, crop) to
   compensate for the smaller, single-source dataset.
5. Budget 5–6 weeks specifically for this phase.

### 4.3 Data collection protocol (applies to both plans)

- **Per dog:** 30–40 photos across ≥2 sessions on different days.
- **Per session, vary:** lighting (indoor/outdoor/overcast/direct sun), angle (front-on, slight
  left/right), distance (close crop and slightly further), wet vs. dry nose state.
- **Consent:** verbal consent from the owner for any dog that isn't your own, especially at a
  shelter or clinic. Note in your documentation that this is a prototype/educational system.
- **Labeling:** bounding box around the nose only (for YOLO training) via Roboflow's free
  annotation tool — do not hand-write annotation scripts.
- **Storage during collection:** keep raw originals locally/off-cloud until preprocessing is
  finalized; only upload processed crops to Supabase Storage to conserve the free quota.

---

## 5. Model Pipeline Details

### 5.1 Detection (YOLOv8n)
- Single class: `nose`.
- Train on Roboflow-annotated, Roboflow-augmented images (rotation, brightness, mosaic).
- Confidence threshold tuned so that low-confidence detections return "no nose detected" rather
  than a bad crop — a false detection here silently corrupts everything downstream.

### 5.2 Preprocessing (your original design — keep as-is)
- HSV-based glare/specular highlight detection + inpainting.
- CLAHE (contrast-limited adaptive histogram equalization) for texture enhancement.
- Bilateral filter for noise reduction while preserving nose-print edges.
- Resize to the embedding model's expected input size (e.g. 224×224 or 300×300 for B3), with the
  **exact same normalization (mean/std) used in training reproduced exactly in the inference code**
  — a silent mismatch here is one of the most common causes of quietly degraded accuracy.

### 5.3 Embedding (EfficientNet-B3 + ArcFace)
- Backbone: EfficientNet-B3, ImageNet-pretrained, fine-tuned.
- Training head: ArcFace margin loss over your dog identity classes — **used only during
  training**. At inference, only the backbone's embedding output (a fixed-length vector, e.g.
  512-dim) is used; the classifier head is discarded.
- Output: L2-normalized embedding vector, stored in `pgvector` for cosine similarity search.

### 5.4 Matching
- Cosine similarity between the query embedding and all stored embeddings.
- Return top-3 candidates with similarity scores.
- Apply a **calibrated threshold** (from your EER analysis, Section 6) to decide "match" vs.
  "no match" — never force a best-guess result when nothing clears the threshold.

---

## 6. Evaluation Plan

Run a full biometric evaluation, not just classification accuracy:
- **FAR (False Acceptance Rate)** and **FRR (False Rejection Rate)** across a range of thresholds.
- **EER (Equal Error Rate)** — the threshold where FAR = FRR; use this as your default operating
  threshold, recalculated on your actual final dataset, not copied from a paper.
- **ROC curve** — visualize the FAR/FRR tradeoff; a good artifact for your report and pitch.
- **CMC curve (Cumulative Match Characteristic)** — how often the correct dog appears in the
  top-1/top-3/top-5 candidates; useful for the "top-3 suggestions" UI feature (Section 8).
- **Test set composition:** must include a genuinely unseen dog (0% chance of appearing in
  training) to validate real-world "no match" behavior, and ideally one same-breed/littermate pair
  to honestly report your hardest-case performance rather than only easy, visually distinct dogs.

---

## 7. Backend & Database

### 7.1 Supabase schema (core tables)

```sql
create table dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  name text not null,
  breed text,
  created_at timestamptz default now()
);

create table nose_prints (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid references dogs(id) on delete cascade not null,
  embedding vector(512) not null,
  embedding_version text default 'v1',
  image_url text,
  captured_at timestamptz default now()
);

create index on nose_prints using ivfflat (embedding vector_cosine_ops);
```

The `embedding_version` column costs nothing now and prevents a very confusing future bug: if you
retrain the embedder later, old stored vectors live in a different embedding space than new ones
and will silently match badly — versioning lets you detect and re-embed instead of getting quietly
wrong results.

### 7.2 Row Level Security (mandatory, not optional)

Supabase auto-generates a public REST API over these tables. Without RLS, anyone with your
project's anon key (visible in your frontend bundle — this is normal) can read or write `dogs` and
`nose_prints` directly, bypassing your app entirely.

```sql
alter table dogs enable row level security;
alter table nose_prints enable row level security;

create policy "Users manage their own dogs"
  on dogs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users manage their own dogs' nose prints"
  on nose_prints for all
  using (exists (select 1 from dogs where dogs.id = nose_prints.dog_id and dogs.owner_id = auth.uid()))
  with check (exists (select 1 from dogs where dogs.id = nose_prints.dog_id and dogs.owner_id = auth.uid()));
```

- Only the **anon key** goes in frontend code. The **service role key** (which bypasses RLS) stays
  in backend environment variables only, never committed to git.
- If your Supabase project was created after May 30, 2026, confirm explicit Postgres grants for
  PostgREST access are configured — otherwise auto-generated API calls fail with permission errors
  that look like bugs in your own code.

### 7.3 API endpoints (FastAPI)

```
POST /auth/register        -> delegates to Supabase Auth
POST /auth/login           -> delegates to Supabase Auth
POST /dogs                 -> register a new dog (owner-scoped, via RLS)
POST /dogs/{id}/enroll      -> upload nose photo(s), extract + store embedding
POST /dogs/identify         -> upload a nose photo, return top-3 matches + confidence
GET  /dogs                 -> list the current user's enrolled dogs
```

All request bodies use Pydantic models (never untyped primitive function parameters — FastAPI
treats those as query parameters, which silently breaks JSON POST requests).

```python
from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
```

### 7.4 Upload validation & rate limiting (mandatory)

```python
MAX_FILE_SIZE = 8 * 1024 * 1024  # 8MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

if nose_image.content_type not in ALLOWED_TYPES:
    raise HTTPException(400, "Unsupported file type")
contents = await nose_image.read()
if len(contents) > MAX_FILE_SIZE:
    raise HTTPException(413, "File too large")
```

Add rate limiting on `/dogs/identify` (e.g. `slowapi`, a few lines) so one person refreshing
repeatedly can't exhaust your free inference compute or Supabase egress before real users/judges
get to try it.

---

## 8. Frontend (Next.js PWA)

### 8.1 Core screens
- **Enroll flow:** capture 3–5 live photos of a dog's nose, name/breed entry, confirmation.
- **Identify flow:** live camera capture → animated "detecting nose → extracting features →
  matching" progress sequence → result screen showing top-3 candidates with confidence scores
  (never a bare yes/no).
- **"How this works" panel:** plain-language explanation of detection → embedding → similarity
  matching. This consistently reads well to evaluators and doubles as your interview talking points.

### 8.2 Visual design
- Dark, cinematic aesthetic (consistent with your existing portfolio brand) — subtle scan-line
  animation during capture, animated confidence meter, smooth card-reveal on match.
- Clear, friendly states for every non-happy-path: permission denied, no nose detected, no match
  found, network error, server cold-start ("waking up the matching engine, one moment…").

### 8.3 PWA/camera specifics
- `getUserMedia` requires a secure context (HTTPS or `localhost`) — will silently fail on plain
  `http://` over a local network. Always test against your deployed Vercel HTTPS URL.
- iOS Safari has known quirks with camera capture inside installed PWAs across versions — test on
  a real iPhone, not just a desktop emulator.
- Always provide a graceful fallback to file upload if camera permission is denied (accepting
  reduced liveness guarantees), rather than a dead-end screen.
- Handle offline/slow network explicitly: a timeout with a retry button, not an infinite spinner.

---

## 9. Anti-Spoofing / Liveness (simplified, honest scope)

Full Presentation Attack Detection is a research problem on its own; this system implements a
practical, honestly-scoped version:
- Camera capture only — no gallery/file upload in the primary identify flow (file upload is only
  the degraded fallback if camera access is denied, and should be clearly labeled as such).
- Require a brief (~1 second) focus-shift or motion sample before the final capture, to make a
  static printed photo harder to pass off.
- Reject images below a sharpness threshold (Laplacian variance) at capture time, not after upload.
- Document this scope explicitly (in your README and viva prep) as "basic liveness checks," not
  "full anti-spoofing" — an honest, defensible claim beats an inflated one that falls apart under
  a direct question.

---

## 10. Edge Cases and Failure Modes (full list)

1. **Data collection is the top project risk, not the code.** Consistent, in-focus nose photos
   from real dogs are hard to get regardless of which data plan you're on. Budget 2–3x the time
   you expect for this phase.
2. **Session leakage.** If a dog's train and validation photos come from one sitting, the model
   can learn to recognize the session (background/lighting), not the nose — producing inflated
   validation accuracy that collapses on real-world use. Always split by session per dog.
3. **Open-set matching correctness.** The ArcFace classifier head must never be used at inference
   to decide identity — only the embedding + cosine similarity + threshold. A genuinely new dog
   must produce "no match," not a forced best guess. The UI must visually distinguish "no match"
   from "low-confidence match."
4. **Embedding versioning.** Retraining the embedder invalidates previously stored embeddings
   silently (they don't error, they just match badly). The `embedding_version` column exists for
   exactly this reason — use it.
5. **Dogs the model will genuinely struggle with:**
   - Very light/pink-pigmented noses (some Labs, Dalmatians, merles) — lower texture contrast,
     lower confidence expected; don't pick these for a live demo.
   - Puppies — nose texture/pigmentation still developing; scope the system for adult dogs and
     say so explicitly.
   - Littermates/close relatives — genuinely harder to distinguish; include one such pair in your
     test set for an honest reported metric.
   - A nose photographed right after drinking water — worst-case glare scenario; test this
     specifically, not just "wet nose" generally.
6. **Non-nose or multi-dog images.** Low detector confidence should produce a clear "no nose
   detected, try again" message, not a bad crop fed silently into the embedder. If multiple dogs
   appear in frame, guide the user ("one dog per photo") rather than silently picking one.
7. **Backend input validation.** Unvalidated file size/type on uploads can exhaust free storage
   or bandwidth quota from a single bad or malicious request — validate both before processing.
8. **Supabase security.** Missing Row Level Security exposes your tables via the auto-generated
   public REST API to anyone holding the anon key (which is public by design in frontend code).
   RLS must be enabled and tested, not assumed.
9. **Secrets hygiene.** The Supabase service role key must never appear in frontend code or git
   history — only the anon key is public-safe.
10. **Rate limiting.** Without it, repeated requests during a demo or from an outside visitor can
    exhaust free-tier inference compute or database egress.
11. **Free-tier infrastructure quirks:** Supabase projects auto-pause after 7 days of zero
    activity (fix: a scheduled GitHub Actions ping every few days); free inference hosts (Render/HF
    Spaces) have cold starts of 10–30 seconds after idling (fix: warm-up request before any demo,
    and a UI state that explains the wait rather than looking frozen).
12. **Camera/PWA edge cases:** HTTPS requirement for `getUserMedia`, iOS Safari quirks inside
    installed PWAs, permission-denial fallback, offline/slow-network handling — all listed in
    Section 8.3, all worth testing on real devices, not emulators.
13. **Threshold calibration honesty.** Recompute EER on your actual final combined dataset, not a
    number borrowed from a paper or an earlier dev run — thresholds are dataset-specific.
14. **Consent and scope framing.** Get verbal consent for photographing others' dogs; document this
    clearly as a prototype/educational system, not a production pet-identity registry — this is
    both good practice and a likely interview question.

---

## 11. Testing Strategy

- **Unit tests:** preprocessing functions (glare removal, CLAHE) against known synthetic inputs;
  API input validation (file type/size rejection); threshold decision logic (match/no-match
  boundary cases at the exact threshold value).
- **Model evaluation tests:** automated FAR/FRR/EER/ROC/CMC computation as a notebook step that
  runs on every retrain, so a regression is caught immediately, not discovered at demo time.
- **Integration tests:** full enroll → identify round trip against a test Supabase project (not
  your production one), including an RLS check that confirms a user cannot read another user's dogs.
- **Field testing (do this, don't skip it):**
  - At least one dog **not** in the training set → confirm "no match" displays correctly.
  - At least one genuine match → confirm confidence score and top-3 display sensibly.
  - One same-breed/related-dog pair, if available, to see real-world confusion behavior.
  - One test on a real iPhone (Safari) and one real Android device — not just desktop DevTools.
  - One test after simulating a Supabase pause and a cold inference start, so you've seen the
    "waking up" UI state before a judge does.

---

## 12. Deployment Plan

1. Push trained ONNX weights + backend code to your repo; deploy backend to Render (free) or
   Hugging Face Spaces (free CPU tier).
2. Set Supabase project environment variables (`SUPABASE_URL`, anon key in frontend, service role
   key in backend only) via each platform's secret manager — never hard-coded, never committed.
3. Deploy frontend to Vercel (free tier), which provides HTTPS automatically — required for
   camera access to work at all.
4. Enable and test RLS policies against the live (not local) Supabase project before going further.
5. Set up a GitHub Actions scheduled workflow to ping the Supabase project every few days,
   preventing the free-tier auto-pause.
6. Run the full field-testing checklist (Section 11) against the live deployed URLs, not localhost.

---

## 13. Project Timeline

```
Week 1     Public dataset pipeline (detector + embedder + matcher) trained end-to-end.
           In parallel: shoot 5-8 dogs, 2 sessions each, as your out-of-domain check.
Week 2     Evaluate public-trained model on your own out-of-domain set.
           DECISION CHECKPOINT: satisfied -> fast track continues below;
           not satisfied -> branch to full self-collection (add ~4-5 weeks, see Section 4.2)
Week 3-4   Fine-tune embedder on chosen dataset, run full evaluation (FAR/FRR/EER/ROC/CMC),
           calibrate threshold on real numbers. [If on Plan B: this is where collection continues
           in parallel with early pipeline work.]
Week 4-5   Export to ONNX; build backend (FastAPI + Supabase schema + RLS policies).
           In parallel: build Next.js frontend shell.
Week 5-6   Build capture UI (liveness gate, sharpness gate, progress sequence); connect to backend.
Week 6-7   Full field testing (Section 11); polish UI/animations; real-device testing.
Week 7+    Buffer. Data collection and threshold calibration are the two things most likely to
           run long — this time is not optional slack.
```

---

## 14. Pre-Launch / Pre-Demo Checklist

```
[ ] RLS policies enabled and tested on every Supabase table
[ ] Anon key (not service role key) is the only key in frontend code — grep the repo to confirm
[ ] File type and size validation active on upload endpoints
[ ] Rate limiting active on /dogs/identify
[ ] embedding_version column present and populated
[ ] EER threshold recalculated on the final combined dataset, not a placeholder
[ ] Live test with a dog NOT in the training set — "no match" displays correctly
[ ] Live test with a genuine match — confidence score displays sensibly
[ ] Tested on one real iPhone (Safari) and one real Android device
[ ] Supabase project pinged within the last 24 hours (not paused)
[ ] Inference endpoint warmed up 2-3 minutes before any live demo
[ ] .env / secrets confirmed absent from git history
[ ] Camera permission-denied fallback tested
[ ] Offline/slow-network handling tested
[ ] "How this works" panel reviewed for clarity
```

---

## 15. Known Limitations (state these honestly, don't let a judge find them first)

- Liveness/anti-spoofing is a basic capture-time check, not full research-grade Presentation
  Attack Detection — documented as such.
- Accuracy is only as strong as the dataset it's evaluated on; report your own EER/ROC numbers
  from your own test set, not figures borrowed from published papers on different data.
- The system is scoped for adult dogs; puppies' nose texture is still developing and may reduce
  match confidence.
- Free-tier infrastructure (Supabase, Render/HF Spaces) trades occasional cold-start latency and
  pause risk for zero cost — appropriate for a student project, not for production scale.
- Every part of this guide assumes normal engineering diligence during implementation; no design
  document eliminates the need for careful testing during actual development.
