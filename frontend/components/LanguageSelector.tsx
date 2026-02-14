'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LANGUAGES, Language } from '../lib/languages';

interface LanguageSelectorProps {
  selected: Language;
  onChange: (lang: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ selected, onChange }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex flex-wrap justify-center gap-2"
    >
      {LANGUAGES.map((lang) => {
        const isSelected = lang.code === selected.code;
        return (
          <button
            key={lang.code}
            onClick={() => onChange(lang)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
              isSelected
                ? 'bg-charcoal text-white border-charcoal'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
            }`}
          >
            {lang.label}
          </button>
        );
      })}
    </motion.div>
  );
};
