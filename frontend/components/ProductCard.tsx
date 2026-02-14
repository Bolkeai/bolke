'use client';

import React from 'react';
import { Product, Provider } from '../types';
import { Plus, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, provider: Provider) => void;
  isAdded?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAdd, isAdded }) => {
  const sortedPrices = [...product.prices].sort((a, b) => a.price - b.price);
  const bestPrice = sortedPrices[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col h-full"
    >
      <div className="relative mb-4 overflow-hidden rounded-xl aspect-square bg-gray-50">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="object-cover w-full h-full mix-blend-multiply"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🛒</div>
        )}
        {bestPrice.price < (product.prices[1]?.price || Infinity) && (
          <div className="absolute top-2 left-2 bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
            Best Value
          </div>
        )}
      </div>

      <div className="flex-1">
        <h3 className="text-lg font-serif font-semibold text-charcoal leading-tight">
          {product.name}
        </h3>
        {product.hindiName && (
          <p className="text-sm text-gray-500 font-hindi mt-1">{product.hindiName}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{product.unit}</p>
      </div>

      <div className="mt-4 space-y-2">
        {product.prices.map((p) => {
          const isCheapest = p.price === bestPrice.price;
          return (
            <button
              key={p.provider}
              onClick={() => onAdd(product, p.provider)}
              className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all duration-200 ${isCheapest ? 'border-saffron-200 bg-saffron-50/50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${p.provider === 'Zepto' ? 'bg-purple-600' : 'bg-yellow-500'}`} />
                <span className="text-sm font-medium text-gray-700">{p.provider}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="block text-sm font-bold text-gray-900">₹{p.price}</span>
                  <span className="block text-[10px] text-gray-400">{p.deliveryTime}</span>
                </div>
                {isAdded ? (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200">
                    <Plus className="w-3 h-3 text-gray-600" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};
