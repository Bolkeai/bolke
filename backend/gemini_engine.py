"""
Bolke — Gemini Intent Engine
Parses natural Hindi/English voice input into structured intents
and generates conversational Hindi responses.
"""

import json
import os
from dataclasses import dataclass, field

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ParsedIntent:
    """Structured output from Gemini intent parsing."""
    intent: str          # SEARCH | ADD_TO_CART | CHECKOUT | REMOVE_FROM_CART | GREETING | HELP
    products: list[str]  # Product names extracted (e.g. ["milk", "bread"])
    quantities: list[str]  # Corresponding quantities (e.g. ["1L", "1 packet"])
    brands: list[str]    # Brand preferences (e.g. ["Amul", ""])
    response_text: str   # Natural Hindi response to speak back
    raw_json: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Gemini Engine
# ---------------------------------------------------------------------------

class GeminiEngine:
    """
    Handles all Gemini interactions:
    1. Intent parsing from voice transcript
    2. Conversational response generation
    3. Conversation history management
    """

    SYSTEM_PROMPT = """You are Bolke — a friendly, smart kirana (grocery) shop assistant.
You help users order groceries through voice in Hindi, English, or Hinglish.

Your job is to:
1. Understand what the user wants (search for products, add to cart, checkout, etc.)
2. Respond naturally in Hindi/Hinglish (how a real kirana shop owner would talk)
3. Be helpful — suggest items, confirm quantities, ask clarifications

RULES:
- Always respond in the EXACT JSON format specified
- If user speaks Hindi, respond in Hindi (Devanagari is fine, but romanized Hindi preferred for TTS)
- If user speaks English, respond in Hinglish
- Extract ALL products mentioned in a single message
- If quantity not specified, default to "1"
- If brand not specified, leave empty string ""
- Be warm and conversational like a neighborhood kirana owner
"""

    PARSE_PROMPT = """Parse this user message and return ONLY valid JSON (no markdown, no backticks):

User said: "{user_text}"
Current cart: {cart}
Conversation history (last 3): {history}

Return this exact JSON structure:
{{
    "intent": "SEARCH | ADD_TO_CART | CHECKOUT | REMOVE_FROM_CART | GREETING | HELP",
    "products": ["product1", "product2"],
    "quantities": ["qty1", "qty2"],
    "brands": ["brand1", "brand2"],
    "response_text": "Your Hindi/Hinglish response to the user"
}}

Intent guide:
- SEARCH: User wants to find/see products or prices ("doodh dikhao", "rice kitne ka hai")
- ADD_TO_CART: User confirms adding items ("haan daal do", "add kar do", "ye wala chahiye")
- CHECKOUT: User wants to place order ("order kar do", "checkout", "bas itna hi")
- REMOVE_FROM_CART: User wants to remove items ("bread hatao", "ye nahi chahiye")
- GREETING: User greets or starts conversation ("hello", "namaste")
- HELP: User asks for help or is confused

Examples:
- "mujhe doodh aur bread chahiye" → SEARCH, products: ["milk", "bread"]
- "haan ye wala add karo" → ADD_TO_CART (use products from context)
- "order place kar do" → CHECKOUT
- "namaste bhaiya" → GREETING
- "5 kg chawal chahiye Fortune wala" → SEARCH, products: ["rice"], quantities: ["5kg"], brands: ["Fortune"]
"""

    def __init__(self):
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=self.SYSTEM_PROMPT,
        )
        # Per-session conversation history
        self._sessions: dict[str, list[dict]] = {}

    def _get_history(self, session_id: str) -> list[dict]:
        """Get last 3 conversation turns for a session."""
        return self._sessions.get(session_id, [])[-3:]

    def _add_to_history(self, session_id: str, role: str, text: str):
        """Append a turn to session history."""
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        self._sessions[session_id].append({"role": role, "text": text})
        # Keep only last 10 turns
        if len(self._sessions[session_id]) > 10:
            self._sessions[session_id] = self._sessions[session_id][-10:]

    async def parse_intent(
        self,
        user_text: str,
        cart: list[dict] | None = None,
        session_id: str = "default",
    ) -> ParsedIntent:
        """
        Parse user's voice transcript into a structured intent.
        
        Args:
            user_text: Raw transcript from speech recognition
            cart: Current cart items [{"name": ..., "price": ..., "provider": ...}]
            session_id: Unique session identifier
            
        Returns:
            ParsedIntent with structured data and Hindi response
        """
        cart = cart or []
        history = self._get_history(session_id)

        prompt = self.PARSE_PROMPT.format(
            user_text=user_text,
            cart=json.dumps(cart, ensure_ascii=False),
            history=json.dumps(history, ensure_ascii=False),
        )

        response = self.model.generate_content(prompt)
        raw_text = response.text.strip()

        # Clean up markdown code fences if Gemini wraps the JSON
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]  # Remove first line
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError:
            # Fallback: treat as a search query with the original text
            data = {
                "intent": "SEARCH",
                "products": [user_text],
                "quantities": ["1"],
                "brands": [""],
                "response_text": f"Main '{user_text}' dhundh raha hoon aapke liye...",
            }

        # Normalize — ensure all lists are same length
        products = data.get("products", [])
        quantities = data.get("quantities", [])
        brands = data.get("brands", [])
        max_len = max(len(products), 1)
        quantities.extend(["1"] * (max_len - len(quantities)))
        brands.extend([""] * (max_len - len(brands)))

        # Save to history
        self._add_to_history(session_id, "user", user_text)
        self._add_to_history(session_id, "assistant", data.get("response_text", ""))

        return ParsedIntent(
            intent=data.get("intent", "SEARCH"),
            products=products,
            quantities=quantities[:max_len],
            brands=brands[:max_len],
            response_text=data.get("response_text", "Main dhundh raha hoon..."),
            raw_json=data,
        )

    async def generate_comparison_response(
        self,
        query: str,
        results: dict,
        session_id: str = "default",
    ) -> str:
        """
        Generate a natural Hindi response for price comparison results.
        
        Args:
            query: Original product search query
            results: Dict with provider results and comparison data
            session_id: Session identifier
            
        Returns:
            Hindi/Hinglish response string for TTS
        """
        prompt = f"""The user searched for "{query}". Here are the results from different platforms:

{json.dumps(results, ensure_ascii=False, indent=2)}

Generate a SHORT, natural Hindi/Hinglish response like a kirana owner would:
- Tell which platform is cheaper
- Mention the price difference
- Ask if they want to order
- Keep it under 3 sentences
- Use romanized Hindi (not Devanagari)

Respond with ONLY the response text, no JSON."""

        response = self.model.generate_content(prompt)
        text = response.text.strip()
        self._add_to_history(session_id, "assistant", text)
        return text


# ---------------------------------------------------------------------------
# Singleton instance
# ---------------------------------------------------------------------------

engine = GeminiEngine()
