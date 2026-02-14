# Bolke

Voice-first grocery shopping for Bharat. Speak in Hindi/English → search Zepto & Blinkit live → compare prices → place real orders.

## Quick Start

### 1. Install dependencies

```bash
cd bolke/backend
uv sync
```

### 2. Install browser (for browser-use)

```bash
uvx browser-use install
```

### 3. Set up your API key

```bash
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
```

### 4. Run the server

```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Open the app

Go to **http://localhost:8000** in Chrome.

Click the 🎤 mic button and say something like:
- "mujhe doodh chahiye"
- "rice kitne ka hai"
- "Amul milk aur bread dikhao"

## Architecture

```
Voice → Gemini (intent) → browser-use (search Zepto + Blinkit) → Compare → Order
```

- **No static product catalog** — browser-use searches platforms live
- **Gemini 2.0 Flash** — parses Hindi/English, generates responses
- **browser-use** — controls Chrome to search and place real orders
- **Pre-logged Chrome profile** — uses your Zepto/Blinkit accounts

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/voice` | POST | Voice transcript → intent + search + response |
| `/api/search` | POST | Direct product search across platforms |
| `/api/checkout` | POST | Place a real order via browser automation |
| `/api/health` | GET | Health check |

## Tech Stack

- **Backend:** FastAPI + Gemini 2.0 Flash + browser-use
- **Frontend:** HTML/JS (Web Speech API)
- **Browser Automation:** browser-use (Playwright-based)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | ✅ | Gemini API key |
| `CHROME_PROFILE_PATH` | Optional | Path to Chrome profile with saved logins |

---

Built for Google AIFF Hackathon 2025 | Bangalore
