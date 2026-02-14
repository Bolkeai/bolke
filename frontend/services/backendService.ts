const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

// ── Shapes returned by the FastAPI backend ────────────────────────────────────

export interface ScrapedProduct {
  name: string;
  price: number;
  brand: string;
  weight: string;
  image_url: string;
}

export interface SearchResponse {
  query: string;
  zepto: ScrapedProduct[];
  blinkit: ScrapedProduct[];
  cheapest_provider: string;
  cheapest_product: (ScrapedProduct & { provider: string }) | null;
  price_difference: number;
  summary: string;
}

/**
 * Stream a product search via SSE.
 * `onLog` is called with each real progress message from the backend.
 * Resolves with the final SearchResponse when done.
 */
export function streamSearch(
  query: string,
  platforms: string[] = ['zepto', 'blinkit'],
  onLog: (message: string) => void,
): Promise<SearchResponse> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ query, platforms: platforms.join(',') });
    const es = new EventSource(`${BACKEND_URL}/api/search/stream?${params}`);

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data) as { type: string; message?: string; data?: SearchResponse };
      if (msg.type === 'log' && msg.message) {
        onLog(msg.message);
      } else if (msg.type === 'result' && msg.data) {
        es.close();
        resolve(msg.data);
      } else if (msg.type === 'error') {
        es.close();
        reject(new Error(msg.message ?? 'Search failed'));
      }
    };

    es.onerror = () => {
      es.close();
      reject(new Error('Search stream connection failed'));
    };
  });
}

export interface CheckoutResponse {
  success: boolean;
  order_id: string;
  estimated_delivery: string;
  total_amount: number;
  tracking_url: string;
  message: string;
}

export async function placeOrder(
  items: string[],
  provider: string,
): Promise<CheckoutResponse> {
  const res = await fetch(`${BACKEND_URL}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, provider }),
  });
  if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);
  return res.json();
}
