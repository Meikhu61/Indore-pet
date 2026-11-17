import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Lock,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updatePreferredBrand } from '../services/firestoreService';
import {
  BookingMetric,
  BookingType,
  BrandCategory,
  formatINR,
  InventoryItem,
  UserProfile,
} from '../types/domain';

interface AnalyticsDashboardProps {
  profiles: UserProfile[];
  metrics: BookingMetric[];
  inventory: InventoryItem[];
  loading: boolean;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type SortKey = 'recent' | 'bookings' | 'value';

const BOOKING_TYPE_META: { key: BookingType; label: string; barColor: string }[] = [
  { key: 'buy_reserve', label: 'Buy & Reserve', barColor: 'bg-amber-400' },
  { key: 'exchange_upgrade', label: 'Exchange Upgrade', barColor: 'bg-sky-400' },
  { key: 'sell_device', label: 'Sell for Cash', barColor: 'bg-emerald-400' },
  { key: 'store_visit', label: 'Walk-In Visit', barColor: 'bg-zinc-400' },
];

function formatRelativeTime(date?: Date | null): string {
  if (!date) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  profiles,
  metrics,
  inventory,
  loading,
  onNotify,
}) => {
  const { user, profile, signInWithGoogle, signingIn } = useAuth();
  const [chartMode, setChartMode] = useState<'count' | 'value'>('count');
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'admin'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [savingBrand, setSavingBrand] = useState(false);

  const summary = useMemo(() => {
    const totalUsers = profiles.length;
    const totalBookings = metrics.length;
    const activeBookings = metrics.filter(
      (m) => m.status === 'pending' || m.status === 'confirmed'
    ).length;
    const completedBookings = metrics.filter((m) => m.status === 'completed').length;
    const totalPipelineValue = metrics
      .filter((m) => m.status !== 'cancelled')
      .reduce((acc, m) => acc + (m.estimatedValue || 0), 0);
    const totalStockUnits = inventory.reduce((acc, i) => acc + i.stock, 0);
    const completionRate =
      totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;

    return {
      totalUsers,
      totalBookings,
      activeBookings,
      completedBookings,
      totalPipelineValue,
      totalStockUnits,
      completionRate,
    };
  }, [profiles, metrics, inventory]);

  // Aggregate daily activity across last 7 active booking dates (or upcoming dates)
  const timelineData = useMemo(() => {
    const dayMap = new Map<string, { date: string; count: number; value: number }>();

    // Seed last 7 calendar days so chart always has clean structure
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      dayMap.set(iso, { date: iso, count: 0, value: 0 });
    }

    for (const m of metrics) {
      const key = m.appointmentDate || (m.createdAt ? m.createdAt.toISOString().slice(0, 10) : '');
      if (!key) continue;
      const existing = dayMap.get(key) || { date: key, count: 0, value: 0 };
      existing.count += 1;
      if (m.status !== 'cancelled') {
        existing.value += m.estimatedValue || 0;
      }
      dayMap.set(key, existing);
    }

    return Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10);
  }, [metrics]);

  const maxTimelineVal = useMemo(() => {
    const vals = timelineData.map((d) => (chartMode === 'count' ? d.count : d.value));
    return Math.max(1, ...vals);
  }, [timelineData, chartMode]);

  const brandBreakdown = useMemo(() => {
    const brands: { key: BrandCategory; label: string; stock: number; demand: number }[] = [
      { key: 'iphone', label: 'Apple iPhone', stock: 0, demand: 0 },
      { key: 'samsung', label: 'Samsung Galaxy', stock: 0, demand: 0 },
      { key: 'android', label: 'OnePlus / Android', stock: 0, demand: 0 },
    ];
    for (const item of inventory) {
      const target = brands.find((b) => b.key === item.brand);
      if (target) target.stock += item.stock;
    }
    for (const m of metrics) {
      const target = brands.find((b) => b.key === m.brandCategory);
      if (target) target.demand += 1;
    }
    const maxStock = Math.max(1, ...brands.map((b) => b.stock));
    const maxDemand = Math.max(1, ...brands.map((b) => b.demand));
    return brands.map((b) => ({
      ...b,
      stockPct: Math.round((b.stock / maxStock) * 100),
      demandPct: Math.round((b.demand / maxDemand) * 100),
    }));
  }, [inventory, metrics]);

  const serviceBreakdown = useMemo(() => {
    const total = Math.max(1, metrics.length);
    return BOOKING_TYPE_META.map((meta) => {
      const count = metrics.filter((m) => m.bookingType === meta.key).length;
      const value = metrics
        .filter((m) => m.bookingType === meta.key && m.status !== 'cancelled')
        .reduce((acc, m) => acc + (m.estimatedValue || 0), 0);
      return {
        ...meta,
        count,
        value,
        pct: Math.round((count / total) * 100),
      };
    });
  }, [metrics]);

  const filteredProfiles = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = profiles.filter((p) => {
      const matchesRole = roleFilter === 'all' || p.role === roleFilter;
      const matchesSearch =
        !q ||
        p.displayName.toLowerCase().includes(q) ||
        p.preferredBrand.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });

    return list.sort((a, b) => {
      if (sortBy === 'bookings') return b.totalBookings - a.totalBookings;
      if (sortBy === 'value') return b.totalProjectedValue - a.totalProjectedValue;
      return (b.lastActiveAt?.getTime() || 0) - (a.lastActiveAt?.getTime() || 0);
    });
  }, [profiles, userSearch, roleFilter, sortBy]);

  const handlePreferredBrandChange = async (brand: BrandCategory | 'all') => {
    if (!user) return;
    setSavingBrand(true);
    try {
      await updatePreferredBrand(user.uid, brand);
      onNotify('success', 'Your brand preference updated in real-time analytics.');
    } catch (err) {
      console.error(err);
      onNotify('error', 'Failed to update brand preference.');
    } finally {
      setSavingBrand(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-8 sm:p-12 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="font-display text-3xl font-bold text-white">
              Real-Time Analytics Dashboard
            </h1>
            <p className="text-sm text-zinc-400">
              Sign in with Google to view live telemetry across all registered users, booking velocity, brand demand, and store inventory metrics.
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Live Firestore Telemetry · All Registered Users
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1">
            Store & User Analytics
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="pref-brand" className="text-xs text-zinc-400 whitespace-nowrap">
            My Preferred Brand:
          </label>
          <select
            id="pref-brand"
            disabled={savingBrand}
            value={profile?.preferredBrand || 'all'}
            onChange={(e) => void handlePreferredBrandChange(e.target.value as BrandCategory | 'all')}
            className="min-h-[38px] px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
          >
            <option value="all">All Brands</option>
            <option value="iphone">Apple iPhone</option>
            <option value="samsung">Samsung Galaxy</option>
            <option value="android">OnePlus / Android</option>
          </select>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Registered Users</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {summary.totalUsers}
          </p>
          <p className="text-xs text-zinc-500">Live directory accounts</p>
        </div>

        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Total Bookings</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {summary.totalBookings}
          </p>
          <p className="text-xs text-zinc-500 tabular-nums">
            {summary.activeBookings} active · {summary.completionRate}% completed
          </p>
        </div>

        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Projected Trade Volume</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-amber-300 tabular-nums">
            {formatINR(summary.totalPipelineValue)}
          </p>
          <p className="text-xs text-zinc-500">Non-cancelled bookings</p>
        </div>

        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Inventory Units</span>
            <BarChart3 className="w-4 h-4 text-amber-400" />
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {summary.totalStockUnits}
          </p>
          <p className="text-xs text-zinc-500 tabular-nums">{inventory.length} active SKUs</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Daily Activity Bar Chart */}
        <section className="lg:col-span-7 rounded-2xl bg-[#121216] border border-zinc-800 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Booking Velocity by Date
              </h2>
              <p className="text-xs text-zinc-400">
                Real-time distribution across scheduled and recent appointment dates
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-lg">
              <button
                type="button"
                onClick={() => setChartMode('count')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                  chartMode === 'count' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Bookings
              </button>
              <button
                type="button"
                onClick={() => setChartMode('value')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                  chartMode === 'value' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Volume (INR)
              </button>
            </div>
          </div>

          <div className="h-56 flex items-end gap-2 sm:gap-3 pt-6 pb-2 border-b border-zinc-800/80">
            {timelineData.map((day) => {
              const rawVal = chartMode === 'count' ? day.count : day.value;
              const heightPct = Math.max(6, Math.round((rawVal / maxTimelineVal) * 100));
              const isHovered = hoveredDay === day.date;
              const labelShort = day.date.slice(5);

              return (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoveredDay(day.date)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative"
                >
                  {isHovered && (
                    <div className="absolute -top-2 z-10 px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-[11px] font-mono tabular-nums text-zinc-100 whitespace-nowrap shadow-lg">
                      {day.date}: {chartMode === 'count' ? `${day.count} bk` : formatINR(day.value)}
                    </div>
                  )}
                  <div className="w-full flex items-end justify-center h-40">
                    <div
                      style={{ height: `${rawVal === 0 ? 4 : heightPct}%` }}
                      className={`w-full max-w-[36px] rounded-t-md transition-all duration-200 ${
                        rawVal === 0
                          ? 'bg-zinc-800/60'
                          : isHovered
                          ? 'bg-amber-300'
                          : 'bg-amber-400/80'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-zinc-500 mt-2">
                    {labelShort}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: Brand Supply vs Demand + Service Mix */}
        <section className="lg:col-span-5 rounded-2xl bg-[#121216] border border-zinc-800 p-6 space-y-6">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Brand Stock vs. Demand
            </h2>
            <p className="text-xs text-zinc-400">
              Live inventory units compared with customer booking requests
            </p>
          </div>

          <div className="space-y-4">
            {brandBreakdown.map((b) => (
              <div key={b.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-200">{b.label}</span>
                  <span className="font-mono tabular-nums text-zinc-400">
                    {b.stock} stock · {b.demand} bookings
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(4, b.stockPct)}%` }}
                      className="h-full bg-amber-400 rounded-full transition-all"
                    />
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(4, b.demandPct)}%` }}
                      className="h-full bg-sky-400 rounded-full transition-all"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Service Mix
            </h3>
            <div className="space-y-2.5">
              {serviceBreakdown.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-sm ${s.barColor}`} />
                    <span className="text-zinc-200">{s.label}</span>
                  </div>
                  <span className="font-mono tabular-nums text-zinc-400">
                    {s.count} ({s.pct}%) · {formatINR(s.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Registered Users Live Table */}
      <section className="rounded-2xl bg-[#121216] border border-zinc-800 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Registered Users Live Analytics
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Real-time activity and booking volume across all {profiles.length} registered accounts (PII isolated)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user name..."
                aria-label="Search registered users"
                className="min-h-[38px] w-48 pl-9 pr-3 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'customer' | 'admin')}
              className="min-h-[38px] px-3 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="customer">Customers</option>
              <option value="admin">Admins</option>
            </select>

            <select
              aria-label="Sort users"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="min-h-[38px] px-3 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
            >
              <option value="recent">Sort: Last Active</option>
              <option value="bookings">Sort: Most Bookings</option>
              <option value="value">Sort: Highest Volume</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-12 rounded-lg bg-zinc-900/70 animate-pulse" />
            ))}
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-400">
            No registered users match your current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400 bg-zinc-950/60">
                  <th className="py-3 px-5 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Preferred Brand</th>
                  <th className="py-3 px-4 font-semibold text-right">Bookings</th>
                  <th className="py-3 px-4 font-semibold text-right">Completed</th>
                  <th className="py-3 px-4 font-semibold text-right">Trade-Ins</th>
                  <th className="py-3 px-4 font-semibold text-right">Projected Value</th>
                  <th className="py-3 px-5 font-semibold text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 text-xs">
                {filteredProfiles.map((p) => {
                  const isSelf = p.uid === user.uid;
                  return (
                    <tr
                      key={p.uid}
                      className={`hover:bg-zinc-900/50 transition-colors ${
                        isSelf ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-mono text-[11px] font-bold text-amber-300 shrink-0">
                            {p.avatarInitials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-100 truncate">
                              {p.displayName} {isSelf && <span className="text-amber-400">(You)</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300 capitalize">{p.role}</td>
                      <td className="py-3.5 px-4 text-zinc-400 capitalize">
                        {p.preferredBrand === 'all' ? 'All Brands' : p.preferredBrand}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-zinc-100">
                        {p.totalBookings}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-400">
                        {p.completedBookings}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sky-400">
                        {p.tradeInCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-amber-300 font-semibold">
                        {formatINR(p.totalProjectedValue)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono tabular-nums text-zinc-400">
                        {formatRelativeTime(p.lastActiveAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
