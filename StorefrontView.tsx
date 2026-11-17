import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Clock,
  Instagram,
  MessageCircle,
  Phone,
  Repeat,
  Search,
  Smartphone,
} from 'lucide-react';
import { BrandCategory, formatINR, InventoryItem } from '../types/domain';
import { DeviceImage } from './DeviceImage';

interface StorefrontViewProps {
  inventory: InventoryItem[];
  onBookDevice: (item: InventoryItem) => void;
  onStartExchange: (prefill: {
    bookingType: 'sell_device' | 'exchange_upgrade';
    tradeInDevice: string;
    deviceTitle: string;
    brandCategory: BrandCategory | 'general';
    estimatedValue: number;
  }) => void;
  onOpenBookings: () => void;
}

const BRAND_FILTERS: { id: BrandCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Devices' },
  { id: 'iphone', label: 'iPhone' },
  { id: 'samsung', label: 'Samsung' },
  { id: 'android', label: 'OnePlus / Android' },
];

function estimateTradeInValue(brand: string, model: string, condition: string): number {
  const baseByBrand: Record<string, number> = {
    'Apple iPhone': 42000,
    Samsung: 34000,
    OnePlus: 24000,
    'Vivo / Oppo / Xiaomi': 18000,
    'Other Brand': 14000,
  };
  let base = baseByBrand[brand] || 18000;
  const lower = model.toLowerCase();
  if (lower.includes('15') || lower.includes('s24') || lower.includes('fold')) base += 22000;
  else if (lower.includes('14') || lower.includes('s23') || lower.includes('12')) base += 11000;
  else if (lower.includes('13') || lower.includes('s22')) base += 4000;
  if (lower.includes('pro max') || lower.includes('ultra')) base += 12000;
  else if (lower.includes('pro')) base += 6000;

  if (condition.includes('Mint')) return base;
  if (condition.includes('Good')) return Math.round(base * 0.86);
  return Math.round(base * 0.72);
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  inventory,
  onBookDevice,
  onStartExchange,
  onOpenBookings,
}) => {
  const [brandFilter, setBrandFilter] = useState<BrandCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Trade-in estimator state
  const [tradeMode, setTradeMode] = useState<'exchange_upgrade' | 'sell_device'>('exchange_upgrade');
  const [tradeBrand, setTradeBrand] = useState('Apple iPhone');
  const [tradeModel, setTradeModel] = useState('');
  const [tradeCondition, setTradeCondition] = useState('Mint Condition (With Box & Bill)');
  const [targetPhone, setTargetPhone] = useState('');

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventory.filter((item) => {
      if (!item.isPublished) return false;
      const matchesBrand = brandFilter === 'all' || item.brand === brandFilter;
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.brandLabel.toLowerCase().includes(q) ||
        item.storage.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q);
      return matchesBrand && matchesQuery;
    });
  }, [inventory, brandFilter, searchQuery]);

  const estimatedPayout = useMemo(
    () => estimateTradeInValue(tradeBrand, tradeModel || 'Flagship', tradeCondition),
    [tradeBrand, tradeModel, tradeCondition]
  );

  const handleBookingQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanModel = tradeModel.trim() || `${tradeBrand} Smartphone`;
    const brandCategory: BrandCategory | 'general' =
      tradeBrand === 'Apple iPhone'
        ? 'iphone'
        : tradeBrand === 'Samsung'
        ? 'samsung'
        : tradeBrand === 'OnePlus'
        ? 'android'
        : 'general';

    onStartExchange({
      bookingType: tradeMode,
      tradeInDevice: `${tradeBrand} ${cleanModel} (${tradeCondition.split('(')[0].trim()})`,
      deviceTitle: targetPhone.trim() || (tradeMode === 'sell_device' ? 'Instant Cash Payout' : 'Store Upgrade Selection'),
      brandCategory,
      estimatedValue: estimatedPayout,
    });
  };

  const handleWhatsAppQuote = () => {
    const cleanModel = tradeModel.trim() || 'Not specified';
    const actionLabel = tradeMode === 'exchange_upgrade' ? 'Exchange Phone' : 'Sell Phone for Cash';
    let message =
      `Hello A1 MOBILE! I checked my estimate on your portal.\n\n` +
      `Request: ${actionLabel}\n` +
      `My Device: ${tradeBrand} - ${cleanModel}\n` +
      `Condition: ${tradeCondition}\n` +
      `Estimated Value: ${formatINR(estimatedPayout)}`;
    if (targetPhone.trim()) {
      message += `\nLooking to Buy: ${targetPhone.trim()}`;
    }
    window.open(
      `https://wa.me/919612332925?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Section 1: Hero */}
      <section className="relative pt-10 pb-8 sm:pt-14 sm:pb-12 border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 lg:items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <p className="text-xs font-medium tracking-wide text-amber-300">
                  @a1_mobile_checkon · Open Daily 9:30 AM – 7:30 PM · PH: 9612332925
                </p>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.06] text-white max-w-2xl">
                  Buy, <span className="gold-gradient-text">Sell & Exchange</span> Flagship Smartphones With Confidence
                </h1>

                <p className="text-zinc-400 text-base sm:text-lg max-w-xl leading-relaxed">
                  Certified pre-owned iPhones, Galaxy flagships, and Android devices with full verification. Reserve live stock online, book your store inspection slot, or get instant trade-in payouts.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <a
                    href="#catalog"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] rounded-xl gold-gradient-bg text-zinc-950 font-bold text-sm hover:brightness-110 transition whitespace-nowrap"
                  >
                    <Smartphone className="w-4 h-4" />
                    Browse Live Stock
                  </a>
                  <button
                    type="button"
                    onClick={onOpenBookings}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 font-semibold text-sm hover:border-amber-400 transition whitespace-nowrap cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-amber-400" />
                    Book Store Visit
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-zinc-800/80 max-w-lg">
                <div>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums">60.3K+</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Instagram Followers</p>
                </div>
                <div>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-amber-400 tabular-nums">561+</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Reels & Handovers</p>
                </div>
                <div>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums">100%</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Quality Verified</p>
                </div>
              </div>
            </div>

            {/* Right Store Identity Showcase */}
            <div className="lg:col-span-5 flex">
              <div className="w-full rounded-2xl bg-[#121216] border border-zinc-800 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="flex items-center gap-4 pb-5 border-b border-zinc-800">
                  <div className="w-16 h-16 rounded-full bg-zinc-950 border-2 border-amber-500 flex items-center justify-center shrink-0">
                    <span className="font-display text-lg font-bold gold-gradient-text">A1</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-bold text-white truncate">
                      A1 MOBILE Store
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      @a1_mobile_checkon · Verified Flagship Dealer
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2.5 border-b border-zinc-800/70">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      Store Timings
                    </span>
                    <span className="font-mono text-xs text-zinc-100 tabular-nums">9:30 AM – 7:30 PM</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 border-b border-zinc-800/70">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-amber-400" />
                      Direct Helpline
                    </span>
                    <a href="tel:9612332925" className="font-mono text-xs text-amber-300 hover:underline tabular-nums">
                      +91 9612332925
                    </a>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      Active Catalog
                    </span>
                    <span className="font-mono text-xs text-emerald-400 tabular-nums">
                      {inventory.filter((i) => i.stock > 0).length} Models Available
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <a
                    href="tel:9612332925"
                    className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 font-semibold text-xs hover:border-amber-400 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    Call Store
                  </a>
                  <a
                    href="https://wa.me/919612332925?text=Hi%20A1%20MOBILE%2C%20I%20want%20to%20inquire%20about%20a%20phone."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl gold-gradient-bg text-zinc-950 font-bold text-xs hover:brightness-110 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Featured Live Inventory Catalog */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Live Inventory</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1">
              Featured Smartphones
            </h2>
            <p className="text-zinc-400 text-sm mt-1.5 max-w-xl">
              Real-time store stock updated directly by A1 MOBILE. Reserve a unit for pickup or pair it with an instant exchange.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search model, storage, color..."
                aria-label="Search smartphones"
                className="w-full sm:w-64 min-h-[42px] pl-10 pr-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto no-scrollbar">
              {BRAND_FILTERS.map((f) => {
                const active = brandFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setBrandFilter(f.id)}
                    className={`px-3.5 py-2 min-h-[36px] rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-[#121216] p-12 text-center">
            <Smartphone className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-zinc-200">No matching smartphones found</p>
            <p className="text-sm text-zinc-400 mt-1">Try clearing your search or switching brand filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const outOfStock = item.stock === 0 || item.status === 'out_of_stock';
              const statusLabel = outOfStock
                ? 'Out of Stock'
                : item.status === 'low_stock' || item.stock <= 2
                ? `Only ${item.stock} left`
                : `${item.stock} in stock`;

              return (
                <article
                  key={item.id}
                  className="rounded-2xl bg-[#121216] border border-zinc-800/90 overflow-hidden flex flex-col hover:border-amber-400/50 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="aspect-[4/3] bg-zinc-900 overflow-hidden">
                    <DeviceImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                        <span className="uppercase tracking-wider font-medium">{item.brandLabel}</span>
                        <span
                          className={`font-mono tabular-nums font-medium ${
                            outOfStock
                              ? 'text-red-400'
                              : item.stock <= 2
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-xl font-bold text-white truncate">
                          {item.name}
                        </h3>
                        <span className="font-mono text-base font-semibold text-amber-300 tabular-nums shrink-0">
                          {formatINR(item.price)}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400">
                        {item.storage} · {item.color} · {item.condition}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{item.accessories}</p>
                    </div>

                    <div className="flex items-center gap-2.5 pt-2 border-t border-zinc-800/70">
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => onBookDevice(item)}
                        className="flex-1 min-h-[42px] px-4 py-2 rounded-xl gold-gradient-bg text-zinc-950 font-bold text-xs hover:brightness-110 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {outOfStock ? 'Waitlist' : 'Book & Reserve'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onStartExchange({
                            bookingType: 'exchange_upgrade',
                            tradeInDevice: '',
                            deviceTitle: `${item.name} (${item.storage})`,
                            brandCategory: item.brand,
                            estimatedValue: item.price,
                          })
                        }
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 font-semibold text-xs hover:border-amber-400 transition cursor-pointer whitespace-nowrap"
                      >
                        Exchange
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 3: Instant Sell & Exchange Estimator + Booking Handoff */}
      <section id="sell-exchange" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-6 sm:p-10 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Trade-In & Instant Cash
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">
              Estimate Your Device & Book Inspection
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Get an instant trade-in valuation and reserve a 15-minute physical check slot at our store between 9:30 AM and 7:30 PM.
            </p>

            <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-1">
              <p className="text-xs text-zinc-400">Indicative Trade-In Estimate</p>
              <p className="font-mono text-2xl sm:text-3xl font-bold text-amber-300 tabular-nums">
                {formatINR(estimatedPayout)}
              </p>
              <p className="text-xs text-zinc-500">
                Final payout confirmed after battery & screen diagnostics in store.
              </p>
            </div>
          </div>

          <form onSubmit={handleBookingQuoteSubmit} className="lg:col-span-7 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="est-mode" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Service Type
                </label>
                <select
                  id="est-mode"
                  value={tradeMode}
                  onChange={(e) =>
                    setTradeMode(e.target.value as 'exchange_upgrade' | 'sell_device')
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                >
                  <option value="exchange_upgrade">Exchange for Another Phone</option>
                  <option value="sell_device">Sell Device for Instant Cash</option>
                </select>
              </div>
              <div>
                <label htmlFor="est-brand" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Your Phone Brand
                </label>
                <select
                  id="est-brand"
                  value={tradeBrand}
                  onChange={(e) => setTradeBrand(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                >
                  <option value="Apple iPhone">Apple iPhone</option>
                  <option value="Samsung">Samsung Galaxy</option>
                  <option value="OnePlus">OnePlus</option>
                  <option value="Vivo / Oppo / Xiaomi">Vivo / Oppo / Xiaomi</option>
                  <option value="Other Brand">Other Brand</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="est-model" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Model & Storage *
                </label>
                <input
                  id="est-model"
                  type="text"
                  required
                  value={tradeModel}
                  onChange={(e) => setTradeModel(e.target.value)}
                  placeholder="e.g., iPhone 13 Pro 128GB"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="est-condition" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Condition
                </label>
                <select
                  id="est-condition"
                  value={tradeCondition}
                  onChange={(e) => setTradeCondition(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                >
                  <option value="Mint Condition (With Box & Bill)">Mint Condition (Box & Bill)</option>
                  <option value="Good Condition (No Scratches)">Good Condition (No Scratches)</option>
                  <option value="Average (Minor Usage Marks)">Average (Minor Usage Marks)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="est-target" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Upgrade Target Phone (Optional)
              </label>
              <input
                id="est-target"
                type="text"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                placeholder="e.g., iPhone 15 Pro Max 256GB"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 min-h-[46px] px-5 py-3 rounded-xl gold-gradient-bg text-zinc-950 font-bold text-sm hover:brightness-110 transition inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Repeat className="w-4 h-4" />
                Book Inspection Slot
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleWhatsAppQuote}
                className="min-h-[46px] px-5 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 font-semibold text-sm hover:border-amber-400 transition inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-amber-400" />
                Send via WhatsApp
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Section 4: Footer / Community Contact */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-zinc-800/80">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="space-y-1">
            <p className="font-display text-sm font-bold tracking-wider gold-gradient-text">
              A1 MOBILE · @a1_mobile_checkon
            </p>
            <p>Open 9:30 AM – 7:30 PM · Helpline +91 9612332925</p>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://www.instagram.com/a1_mobile_checkon/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-amber-300 transition"
            >
              <Instagram className="w-4 h-4" />
              Instagram
            </a>
            <a
              href="https://wa.me/919612332925"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-amber-300 transition"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
            <span>&copy; {new Date().getFullYear()} A1 MOBILE</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
