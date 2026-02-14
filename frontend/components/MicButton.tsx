'use client';

import React from 'react';
import { Mic, Square } from 'lucide-react';
import { motion } from 'framer-motion';

interface MicButtonProps {
  isListening: boolean;
  onClick: () => void;
  mode: string;
}

export const MicButton: React.FC<MicButtonProps> = ({ isListening, onClick, mode }) => {
  return (
    <div className="relative flex items-center justify-center">
      {isListening && (
        <>
          <motion.div
            className="absolute bg-saffron-400 rounded-full opacity-30"
            initial={{ width: '100%', height: '100%' }}
            animate={{ width: '250%', height: '250%', opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            className="absolute bg-saffron-500 rounded-full opacity-20"
            initial={{ width: '100%', height: '100%' }}
            animate={{ width: '180%', height: '180%', opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
          />
        </>
      )}

      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.95 }}
        animate={{ scale: isListening ? 1.1 : 1 }}
        className={`relative z-10 flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full shadow-2xl transition-all duration-300 bg-gray-900 border border-gray-800 ${mode === 'PROCESSING' ? 'animate-pulse' : ''}`}
        aria-label={isListening ? "Stop Listening" : "Start Listening"}
      >
        {isListening ? (
          <Square className="w-8 h-8 text-white fill-current" />
        ) : (
          <Mic className="w-10 h-10 text-white" />
        )}
      </motion.button>
    </div>
  );
};
