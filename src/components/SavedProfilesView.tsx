import { useState } from 'react';
import { User } from 'firebase/auth';
import { Plus, Search, Trash2, CloudUpload, LogIn, Check, Save } from 'lucide-react';
import { ApplicationStatus, SavedApplication, computeSectionStats } from '../types/bdris';

interface SavedProfilesViewProps {
  user: User | null;
  savedApps: SavedApplication[];
  activeId: string | null;
  onSignIn: () => void;
  onLoad: (app: SavedApplication) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  onPushToExtension: (app: SavedApplication) => Promise<void>;
  onUpdateTracking: (id: string, trackingId: string, status: ApplicationStatus) => Promise<void>;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'ড্রাফট',
  pushed: 'অটো-ফিল রেডি',
  submitted: 'সাবমিট সম্পন্ন',
};

export function SavedProfilesView({
  user,
  savedApps,
  activeId,
  onSignIn,
  onLoad,
  onDelete,
  onCreateNew,
  onPushToExtension,
  onUpdateTracking,
}: SavedProfilesViewProps) {
  const [query, setQuery] = useState('');
  const [editingTracking, setEditingTracking] = useState<Record<string, string>>({});
  const [editingStatus, setEditingStatus] = useState<Record<string, ApplicationStatus>>({});
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

  const filtered = savedApps.filter((app) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [
      app.data.nameBn,
      app.data.nameEn,
      app.data.mobile,
      app.data.district,
      app.data.fatherNameBn,
      app.data.fatherBrn,
      app.data.fatherNid,
      app.data.motherNameBn,
      app.data.motherBrn,
      app.data.motherNid,
      app.bdrisTrackingId || '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const handleSaveRowTracking = async (app: SavedApplication) => {
    const nextTrack = editingTracking[app.id] ?? app.bdrisTrackingId ?? '';
    const nextStat = editingStatus[app.id] ?? app.status ?? 'draft';
    await onUpdateTracking(app.id, nextTrack, nextStat);
    setSavedRowId(app.id);
    setTimeout(() => setSavedRowId(null), 1500);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            সার্ভার ডাটাবেজ: সংরক্ষিত নাম, আইডি নম্বর ও আবেদন তালিকা
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {user
              ? 'ক্লাউড ডাটাবেজে সংরক্ষিত সকল আবেদনকারীর নাম, পিতা-মাতার আইডি এবং BDRIS ট্র্যাকিং/নিবন্ধন নম্বর এখানে স্থায়ীভাবে সেভ থাকে।'
              : 'ক্লাউড ডাটাবেজে স্থায়ীভাবে সেভ করতে Google দিয়ে লগইন করুন (এখন লোকাল ব্রাউজার তালিকা দেখাচ্ছে)।'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!user && (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>Google লগইন</span>
            </button>
          )}
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="নাম, আইডি বা ট্র্যাকিং নং খুঁজুন..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-emerald-700 focus:outline-none w-60"
            />
          </div>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>নতুন আবেদন</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center space-y-3">
          <div className="text-sm font-medium text-slate-700">
            {savedApps.length === 0
              ? 'ডাটাবেজে এখনো কোনো আবেদন সংরক্ষণ করা হয়নি'
              : 'আপনার খোঁজের সাথে মিল পাওয়া যায়নি'}
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            ফরম ট্যাবে গিয়ে তথ্য পেস্ট বা আপলোড করে &ldquo;সার্ভারে সেভ ও অটো-ফিল পাঠান&rdquo; বাটনে ক্লিক করলে এখানে নাম ও আইডি নম্বরসহ স্থায়ী তালিকা তৈরি হবে।
          </p>
          {savedApps.length === 0 && (
            <button
              type="button"
              onClick={onCreateNew}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              প্রথম আবেদন তৈরি করুন
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">আবেদনকারীর নাম ও জন্ম তারিখ</th>
                <th className="py-3 px-4">পিতা ও মাতার আইডি নম্বর (BRN / NID)</th>
                <th className="py-3 px-4">BDRIS আবেদন / নিবন্ধন আইডি ও অবস্থা</th>
                <th className="py-3 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((app) => {
                const stats = computeSectionStats(app.data);
                const isActive = app.id === activeId;
                const trackVal = editingTracking[app.id] ?? app.bdrisTrackingId ?? '';
                const statusVal: ApplicationStatus = editingStatus[app.id] ?? app.status ?? 'draft';
                const hasPendingEdit =
                  trackVal !== (app.bdrisTrackingId ?? '') ||
                  statusVal !== (app.status ?? 'draft');

                return (
                  <tr
                    key={app.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isActive ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-slate-900">
                        {app.data.nameBn || app.data.nameEn || 'নামহীন'}
                      </div>
                      <div className="text-xs text-slate-500">{app.data.nameEn || '—'}</div>
                      <div className="text-xs font-mono tabular-nums text-slate-600 mt-1">
                        {app.data.dob || 'তারিখ নেই'} · {app.data.mobile || 'মোবাইল নেই'} · ({stats.totalFilled}/{stats.totalFields})
                      </div>
                    </td>

                    <td className="py-3 px-4 align-top text-xs text-slate-700 space-y-1">
                      <div>
                        <span className="font-semibold text-slate-800">পিতা:</span>{' '}
                        {app.data.fatherNameBn || app.data.fatherNameEn || '—'}
                        <div className="font-mono tabular-nums text-slate-500">
                          BRN: {app.data.fatherBrn || '—'} · NID: {app.data.fatherNid || '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">মাতা:</span>{' '}
                        {app.data.motherNameBn || app.data.motherNameEn || '—'}
                        <div className="font-mono tabular-nums text-slate-500">
                          BRN: {app.data.motherBrn || '—'} · NID: {app.data.motherNid || '—'}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 align-top">
                      <div className="flex flex-col gap-1.5 max-w-[240px]">
                        <input
                          type="text"
                          value={trackVal}
                          onChange={(e) =>
                            setEditingTracking((prev) => ({ ...prev, [app.id]: e.target.value }))
                          }
                          placeholder="আবেদন নং / জন্ম নিবন্ধন আইডি"
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md focus:border-emerald-700 focus:outline-none bg-white"
                        />
                        <div className="flex items-center gap-1.5">
                          <select
                            value={statusVal}
                            onChange={(e) =>
                              setEditingStatus((prev) => ({
                                ...prev,
                                [app.id]: e.target.value as ApplicationStatus,
                              }))
                            }
                            disabled={app.status === 'submitted'}
                            className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-700 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100"
                          >
                            {(['draft', 'pushed', 'submitted'] as ApplicationStatus[]).map((st) => (
                              <option key={st} value={st}>
                                {STATUS_LABELS[st]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleSaveRowTracking(app)}
                            disabled={!hasPendingEdit && savedRowId !== app.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white cursor-pointer"
                          >
                            {savedRowId === app.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                            ) : (
                              <Save className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>{savedRowId === app.id ? 'সেভ' : 'আপডেট'}</span>
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPushToExtension(app)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                        >
                          <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>এক্সটেনশনে পাঠান</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onLoad(app)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          এডিট
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(app.id)}
                          aria-label="মুছুন"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
