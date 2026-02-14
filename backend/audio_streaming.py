"""
Bolke — Native Audio Streaming with Gemini Live API
Real-time bidirectional audio streaming using Gemini 2.5 Flash Native Audio.

Uses Gemini function calling (tools) to trigger browser searches —
the model calls search_product() instead of outputting text tags.
"""

import asyncio
import json
import logging
import os
from typing import AsyncIterator

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# Native Audio Model
MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

# ---------------------------------------------------------------------------
# Tool declarations — Gemini will CALL these instead of outputting text tags
# ---------------------------------------------------------------------------
SEARCH_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="search_product",
            description=(
                "Search for a grocery product on Blinkit. "
                "Call this IMMEDIATELY when the user asks for any product. "
                "Returns real-time prices and availability."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "query": types.Schema(
                        type="STRING",
                        description="Product name to search for, e.g. 'Maggi', 'toned milk 1 liter', 'atta 5kg'",
                    ),
                },
                required=["query"],
            ),
        ),
    ]
)


class AudioStreamManager:
    """
    Manages real-time audio streaming with Gemini Live API.
    Handles bidirectional audio: user speech → Gemini → AI response
    """

    def __init__(self):
        """Initialize the audio stream manager with Gemini client."""
        self.client = genai.Client(api_key=GOOGLE_API_KEY)
        # Import here to avoid circular imports
        from browser_agents import agent_manager
        self.agent_manager = agent_manager
        logger.info(f"✨ Initialized AudioStreamManager with model: {MODEL}")

    async def stream_audio(
        self,
        audio_input_queue: asyncio.Queue,
        audio_output_queue: asyncio.Queue,
        session_id: str = "default",
        system_instruction: str = None,
    ):
        """
        Create a bidirectional audio stream with Gemini.

        Args:
            audio_input_queue: Queue containing incoming audio chunks from user
            audio_output_queue: Queue where AI audio responses will be placed
            session_id: Unique session identifier
            system_instruction: Custom instructions for the AI
        """
        if not system_instruction:
            system_instruction = """You are Bolke — a friendly Hinglish-speaking kirana shop assistant.

CRITICAL RULE: When the user asks for ANY product, you MUST call the search_product tool IMMEDIATELY.
Do NOT speak about prices or availability until you have called the tool and received results.

Examples:
- User says "Maggi chahiye" → call search_product(query="Maggi")
- User says "2 liter milk do" → call search_product(query="toned milk 2 liter")  
- User says "bread" → call search_product(query="bread")

After you get search results back:
- Tell the user the product names and prices in friendly Hinglish
- Mention the cheapest option
- Ask if they want to add it to cart

If no results found:
- Tell the user it's not available right now
- Suggest they try a different name or similar product

NEVER make up prices. NEVER guess availability. ALWAYS use the tool first.
"""

        config = {
            "response_modalities": ["AUDIO"],
            "system_instruction": system_instruction,
            "tools": [SEARCH_TOOL],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {
                        "voice_name": "Puck"
                    }
                }
            }
        }

        logger.info(f"🎙️ Starting audio stream for session: {session_id}")

        try:
            async with self.client.aio.live.connect(
                model=MODEL, config=config
            ) as session:
                logger.info("✅ Connected to Gemini Live API")

                # Create tasks for bidirectional streaming
                async with asyncio.TaskGroup() as tg:
                    # Send audio from user to Gemini
                    tg.create_task(self._send_audio(session, audio_input_queue))
                    # Receive audio from Gemini and handle search requests
                    tg.create_task(self._receive_audio(session, audio_output_queue))

        except asyncio.CancelledError:
            logger.info("🛑 Audio stream cancelled")
        except Exception as e:
            logger.error(f"❌ Audio stream error: {e}", exc_info=True)
            raise

    async def _send_audio(
        self,
        session,
        audio_queue: asyncio.Queue
    ):
        """Send audio chunks from queue to Gemini."""
        logger.info("📤 Audio sender started")
        try:
            while True:
                # Get audio chunk from queue
                audio_data = await audio_queue.get()

                if audio_data is None:  # Sentinel value to stop
                    logger.info("🛑 Audio input stream ended")
                    break

                # Send to Gemini
                await session.send_realtime_input(
                    audio={
                        "data": audio_data,
                        "mime_type": "audio/pcm"  # 16-bit PCM, 16kHz, mono
                    }
                )

        except Exception as e:
            logger.error(f"❌ Error sending audio: {e}", exc_info=True)

    async def _smart_search_with_retries(self, query: str) -> tuple[list, str]:
        """
        Intelligent search that tries multiple variations before giving up.
        
        Args:
            query: Original search query
            
        Returns:
            (products_list, search_term_used)
        """
        # Generate alternative search terms
        alternatives = self._generate_search_alternatives(query)
        
        logger.info(f"🧠 Smart search for '{query}' with {len(alternatives)} alternatives: {alternatives}")
        
        for attempt, search_term in enumerate(alternatives, 1):
            logger.info(f"🔍 Attempt {attempt}/{len(alternatives)}: Searching for '{search_term}'")
            
            try:
                results = await self.agent_manager.search_platform(
                    query=search_term,
                    platform="blinkit",
                    max_results=5
                )
                
                if results.products:
                    logger.info(f"✅ SUCCESS on attempt {attempt} with term '{search_term}'")
                    return (results.products, search_term)
                else:
                    logger.info(f"⚠️ No results for '{search_term}', trying next alternative...")
                    
            except Exception as e:
                logger.error(f"❌ Error searching '{search_term}': {e}")
                continue
        
        logger.warning(f"😞 All search attempts failed for '{query}'")
        return ([], query)
    
    def _generate_search_alternatives(self, query: str) -> list[str]:
        """
        Generate alternative search terms to try if primary search fails.
        
        Returns list of search terms in order of relevance.
        """
        alternatives = [query]  # Start with original
        query_lower = query.lower().strip()
        
        # Common brand/product mappings to generic terms
        product_mappings = {
            'maggi': ['instant noodles', 'noodles', 'maggi noodles', 'masala noodles'],
            'lays': ['chips', 'potato chips', 'lays chips'],
            'kurkure': ['namkeen', 'snacks', 'kurkure namkeen'],
            'parle g': ['biscuits', 'parle biscuits', 'glucose biscuits'],
            'oreo': ['biscuits', 'cream biscuits', 'oreo biscuits'],
            'bread': ['bread', 'sandwich bread', 'white bread'],
            'doodh': ['milk', 'doodh', 'toned milk'],
            'chai': ['tea', 'chai', 'tea leaves'],
            'atta': ['wheat flour', 'atta', 'flour'],
            'chawal': ['rice', 'chawal', 'basmati rice'],
        }
        
        # Check if query contains any known product
        for brand, generic_terms in product_mappings.items():
            if brand in query_lower:
                # Add generic terms
                alternatives.extend(generic_terms)
                break
        
        # Try with common modifiers removed/added
        words = query.split()
        if len(words) > 1:
            # Try just brand name
            alternatives.append(words[0])
            # Try just last word
            alternatives.append(words[-1])
        
        # Try with common quantity terms
        if not any(term in query_lower for term in ['pack', 'kg', 'gm', 'ltr', 'ml']):
            alternatives.append(f"{query} 1kg")
            alternatives.append(f"{query} 500g")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_alternatives = []
        for alt in alternatives:
            alt_lower = alt.lower().strip()
            if alt_lower not in seen and alt_lower:
                seen.add(alt_lower)
                unique_alternatives.append(alt)
        
        return unique_alternatives[:5]  # Max 5 attempts

    async def _receive_audio(
        self,
        session,
        audio_queue: asyncio.Queue
    ):
        """
        Receive responses from Gemini Live API.
        Handles three kinds of responses:
          1. Audio chunks → forward to client
          2. Tool calls (search_product) → execute browser search, send results back
          3. Text annotations → log for debugging
        """
        logger.info("📥 Audio receiver started")
        try:
            while True:
                turn = session.receive()
                
                async for response in turn:
                    # ── 1. Handle TOOL CALLS from the model ──
                    if response.tool_call:
                        for fc in response.tool_call.function_calls:
                            logger.info(f"🔧 TOOL CALL: {fc.name}({fc.args})")
                            
                            if fc.name == "search_product":
                                query = fc.args.get("query", "")
                                logger.info(f"🔍 Executing search for: '{query}'")
                                
                                # Run the actual browser search
                                try:
                                    products, used_term = await self._smart_search_with_retries(query)
                                    
                                    if products:
                                        # Build result dict
                                        result_data = {
                                            "status": "found",
                                            "query": query,
                                            "search_term_used": used_term,
                                            "products": [],
                                        }
                                        for p in products:
                                            result_data["products"].append({
                                                "name": p.name,
                                                "price": p.price,
                                                "brand": p.brand,
                                                "weight": p.weight,
                                            })
                                        cheapest = min(products, key=lambda p: p.price)
                                        result_data["cheapest"] = {
                                            "name": cheapest.name,
                                            "price": cheapest.price,
                                        }
                                        logger.info(f"✅ Returning {len(products)} products to AI")
                                    else:
                                        result_data = {
                                            "status": "not_found",
                                            "query": query,
                                            "message": f"No products found for '{query}' on Blinkit after trying multiple search terms.",
                                        }
                                        logger.warning(f"⚠️ No products found for '{query}'")

                                except Exception as e:
                                    logger.error(f"❌ Search error: {e}", exc_info=True)
                                    result_data = {
                                        "status": "error",
                                        "query": query,
                                        "message": f"Search failed: {str(e)}",
                                    }
                                
                                # Send tool response back to Gemini
                                await session.send_tool_response(
                                    function_responses=[
                                        types.FunctionResponse(
                                            id=fc.id,
                                            name=fc.name,
                                            response=result_data,
                                        )
                                    ]
                                )
                                logger.info(f"📤 Sent tool response back to AI")
                            else:
                                logger.warning(f"⚠️ Unknown tool call: {fc.name}")
                    
                    # ── 2. Handle AUDIO content ──
                    if (response.server_content and 
                        response.server_content.model_turn):
                        
                        for part in response.server_content.model_turn.parts:
                            # Audio data
                            if part.inline_data and isinstance(part.inline_data.data, bytes):
                                await audio_queue.put(part.inline_data.data)
                                logger.debug(f"📤 Audio chunk: {len(part.inline_data.data)} bytes")
                            
                            # Text annotations (just log, don't try to parse)
                            if hasattr(part, 'text') and part.text:
                                logger.info(f"💬 AI text: {part.text[:200]}")

                # Clear output queue on interruption
                while not audio_queue.empty():
                    try:
                        audio_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        break

        except Exception as e:
            logger.error(f"❌ Error receiving audio: {e}", exc_info=True)


# Singleton instance
audio_manager = AudioStreamManager()
