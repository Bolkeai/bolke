"""
Test if the Gemini Live API audio streaming is working
"""

import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test_audio_stream():
    """Test basic Gemini Live API connection"""
    try:
        print("🧪 Testing Gemini Live API connection...")
        
        from google import genai
        
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        print("✅ Gemini client created")
        
        model = "gemini-2.5-flash-native-audio-preview-12-2025"
        print(f"   Model: {model}")
        
        # Try to create a simple stream
        config = {
            "response_modalities": ["TEXT"],  # Use TEXT for testing
            "system_instruction": "You are a helpful assistant"
        }
        
        print("   Creating test session...")
        
        async with client.aio.live.connect(model=model, config=config) as session:
            print("✅ Successfully connected to Gemini Live API!")
            
            # Send a simple text message
            await session.send("Hello, can you hear me?", end_of_turn=True)
            print("   Sent test message")
            
            # Wait for response
            async for response in session.receive():
                if response.text:
                    print(f"   Response: {response.text}")
                    break
            
            print("\n🎉 Gemini Live API is working!")
            return True
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_audio_stream())
    exit(0 if result else 1)
