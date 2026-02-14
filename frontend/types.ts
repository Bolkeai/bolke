export type Provider = 'Zepto' | 'Blinkit' | 'Instamart';

export interface Product {
  id: string;
  name: string;
  hindiName?: string;
  image: string;
  unit: string;
  prices: {
    provider: Provider;
    price: number;
    originalPrice?: number;
    deliveryTime: string;
  }[];
  category: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedProvider: Provider;
}

export type AppMode = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'RESULTS' | 'CART' | 'CONFIRMATION';

export interface VoiceState {
  transcript: string;
  isListening: boolean;
}

// AI Response Schema
export interface AIAction {
  type: 'SEARCH' | 'ADD_TO_CART' | 'SHOW_CART' | 'CHECKOUT' | 'UNKNOWN';
  query?: string;
  productName?: string;
  quantity?: number;
  provider?: Provider;
  speakResponse: string;
}
