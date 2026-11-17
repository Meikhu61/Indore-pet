export type BrandCategory = 'iphone' | 'samsung' | 'android';
export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'reserved';
export type BookingType = 'buy_reserve' | 'sell_device' | 'exchange_upgrade' | 'store_visit';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type UserRole = 'customer' | 'admin';

export const SCHEMA_LIMITS = {
  ID_MAX: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  NAME_MAX: 100,
  SHORT_MAX: 40,
  CONDITION_MAX: 80,
  ACCESSORIES_MAX: 120,
  IMAGE_URL_MAX: 300,
  CUSTOMER_NAME_MAX: 80,
  PHONE_MAX: 20,
  DEVICE_TITLE_MAX: 120,
  NOTES_MAX: 400,
  MAX_PRICE: 10_000_000,
  MAX_STOCK: 10_000,
} as const;

export interface InventoryItem {
  id: string;
  name: string;
  brand: BrandCategory;
  brandLabel: string;
  storage: string;
  color: string;
  condition: string;
  price: number;
  stock: number;
  status: InventoryStatus;
  accessories: string;
  imageUrl: string;
  isPublished: boolean;
  updatedBy: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface BookingRecord {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  bookingType: BookingType;
  deviceId: string;
  deviceTitle: string;
  brandCategory: BrandCategory | 'general';
  tradeInDevice: string;
  estimatedValue: number;
  appointmentDate: string;
  timeSlot: string;
  notes: string;
  status: BookingStatus;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface BookingMetric {
  id: string;
  userId: string;
  bookingType: BookingType;
  brandCategory: BrandCategory | 'general';
  deviceTitle: string;
  estimatedValue: number;
  appointmentDate: string;
  timeSlot: string;
  status: BookingStatus;
  isPublicMetric: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  avatarInitials: string;
  role: UserRole;
  isPublicProfile: boolean;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  tradeInCount: number;
  totalProjectedValue: number;
  preferredBrand: BrandCategory | 'all';
  lastActiveAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface UserPrivate {
  uid: string;
  email: string;
  phone: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface ToastNotice {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const STORE_TIME_SLOTS = [
  '09:30 AM - 11:00 AM',
  '11:00 AM - 12:30 PM',
  '12:30 PM - 02:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 05:30 PM',
  '05:30 PM - 07:30 PM',
] as const;

export const STUDIO_IMAGE_PRESETS = [
  {
    label: 'iPhone 15 Pro Max (Natural Titanium)',
    url: '/src/assets/images/phone_iphone_15_pro_max_1794824093283.jpg',
    brand: 'iphone' as BrandCategory,
  },
  {
    label: 'iPhone 14 Pro (Deep Purple)',
    url: '/src/assets/images/phone_iphone_14_pro_1794824093444.jpg',
    brand: 'iphone' as BrandCategory,
  },
  {
    label: 'Samsung Galaxy S24 Ultra (Titanium)',
    url: '/src/assets/images/phone_samsung_s24_ultra_1794824094196.jpg',
    brand: 'samsung' as BrandCategory,
  },
  {
    label: 'iPhone 13 Pro (Sierra Blue / Graphite)',
    url: '/src/assets/images/phone_iphone_13_1794824094298.jpg',
    brand: 'iphone' as BrandCategory,
  },
  {
    label: 'OnePlus 12 5G (Emerald Marble)',
    url: '/src/assets/images/phone_oneplus_12_1794824094989.jpg',
    brand: 'android' as BrandCategory,
  },
  {
    label: 'Samsung Galaxy Z Fold (Phantom Black)',
    url: '/src/assets/images/phone_galaxy_z_fold_1794824095217.jpg',
    brand: 'samsung' as BrandCategory,
  },
] as const;

export const DEFAULT_CATALOG: Omit<InventoryItem, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'iphone-15-pro-max-256',
    name: 'iPhone 15 Pro Max',
    brand: 'iphone',
    brandLabel: 'Apple iPhone',
    storage: '256GB',
    color: 'Natural Titanium',
    condition: 'Mint · 98% Battery',
    price: 112500,
    stock: 4,
    status: 'in_stock',
    accessories: 'Original Box + Braided Cable',
    imageUrl: '/src/assets/images/phone_iphone_15_pro_max_1794824093283.jpg',
    isPublished: true,
    updatedBy: 'system',
  },
  {
    id: 'iphone-14-pro-256',
    name: 'iPhone 14 Pro',
    brand: 'iphone',
    brandLabel: 'Apple iPhone',
    storage: '256GB',
    color: 'Deep Purple',
    condition: 'Like New · 92% Battery',
    price: 76900,
    stock: 3,
    status: 'in_stock',
    accessories: 'Box + Bill + Original Cable',
    imageUrl: '/src/assets/images/phone_iphone_14_pro_1794824093444.jpg',
    isPublished: true,
    updatedBy: 'system',
  },
  {
    id: 'samsung-s24-ultra-512',
    name: 'Samsung Galaxy S24 Ultra',
    brand: 'samsung',
    brandLabel: 'Samsung',
    storage: '512GB',
    color: 'Titanium Gray',
    condition: 'Flagship · 5G · S-Pen',
    price: 94500,
    stock: 2,
    status: 'low_stock',
    accessories: 'S-Pen + Box + Fast Charger',
    imageUrl: '/src/assets/images/phone_samsung_s24_ultra_1794824094196.jpg',
    isPublished: true,
    updatedBy: 'system',
  },
  {
    id: 'iphone-13-pro-128',
    name: 'iPhone 13 Pro',
    brand: 'iphone',
    brandLabel: 'Apple iPhone',
    storage: '128GB',
    color: 'Sierra Blue',
    condition: 'Clean · 89% Battery',
    price: 54900,
    stock: 6,
    status: 'in_stock',
    accessories: 'Store Warranty + Cable',
    imageUrl: '/src/assets/images/phone_iphone_13_1794824094298.jpg',
    isPublished: true,
    updatedBy: 'system',
  },
  {
    id: 'oneplus-12-5g-256',
    name: 'OnePlus 12 5G',
    brand: 'android',
    brandLabel: 'OnePlus',
    storage: '256GB',
    color: 'Flowy Emerald',
    condition: 'Mint · 100W SuperVOOC',
    price: 49900,
    stock: 5,
    status: 'in_stock',
    accessories: 'Complete Kit + Box',
    imageUrl: '/src/assets/images/phone_oneplus_12_1794824094989.jpg',
    isPublished: true,
    updatedBy: 'system',
  },
  {
    id: 'galaxy-z-fold-5-256',
    name: 'Samsung Galaxy Z Fold 5',
    brand: 'samsung',
    brandLabel: 'Samsung',
    storage: '256GB',
    color: 'Phantom Black',
    condition: 'Clean Hinge · Dual AMOLED',
    price: 89500,
    stock: 1,
    status: 'low_stock',
    accessories: 'Box + Official Slim Case',
    imageUrl: '/src/assets/images/phone_galaxy_z_fold_1794824095217.jpg',
    isPublished: true,
    updatedBy: 'system',
  },
];

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function clampStr(val: string, max: number): string {
  return val.trim().slice(0, max);
}
