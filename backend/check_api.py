"""Check google-genai Live API methods"""
import asyncio
from google import genai

async def check_api():
    client = genai.Client(api_key="test")
    
    # List all methods on AsyncSession
    from google.genai.live import AsyncSession
    methods = [m for m in dir(AsyncSession) if not m.startswith('_')]
    print("AsyncSession methods:")
    for method in methods:
        print(f"  - {method}")

asyncio.run(check_api())
