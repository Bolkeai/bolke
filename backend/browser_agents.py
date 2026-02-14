"""
Bolke — Browser Automation Agents
Uses browser-use + Gemini to search grocery platforms in real-time
and place actual orders.
"""

import asyncio
import json
import os
from dataclasses import dataclass

from browser_use import Agent, Browser, BrowserProfile, ChatGoogle
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

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
        self._llm = ChatGoogle(model="gemini-2.0-flash", api_key=GOOGLE_API_KEY)

    def _get_browser(self) -> Browser:
        """Create a browser instance, optionally with a saved Chrome profile."""
        if self.chrome_profile_path and os.path.exists(self.chrome_profile_path):
            try:
                return Browser(
                    is_local=True,
                    browser_profile=BrowserProfile(
                        user_data_dir=self.chrome_profile_path,
                        headless=False,  # Show browser for demo visibility
                    )
                )
            except Exception as e:
                print(f"Warning: Could not use Chrome profile at {self.chrome_profile_path}: {e}")
                print("Falling back to default browser...")
        
        # Default: use a fresh browser instance (no saved logins)
        return Browser(
            is_local=True,
            browser_profile=BrowserProfile(
                headless=False,  # Show browser during demo
            )
        )

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

        task = f"""
        Go to {url}
        
        Search for "{query}" using the search bar on the website.
        
        Look at the search results and extract the top {max_results} products.
        For each product extract:
        - Full product name (including brand and weight/size)
        - Price in INR (just the number, e.g. 62.0 not "₹62")
        - Brand name (if you can identify it)
        - Weight or quantity (e.g. "1L", "500g", "5kg")
        - Product image URL (if visible in the page)
        
        Set platform to "{platform}".
        
        IMPORTANT: 
        - If a search bar is not immediately visible, look for a search icon or text field
        - Wait for results to load after searching
        - Extract ACTUAL prices shown on the page, not estimated ones
        - If the site asks for location/pincode, try to dismiss it or enter pincode 560001 (Bangalore)
        """

        browser = self._get_browser()
        try:
            agent = Agent(
                task=task,
                llm=self._llm,
                browser=browser,
                output_model_schema=PlatformSearchResults,
            )
            result = await agent.run()

            if result and result.structured_output:
                output = result.structured_output
                if isinstance(output, dict):
                    # browser_use returned a raw dict instead of a Pydantic model
                    products = [ScrapedProduct(**p) for p in output.get('products', [])]
                    return PlatformSearchResults(products=products, platform=platform)
                output.platform = platform
                return output

            # structured_output is None (common when schema has $defs — browser_use
            # fails JSON-schema validation but the agent still calls done() with the
            # correct data).  Parse it from the final_result string instead.
            if result:
                raw = None
                try:
                    # final_result is a property in some versions, method in others
                    fr = result.final_result
                    raw = fr() if callable(fr) else fr
                except Exception:
                    pass
                if raw:
                    try:
                        data = json.loads(raw)
                        products = [ScrapedProduct(**p) for p in data.get('products', [])]
                        print(f"[{platform}] Parsed {len(products)} products from final_result")
                        return PlatformSearchResults(products=products, platform=platform)
                    except Exception as e:
                        print(f"[{platform}] Failed to parse final_result: {e}\nRaw: {raw[:200]}")

            print(f"[{platform}] No results extracted")
            return PlatformSearchResults(products=[], platform=platform)
        finally:
            await browser.close()

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
        # Run both searches in parallel
        zepto_task = self.search_platform(query, "zepto", max_results)
        blinkit_task = self.search_platform(query, "blinkit", max_results)

        zepto_results, blinkit_results = await asyncio.gather(
            zepto_task,
            blinkit_task,
            return_exceptions=True,
        )

        # Handle errors gracefully
        zepto_products = []
        blinkit_products = []

        if isinstance(zepto_results, PlatformSearchResults):
            zepto_products = [p.model_dump() for p in zepto_results.products]
        else:
            print(f"Zepto search error: {zepto_results}")

        if isinstance(blinkit_results, PlatformSearchResults):
            blinkit_products = [p.model_dump() for p in blinkit_results.products]
        else:
            print(f"Blinkit search error: {blinkit_results}")

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

        return ComparisonResult(
            zepto_results=zepto_products,
            blinkit_results=blinkit_products,
            cheapest_provider=cheaper,
            cheapest_product=cheapest,
            price_difference=price_diff,
            summary=summary,
        )

    async def search_and_compare_with_progress(
        self,
        query: str,
        platforms: list[str],
        progress: asyncio.Queue,
        max_results: int = 5,
    ) -> ComparisonResult:
        """
        Same as search_and_compare but emits real progress events into `progress` queue
        as each platform search runs.
        """
        await progress.put({"type": "log", "message": f'Searching for "{query}" on {" and ".join(p.title() for p in platforms)}…'})

        async def run_zepto():
            await progress.put({"type": "log", "message": "Opening Zepto…"})
            result = await self.search_platform(query, "zepto", max_results)
            count = len(result.products)
            await progress.put({
                "type": "log",
                "message": f"Zepto: found {count} result{'s' if count != 1 else ''}" if count else "Zepto: no results found",
            })
            return result

        async def run_blinkit():
            await progress.put({"type": "log", "message": "Opening Blinkit…"})
            result = await self.search_platform(query, "blinkit", max_results)
            count = len(result.products)
            await progress.put({
                "type": "log",
                "message": f"Blinkit: found {count} result{'s' if count != 1 else ''}" if count else "Blinkit: no results found",
            })
            return result

        tasks = []
        if "zepto" in platforms:
            tasks.append(run_zepto())
        if "blinkit" in platforms:
            tasks.append(run_blinkit())

        results = await asyncio.gather(*tasks, return_exceptions=True)

        zepto_results_obj = next((r for r in results if isinstance(r, PlatformSearchResults) and r.platform == "zepto"), None)
        blinkit_results_obj = next((r for r in results if isinstance(r, PlatformSearchResults) and r.platform == "blinkit"), None)

        zepto_products = [p.model_dump() for p in zepto_results_obj.products] if zepto_results_obj else []
        blinkit_products = [p.model_dump() for p in blinkit_results_obj.products] if blinkit_results_obj else []

        await progress.put({"type": "log", "message": "Comparing prices…"})

        all_products = (
            [{**p, "provider": "zepto"} for p in zepto_products]
            + [{**p, "provider": "blinkit"} for p in blinkit_products]
        )
        cheapest = min(all_products, key=lambda x: x.get("price", float("inf"))) if all_products else None

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

        summary = self._build_comparison_summary(query, zepto_products, blinkit_products, cheaper, price_diff)
        await progress.put({"type": "log", "message": f"Done — {cheaper.title()} is cheaper" if cheaper != "unknown" else "Done"})

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
        provider: str = "zepto",
        address: str = "",
    ) -> OrderConfirmation:
        """
        Place a REAL order on a grocery platform using browser-use.
        
        The agent navigates the platform, adds items to cart,
        proceeds to checkout, selects COD, and places the order.
        
        Args:
            items: List of product names to order (e.g. ["Amul Milk 1L", "Bread"])
            provider: "zepto" or "blinkit"
            address: Delivery address hint (agent uses pre-saved address)
            
        Returns:
            OrderConfirmation with order ID, tracking, and status
        """
        url = self.PLATFORMS.get(provider, self.PLATFORMS["zepto"])
        items_formatted = "\n".join(f"  - {item}" for item in items)

        task = f"""
        Go to {url}

        You need to order these items:
{items_formatted}

        For EACH item:
        1. Search for the item using the search bar
        2. Find the best matching product
        3. Click "Add" or "Add to Cart" button
        4. Go back to search for the next item

        After adding ALL items:
        5. Go to the cart
        6. Proceed to checkout
        7. Verify the delivery address{f' (should be: {address})' if address else ''}
        8. Select "Cash on Delivery" as payment method
        9. Place the order / Confirm the order

        After order is placed:
        10. Extract the order ID / confirmation number
        11. Extract the estimated delivery time
        12. Extract the total amount paid
        13. Note the tracking URL if available

        IMPORTANT:
        - If asked for location, allow location access or enter pincode
        - If an item is not found, skip it and note it in the message
        - Do NOT actually pay — only select COD (Cash on Delivery)
        - Set success to true only if the order confirmation page appears
        """

        browser = self._get_browser()
        try:
            agent = Agent(
                task=task,
                llm=self._llm,
                browser=browser,
                output_model_schema=OrderConfirmation,
            )
            result = await agent.run()

            if result and result.structured_output:
                return result.structured_output

            return OrderConfirmation(
                success=False,
                message="Browser agent did not return structured output",
            )
        finally:
            await browser.close()


# ---------------------------------------------------------------------------
# Singleton instance
# ---------------------------------------------------------------------------

# Set your Chrome profile path here for pre-saved logins (OPTIONAL)
# On Windows, typically: C:\Users\<you>\AppData\Local\Google\Chrome\User Data
# If not set or invalid, will use a fresh browser (you'll need to log in manually)
CHROME_PROFILE = os.getenv("CHROME_PROFILE_PATH", None)

print(f"🌐 Chrome Profile: {CHROME_PROFILE if CHROME_PROFILE else 'Not configured (using fresh browser)'}")

agent_manager = BrowserAgentManager(chrome_profile_path=CHROME_PROFILE)
