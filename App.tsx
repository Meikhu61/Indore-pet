import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, MessageCircle, Phone, X, AlertCircle } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppView, Navbar } from './components/Navbar';
import { StorefrontView } from './components/StorefrontView';
import { BookingPrefill, BookingSystem } from './components/BookingSystem';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { InventoryManager } from './components/InventoryManager';
import {
  seedDefaultInventory,
  subscribeBookingMetrics,
  subscribeBookings,
  subscribeInventory,
  subscribeUserProfiles,
} from './services/firestoreService';
import {
  BookingMetric,
  BookingRecord,
  DEFAULT_CATALOG,
  InventoryItem,
  ToastNotice,
  UserProfile,
} from './types/domain';

const AppContent: React.FC = () => {
  const { user, isAdmin, isBootstrapAdmin, authReady, authError } = useAuth();
  const [activeView, setActiveView] = useState<AppView>('storefront');

  const [inventoryDocs, setInventoryDocs] = useState<InventoryItem[]>([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [bookingMetrics, setBookingMetrics] = useState<BookingMetric[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const seededRef = useRef(false);

  const notify = useCallback((type: ToastNotice['type'], message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  useEffect(() => {
    if (authError) {
      notify('error', authError);
    }
  }, [authError, notify]);

  // Live Inventory Subscription (Public + Admin)
  useEffect(() => {
    if (!authReady) return;
    const unsub = subscribeInventory(
      isBootstrapAdmin,
      (items) => {
        setInventoryDocs(items);
        setInventoryLoaded(true);
      },
      () => {
        setInventoryLoaded(true);
      }
    );
    return () => unsub();
  }, [authReady, isBootstrapAdmin]);

  // Auto-seed initial catalog into Firestore once when an Admin logs in and inventory is empty
  useEffect(() => {
    if (
      authReady &&
      user &&
      isAdmin &&
      inventoryLoaded &&
      inventoryDocs.length === 0 &&
      !seededRef.current
    ) {
      seededRef.current = true;
      void seedDefaultInventory(user.uid).catch((err) => {
        console.error('Auto-seed skipped:', err);
      });
    }
  }, [authReady, user, isAdmin, inventoryLoaded, inventoryDocs.length]);

  // Authenticated Real-Time Subscriptions (User Profiles, Booking Metrics, Bookings)
  useEffect(() => {
    if (!authReady || !user) {
      setProfiles([]);
      setBookingMetrics([]);
      setBookings([]);
      setLoadingDashboard(false);
      return;
    }

    setLoadingDashboard(true);
    let profilesDone = false;
    let metricsDone = false;
    let bookingsDone = false;

    const markReady = () => {
      if (profilesDone && metricsDone && bookingsDone) {
        setLoadingDashboard(false);
      }
    };

    const unsubProfiles = subscribeUserProfiles(
      (data) => {
        setProfiles(data);
        profilesDone = true;
        markReady();
      },
      () => {
        profilesDone = true;
        markReady();
      }
    );

    const unsubMetrics = subscribeBookingMetrics(
      (data) => {
        setBookingMetrics(data);
        metricsDone = true;
        markReady();
      },
      () => {
        metricsDone = true;
        markReady();
      }
    );

    const unsubBookings = subscribeBookings(
      user.uid,
      isBootstrapAdmin,
      (data) => {
        setBookings(data);
        bookingsDone = true;
        markReady();
      },
      () => {
        bookingsDone = true;
        markReady();
      }
    );

    return () => {
      unsubProfiles();
      unsubMetrics();
      unsubBookings();
    };
  }, [authReady, user, isBootstrapAdmin]);

  // Show live Firestore items when available, or curated catalog preview prior to initial admin seed
  const displayedInventory = useMemo<InventoryItem[]>(() => {
    if (inventoryDocs.length > 0) return inventoryDocs;
    return DEFAULT_CATALOG.map((item) => ({ ...item, createdAt: null, updatedAt: null }));
  }, [inventoryDocs]);

  const pendingBookingsCount = useMemo(
    () => bookings.filter((b) => b.status === 'pending' || b.status === 'confirmed').length,
    [bookings]
  );

  const handleBookDevice = useCallback((item: InventoryItem) => {
    setBookingPrefill({
      bookingType: 'buy_reserve',
      deviceId: item.id,
      deviceTitle: `${item.name} (${item.storage})`,
      brandCategory: item.brand,
      estimatedValue: item.price,
    });
    setActiveView('bookings');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleStartExchange = useCallback(
    (prefill: {
      bookingType: 'sell_device' | 'exchange_upgrade';
      tradeInDevice: string;
      deviceTitle: string;
      brandCategory: 'iphone' | 'samsung' | 'android' | 'general';
      estimatedValue: number;
    }) => {
      setBookingPrefill(prefill);
      setActiveView('bookings');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col pb-16 md:pb-0">
      <Navbar
        activeView={activeView}
        onNavigate={(v) => {
          setActiveView(v);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        pendingBookingsCount={pendingBookingsCount}
      />

      <main className="flex-1">
        {activeView === 'storefront' && (
          <StorefrontView
            inventory={displayedInventory}
            onBookDevice={handleBookDevice}
            onStartExchange={handleStartExchange}
            onOpenBookings={() => {
              setActiveView('bookings');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeView === 'bookings' && (
          <BookingSystem
            inventory={displayedInventory}
            bookings={bookings}
            loadingBookings={loadingDashboard}
            prefill={bookingPrefill}
            onClearPrefill={() => setBookingPrefill(null)}
            onNotify={notify}
          />
        )}

        {activeView === 'analytics' && (
          <AnalyticsDashboard
            profiles={profiles}
            metrics={bookingMetrics}
            inventory={displayedInventory}
            loading={loadingDashboard}
            onNotify={notify}
          />
        )}

        {activeView === 'inventory' && (
          <InventoryManager
            inventory={displayedInventory}
            loading={!inventoryLoaded}
            isLiveSynced={inventoryDocs.length > 0}
            onBookDevice={handleBookDevice}
            onNotify={notify}
          />
        )}
      </main>

      {/* Mobile Compact Sticky Bar (<= 15% viewport cap) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 px-3 py-2">
        <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto">
          <a
            href="tel:9612332925"
            className="flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg bg-zinc-900 border border-zinc-700 text-white font-semibold text-xs"
          >
            <Phone className="w-3.5 h-3.5 text-amber-400" />
            Call 9612332925
          </a>
          <a
            href="https://wa.me/919612332925?text=Hi%20A1%20MOBILE!"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg gold-gradient-bg text-zinc-950 font-bold text-xs"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp Store
          </a>
        </div>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-16 md:bottom-6 right-4 z-50 space-y-2 max-w-sm w-[calc(100%-2rem)]">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-4 py-3 text-xs font-medium shadow-xl flex items-center justify-between gap-3 bg-zinc-900 ${
                t.type === 'error'
                  ? 'border-red-500/50 text-red-200'
                  : t.type === 'success'
                  ? 'border-emerald-500/50 text-emerald-200'
                  : 'border-amber-500/50 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {t.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                ) : t.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>{t.message}</span>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
