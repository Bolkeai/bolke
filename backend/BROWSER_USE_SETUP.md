# Browser-use Setup & API Information

## Important: No Separate API Key Needed ✅

**browser-use does NOT require its own API key.** It uses the Gemini API key you already have configured in `.env`.

## What is browser-use?

`browser-use` is a library that:
- Controls a real Chrome browser using Playwright
- Uses Gemini AI to understand web pages and perform actions
- Scrapes data by actually interacting with websites like a human would

## How It Works

1. **You provide**: Gemini API key (already in your `.env`)
2. **browser-use creates**: A Chrome browser instance
3. **Gemini AI controls**: The browser to search, click, read, extract data
4. **You get**: Structured product data scraped in real-time

## What's Configured

### In your `.env`:
```bash
GOOGLE_API_KEY=AIzaSyCAbhFNMxcmpshyDMnGXeChMbtHk0i5z5I  # Used by browser-use
CHROME_PROFILE_PATH=C:\Users\laxma\AppData\Local\Google\Chrome\User Data
```

### In `browser_agents.py`:
```python
from browser_use import Agent, Browser, ChatGoogle

# This uses your GOOGLE_API_KEY automatically
llm = ChatGoogle(model="gemini-2.0-flash", api_key=GOOGLE_API_KEY)

# Browser setup with your Chrome profile
browser = Browser(
    is_local=True,
    browser_profile=BrowserProfile(
        user_data_dir=chrome_profile_path,  # Your Chrome logins/cookies
        headless=False  # Shows browser window
    )
)
```

## Dependencies Installed

When you ran `pip install browser-use`, it installed:
- `playwright` - Browser automation framework
- `pydantic` - Data validation
- Browser binaries (Chromium) - For controlling the browser

## No Additional Setup Required

✅ **You're all set!** browser-use will:
1. Use your Gemini API key
2. Open Chrome with your profile (saved logins)
3. Search Zepto/Blinkit automatically
4. Extract product data
5. Return structured results

## Common Issues & Solutions

### Issue 1: "Playwright browsers not found"
**Solution**: Run this once:
```powershell
python -m playwright install chromium
```

### Issue 2: "Chrome profile locked"
**Solution**: Close all Chrome windows before starting the backend

### Issue 3: Browser opens but doesn't search
**Possible causes**:
1. Website changed layout (browser-use relies on Gemini understanding the page)
2. Location/pincode popup blocking (agent tries to dismiss these)
3. Network issues

**Check the logs** for what the agent is doing!

### Issue 4: No products returned
**Possible causes**:
1. Search query too vague
2. Product not available on that platform
3. Browser automation timed out
4. Website anti-bot detection

**Check logs** for detailed error messages.

## Enabling Detailed Logs

The backend now has comprehensive logging. You'll see:
- `🔍 Searching zepto for: 'milk'`
- `🌐 Using Chrome profile: C:\Users\...`
- `✅ Found 5 products on zepto`
- `📊 Comparison complete: Cheapest provider: zepto`

## Testing browser-use

To test if browser-use is working:

### 1. Start backend with logging
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

Watch the terminal for detailed logs.

### 2. Test search endpoint
```powershell
$body = @{
    query = "milk"
    platforms = @("zepto", "blinkit")
    max_results = 3
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/search" `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

### 3. What to look for

In the terminal you should see:
```
INFO - 🔍 Searching zepto for: 'milk'
INFO -    URL: https://www.zeptonow.com
INFO -    Max results: 3
INFO - 🌐 Using Chrome profile: C:\Users\laxma\...
INFO -    Creating browser agent...
INFO -    Running agent task...
INFO -    Agent completed
INFO - ✅ Found 3 products on zepto
INFO -    1. Amul Taaza Milk - ₹27
INFO -    2. Mother Dairy Milk - ₹28
INFO -    3. Nestle Milk - ₹30
```

A Chrome window will open and you'll see it:
1. Navigate to Zepto/Blinkit
2. Find the search bar
3. Type your query
4. Wait for results
5. Extract product data

## Performance Notes

- **First search**: 20-30 seconds (browser startup + page load)
- **Subsequent searches**: 10-15 seconds (browser stays warm)
- **Parallel search** (Zepto + Blinkit): ~15-20 seconds total

## API Costs

- **browser-use**: FREE (no separate API)
- **Gemini API**: 
  - Intent parsing: ~500 tokens per request
  - Browser automation: ~1000-2000 tokens per search
  - **Cost**: Gemini 2.0 Flash is very cheap (~$0.01 per 100 requests)

## Debugging Tips

If searches are failing:

1. **Check logs**: Look for error messages
2. **Watch browser**: See if it's actually searching correctly
3. **Try simpler queries**: Start with "milk" or "bread"
4. **Test one platform**: Comment out one search to isolate issues
5. **Check internet**: Make sure Zepto/Blinkit sites are accessible

## Need More Control?

Edit the search task in `browser_agents.py`:

```python
task = f"""
Go to {url}

Search for "{query}" using the search bar.

[YOUR CUSTOM INSTRUCTIONS HERE]
"""
```

The more specific you are, the better Gemini can control the browser!
