import { Product } from './types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Farm Fresh Tomatoes',
    hindiName: 'ताज़ा टमाटर',
    image: 'https://picsum.photos/300/300?random=1',
    unit: '1 kg',
    category: 'Vegetables',
    prices: [
      { provider: 'Blinkit', price: 42, originalPrice: 60, deliveryTime: '8 mins' },
      { provider: 'Zepto', price: 38, originalPrice: 55, deliveryTime: '12 mins' },
    ],
  },
  {
    id: '2',
    name: 'Red Onions',
    hindiName: 'लाल प्याज',
    image: 'https://picsum.photos/300/300?random=2',
    unit: '1 kg',
    category: 'Vegetables',
    prices: [
      { provider: 'Blinkit', price: 35, deliveryTime: '8 mins' },
      { provider: 'Zepto', price: 32, deliveryTime: '10 mins' },
    ],
  },
  {
    id: '3',
    name: 'Amul Taaza Milk',
    hindiName: 'अमूल ताज़ा दूध',
    image: 'https://picsum.photos/300/300?random=3',
    unit: '500 ml',
    category: 'Dairy',
    prices: [
      { provider: 'Blinkit', price: 27, deliveryTime: '5 mins' },
      { provider: 'Zepto', price: 27, deliveryTime: '7 mins' },
    ],
  },
  {
    id: '4',
    name: 'Atta (Whole Wheat Flour)',
    hindiName: 'आटा',
    image: 'https://picsum.photos/300/300?random=4',
    unit: '5 kg',
    category: 'Staples',
    prices: [
      { provider: 'Blinkit', price: 210, originalPrice: 240, deliveryTime: '15 mins' },
      { provider: 'Zepto', price: 205, originalPrice: 235, deliveryTime: '18 mins' },
    ],
  },
  {
    id: '5',
    name: 'Basmati Rice',
    hindiName: 'बासमती चावल',
    image: 'https://picsum.photos/300/300?random=5',
    unit: '1 kg',
    category: 'Staples',
    prices: [
      { provider: 'Blinkit', price: 95, deliveryTime: '10 mins' },
      { provider: 'Zepto', price: 110, deliveryTime: '12 mins' },
    ],
  },
  {
    id: '6',
    name: 'Tata Salt',
    hindiName: 'टाटा नमक',
    image: 'https://picsum.photos/300/300?random=6',
    unit: '1 kg',
    category: 'Essentials',
    prices: [
      { provider: 'Blinkit', price: 25, deliveryTime: '6 mins' },
      { provider: 'Zepto', price: 24, deliveryTime: '9 mins' },
    ],
  },
  {
    id: '7',
    name: 'Maggi Noodles',
    hindiName: 'मैगी',
    image: 'https://picsum.photos/300/300?random=7',
    unit: 'Pack of 4',
    category: 'Snacks',
    prices: [
      { provider: 'Blinkit', price: 56, deliveryTime: '5 mins' },
      { provider: 'Zepto', price: 54, deliveryTime: '8 mins' },
    ],
  },
];

export const SUGGESTED_QUERIES = [
  "Tamatar aur Pyaaz dikhao",
  "Show me fresh milk",
  "Price of 5kg Atta",
  "Maggi add karo"
];
