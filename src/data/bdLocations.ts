export interface DivisionEntry {
  bn: string;
  en: string;
  districts: { bn: string; en: string }[];
}

export const BD_DIVISIONS: DivisionEntry[] = [
  {
    bn: 'ঢাকা',
    en: 'Dhaka',
    districts: [
      { bn: 'ঢাকা', en: 'Dhaka' },
      { bn: 'গাজীপুর', en: 'Gazipur' },
      { bn: 'নারায়ণগঞ্জ', en: 'Narayanganj' },
      { bn: 'নরসিংদী', en: 'Narsingdi' },
      { bn: 'মানিকগঞ্জ', en: 'Manikganj' },
      { bn: 'মুন্সিগঞ্জ', en: 'Munshiganj' },
      { bn: 'টাঙ্গাইল', en: 'Tangail' },
      { bn: 'কিশোরগঞ্জ', en: 'Kishoreganj' },
      { bn: 'ফরিদপুর', en: 'Faridpur' },
      { bn: 'গোপালগঞ্জ', en: 'Gopalganj' },
      { bn: 'মাদারীপুর', en: 'Madaripur' },
      { bn: 'রাজবাড়ী', en: 'Rajbari' },
      { bn: 'শরীয়তপুর', en: 'Shariatpur' },
    ],
  },
  {
    bn: 'চট্টগ্রাম',
    en: 'Chattogram',
    districts: [
      { bn: 'চট্টগ্রাম', en: 'Chattogram' },
      { bn: 'কক্সবাজার', en: "Cox's Bazar" },
      { bn: 'কুমিল্লা', en: 'Cumilla' },
      { bn: 'ব্রাহ্মণবাড়িয়া', en: 'Brahmanbaria' },
      { bn: 'চাঁদপুর', en: 'Chandpur' },
      { bn: 'ফেনী', en: 'Feni' },
      { bn: 'লক্ষ্মীপুর', en: 'Lakshmipur' },
      { bn: 'নোয়াখালী', en: 'Noakhali' },
      { bn: 'রাঙ্গামাটি', en: 'Rangamati' },
      { bn: 'খাগড়াছড়ি', en: 'Khagrachari' },
      { bn: 'বান্দরবান', en: 'Bandarban' },
    ],
  },
  {
    bn: 'রাজশাহী',
    en: 'Rajshahi',
    districts: [
      { bn: 'রাজশাহী', en: 'Rajshahi' },
      { bn: 'বগুড়া', en: 'Bogura' },
      { bn: 'পাবনা', en: 'Pabna' },
      { bn: 'সিরাজগঞ্জ', en: 'Sirajganj' },
      { bn: 'নাটোর', en: 'Natore' },
      { bn: 'নওগাঁ', en: 'Naogaon' },
      { bn: 'চাঁপাইনবাবগঞ্জ', en: 'Chapainawabganj' },
      { bn: 'জয়পুরহাট', en: 'Joypurhat' },
    ],
  },
  {
    bn: 'খুলনা',
    en: 'Khulna',
    districts: [
      { bn: 'খুলনা', en: 'Khulna' },
      { bn: 'যশোর', en: 'Jashore' },
      { bn: 'সাতক্ষীরা', en: 'Satkhira' },
      { bn: 'বাগেরহাট', en: 'Bagerhat' },
      { bn: 'কুষ্টিয়া', en: 'Kushtia' },
      { bn: 'চুয়াডাঙ্গা', en: 'Chuadanga' },
      { bn: 'মেহেরপুর', en: 'Meherpur' },
      { bn: 'ঝিনাইদহ', en: 'Jhenaidah' },
      { bn: 'মাগুরা', en: 'Magura' },
      { bn: 'নড়াইল', en: 'Narail' },
    ],
  },
  {
    bn: 'বরিশাল',
    en: 'Barishal',
    districts: [
      { bn: 'বরিশাল', en: 'Barishal' },
      { bn: 'পটুয়াখালী', en: 'Patuakhali' },
      { bn: 'ভোলা', en: 'Bhola' },
      { bn: 'পিরোজপুর', en: 'Pirojpur' },
      { bn: 'বরগুনা', en: 'Barguna' },
      { bn: 'ঝালকাঠি', en: 'Jhalokati' },
    ],
  },
  {
    bn: 'সিলেট',
    en: 'Sylhet',
    districts: [
      { bn: 'সিলেট', en: 'Sylhet' },
      { bn: 'মৌলভীবাজার', en: 'Moulvibazar' },
      { bn: 'হবিগঞ্জ', en: 'Habiganj' },
      { bn: 'সুনামগঞ্জ', en: 'Sunamganj' },
    ],
  },
  {
    bn: 'রংপুর',
    en: 'Rangpur',
    districts: [
      { bn: 'রংপুর', en: 'Rangpur' },
      { bn: 'দিনাজপুর', en: 'Dinajpur' },
      { bn: 'কুড়িগ্রাম', en: 'Kurigram' },
      { bn: 'গাইবান্ধা', en: 'Gaibandha' },
      { bn: 'নীলফামারী', en: 'Nilphamari' },
      { bn: 'লালমনিরহাট', en: 'Lalmonirhat' },
      { bn: 'পঞ্চগড়', en: 'Panchagarh' },
      { bn: 'ঠাকুরগাঁও', en: 'Thakurgaon' },
    ],
  },
  {
    bn: 'ময়মনসিংহ',
    en: 'Mymensingh',
    districts: [
      { bn: 'ময়মনসিংহ', en: 'Mymensingh' },
      { bn: 'জামালপুর', en: 'Jamalpur' },
      { bn: 'নেত্রকোণা', en: 'Netrokona' },
      { bn: 'শেরপুর', en: 'Sherpur' },
    ],
  },
];

export const SAMPLE_RAW_INPUT = `নতুন জন্ম নিবন্ধনের তথ্য ফরম
==================================================

[ ব্যক্তিগত তথ্য / Personal Information ]
--------------------------------------------------
নাম (বাংলা): আরাফাত রহমান
Name (English): Arafat Rahman
বাবা-মায়ের কততম সন্তান: ১ম
লিঙ্গ: পুরুষ
মোবাইল নম্বর: 01712345678
জন্ম তারিখ (Date of Birth): 15/08/2024

[ ঠিকানার বিবরণ / Address Details ]
--------------------------------------------------
বিভাগ: ঢাকা
জেলা: গাজীপুর
সিটি কর্পোরেশন/উপজেলা: গাজীপুর সদর
ইউনিয়ন/পৌরসভা/ওয়ার্ড: পুবাইল
ওয়ার্ড নং: ০৪
ডাকঘর (বাংলা): পুবাইল
Post Office (English): Pubail
গ্রাম (বাংলা): মিরের বাজার
Village (English): Mirer Bazar
বাসা/হোল্ডিং নং: বাড়ি-৪২, সড়ক-৩
House/Holding No: House-42, Road-3

[ পিতার তথ্য / Father's Information ]
--------------------------------------------------
পিতার নাম (বাংলা): মোঃ করিম উদ্দিন
Father's Name (English): Md Karim Uddin
জন্ম নিবন্ধন নম্বর (১৭ ডিজিট): 19903313045012345
জন্ম তারিখ (Date of Birth): 10/05/1990
এনআইডি নম্বর (NID No): 19903313045000123

[ মাতার তথ্য / Mother's Information ]
--------------------------------------------------
মাতার নাম (বাংলা): মোসাঃ সালমা বেগম
Mother's Name (English): Mst Salma Begum
জন্ম নিবন্ধন নম্বর (১৭ ডিজিট): 19943313045067890
জন্ম তারিখ (Date of Birth): 22/11/1994
এনআইডি নম্বর (NID No): 6891234567`;

export const SAMPLE_FREEFORM_NOTE = `বাচ্চার নাম তানজিলা আক্তার (Tanzila Akter), মেয়ে, ২য় সন্তান। জন্ম ১২ জানুয়ারি ২০২৫। মোবাইল 01819223344। ঠিকানা: চট্টগ্রাম বিভাগ, কুমিল্লা জেলা, লাকসাম উপজেলা, মুদাফরগঞ্জ ইউনিয়ন, ওয়ার্ড নং ৩, ডাকঘর মুদাফরগঞ্জ (Mudafarganj), গ্রাম উত্তরপাড়া (Uttarpara), বাসা-১২। বাবা: আবুল কালাম (Abul Kalam), জন্ম ১৯৮৮-০৩-০৪, বিআরএন ১৯৮৮১৯১৭২৫৬০৯৮৭৬৫, এনআইডি ৮২৩৪৫৬৭৮৯০। মা: নাজমা আক্তার (Nazma Akter), জন্ম ১৯৯৩-০৭-১৯, বিআরএন ১৯৯৩১৯১৭২৫৬০১২৩৪৫, এনআইডি ৫৫১২৩৪৫৬৭৮। ধর্ম ইসলাম।`;
