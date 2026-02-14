# 🎙️ Bolke - Quick Setup Guide

## ✅ What's Fixed

1. **Git Repo Issue** - Consolidated into ONE unified repository
2. **Chrome Profile** - Now optional, app works without it
3. **Clear Setup Steps** - Follow below to get running

---

## 🚀 How to Run Bolke

### **Step 1: Install Backend Dependencies**

```powershell
cd backend
pip install uv
uv sync
```

Or if you prefer traditional pip:
```powershell
cd backend
pip install fastapi uvicorn python-dotenv google-generativeai browser-use
```

### **Step 2: Install Browser (for browser-use)**

```powershell
uvx browser-use install
```

### **Step 3: Configure Environment**

Your `.env` file in `backend/` already has:
- ✅ `GOOGLE_API_KEY` set
- ✅ `CHROME_PROFILE_PATH` is optional (commented out)

**You're good to go!**

### **Step 4: Start the Backend**

```powershell
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or with regular Python:
```powershell
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be at: **http://localhost:8000**

### **Step 5: Start the Frontend (Next.js)**

Open a **new terminal**:

```powershell
cd frontend
npm install
npm run dev
```

Frontend will be at: **http://localhost:3000**

---

## 🎯 How to Use

1. Open **http://localhost:3000** in Chrome
2. Click the **🎤 Mic button**
3. Say things like:
   - "mujhe doodh chahiye" (I want milk)
   - "rice kitne ka hai" (How much is rice)
   - "Amul milk dikhao" (Show me Amul milk)

The app will:
- Parse your Hindi/English speech with Gemini AI
- Search Zepto & Blinkit live using browser automation
- Show you products and prices
- Compare prices across platforms

---

## 🔧 Troubleshooting

### **Chrome Profile Issue**
- **Fixed!** The app now works WITHOUT Chrome profile
- It will open a fresh browser window
- You'll just need to log into Zepto/Blinkit manually when placing orders
- To use saved logins: uncomment and set `CHROME_PROFILE_PATH` in `.env`

### **Backend Not Starting**
```powershell
cd backend
pip install --upgrade uv
uv sync
```

### **Frontend Not Starting**
```powershell
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### **Browser-use Not Working**
```powershell
uvx browser-use install
```

---

## 📁 Project Structure (NOW UNIFIED)

```
bolke/                          ← Single git repo
├── .git/                       ← One repo for everything
├── .gitignore                  ← Root-level ignore
├── README.md
├── SETUP.md                    ← This file
├── plan.md
├── backend/
│   ├── .env                    ← Config here
│   ├── main.py                 ← FastAPI server
│   ├── gemini_engine.py        ← AI intent parsing
│   ├── browser_agents.py       ← Browser automation
│   └── pyproject.toml
└── frontend/
    ├── app/
    │   └── page.tsx            ← Main UI
    ├── components/
    │   ├── MicButton.tsx
    │   ├── ProductCard.tsx
    │   └── CartDrawer.tsx
    └── package.json
```

---

## 🎯 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/voice` | POST | Process voice transcript |
| `POST /api/search` | POST | Search products on platforms |
| `POST /api/checkout` | POST | Place real order (⚠️ actually orders!) |
| `GET /api/health` | GET | Health check |

---

## ⚡ Quick Test

Test the backend API directly:

```powershell
curl http://localhost:8000/api/health
```

Should return:
```json
{
  "status": "healthy",
  "service": "Bolke",
  "gemini_key_set": true
}
```

---

## 🐛 Common Issues

1. **"Module not found: browser-use"**
   - Run: `uvx browser-use install`

2. **"Port 8000 already in use"**
   - Change port: `uvicorn main:app --port 8001`

3. **Voice not working on frontend**
   - Must use **Chrome browser**
   - Must use **HTTPS or localhost** (Web Speech API requirement)

4. **Browser automation hanging**
   - Close all Chrome instances
   - Restart backend
   - The browser window should appear automatically

---

## 🎉 You're All Set!

Run both backend (port 8000) and frontend (port 3000) simultaneously, and start shopping with your voice!
