# Bolke - Testing Guide

## Backend Testing

### 1. Setup Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**

### 2. Test Health Endpoint

Open browser: http://localhost:8000/api/health

Expected response:
```json
{
  "status": "healthy",
  "service": "Bolke",
  "gemini_key_set": true
}
```

### 3. Test Voice Processing (PowerShell)

```powershell
$body = @{
    text = "mujhe tomatoes chahiye"
    session_id = "test-123"
    cart = @()
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/voice" `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

Expected response includes:
- `intent`: "SEARCH"
- `products`: ["tomatoes"]
- `response_text`: Hindi/Hinglish response
- `search_results`: Real-time search from Zepto/Blinkit

### 4. Test Direct Search

```powershell
$body = @{
    query = "milk"
    platforms = @("zepto", "blinkit")
    max_results = 5
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/search" `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Frontend Testing

### 1. Setup Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:3000**

### 2. Test Voice Search

1. Open http://localhost:3000
2. Click the microphone button
3. Say: "Tamatar dikhao" or "Show me milk"
4. Wait for processing
5. Should see real products from Zepto/Blinkit

### 3. Test Quick Actions

Click any suggested query button:
- "Tamatar aur Pyaaz dikhao"
- "Show me fresh milk"
- "Price of 5kg Atta"
- "Maggi add karo"

Should show real product results from backend.

### 4. Test Cart

1. Search for products
2. Click "Add to Cart" on any product
3. Click shopping bag icon (top right)
4. Verify cart drawer opens with items

## Integration Testing Checklist

- [ ] Backend starts without errors
- [ ] Backend health check returns `gemini_key_set: true`
- [ ] Frontend loads without console errors
- [ ] Voice search triggers backend API call
- [ ] Real products appear (not mock data)
- [ ] Products show prices from both Zepto and Blinkit
- [ ] Adding to cart works
- [ ] Cart persists items correctly
- [ ] TTS speaks Hindi responses

## Common Issues

### Backend Issues

**Issue**: `ModuleNotFoundError: No module named 'browser_use'`
**Fix**: Make sure you're in the venv and run:
```powershell
pip install browser-use fastapi google-generativeai pydantic python-dotenv uvicorn
```

**Issue**: `google.generativeai deprecated warning`
**Status**: Warning only, backend works fine. Will migrate to `google.genai` later.

**Issue**: Browser automation fails
**Check**: 
- Chrome/Chromium is installed
- Network connection is active
- Zepto/Blinkit websites are accessible

### Frontend Issues

**Issue**: "Failed to fetch" or CORS error
**Fix**: 
1. Ensure backend is running on port 8000
2. Check frontend `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`
3. Restart frontend dev server

**Issue**: Still showing mock/hardcoded data
**Fix**: 
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Check browser console for errors
- Verify backend API is being called (Network tab)

**Issue**: Voice recognition not working
**Fix**: 
- Use Chrome browser (best Web Speech API support)
- Allow microphone permissions
- Ensure HTTPS or localhost (required for mic access)

## Testing Real Orders (⚠️ USE WITH CAUTION)

The `/api/checkout` endpoint places REAL orders!

**Prerequisites**:
1. Chrome profile with logged-in Zepto/Blinkit account
2. Valid delivery address set on the platform
3. Payment method configured

**Test** (only if you want to place a real order):
```powershell
$body = @{
    items = @("tomatoes", "milk")
    provider = "zepto"
    address = "Home"
    session_id = "test-123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/checkout" `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Performance Notes

- First search takes longer (browser automation startup)
- Subsequent searches are faster (browser stays warm)
- Gemini API calls take 1-3 seconds
- Browser scraping takes 5-10 seconds per platform

## Debug Mode

### Backend Logs
Backend logs show:
- Gemini API calls
- Browser automation steps
- Search results
- Errors

Watch the backend terminal for detailed logs.

### Frontend Console
Open browser DevTools (F12):
- Monitor API calls in Network tab
- Check console for errors
- Inspect state changes

## Next Steps

- Test with different voice queries
- Try Hindi/Hinglish mix commands
- Test multi-item searches
- Verify price comparisons are accurate
- Test cart checkout flow (mock for now)
