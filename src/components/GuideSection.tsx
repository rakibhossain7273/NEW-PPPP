import { CheckCircle2, ExternalLink } from 'lucide-react';

interface GuideSectionProps {
  onGoToForm: () => void;
}

export function GuideSection({ onGoToForm }: GuideSectionProps) {
  const steps = [
    {
      num: '০১',
      title: 'তথ্য বা ৩টি ডকুমেন্টের ছবি দিন',
      desc: 'ইপিআই টিকা কার্ড, পিতার জন্ম নিবন্ধন ও মাতার জন্ম নিবন্ধনের ছবি আপলোড করুন অথবা লেখা পেস্ট করে "AI দিয়ে তথ্য বসান" চাপুন।',
    },
    {
      num: '০২',
      title: 'ট্যাব অনুযায়ী তথ্য যাচাই করুন',
      desc: 'ব্যক্তিগত, ঠিকানা (ইটনা ডিফল্ট), এবং পিতা-মাতার তথ্য যাচাই করুন। ইংরেজি নামে কোনো ডট থাকবে না এবং বাসা/হোল্ডিং ঘর স্বয়ংক্রিয়ভাবে ফাঁকা থাকবে।',
    },
    {
      num: '০৩',
      title: 'সার্ভারে সেভ ও লাইভ এক্সটেনশনে পাঠান',
      desc: 'এক্সটেনশন (.zip) মাত্র একবার Chrome-এ লোড করুন। এরপর "সার্ভারে সেভ ও অটো-ফিল পাঠান" চাপলেই এক্সটেনশন সরাসরি তথ্য নিয়ে নিবে।',
    },
    {
      num: '০৪',
      title: 'যাচাই, ফাইল অ্যাটাচ ও সাবমিট',
      desc: 'bdris.gov.bd-তে গেলে পিতা-মাতার ১৭ ডিজিট নম্বর অটো-যাচাই এবং ডকুমেন্ট (প্রত্যয়ন ও প্রমাণপত্র) অটো-অ্যাটাচ হবে। শেষে ক্যাপচা ও ওটিপি দিয়ে সাবমিট করুন।',
    },
  ];

  return (
    <section className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            ব্যবহার নির্দেশিকা (৪টি সহজ ধাপ)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            প্রতিটি ধাপে নিরাপদ ব্রাউজার অটোমেশন ও ক্লাউড ডাটাবেজ সংরক্ষণ।
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onGoToForm}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            ফরমে ফিরে যান
          </button>
          <a
            href="https://bdris.gov.bd/br/application"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>bdris.gov.bd খুলুন</span>
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {steps.map((step) => (
          <div key={step.num} className="space-y-1">
            <div className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
              ধাপ {step.num}
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">{step.title}</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      <div className="p-5 sm:p-6 bg-slate-50/50">
        <h2 className="text-xs font-semibold text-slate-800 mb-3">
          আবেদন করার আগে সংক্ষিপ্ত চেকলিস্ট
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm text-slate-700">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>পিতা ও মাতার ১৭ ডিজিটের জন্ম নিবন্ধন নম্বর ও জন্ম তারিখ সঠিক আছে</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>সকল তারিখ DD/MM/YYYY ফরম্যাটে ইংরেজি সংখ্যায় রয়েছে</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>জন্ম সাল ২০১২–২০২৬ হলে ইপিআই কার্ড ও পিতা-মাতার সনদ যুক্ত করা হয়েছে</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>সচল মোবাইল নম্বর (OTP গ্রহণের জন্য) সঠিকভাবে লেখা হয়েছে</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
