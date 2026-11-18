import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import {
  deleteApplicationFromDb,
  ensureUserSyncProfile,
  pushApplicationToLiveSync,
  saveApplicationToDb,
  subscribeToUserApplications,
  updateApplicationTrackingInDb,
} from './services/bdrisStore';
import { TopBar, WorkspaceTab } from './components/TopBar';
import { SidebarQueue } from './components/SidebarQueue';
import { SmartIntakePanel } from './components/SmartIntakePanel';
import { BdrisFormEditor } from './components/BdrisFormEditor';
import { AutoFillHub } from './components/AutoFillHub';
import { SavedProfilesView } from './components/SavedProfilesView';
import { GuideSection } from './components/GuideSection';
import {
  ApplicationStatus,
  BdrisDocumentsBundle,
  BdrisFormData,
  DEFAULT_ADDRESS_FIELDS,
  EMPTY_BDRIS_FORM,
  sanitizeEnglishName,
  SavedApplication,
} from './types/bdris';

const STORAGE_KEY_APPS = 'bdris_smartform_saved_apps_v1';
const STORAGE_KEY_DRAFT = 'bdris_smartform_active_draft_v1';
const STORAGE_KEY_SYNC = 'bdris_smartform_sync_key_v1';
const STORAGE_KEY_BRIDGE_PAYLOAD = 'bdris_smartform_bridge_payload_v1';

function withDefaultAddress(data: BdrisFormData): BdrisFormData {
  return {
    ...data,
    nameEn: sanitizeEnglishName(data.nameEn).trim(),
    fatherNameEn: sanitizeEnglishName(data.fatherNameEn).trim(),
    motherNameEn: sanitizeEnglishName(data.motherNameEn).trim(),
    holdingNoBn: '',
    holdingNoEn: '',
    division: data.division?.trim() || DEFAULT_ADDRESS_FIELDS.division,
    district: data.district?.trim() || DEFAULT_ADDRESS_FIELDS.district,
    upazila: data.upazila?.trim() || DEFAULT_ADDRESS_FIELDS.upazila,
    unionOrPourashava: data.unionOrPourashava?.trim() || DEFAULT_ADDRESS_FIELDS.unionOrPourashava,
    postOfficeBn: data.postOfficeBn?.trim() || DEFAULT_ADDRESS_FIELDS.postOfficeBn,
    postOfficeEn: data.postOfficeEn?.trim() || DEFAULT_ADDRESS_FIELDS.postOfficeEn,
  };
}

function getOrCreateLocalSyncKey(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY_SYNC);
    if (existing && existing.length >= 16) return existing;
    const created = `bdris_${crypto.randomUUID().replace(/-/g, '')}`;
    localStorage.setItem(STORAGE_KEY_SYNC, created);
    return created;
  } catch {
    return `bdris_${Date.now()}_sync_default`;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('form');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncKey, setSyncKey] = useState<string>(() => getOrCreateLocalSyncKey());
  const [isSyncing, setIsSyncing] = useState(false);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  const [formData, setFormData] = useState<BdrisFormData>(() => {
    try {
      const savedDraft = localStorage.getItem(STORAGE_KEY_DRAFT);
      if (savedDraft) {
        return withDefaultAddress({ ...EMPTY_BDRIS_FORM, ...JSON.parse(savedDraft) });
      }
    } catch {
      // Ignore invalid localStorage draft
    }
    return EMPTY_BDRIS_FORM;
  });

  const [bdrisTrackingId, setBdrisTrackingId] = useState('');
  const [documents, setDocuments] = useState<BdrisDocumentsBundle>({
    mode: 'child_2012_2026',
    epiCard: null,
    fatherCert: null,
    motherCert: null,
    nidCard: null,
    attestationDoc: null,
    reuseSingleForBoth: true,
  });

  const [localApps, setLocalApps] = useState<SavedApplication[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_APPS);
      if (raw) {
        return JSON.parse(raw) as SavedApplication[];
      }
    } catch {
      // Ignore invalid localStorage list
    }
    return [];
  });

  const [cloudApps, setCloudApps] = useState<SavedApplication[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const savedApps = user ? cloudApps : localApps;

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        try {
          const remoteKey = await ensureUserSyncProfile(currentUser, getOrCreateLocalSyncKey());
          setSyncKey(remoteKey);
          try {
            localStorage.setItem(STORAGE_KEY_SYNC, remoteKey);
            window.postMessage({ type: 'BDRIS_SMARTFORM_PING_BRIDGE' }, '*');
          } catch {
            // Ignore
          }
        } catch (err) {
          console.error('Could not sync user profile:', err);
        }
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setCloudApps([]);
      return;
    }

    const unsubApps = subscribeToUserApplications(
      user.uid,
      (apps) => setCloudApps(apps),
      (err) => {
        showToast(err.message || 'ডাটাবেজ থেকে তথ্য আনতে সমস্যা হয়েছে।');
      }
    );

    return () => unsubApps();
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(formData));
    } catch {
      // Ignore quota errors
    }
  }, [formData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify(localApps));
    } catch {
      // Ignore quota errors
    }
  }, [localApps]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window || !ev.data || typeof ev.data !== 'object') return;
      if (ev.data.type === 'BDRIS_SMARTFORM_BRIDGE_ACK' && ev.data.ok) {
        setExtensionConnected(true);
      }
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'BDRIS_SMARTFORM_PING_BRIDGE' }, '*');
    const pingTimer = window.setTimeout(() => {
      window.postMessage({ type: 'BDRIS_SMARTFORM_PING_BRIDGE' }, '*');
    }, 900);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(pingTimer);
    };
  }, []);

  const broadcastToExtensionBridge = (item: {
    id: string;
    bdrisTrackingId?: string;
    status?: ApplicationStatus;
    data: BdrisFormData;
    documents?: BdrisDocumentsBundle;
  }) => {
    const payload = {
      ...item,
      pushedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY_SYNC, syncKey);
      localStorage.setItem(STORAGE_KEY_BRIDGE_PAYLOAD, JSON.stringify(payload));
    } catch {
      // Fallback: save without base64 documents if localStorage 5MB quota is exceeded
      try {
        localStorage.setItem(
          STORAGE_KEY_BRIDGE_PAYLOAD,
          JSON.stringify({ ...payload, documents: null })
        );
      } catch {
        // Ignore storage error
      }
    }
    window.postMessage({ type: 'BDRIS_SMARTFORM_LIVE_PUSH', payload }, '*');
  };

  const pingExtensionBridge = () => {
    window.postMessage({ type: 'BDRIS_SMARTFORM_PING_BRIDGE' }, '*');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('সফলভাবে লগইন হয়েছে! ডাটাবেজ সংযুক্ত।');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'লগইন সম্পন্ন হয়নি।';
      showToast(msg);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveId(null);
    showToast('লগআউট করা হয়েছে।');
  };

  const handleApplyParsedData = (partial: Partial<BdrisFormData>, sourceLabel: string) => {
    setFormData((prev) => {
      const next = { ...prev };
      (Object.keys(partial) as Array<keyof BdrisFormData>).forEach((key) => {
        if (key === 'customFields') return;
        const val = partial[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          (next as Record<string, unknown>)[key] = val;
        } else if (typeof val === 'boolean') {
          (next as Record<string, unknown>)[key] = val;
        }
      });
      if (partial.customFields && partial.customFields.length > 0) {
        next.customFields = partial.customFields;
      }
      return withDefaultAddress(next);
    });
    showToast(sourceLabel);
  };

  const persistRecord = async (status: ApplicationStatus): Promise<string> => {
    const now = new Date().toISOString();
    if (user) {
      const savedId = await saveApplicationToDb(formData, {
        existingId: activeId,
        status,
        bdrisTrackingId,
      });
      setActiveId(savedId);
      return savedId;
    }

    // Local fallback when not signed in
    if (activeId) {
      setLocalApps((prev) =>
        prev.map((app) =>
          app.id === activeId
            ? { ...app, updatedAt: now, bdrisTrackingId, status, data: formData }
            : app
        )
      );
      return activeId;
    }

    const newId = `local_${crypto.randomUUID().replace(/-/g, '')}`;
    const newApp: SavedApplication = {
      id: newId,
      updatedAt: now,
      createdAt: now,
      bdrisTrackingId,
      status,
      data: formData,
    };
    setLocalApps((prev) => [newApp, ...prev]);
    setActiveId(newId);
    return newId;
  };

  const handleSaveDraftOnly = async () => {
    setIsSyncing(true);
    try {
      await persistRecord('draft');
      showToast(
        user
          ? 'ডাটাবেজে ড্রাফট সেভ করা হয়েছে।'
          : 'ব্রাউজারে সেভ হয়েছে (স্থায়ী ডাটাবেজের জন্য লগইন করুন)।'
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveAndPush = async () => {
    setIsSyncing(true);
    try {
      const cleanedForm = withDefaultAddress(formData);
      let id = activeId || `live_${Date.now()}`;
      let dbErrorMsg = '';
      try {
        id = await persistRecord('pushed');
      } catch (dbErr: unknown) {
        dbErrorMsg = dbErr instanceof Error ? dbErr.message : 'ডাটাবেজ সেভ সতর্কতা';
      }
      const liveItem = {
        id,
        bdrisTrackingId,
        status: 'pushed' as ApplicationStatus,
        data: cleanedForm,
        documents,
      };
      broadcastToExtensionBridge(liveItem);
      const syncResult = await pushApplicationToLiveSync(syncKey, liveItem);
      setLastSyncedAt(new Date().toISOString());
      if (dbErrorMsg) {
        showToast(
          syncResult.serverSynced
            ? `লাইভ সার্ভারে পাঠানো হয়েছে (ডাটাবেজ: ${dbErrorMsg})`
            : `সরাসরি ব্রাউজার এক্সটেনশনে পাঠানো হয়েছে! (ডাটাবেজ: ${dbErrorMsg})`
        );
      } else if (!syncResult.serverSynced) {
        showToast(
          extensionConnected
            ? 'সরাসরি ক্রোম এক্সটেনশনে পাঠানো হয়েছে! bdris.gov.bd ট্যাবে অটো-ফিল হবে।'
            : 'তথ্য ব্রাউজার ব্রিজে সংরক্ষিত হয়েছে — এক্সটেনশন v3.2 লোড করে রিফ্রেশ করুন।'
        );
      } else {
        showToast(
          extensionConnected
            ? 'লাইভ এক্সটেনশন ও সার্ভারে পাঠানো হয়েছে! bdris.gov.bd ট্যাবে অটো-ফিল চালু হবে।'
            : user
              ? 'ডাটাবেজে সেভ ও লাইভ সার্ভারে পাঠানো হয়েছে!'
              : 'সার্ভার অটো-ফিল কিউতে পাঠানো হয়েছে!'
        );
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'সার্ভারে পাঠাতে সমস্যা হয়েছে।');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushExistingToExtension = async (app: SavedApplication) => {
    setIsSyncing(true);
    try {
      const liveItem = {
        id: app.id,
        bdrisTrackingId: app.bdrisTrackingId,
        status: app.status || ('pushed' as ApplicationStatus),
        data: app.data,
      };
      broadcastToExtensionBridge(liveItem);
      await pushApplicationToLiveSync(syncKey, liveItem);
      setLastSyncedAt(new Date().toISOString());
      if (user && app.status === 'draft') {
        await updateApplicationTrackingInDb(app.id, app.bdrisTrackingId || '', 'pushed');
      }
      setActiveId(app.id);
      setFormData({ ...EMPTY_BDRIS_FORM, ...app.data });
      setBdrisTrackingId(app.bdrisTrackingId || '');
      showToast(`${app.data.nameBn || app.data.nameEn || 'আবেদন'} লাইভ এক্সটেনশনে পাঠানো হয়েছে!`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'এক্সটেনশনে পাঠানো যায়নি।');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateTracking = async (
    id: string,
    trackingId: string,
    status: ApplicationStatus
  ) => {
    try {
      if (user) {
        await updateApplicationTrackingInDb(id, trackingId, status);
      } else {
        setLocalApps((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  bdrisTrackingId: trackingId,
                  status,
                  updatedAt: new Date().toISOString(),
                }
              : a
          )
        );
      }
      if (activeId === id) {
        setBdrisTrackingId(trackingId);
      }
      showToast('আইডি ও অবস্থা ডাটাবেজে আপডেট করা হয়েছে।');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'আপডেট করতে সমস্যা হয়েছে।');
    }
  };

  const handleNewApplication = () => {
    setActiveId(null);
    setFormData(EMPTY_BDRIS_FORM);
    setBdrisTrackingId('');
    setDocuments((prev) => ({
      mode: prev.mode ?? 'child_2012_2026',
      epiCard: null,
      fatherCert: null,
      motherCert: null,
      nidCard: null,
      attestationDoc: null,
      reuseSingleForBoth: true,
    }));
    setActiveTab('form');
    showToast('নতুন ফরম খোলা হয়েছে (ইটনা ডিফল্ট ঠিকানাসহ)।');
  };

  const handleLoadApplication = (app: SavedApplication) => {
    setActiveId(app.id);
    setFormData(withDefaultAddress({ ...EMPTY_BDRIS_FORM, ...app.data }));
    setBdrisTrackingId(app.bdrisTrackingId || '');
    setActiveTab('form');
  };

  const handleDeleteApplication = async (id: string) => {
    try {
      if (user) {
        await deleteApplicationFromDb(id);
      } else {
        setLocalApps((prev) => prev.filter((a) => a.id !== id));
      }
      if (activeId === id) {
        setActiveId(null);
        setBdrisTrackingId('');
      }
      showToast('সংরক্ষিত আবেদনটি মুছে ফেলা হয়েছে।');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'মুছতে সমস্যা হয়েছে।');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar activeTab={activeTab} onSelectTab={setActiveTab} />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-40 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg shadow-lg border border-slate-700"
        >
          {toastMessage}
        </div>
      )}

      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <SidebarQueue
            user={user}
            authLoading={authLoading}
            isSyncing={isSyncing}
            formData={formData}
            savedApps={savedApps}
            activeId={activeId}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onNewApplication={handleNewApplication}
            onSaveAndPush={handleSaveAndPush}
            onSaveDraftOnly={handleSaveDraftOnly}
            onLoadApplication={handleLoadApplication}
            onDeleteApplication={handleDeleteApplication}
          />

          <div className="flex-1 min-w-0 w-full space-y-5">
            {activeTab === 'form' && (
              <>
                <SmartIntakePanel
                  dob={formData.dob}
                  documents={documents}
                  onDocumentsChange={setDocuments}
                  onApplyParsedData={handleApplyParsedData}
                />
                <BdrisFormEditor
                  data={formData}
                  bdrisTrackingId={bdrisTrackingId}
                  isSyncing={isSyncing}
                  onChange={(updated) => setFormData({ ...updated, holdingNoBn: '', holdingNoEn: '' })}
                  onTrackingIdChange={setBdrisTrackingId}
                  onReset={handleNewApplication}
                  onSaveAndPush={handleSaveAndPush}
                  onGoToAutoFill={() => setActiveTab('autofill')}
                />
              </>
            )}

            {activeTab === 'autofill' && (
              <AutoFillHub
                data={formData}
                documents={documents}
                syncKey={syncKey}
                isSyncing={isSyncing}
                extensionConnected={extensionConnected}
                lastSyncedAt={lastSyncedAt}
                onPingBridge={pingExtensionBridge}
                onPushToServer={handleSaveAndPush}
                onBackToForm={() => setActiveTab('form')}
              />
            )}

            {activeTab === 'saved' && (
              <SavedProfilesView
                user={user}
                savedApps={savedApps}
                activeId={activeId}
                onSignIn={handleSignIn}
                onLoad={handleLoadApplication}
                onDelete={handleDeleteApplication}
                onCreateNew={handleNewApplication}
                onPushToExtension={handlePushExistingToExtension}
                onUpdateTracking={handleUpdateTracking}
              />
            )}

            {activeTab === 'guide' && (
              <GuideSection onGoToForm={() => setActiveTab('form')} />
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 mt-6">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>BDRIS SmartForm — জন্ম নিবন্ধন ডাটাবেজ ও লাইভ অটো-ফিল সহায়ক</span>
          <div className="flex items-center gap-4">
            <a
              href="https://bdris.gov.bd/br/application"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-700 transition-colors"
            >
              নতুন জন্ম নিবন্ধন আবেদন (bdris.gov.bd)
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://bdris.gov.bd/br/application/status"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-700 transition-colors"
            >
              আবেদনের অবস্থা যাচাই
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
