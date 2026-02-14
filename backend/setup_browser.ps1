# Bolke Browser Setup Script
# Run this to ensure browser automation is fully configured

Write-Host "🔧 Setting up browser automation for Bolke..." -ForegroundColor Cyan

# Step 1: Ensure we're in the backend directory with venv activated
if (-not (Test-Path ".venv")) {
    Write-Host "❌ Virtual environment not found. Run this from backend/ directory" -ForegroundColor Red
    exit 1
}

Write-Host "`n📦 Step 1: Installing Python dependencies..." -ForegroundColor Yellow
python -m pip install --upgrade pip
python -m pip install playwright browser-use fastapi google-generativeai pydantic python-dotenv uvicorn websockets

Write-Host "`n🌐 Step 2: Installing Playwright browsers..." -ForegroundColor Yellow
Write-Host "   This will download Chromium (~170 MB) - please be patient..." -ForegroundColor Gray
python -m playwright install chromium

Write-Host "`n✅ Step 3: Verifying installation..." -ForegroundColor Yellow
$playwrightCheck = python -c "from playwright.sync_api import sync_playwright; print('OK')" 2>&1
if ($playwrightCheck -like "*OK*") {
    Write-Host "   ✓ Playwright installed correctly" -ForegroundColor Green
} else {
    Write-Host "   ✗ Playwright installation failed" -ForegroundColor Red
    exit 1
}

$browserUseCheck = python -c "from browser_use import Agent, Browser; print('OK')" 2>&1
if ($browserUseCheck -like "*OK*") {
    Write-Host "   ✓ browser-use installed correctly" -ForegroundColor Green
} else {
    Write-Host "   ✗ browser-use installation failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n🧪 Step 4: Running browser test..." -ForegroundColor Yellow
Write-Host "   This will open a browser window to test automation..." -ForegroundColor Gray
python test_browser.py

Write-Host "`n🎉 Setup complete!" -ForegroundColor Green
Write-Host "`nℹ️  To start the backend:" -ForegroundColor Cyan
Write-Host "   uvicorn main:app --reload --port 8000" -ForegroundColor White
