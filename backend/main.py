"""
Bolke — FastAPI Backend
Voice-first grocery shopping API.

Endpoints:
    POST /api/voice    — Process voice transcript → intent + search + response
    POST /api/search   — Direct product search across platforms
    POST /api/checkout  — Place a real order via browser automation
    GET  /              — Serve the frontend
"""

import os
import uuid
from contextlib import asynccontextmanager
from dataclasses import asdict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

from gemini_engine import engine as gemini
from browser_agents import agent_manager


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class VoiceRequest(BaseModel):
    """Incoming voice transcript."""
    text: str                          # Raw transcript from speech recognition
    session_id: str = "default"        # Session for conversation history
    cart: list[dict] = []              # Current cart state


class SearchRequest(BaseModel):
    """Direct product search."""
    query: str                         # Product to search for
    platforms: list[str] = ["zepto", "blinkit"]  # Which platforms to search
    max_results: int = 5


class CheckoutRequest(BaseModel):
    """Order placement request."""
    items: list[str]                   # Product names to order
    provider: str = "zepto"            # Platform to order from
    address: str = ""                  # Delivery address hint
    session_id: str = "default"


class VoiceResponse(BaseModel):
    """Response to voice input."""
    intent: str
    products: list[str]
    quantities: list[str]
    brands: list[str]
    response_text: str                 # Hindi text for TTS
    search_results: dict | None = None  # Populated if intent is SEARCH
    session_id: str = "default"


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    print("🎙️  Bolke backend starting...")
    print(f"   Gemini API key: {'✅ set' if os.getenv('GOOGLE_API_KEY') else '❌ MISSING'}")
    yield
    print("Bolke backend shutting down.")


app = FastAPI(
    title="Bolke API",
    description="Voice-first grocery shopping for Bharat",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend to call from any origin during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.post("/api/voice", response_model=VoiceResponse)
async def process_voice(req: VoiceRequest):
    """
    Main voice processing endpoint.
    
    Flow:
    1. Gemini parses the transcript into a structured intent
    2. If intent is SEARCH → trigger browser-use to search platforms
    3. If intent is CHECKOUT → redirect to /api/checkout
    4. Return intent + response text for TTS
    """
    try:
        # Step 1: Parse intent with Gemini
        parsed = await gemini.parse_intent(
            user_text=req.text,
            cart=req.cart,
            session_id=req.session_id,
        )

        response = VoiceResponse(
            intent=parsed.intent,
            products=parsed.products,
            quantities=parsed.quantities,
            brands=parsed.brands,
            response_text=parsed.response_text,
            session_id=req.session_id,
        )

        # Step 2: If SEARCH intent, automatically search platforms
        if parsed.intent == "SEARCH" and parsed.products:
            # Search for the first product (most common case)
            query = parsed.products[0]
            if parsed.brands and parsed.brands[0]:
                query = f"{parsed.brands[0]} {query}"
            if parsed.quantities and parsed.quantities[0] != "1":
                query = f"{query} {parsed.quantities[0]}"

            try:
                comparison = await agent_manager.search_and_compare(
                    query=query,
                    max_results=5,
                )
                response.search_results = {
                    "zepto": comparison.zepto_results,
                    "blinkit": comparison.blinkit_results,
                    "cheapest_provider": comparison.cheapest_provider,
                    "cheapest_product": comparison.cheapest_product,
                    "price_difference": comparison.price_difference,
                    "summary": comparison.summary,
                }

                # Generate a richer comparison response
                comparison_text = await gemini.generate_comparison_response(
                    query=query,
                    results=response.search_results,
                    session_id=req.session_id,
                )
                response.response_text = comparison_text

            except Exception as e:
                print(f"Search error (non-fatal): {e}")
                # Keep the Gemini response even if browser search fails
                response.response_text += " (abhi search mein thoda time lag raha hai)"

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice processing failed: {str(e)}")


@app.post("/api/search")
async def search_products(req: SearchRequest):
    """
    Direct product search across platforms.
    Runs browser-use agents on selected platforms and returns comparison.
    """
    try:
        if len(req.platforms) >= 2:
            comparison = await agent_manager.search_and_compare(
                query=req.query,
                max_results=req.max_results,
            )
            return {
                "query": req.query,
                "zepto": comparison.zepto_results,
                "blinkit": comparison.blinkit_results,
                "cheapest_provider": comparison.cheapest_provider,
                "cheapest_product": comparison.cheapest_product,
                "price_difference": comparison.price_difference,
                "summary": comparison.summary,
            }
        else:
            platform = req.platforms[0]
            results = await agent_manager.search_platform(
                query=req.query,
                platform=platform,
                max_results=req.max_results,
            )
            return {
                "query": req.query,
                "platform": platform,
                "products": [p.model_dump() for p in results.products],
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.post("/api/checkout")
async def checkout(req: CheckoutRequest):
    """
    Place a REAL order using browser automation.
    
    ⚠️ This will actually place an order on the selected platform!
    Make sure you have a valid account and delivery address set up.
    """
    try:
        result = await agent_manager.place_order(
            items=req.items,
            provider=req.provider,
            address=req.address,
        )
        return result.model_dump()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Checkout failed: {str(e)}")


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Bolke",
        "gemini_key_set": bool(os.getenv("GOOGLE_API_KEY")),
    }


# ---------------------------------------------------------------------------
# Serve frontend static files
# ---------------------------------------------------------------------------

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    async def serve_frontend():
        """Serve the main frontend page."""
        index = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return {"message": "Bolke API is running. Frontend not found at /frontend/index.html"}
else:
    @app.get("/")
    async def root():
        return {"message": "Bolke API is running. Add frontend files to /frontend/"}
