"""
Quick WebSocket test script
"""
import asyncio
import websockets

async def test_websocket():
    uri = "ws://localhost:8000/ws/audio?session_id=test"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri, timeout=5) as websocket:
            print("✅ Connected successfully!")
            
            # Send a test message
            test_audio = b"\x00" * 1024  # 1KB of silence
            await websocket.send(test_audio)
            print(f"✅ Sent {len(test_audio)} bytes")
            
            # Try to receive
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2)
                print(f"✅ Received {len(response)} bytes")
            except asyncio.TimeoutError:
                print("⏱️  No response (this is expected)")
            
            print("✅ WebSocket is working!")
            
    except asyncio.TimeoutError:
        print("❌ Connection timeout - WebSocket endpoint not responding")
    except ConnectionRefusedError:
        print("❌ Connection refused - Is the backend running on port 8000?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())
