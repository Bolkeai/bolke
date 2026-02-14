'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MicButton } from '../components/MicButton';
import { ProductCard } from '../components/ProductCard';
import { CartDrawer } from '../components/CartDrawer';
import { Waveform } from '../components/Waveform';
import { SUGGESTED_QUERIES } from '../constants';
import { Product, CartItem, AppMode, Provider } from '../types';
import { processVoice } from '../services/api';
import { NativeAudioStreamer } from '../services/nativeAudio';
import { ShoppingBag, Check, Package, MapPin, Clock, RotateCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [mode, setMode] = useState<AppMode>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [lastAIResponse, setLastAIResponse] = useState('');
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);
  const [useNativeAudio, setUseNativeAudio] = useState(true); // Default to native audio

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioStreamerRef = useRef<NativeAudioStreamer | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onstart = () => {
          console.log('Recognition started');
          setIsRecognitionActive(true);
          setMode('LISTENING');
        };

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcriptText = event.results[current][0].transcript;
          setTranscript(transcriptText);
        };

        recognition.onend = () => {
          console.log('Recognition ended');
          setIsRecognitionActive(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Recognition error:', event.error);
          setIsRecognitionActive(false);
          if (event.error !== 'aborted' && event.error !== 'no-speech') {
            setMode('IDLE');
          }
        };

        recognitionRef.current = recognition;
      }

      synthRef.current = window.speechSynthesis;
    }

    // Cleanup function
    return () => {
      if (recognitionRef.current && isRecognitionActive) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Cleanup: Recognition already stopped');
        }
      }
    };
  }, [isRecognitionActive]);

  const addToCart = (product: Product, provider: Provider) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.selectedProvider === provider);
      if (existing) {
        return prev.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, selectedProvider: provider }];
    });
  };

  const speak = (text: string) => {
    if (synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = synthRef.current.getVoices();
      const indianVoice = voices.find(v => v.lang.includes('IN')) || voices[0];
      if (indianVoice) utterance.voice = indianVoice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      synthRef.current.speak(utterance);
    }
  };

  const convertBackendResultsToProducts = (searchResults: any): Product[] => {
    const products: Product[] = [];
    
    if (!searchResults) return products;

    const { zepto = [], blinkit = [] } = searchResults;
    
    // Combine products from both platforms
    const productMap = new Map<string, Product>();
    
    zepto.forEach((item: any, index: number) => {
      const key = item.name.toLowerCase();
      if (!productMap.has(key)) {
        productMap.set(key, {
          id: `zepto-${index}`,
          name: item.name,
          hindiName: '',
          image: item.image_url || 'https://picsum.photos/300/300?random=' + index,
          unit: item.weight || '1 unit',
          category: 'Groceries',
          prices: [{
            provider: 'Zepto',
            price: item.price,
            deliveryTime: '10 mins'
          }]
        });
      } else {
        const existing = productMap.get(key)!;
        existing.prices.push({
          provider: 'Zepto',
          price: item.price,
          deliveryTime: '10 mins'
        });
      }
    });

    blinkit.forEach((item: any, index: number) => {
      const key = item.name.toLowerCase();
      if (!productMap.has(key)) {
        productMap.set(key, {
          id: `blinkit-${index}`,
          name: item.name,
          hindiName: '',
          image: item.image_url || 'https://picsum.photos/300/300?random=' + (index + 100),
          unit: item.weight || '1 unit',
          category: 'Groceries',
          prices: [{
            provider: 'Blinkit',
            price: item.price,
            deliveryTime: '8 mins'
          }]
        });
      } else {
        const existing = productMap.get(key)!;
        existing.prices.push({
          provider: 'Blinkit',
          price: item.price,
          deliveryTime: '8 mins'
        });
      }
    });

    return Array.from(productMap.values());
  };

  const stopListening = useCallback(async () => {
    if (useNativeAudio) {
      // Stop native audio streaming
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stopStreaming();
        audioStreamerRef.current = null;
      }
      setIsRecognitionActive(false);
      setMode('IDLE');
      return;
    }
    
    // Legacy Web Speech API mode
    if (recognitionRef.current && isRecognitionActive) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }

    if (!transcript) {
      setMode('IDLE');
      return;
    }

    setMode('PROCESSING');
    
    try {
      // Call the backend API
      const response = await processVoice({
        text: transcript,
        session_id: sessionId,
        cart: cart.map(item => ({
          product_name: item.product.name,
          quantity: item.quantity,
          provider: item.selectedProvider
        }))
      });

      // Speak the response
      setLastAIResponse(response.response_text);
      speak(response.response_text);

      // Handle different intents
      if (response.intent === 'SEARCH' && response.search_results) {
        const products = convertBackendResultsToProducts(response.search_results);
        setDisplayedProducts(products);
        setMode('RESULTS');
      } else if (response.intent === 'CHECKOUT') {
        setMode('CONFIRMATION');
      } else if (response.intent === 'SHOW_CART') {
        setIsCartOpen(true);
        setMode('CART');
      } else {
        setMode('RESULTS');
      }
    } catch (error) {
      console.error('Error processing voice:', error);
      setLastAIResponse('Sorry, something went wrong. Please try again.');
      speak('Sorry, something went wrong. Please try again.');
      setMode('IDLE');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, sessionId, cart, isRecognitionActive, useNativeAudio]);

  const startListening = async () => {
    setTranscript('');
    setLastAIResponse('');
    
    if (useNativeAudio) {
      // Use native audio streaming
      try {
        console.log('🎙️ Starting native audio mode');
        setMode('LISTENING');
        
        audioStreamerRef.current = new NativeAudioStreamer(sessionId);
        
        await audioStreamerRef.current.startStreaming(
          () => {
            // On start
            console.log('✅ Native audio streaming started');
            setIsRecognitionActive(true);
          },
          () => {
            // On response
            console.log('✅ AI response received');
          },
          (error) => {
            // On error
            console.error('❌ Native audio error:', error);
            setMode('IDLE');
            setIsRecognitionActive(false);
          }
        );
      } catch (error: any) {
        console.error('❌ Failed to start native audio:', error);
        alert(`Failed to start audio: ${error.message}\\n\\nMake sure:\\n1. Backend is running\\n2. Microphone permission is granted`);
        setMode('IDLE');
      }
    } else {
      // Use legacy Web Speech API
      if (recognitionRef.current) {
        // Stop any existing recognition first
        if (isRecognitionActive) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            console.log('Stop failed, continuing...');
          }
        }
        
        // Start with a small delay to ensure previous session ended
        setTimeout(() => {
          if (recognitionRef.current && !isRecognitionActive) {
            try {
              recognitionRef.current.start();
            } catch (e: any) {
              console.error("Recognition start error:", e);
              // If it's already started, just ignore
              if (e.message?.includes('already started')) {
                console.log('Recognition already active, will use existing session');
              } else {
                setMode('IDLE');
              }
            }
          }
        }, 100);
      }
    }
  };

  const resetApp = () => {
    // Stop audio streaming if active
    if (audioStreamerRef.current) {
      audioStreamerRef.current.stopStreaming();
      audioStreamerRef.current = null;
    }
    
    setCart([]);
    setDisplayedProducts([]);
    setTranscript('');
    setMode('IDLE');
    setLastAIResponse('');
    setIsRecognitionActive(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-charcoal selection:bg-saffron-200">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 z-30 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
            <div className="w-8 h-8 rounded-full bg-saffron-500 flex items-center justify-center text-white font-serif font-bold text-xl">
              B
            </div>
            <span className="font-serif text-xl font-bold text-charcoal">BolkeAI</span>
          </div>
          
          {/* Native Audio Toggle */}
          <button
            onClick={() => {
              if (isRecognitionActive) {
                alert('Please stop recording first');
                return;
              }
              setUseNativeAudio(!useNativeAudio);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              useNativeAudio 
                ? 'bg-saffron-500 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={useNativeAudio ? 'Using Native Audio (Gemini Live API)' : 'Using Web Speech API'}
          >
            <Zap className={`w-3 h-3 ${useNativeAudio ? 'fill-white' : ''}`} />
            {useNativeAudio ? 'Native Audio' : 'Legacy Mode'}
          </button>
        </div>

        <button className="relative p-2" onClick={() => setIsCartOpen(true)}>
          <ShoppingBag className="w-6 h-6 text-charcoal" />
          {cart.length > 0 && (
            <span className="absolute top-1 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {cart.reduce((acc, i) => acc + i.quantity, 0)}
            </span>
          )}
        </button>
      </header>

      <main className="pt-24 pb-32 px-4 max-w-4xl mx-auto min-h-screen flex flex-col">

        {/* IDLE */}
        {mode === 'IDLE' && displayedProducts.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 mt-10">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-7xl font-serif font-medium text-gray-900 leading-tight"
            >
              Bolo, kya chahiye?
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 text-lg"
            >
              Tap to speak in Hindi or English
            </motion.p>

            <div className="flex flex-wrap justify-center gap-3 max-w-md">
              {SUGGESTED_QUERIES.map((q, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + (i * 0.1) }}
                  onClick={async () => {
                    setTranscript(q);
                    setMode('PROCESSING');
                    try {
                      const response = await processVoice({
                        text: q,
                        session_id: sessionId,
                        cart: []
                      });
                      setLastAIResponse(response.response_text);
                      speak(response.response_text);
                      if (response.search_results) {
                        const products = convertBackendResultsToProducts(response.search_results);
                        setDisplayedProducts(products);
                      }
                      setMode('RESULTS');
                    } catch (error) {
                      console.error('Error:', error);
                      setMode('IDLE');
                    }
                  }}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 shadow-sm hover:border-saffron-300 hover:text-saffron-600 transition-colors"
                >
                  &quot;{q}&quot;
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* LISTENING / PROCESSING */}
        {(mode === 'LISTENING' || mode === 'PROCESSING') && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Waveform className="h-32" />
          </div>
        )}

        {/* CONFIRMATION */}
        {mode === 'CONFIRMATION' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center pt-10 pb-6">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              className="w-28 h-28 bg-[#22C55E] rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-green-200"
            >
              <Check className="w-14 h-14 text-white stroke-[3]" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-hindi font-bold text-gray-900 mb-2"
            >
              ऑर्डर कन्फर्म!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-gray-500 mb-10"
            >
              Order #AK45123 confirmed successfully
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100/50 border border-gray-100 w-full max-w-sm mx-auto text-left space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-gray-800" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Delivery</p>
                  <p className="text-gray-900 font-semibold text-lg leading-tight">Tomorrow, 6:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-gray-800" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Address</p>
                  <p className="text-gray-900 font-semibold text-lg leading-tight">Home • Sector 42, Gurgaon</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-[#22C55E]" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#22C55E] uppercase tracking-wider mb-0.5">Status</p>
                  <p className="text-green-700 font-semibold text-lg leading-tight">Rider Assigned: Rajesh</p>
                </div>
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              onClick={resetApp}
              className="mt-12 flex items-center gap-2 text-gray-900 font-semibold hover:text-gray-600 transition-colors"
            >
              <RotateCw className="w-5 h-5" />
              Order Again
            </motion.button>
          </div>
        )}

        {/* RESULTS */}
        {(mode === 'RESULTS' || displayedProducts.length > 0) && mode !== 'CONFIRMATION' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif font-semibold text-gray-800">
                Here is what I found
              </h2>
              {lastAIResponse && (
                <span className="text-sm text-saffron-600 italic">&quot;{lastAIResponse}&quot;</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedProducts.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAdd={addToCart}
                />
              ))}
            </div>
          </div>
        )}

        {/* Floating Mic */}
        {mode !== 'CONFIRMATION' && (
          <div className="fixed bottom-8 left-0 right-0 flex flex-col items-center justify-end z-30 pointer-events-none">

            <AnimatePresence>
              {mode === 'RESULTS' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-3 pointer-events-auto"
                >
                  <Waveform className="h-6 w-16" />
                  <span className="text-xs font-medium text-gray-500">Listening for checkout...</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(mode === 'LISTENING' || mode === 'PROCESSING') && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-6 px-6 py-4 bg-white/90 backdrop-blur-md shadow-xl rounded-2xl max-w-sm mx-4 text-center pointer-events-auto"
                >
                  {mode === 'PROCESSING' ? (
                    <div className="flex items-center gap-2 text-gray-500 font-medium">
                      Thinking...
                    </div>
                  ) : (
                    <p className="text-lg font-medium text-gray-800">
                      {transcript || "Listening..."}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pointer-events-auto">
              <MicButton
                mode={mode}
                isListening={mode === 'LISTENING'}
                onClick={mode === 'LISTENING' ? stopListening : startListening}
              />
            </div>
          </div>
        )}
      </main>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onCheckout={() => {
          setIsCartOpen(false);
          setMode('CONFIRMATION');
        }}
      />
    </div>
  );
}
