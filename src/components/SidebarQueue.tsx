import { User } from 'firebase/auth';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  CloudUpload,
  LogIn,
  LogOut,
} from 'lucide-react';
import { BdrisFormData, SavedApplication, computeSectionStats } from '../types/bdris';

interface SidebarQueueProps {
  user: User | null;
  authLoading: boolean;
  isSyncing: boolean;
  formData: BdrisFormData;
  savedApps: SavedApplication[];
  activeId: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onNewApplication: () => void;
  onSaveAndPush: () => void;
  onSaveDraftOnly: () => void;
  onLoadApplication: (app: SavedApplication) => void;
  onDeleteApplication: (id: string) => void;
}

export function SidebarQueue({
  user,
  authLoading,
  isSyncing,
  formData,
  savedApps,
  activeId,
  onSignIn,
  onSignOut,
  onNewApplication,
  onSaveAndPush,
  onSaveDraftOnly,
  onLoadApplication,
  onDeleteApplication,
}: SidebarQueueProps) {
  const stats = computeSectionStats(formData);
  const progressPct = Math.round((stats.totalFilled / stats.totalFields) * 100);

  const sections = [
    { label: 'ব্যক্তিগত তথ্য', count: stats.personal },
    { label: 'ঠিকানার বিবরণ', count: stats.address },
    { label: 'পিতার তথ্য', count: stats.father },
    { label: 'মাতার তথ্য', count: stats.mother },
  ];

  return (
    <aside className="w-full lg:w-[272px] shrink-0 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
      {/* 1. Primary Action & Progress */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">আবেদন প্রস্তুতি</h2>
          <span className="text-xs font-mono tabular-nums font-medium text-emerald-700">
            {progressPct}%
          </span>
        </div>

        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-700 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <ul className="space-y-2 text-xs">
          {sections.map((sec) => {
            const done = sec.count.filled === sec.count.total;
            return (
              <li key={sec.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-slate-700 truncate">
                  {done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{sec.label}</span>
                </span>
                <span className="font-mono tabular-nums text-slate-500 shrink-0">
                  {sec.count.filled}/{sec.count.total}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="pt-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSaveAndPush}
            disabled={isSyncing}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <CloudUpload className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isSyncing ? 'পাঠানো হচ্ছে...' : 'সার্ভারে সেভ ও পাঠান'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onSaveDraftOnly}
              disabled={isSyncing}
              className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              ড্রাফট সেভ
            </button>
            <button
              type="button"
              onClick={onNewApplication}
              className="inline-flex items-center justify-center gap-1 py-2 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>নতুন ফরম</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Saved Applications Quick Switcher */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-900">
            সংরক্ষিত তালিকা ({savedApps.length})
          </h2>
        </div>

        {savedApps.length === 0 ? (
          <p className="text-xs text-slate-500 leading-relaxed">
            এখনো কোনো আবেদন সেভ করা হয়নি।
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {savedApps.map((app) => {
              const isSelected = app.id === activeId;
              const title = app.data.nameBn || app.data.nameEn || 'নামহীন আবেদন';
              const idSummary = app.bdrisTrackingId || app.data.fatherNid || app.data.dob || '—';
              return (
                <li
                  key={app.id}
                  className={`py-2 flex items-center justify-between gap-2 ${
                    isSelected ? 'text-emerald-800' : 'text-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onLoadApplication(app)}
                    className="flex-1 text-left min-w-0 cursor-pointer hover:text-emerald-700 transition-colors"
                  >
                    <div className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                      {title}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums truncate">
                      {idSummary}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteApplication(app.id)}
                    aria-label={`${title} মুছুন`}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 3. Account Footer */}
      <div className="p-5">
        {authLoading ? (
          <p className="text-xs text-slate-500">অ্যাকাউন্ট যাচাই হচ্ছে...</p>
        ) : user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {user.displayName || 'অপারেটর'}
              </div>
              <div className="text-[11px] text-emerald-700 truncate">ক্লাউড ডাটাবেজ সংযুক্ত</div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-red-600 border border-slate-200 rounded-md cursor-pointer shrink-0 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>লগআউট</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
            <span>স্থায়ী সেভের জন্য Google লগইন</span>
          </button>
        )}
      </div>
    </aside>
  );
}
