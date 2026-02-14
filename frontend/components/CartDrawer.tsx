'use client';

import React from 'react';
import { CartItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ArrowRight } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, items, onCheckout }) => {
  const total = items.reduce((sum, item) => {
    const price = item.product.prices.find(p => p.provider === item.selectedProvider)?.price || 0;
    return sum + (price * item.quantity);
  }, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>

            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50">
              <h2 className="text-2xl font-serif font-semibold text-charcoal">Your Cart</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400">Your cart is empty.</p>
                  <p className="text-sm text-gray-300 mt-1">&quot;Bolo, kya chahiye?&quot;</p>
                </div>
              ) : (
                items.map((item, index) => {
                  const price = item.product.prices.find(p => p.provider === item.selectedProvider)?.price || 0;
                  return (
                    <div key={`${item.product.id}-${index}`} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl">
                      <img src={item.product.image} className="w-16 h-16 rounded-lg object-cover mix-blend-multiply" alt={item.product.name} />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 line-clamp-1">{item.product.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.selectedProvider === 'Zepto' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-800'}`}>
                            {item.selectedProvider}
                          </span>
                          <span className="text-sm text-gray-500">Qty: {item.quantity}</span>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">₹{price * item.quantity}</span>
                    </div>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-gray-100 bg-white pb-safe">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-500">Total</span>
                  <span className="text-2xl font-serif font-bold text-gray-900">₹{total}</span>
                </div>
                <button
                  onClick={onCheckout}
                  className="w-full bg-saffron-500 text-white font-medium text-lg py-4 rounded-xl shadow-lg shadow-saffron-200 hover:bg-saffron-600 transition-colors flex items-center justify-center gap-2"
                >
                  Checkout <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
