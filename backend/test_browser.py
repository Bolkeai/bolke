"""
Quick test script to verify browser-use is working with real browser automation.
"""

import asyncio
import os
from dotenv import load_dotenv
from browser_use import Agent, Browser, BrowserProfile, ChatGoogle
from pydantic import BaseModel, Field

load_dotenv()

class SimpleSearch(BaseModel):
    """Simple search result for testing."""
    products_found: int = Field(..., description="Number of products visible on page")
    website_title: str = Field("", description="Title of the website")
    search_worked: bool = Field(False, description="Did the search actually work")

async def test_browser():
    """Test if browser-use can actually navigate and search Blinkit."""
    print("🌐 Testing browser-use with Blinkit...")
    
    # Create LLM - use Gemini 2.5 Flash (stable model for agentic tasks)
    llm = ChatGoogle(
        model="gemini-2.5-flash",
        api_key=os.getenv("GOOGLE_API_KEY")
    )
    
    # Create browser
    browser = Browser(
        is_local=True,
        browser_profile=BrowserProfile(
            headless=False,  # Show browser
        )
    )
    
    task = """
    Go to https://blinkit.com
    
    Wait for the page to load completely.
    
    Look for a search bar or search button on the page.
    
    Count how many elements you can see (approximately).
    
    Return:
    - products_found: rough count of visible elements
    - website_title: the title you see on the page
    - search_worked: true if you successfully loaded the page
    
    Do NOT make up data - only return what you actually see.
    """
    
    try:
        print("   Creating agent...")
        agent = Agent(
            task=task,
            llm=llm,
            browser=browser,
            output_model_schema=SimpleSearch,
        )
        
        print("   Running agent (browser should open)...")
        result = await agent.run()
        
        print("\n✅ Browser test completed!")
        if result and result.structured_output:
            output = result.structured_output
            print(f"   Products found: {output.products_found}")
            print(f"   Website title: {output.website_title}")
            print(f"   Search worked: {output.search_worked}")
            
            if output.search_worked:
                print("\n🎉 Browser automation is WORKING!")
                return True
            else:
                print("\n⚠️ Browser opened but search may not have worked")
                return False
        else:
            print("\n❌ No structured output received")
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        print("\n   Closing browser...")
        await browser.stop()

if __name__ == "__main__":
    result = asyncio.run(test_browser())
    exit(0 if result else 1)
