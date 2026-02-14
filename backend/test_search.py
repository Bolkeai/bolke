"""
Quick test to verify the refactored browser search works.
Tests the CDP-based approach that avoids Windows subprocess issues.
"""

import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from browser_agents import BrowserAgentManager

async def test_search():
    """Test searching for Maggi on Blinkit."""
    print("🧪 Testing browser search with CDP approach...")
    print(f"   GOOGLE_API_KEY set: {'Yes' if os.getenv('GOOGLE_API_KEY') else 'No'}")
    
    agent_manager = BrowserAgentManager()
    
    print("\n1️⃣ Testing search for 'Maggi'...")
    results = await agent_manager.search_platform(
        query="Maggi",
        platform="blinkit",
        max_results=5
    )
    
    print(f"\n📊 Results for 'Maggi':")
    print(f"   Platform: {results.platform}")
    print(f"   Products found: {len(results.products)}")
    
    if results.products:
        print("\n📦 Products:")
        for i, prod in enumerate(results.products, 1):
            print(f"   {i}. {prod.name}")
            print(f"      Price: ₹{prod.price}")
            print(f"      Brand: {prod.brand}")
            print(f"      Weight: {prod.weight}")
            print()
        print("✅ Search SUCCESSFUL!")
    else:
        print("⚠️ No products found")
    
    return results.products

if __name__ == "__main__":
    asyncio.run(test_search())
