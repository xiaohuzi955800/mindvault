/**
 * Shared page chrome for all five variants: the brand header (with the
 * on-device status pill, the mock/demo banner, and the Firebase init-error
 * banner) and the footer. Variants differ in navigation, so the header
 * takes its tabs (or a custom nav node) as props.
 */
import type { ReactNode } from 'react';
import type { DeviceAvailability } from '../lib/ai/types';

export function VaultMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-9 w-9 shrink-0"
      viewBox="0 0 48 48"
      fill="none"
    >
      <rect width="48" height="48" rx="12" fill="#0f766e" />
      <circle cx="24" cy="24" r="12" stroke="#ffffff" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="4" fill="#ffffff" />
      <path
        d="M24 12v6M24 30v6M12 24h6M30 24h6M15.5 15.5l4.2 4.2M28.3 28.3l4.2 4.2M32.5 15.5l-4.2 4.2M19.7 28.3l-4.2 4.2"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface AppHeaderProps {
  providerKind: 'mock' | 'firebase';
  providerInitError: string | null;
  deviceAvailability: DeviceAvailability;
  /** Optional tab navigation (V1/V2/V4/V5). V3 uses a drawer instead. */
  tabs?: Array<{ id: string; label: string }>;
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Leading action (e.g. V3's hamburger) and trailing action slot. */
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Where the status pill navigates (defaults to no-op). */
  onStatusClick?: () => void;
}

export function AppHeader({
  providerKind,
  providerInitError,
  deviceAvailability,
  tabs,
  activeTab,
  onTabChange,
  leading,
  trailing,
  onStatusClick,
}: AppHeaderProps) {
  const statusPill = (() => {
    switch (deviceAvailability) {
      case 'available':
        return { text: 'On-device AI ready', className: 'bg-teal-700 text-white' };
      case 'downloading':
        return { text: 'Downloading on-device AI…', className: 'bg-teal-100 text-teal-900' };
      case 'downloadable':
        return { text: 'On-device AI setup needed', className: 'bg-amber-100 text-amber-900' };
      case 'unavailable':
        return { text: 'On-device AI unavailable', className: 'bg-stone-200 text-stone-700' };
      default:
        return { text: 'Checking on-device AI…', className: 'bg-stone-200 text-stone-700' };
    }
  })();
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        {leading}
        <div className="flex items-center gap-3">
          <VaultMark />
          <div>
            <h1 className="font-serif text-xl leading-none font-bold text-stone-900">
              MindVault
            </h1>
            <p className="mt-0.5 hidden text-xs text-stone-500 sm:block">
              Private notes. Verifiable privacy.
            </p>
          </div>
        </div>

        {tabs && onTabChange && (
          <nav aria-label="Views" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto sm:flex-1 sm:justify-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {trailing}

        <button
          type="button"
          onClick={onStatusClick}
          title="See on-device AI status"
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusPill.className}`}
        >
          {statusPill.text}
        </button>
      </div>

      {providerKind === 'mock' && (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
          Demo build — AI results are simulated locally on this device;
          no content ever leaves the browser in this build.
        </p>
      )}

      {providerInitError && (
        <p
          role="alert"
          className="border-t border-red-200 bg-red-50 px-4 py-1.5 text-center text-xs text-red-900"
        >
          Firebase AI could not start ({providerInitError}). Your notes
          still work fully, and AI is running in demo mode.
        </p>
      )}
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-stone-200 px-4 py-4 text-center text-xs text-stone-400">
      MindVault stores every note in this browser’s IndexedDB. Nothing
      leaves this device unless you explicitly approve it. Built for
      #BuildHybridAI 2026 with Firebase AI Logic.
    </footer>
  );
}
