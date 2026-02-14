"""
Bolke — Browser Automation Agents
Uses browser-use + Gemini to search grocery platforms in real-time
and place actual orders.

NOTE: On Windows, browser-use's default Browser() fails inside uvicorn
because asyncio.create_subprocess_exec raises NotImplementedError.
We work around this by launching Chrome ourselves via subprocess.Popen
and connecting browser-use to it via CDP URL.
"""

import asyncio
import os
import logging
import subprocess
import time
import socket
from dataclasses import dataclass

from browser_use import Agent, Browser, ChatGoogle
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

logger = logging.getLogger(__name__)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")


# ---------------------------------------------------------------------------
# Structured output models (browser-use extracts into these)
# ---------------------------------------------------------------------------

class ScrapedProduct(BaseModel):
    """A single product scraped from a grocery platform."""
    name: str = Field(..., description="Full product name including brand and weight")
    price: float = Field(..., description="Price in INR as a number")
    brand: str = Field("", description="Brand name if identifiable")
    weight: str = Field("", description="Weight/quantity (e.g. 1L, 500g, 1kg)")
    image_url: str = Field("", description="Product image URL if visible")


class PlatformSearchResults(BaseModel):
    """Results from searching a single platform."""
    products: list[ScrapedProduct] = Field(
        default_factory=list,
        description="Top products found, sorted by relevance",
    )
    platform: str = Field("", description="Platform name (zepto/blinkit)")


class OrderConfirmation(BaseModel):
    """Result after placing an order."""
    success: bool = Field(False, description="Whether order was placed successfully")
    order_id: str = Field("", description="Order ID or confirmation number")
    estimated_delivery: str = Field("", description="Estimated delivery time")
    total_amount: float = Field(0.0, description="Total order amount in INR")
    tracking_url: str = Field("", description="URL to track the order")
    message: str = Field("", description="Any additional message or error")


# ---------------------------------------------------------------------------
# Comparison result
# ---------------------------------------------------------------------------

@dataclass
class ComparisonResult:
    """Combined results from multiple platforms with comparison."""
    zepto_results: list[dict]
    blinkit_results: list[dict]
    cheapest_provider: str
    cheapest_product: dict | None
    price_difference: float
    summary: str


# ---------------------------------------------------------------------------
# Browser Agent Manager
# ---------------------------------------------------------------------------

class BrowserAgentManager:
    """
    Manages browser-use agents for:
    1. Searching products on Zepto and Blinkit
    2. Comparing prices across platforms
    3. Placing real orders
    """

    # Platform URLs
    PLATFORMS = {
        "zepto": "https://www.zeptonow.com",
        "blinkit": "https://blinkit.com",
    }

    def __init__(self, chrome_profile_path: str | None = None):
        """
        Args:
            chrome_profile_path: Path to Chrome user data directory with saved logins.
                                 If None, uses a fresh browser (no auth).
        """
        self.chrome_profile_path = chrome_profile_path
        # Use Gemini 2.5 Flash - best for agentic use cases and browser automation
        self._llm = ChatGoogle(model="gemini-2.5-flash", api_key=GOOGLE_API_KEY)
        self._chrome_process = None
        self._cdp_port = None
        logger.info(f"✨ Initialized Browser Agent with model: gemini-2.5-flash")

    def _find_chrome_executable(self) -> str:
        """Find Chrome/Chromium executable on this system."""
        candidates = [
            # Playwright's managed Chromium (most reliable)
            os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright\chromium-1208\chrome-win64\chrome.exe"),
            # Standard Chrome installations
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        ]
        # Also check for any version of Playwright chromium
        pw_base = os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright")
        if os.path.isdir(pw_base):
            for d in sorted(os.listdir(pw_base), reverse=True):
                if d.startswith("chromium-"):
                    p = os.path.join(pw_base, d, "chrome-win64", "chrome.exe")
                    if os.path.exists(p):
                        candidates.insert(0, p)

        for path in candidates:
            if os.path.exists(path):
                logger.info(f"🌐 Found Chrome at: {path}")
                return path
        
        raise FileNotFoundError(
            "Chrome/Chromium not found. Run: python -m playwright install chromium"
        )

    def _find_free_port(self) -> int:
        """Find a free TCP port for CDP."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]

    def _launch_chrome_with_cdp(self) -> tuple[subprocess.Popen, int]:
        """
        Launch Chrome with remote debugging enabled via subprocess.Popen.
        This works on Windows even inside uvicorn's event loop (unlike
        asyncio.create_subprocess_exec which raises NotImplementedError).
        """
        chrome_path = self._find_chrome_executable()
        port = self._find_free_port()
        
        args = [
            chrome_path,
            f"--remote-debugging-port={port}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
        ]
        
        # Use a temp user-data-dir so sessions don't clash
        user_data_dir = os.path.join(os.environ.get("TEMP", "/tmp"), f"bolke_chrome_{port}")
        args.append(f"--user-data-dir={user_data_dir}")
        
        logger.info(f"🚀 Launching Chrome on CDP port {port}")
        proc = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        
        # Wait for Chrome to start and CDP to be ready
        for i in range(20):  # Wait up to 10 seconds
            time.sleep(0.5)
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=1):
                    logger.info(f"✅ Chrome CDP ready on port {port} (waited {(i+1)*0.5}s)")
                    return proc, port
            except (ConnectionRefusedError, OSError):
                continue
        
        proc.terminate()
        raise TimeoutError(f"Chrome failed to start CDP on port {port}")

    def _cleanup_chrome(self, proc: subprocess.Popen):
        """Terminate the Chrome process."""
        try:
            proc.terminate()
            proc.wait(timeout=5)
            logger.info("🛑 Chrome process terminated")
        except Exception as e:
            logger.warning(f"⚠️ Could not cleanly terminate Chrome: {e}")
            try:
                proc.kill()
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Search agents
    # ------------------------------------------------------------------

    async def search_platform(
        self,
        query: str,
        platform: str,
        max_results: int = 5,
    ) -> PlatformSearchResults:
        """
        Search a single platform for a product using browser-use.
        
        The agent literally opens the website, types the search query,
        reads the results, and returns structured product data.
        
        Args:
            query: Product to search for (e.g. "milk", "basmati rice 5kg")
            platform: "zepto" or "blinkit"
            max_results: Maximum number of products to return
            
        Returns:
            PlatformSearchResults with scraped product data
        """
        url = self.PLATFORMS.get(platform, self.PLATFORMS["zepto"])

        logger.info(f"🔍 Searching {platform} for: '{query}'")
        logger.info(f"   URL: {url}")
        logger.info(f"   Max results: {max_results}")

        # Use direct search URL for faster results
        search_url = f"{url}/s/?q={query.replace(' ', '+')}"
        
        task = f"""Go to: {search_url}

If a location popup appears:
1. Type "New Delhi" in the location/search field
2. Click on any location suggestion that appears in the dropdown
3. Wait for the page to load

Then look at the search results and tell me about the TOP {max_results} PRODUCTS YOU CAN SEE:

For EACH product card visible on screen, extract:
- name: The full product name (including brand and size)
- price: The price in rupees (if it shows ₹75, write 75.0)  
- brand: Brand name
- weight: Size like "1 kg", "500 g", "1 ltr"
- image_url: Product image URL if visible

IMPORTANT:
- Only report what you ACTUALLY SEE on the screen right now
- Do NOT make up or guess any data
- If you don't see {max_results} products, that's okay - just report what you see
- Skip products where price is not clearly visible

Return platform as "{platform}".
"""

        chrome_proc = None
        try:
            # Launch Chrome ourselves (avoids Windows asyncio subprocess crash)
            chrome_proc, cdp_port = self._launch_chrome_with_cdp()
            
            # Connect browser-use to our Chrome via CDP
            browser = Browser(cdp_url=f"http://127.0.0.1:{cdp_port}")
            
            logger.info(f"   Creating Agent with task...")
            agent = Agent(
                task=task,
                llm=self._llm,
                browser=browser,
                output_model_schema=PlatformSearchResults,
            )
            
            logger.info(f"   Running agent task...")
            result = await agent.run()
            logger.info(f"   Agent completed")

            # Extract structured output (browser-use returns it in result.structured_output)
            if result and result.structured_output:
                output = result.structured_output
                
                # Tag the platform name
                output.platform = platform
                
                # Validate that we got real data (basic checks)
                real_products = []
                for p in output.products:
                    # Skip products with suspicious/placeholder data
                    if p.price <= 0:
                        logger.warning(f"   ⚠️ Skipping product with invalid price: {p.name}")
                        continue
                    if not p.name or len(p.name) < 3:
                        logger.warning(f"   ⚠️ Skipping product with invalid name: {p.name}")
                        continue
                    real_products.append(p)
                
                output.products = real_products
                logger.info(f"✅ Found {len(output.products)} valid products on {platform}")
                for i, p in enumerate(output.products[:3]):
                    logger.info(f"   {i+1}. {p.name} - ₹{p.price}")
                
                if len(real_products) == 0:
                    logger.warning(f"⚠️ No valid products found on {platform} - agent may not have scraped correctly")
                    
                return output

            logger.warning(f"⚠️ No valid result from agent for {platform}")
            return PlatformSearchResults(products=[], platform=platform)
            
        except Exception as e:
            logger.error(f"❌ Error searching {platform}: {e}", exc_info=True)
            return PlatformSearchResults(products=[], platform=platform)
        finally:
            if chrome_proc:
                self._cleanup_chrome(chrome_proc)

    async def search_and_compare(
        self,
        query: str,
        max_results: int = 5,
    ) -> ComparisonResult:
        """
        Search BOTH Zepto and Blinkit in parallel and compare prices.
        
        Args:
            query: Product to search for
            max_results: Max results per platform
            
        Returns:
            ComparisonResult with products from both platforms and cheapest option
        """
        logger.info(f"🔄 Starting parallel search for: '{query}'")
        logger.info(f"   Max results per platform: {max_results}")
        
        # Run both searches in parallel
        zepto_task = self.search_platform(query, "zepto", max_results)
        blinkit_task = self.search_platform(query, "blinkit", max_results)

        logger.info("   Waiting for both searches to complete...")
        zepto_results, blinkit_results = await asyncio.gather(
            zepto_task,
            blinkit_task,
            return_exceptions=True,
        )
        logger.info("   Both searches completed")

        # Handle errors gracefully
        zepto_products = []
        blinkit_products = []

        if isinstance(zepto_results, PlatformSearchResults):
            zepto_products = [p.model_dump() for p in zepto_results.products]
            logger.info(f"✅ Zepto: {len(zepto_products)} products")
        else:
            logger.error(f"❌ Zepto search error: {zepto_results}")

        if isinstance(blinkit_results, PlatformSearchResults):
            blinkit_products = [p.model_dump() for p in blinkit_results.products]
            logger.info(f"✅ Blinkit: {len(blinkit_products)} products")
        else:
            logger.error(f"❌ Blinkit search error: {blinkit_results}")

        # Find cheapest across both platforms
        all_products = [
            {**p, "provider": "zepto"} for p in zepto_products
        ] + [
            {**p, "provider": "blinkit"} for p in blinkit_products
        ]

        cheapest = None
        if all_products:
            cheapest = min(all_products, key=lambda x: x.get("price", float("inf")))

        # Calculate price difference between platforms
        zepto_min = min((p["price"] for p in zepto_products), default=0)
        blinkit_min = min((p["price"] for p in blinkit_products), default=0)
        price_diff = abs(zepto_min - blinkit_min)

        if zepto_min > 0 and blinkit_min > 0:
            cheaper = "zepto" if zepto_min <= blinkit_min else "blinkit"
        elif zepto_min > 0:
            cheaper = "zepto"
        elif blinkit_min > 0:
            cheaper = "blinkit"
        else:
            cheaper = "unknown"

        summary = self._build_comparison_summary(
            query, zepto_products, blinkit_products, cheaper, price_diff
        )

        logger.info(f"📊 Comparison complete:")
        logger.info(f"   Cheapest provider: {cheaper}")
        logger.info(f"   Price difference: ₹{price_diff:.2f}")
        logger.info(f"   Total products found: {len(all_products)}")

        return ComparisonResult(
            zepto_results=zepto_products,
            blinkit_results=blinkit_products,
            cheapest_provider=cheaper,
            cheapest_product=cheapest,
            price_difference=price_diff,
            summary=summary,
        )

    def _build_comparison_summary(
        self,
        query: str,
        zepto: list[dict],
        blinkit: list[dict],
        cheaper: str,
        diff: float,
    ) -> str:
        """Build a human-readable comparison summary."""
        parts = [f'Results for "{query}":']
        if zepto:
            parts.append(f"  Zepto: {len(zepto)} results, cheapest ₹{min(p['price'] for p in zepto):.0f}")
        else:
            parts.append("  Zepto: No results found")
        if blinkit:
            parts.append(f"  Blinkit: {len(blinkit)} results, cheapest ₹{min(p['price'] for p in blinkit):.0f}")
        else:
            parts.append("  Blinkit: No results found")
        if cheaper != "unknown":
            parts.append(f"  → {cheaper.title()} is cheaper by ₹{diff:.0f}")
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Order placement
    # ------------------------------------------------------------------

    async def place_order(
        self,
        items: list[str],
        provider: str = "blinkit",
        address: str = "",
    ) -> OrderConfirmation:
        """
        FULLY AUTOMATED order placement - adds items to cart and completes checkout.
        
        The agent will:
        1. Add all items to cart
        2. Go to checkout
        3. Select COD payment
        4. Place the order automatically
        
        Args:
            items: List of product names to order (e.g. ["Amul Milk 1L"])
            provider: "zepto" or "blinkit"
            address: Not used (user must be logged in with saved address)
            
        Returns:
            OrderConfirmation with order ID and delivery details
        """
        url = self.PLATFORMS.get(provider, self.PLATFORMS["blinkit"])
        items_formatted = "\n".join(f"  {i+1}. {item}" for i, item in enumerate(items))

        task = f"""
        FULLY AUTOMATED ORDER FLOW - Complete the entire order without stopping.
        
        Requirements:
        - You MUST be logged in to {provider} (using saved Chrome profile)
        - You MUST have a saved delivery address
        
        Items to order:
{items_formatted}

        STEP-BY-STEP INSTRUCTIONS:

        === PHASE 1: ADD ITEMS TO CART ===
        For each item in the list:
        1. Navigate to: {url}/s/?q={{item_name}} (replace spaces with +)
        2. Wait 3 seconds for search results
        3. Find the FIRST product that matches
        4. Click the "Add" or "ADD" button
        5. Wait 2 seconds
        6. Continue to next item

        === PHASE 2: GO TO CHECKOUT ===
        7. Click on Cart icon (usually top-right corner)
        8. Review items in cart
        9. Click "Proceed to Checkout" or "Checkout" button
        10. Wait for checkout page to load

        === PHASE 3: CONFIRM ADDRESS ===
        11. Verify delivery address is shown
        12. If prompted to select/confirm address, click "Deliver Here" or similar
        13. Proceed to payment section

        === PHASE 4: SELECT PAYMENT & PLACE ORDER ===
        14. Look for payment options
        15. Select "Cash on Delivery" (COD) option
        16. Click "Place Order" or "Confirm Order" button
        17. Wait for order confirmation page

        === PHASE 5: EXTRACT ORDER DETAILS ===
        18. Extract order ID/number from confirmation page
        19. Extract estimated delivery time
        20. Extract total amount paid
        21. Note any tracking URL if visible

        IMPORTANT:
        - If location popup appears, select "Delhi" or "Bangalore"
        - If any item is out of stock, note it in message but continue with others
        - If login required, set success=false with message "Please login first"
        - Set success=true ONLY if you see "Order Placed" or confirmation page
        - If anything fails, set success=false and explain in message

        Return structured data:
        - success: true/false
        - order_id: confirmation number from page
        - estimated_delivery: time shown (e.g. "20 minutes", "tomorrow")
        - total_amount: final amount in rupees
        - message: "Order placed successfully" or error details
        """

        chrome_proc = None
        try:
            logger.info(f"🛒 AUTOMATED ORDER: {len(items)} items on {provider}")
            logger.info("   ⚠️  This will ACTUALLY place a real order!")
            
            chrome_proc, cdp_port = self._launch_chrome_with_cdp()
            browser = Browser(cdp_url=f"http://127.0.0.1:{cdp_port}")
            
            agent = Agent(
                task=task,
                llm=self._llm,
                browser=browser,
                output_model_schema=OrderConfirmation,
            )
            result = await agent.run()

            if result and result.structured_output:
                output = result.structured_output
                if output.success:
                    logger.info(f"✅ ORDER PLACED! ID: {output.order_id}")
                    logger.info(f"   Delivery: {output.estimated_delivery}")
                    logger.info(f"   Total: ₹{output.total_amount}")
                else:
                    logger.warning(f"⚠️ Order failed: {output.message}")
                return output

            return OrderConfirmation(
                success=False,
                message="Agent did not complete the order flow. Check if you're logged in.",
            )
        except Exception as e:
            logger.error(f"❌ Order placement failed: {e}")
            return OrderConfirmation(
                success=False,
                message=f"Error during order: {str(e)}",
            )
        finally:
            if chrome_proc:
                self._cleanup_chrome(chrome_proc)
            logger.info("🌐 Browser closed")


# ---------------------------------------------------------------------------
# Singleton instance
# ---------------------------------------------------------------------------

# Set your Chrome profile path here for pre-saved logins (OPTIONAL)
# On Windows, typically: C:\Users\<you>\AppData\Local\Google\Chrome\User Data
# If not set or invalid, will use a fresh browser (you'll need to log in manually)
CHROME_PROFILE = os.getenv("CHROME_PROFILE_PATH", None)

print(f"🌐 Chrome Profile: {CHROME_PROFILE if CHROME_PROFILE else 'Not configured (using fresh browser)'}")

agent_manager = BrowserAgentManager(chrome_profile_path=CHROME_PROFILE)
