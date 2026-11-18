import { ExternalLink } from 'lucide-react';

export type WorkspaceTab = 'form' | 'autofill' | 'saved' | 'guide';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
}

const NAV_ITEMS: { id: WorkspaceTab; label: string }[] = [
  { id: 'form', label: 'আবেদন ফরম' },
  { id: 'autofill', label: 'এক্সটেনশন ও সিঙ্ক' },
  { id: 'saved', label: 'সংরক্ষিত তালিকা' },
  { id: 'guide', label: 'নির্দেশিকা' },
];

export function TopBar({ activeTab, onSelectTab }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('form')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          BDRIS SmartForm
        </button>

        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                  isActive
                    ? 'border-emerald-700 text-emerald-800 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <a
            href="https://bdris.gov.bd/br/application"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>bdris.gov.bd খুলুন</span>
            <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </div>

      <nav
        aria-label="Mobile Navigation"
        className="md:hidden flex items-center gap-5 px-4 pb-2 overflow-x-auto border-t border-slate-100 text-xs font-medium"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`pt-2 pb-1 border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'border-emerald-700 text-emerald-800 font-semibold'
                  : 'border-transparent text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
