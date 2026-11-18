import { GoogleGenAI, Type } from '@google/genai';

export interface UploadedImagePart {
  base64?: string;
  mimeType?: string;
  name?: string;
}

export interface ParseBdrisRequestBody {
  mode?: 'child_2012_2026' | 'adult_pre_2012';
  rawText?: string;
  imageBase64?: string;
  imageMimeType?: string;
  epiImage?: UploadedImagePart | null;
  fatherImage?: UploadedImagePart | null;
  motherImage?: UploadedImagePart | null;
  nidImage?: UploadedImagePart | null;
  attestationImage?: UploadedImagePart | null;
}

const BDRIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nameBn: { type: Type.STRING, description: 'Child/applicant full name in Bengali' },
    nameEn: { type: Type.STRING, description: 'Child/applicant full name in English' },
    birthOrder: { type: Type.STRING, description: 'Birth order as digits or ordinal (e.g., "1", "2")' },
    gender: {
      type: Type.STRING,
      description: 'Must be one of: "পুরুষ", "মহিলা", "তৃতীয় লিঙ্গ", or "" if unknown',
    },
    mobile: { type: Type.STRING, description: 'Bangladesh mobile number in ASCII digits (e.g., 017XXXXXXXX)' },
    dob: { type: Type.STRING, description: 'Date of birth strictly in DD/MM/YYYY format with ASCII digits' },

    division: { type: Type.STRING, description: 'Bangladesh Division name in Bengali (e.g., ঢাকা, চট্টগ্রাম)' },
    district: { type: Type.STRING, description: 'District name in Bengali (e.g., গাজীপুর, কুমিল্লা)' },
    upazila: { type: Type.STRING, description: 'City Corporation or Upazila name in Bengali' },
    unionOrPourashava: { type: Type.STRING, description: 'Union, Pourashava, or Ward name in Bengali' },
    wardNo: { type: Type.STRING, description: 'Ward number in ASCII digits (e.g., "4")' },
    postOfficeBn: { type: Type.STRING, description: 'Post office name in Bengali' },
    postOfficeEn: { type: Type.STRING, description: 'Post office name in English' },
    villageBn: { type: Type.STRING, description: 'Village/Mahalla/Road name in Bengali' },
    villageEn: { type: Type.STRING, description: 'Village/Mahalla/Road name in English' },
    holdingNoBn: { type: Type.STRING, description: 'House/Holding No in Bengali' },
    holdingNoEn: { type: Type.STRING, description: 'House/Holding No in English' },

    fatherNameBn: { type: Type.STRING, description: 'Father full name in Bengali' },
    fatherNameEn: { type: Type.STRING, description: 'Father full name in English' },
    fatherBrn: { type: Type.STRING, description: 'Father 17-digit Birth Registration Number in ASCII digits' },
    fatherDob: { type: Type.STRING, description: 'Father DOB in DD/MM/YYYY format with ASCII digits' },
    fatherNid: { type: Type.STRING, description: 'Father NID number in ASCII digits' },
    fatherNationality: { type: Type.STRING, description: 'Father nationality (default বাংলাদেশী if Bangladeshi)' },

    motherNameBn: { type: Type.STRING, description: 'Mother full name in Bengali' },
    motherNameEn: { type: Type.STRING, description: 'Mother full name in English' },
    motherBrn: { type: Type.STRING, description: 'Mother 17-digit Birth Registration Number in ASCII digits' },
    motherDob: { type: Type.STRING, description: 'Mother DOB in DD/MM/YYYY format with ASCII digits' },
    motherNid: { type: Type.STRING, description: 'Mother NID number in ASCII digits' },
    motherNationality: { type: Type.STRING, description: 'Mother nationality (default বাংলাদেশী if Bangladeshi)' },

    religion: { type: Type.STRING, description: 'Religion in Bengali if mentioned (e.g., ইসলাম, হিন্দু, বৌদ্ধ, খ্রিস্টান)' },
    birthPlaceCountry: { type: Type.STRING, description: 'Country of birth (default বাংলাদেশ if inside BD)' },
    applicantRelation: { type: Type.STRING, description: 'Applicant relation (e.g., পিতা, মাতা, নিজ, অভিভাবক)' },
    customFields: {
      type: Type.ARRAY,
      description: 'Any additional extra information mentioned in the input that does not fit standard fields',
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: 'Field label in Bengali or English' },
          value: { type: Type.STRING, description: 'Extracted field value' },
        },
        required: ['label', 'value'],
      },
    },
  },
  required: [
    'nameBn',
    'nameEn',
    'birthOrder',
    'gender',
    'mobile',
    'dob',
    'division',
    'district',
    'upazila',
    'unionOrPourashava',
    'wardNo',
    'postOfficeBn',
    'postOfficeEn',
    'villageBn',
    'villageEn',
    'holdingNoBn',
    'holdingNoEn',
    'fatherNameBn',
    'fatherNameEn',
    'fatherBrn',
    'fatherDob',
    'fatherNid',
    'motherNameBn',
    'motherNameEn',
    'motherBrn',
    'motherDob',
    'motherNid',
    'customFields',
  ],
};

function cleanEnName(val: unknown): string {
  return typeof val === 'string'
    ? val.replace(/\./g, ' ').replace(/[^A-Za-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

export async function parseBdrisDocumentsWithGemini(
  body: ParseBdrisRequestBody,
  apiKey?: string
): Promise<{ status: number; data?: Record<string, unknown>; error?: string }> {
  const {
    mode,
    rawText,
    imageBase64,
    imageMimeType,
    epiImage,
    fatherImage,
    motherImage,
    nidImage,
    attestationImage,
  } = body;

  const hasAnyInput =
    Boolean(rawText && rawText.trim()) ||
    Boolean(imageBase64) ||
    Boolean(epiImage?.base64) ||
    Boolean(fatherImage?.base64) ||
    Boolean(motherImage?.base64) ||
    Boolean(nidImage?.base64) ||
    Boolean(attestationImage?.base64);

  if (!hasAnyInput) {
    return {
      status: 400,
      error: 'অনুগ্রহ করে কিছু তথ্য লিখুন অথবা অন্তত একটি ডকুমেন্টের ছবি আপলোড করুন।',
    };
  }

  const resolvedKey = apiKey || process.env.GEMINI_API_KEY;
  if (!resolvedKey) {
    return {
      status: 500,
      error:
        'সার্ভারে GEMINI_API_KEY সেট করা নেই। Netlify > Site configuration > Environment variables-এ GEMINI_API_KEY যোগ করুন।',
    };
  }

  const ai = new GoogleGenAI({
    apiKey: resolvedKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = `You are a precision data-extraction engine for Bangladesh's Birth & Death Registration Information System (bdris.gov.bd).
Extract structured birth registration information from the user's Bengali/English text and/or uploaded document images (NID Card, Attestation Letter / প্রত্যয়ন পত্র, EPI Vaccination Card, Father's Birth Certificate, Mother's Birth Certificate, or form template).

Rules:
1. Convert ALL numeric digits (Bengali ০-৯) to standard ASCII digits (0-9) for dates, mobile numbers, BRN (17 digits), NID (10/13/17 digits), ward numbers, and birth order.
2. Normalize all dates to DD/MM/YYYY format (e.g., "12 জানুয়ারি ২০২৫" or "2025-01-12" -> "12/01/2025").
3. For gender, map male/ছেলে/পুরুষ -> "পুরুষ", female/মেয়ে/মহিলা -> "মহিলা", other/তৃতীয় লিঙ্গ -> "তৃতীয় লিঙ্গ".
4. If a name or place (child, father, mother, post office, village) is provided in only Bengali OR only English, provide an accurate standard transliteration in the other language as well so both Bangla and English BDRIS fields can be auto-filled.
5. CRITICAL FOR ENGLISH NAMES (nameEn, fatherNameEn, motherNameEn): Use ONLY English letters (A-Z, a-z) and spaces. NEVER include dots (.), hyphens, or any punctuation/non-English characters (e.g., write "Md" NOT "Md.", write "Mst" NOT "Mst.", write "Sk" NOT "Sk.").
6. Normalize division and district names to standard Bangladesh administrative Bengali spellings (e.g., ঢাকা, চট্টগ্রাম, রাজশাহী, খুলনা, বরিশাল, সিলেট, রংপুর, ময়মনসিংহ).
7. ALWAYS keep holdingNoBn and holdingNoEn as empty string "" — never fill House/Holding name or number.
8. Document-specific extraction rules (mode: ${mode || 'child_2012_2026'}):
   - From EPI Vaccination Card: extract CHILD's nameBn, nameEn, dob, gender.
   - From Father's Birth Certificate: extract fatherNameBn, fatherNameEn, fatherDob, and 17-digit fatherBrn.
   - From Mother's Birth Certificate: extract motherNameBn, motherNameEn, motherDob, and 17-digit motherBrn.
   - From Applicant's National ID Card (NID / জাতীয় পরিচয়পত্র) or Attestation Letter (প্রত্যয়ন পত্র) for pre-2012 adults:
     * Extract APPLICANT's nameBn, nameEn (without dots!), dob (DD/MM/YYYY), gender (if inferable or written), villageBn/villageEn, postOfficeBn/postOfficeEn, upazila, district, division if printed on NID back/front.
     * Extract Father's name (পিতা) into fatherNameBn & transliterated fatherNameEn (without dots!).
     * Extract Mother's name (মাতা) into motherNameBn & transliterated motherNameEn (without dots!).
     * Put the applicant's own NID number (ID NO) into customFields as { label: "আবেদনকারীর এনআইডি নম্বর", value: "..." } — do NOT overwrite fatherNid or motherNid with the applicant's own NID.
9. Never invent IDs, BRN numbers, NID numbers, dates, or mobile numbers that were not provided. Leave unknown fields as empty string "".`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (nidImage?.base64 && nidImage?.mimeType) {
    parts.push({
      text: '[DOCUMENT: APPLICANT NATIONAL ID CARD (NID / জাতীয় পরিচয়পত্র) — Extract applicant nameBn, nameEn, dob, fatherNameBn/En, motherNameBn/En, address village/postOffice/upazila/district]',
    });
    parts.push({
      inlineData: {
        mimeType: nidImage.mimeType,
        data: nidImage.base64,
      },
    });
  }

  if (attestationImage?.base64 && attestationImage?.mimeType) {
    parts.push({
      text: '[DOCUMENT: ATTESTATION LETTER / CERTIFICATE (প্রত্যয়ন পত্র) — Extract applicant nameBn, nameEn, dob, fatherNameBn/En, motherNameBn/En, and address]',
    });
    parts.push({
      inlineData: {
        mimeType: attestationImage.mimeType,
        data: attestationImage.base64,
      },
    });
  }

  if (epiImage?.base64 && epiImage?.mimeType) {
    parts.push({
      text: '[DOCUMENT 1: CHILD EPI VACCINATION CARD — Extract child nameBn, nameEn, dob, gender]',
    });
    parts.push({
      inlineData: {
        mimeType: epiImage.mimeType,
        data: epiImage.base64,
      },
    });
  }

  if (fatherImage?.base64 && fatherImage?.mimeType) {
    parts.push({
      text: '[DOCUMENT 2: FATHER BIRTH REGISTRATION CERTIFICATE — Extract fatherNameBn, fatherNameEn, fatherDob, and 17-digit fatherBrn]',
    });
    parts.push({
      inlineData: {
        mimeType: fatherImage.mimeType,
        data: fatherImage.base64,
      },
    });
  }

  if (motherImage?.base64 && motherImage?.mimeType) {
    parts.push({
      text: '[DOCUMENT 3: MOTHER BIRTH REGISTRATION CERTIFICATE — Extract motherNameBn, motherNameEn, motherDob, and 17-digit motherBrn]',
    });
    parts.push({
      inlineData: {
        mimeType: motherImage.mimeType,
        data: motherImage.base64,
      },
    });
  }

  if (imageBase64 && imageMimeType) {
    parts.push({
      text: '[ATTACHED GENERAL DOCUMENT IMAGE — Extract all visible BDRIS fields]',
    });
    parts.push({
      inlineData: {
        mimeType: imageMimeType,
        data: imageBase64,
      },
    });
  }

  parts.push({
    text: rawText?.trim()
      ? `Extract all BDRIS birth registration fields from the text below and combine with any attached document images:\n\n${rawText.trim()}`
      : 'Extract all BDRIS birth registration fields visible in the attached document image(s).',
  });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const isTransientOverload = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return /503|UNAVAILABLE|high demand|overloaded|429|RESOURCE_EXHAUSTED|ECONNRESET|ETIMEDOUT/i.test(msg);
  };

  try {
    const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
    let responseText = '';
    let lastErr: unknown = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts },
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: BDRIS_RESPONSE_SCHEMA,
            },
          });
          responseText = (response.text ?? '').trim();
          if (responseText) break;
        } catch (err: unknown) {
          lastErr = err;
          if (!isTransientOverload(err)) {
            throw err;
          }
          if (attempt === 0) {
            await sleep(900);
          }
        }
      }
      if (responseText) break;
    }

    if (!responseText) {
      if (lastErr) throw lastErr;
      return {
        status: 502,
        error: 'AI মডেল থেকে কোনো ফলাফল পাওয়া যায়নি। আবার চেষ্টা করুন।',
      };
    }

    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    parsed.nameEn = cleanEnName(parsed.nameEn);
    parsed.fatherNameEn = cleanEnName(parsed.fatherNameEn);
    parsed.motherNameEn = cleanEnName(parsed.motherNameEn);
    parsed.holdingNoBn = '';
    parsed.holdingNoEn = '';

    return { status: 200, data: parsed };
  } catch (err: unknown) {
    console.error('Error in parseBdrisDocumentsWithGemini:', err);
    const rawMsg = err instanceof Error ? err.message : '';
    let friendlyMsg = 'তথ্য বিশ্লেষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
    if (/503|UNAVAILABLE|high demand|overloaded/i.test(rawMsg)) {
      friendlyMsg =
        'AI সার্ভারে এখন সাময়িক অতিরিক্ত চাপ রয়েছে (503)। কয়েক সেকেন্ড অপেক্ষা করে আবার "AI দিয়ে তথ্য বসান" চাপুন।';
    } else if (/429|RESOURCE_EXHAUSTED|quota/i.test(rawMsg)) {
      friendlyMsg = 'AI ব্যবহারের সীমা অতিক্রম করেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
    } else if (/API_KEY|PERMISSION_DENIED|403|400/.test(rawMsg)) {
      friendlyMsg =
        'AI API কী যাচাইয়ে সমস্যা হয়েছে। পরিবেশ ভ্যারিয়েবলে সঠিক GEMINI_API_KEY দিন।';
    }
    return { status: 503, error: friendlyMsg };
  }
}
