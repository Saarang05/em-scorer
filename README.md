# Erasmus Mundus Profile Scorer

Upload a resume (PDF/DOCX), answer 4 questions, get a readiness score out of 100, then unlock a full report (breakdown, top 3 gaps with fixes, 3 programme matches).

**Live URL:** _add after deploying_

## Setup (local)

Needs Node.js 22.13 or newer in the 22.x line.

```bash
npm install
cp .env.example .env      # fill in the values
npm run check-key         # verifies the AI key and suggests a model
npm run dev               # http://localhost:3000
npm test                  # runs without any key or network
```

## Deploy (Vercel)

1. Import the GitHub repo in Vercel (framework preset: **Other**, no build command).
2. Add Upstash Redis from the project's **Storage** tab and connect it to the project.
3. Add the environment variables below, then redeploy.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `LLM_API_KEY` | yes | AI provider key (server only) |
| `APP_SECRET` | yes | 32+ random characters; encrypts report tokens (`openssl rand -hex 32`) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | yes on Vercel | Cache, rate limit, leads (`KV_REST_API_URL` / `KV_REST_API_TOKEN` also work) |
| `LLM_MODEL` | recommended | Pin the model; otherwise one is picked from the key's model list |
| `LLM_PROVIDER`, `LLM_BASE_URL` | no | openai, anthropic, gemini, groq, openrouter; custom OpenAI-compatible URL |
| `RATE_LIMIT_PER_HOUR` | no | Default 5 successful scorings per IP per hour |

## Architecture

1. Static mobile-first page (`public/`) validates type and size, then sends the file to `POST /api/score`.
2. The function checks the rate limit and extracts text in memory (`pdfjs-dist`, `jszip`); image-only PDFs are rejected.
3. One LLM call returns facts as JSON (validated with `zod`); emails and phone numbers are redacted first.
4. Extracted facts are cached in Redis under a SHA-256 of the text, so the same resume always scores the same.
5. Scoring, gaps and programme matching are plain code; weights live in `config/rubric.js`. Typed answers override the resume.
6. The browser receives only score, band, hard gaps and an AES-256-GCM encrypted token.
7. `POST /api/report` releases the report only for a valid token plus lead details, and saves the lead (with CRM priority) to the Redis list `em:leads`.

## Privacy

The resume file and its text are never written to storage or logs. Stored: extracted fields (30 days, cache), and after the lead gate: contact details, answers, extracted fields and score. The resume text is sent to the AI provider for extraction.

## Model choice

**Claude Haiku 5.5** (`claude-haiku-5-5`). The LLM only extracts facts and all scoring is code, so a small, fast, low-cost model built for extraction fits. Thinking is disabled to cut latency. The model takes no temperature setting; repeat uploads score identically because the extracted facts are cached.

## Cost per resume

Estimate: one call of about 3,000 input and 1,500 output tokens. At $0.10 per million input and $0.50 per million output tokens ([model page](https://platform.claude.com/docs/en/models/haiku-5-5/overview), prompts up to 100k tokens, checked 26 Nov 2026) that is about **$0.001 per resume** (about $1 per 1,000). A very long resume that fills the output limit stays under $0.005. A repeat upload costs nothing (cache). Hosting: free tiers.

## Rubric interpretation

- CGPA: /10 × 10, /4 × 25, percentage as is. Tier boundaries apply as "85 and above", "75 and above", etc.
- "Relevant" work and projects: tagged with the target field or a direct-match subject for it. Unrelated work months count half.
- "English flagged as a gap": a separate hard-gap warning is always shown when English scores 0; the top 3 gaps stay strictly the 3 largest shortfalls.
- Leadership: leadership role 2, volunteering 1, exchange 2, each language other than English 1.

## Known limitations

- Vercel limits request bodies to 4.5 MB. Files of 4.4–5 MB are compressed in the browser; if still too large, the user is asked to shrink them.
- No OCR: scanned PDFs are rejected.
- Photo detection is a heuristic; DOCX page count is estimated.
- LLM extraction can misread unusual layouts. Results are consistent for 30 days (cache), not guaranteed across model changes after that.
- TOEFL uses the 0–120 scale from the rubric, not the newer 1–6 band scale.
- The programme list is a hand-curated shortlist (`config/programmes.js`); verify links, funding and calls each intake.
- Rate limiting is per IP, so students behind one shared network share the limit.
- Contact details are not verified (no OTP).
