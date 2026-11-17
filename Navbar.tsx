import React, { useState } from 'react';
import { Menu, X, LogOut, UserCheck, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type AppView = 'storefront' | 'bookings' | 'analytics' | 'inventory';

interface NavbarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  pendingBookingsCount: number;
}

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: 'storefront', label: 'Storefront' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'inventory', label: 'Inventory' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onNavigate,
  pendingBookingsCount,
}) => {
  const { user, profile, isAdmin, signingIn, signInWithGoogle, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (view: AppView) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/92 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('storefront')}
          className="font-display text-2xl font-bold tracking-wider gold-gradient-text whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm"
        >
          A1 MOBILE
        </button>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm ${
                  isActive
                    ? 'text-amber-300 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <span>{item.label}</span>
                {item.id === 'bookings' && pendingBookingsCount > 0 && (
                  <span className="ml-1.5 font-mono text-xs tabular-nums text-amber-400">
                    ({pendingBookingsCount})
                  </span>
                )}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-amber-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-300 whitespace-nowrap">
                {isAdmin ? (
                  <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="max-w-[140px] truncate font-medium text-zinc-100">
                  {profile?.displayName || user.displayName || 'Account'}
                </span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="text-zinc-400">{isAdmin ? 'Admin' : 'Member'}</span>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs font-semibold hover:border-amber-400/70 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={signingIn}
              onClick={() => void signInWithGoogle()}
              className="inline-flex items-center justify-center px-4 py-2 min-h-[40px] rounded-lg gold-gradient-bg text-zinc-950 text-xs font-bold hover:brightness-110 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {signingIn ? 'Signing In...' : 'Sign In'}
            </button>
          )}

          <button
            type="button"
            aria-label="Toggle Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 hover:text-amber-300 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between min-h-[44px] px-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-amber-300 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-900/60'
                }`}
              >
                <span>{item.label}</span>
                {item.id === 'bookings' && pendingBookingsCount > 0 && (
                  <span className="font-mono text-xs tabular-nums text-amber-400">
                    {pendingBookingsCount}
                  </span>
                )}
              </button>
            );
          })}
          {user && (
            <div className="pt-2 mt-2 border-t border-zinc-800/80 px-3 py-2 text-xs text-zinc-400 flex items-center justify-between">
              <span className="truncate">{profile?.displayName || user.displayName}</span>
              <span className="text-amber-300 font-medium">{isAdmin ? 'Admin' : 'Member'}</span>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
