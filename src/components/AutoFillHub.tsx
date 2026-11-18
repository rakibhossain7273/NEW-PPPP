import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Bookmark,
  Terminal,
  Package,
  FileCode2,
  ExternalLink,
  CloudUpload,
  RefreshCw,
} from 'lucide-react';
import { BdrisDocumentsBundle, BdrisFormData, splitNameParts } from '../types/bdris';
import {
  formatAsTemplateText,
  generateBdrisAutoFillScript,
  generateBookmarkletUrl,
  generateChromeExtensionZip,
  generateUserscript,
} from '../utils/bdrisAutomation';

interface AutoFillHubProps {
  data: BdrisFormData;
  documents: BdrisDocumentsBundle;
  syncKey: string;
  isSyncing: boolean;
  extensionConnected: boolean;
  lastSyncedAt: string;
  onPingBridge: () => void;
  onPushToServer: () => Promise<void>;
  onBackToForm: () => void;
}

type DeliveryMode = 'extension' | 'bookmarklet' | 'console' | 'preview';

interface ServerSyncPreview {
  active: { data?: BdrisFormData; pushedAt?: string } | null;
  queue: Array<{ id: string; pushedAt: string; data?: BdrisFormData }>;
  updatedAt: string | null;
}

export function AutoFillHub({
  data,
  documents,
  syncKey,
  isSyncing,
  extensionConnected,
  lastSyncedAt,
  onPingBridge,
  onPushToServer,
  onBackToForm,
}: AutoFillHubProps) {
  const [mode, setMode] = useState<DeliveryMode>('extension');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [syncPreview, setSyncPreview] = useState<ServerSyncPreview | null>(null);
  const [checkingSync, setCheckingSync] = useState(false);

  const serverOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const script = useMemo(
    () => generateBdrisAutoFillScript(data, false, documents),
    [data, documents]
  );
  const bookmarkletUrl = useMemo(
    () => generateBookmarkletUrl(data, documents),
    [data, documents]
  );
  const userscript = useMemo(
    () => generateUserscript(data, documents),
    [data, documents]
  );
  const templateText = useMemo(() => formatAsTemplateText(data), [data]);
  const jsonText = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const fetchServerSyncState = async () => {
    if (!syncKey) return;
    setCheckingSync(true);
    try {
      const resp = await fetch(`/api/sync/${encodeURIComponent(syncKey)}`, { cache: 'no-store' });
      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (resp.ok && ct.includes('application/json')) {
        const json = (await resp.json()) as ServerSyncPreview;
        if (json && (json.active || (json.queue && json.queue.length > 0))) {
          setSyncPreview(json);
          return;
        }
      }
    } catch {
      // Fall back to direct browser bridge payload (e.g. on Netlify static hosting)
    } finally {
      setCheckingSync(false);
    }

    try {
      const bridgeRaw = localStorage.getItem('bdris_smartform_bridge_payload_v1');
      if (bridgeRaw) {
        const parsed = JSON.parse(bridgeRaw) as {
          id?: string;
          pushedAt?: string;
          data?: BdrisFormData;
        };
        if (parsed && parsed.data) {
          const item = {
            id: parsed.id || 'bridge_active',
            pushedAt: parsed.pushedAt || new Date().toISOString(),
            data: parsed.data,
          };
          setSyncPreview({
            active: item,
            queue: [item],
            updatedAt: item.pushedAt,
          });
        }
      }
    } catch {
      // Ignore invalid localStorage
    }
  };

  useEffect(() => {
    fetchServerSyncState();
    onPingBridge();
  }, [syncKey, lastSyncedAt]);

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard rejection
    }
  };

  const handlePushNow = async () => {
    await onPushToServer();
    await fetchServerSyncState();
  };

  const handleDownloadExtension = async () => {
    setDownloadingZip(true);
    try {
      const blob = await generateChromeExtensionZip(data, serverOrigin, syncKey, documents);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bdris-smartform-live-extension.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadFile = (
    filename: string,
    content: string,
    mime = 'text/plain;charset=utf-8'
  ) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const bnParts = splitNameParts(data.nameBn);
  const enParts = splitNameParts(data.nameEn);

  const attachedDocLabels = [
    documents.nidCard ? `এনআইডি (${documents.nidCard.name})` : null,
    documents.attestationDoc ? `প্রত্যয়ন (${documents.attestationDoc.name})` : null,
    documents.epiCard ? `ইপিআই কার্ড (${documents.epiCard.name})` : null,
    documents.fatherCert ? `পিতার সনদ (${documents.fatherCert.name})` : null,
    documents.motherCert ? `মাতার সনদ (${documents.motherCert.name})` : null,
  ].filter(Boolean);

  const mappingRows = [
    { group: 'ব্যক্তিগত', bdrisField: 'নাম বাংলা (প্রথম · শেষ)', value: `${bnParts.first || '—'} · ${bnParts.last || '—'}` },
    { group: 'ব্যক্তিগত', bdrisField: 'Name English (First · Last)', value: `${enParts.first || '—'} · ${enParts.last || '—'}` },
    { group: 'ব্যক্তিগত', bdrisField: 'জন্ম তারিখ / লিঙ্গ / মোবাইল', value: `${data.dob || '—'} · ${data.gender || '—'} · ${data.mobile || '—'}` },
    { group: 'ঠিকানা', bdrisField: 'বিভাগ → জেলা → উপজেলা → ইউনিয়ন', value: [data.division, data.district, data.upazila, data.unionOrPourashava].filter(Boolean).join(' → ') || '—' },
    { group: 'ঠিকানা', bdrisField: 'ডাকঘর ও গ্রাম', value: `${data.postOfficeBn || '—'} / ${data.postOfficeEn || '—'} · ${data.villageBn || '—'} (হোল্ডিং ফাঁকা)` },
    { group: 'পিতা', bdrisField: 'নাম, ১৭ ডিজিট বিআরএন ও যাচাই', value: [data.fatherNameBn, data.fatherNameEn, data.fatherBrn, data.fatherDob].filter(Boolean).join(' · ') || '—' },
    { group: 'মাতা', bdrisField: 'নাম, ১৭ ডিজিট বিআরএন ও যাচাই', value: [data.motherNameBn, data.motherNameEn, data.motherBrn, data.motherDob].filter(Boolean).join(' · ') || '—' },
    { group: 'ডকুমেন্ট', bdrisField: 'প্রত্যয়ন ও পিতা-মাতার প্রমাণপত্র', value: attachedDocLabels.length > 0 ? attachedDocLabels.join(' · ') : 'কোনো ছবি যুক্ত করা হয়নি' },
  ];

  const activeServerName =
    syncPreview?.active?.data?.nameBn || syncPreview?.active?.data?.nameEn || null;

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
      {/* 1. Live Server Sync Header */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              লাইভ-সিঙ্ক এক্সটেনশন ও অটো-ফিল
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              {activeServerName
                ? `সার্ভারে প্রস্তুত: ${activeServerName} (মোট ${syncPreview?.queue?.length ?? 1}টি আবেদন)`
                : 'ফরম পূরণ করে "সার্ভারে পাঠান" চাপলেই এক্সটেনশন স্বয়ংক্রিয়ভাবে তথ্য নিয়ে নেবে।'}
            </p>
            <p className={`text-xs mt-1 font-medium ${extensionConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
              {extensionConnected
                ? 'লাইভ এক্সটেনশন v3.2 সংযুক্ত আছে — তথ্য পাঠালেই bdris.gov.bd ও পপআপে সরাসরি চলে যাবে।'
                : 'লাইভ এক্সটেনশন v3.2 এখনো শনাক্ত হয়নি — নিচ থেকে নতুন v3.2 .zip ডাউনলোড করে chrome://extensions-এ লোড/রিলোড করুন।'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToForm}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
            >
              তথ্য এডিট
            </button>
            <button
              type="button"
              onClick={handlePushNow}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <CloudUpload className="w-4 h-4" aria-hidden="true" />
              <span>{isSyncing ? 'পাঠানো হচ্ছে...' : 'সার্ভারে পাঠান'}</span>
            </button>
            <a
              href="https://bdris.gov.bd/br/application"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              <span>bdris.gov.bd</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('extension')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'extension' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" aria-hidden="true" />
              <span>এক্সটেনশন (.zip)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('bookmarklet')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'bookmarklet' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
              <span>বুকমার্কলেট</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('console')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'console' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>কনসোল স্ক্রিপ্ট</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'preview' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>ম্যাপিং ও JSON</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchServerSyncState();
              onPingBridge();
            }}
            disabled={checkingSync}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingSync ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>স্ট্যাটাস রিফ্রেশ</span>
          </button>
        </div>

        {syncPreview && syncPreview.queue && syncPreview.queue.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">সার্ভার লাইভ কিউ:</span>
            {syncPreview.queue.slice(0, 5).map((q, idx) => (
              <span
                key={q.id}
                className={`px-2 py-0.5 rounded border text-xs ${
                  idx === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {idx === 0 ? '★ ' : ''}
                {q.data?.nameBn || q.data?.nameEn || 'নামহীন'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Mode Content */}
      <div className="p-5 sm:p-6">
        {mode === 'extension' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                ১-বার ইনস্টল করুন — আর কখনো ZIP আনজিপ করতে হবে না
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                এই ক্রোম এক্সটেনশনটি একবার <span className="font-mono text-slate-800">chrome://extensions</span>-এ লোড করে নিন। এরপর প্রতিবার তথ্য সার্ভারে পাঠিয়ে <span className="font-mono text-slate-800">bdris.gov.bd</span> খুললেই ফরম পূরণ, পিতা-মাতার বিআরএন যাচাই ও ডকুমেন্ট অ্যাটাচ হয়ে যাবে।
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadExtension}
                  disabled={downloadingZip}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {downloadingZip
                      ? 'এক্সটেনশন তৈরি হচ্ছে...'
                      : 'লাইভ-সিঙ্ক এক্সটেনশন (.zip) ডাউনলোড'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => copyText('sync-key', syncKey)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedId === 'sync-key' ? (
                    <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  )}
                  <span>{copiedId === 'sync-key' ? 'Sync Key কপি হয়েছে' : 'Sync Key কপি'}</span>
                </button>
              </div>

              <div className="text-xs text-slate-500 font-mono truncate">
                Sync Key: {syncKey}
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs sm:text-sm text-slate-700">
              <div className="font-semibold text-slate-900">ইনস্টল করার নিয়ম:</div>
              <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                <li>ডাউনলোড করা <span className="font-mono text-slate-900">.zip</span> ফাইলটি আনজিপ করুন।</li>
                <li><span className="font-mono text-slate-900">chrome://extensions</span> খুলে <strong>Developer mode</strong> চালু করুন।</li>
                <li><strong>Load unpacked</strong> চেপে আনজিপ করা ফোল্ডার দিন।</li>
              </ol>
            </div>
          </div>
        )}

        {mode === 'bookmarklet' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              নিচের সবুজ বাটনটি ব্রাউজারের <strong>Bookmarks Bar</strong>-এ টেনে রাখুন। এরপর <span className="font-mono text-slate-800">bdris.gov.bd</span> পেজ খুলে বুকমার্কটিতে ক্লিক করলেই অটো-ফিল চলবে।
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={bookmarkletUrl}
                onClick={(e) => {
                  e.preventDefault();
                  copyText('bm-url', bookmarkletUrl);
                }}
                draggable
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg whitespace-nowrap cursor-grab"
              >
                <Bookmark className="w-4 h-4" aria-hidden="true" />
                <span>BDRIS Auto-Fill ({data.nameBn || data.nameEn || 'Applicant'})</span>
              </a>
              <button
                type="button"
                onClick={() => copyText('bm-url', bookmarkletUrl)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
              >
                {copiedId === 'bm-url' ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4 text-slate-600" />}
                <span>{copiedId === 'bm-url' ? 'কপি হয়েছে' : 'URL কপি করুন'}</span>
              </button>
            </div>
          </div>
        )}

        {mode === 'console' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-slate-600">
                <span className="font-mono">bdris.gov.bd</span> পেজে <span className="font-mono">F12</span> খুলে Console-এ নিচের কোডটি পেস্ট করুন।
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText('console-js', script)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  {copiedId === 'console-js' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedId === 'console-js' ? 'কপি হয়েছে' : 'স্ক্রিপ্ট কপি'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadFile(
                      'bdris-autofill.user.js',
                      userscript,
                      'application/javascript;charset=utf-8'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>.user.js</span>
                </button>
              </div>
            </div>
            <pre className="w-full max-h-60 overflow-auto p-3.5 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono">
              <code>{script}</code>
            </pre>
          </div>
        )}

        {mode === 'preview' && (
          <div className="space-y-6">
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4 w-24">সেকশন</th>
                    <th className="py-2.5 px-4">BDRIS পোর্টাল ফিল্ড</th>
                    <th className="py-2.5 px-4">তথ্য</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mappingRows.map((row) => (
                    <tr key={row.bdrisField} className="hover:bg-slate-50/70">
                      <td className="py-2 px-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                        {row.group}
                      </td>
                      <td className="py-2 px-4 text-xs sm:text-sm font-medium text-slate-800">
                        {row.bdrisField}
                      </td>
                      <td className="py-2 px-4 text-slate-700 font-mono text-xs tabular-nums">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">ফরম্যাটেড টেমপ্লেট</span>
                  <button
                    type="button"
                    onClick={() => copyText('tpl-txt', templateText)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded cursor-pointer"
                  >
                    {copiedId === 'tpl-txt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'tpl-txt' ? 'কপি হয়েছে' : 'কপি'}</span>
                  </button>
                </div>
                <pre className="h-48 overflow-auto p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap">
                  {templateText}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">JSON ডেটা</span>
                  <button
                    type="button"
                    onClick={() => copyText('json-txt', jsonText)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded cursor-pointer"
                  >
                    {copiedId === 'json-txt' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'json-txt' ? 'কপি হয়েছে' : 'JSON কপি'}</span>
                  </button>
                </div>
                <pre className="h-48 overflow-auto p-3 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono">
                  {jsonText}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
