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
import logging
import asyncio
from contextlib import asynccontextmanager
from dataclasses import asdict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from gemini_engine import engine as gemini
from browser_agents import agent_manager
from audio_streaming import audio_manager


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
    logger.info("🎙️  Bolke backend starting...")
    logger.info(f"   Gemini API key: {'✅ set' if os.getenv('GOOGLE_API_KEY') else '❌ MISSING'}")
    logger.info(f"   Chrome Profile: {os.getenv('CHROME_PROFILE_PATH', 'Not configured')}")
    logger.info(f"   Native Audio: ✅ Gemini Live API enabled")
    
    # Check browser automation setup
    try:
        from playwright.sync_api import sync_playwright
        logger.info(f"   Browser Automation: ✅ Playwright installed")
    except ImportError:
        logger.warning("   Browser Automation: ⚠️ Playwright NOT installed!")
        logger.warning("   → Run: python -m pip install playwright")
        logger.warning("   → Then: python -m playwright install chromium")
        logger.warning("   → Or use: .\\setup_browser.ps1")
        logger.warning("   ⚠️ Product search will NOT work without Playwright!")
    
    yield
    logger.info("Bolke backend shutting down.")


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
        logger.info(f"📝 Processing voice request: '{req.text}'")
        logger.info(f"   Session ID: {req.session_id}")
        logger.info(f"   Cart items: {len(req.cart)}")
        
        # Step 1: Parse intent with Gemini
        logger.info("🤖 Calling Gemini to parse intent...")
        parsed = await gemini.parse_intent(
            user_text=req.text,
            cart=req.cart,
            session_id=req.session_id,
        )
        
        logger.info(f"✅ Gemini parsed intent: {parsed.intent}")
        logger.info(f"   Products: {parsed.products}")
        logger.info(f"   Quantities: {parsed.quantities}")
        logger.info(f"   Brands: {parsed.brands}")
        logger.info(f"   Response: {parsed.response_text}")

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

            logger.info(f"🔍 Starting browser search for: '{query}'")
            try:
                comparison = await agent_manager.search_and_compare(
                    query=query,
                    max_results=5,
                )
                logger.info(f"✅ Search completed successfully")
                logger.info(f"   Zepto results: {len(comparison.zepto_results)}")
                logger.info(f"   Blinkit results: {len(comparison.blinkit_results)}")
                logger.info(f"   Cheapest: {comparison.cheapest_provider}")
                response.search_results = {
                    "zepto": comparison.zepto_results,
                    "blinkit": comparison.blinkit_results,
                    "cheapest_provider": comparison.cheapest_provider,
                    "cheapest_product": comparison.cheapest_product,
                    "price_difference": comparison.price_difference,
                    "summary": comparison.summary,
                }

                # Generate a richer comparison response
                logger.info("🤖 Generating comparison response with Gemini...")
                comparison_text = await gemini.generate_comparison_response(
                    query=query,
                    results=response.search_results,
                    session_id=req.session_id,
                )
                response.response_text = comparison_text
                logger.info(f"✅ Final response: {comparison_text}")

            except Exception as e:
                logger.error(f"❌ Search error (non-fatal): {e}", exc_info=True)
                # Keep the Gemini response even if browser search fails
                response.response_text += " (abhi search mein thoda time lag raha hai)"

        logger.info(f"📤 Returning response with intent: {response.intent}")
        return response

    except Exception as e:
        logger.error(f"❌ Voice processing failed: {e}", exc_info=True)
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


@app.websocket("/ws/audio")
async def websocket_audio_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time bidirectional audio streaming.
    
    Protocol:
    - Client sends: binary audio chunks (16-bit PCM, 16kHz, mono)
    - Server sends: binary audio chunks (16-bit PCM, 24kHz, mono) from Gemini
    
    The audio is processed in real-time through Gemini Live API with
    native audio understanding (no transcription needed).
    """
    await websocket.accept()
    logger.info("🔌 WebSocket connection accepted")
    
    # Create queues for bidirectional audio
    input_queue = asyncio.Queue()
    output_queue = asyncio.Queue()
    
    # Get session ID from query params or generate one
    session_id = websocket.query_params.get("session_id", f"ws-{uuid.uuid4()}")
    logger.info(f"📡 Starting audio stream for session: {session_id}")
    
    async def receive_from_client():
        """Receive audio from client and put in input queue."""
        try:
            while True:
                # Receive binary audio data from client
                data = await websocket.receive_bytes()
                await input_queue.put(data)
                logger.debug(f"📥 Received {len(data)} bytes from client")
        except WebSocketDisconnect:
            logger.info("🔌 Client disconnected")
            await input_queue.put(None)  # Signal end of stream
        except Exception as e:
            logger.error(f"❌ Error receiving from client: {e}", exc_info=True)
            await input_queue.put(None)
    
    async def send_to_client():
        """Send audio from output queue to client."""
        try:
            while True:
                # Get audio from Gemini
                audio_data = await output_queue.get()
                
                if audio_data is None:  # End of stream
                    break
                
                # Send to client
                await websocket.send_bytes(audio_data)
                logger.debug(f"📤 Sent {len(audio_data)} bytes to client")
        except Exception as e:
            logger.error(f"❌ Error sending to client: {e}", exc_info=True)
    
    try:
        # Start all tasks concurrently
        async with asyncio.TaskGroup() as tg:
            # Receive from client
            tg.create_task(receive_from_client())
            # Send to client
            tg.create_task(send_to_client())
            # Stream through Gemini Live API
            tg.create_task(
                audio_manager.stream_audio(
                    input_queue,
                    output_queue,
                    session_id=session_id
                )
            )
    except* Exception as eg:
        for e in eg.exceptions:
            logger.error(f"❌ Audio stream task failed: {e}", exc_info=True)
    finally:
        logger.info(f"🛑 Audio stream ended for session: {session_id}")
        try:
            await websocket.close()
        except:
            pass


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Bolke",
        "gemini_key_set": bool(os.getenv("GOOGLE_API_KEY")),
        "native_audio": True,
        "websocket_endpoint": "/ws/audio",
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
