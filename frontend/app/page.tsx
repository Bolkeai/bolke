'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Mic, MicOff, Loader2 } from 'lucide-react';

import { LanguageSelector } from '../components/LanguageSelector';
import { Waveform } from '../components/Waveform';
import { CartDrawer } from '../components/CartDrawer';
import { ProductCard } from '../components/ProductCard';

import { useLiveAgent, AgentStatus, ToolCall } from '../hooks/useLiveAgent';
import { LANGUAGES, DEFAULT_LANGUAGE, Language } from '../lib/languages';
import { CartItem, Product, Provider } from '../types';
import { streamSearch, ScrapedProduct } from '../services/backendService';

// ── Status helpers ────────────────────────────────────────────────────────────

function statusLabel(status: AgentStatus, language: Language): string {
  const labels: Record<AgentStatus, Record<string, string>> = {
    idle:       { 'hi': 'शुरू करने के लिए माइक दबाओ', 'en': 'Tap mic to start', 'kn': 'Mic tap maadi shuru maadi', 'te': 'Mic tap cheyyi', 'ta': 'Mic tap pannunga' },
    connecting: { 'hi': 'जुड़ रहा है...', 'en': 'Connecting...', 'kn': 'Connect aagtha ide...', 'te': 'Connect avutundi...', 'ta': 'Connect aaguthu...' },
    listening:  { 'hi': 'सुन रहा हूं...', 'en': 'Listening...', 'kn': 'Kelthaidini...', 'te': 'Vinuthunnanu...', 'ta': 'Ketkirein...' },
    thinking:   { 'hi': 'सुन रहा हूं...', 'en': 'Listening...', 'kn': 'Kelthaidini...', 'te': 'Vinuthunnanu...', 'ta': 'Ketkirein...' },
    speaking:   { 'hi': 'बोल रहा हूं...', 'en': 'Speaking...', 'kn': 'Heltha ide...', 'te': 'Maatladutunnanu...', 'ta': 'Pesukiren...' },
    error:      { 'hi': 'कुछ गलत हुआ', 'en': 'Something went wrong', 'kn': 'Enu thappaaythu', 'te': 'Emi tappu jarigindi', 'ta': 'Enna thappaa nadandhuchu' },
  };
  return labels[status]?.[language.code] ?? labels[status]['en'];
}

// ── Mic button ────────────────────────────────────────────────────────────────

function MicToggle({ status, onStart, onStop }: {
  status: AgentStatus;
  onStart: () => void;
  onStop: () => void;
}) {
  const isActive = status !== 'idle' && status !== 'error';
  const isListening = status === 'listening';
  const isThinking = status === 'connecting';
  const isSpeaking = status === 'speaking';

  return (
    <div className="relative flex items-center justify-center">
      {/* Ripple when listening */}
      {isListening && (
        <>
          <motion.div
            className="absolute rounded-full bg-saffron-400 opacity-25"
            initial={{ width: 80, height: 80 }}
            animate={{ width: 200, height: 200, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute rounded-full bg-saffron-500 opacity-20"
            initial={{ width: 80, height: 80 }}
            animate={{ width: 150, height: 150, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
          />
        </>
      )}

      <motion.button
        onClick={isActive ? onStop : onStart}
        whileTap={{ scale: 0.93 }}
        animate={{ scale: isListening ? 1.08 : 1 }}
        className={`relative z-10 flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full shadow-2xl transition-colors duration-300 ${
          isActive ? 'bg-gray-900 border border-gray-700' : 'bg-gray-900 border border-gray-800'
        }`}
        aria-label={isActive ? 'Stop' : 'Start'}
      >
        {isThinking ? (
          <Loader2 className="w-9 h-9 text-white animate-spin" />
        ) : isSpeaking ? (
          <Waveform className="h-10 w-14" barColor="from-white to-gray-300" />
        ) : isListening ? (
          <MicOff className="w-9 h-9 text-white" />
        ) : (
          <Mic className="w-9 h-9 text-white" />
        )}
      </motion.button>
    </div>
  );
}

// ── Backend result mapper ─────────────────────────────────────────────────────

function mapToProduct(item: ScrapedProduct, platform: 'zepto' | 'blinkit'): Product {
  const provider: Provider = platform === 'zepto' ? 'Zepto' : 'Blinkit';
  return {
    id: `${platform}-${item.name}-${item.price}`,
    name: item.name,
    image: item.image_url ?? '',
    unit: item.weight || item.brand || '',
    category: 'grocery',
    prices: [{
      provider,
      price: item.price,
      deliveryTime: platform === 'zepto' ? '~10 min' : '~12 min',
    }],
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [agentTranscript, setAgentTranscript] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLogs, setSearchLogs] = useState<string[]>([]);

  // Accumulate agent transcript chunks and batch-update every 150ms
  const agentChunksRef = useRef('');
  const agentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAgentRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear agent transcript 4s after speaking stops
  const prevStatusRef = useRef<AgentStatus>('idle');

  // Tool call handler
  const handleToolCall = useCallback(async (call: ToolCall): Promise<unknown> => {
    console.log('[Tool call]', call.name, call.args);

    if (call.name === 'search_products') {
      const query = call.args.query as string;
      const platforms = (call.args.platforms as string[] | undefined) ?? ['zepto', 'blinkit'];

      setSearchQuery(query);
      setIsSearching(true);
      setSearchResults([]);
      setSearchLogs([]);

      try {
        const result = await streamSearch(query, platforms, (msg) => {
          setSearchLogs(prev => [...prev, msg]);
        });

        // Map to Product shape for ProductCard
        const products: Product[] = [
          ...result.zepto.map(p => mapToProduct(p, 'zepto')),
          ...result.blinkit.map(p => mapToProduct(p, 'blinkit')),
        ];
        setSearchResults(products);

        // Build a human-readable summary the agent can speak from directly
        const zeptoBest = result.zepto[0];
        const blinkitBest = result.blinkit[0];
        let summary = `Found ${products.length} results for "${query}". `;
        if (zeptoBest && blinkitBest) {
          summary += `Zepto has ${zeptoBest.name} at ₹${zeptoBest.price}. Blinkit has ${blinkitBest.name} at ₹${blinkitBest.price}. `;
          if (result.price_difference > 0) {
            summary += `${result.cheapest_provider === 'zepto' ? 'Zepto' : 'Blinkit'} is cheaper by ₹${result.price_difference.toFixed(0)}.`;
          } else {
            summary += `Both platforms have the same price.`;
          }
        } else if (zeptoBest) {
          summary += `Found on Zepto: ${zeptoBest.name} at ₹${zeptoBest.price}.`;
        } else if (blinkitBest) {
          summary += `Found on Blinkit: ${blinkitBest.name} at ₹${blinkitBest.price}.`;
        } else {
          summary = `No results found for "${query}" on either platform.`;
        }

        return {
          summary,
          cheapest_provider: result.cheapest_provider,
          cheapest_product: result.cheapest_product
            ? { name: result.cheapest_product.name, price: result.cheapest_product.price }
            : null,
          price_difference: result.price_difference,
          zepto_cheapest: zeptoBest ? { name: zeptoBest.name, price: zeptoBest.price } : null,
          blinkit_cheapest: blinkitBest ? { name: blinkitBest.name, price: blinkitBest.price } : null,
          total_results: products.length,
        };
      } catch (err) {
        console.error('[search_products]', err);
        return { error: 'Search failed, please try again' };
      } finally {
        setIsSearching(false);
      }
    }

    if (call.name === 'place_order') return { message: 'Order placement coming in Phase 3' };
    return {};
  }, []);

  const handleTranscript = useCallback((text: string, isAgent: boolean) => {
    if (isAgent) {
      // Accumulate chunks, batch state update at 150ms intervals
      agentChunksRef.current += text;
      if (agentDebounceRef.current) clearTimeout(agentDebounceRef.current);
      agentDebounceRef.current = setTimeout(() => {
        setAgentTranscript(agentChunksRef.current);
      }, 150);
    } else {
      setUserTranscript(text);
    }
  }, []);

  const { status, error, connect, disconnect } = useLiveAgent({
    language,
    onToolCall: handleToolCall,
    onTranscript: handleTranscript,
  });

  // Clear transcripts when agent finishes speaking
  useEffect(() => {
    if (prevStatusRef.current === 'speaking' && status !== 'speaking') {
      if (clearAgentRef.current) clearTimeout(clearAgentRef.current);
      clearAgentRef.current = setTimeout(() => {
        agentChunksRef.current = '';
        setAgentTranscript('');
      }, 4000);
    }
    if (status === 'idle') {
      agentChunksRef.current = '';
      setAgentTranscript('');
      setUserTranscript('');
      setSearchResults([]);
      setSearchQuery('');
      setSearchLogs([]);
    }
    prevStatusRef.current = status;
  }, [status]);

  const addToCart = useCallback((product: Product, provider: Provider) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.selectedProvider === provider);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id && i.selectedProvider === provider
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { product, quantity: 1, selectedProvider: provider }];
    });
  }, []);

  const isActive = status !== 'idle' && status !== 'error';

  const handleLanguageChange = (lang: Language) => {
    if (isActive) disconnect();
    setLanguage(lang);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-charcoal selection:bg-saffron-200">

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 z-30 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-saffron-500 flex items-center justify-center text-white font-serif font-bold text-xl">
            B
          </div>
          <span className="font-serif text-xl font-bold text-charcoal">BolkeAI</span>
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

      {/* Main */}
      <main className="pt-20 pb-36 px-4 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center gap-10">

        {/* Greeting */}
        <div className="text-center space-y-4">
          <motion.h1
            key={language.code}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-7xl font-serif font-medium text-gray-900 leading-tight"
          >
            {language.greeting}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-gray-400 text-base"
          >
            {statusLabel(status, language)}
          </motion.p>
        </div>

        {/* Language selector */}
        <LanguageSelector selected={language} onChange={handleLanguageChange} />

        {/* Transcripts */}
        <div className="flex flex-col items-center gap-3 w-full max-w-sm min-h-[80px] justify-end">
          <AnimatePresence>
            {userTranscript && (
              <motion.p
                key="user"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-gray-400 text-center italic"
              >
                {userTranscript}
              </motion.p>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {agentTranscript && (
              <motion.div
                key="agent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="px-5 py-3 rounded-2xl bg-gray-900 text-white text-sm text-center shadow-sm"
              >
                {agentTranscript}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search logs — real-time from backend */}
        <AnimatePresence>
          {(isSearching || searchLogs.length > 0) && !searchResults.length && (
            <motion.div
              key="search-logs"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm font-mono text-xs space-y-1.5"
            >
              <AnimatePresence initial={false}>
                {searchLogs.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: i === searchLogs.length - 1 && isSearching ? 1 : 0.4 }}
                    className="flex items-center gap-2 text-gray-500"
                  >
                    {i === searchLogs.length - 1 && isSearching ? (
                      <Loader2 className="w-3 h-3 text-saffron-500 animate-spin shrink-0" />
                    ) : (
                      <span className="text-green-500 shrink-0">✓</span>
                    )}
                    {line}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search results grid */}
        <AnimatePresence>
          {searchResults.length > 0 && !isSearching && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <p className="text-xs text-gray-400 text-center mb-3">
                {searchResults.length} results for &ldquo;{searchQuery}&rdquo;
              </p>
              <div className="grid grid-cols-2 gap-3">
                {searchResults.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={addToCart}
                    isAdded={cart.some(i => i.product.id === product.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

      </main>

      {/* Floating mic */}
      <div className="fixed bottom-10 left-0 right-0 flex justify-center z-30">
        <MicToggle status={status} onStart={connect} onStop={disconnect} />
      </div>

      {/* Cart */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onCheckout={() => setIsCartOpen(false)}
      />
    </div>
  );
}
