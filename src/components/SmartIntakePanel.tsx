import React, { useRef, useState } from 'react';
import {
  Sparkles,
  FileText,
  Upload,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Baby,
  IdCard,
} from 'lucide-react';
import {
  ApplicationMode,
  BdrisDocumentFile,
  BdrisDocumentsBundle,
  BdrisFormData,
  isBirthYear2012To2026,
} from '../types/bdris';
import { SAMPLE_FREEFORM_NOTE, SAMPLE_RAW_INPUT } from '../data/bdLocations';
import { parseTemplateLocally } from '../utils/bdrisAutomation';
import { compressImageFile } from '../utils/imageCompress';

interface SmartIntakePanelProps {
  dob: string;
  documents: BdrisDocumentsBundle;
  onDocumentsChange: (docs: BdrisDocumentsBundle) => void;
  onApplyParsedData: (partial: Partial<BdrisFormData>, sourceLabel: string) => void;
}

type DocSlotKey = 'epiCard' | 'fatherCert' | 'motherCert' | 'nidCard' | 'attestationDoc';

interface DocSlotMeta {
  key: DocSlotKey;
  title: string;
  hint: string;
}

const CHILD_DOC_SLOTS: DocSlotMeta[] = [
  {
    key: 'epiCard',
    title: 'ইপিআই টিকা কার্ড',
    hint: 'শিশুর নাম, তারিখ ও প্রত্যয়ন',
  },
  {
    key: 'fatherCert',
    title: 'পিতার জন্ম নিবন্ধন',
    hint: 'পিতার তথ্য ও প্রমাণপত্র',
  },
  {
    key: 'motherCert',
    title: 'মাতার জন্ম নিবন্ধন',
    hint: 'মাতার তথ্য ও প্রমাণপত্র',
  },
];

const ADULT_DOC_SLOTS: DocSlotMeta[] = [
  {
    key: 'nidCard',
    title: 'জাতীয় পরিচয়পত্র (NID)',
    hint: 'নিজের নাম, তারিখ, পিতা-মাতা ও প্রমাণপত্র',
  },
  {
    key: 'attestationDoc',
    title: 'প্রত্যয়ন পত্র / সনদ',
    hint: 'স্কুল/চেয়ারম্যান প্রত্যয়ন (অটো-অ্যাটাচ)',
  },
];

function formatReadableError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw || '');
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(msg)) {
    return 'AI সার্ভারে এখন সাময়িক চাপ বেশি রয়েছে। কয়েক সেকেন্ড পর "আবার চেষ্টা করুন" চাপুন।';
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return 'AI ব্যবহারের সীমা সাময়িকভাবে পূর্ণ হয়েছে। একটু পরে আবার চেষ্টা করুন।';
  }
  if (msg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        return 'AI সার্ভারে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
      }
    } catch {
      // Fall through
    }
  }
  return msg || 'তথ্য বিশ্লেষণে ত্রুটি হয়েছে। আবার চেষ্টা করুন।';
}

export function SmartIntakePanel({
  dob,
  documents,
  onDocumentsChange,
  onApplyParsedData,
}: SmartIntakePanelProps) {
  const [rawText, setRawText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [compressingSlot, setCompressingSlot] = useState<DocSlotKey | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fileRefs = useRef<Record<DocSlotKey, HTMLInputElement | null>>({
    epiCard: null,
    fatherCert: null,
    motherCert: null,
    nidCard: null,
    attestationDoc: null,
  });

  const activeMode: ApplicationMode = documents.mode ?? 'child_2012_2026';
  const activeSlots = activeMode === 'adult_pre_2012' ? ADULT_DOC_SLOTS : CHILD_DOC_SLOTS;
  const is2012To2026 = isBirthYear2012To2026(dob);

  const setMode = (nextMode: ApplicationMode) => {
    setErrorMsg(null);
    setStatusMsg(null);
    onDocumentsChange({
      ...documents,
      mode: nextMode,
    });
  };

  const handleSlotFileChange = async (
    slot: DocSlotKey,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('ফাইলের সাইজ ১৫ মেগাবাইটের কম হতে হবে।');
      return;
    }

    setErrorMsg(null);
    setCompressingSlot(slot);
    try {
      const compressed: BdrisDocumentFile = await compressImageFile(file);
      onDocumentsChange({
        ...documents,
        [slot]: compressed,
      });
    } catch (err: unknown) {
      setErrorMsg(formatReadableError(err));
    } finally {
      setCompressingSlot(null);
    }
  };

  const clearSlot = (slot: DocSlotKey) => {
    onDocumentsChange({
      ...documents,
      [slot]: null,
    });
    const ref = fileRefs.current[slot];
    if (ref) ref.value = '';
  };

  const activeUploadedCount = activeSlots.filter((s) => Boolean(documents[s.key])).length;
  const hasAnyDocument = Boolean(
    documents.epiCard ||
      documents.fatherCert ||
      documents.motherCert ||
      documents.nidCard ||
      documents.attestationDoc
  );

  const handleAiParse = async () => {
    if (!rawText.trim() && !hasAnyDocument) {
      setErrorMsg(
        activeMode === 'adult_pre_2012'
          ? 'অনুগ্রহ করে এনআইডি বা প্রত্যয়ন পত্রের ছবি দিন অথবা তথ্য লিখুন।'
          : 'অনুগ্রহ করে কিছু তথ্য লিখুন অথবা ইপিআই কার্ড / পিতা-মাতার সনদের ছবি দিন।'
      );
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/parse-bdris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: activeMode,
          rawText,
          epiImage: documents.epiCard ?? null,
          fatherImage: documents.fatherCert ?? null,
          motherImage: documents.motherCert ?? null,
          nidImage: documents.nidCard ?? null,
          attestationImage: documents.attestationDoc ?? null,
        }),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        throw new Error('Netlify ফাংশন (/api/parse-bdris) পাওয়া যায়নি। পুরো কোড Git/Netlify CLI দিয়ে ডিপ্লয় করুন এবং Site Environment Variables-এ GEMINI_API_KEY যোগ করুন।');
      }
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'সার্ভার থেকে তথ্য বিশ্লেষণ করা যায়নি।');
      }
      if (json.data) {
        const parsed = json.data as Partial<BdrisFormData>;
        parsed.holdingNoBn = '';
        parsed.holdingNoEn = '';
        if (Array.isArray(parsed.customFields)) {
          parsed.customFields = parsed.customFields.map((cf) => ({
            id: cf.id || crypto.randomUUID(),
            label: cf.label,
            value: cf.value,
          }));
        }
        onApplyParsedData(parsed, 'AI দিয়ে ডকুমেন্ট ও তথ্য থেকে ফরম পূরণ করা হয়েছে।');
        setStatusMsg('সফলভাবে তথ্য নিচের ফরমে বসানো হয়েছে।');
      }
    } catch (err: unknown) {
      setErrorMsg(formatReadableError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectTemplateParse = () => {
    if (!rawText.trim()) {
      setErrorMsg('টেমপ্লেট থেকে সরাসরি নিতে হলে টেক্সট বক্সে তথ্য পেস্ট করুন।');
      return;
    }
    setErrorMsg(null);
    const parsed = parseTemplateLocally(rawText);
    const count = Object.keys(parsed).length;
    if (count === 0) {
      setErrorMsg(
        'টেমপ্লেট ফরম্যাট পাওয়া যায়নি। সাধারণ লেখা হলে "AI দিয়ে তথ্য বসান" ব্যবহার করুন।'
      );
      return;
    }
    onApplyParsedData(parsed, 'টেমপ্লেট থেকে সরাসরি ফরম পূরণ করা হয়েছে।');
    setStatusMsg('টেমপ্লেটের তথ্যগুলো নিচের ফরমে বসানো হয়েছে।');
  };

  const clearAllInputs = () => {
    setRawText('');
    onDocumentsChange({
      mode: activeMode,
      epiCard: null,
      fatherCert: null,
      motherCert: null,
      nidCard: null,
      attestationDoc: null,
      reuseSingleForBoth: documents.reuseSingleForBoth ?? true,
    });
    (Object.keys(fileRefs.current) as DocSlotKey[]).forEach((k) => {
      const r = fileRefs.current[k];
      if (r) r.value = '';
    });
    setErrorMsg(null);
    setStatusMsg(null);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Top Header + Mode Selector */}
      <div className="px-5 sm:px-6 pt-5 pb-4 bg-slate-50/70 border-b border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              আবেদনের ধরন ও স্মার্ট ডকুমেন্ট ইনপুট
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              বয়স অনুযায়ী সঠিক অপশন বেছে ছবি আপলোড দিন বা লেখা পেস্ট করুন।
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowOptions((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>অপশনসমূহ</span>
            {showOptions ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Two Clear Mode Selector Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setMode('child_2012_2026')}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              activeMode === 'child_2012_2026'
                ? 'bg-white border-emerald-600 ring-2 ring-emerald-700/15'
                : 'bg-white/60 border-slate-200 hover:bg-white'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                activeMode === 'child_2012_2026'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Baby className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                বাচ্চার জন্ম নিবন্ধন (২০১২–২০২৬)
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                ইপিআই টিকা কার্ড + পিতা ও মাতার জন্ম নিবন্ধন
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('adult_pre_2012')}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              activeMode === 'adult_pre_2012'
                ? 'bg-white border-emerald-600 ring-2 ring-emerald-700/15'
                : 'bg-white/60 border-slate-200 hover:bg-white'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                activeMode === 'adult_pre_2012'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <IdCard className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                জাতীয় পরিচয়পত্র / প্রত্যয়ন (২০১২-এর আগে)
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                এনআইডি কার্ড অথবা প্রত্যয়ন পত্র দিয়ে সরাসরি অটো-ফিল
              </div>
            </div>
          </button>
        </div>

        {/* Collapsible Secondary Options Panel */}
        {showOptions && (
          <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">দ্রুত নমুনা ও রিসেট</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRawText(SAMPLE_RAW_INPUT);
                    setErrorMsg(null);
                    setStatusMsg(null);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                >
                  টেমপ্লেট নমুনা
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRawText(SAMPLE_FREEFORM_NOTE);
                    setErrorMsg(null);
                    setStatusMsg(null);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                >
                  সাধারণ লেখা নমুনা
                </button>
                <button
                  type="button"
                  onClick={handleDirectTemplateParse}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>টেমপ্লেট সরাসরি বসান</span>
                </button>
                {(rawText || hasAnyDocument) && (
                  <button
                    type="button"
                    onClick={clearAllInputs}
                    className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer whitespace-nowrap"
                  >
                    সব মুছুন
                  </button>
                )}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none pt-2 border-t border-slate-100 w-full">
              <input
                type="checkbox"
                checked={documents.reuseSingleForBoth ?? true}
                onChange={(e) =>
                  onDocumentsChange({
                    ...documents,
                    reuseSingleForBoth: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
              />
              <span>১টি ছবি দিলে প্রত্যয়ন ও প্রমাণপত্র — উভয় ঘরে অটো-আপলোড হবে</span>
            </label>
          </div>
        )}
      </div>

      {/* Main Intake Body */}
      <div className="p-5 sm:p-6 space-y-4">
        {activeMode === 'child_2012_2026' && is2012To2026 && (
          <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            জন্ম সাল ২০১২–২০২৬ শনাক্ত হয়েছে: ইপিআই কার্ড ও পিতা-মাতার সনদ যুক্ত করলে তথ্য ও ফাইল অটো-অ্যাটাচ হবে।
          </div>
        )}

        {/* Mode-specific Document Upload Strip */}
        <div
          className={`grid grid-cols-1 ${
            activeMode === 'adult_pre_2012' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
          } border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/40`}
        >
          {activeSlots.map((slot) => {
            const docFile = documents[slot.key];
            const isCompressing = compressingSlot === slot.key;

            return (
              <div key={slot.key} className="p-3 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {docFile && docFile.mimeType.startsWith('image/') && (
                    <img
                      src={`data:${docFile.mimeType};base64,${docFile.base64}`}
                      alt={slot.title}
                      className="w-9 h-9 object-cover rounded border border-slate-200 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {slot.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {docFile ? docFile.name : slot.hint}
                    </div>
                  </div>
                </div>

                {docFile ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => clearSlot(slot.key)}
                      aria-label={`${slot.title} সরান`}
                      className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer shrink-0 whitespace-nowrap">
                    {isCompressing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{isCompressing ? '...' : 'ছবি দিন'}</span>
                    <input
                      ref={(el) => {
                        fileRefs.current[slot.key] = el;
                      }}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleSlotFileChange(slot.key, e)}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={3}
          placeholder={
            activeMode === 'adult_pre_2012'
              ? 'ঐচ্ছিক: বাড়তি কোনো তথ্য (যেমন মোবাইল নম্বর বা ওয়ার্ড নং) থাকলে এখানে লিখে দিন...'
              : 'ঐচ্ছিক: ফরম টেমপ্লেট বা নাম, ঠিকানা, মোবাইল নম্বর এখানে লিখে বা পেস্ট করে দিন...'
          }
          className="w-full rounded-lg border border-slate-300 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15 transition-colors"
        />

        {errorMsg && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800"
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={handleAiParse}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-red-200 hover:bg-red-100 text-red-800 text-xs font-semibold rounded-md cursor-pointer shrink-0 whitespace-nowrap"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>আবার চেষ্টা করুন</span>
            </button>
          </div>
        )}

        {statusMsg && !errorMsg && (
          <div
            role="status"
            className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800"
          >
            {statusMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleAiParse}
            disabled={isLoading || compressingSlot !== null}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isLoading ? 'তথ্য বিশ্লেষণ হচ্ছে...' : 'AI দিয়ে তথ্য বসান'}</span>
          </button>

          <span className="text-xs text-slate-500 tabular-nums">
            যুক্ত ডকুমেন্ট: {activeUploadedCount}/{activeSlots.length} টি
          </span>
        </div>
      </div>
    </section>
  );
}
