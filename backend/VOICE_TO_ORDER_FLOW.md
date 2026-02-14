# Complete Voice-to-Order Flow

## Overview

Bolke is now a **FULLY AUTOMATED** voice-first grocery ordering system. User speaks, AI does everything - no manual steps required.

## The Complete Flow

### 1. Search Phase (Voice → Real Data)

**User says:** "mujhe doodh chahiye"

**System:**
1. ✅ Gemini parses: "User wants milk"
2. ✅ Opens Chrome browser (headless)
3. ✅ Goes to `https://blinkit.com/s/?q=milk`
4. ✅ Handles location popup automatically
5. ✅ Scrapes REAL prices from the page
6. ✅ Compares Blinkit vs Zepto
7. ✅ Returns actual live prices

**System responds:** "Blinkit pe Amul Taaza Milk ₹75 hai, Zepto pe ₹78. Blinkit sasta hai. Order karun?"

---

### 2. Confirmation Phase (Voice → Intent)

**User says:** "haan kar do"

**System:**
1. ✅ Gemini confirms: "User wants to order"
2. ✅ Identifies cheapest option from search results
3. ✅ Prepares to place order

**System responds:** "Theek hai, main abhi order kar raha hoon..."

---

### 3. Order Phase (Fully Automated)

**System executes:**

1. **Open Browser** (with saved Chrome profile - user already logged in)
   ```
   Opens: https://blinkit.com/s/?q=amul+milk
   ```

2. **Add to Cart**
   - Finds matching product
   - Clicks "ADD" button
   - Waits for cart update

3. **Go to Checkout**
   - Clicks cart icon
   - Clicks "Proceed to Checkout"

4. **Confirm Address**
   - Uses saved delivery address
   - Clicks "Deliver Here" if prompted

5. **Select Payment**
   - Selects "Cash on Delivery" (COD)
   - No OTP needed for COD

6. **Place Order**
   - Clicks "Place Order" button
   - Waits for confirmation

7. **Extract Details**
   - Order ID: "BLNK123456"
   - Delivery: "14 minutes"
   - Total: ₹122

**System responds:** "Order ho gaya! Order number BLNK123456. 14 minutes mein aa jayega. Total ₹122."

---

## Key Features

### ✅ No Manual Steps
- User only speaks
- No clicking required
- No typing required
- No form filling

### ✅ Real-Time Data
- Scrapes actual prices from websites
- Compares across platforms
- Always shows current availability

### ✅ Smart Automation
- Handles location popups
- Selects saved addresses
- Chooses COD automatically
- Confirms order without human intervention

### ✅ Voice Confirmation
- Clear feedback at each stage
- Tells user what's happening
- Confirms success/failure

---

## Prerequisites for Full Automation

### 1. Chrome Profile Setup
You need a saved Chrome profile with:
- Logged-in Blinkit/Zepto account
- Saved delivery address
- Payment methods configured (optional, COD works)

Set in `.env`:
```bash
CHROME_PROFILE_PATH=C:\Users\<you>\AppData\Local\Google\Chrome\User Data
```

### 2. API Keys
```bash
GOOGLE_API_KEY=your_gemini_api_key
```

That's it! No Blinkit/Zepto API keys needed.

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER SPEAKS                              │
│              "mujhe doodh aur bread chahiye"                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  GEMINI INTENT ENGINE                        │
│  ✓ Parses: SEARCH intent                                    │
│  ✓ Products: ["milk", "bread"]                              │
│  ✓ Generates Hindi response                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BROWSER AUTOMATION (SEARCH)                     │
│                                                              │
│  [Blinkit Agent]              [Zepto Agent]                 │
│  ├─ Open browser              ├─ Open browser               │
│  ├─ Go to search URL          ├─ Go to search URL           │
│  ├─ Handle location           ├─ Handle location            │
│  ├─ Scrape prices             ├─ Scrape prices              │
│  └─ Return results            └─ Return results             │
│                                                              │
│  Results: Blinkit ₹75, Zepto ₹78                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   SPEAK TO USER                              │
│      "Blinkit pe sasta hai, ₹75. Order karun?"              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  USER CONFIRMS                               │
│                  "haan kar do"                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  GEMINI INTENT ENGINE                        │
│  ✓ Parses: CHECKOUT intent                                  │
│  ✓ Triggers order placement                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         BROWSER AUTOMATION (ORDER PLACEMENT)                 │
│                                                              │
│  1. Open Blinkit with logged-in profile                     │
│  2. Search for "milk"                                        │
│  3. Click "ADD" on first result                             │
│  4. Go to cart                                               │
│  5. Click "Checkout"                                         │
│  6. Confirm saved address                                    │
│  7. Select "Cash on Delivery"                                │
│  8. Click "Place Order"                                      │
│  9. Extract order confirmation                               │
│                                                              │
│  Result: Order #BLNK123456, delivery in 14 min              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   SPEAK TO USER                              │
│    "Order ho gaya! 14 minutes mein aa jayega."               │
└─────────────────────────────────────────────────────────────┘
```

---

## Example Conversations

### Scenario 1: Simple Order

```
User:  "bhaiya doodh lana hai"
Bot:   "Dhundh raha hoon..."
       [Searches Blinkit & Zepto]
       "Blinkit pe Amul Milk ₹75 hai. Order karun?"
User:  "haan"
Bot:   "Order kar raha hoon..."
       [Automated order flow]
       "Ho gaya! Order number 12345. 20 minute mein pahunchega."
```

### Scenario 2: Multiple Items

```
User:  "mujhe chawal, daal aur atta chahiye"
Bot:   "Teeno cheezon ke liye search kar raha hoon..."
       [Searches all three]
       "Fortune Basmati 5kg ₹450, Toor Dal 1kg ₹180, Aashirvaad Atta 10kg ₹420.
        Total ₹1050 banta hai. Order karu?"
User:  "haan theek hai"
Bot:   "Order place kar raha hoon..."
       [Adds all 3 to cart, completes checkout]
       "Done! Order confirmed. 1 ghante mein mil jayega."
```

### Scenario 3: Compare & Choose

```
User:  "sabse sasta milk dikhao"
Bot:   "Check kar raha hoon..."
       [Compares platforms]
       "Blinkit pe ₹62 hai, Zepto pe ₹65 hai. Blinkit better hai."
User:  "Blinkit se manga do"
Bot:   "Theek hai, Blinkit se order kar raha hoon..."
       [Orders from Blinkit]
       "Order complete. 15 minutes."
```

---

## Technical Implementation

### Models Used
- **Gemini 2.5 Flash** - Intent parsing & responses
- **Gemini 2.5 Flash** - Browser automation control

### Browser Automation
- **Playwright** - Browser control
- **browser-use** - AI-powered web interaction
- **Chromium** - Headless browser

### Architecture
```
Voice Input → Gemini Engine → Browser Agent → Real Website → Actual Order
     ↑                                                              ↓
     └────────────── Voice Response ← Order Confirmation ──────────┘
```

---

## Error Handling

### If Login Required
```
Bot: "Pehle login karna hoga. Main browser khol raha hoon, 
     aap login karo phir dubara bolna."
```

### If Out of Stock
```
Bot: "Ye product abhi available nahi hai. Koi aur option dikhau?"
```

### If Address Not Saved
```
Bot: "Delivery address nahi mila. Pehle address save karo."
```

---

## Safety Features

### ✅ Requires Chrome Profile
- Must be logged in beforehand
- Can't order without valid account

### ✅ Uses COD Only
- No payment details exposed
- No credit card info stored
- User pays on delivery

### ✅ Order Confirmation
- Shows order details before finalizing
- User confirms via voice
- Can cancel anytime

---

## Setup Instructions

### 1. Install Dependencies
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install playwright browser-use fastapi google-generativeai
python -m playwright install chromium
```

### 2. Configure Chrome Profile
1. Open Chrome
2. Login to Blinkit/Zepto
3. Save delivery address
4. Note your profile path: `chrome://version/` → "Profile Path"
5. Add to `.env`:
   ```
   CHROME_PROFILE_PATH=C:\Users\<you>\AppData\Local\Google\Chrome\User Data
   ```

### 3. Start Backend
```powershell
uvicorn main:app --reload --port 8000
```

### 4. Test It
Say: "mujhe doodh chahiye"

---

## What Makes This Special?

### Traditional E-commerce:
1. Open app
2. Search for product
3. Filter results
4. Compare prices
5. Add to cart
6. Go to cart
7. Enter address
8. Select payment
9. Confirm order
**= 9 steps, ~5 minutes**

### Bolke Voice Commerce:
1. "mujhe doodh chahiye"
2. "haan kar do"
**= 2 voice commands, ~30 seconds**

---

## Future Enhancements

- [ ] Support prepaid payment (UPI autopay)
- [ ] Smart quantity detection ("2 liter doodh")
- [ ] Scheduled orders ("kal subah 8 baje")
- [ ] Subscription mode ("har hafte ek baar")
- [ ] Multi-platform cart ("sabse sasta wala choose karo")

---

## Status: ✅ WORKING

**Voice** → **AI** → **Browser** → **Real Order** → **Voice Confirmation**

Everything is fully automated. User just speaks. That's it! 🎉
