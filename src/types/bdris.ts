export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface BdrisFormData {
  // 1. Personal Information
  nameBn: string;
  nameEn: string;
  birthOrder: string;
  gender: 'পুরুষ' | 'মহিলা' | 'তৃতীয় লিঙ্গ' | '';
  mobile: string;
  dob: string; // DD/MM/YYYY

  // 2. Address Details
  division: string;
  district: string;
  upazila: string;
  unionOrPourashava: string;
  wardNo: string;
  postOfficeBn: string;
  postOfficeEn: string;
  villageBn: string;
  villageEn: string;
  holdingNoBn: string;
  holdingNoEn: string;
  sameAddressForAll: boolean;

  // 3. Father's Information
  fatherNameBn: string;
  fatherNameEn: string;
  fatherBrn: string; // 17 digits
  fatherDob: string; // DD/MM/YYYY
  fatherNid: string; // 10, 13, or 17 digits
  fatherNationality: string;

  // 4. Mother's Information
  motherNameBn: string;
  motherNameEn: string;
  motherBrn: string; // 17 digits
  motherDob: string; // DD/MM/YYYY
  motherNid: string; // 10, 13, or 17 digits
  motherNationality: string;

  // 5. Additional BDRIS & Custom Fields
  religion: string;
  birthPlaceCountry: string;
  applicantRelation: string;
  customFields: CustomField[];
}

export type ApplicationMode = 'child_2012_2026' | 'adult_pre_2012';

export interface BdrisDocumentFile {
  name: string;
  mimeType: string;
  base64: string;
}

export interface BdrisDocumentsBundle {
  mode?: ApplicationMode;
  epiCard?: BdrisDocumentFile | null;
  fatherCert?: BdrisDocumentFile | null;
  motherCert?: BdrisDocumentFile | null;
  nidCard?: BdrisDocumentFile | null;
  attestationDoc?: BdrisDocumentFile | null;
  reuseSingleForBoth?: boolean;
}

export type ApplicationStatus = 'draft' | 'pushed' | 'submitted';

export interface SavedApplication {
  id: string;
  updatedAt: string;
  createdAt?: string;
  bdrisTrackingId?: string;
  status?: ApplicationStatus;
  data: BdrisFormData;
}

export function isBirthYear2012To2026(dob: string): boolean {
  const normalized = toEnglishDigits(dob.trim());
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  if (!match) return false;
  const year = Number(match[3]);
  return year >= 2012 && year <= 2026;
}

export const DEFAULT_ADDRESS_FIELDS = {
  division: 'ঢাকা',
  district: 'কিশোরগঞ্জ',
  upazila: 'ইটনা',
  unionOrPourashava: 'ইটনা',
  postOfficeBn: 'ইটনা -- ২৩৯০',
  postOfficeEn: 'Itna -- 2390',
} as const;

export const EMPTY_BDRIS_FORM: BdrisFormData = {
  nameBn: '',
  nameEn: '',
  birthOrder: '',
  gender: '',
  mobile: '',
  dob: '',

  division: DEFAULT_ADDRESS_FIELDS.division,
  district: DEFAULT_ADDRESS_FIELDS.district,
  upazila: DEFAULT_ADDRESS_FIELDS.upazila,
  unionOrPourashava: DEFAULT_ADDRESS_FIELDS.unionOrPourashava,
  wardNo: '',
  postOfficeBn: DEFAULT_ADDRESS_FIELDS.postOfficeBn,
  postOfficeEn: DEFAULT_ADDRESS_FIELDS.postOfficeEn,
  villageBn: '',
  villageEn: '',
  holdingNoBn: '',
  holdingNoEn: '',
  sameAddressForAll: true,

  fatherNameBn: '',
  fatherNameEn: '',
  fatherBrn: '',
  fatherDob: '',
  fatherNid: '',
  fatherNationality: 'বাংলাদেশী',

  motherNameBn: '',
  motherNameEn: '',
  motherBrn: '',
  motherDob: '',
  motherNid: '',
  motherNationality: 'বাংলাদেশী',

  religion: 'ইসলাম',
  birthPlaceCountry: 'বাংলাদেশ',
  applicantRelation: 'পিতা',
  customFields: [],
};

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toEnglishDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[০-৯]/g, (char) => {
    const idx = BN_DIGITS.indexOf(char);
    return idx >= 0 ? String(idx) : char;
  });
}

/**
 * Keeps only English letters (A-Z, a-z) and single spaces — removes dots (.) and all other symbols.
 */
export function sanitizeEnglishName(input: string): string {
  if (!input) return '';
  return input
    .replace(/\./g, ' ')
    .replace(/[^A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trimStart();
}

/**
 * Splits a full name into First Part and Last Part for BDRIS:
 * - 1 word: first = "", last = word
 * - 2 words: first = word1, last = word2
 * - 3+ words: first = all words except last, last = final word
 */
export function splitNameParts(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: '', last: parts[0] };
  if (parts.length === 2) return { first: parts[0], last: parts[1] };
  return {
    first: parts.slice(0, -1).join(' '),
    last: parts[parts.length - 1],
  };
}

export function isValidDateDDMMYYYY(val: string): boolean {
  const normalized = toEnglishDigits(val.trim());
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return false;
  }
  const dt = new Date(year, month - 1, day);
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

export function isValidBrn17(val: string): boolean {
  const digits = toEnglishDigits(val).replace(/\D/g, '');
  return digits.length === 17;
}

export function isValidNid(val: string): boolean {
  const digits = toEnglishDigits(val).replace(/\D/g, '');
  return digits.length === 10 || digits.length === 13 || digits.length === 17;
}

export function isValidBdMobile(val: string): boolean {
  const digits = toEnglishDigits(val).replace(/\D/g, '');
  return /^01[3-9]\d{8}$/.test(digits);
}

export interface SectionStats {
  personal: { filled: number; total: number };
  address: { filled: number; total: number };
  father: { filled: number; total: number };
  mother: { filled: number; total: number };
  totalFilled: number;
  totalFields: number;
}

export function computeSectionStats(data: BdrisFormData): SectionStats {
  const countFilled = (vals: string[]) => vals.filter((v) => v.trim().length > 0).length;

  const personalVals = [
    data.nameBn,
    data.nameEn,
    data.birthOrder,
    data.gender,
    data.mobile,
    data.dob,
  ];
  const addressVals = [
    data.division,
    data.district,
    data.upazila,
    data.unionOrPourashava,
    data.wardNo,
    data.postOfficeBn,
    data.postOfficeEn,
    data.villageBn,
    data.villageEn,
    data.holdingNoBn,
    data.holdingNoEn,
  ];
  const fatherVals = [
    data.fatherNameBn,
    data.fatherNameEn,
    data.fatherBrn,
    data.fatherDob,
    data.fatherNid,
  ];
  const motherVals = [
    data.motherNameBn,
    data.motherNameEn,
    data.motherBrn,
    data.motherDob,
    data.motherNid,
  ];

  const personal = { filled: countFilled(personalVals), total: personalVals.length };
  const address = { filled: countFilled(addressVals), total: addressVals.length };
  const father = { filled: countFilled(fatherVals), total: fatherVals.length };
  const mother = { filled: countFilled(motherVals), total: motherVals.length };

  return {
    personal,
    address,
    father,
    mother,
    totalFilled: personal.filled + address.filled + father.filled + mother.filled,
    totalFields: personal.total + address.total + father.total + mother.total,
  };
}
