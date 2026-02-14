# **Bolke** is a voice-first, vernacular grocery shopping agent for the "next billion users" in India.sion
Voice OS for grocery shopping that works with ANY platform (Zepto, Blinkit, BigBasket, Swiggy). 300M Indians gain access to e-commerce through natural Hindi conversation.

---

## What We're Building

**A voice interface that:**
1. Understands natural eng/Hindi/kannada/telugu and other indian languages conversation (Gemini AI)
2. Searches across multiple grocery platforms (scraped catalogs)
3. Compares prices automatically
4. Places REAL orders via browser automation (Browser-Use)
5. Works as a web app (no installation needed)

**Not another grocery app. Voice infrastructure for ALL grocery apps.**

---

## Tech Stack

**Frontend:**
- Next.js (React web app)
- Web Speech API (browser voice I/O)
- Tailwind CSS
- PWA (installable)

**Backend:**
- FastAPI (Python)
- Google Gemini 2.0 Flash (intent understanding)
- Browser-Use (AI-powered browser automation)
- PostgreSQL (product catalog, user state)

**Infrastructure:**
- Vercel (frontend deployment)
- Railway (backend deployment)
- Browser-Use Cloud (stealth browsers)

---

## 30-Hour Build Plan

### Phase 1: Core Voice Engine (Hours 0-12)

**Goal:** Get voice input/output working with basic grocery search

#### Hours 0-4: Frontend Setup
```bash
npx create-next-app# Bolke (bolke)
cd audiokirana
npm install
```

**Build:**
- Voice input button (Web Speech API)
- Display transcript
- Show AI responses
- Play audio responses

**File: `app/page.tsx`**
- Mic button component
- Voice state management
- API integration
- Cart display

#### Hours 4-8: Backend Setup
```bash
mkdir backend
cd backend
uv init
uv add fastapi google-generativeai
```

**Build:**
- `/api/voice` endpoint
- Gemini integration
- Intent parsing
- Response generation

**File: `backend/main.py`**
- FastAPI routes
- Gemini prompt engineering
- Session management

#### Hours 8-12: Product Database
**Pre-scrape before hackathon:**
- 20 products from Zepto website
- 20 products from Blinkit website
- 10 products from BigBasket

**File: `backend/products.json`**
```json
[
  {
    "id": "zepto_1",
    "name": "Fortune Basmati Rice 5kg",
    "provider": "zepto",
    "price": 420,
    "weight": "5kg",
    "category": "rice",
    "image_url": "..."
  }
]
```

**Categories to cover:**
- Rice (10 items)
- Daal/Lentils (10 items)
- Oil (10 items)
- Flour (5 items)
- Sugar/Salt (5 items)

**Build search function:**
- Query product catalog
- Multi-provider results
- Sort by price
- Return top 5 matches

**Checkpoint:** Voice → Gemini → Product search → Response working

---

### Phase 2: Browser Automation + Orders (Hours 12-24)

**Goal:** Place REAL orders on Zepto/Blinkit via Browser-Use

#### Hours 12-15: Browser-Use Setup
```bash
uv add browser-use
uvx browser-use install
```

**Get API key:**
- Sign up at browser-use.com
- Add to `.env`: `BROWSER_USE_API_KEY=your-key`
- $10 free credits (enough for demo)

**Test basic automation:**
```python
from browser_use import Agent, Browser, ChatBrowserUse

async def test():
    agent = Agent(
        task="Go to zepto.com and search for milk",
        llm=ChatBrowserUse(),
        browser=Browser()
    )
    await agent.run()
```

#### Hours 15-18: Zepto Automation
**File: `backend/automation.py`**
```python
class ZeptoAutomation:
    async def place_order(self, items: list, address: str):
        browser = Browser()
        
        task = f"""
        1. Go to zepto.com
        2. Search and add to cart: {items}
        3. Go to checkout
        4. Select address: {address}
        5. Choose Cash on Delivery
        6. Place order
        7. Return order ID
        """
        
        agent = Agent(task=task, llm=ChatBrowserUse(), browser=browser)
        result = await agent.run()
        return result
```

**Test with real Zepto account:**
- Pre-login and save session
- Add delivery address
- Place test order (₹100)

#### Hours 18-21: Blinkit Automation
**Same pattern for Blinkit:**
```python
class BlinkitAutomation:
    async def place_order(self, items: list, address: str):
        # Similar to Zepto automation
```

**Test with real Blinkit account:**
- Pre-setup account
- Place test order (₹100)

#### Hours 21-24: Integration
**File: `backend/main.py`**
```python
@app.post("/api/checkout")
async def checkout(req: CheckoutRequest):
    # Determine cheapest provider
    provider = determine_cheapest(req.cart)
    
    if provider == "zepto":
        result = await zepto_automation.place_order(
            items=req.cart,
            address="Google Bangalore Office"
        )
    elif provider == "blinkit":
        result = await blinkit_automation.place_order(
            items=req.cart,
            address="Google Bangalore Office"
        )
    
    return {
        "order_id": result.order_id,
        "provider": provider,
        "status": "placed",
        "tracking_url": result.tracking_url
    }
```

**Checkpoint:** Can place REAL orders on both Zepto and Blinkit

---

### Phase 3: Polish + Deploy (Hours 24-30)

**Goal:** Demo-ready production app

#### Hours 24-26: Visual Polish

**UI Improvements:**
- Cart display with provider badges
- Price comparison table
- Order confirmation screen
- Live order status
- Hindi text throughout

**Color scheme:**
- Orange/saffron (Indian vibes)
- Clean, minimal design
- Mobile-responsive

**Add animations:**
- Cart updates
- Provider comparison
- Order placement

#### Hours 26-28: Deployment

**Frontend → Vercel:**
```bash
vercel deploy
# URL: https://audiokirana.vercel.app
```

**Backend → Railway:**
```bash
railway login
railway init
railway up
# URL: https://audiokirana-api.railway.app
```

**Environment variables:**
- `GEMINI_API_KEY`
- `BROWSER_USE_API_KEY`
- Database connection string

**Test deployed version:**
- Voice input works
- Product search works
- Order placement works

#### Hours 28-30: Demo Prep

**Practice demo script 10+ times:**
1. Hook (30 sec)
2. Live voice order (90 sec)
3. Technical reveal (30 sec)
4. Business model (30 sec)

**Create backup materials:**
- Screen recording of full flow (30 sec)
- Screenshots of each step
- QR code for judges to try

**Test on multiple devices:**
- Your laptop
- Your phone
- Judge's phone (simulate)

**Prepare for questions:**
- "Why would platforms work with you?"
- "How do you handle payments?"
- "What about API access?"
- "Is browser automation reliable?"

**Checkpoint:** Fully working demo, deployed, practiced, backup ready

---

## File Structure
```
audiokirana/
├── frontend/                      # Next.js web app
│   ├── app/
│   │   ├── page.tsx              # Main voice UI
│   │   ├── components/
│   │   │   ├── VoiceButton.tsx   # Mic control
│   │   │   ├── Cart.tsx          # Shopping cart
│   │   │   ├── ProductList.tsx   # Search results
│   │   │   └── OrderStatus.tsx   # Tracking
│   │   └── globals.css           # Tailwind styles
│   ├── public/
│   │   └── manifest.json         # PWA config
│   └── package.json
│
├── backend/                       # FastAPI server
│   ├── main.py                   # API routes
│   ├── automation.py             # Browser-Use automation
│   │   ├── ZeptoAutomation
│   │   └── BlinkitAutomation
│   ├── search.py                 # Product search logic
│   ├── gemini.py                 # Intent parsing
│   ├── products.json             # Scraped product catalog
│   ├── requirements.txt
│   └── .env                      # API keys
│
└── README.md
```

---

## Demo Flow (3 Minutes)

### [0:00-0:30] Hook + Problem
**YOU:**
"300 million Indians can't use grocery apps because they can't type. My mother is one of them. Watch me order groceries in Hindi using just my voice - and this order is REAL, arriving in 30 minutes."

*Show typical app (Blinkit) - demonstrate typing struggle*

### [0:30-2:00] Live Voice Demo

**Setup:**
- External monitor showing browser automation
- Laptop showing voice UI
- Bluetooth speaker for AI voice

**Flow:**
```
YOU (Hindi): "Mujhe doodh aur bread chahiye"

AI: "Searching Zepto and Blinkit..."
[Screen shows comparison]
AI: "Zepto: Amul milk ₹62 + bread ₹45 = ₹107
     Blinkit: Same items ₹125
     Zepto is cheaper. Order karu?"

YOU: "Haan"

AI: "Placing order on Zepto..."
[Browser window opens, automation visible]
- Adds milk to cart
- Adds bread to cart  
- Goes to checkout
- Selects address
- Chooses COD
- Places order

[Order confirmation screen]
AI: "Order placed! Zepto #AK45123. 
     28 minutes mein aa jayega.
     Track: [live link]"
```

### [2:00-2:30] Technical Deep Dive

**YOU:**
"What just happened:

1. **Voice → Gemini** - Understood Hindi, extracted intent
2. **Multi-provider search** - Checked Zepto AND Blinkit catalogs
3. **Price intelligence** - Auto-selected cheaper option
4. **Browser automation** - LLM agent placed REAL order
5. **Live tracking** - Order is coming RIGHT NOW

*Show architecture diagram*

This isn't a demo. This is a real Zepto order. Check the tracking."

### [2:30-3:00] Business Model

**YOU:**
"We're not building another grocery app. We're the voice layer for ALL grocery apps.

**Market:** 300M Indians who can't type  
**Solution:** Works with ANY platform - Zepto, Blinkit, BigBasket, Swiggy  
**Technology:** Browser automation - no API partnerships needed  
**Revenue:** 3% commission per order OR ₹50k/month SaaS to platforms

**Open Source:** Core engine is MIT licensed. Community can add providers.

And yes - that order I placed is arriving during judging. You can track it live."

---

## Pre-Demo Checklist

### Day Before Hackathon:
- [ ] Scrape products from Zepto, Blinkit, BigBasket
- [ ] Setup accounts on all platforms
- [ ] Add delivery address (hackathon venue)
- [ ] Test Browser-Use automation on each platform
- [ ] Place 1 test order on Zepto (₹100)
- [ ] Place 1 test order on Blinkit (₹100)
- [ ] Record backup demo video (30 sec)
- [ ] Practice demo script 10+ times

### Demo Day Morning:
- [ ] Check all deployments working
- [ ] Pre-login to Zepto/Blinkit (save sessions)
- [ ] Load ₹500 in wallet OR have cash for COD
- [ ] Test voice input on venue WiFi
- [ ] Charge all devices
- [ ] Setup external monitor
- [ ] Connect Bluetooth speaker
- [ ] Print QR code for judges
- [ ] Have backup video on USB drive

### Items to Order During Demo:
- Amul Milk 1L (₹62) - always in stock
- Britannia Bread (₹45) - fast delivery
- **Total: ~₹100-110**

---

## Backup Plans

### Plan A: Live Automation ✓
- Place order during demo
- Show browser automation on screen
- Real-time tracking

### Plan B: Pre-Placed Order
- Place order 30 min before demo slot
- Show it's already on the way
- Delivery arrives DURING demo

### Plan C: Recorded Demo
- Play 30-sec video of real order
- Show tracking link as proof
- Explain "this was yesterday's test"

### Plan D: Mock with Evidence
- Fallback to mock checkout
- Show test order receipts/tracking
- "Real integration works, here's proof from yesterday"

**Never fail completely - always have proof it works**

---

## Cost Breakdown

**Development:**
- Browser-Use credits: $10 free ✓
- Gemini API: Free tier (enough) ✓

**Testing:**
- Zepto test order: ₹100
- Blinkit test order: ₹100

**Demo Day:**
- Live order: ₹100-110
- Backup order (optional): ₹100

**Total: ₹400-500**

---

## Technical Implementation Details

### Gemini Intent Parsing

**Prompt template:**
```python
prompt = f"""
You are a kirana shop assistant. Parse this Hindi request:

User said: "{user_text}"
Current cart: {cart}
Conversation history: {history[-3:]}

Extract:
1. Intent: SEARCH_PRODUCT | ADD_TO_CART | CHECKOUT | MODIFY_CART
2. Product name (if mentioned)
3. Quantity (if mentioned)
4. Brand preference (if any)

Respond with JSON:
{{
  "intent": "SEARCH_PRODUCT",
  "product": "rice",
  "quantity": "5kg",
  "brand": "fortune"
}}

Then generate a natural Hindi response asking for clarification or confirming action.
"""
```

### Multi-Provider Search
```python
def search_all_providers(query: str) -> dict:
    # Load from JSON
    all_products = json.load(open('products.json'))
    
    # Filter by query
    matches = [p for p in all_products if query.lower() in p['name'].lower()]
    
    # Group by provider
    grouped = defaultdict(list)
    for product in matches:
        grouped[product['provider']].append(product)
    
    # Find cheapest
    all_sorted = sorted(matches, key=lambda x: x['price'])
    
    return {
        'zepto': grouped['zepto'][:3],
        'blinkit': grouped['blinkit'][:3],
        'cheapest': all_sorted[0] if all_sorted else None,
        'all_results': all_sorted[:10]
    }
```

### Browser Automation Task
```python
async def automate_order(provider: str, items: list, address: str):
    browser = Browser(
        # use_cloud=True,  # Stealth browser on cloud
    )
    
    llm = ChatBrowserUse()
    
    # Build task description
    item_list = "\n".join([f"- {item['name']}" for item in items])
    
    task = f"""
    Go to {provider}.com
    
    Add these items to cart:
    {item_list}
    
    Proceed to checkout
    
    Select delivery address: {address}
    
    Choose payment method: Cash on Delivery
    
    Complete the order
    
    Extract and return the order ID
    """
    
    agent = Agent(task=task, llm=llm, browser=browser)
    result = await agent.run()
    
    return result
```

---

## Key Features to Highlight

### 1. Multi-Provider Intelligence
- Searches across platforms simultaneously
- Compares prices in real-time
- Auto-routes to cheapest option
- "Zepto ₹107, Blinkit ₹125 → Auto-select Zepto"

### 2. Natural Conversation
- Handles code-switching (Hindi-English)
- Contextual clarifications
- Remembers conversation history
- "Daal liya, chawal nahi loge?"

### 3. Browser Automation
- Works with ANY platform
- No API partnerships needed
- LLM-powered (adapts to UI changes)
- Visible during demo (transparency)

### 4. Real Orders
- Not a mock demo
- Actual checkout on real platforms
- Live order tracking
- Delivery during judging

---

## Judging Criteria Alignment

### Impact (25%)
- **TAM:** 300M underserved Indians
- **Clear need:** Literacy barrier locks people out
- **Measurable outcome:** Enable e-commerce access
- **Scalability:** Platform approach (not just one app)

### Demo (50%)
- **Working end-to-end:** Voice → Search → Order → Tracking
- **REAL orders:** Not mock, actual delivery
- **Multi-platform:** Zepto AND Blinkit
- **Visual proof:** Browser automation visible
- **Live tracking:** Order coming during judging

### Creativity (15%)
- **Novel approach:** Voice OS, not voice feature
- **Platform play:** Infrastructure for ALL apps
- **Browser automation:** Unique technical approach
- **No API limits:** Works with anyone
- **Open source:** Community-driven ecosystem

### Pitch (10%)
- **Clear problem:** 300M market locked out
- **Obvious solution:** Voice interface
- **Business model:** Commission OR SaaS
- **Competitive advantage:** Works with everyone
- **Next steps:** Partnership roadmap

---

## Post-Hackathon Roadmap

### Week 1: Production Polish
- Optimize automation reliability
- Add error recovery
- Implement retry logic
- Add Tamil + Bengali support

### Week 2: Beta Testing
- 100 beta users in Bangalore
- Gather feedback
- Measure conversion rates
- Track order values

### Week 3: Metrics
- Prove 2x better conversion vs typing
- Show average order value
- Demonstrate retention
- Build case study

### Week 4: Partnerships
- Pitch to Zepto (bring them users)
- Pitch to Blinkit (or lose to competitors)
- Pitch to BigBasket
- Negotiate commission rates

---

## Revenue Model Deep Dive

### Option 1: Commission (3%)
- User orders ₹1000 → ₹30 to AudioKirana
- Platform gets new customer + 97% revenue
- Win-win

### Option 2: SaaS (₹50k/month)
- Platform white-labels our voice tech
- "Powered by AudioKirana"
- Fixed cost, unlimited orders

### Option 3: API Licensing
- Other apps use our voice engine
- ₹1 per 1000 interactions
- B2B infrastructure play

### Option 4: Freemium Consumer
- Free: Basic voice, single provider
- Premium (₹99/month): Multi-provider comparison, price alerts
- Conversion: 5-10% of users

**Target: Option 1 + 2 combined = ₹10L/month within 6 months**

---

## Risk Mitigation

### Technical Risks:
- **Browser automation fails:** Have backup mock + proof video
- **Voice recognition poor:** Test with noise, have fallback text input
- **Platform UI changes:** Browser-Use adapts (LLM-powered)
- **Network issues at venue:** Pre-load sessions, test offline modes

### Business Risks:
- **Platforms block us:** Move to partnership model vs adversarial
- **Competition:** Focus on voice quality, not just automation
- **Regulation:** COD only (no payment processing issues)
- **Scale:** Use Browser-Use Cloud for production infrastructure

---

## Success Metrics

**Hackathon Win = Achieved if:**
1. ✅ Live demo works flawlessly
2. ✅ REAL order placed and tracked
3. ✅ Judges see multi-provider comparison
4. ✅ Clear business model articulated
5. ✅ Top 3 finish

**Post-Hackathon Success = Achieved if:**
1. 100+ active users within 30 days
2. Partnership conversation with 1 major platform
3. Featured in tech media
4. GitHub repo hits 1k+ stars
5. Pre-seed funding interest

---

## Open Source Strategy

**What's Open Source:**
- Voice interface engine (MIT license)
- Gemini integration templates
- Provider abstraction layer
- Sample automation scripts

**What's Proprietary:**
- Specific automation implementations
- Production infrastructure
- Customer data
- Partnership agreements

**Community Contributions:**
- New provider integrations
- Regional language support
- Dialect training data
- UI improvements

**Goal:** Build ecosystem where developers extend AudioKirana

---

## Contact & Links

**Team:** Gagan (Founder - zTutor, Eunice Labs)  
**Demo:** https://audiokirana.vercel.app  
**GitHub:** [repo link]  
**Email:** [your email]  

**Built for:** Google AIFF Hackathon 2025 | Bangalore  
**Problem Statement:** Consumer + Multilingual + Localization  

---

## Final Checklist

### Before Demo:
- [ ] All systems deployed and tested
- [ ] Voice input works perfectly
- [ ] Product search returns results
- [ ] Browser automation tested on both platforms
- [ ] Backup materials ready
- [ ] Demo script memorized
- [ ] Questions rehearsed
- [ ] Team coordinated

### During Demo:
- [ ] Speak clearly and confidently
- [ ] Show, don't tell (let demo speak)
- [ ] Handle failures gracefully
- [ ] Answer questions directly
- [ ] Stay within 3 minutes
- [ ] End with strong call-to-action

### After Demo:
- [ ] Share deployed URL
- [ ] Follow up with judges
- [ ] Post on social media
- [ ] Connect with other teams
- [ ] Gather feedback
- [ ] Plan next steps

---

**AudioKirana: Voice OS for grocery shopping. Built in 30 hours. Works with everyone. Changes everything.**

**Let's win this. 🔥**