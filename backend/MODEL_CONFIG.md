# Gemini Model Configuration

## Current Models Used

### Backend (Text & Intent Parsing)
**Model**: `gemini-2.5-flash-002`
- **Used in**: `gemini_engine.py` - Intent parsing and response generation
- **Purpose**: Parse voice transcripts, understand Hindi/Hinglish, generate conversational responses
- **Why 2.5 Flash**: 
  - Latest stable multimodal model
  - Better Hindi/Hinglish understanding
  - Faster response times than Pro
  - Lower cost for high-volume requests

### Browser Automation
**Model**: `gemini-2.5-flash-002`
- **Used in**: `browser_agents.py` - Controlling browser and scraping
- **Purpose**: Navigate websites, read product data, extract structured information
- **Why 2.5 Flash**:
  - Better vision capabilities for reading web pages
  - Improved function calling for structured outputs
  - Fast enough for real-time web scraping

## Available Gemini Audio Models (Future Enhancement)

For direct audio processing (bypassing Web Speech API), we can upgrade to:

### Gemini 2.5 Flash Native Audio
**Model**: `gemini-2.5-flash-native-audio-preview-12-2025`
- **Capabilities**:
  - Real-time audio streaming (Live API)
  - Native audio understanding (no transcription needed)
  - Voice Activity Detection
  - Low latency (< 500ms)
  - Multi-language support (70+ languages)
  - Speaker separation
  - Emotion detection

### When to Upgrade to Native Audio

**Current Setup** (Text-based):
```
User Voice → Web Speech API → Text → Gemini 2.5 Flash → Text Response → TTS
```

**With Native Audio** (Audio-to-audio):
```
User Voice → WebSocket → Live API → Gemini Audio → Audio Response
```

**Benefits of Native Audio**:
1. ✅ Lower latency (direct audio processing)
2. ✅ Better Hindi/Hinglish pronunciation
3. ✅ Maintains tone and emotion
4. ✅ Interruption handling
5. ✅ No need for separate TTS

**Trade-offs**:
- More complex implementation (WebSockets)
- Requires client-side audio handling
- Preview model (not GA yet)

## Model Update History

| Date | Model | Reason |
|------|-------|--------|
| 2025-02-14 | `gemini-2.5-flash-002` | Upgraded from 2.0 to 2.5 for better performance |
| 2025-01-XX | `gemini-2.0-flash` | Initial implementation |

## How to Change Models

### Update Text Models
Edit `backend/gemini_engine.py`:
```python
self.model = genai.GenerativeModel(
    model_name="gemini-2.5-flash-002",  # Change this
    system_instruction=self.SYSTEM_PROMPT,
)
```

### Update Browser Agent Model
Edit `backend/browser_agents.py`:
```python
self._llm = ChatGoogle(
    model="gemini-2.5-flash-002",  # Change this
    api_key=GOOGLE_API_KEY
)
```

## Production Recommendations

### For Cost Optimization
- Use `gemini-2.5-flash-002` for all endpoints
- Flash is 20x cheaper than Pro
- Sufficient quality for conversational AI

### For Maximum Quality
- Use `gemini-2.5-pro-002` for intent parsing (more accurate)
- Use `gemini-2.5-flash-002` for browser automation (speed matters)

### For Native Audio (Future)
- Use `gemini-2.5-flash-native-audio-preview-12-2025` for Live API
- Implement WebSocket streaming
- Handle audio chunks directly

## Performance Benchmarks

Based on Google's benchmarks:

| Model | Function Calling | Instruction Following | Speed |
|-------|------------------|----------------------|-------|
| 2.5 Flash | 71.5% | 90% | Fast |
| 2.0 Flash | 66.0% | 84% | Fast |
| 2.5 Pro | Higher | Higher | Slower |

## API Costs (Estimated)

**Per 1 million tokens**:
- Gemini 2.5 Flash: ~$0.075
- Gemini 2.5 Pro: ~$1.25
- Live Audio API: ~$0.30/hour

**Your app usage** (estimated):
- Per voice query: ~1,500 tokens
- Per search: ~2,000 tokens
- **Total per transaction**: ~3,500 tokens ≈ $0.00026

**1000 users** = ~$0.26

## Next Steps for Audio Upgrade

If you want to implement native audio:

1. **Install Live API SDK**
   ```bash
   pip install google-genai
   ```

2. **Replace Web Speech API** with WebSocket streaming

3. **Update frontend** to stream audio directly

4. **Use Live API endpoints** instead of REST

See: https://ai.google.dev/api/live
