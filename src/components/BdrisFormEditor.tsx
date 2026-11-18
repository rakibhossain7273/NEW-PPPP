import { useMemo, useState } from 'react';
import {
  Copy,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import {
  BdrisFormData,
  CustomField,
  DEFAULT_ADDRESS_FIELDS,
  computeSectionStats,
  isValidBdMobile,
  isValidBrn17,
  isValidDateDDMMYYYY,
  isValidNid,
  sanitizeEnglishName,
  splitNameParts,
  toEnglishDigits,
} from '../types/bdris';
import { BD_DIVISIONS } from '../data/bdLocations';

interface BdrisFormEditorProps {
  data: BdrisFormData;
  bdrisTrackingId: string;
  isSyncing: boolean;
  onChange: (updated: BdrisFormData) => void;
  onTrackingIdChange: (val: string) => void;
  onReset: () => void;
  onSaveAndPush: () => void;
  onGoToAutoFill: () => void;
}

type EditorSectionTab = 'personal' | 'address' | 'parents' | 'extra' | 'all';

interface FieldInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  mono?: boolean;
  validation?: { valid: boolean; message: string } | null;
}

function CopyableField({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
  validation = null,
}: FieldInputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Ignore clipboard failure in restricted iframes
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-700 truncate">{label}</label>
        {validation && value.trim().length > 0 && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium shrink-0 ${
              validation.valid ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {validation.valid ? (
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            )}
            <span>{validation.message}</span>
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full min-h-[40px] rounded-lg border bg-white pl-3 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
            validation && value.trim().length > 0 && !validation.valid
              ? 'border-amber-400 focus:border-amber-600 focus:ring-amber-500/15'
              : 'border-slate-300 focus:border-emerald-700 focus:ring-emerald-700/15'
          } ${mono ? 'font-mono tabular-nums' : 'font-sans'}`}
        />
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value}
          title="কপি করুন"
          aria-label={`${label} কপি করুন`}
          className="absolute right-2 p-1.5 text-slate-400 hover:text-emerald-700 disabled:opacity-30 rounded transition-colors cursor-pointer"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
          ) : (
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

export function BdrisFormEditor({
  data,
  bdrisTrackingId,
  isSyncing,
  onChange,
  onTrackingIdChange,
  onReset,
  onSaveAndPush,
  onGoToAutoFill,
}: BdrisFormEditorProps) {
  const [sectionTab, setSectionTab] = useState<EditorSectionTab>('personal');
  const [showTools, setShowTools] = useState(false);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');

  const stats = computeSectionStats(data);

  const update = <K extends keyof BdrisFormData>(key: K, val: BdrisFormData[K]) => {
    onChange({ ...data, [key]: val });
  };

  const availableDistricts = useMemo(() => {
    const match = BD_DIVISIONS.find(
      (d) =>
        d.bn === data.division.trim() ||
        d.en.toLowerCase() === data.division.trim().toLowerCase()
    );
    if (match) return match.districts;
    return BD_DIVISIONS.flatMap((d) => d.districts);
  }, [data.division]);

  const handleNormalizeDigits = () => {
    onChange({
      ...data,
      mobile: toEnglishDigits(data.mobile).replace(/\s+/g, ''),
      dob: toEnglishDigits(data.dob),
      wardNo: toEnglishDigits(data.wardNo),
      birthOrder: toEnglishDigits(data.birthOrder),
      fatherBrn: toEnglishDigits(data.fatherBrn).replace(/\D/g, ''),
      fatherDob: toEnglishDigits(data.fatherDob),
      fatherNid: toEnglishDigits(data.fatherNid).replace(/\D/g, ''),
      motherBrn: toEnglishDigits(data.motherBrn).replace(/\D/g, ''),
      motherDob: toEnglishDigits(data.motherDob),
      motherNid: toEnglishDigits(data.motherNid).replace(/\D/g, ''),
    });
  };

  const addCustomField = () => {
    if (!newCustomLabel.trim() && !newCustomValue.trim()) return;
    const item: CustomField = {
      id: crypto.randomUUID(),
      label: newCustomLabel.trim() || 'অতিরিক্ত তথ্য',
      value: newCustomValue.trim(),
    };
    update('customFields', [...data.customFields, item]);
    setNewCustomLabel('');
    setNewCustomValue('');
  };

  const updateCustomField = (id: string, patch: Partial<CustomField>) => {
    update(
      'customFields',
      data.customFields.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const removeCustomField = (id: string) => {
    update(
      'customFields',
      data.customFields.filter((f) => f.id !== id)
    );
  };

  const sectionTabs: { id: EditorSectionTab; label: string; badge?: string }[] = [
    {
      id: 'personal',
      label: '১. ব্যক্তিগত',
      badge: `${stats.personal.filled}/${stats.personal.total}`,
    },
    {
      id: 'address',
      label: '২. ঠিকানা',
      badge: `${stats.address.filled}/${stats.address.total}`,
    },
    {
      id: 'parents',
      label: '৩. পিতা ও মাতা',
      badge: `${stats.father.filled + stats.mother.filled}/${stats.father.total + stats.mother.total}`,
    },
    {
      id: 'extra',
      label: '৪. অন্যান্য ও আইডি',
    },
    {
      id: 'all',
      label: 'সব একসাথে',
    },
  ];

  const showPersonal = sectionTab === 'personal' || sectionTab === 'all';
  const showAddress = sectionTab === 'address' || sectionTab === 'all';
  const showParents = sectionTab === 'parents' || sectionTab === 'all';
  const showExtra = sectionTab === 'extra' || sectionTab === 'all';

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header & Section Switcher */}
      <div className="p-5 sm:p-6 border-b border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              আবেদন তথ্য যাচাই ও সম্পাদনা
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ধাপ অনুযায়ী ট্যাব পরিবর্তন করে তথ্য দেখুন অথবা সবগুলো একসাথে খুলুন।
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowTools((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>টুল ও অপশন</span>
            {showTools ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Collapsible Editor Tools */}
        {showTools && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleNormalizeDigits}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
              >
                সংখ্যা ইংরেজি (0-9) করুন
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...data, ...DEFAULT_ADDRESS_FIELDS })}
                className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-50 rounded-md cursor-pointer whitespace-nowrap"
              >
                ডিফল্ট ইটনা ঠিকানা বসান
              </button>
              <button
                type="button"
                onClick={onGoToAutoFill}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
              >
                এক্সটেনশন ও সিঙ্ক দেখুন
              </button>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer whitespace-nowrap"
            >
              ফরম খালি করুন
            </button>
          </div>
        )}

        {/* Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-full sm:w-fit">
          {sectionTabs.map((tab) => {
            const active = sectionTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSectionTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Body */}
      <div className="divide-y divide-slate-100">
        {/* 01. Personal Information */}
        {showPersonal && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                ব্যক্তিগত তথ্য / Personal Information
              </h3>
              {sectionTab === 'personal' && (
                <button
                  type="button"
                  onClick={() => setSectionTab('address')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
                >
                  <span>পরবর্তী: ঠিকানা</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <CopyableField
                  label="নাম (বাংলা)"
                  value={data.nameBn}
                  onChange={(v) => update('nameBn', v)}
                  placeholder="যেমন: মোঃ রাকিব হোসেন"
                />
                {data.nameBn.trim() && (
                  <div className="text-[11px] text-slate-500">
                    প্রথম অংশ: <span className="font-medium text-slate-700">{splitNameParts(data.nameBn).first || '—'}</span>
                    {' · '}
                    শেষ অংশ: <span className="font-medium text-slate-700">{splitNameParts(data.nameBn).last || '—'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <CopyableField
                  label="Name (English — ডট ছাড়া)"
                  value={data.nameEn}
                  onChange={(v) => update('nameEn', sanitizeEnglishName(v))}
                  placeholder="e.g., Md Rakib Hossain"
                />
                {data.nameEn.trim() && (
                  <div className="text-[11px] text-slate-500">
                    First: <span className="font-mono font-medium text-slate-700">{splitNameParts(data.nameEn).first || '—'}</span>
                    {' · '}
                    Last: <span className="font-mono font-medium text-slate-700">{splitNameParts(data.nameEn).last || '—'}</span>
                  </div>
                )}
              </div>

              <CopyableField
                label="জন্ম তারিখ (DD/MM/YYYY)"
                value={data.dob}
                onChange={(v) => update('dob', v)}
                placeholder="DD/MM/YYYY"
                mono
                validation={{
                  valid: isValidDateDDMMYYYY(data.dob),
                  message: isValidDateDDMMYYYY(data.dob) ? 'সঠিক' : 'DD/MM/YYYY দিন',
                }}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">লিঙ্গ (Gender)</label>
                <select
                  value={data.gender}
                  onChange={(e) => update('gender', e.target.value as BdrisFormData['gender'])}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
                >
                  <option value="">নির্বাচন করুন</option>
                  <option value="পুরুষ">পুরুষ (Male)</option>
                  <option value="মহিলা">মহিলা (Female)</option>
                  <option value="তৃতীয় লিঙ্গ">তৃতীয় লিঙ্গ (Other)</option>
                </select>
              </div>

              <CopyableField
                label="মোবাইল নম্বর"
                value={data.mobile}
                onChange={(v) => update('mobile', v)}
                placeholder="01XXXXXXXXX"
                mono
                validation={{
                  valid: isValidBdMobile(data.mobile),
                  message: isValidBdMobile(data.mobile) ? '১১ ডিজিট সঠিক' : '০১... দিন',
                }}
              />

              <CopyableField
                label="বাবা-মায়ের কততম সন্তান"
                value={data.birthOrder}
                onChange={(v) => update('birthOrder', v)}
                placeholder="যেমন: 1"
                mono
              />
            </div>
          </div>
        )}

        {/* 02. Address Details */}
        {showAddress && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                ঠিকানার বিবরণ / Address Details
              </h3>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.sameAddressForAll}
                    onChange={(e) => update('sameAddressForAll', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                  />
                  <span>জন্মস্থান, বর্তমান ও স্থায়ী ঠিকানা একই</span>
                </label>
                {sectionTab === 'address' && (
                  <button
                    type="button"
                    onClick={() => setSectionTab('parents')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
                  >
                    <span>পরবর্তী: পিতা ও মাতা</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">বিভাগ</label>
                <input
                  list="bd-divisions-list"
                  value={data.division}
                  onChange={(e) => update('division', e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                />
                <datalist id="bd-divisions-list">
                  {BD_DIVISIONS.map((d) => (
                    <option key={d.en} value={d.bn}>
                      {d.en}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">জেলা</label>
                <input
                  list="bd-districts-list"
                  value={data.district}
                  onChange={(e) => update('district', e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                />
                <datalist id="bd-districts-list">
                  {availableDistricts.map((dist) => (
                    <option key={dist.en} value={dist.bn}>
                      {dist.en}
                    </option>
                  ))}
                </datalist>
              </div>

              <CopyableField
                label="উপজেলা / সিটি কর্পোরেশন"
                value={data.upazila}
                onChange={(v) => update('upazila', v)}
              />
              <CopyableField
                label="ইউনিয়ন / পৌরসভা"
                value={data.unionOrPourashava}
                onChange={(v) => update('unionOrPourashava', v)}
              />
              <CopyableField
                label="ওয়ার্ড নং"
                value={data.wardNo}
                onChange={(v) => update('wardNo', v)}
                placeholder="যেমন: 4"
                mono
              />
              <div className="hidden lg:block" />

              <CopyableField
                label="ডাকঘর (বাংলা)"
                value={data.postOfficeBn}
                onChange={(v) => update('postOfficeBn', v)}
              />
              <CopyableField
                label="Post Office (English)"
                value={data.postOfficeEn}
                onChange={(v) => update('postOfficeEn', v)}
              />
              <div className="hidden lg:block" />

              <CopyableField
                label="গ্রাম (বাংলা)"
                value={data.villageBn}
                onChange={(v) => update('villageBn', v)}
                placeholder="গ্রাম বাংলায়"
              />
              <CopyableField
                label="Village (English)"
                value={data.villageEn}
                onChange={(v) => update('villageEn', v)}
                placeholder="Village in English"
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  বাসা/হোল্ডিং নং
                </label>
                <input
                  type="text"
                  value=""
                  readOnly
                  disabled
                  placeholder="সব সময় ফাঁকা থাকবে"
                  className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        )}

        {/* 03. Father & Mother Information Side-by-Side */}
        {showParents && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                পিতা ও মাতার তথ্য / Parents&apos; Information
              </h3>
              {sectionTab === 'parents' && (
                <button
                  type="button"
                  onClick={() => setSectionTab('extra')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
                >
                  <span>পরবর্তী: অন্যান্য ও আইডি</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Father Column */}
              <div className="space-y-3.5">
                <div className="text-xs font-bold text-slate-800 pb-1.5 border-b border-slate-100">
                  পিতার তথ্য (Father)
                </div>
                <CopyableField
                  label="পিতার নাম (বাংলা)"
                  value={data.fatherNameBn}
                  onChange={(v) => update('fatherNameBn', v)}
                  placeholder="পিতার নাম বাংলায়"
                />
                <CopyableField
                  label="Father's Name (English — ডট ছাড়া)"
                  value={data.fatherNameEn}
                  onChange={(v) => update('fatherNameEn', sanitizeEnglishName(v))}
                  placeholder="e.g., Md Karim Uddin"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CopyableField
                    label="জন্ম নিবন্ধন (১৭ ডিজিট)"
                    value={data.fatherBrn}
                    onChange={(v) => update('fatherBrn', v)}
                    placeholder="17-digit BRN"
                    mono
                    validation={{
                      valid: isValidBrn17(data.fatherBrn),
                      message: isValidBrn17(data.fatherBrn)
                        ? 'সঠিক'
                        : `${toEnglishDigits(data.fatherBrn).replace(/\D/g, '').length}/17`,
                    }}
                  />
                  <CopyableField
                    label="জন্ম তারিখ (DD/MM/YYYY)"
                    value={data.fatherDob}
                    onChange={(v) => update('fatherDob', v)}
                    placeholder="DD/MM/YYYY"
                    mono
                    validation={{
                      valid: isValidDateDDMMYYYY(data.fatherDob),
                      message: isValidDateDDMMYYYY(data.fatherDob) ? 'সঠিক' : 'DD/MM/YYYY',
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CopyableField
                    label="এনআইডি নম্বর (NID)"
                    value={data.fatherNid}
                    onChange={(v) => update('fatherNid', v)}
                    placeholder="10/13/17 digits"
                    mono
                    validation={{
                      valid: isValidNid(data.fatherNid),
                      message: isValidNid(data.fatherNid) ? 'সঠিক' : '১০/১৩/১৭ ডিজিট',
                    }}
                  />
                  <CopyableField
                    label="জাতীয়তা"
                    value={data.fatherNationality}
                    onChange={(v) => update('fatherNationality', v)}
                  />
                </div>
              </div>

              {/* Mother Column */}
              <div className="space-y-3.5 lg:border-l lg:border-slate-100 lg:pl-6">
                <div className="text-xs font-bold text-slate-800 pb-1.5 border-b border-slate-100">
                  মাতার তথ্য (Mother)
                </div>
                <CopyableField
                  label="মাতার নাম (বাংলা)"
                  value={data.motherNameBn}
                  onChange={(v) => update('motherNameBn', v)}
                  placeholder="মাতার নাম বাংলায়"
                />
                <CopyableField
                  label="Mother's Name (English — ডট ছাড়া)"
                  value={data.motherNameEn}
                  onChange={(v) => update('motherNameEn', sanitizeEnglishName(v))}
                  placeholder="e.g., Mst Salma Begum"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CopyableField
                    label="জন্ম নিবন্ধন (১৭ ডিজিট)"
                    value={data.motherBrn}
                    onChange={(v) => update('motherBrn', v)}
                    placeholder="17-digit BRN"
                    mono
                    validation={{
                      valid: isValidBrn17(data.motherBrn),
                      message: isValidBrn17(data.motherBrn)
                        ? 'সঠিক'
                        : `${toEnglishDigits(data.motherBrn).replace(/\D/g, '').length}/17`,
                    }}
                  />
                  <CopyableField
                    label="জন্ম তারিখ (DD/MM/YYYY)"
                    value={data.motherDob}
                    onChange={(v) => update('motherDob', v)}
                    placeholder="DD/MM/YYYY"
                    mono
                    validation={{
                      valid: isValidDateDDMMYYYY(data.motherDob),
                      message: isValidDateDDMMYYYY(data.motherDob) ? 'সঠিক' : 'DD/MM/YYYY',
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CopyableField
                    label="এনআইডি নম্বর (NID)"
                    value={data.motherNid}
                    onChange={(v) => update('motherNid', v)}
                    placeholder="10/13/17 digits"
                    mono
                    validation={{
                      valid: isValidNid(data.motherNid),
                      message: isValidNid(data.motherNid) ? 'সঠিক' : '১০/১৩/১৭ ডিজিট',
                    }}
                  />
                  <CopyableField
                    label="জাতীয়তা"
                    value={data.motherNationality}
                    onChange={(v) => update('motherNationality', v)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 04. Additional, Tracking ID & Custom Fields */}
        {showExtra && (
          <div className="p-5 sm:p-6 space-y-5">
            <h3 className="text-sm font-semibold text-slate-900">
              অন্যান্য তথ্য ও BDRIS আইডি সংরক্ষণ
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">ধর্ম (Religion)</label>
                <select
                  value={data.religion}
                  onChange={(e) => update('religion', e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                >
                  <option value="ইসলাম">ইসলাম (Islam)</option>
                  <option value="হিন্দু">হিন্দু (Hindu)</option>
                  <option value="বৌদ্ধ">বৌদ্ধ (Buddhist)</option>
                  <option value="খ্রিস্টান">খ্রিস্টান (Christian)</option>
                  <option value="অন্যান্য">অন্যান্য (Other)</option>
                </select>
              </div>

              <CopyableField
                label="জন্মের দেশ"
                value={data.birthPlaceCountry}
                onChange={(v) => update('birthPlaceCountry', v)}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">আবেদনকারীর সম্পর্ক</label>
                <select
                  value={data.applicantRelation}
                  onChange={(e) => update('applicantRelation', e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                >
                  <option value="পিতা">পিতা</option>
                  <option value="মাতা">মাতা</option>
                  <option value="নিজ">নিজ</option>
                  <option value="পিতামহ">পিতামহ</option>
                  <option value="মাতামহ">মাতামহ</option>
                  <option value="অভিভাবক">অভিভাবক</option>
                </select>
              </div>
            </div>

            <CopyableField
              label="BDRIS আবেদন / জন্ম নিবন্ধন আইডি নম্বর (সাবমিট শেষে সংরক্ষণের জন্য)"
              value={bdrisTrackingId}
              onChange={onTrackingIdChange}
              placeholder="যেমন: 20263313045012345"
              mono
            />

            {/* Custom Fields */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="text-xs font-semibold text-slate-700">কাস্টম তথ্য (ঐচ্ছিক)</div>

              {data.customFields.map((field) => (
                <div key={field.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
                    placeholder="ফিল্ডের নাম"
                    className="sm:col-span-5 min-h-[38px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => updateCustomField(field.id, { value: e.target.value })}
                    placeholder="তথ্য"
                    className="sm:col-span-6 min-h-[38px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomField(field.id)}
                    aria-label="কাস্টম ফিল্ড মুছুন"
                    className="sm:col-span-1 h-[38px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={newCustomLabel}
                  onChange={(e) => setNewCustomLabel(e.target.value)}
                  placeholder="নতুন ফিল্ডের নাম"
                  className="sm:col-span-5 min-h-[38px] rounded-lg border border-slate-300 bg-slate-50/70 px-3 py-1.5 text-sm text-slate-900 focus:bg-white focus:border-emerald-700 focus:outline-none"
                />
                <input
                  type="text"
                  value={newCustomValue}
                  onChange={(e) => setNewCustomValue(e.target.value)}
                  placeholder="মান / তথ্য"
                  className="sm:col-span-5 min-h-[38px] rounded-lg border border-slate-300 bg-slate-50/70 px-3 py-1.5 text-sm text-slate-900 focus:bg-white focus:border-emerald-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addCustomField}
                  className="sm:col-span-2 min-h-[38px] inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>যোগ করুন</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clean Footer Action Bar inside the same container */}
      <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          সকল তথ্য ঠিক থাকলে সার্ভারে পাঠিয়ে <span className="font-mono text-slate-800">bdris.gov.bd</span> পেজ খুলুন।
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onGoToAutoFill}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            এক্সটেনশন সেটআপ
          </button>
          <button
            type="button"
            onClick={onSaveAndPush}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <CloudUpload className="w-4 h-4" aria-hidden="true" />
            <span>{isSyncing ? 'পাঠানো হচ্ছে...' : 'সার্ভারে সেভ ও অটো-ফিল পাঠান'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
