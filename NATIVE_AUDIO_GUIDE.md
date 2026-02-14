# 🎉 Native Audio Migration Guide

## What Changed?

We've migrated from the old Web Speech API to **Gemini Live API with Native Audio**!

### Before (Old):
```
User Voice → Web Speech API → Text → Backend → Gemini 2.5 Flash → Text Response → TTS
```

### After (New):
```
User Voice → WebSocket → Gemini Live API → AI Audio Response
```

## 🚀 Benefits

✅ **Lower Latency**: Direct audio-to-audio processing (no transcription step)  
✅ **Better Hindi/Hinglish**: Native understanding of Indian languages  
✅ **Natural Conversation**: Real-time, interruption handling  
✅ **Emotion & Tone**: Preserves speech characteristics  
✅ **No TTS Needed**: AI speaks directly in natural voice

## 📦 Installation

### Step 1: Update Backend Dependencies

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install google-genai websockets
```

### Step 2: Restart Backend

```powershell
python -m uvicorn main:app --reload --port 8000
```

You should see:
```
✨ Initialized AudioStreamManager with model: gemini-2.5-flash-native-audio-preview-12-2025
🎙️  Bolke backend starting...
   Native Audio: ✅ Gemini Live API enabled
```

### Step 3: Restart Frontend

```powershell
cd frontend
npm run dev
```

## 🎮 How to Use

### 1. **Toggle Native Audio Mode**

In the top header, you'll see a toggle button:
- **⚡ Native Audio** (Orange) = New Gemini Live API
- **Legacy Mode** (Gray) = Old Web Speech API

Click to switch between modes!

### 2. **Use Native Audio** (Recommended)

1. Click the **⚡ Native Audio** button (should be orange)
2. Click the microphone button
3. Allow microphone access
4. **Just talk naturally!**
5. AI will respond in real-time with audio

**No need to click stop** - the AI knows when you're done talking!

### 3. **Legacy Mode** (Fallback)

If native audio doesn't work:
1. Click toggle to switch to **Legacy Mode** (gray)
2. Click microphone
3. Speak
4. Click microphone again to stop and process

## 🔧 Technical Details

### Backend Changes

**New Files:**
- [`audio_streaming.py`](backend/audio_streaming.py) - Native audio handler
- WebSocket endpoint: `/ws/audio`

**Updated Files:**
- [`main.py`](backend/main.py) - Added WebSocket support
- [`pyproject.toml`](backend/pyproject.toml) - Added `google-genai` and `websockets`

### Frontend Changes

**New Files:**
- [`services/nativeAudio.ts`](frontend/services/nativeAudio.ts) - Audio streaming service

**Updated Files:**
- [`app/page.tsx`](frontend/app/page.tsx) - Added native audio mode
- [`.env.local`](frontend/.env.local) - Added WebSocket URL

### Audio Configuration

**Sending (Microphone)**:
- Format: 16-bit PCM
- Sample Rate: 16kHz
- Channels: Mono
- Sent via WebSocket as binary chunks

**Receiving (AI Response)**:
- Format: 16-bit PCM
- Sample Rate: 24kHz
- Channels: Mono
- Played directly through Web Audio API

## 🧪 Testing

### Test 1: Check Backend

```powershell
curl http://localhost:8000/api/health
```

Should return:
```json
{
  "status": "healthy",
  "service": "Bolke",
  "gemini_key_set": true,
  "native_audio": true,
  "websocket_endpoint": "/ws/audio"
}
```

### Test 2: Test Native Audio

1. Open http://localhost:3000
2. Make sure **⚡ Native Audio** is enabled (orange)
3. Click microphone
4. Say: "mujhe doodh chahiye"
5. Listen for AI response

**Expected**:
- Microphone activates immediately
- Audio streams in real-time
- AI responds with audio (not text-to-speech)
- Conversation feels natural

### Test 3: Test Legacy Mode

1. Click toggle to switch to **Legacy Mode**
2. Click microphone
3. Say: "show me milk"
4. Click microphone to stop
5. Wait for processing
6. Hear TTS response

## 🐛 Troubleshooting

### Issue: "Failed to connect to WebSocket"

**Solution:**
```powershell
# Make sure backend is running
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

### Issue: "Microphone permission denied"

**Solution:**
- Click the permission popup and allow
- Or go to browser settings → Site settings → Microphone
- Make sure localhost is allowed

### Issue: "No audio output"

**Check:**
1. Volume is not muted
2. Correct output device selected
3. Browser console for errors (F12)
4. Backend logs for errors

### Issue: "Audio is choppy/laggy"

**Solutions:**
- Close other tabs/applications
- Check internet connection
- Use Chrome (best WebAudio support)
- Try Legacy Mode if issue persists

### Issue: "Model not found" error

**Solution:**
```python
# The model name may have changed. Update audio_streaming.py:
MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

# Or check latest model name at:
# https://ai.google.dev/api/live
```

## 📊 Performance Comparison

| Feature | Legacy Mode | Native Audio |
|---------|-------------|--------------|
| **Latency** | ~3-5s | ~500ms |
| **Quality** | TTS voice | Natural AI voice |
| **Hindi** | Good | Excellent |
| **Interruption** | No | Yes |
| **Real-time** | No | Yes |
| **Cost** | Lower | Moderate |

## 🔐 Security Notes

### For Development
- WebSocket runs on `ws://localhost:8000` (unencrypted)
- API key sent from backend only

### For Production
- Use `wss://` (encrypted WebSocket)
- Implement ephemeral tokens for client authentication
- Rate limiting on WebSocket connections
- See: https://ai.google.dev/api/live#ephemeral-tokens

## 🎯 Next Steps

### Optional Enhancements

1. **Add Voice Activity Detection (VAD)**
   - Automatically detect when user starts/stops talking
   - No need to click mic button

2. **Add Function Calling**
   - Let AI search products during conversation
   - Real-time price lookups

3. **Add Conversation History**
   - AI remembers what you said earlier
   - Context-aware responses

4. **Add Emotion Detection**
   - AI responds to tone of voice
   - Different responses based on emotion

All these features are supported by Gemini Live API!

## 📚 Resources

- [Gemini Live API Docs](https://ai.google.dev/api/live)
- [Native Audio Features](https://deepmind.google/technologies/gemini/audio/)
- [WebSocket API Reference](https://ai.google.dev/api/websockets)
- [Voice Activity Detection](https://ai.google.dev/api/live#voice-activity-detection)

## 🆘 Need Help?

**Check Logs:**

Backend:
```powershell
# You should see detailed logs like:
🔌 WebSocket connection accepted
📡 Starting audio stream for session: ws-abc123
📥 Received 4096 bytes from client
📤 Sent 8192 bytes to client
```

Frontend:
```javascript
// Open browser console (F12)
// Should see:
🎙️ Starting native audio mode
✅ Microphone access granted
🔌 Connecting to WebSocket
✅ WebSocket connected
📥 Received audio: 8192 bytes
```

**Still having issues?**
1. Make sure you're using **Chrome** (best support)
2. Check that backend shows "Native Audio: ✅"
3. Verify `.env` file has correct `GOOGLE_API_KEY`
4. Try Legacy Mode as fallback
5. Check firewall/antivirus isn't blocking WebSocket

---

## 🎉 Enjoy Native Audio!

You now have **state-of-the-art voice AI** with Gemini's latest audio models. The conversation should feel much more natural and responsive than before!
