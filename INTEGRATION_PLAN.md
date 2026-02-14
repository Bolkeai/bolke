# BolkeAI — Frontend ↔ Backend Integration Plan

## Overview
Voice-first grocery assistant using Gemini Live API for real-time conversation,
browser_use for live product scraping, and FastAPI as the tool executor backend.

---

## Architecture

```
User speaks
  → Mic (getUserMedia) → PCM 16kHz chunks
  → Gemini Live API (gemini-2.0-flash-live-001)
  → Audio response streams back → Web Audio API plays it
  → If agent needs to act → function call emitted
  → Frontend intercepts → hits FastAPI backend
  → Backend runs browser_use on Zepto/Blinkit
  → Result returned to Gemini Live as function response
  → Agent announces result in audio
```

## Stack
- **Conversation**: Gemini Live API (`gemini-2.0-flash-live-001`)
- **Browser Automation**: `browser-use` via FastAPI backend
- **Frontend**: Next.js 16 + Tailwind v4 + Framer Motion
- **Backend**: FastAPI + Python 3.13
- **Languages**: Hindi, English (India), Kannada, Telugu, Tamil

---

## Phase 1 — Voice Pipeline
**Goal**: Gemini Live API working end-to-end. No backend. Pure conversation.

### What gets built
- [ ] `NEXT_PUBLIC_GEMINI_API_KEY` in `frontend/.env.local`
- [ ] `hooks/useLiveAgent.ts` — core Live API hook
  - Mic capture → PCM 16kHz via AudioWorklet
  - `ai.live.connect()` session management
  - Audio playback (PCM 24kHz → Web Audio API)
  - Function call interception (stubbed for Phase 1)
  - Session lifecycle (connect, disconnect, error)
- [ ] `lib/audioWorklet.ts` — PCM processor (runs off main thread)
- [ ] `components/LanguageSelector.tsx` — language picker UI
  - 5 languages: हिंदी | English | ಕನ್ನಡ | తెలుగు | தமிழ்
  - Sets `languageCode` + system prompt persona
- [ ] `lib/languages.ts` — language configs + kirana persona prompts
- [ ] `app/page.tsx` — wire language selector + useLiveAgent
  - Replace Web Speech API + SpeechSynthesis + geminiService
  - Tap mic → Live session starts → hands-free conversation

### System prompt per language
Each language gets a kirana shop owner persona:
- Hindi: Dilli/UP bhaiya, warm, uses "ji", "bhaiya", "theek hai"
- English: Friendly Indian shopkeeper, mixes Hindi words naturally
- Kannada: Bangalore angadi anna, uses "saar", "illa", "seri"
- Telugu: Hyderabad kirana owner, uses "babu", "ayya", "avunu"
- Tamil: Chennai kadai owner, uses "anna", "illa", "seri"

### Phase 1 Test ✓
- [ ] All 5 languages selectable
- [ ] Mic activates on tap, deactivates on tap
- [ ] Agent responds in selected language with correct persona
- [ ] Handles Hinglish / code-switching naturally
- [ ] Audio playback is clear and low-latency
- [ ] Can hold a 5-turn back-and-forth conversation

---

## Phase 2 — Search Integration
**Goal**: Agent triggers real product searches via backend. Results display on screen.

### What gets built
- [ ] `lib/tools.ts` — Gemini Live function declarations
  - `search_products(query: string, platforms: string[])`
- [ ] `services/backendService.ts` — typed fetch wrappers for FastAPI
  - `searchProducts(query, platforms)` → `POST /api/search`
- [ ] Update `useLiveAgent.ts`
  - Handle `TOOL_CALL` events from Live API
  - Execute tool → hit backend → return `TOOL_RESPONSE`
- [ ] Update `components/ProductCard.tsx`
  - Handle real `ScrapedProduct` data from backend
  - Show actual prices, brands, weights, delivery times
- [ ] Loading states during browser_use search (10-45 sec wait)
  - "Searching Zepto and Blinkit..." overlay
- [ ] Backend: upgrade `gemini_engine.py` to `gemini-2.5-flash`
- [ ] Backend: ensure CORS allows `localhost:3000`

### Data mapping
Backend `ScrapedProduct` → Frontend `Product`:
```
name        → name
price       → prices[].price
brand       → displayed under name
weight      → unit
image_url   → image
platform    → prices[].provider
```

### Phase 2 Test ✓
- [ ] Say "mujhe 500g rice dikhao" → products appear on screen
- [ ] Agent announces cheapest option verbally
- [ ] Both Zepto and Blinkit results show
- [ ] Works in all 5 languages
- [ ] Loading state visible during search
- [ ] Conversation continues after results shown

---

## Phase 3 — Checkout
**Goal**: Agent places a real order end-to-end via browser_use.

### What gets built
- [ ] Add `place_order(items, provider)` tool declaration
- [ ] Add `placeOrder(items, provider)` in `backendService.ts`
  - `POST /api/checkout`
- [ ] Confirmation state in `page.tsx`
  - Show order ID, delivery time, rider info
- [ ] Long-wait UX during checkout (2-5 min)
  - "Placing your order on Zepto..." full screen
  - Animated progress indicator
- [ ] Agent confirms order verbally after placement

### Phase 3 Test ✓
- [ ] Say "haan order karo" / "yes order it" → checkout starts
- [ ] Loading screen shows during browser_use order placement
- [ ] Real order placed on Zepto or Blinkit
- [ ] Order confirmation screen shows with real order ID
- [ ] Agent confirms verbally in selected language
- [ ] Works end-to-end from cold start (language select → speak → order)

---

## File Structure (after all phases)

```
frontend/
├── app/
│   ├── page.tsx                  # Main app (updated each phase)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── LanguageSelector.tsx      # Phase 1
│   ├── ProductCard.tsx           # Updated Phase 2
│   ├── CartDrawer.tsx
│   ├── MicButton.tsx
│   └── Waveform.tsx
├── hooks/
│   └── useLiveAgent.ts           # Phase 1 (updated Phase 2+)
├── lib/
│   ├── languages.ts              # Phase 1
│   ├── tools.ts                  # Phase 2
│   └── audioWorklet.ts           # Phase 1
├── services/
│   ├── backendService.ts         # Phase 2
│   └── geminiService.ts          # Deprecated after Phase 1
└── types.ts                      # Updated each phase

backend/
├── main.py                       # CORS update Phase 2
├── browser_agents.py             # Unchanged
├── gemini_engine.py              # Model upgrade Phase 2
└── pyproject.toml
```

---

## Environment Variables

**frontend/.env.local**
```
NEXT_PUBLIC_GEMINI_API_KEY=       # Gemini Live API key
```

**backend/.env**
```
GOOGLE_API_KEY=                   # Gemini API key for backend
CHROME_PROFILE_PATH=              # Optional: saved logins for Zepto/Blinkit
```

---

## Current Status
- [x] Phase 0 — Frontend (Next.js) migration complete
- [ ] Phase 1 — Voice Pipeline
- [ ] Phase 2 — Search Integration
- [ ] Phase 3 — Checkout
