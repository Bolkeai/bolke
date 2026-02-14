'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface WaveformProps {
  className?: string;
  barColor?: string;
}

export const Waveform: React.FC<WaveformProps> = ({
  className = "h-32",
  barColor = "from-saffron-500 to-saffron-400"
}) => {
  return (
    <div className={`flex items-center justify-center gap-1.5 w-full max-w-md mx-auto ${className}`} aria-hidden="true">
      {[...Array(16)].map((_, i) => {
        const center = 8;
        const distance = Math.abs(i - center);
        const delay = distance * 0.1;

        return (
          <motion.div
            key={i}
            className={`w-1.5 md:w-2 rounded-full bg-gradient-to-t ${barColor}`}
            initial={{ height: '10%' }}
            animate={{ height: ['15%', '75%', '15%'] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              repeatType: "loop",
              ease: "easeInOut",
              delay: delay,
            }}
            style={{ minHeight: '4px', opacity: 0.8 }}
          />
        );
      })}
    </div>
  );
};
