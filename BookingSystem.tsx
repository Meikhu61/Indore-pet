import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  MessageCircle,
  Search,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  cancelOwnBooking,
  createBooking,
  updateBookingStatusAdmin,
} from '../services/firestoreService';
import {
  BookingRecord,
  BookingStatus,
  BookingType,
  BrandCategory,
  formatINR,
  InventoryItem,
  STORE_TIME_SLOTS,
} from '../types/domain';

export interface BookingPrefill {
  bookingType: BookingType;
  deviceId?: string;
  deviceTitle?: string;
  brandCategory?: BrandCategory | 'general';
  tradeInDevice?: string;
  estimatedValue?: number;
}

interface BookingSystemProps {
  inventory: InventoryItem[];
  bookings: BookingRecord[];
  loadingBookings: boolean;
  prefill: BookingPrefill | null;
  onClearPrefill: () => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  buy_reserve: 'Buy & Reserve Device',
  exchange_upgrade: 'Exchange & Upgrade',
  sell_device: 'Sell Device for Cash',
  store_visit: 'Walk-In Store Visit',
};

const STATUS_DISPLAY: Record<BookingStatus, { label: string; textClass: string }> = {
  pending: { label: 'Pending Review', textClass: 'text-amber-300' },
  confirmed: { label: 'Confirmed Slot', textClass: 'text-sky-400' },
  completed: { label: 'Completed', textClass: 'text-emerald-400' },
  cancelled: { label: 'Cancelled', textClass: 'text-zinc-500' },
};

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const BookingSystem: React.FC<BookingSystemProps> = ({
  inventory,
  bookings,
  loadingBookings,
  prefill,
  onClearPrefill,
  onNotify,
}) => {
  const { user, profile, privateInfo, isAdmin, signInWithGoogle, signingIn, refreshPrivateInfo } =
    useAuth();

  const [bookingType, setBookingType] = useState<BookingType>('buy_reserve');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [customDeviceTitle, setCustomDeviceTitle] = useState<string>('');
  const [tradeInDevice, setTradeInDevice] = useState<string>('');
  const [estimatedValue, setEstimatedValue] = useState<string>('0');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>(getTodayDateString());
  const [timeSlot, setTimeSlot] = useState<string>(STORE_TIME_SLOTS[1]);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Queue filters
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.displayName && !customerName) {
      setCustomerName(profile.displayName);
    }
    if (privateInfo?.phone && !customerPhone) {
      setCustomerPhone(privateInfo.phone);
    }
  }, [profile, privateInfo, customerName, customerPhone]);

  useEffect(() => {
    if (!prefill) return;
    setBookingType(prefill.bookingType);
    if (prefill.deviceId) {
      setSelectedDeviceId(prefill.deviceId);
    }
    if (prefill.deviceTitle) {
      setCustomDeviceTitle(prefill.deviceTitle);
    }
    if (prefill.tradeInDevice !== undefined) {
      setTradeInDevice(prefill.tradeInDevice);
    }
    if (prefill.estimatedValue !== undefined) {
      setEstimatedValue(String(prefill.estimatedValue));
    }
    onClearPrefill();
  }, [prefill, onClearPrefill]);

  const selectedInventoryItem = useMemo(
    () => inventory.find((item) => item.id === selectedDeviceId) || null,
    [inventory, selectedDeviceId]
  );

  const handleSelectDevice = (id: string) => {
    setSelectedDeviceId(id);
    const found = inventory.find((i) => i.id === id);
    if (found) {
      setCustomDeviceTitle(`${found.name} (${found.storage})`);
      setEstimatedValue(String(found.price));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!user) {
      onNotify('info', 'Please sign in with Google to submit a booking.');
      return;
    }

    const cleanName = (customerName.trim() || profile?.displayName || '').trim();
    if (cleanName.length < 2) {
      onNotify('error', 'Please enter your name (at least 2 characters).');
      return;
    }

    const cleanPhone = customerPhone.trim();
    if (cleanPhone.length < 7) {
      onNotify('error', 'Please enter a valid 7–15 digit phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const deviceTitle =
        selectedInventoryItem
          ? `${selectedInventoryItem.name} (${selectedInventoryItem.storage})`
          : customDeviceTitle.trim() || BOOKING_TYPE_LABELS[bookingType];

      const brandCategory: BrandCategory | 'general' = selectedInventoryItem
        ? selectedInventoryItem.brand
        : prefill?.brandCategory || 'general';

      await createBooking({
        userId: user.uid,
        customerName: cleanName,
        customerEmail: user.email || undefined,
        customerPhone: cleanPhone,
        bookingType,
        deviceId: selectedInventoryItem ? selectedInventoryItem.id : '',
        deviceTitle,
        brandCategory,
        tradeInDevice: tradeInDevice.trim(),
        estimatedValue: Number(estimatedValue) || 0,
        appointmentDate,
        timeSlot,
        notes: notes.trim(),
        isAdminUser: isAdmin,
      });

      await refreshPrivateInfo();
      setNotes('');
      onNotify('success', 'Booking confirmed in your queue. We look forward to seeing you!');
    } catch (err) {
      console.error('Booking creation error:', err);
      let detail = 'Could not create booking. Check your fields and try again.';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string; path?: string };
          if (parsed?.error) {
            detail = `Booking error (${parsed.path || 'firestore'}): ${parsed.error}`;
          }
        } catch {
          if (err.message) detail = err.message;
        }
      }
      onNotify('error', detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (booking: BookingRecord, nextStatus: BookingStatus) => {
    setUpdatingId(booking.id);
    try {
      if (isAdmin) {
        await updateBookingStatusAdmin(booking, nextStatus);
      } else if (nextStatus === 'cancelled') {
        await cancelOwnBooking(booking);
      }
      onNotify('success', `Booking marked as ${STATUS_DISPLAY[nextStatus].label}.`);
    } catch (err) {
      console.error(err);
      onNotify('error', 'Unable to update booking status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredBookings = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return bookings.filter((b) => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesSearch =
        !q ||
        b.deviceTitle.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.tradeInDevice.toLowerCase().includes(q) ||
        b.appointmentDate.includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [bookings, statusFilter, searchText]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-8 sm:p-12 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="font-display text-3xl font-bold text-white">
              Sign In to Book & Track Appointments
            </h1>
            <p className="text-sm text-zinc-400">
              Reserve in-stock iPhones and Galaxy flagships, book sell/exchange inspections, and track live appointment status in your account.
            </p>
          </div>
          <button
            type="button"
            disabled={signingIn}
            onClick={() => void signInWithGoogle()}
            className="inline-flex items-center justify-center px-6 py-3 min-h-[46px] rounded-xl gold-gradient-bg text-zinc-950 font-bold text-sm hover:brightness-110 transition cursor-pointer disabled:opacity-60"
          >
            {signingIn ? 'Signing In...' : 'Sign In With Google'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Store Appointments · 9:30 AM – 7:30 PM
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1">
            Reservations & Trade-In Bookings
          </h1>
        </div>
        <div className="text-xs text-zinc-400 font-mono tabular-nums">
          {isAdmin ? 'Admin Queue Mode · All Customers' : `Customer Account · ${bookings.length} Bookings`}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left: Booking Form */}
        <section className="lg:col-span-5 rounded-2xl bg-[#121216] border border-zinc-800 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">Create New Booking</h2>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="bk-type" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Booking Type
              </label>
              <select
                id="bk-type"
                value={bookingType}
                onChange={(e) => setBookingType(e.target.value as BookingType)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
              >
                <option value="buy_reserve">Buy & Reserve Device</option>
                <option value="exchange_upgrade">Exchange & Upgrade</option>
                <option value="sell_device">Sell Device for Instant Cash</option>
                <option value="store_visit">General Walk-In Visit</option>
              </select>
            </div>

            {(bookingType === 'buy_reserve' || bookingType === 'exchange_upgrade') && (
              <div>
                <label htmlFor="bk-device" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Select Store Device (Live Inventory)
                </label>
                <select
                  id="bk-device"
                  value={selectedDeviceId}
                  onChange={(e) => handleSelectDevice(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                >
                  <option value="">Custom / Choose In Store</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id} disabled={item.stock === 0}>
                      {item.name} ({item.storage}) — {formatINR(item.price)} [{item.stock} left]
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="bk-title" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Device / Request Title
              </label>
              <input
                id="bk-title"
                type="text"
                value={customDeviceTitle}
                onChange={(e) => setCustomDeviceTitle(e.target.value)}
                placeholder="e.g., iPhone 15 Pro Max (256GB)"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {(bookingType === 'sell_device' || bookingType === 'exchange_upgrade') && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bk-tradein" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Your Trade-In Phone
                  </label>
                  <input
                    id="bk-tradein"
                    type="text"
                    value={tradeInDevice}
                    onChange={(e) => setTradeInDevice(e.target.value)}
                    placeholder="e.g., iPhone 13 128GB Mint"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="bk-val" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Expected Value (INR)
                  </label>
                  <input
                    id="bk-val"
                    type="number"
                    min={0}
                    max={10000000}
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm font-mono tabular-nums text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="bk-name" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Customer Name *
                </label>
                <input
                  id="bk-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full name"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="bk-phone" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Phone Number *
                </label>
                <input
                  id="bk-phone"
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm font-mono tabular-nums text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="bk-date" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Appointment Date *
                </label>
                <input
                  id="bk-date"
                  type="date"
                  required
                  min={getTodayDateString()}
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm font-mono tabular-nums text-zinc-100 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="bk-slot" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Preferred Slot
                </label>
                <select
                  id="bk-slot"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                >
                  {STORE_TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="bk-notes" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Notes (Optional)
              </label>
              <textarea
                id="bk-notes"
                rows={2}
                maxLength={400}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Color preference, battery health questions, or accessory requests..."
                className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] rounded-xl gold-gradient-bg text-zinc-950 font-bold text-sm hover:brightness-110 transition cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Confirming Booking...' : 'Confirm Booking Slot'}
            </button>
          </form>
        </section>

        {/* Right: Real-Time Bookings Queue */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by device, date, or customer..."
                aria-label="Search bookings"
                className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-[#121216] border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#121216] border border-zinc-800 rounded-xl overflow-x-auto no-scrollbar">
              {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold capitalize whitespace-nowrap shrink-0 transition cursor-pointer ${
                    statusFilter === st
                      ? 'bg-amber-400 text-zinc-950'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {loadingBookings ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-32 rounded-2xl bg-[#121216] border border-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-10 text-center space-y-2">
              <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-base font-semibold text-zinc-200">No bookings match this view</p>
              <p className="text-sm text-zinc-400">
                Submit the booking form on the left to reserve a device or schedule a store visit.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => {
                const statusInfo = STATUS_DISPLAY[booking.status];
                const canCustomerCancel =
                  booking.userId === user.uid &&
                  (booking.status === 'pending' || booking.status === 'confirmed');
                const isUpdating = updatingId === booking.id;

                return (
                  <div
                    key={booking.id}
                    className="rounded-2xl bg-[#121216] border border-zinc-800 p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span>{BOOKING_TYPE_LABELS[booking.bookingType]}</span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-semibold ${statusInfo.textClass}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-bold text-white truncate">
                          {booking.deviceTitle || 'Store Appointment'}
                        </h3>
                      </div>

                      {booking.estimatedValue > 0 && (
                        <span className="font-mono text-sm font-semibold text-amber-300 tabular-nums shrink-0">
                          {formatINR(booking.estimatedValue)}
                        </span>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-3 gap-2 text-xs text-zinc-300 pt-2 border-t border-zinc-800/70">
                      <div>
                        <span className="text-zinc-500 block">Schedule</span>
                        <span className="font-mono tabular-nums">
                          {booking.appointmentDate} · {booking.timeSlot}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Contact</span>
                        <span className="font-mono tabular-nums">
                          {booking.customerName} · {booking.customerPhone}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Trade-In Device</span>
                        <span className="truncate block">
                          {booking.tradeInDevice || 'None'}
                        </span>
                      </div>
                    </div>

                    {booking.notes && (
                      <p className="text-xs text-zinc-400 bg-zinc-950/70 rounded-lg px-3 py-2 border border-zinc-800/70">
                        {booking.notes}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <a
                        href={`https://wa.me/919612332925?text=${encodeURIComponent(
                          `Booking Ref: ${booking.id}\nName: ${booking.customerName}\nRequest: ${BOOKING_TYPE_LABELS[booking.bookingType]}\nDevice: ${booking.deviceTitle}\nDate: ${booking.appointmentDate} (${booking.timeSlot})`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:underline min-h-[36px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Confirm on WhatsApp
                      </a>

                      <div className="flex items-center gap-2">
                        {isAdmin && booking.status === 'pending' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => void handleStatusUpdate(booking, 'confirmed')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-semibold hover:bg-sky-500/25 transition cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirm
                          </button>
                        )}
                        {isAdmin &&
                          (booking.status === 'pending' || booking.status === 'confirmed') && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => void handleStatusUpdate(booking, 'completed')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 transition cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Complete
                            </button>
                          )}
                        {(canCustomerCancel ||
                          (isAdmin && booking.status !== 'cancelled' && booking.status !== 'completed')) && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => void handleStatusUpdate(booking, 'cancelled')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-semibold hover:border-red-400 hover:text-red-300 transition cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
