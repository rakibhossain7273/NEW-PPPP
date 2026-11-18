import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  ApplicationStatus,
  BdrisDocumentsBundle,
  BdrisFormData,
  CustomField,
  EMPTY_BDRIS_FORM,
  SavedApplication,
} from '../types/bdris';

const clampStr = (val: unknown, maxLen: number): string => {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen);
};

function sanitizeCustomFields(fields: CustomField[] | undefined): CustomField[] {
  if (!Array.isArray(fields)) return [];
  return fields.slice(0, 20).map((f) => ({
    id: clampStr(f?.id || crypto.randomUUID(), 64),
    label: clampStr(f?.label || '', 120),
    value: clampStr(f?.value || '', 240),
  }));
}

function toFirestorePayload(
  uid: string,
  data: BdrisFormData,
  status: ApplicationStatus,
  bdrisTrackingId: string
) {
  return {
    ownerId: uid,
    nameBn: clampStr(data.nameBn, 160),
    nameEn: clampStr(data.nameEn, 160),
    birthOrder: clampStr(data.birthOrder, 20),
    gender: clampStr(data.gender, 30),
    mobile: clampStr(data.mobile, 30),
    dob: clampStr(data.dob, 20),
    division: clampStr(data.division, 100),
    district: clampStr(data.district, 100),
    upazila: clampStr(data.upazila, 120),
    unionOrPourashava: clampStr(data.unionOrPourashava, 120),
    wardNo: clampStr(data.wardNo, 20),
    postOfficeBn: clampStr(data.postOfficeBn, 120),
    postOfficeEn: clampStr(data.postOfficeEn, 120),
    villageBn: clampStr(data.villageBn, 160),
    villageEn: clampStr(data.villageEn, 160),
    holdingNoBn: clampStr(data.holdingNoBn, 120),
    holdingNoEn: clampStr(data.holdingNoEn, 120),
    sameAddressForAll: Boolean(data.sameAddressForAll),
    fatherNameBn: clampStr(data.fatherNameBn, 160),
    fatherNameEn: clampStr(data.fatherNameEn, 160),
    fatherBrn: clampStr(data.fatherBrn, 30),
    fatherDob: clampStr(data.fatherDob, 20),
    fatherNid: clampStr(data.fatherNid, 30),
    fatherNationality: clampStr(data.fatherNationality, 60),
    motherNameBn: clampStr(data.motherNameBn, 160),
    motherNameEn: clampStr(data.motherNameEn, 160),
    motherBrn: clampStr(data.motherBrn, 30),
    motherDob: clampStr(data.motherDob, 20),
    motherNid: clampStr(data.motherNid, 30),
    motherNationality: clampStr(data.motherNationality, 60),
    religion: clampStr(data.religion, 60),
    birthPlaceCountry: clampStr(data.birthPlaceCountry, 80),
    applicantRelation: clampStr(data.applicantRelation, 60),
    customFields: sanitizeCustomFields(data.customFields),
    bdrisTrackingId: clampStr(bdrisTrackingId, 64),
    status,
  };
}

function timestampToIso(ts: unknown): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString();
  }
  if (typeof ts === 'string') return ts;
  return new Date().toISOString();
}

export async function ensureUserSyncProfile(user: User, fallbackKey: string): Promise<string> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existingKey = snap.data()?.syncKey;
      if (typeof existingKey === 'string' && existingKey.length >= 16) {
        return existingKey;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  const safeKey = fallbackKey.length >= 16 ? fallbackKey.slice(0, 64) : `bdris_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await setDoc(ref, {
      syncKey: safeKey,
      email: clampStr(user.email || '', 160),
      displayName: clampStr(user.displayName || 'Operator', 160),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return safeKey;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeToUserApplications(
  uid: string,
  onData: (apps: SavedApplication[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colPath = 'applications';
  const q = query(collection(db, colPath), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: SavedApplication[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const formData: BdrisFormData = {
          ...EMPTY_BDRIS_FORM,
          nameBn: d.nameBn ?? '',
          nameEn: d.nameEn ?? '',
          birthOrder: d.birthOrder ?? '',
          gender: d.gender ?? '',
          mobile: d.mobile ?? '',
          dob: d.dob ?? '',
          division: d.division || EMPTY_BDRIS_FORM.division,
          district: d.district || EMPTY_BDRIS_FORM.district,
          upazila: d.upazila || EMPTY_BDRIS_FORM.upazila,
          unionOrPourashava: d.unionOrPourashava || EMPTY_BDRIS_FORM.unionOrPourashava,
          wardNo: d.wardNo ?? '',
          postOfficeBn: d.postOfficeBn || EMPTY_BDRIS_FORM.postOfficeBn,
          postOfficeEn: d.postOfficeEn || EMPTY_BDRIS_FORM.postOfficeEn,
          villageBn: d.villageBn ?? '',
          villageEn: d.villageEn ?? '',
          holdingNoBn: d.holdingNoBn ?? '',
          holdingNoEn: d.holdingNoEn ?? '',
          sameAddressForAll: d.sameAddressForAll ?? true,
          fatherNameBn: d.fatherNameBn ?? '',
          fatherNameEn: d.fatherNameEn ?? '',
          fatherBrn: d.fatherBrn ?? '',
          fatherDob: d.fatherDob ?? '',
          fatherNid: d.fatherNid ?? '',
          fatherNationality: d.fatherNationality || 'বাংলাদেশী',
          motherNameBn: d.motherNameBn ?? '',
          motherNameEn: d.motherNameEn ?? '',
          motherBrn: d.motherBrn ?? '',
          motherDob: d.motherDob ?? '',
          motherNid: d.motherNid ?? '',
          motherNationality: d.motherNationality || 'বাংলাদেশী',
          religion: d.religion || 'ইসলাম',
          birthPlaceCountry: d.birthPlaceCountry || 'বাংলাদেশ',
          applicantRelation: d.applicantRelation || 'পিতা',
          customFields: Array.isArray(d.customFields) ? d.customFields : [],
        };

        return {
          id: docSnap.id,
          updatedAt: timestampToIso(d.updatedAt),
          createdAt: timestampToIso(d.createdAt),
          bdrisTrackingId: d.bdrisTrackingId ?? '',
          status: (d.status as ApplicationStatus) || 'draft',
          data: formData,
        };
      });

      list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveApplicationToDb(
  data: BdrisFormData,
  options: {
    existingId?: string | null;
    status?: ApplicationStatus;
    bdrisTrackingId?: string;
  } = {}
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('ডাটাবেজে সেভ করতে অনুগ্রহ করে লগইন করুন।');
  }

  const appId = options.existingId || `app_${crypto.randomUUID().replace(/-/g, '')}`;
  const path = `applications/${appId}`;
  const ref = doc(db, 'applications', appId);
  const status: ApplicationStatus = options.status || 'draft';
  const tracking = options.bdrisTrackingId ?? '';
  const payload = toFirestorePayload(user.uid, data, status, tracking);

  if (options.existingId) {
    try {
      const { ownerId: _ownerId, ...updatable } = payload;
      await updateDoc(ref, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
      return appId;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return appId;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }
}

export async function updateApplicationTrackingInDb(
  appId: string,
  bdrisTrackingId: string,
  status: ApplicationStatus
): Promise<void> {
  const path = `applications/${appId}`;
  const ref = doc(db, 'applications', appId);
  try {
    await updateDoc(ref, {
      bdrisTrackingId: clampStr(bdrisTrackingId, 64),
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteApplicationFromDb(appId: string): Promise<void> {
  const path = `applications/${appId}`;
  try {
    await deleteDoc(doc(db, 'applications', appId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function pushApplicationToLiveSync(
  syncKey: string,
  app: {
    id: string;
    bdrisTrackingId?: string;
    status?: ApplicationStatus;
    data: BdrisFormData;
    documents?: BdrisDocumentsBundle;
  }
): Promise<{ serverSynced: boolean }> {
  try {
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncKey, application: app }),
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !ct.includes('application/json')) {
      return { serverSynced: false };
    }
    return { serverSynced: true };
  } catch {
    return { serverSynced: false };
  }
}
