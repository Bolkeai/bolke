/**
 * Backend API Service
 * Handles all communication with the FastAPI backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface VoiceRequest {
  text: string;
  session_id: string;
  cart: Array<{
    product_name: string;
    quantity: number;
    provider: string;
  }>;
}

export interface VoiceResponse {
  intent: string;
  products: string[];
  quantities: string[];
  brands: string[];
  response_text: string;
  search_results?: {
    zepto: Array<{
      name: string;
      price: number;
      brand: string;
      weight: string;
      image_url: string;
    }>;
    blinkit: Array<{
      name: string;
      price: number;
      brand: string;
      weight: string;
      image_url: string;
    }>;
    cheapest_provider: string;
    cheapest_product: any;
    price_difference: number;
    summary: string;
  };
  session_id: string;
}

export interface SearchRequest {
  query: string;
  platforms?: string[];
  max_results?: number;
}

export interface CheckoutRequest {
  items: string[];
  provider?: string;
  address?: string;
  session_id?: string;
}

/**
 * Process voice input through the backend
 */
export async function processVoice(request: VoiceRequest): Promise<VoiceResponse> {
  try {
    console.log('🎤 Calling backend API:', `${API_BASE_URL}/api/voice`);
    console.log('Request:', request);
    
    const response = await fetch(`${API_BASE_URL}/api/voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`Voice processing failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API Response:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Network Error:', error);
    if (error.message?.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend. Make sure the backend server is running on http://localhost:8000');
    }
    throw error;
  }
}

/**
 * Search for products directly
 */
export async function searchProducts(request: SearchRequest): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: request.query,
      platforms: request.platforms || ['zepto', 'blinkit'],
      max_results: request.max_results || 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Place an order
 */
export async function checkout(request: CheckoutRequest): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: request.items,
      provider: request.provider || 'zepto',
      address: request.address || '',
      session_id: request.session_id || 'default',
    }),
  });

  if (!response.ok) {
    throw new Error(`Checkout failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; service: string; gemini_key_set: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}
