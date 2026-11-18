import JSZip from 'jszip';
import {
  BdrisDocumentsBundle,
  BdrisFormData,
  CustomField,
  sanitizeEnglishName,
  toEnglishDigits,
} from '../types/bdris';

/**
 * Deterministic instant parser for structured template input (Key: Value lines).
 */
export function parseTemplateLocally(rawText: string): Partial<BdrisFormData> {
  const lines = rawText.split(/\r?\n/);
  const result: Partial<BdrisFormData> = {};
  const extraFields: CustomField[] = [];
  let currentSection: 'personal' | 'address' | 'father' | 'mother' | 'other' = 'personal';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^[=-]+$/.test(line)) continue;

    if (/ব্যক্তিগত তথ্য|Personal Information/i.test(line)) {
      currentSection = 'personal';
      continue;
    }
    if (/ঠিকানার বিবরণ|Address Details/i.test(line)) {
      currentSection = 'address';
      continue;
    }
    if (/পিতার তথ্য|Father's Information/i.test(line)) {
      currentSection = 'father';
      continue;
    }
    if (/মাতার তথ্য|Mother's Information/i.test(line)) {
      currentSection = 'mother';
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const label = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (!value) continue;

    const lower = label.toLowerCase();

    if (currentSection === 'father') {
      if (label.includes('বাংলা') || lower.includes('পিতার নাম')) {
        result.fatherNameBn = value;
      } else if (lower.includes('english') || lower.includes("father's name")) {
        result.fatherNameEn = sanitizeEnglishName(value).trim();
      } else if (label.includes('জন্ম নিবন্ধন') || lower.includes('brn')) {
        result.fatherBrn = toEnglishDigits(value).replace(/\D/g, '');
      } else if (label.includes('জন্ম তারিখ') || lower.includes('date of birth')) {
        result.fatherDob = toEnglishDigits(value);
      } else if (label.includes('এনআইডি') || lower.includes('nid')) {
        result.fatherNid = toEnglishDigits(value).replace(/\D/g, '');
      } else {
        extraFields.push({ id: crypto.randomUUID(), label, value });
      }
      continue;
    }

    if (currentSection === 'mother') {
      if (label.includes('বাংলা') || lower.includes('মাতার নাম')) {
        result.motherNameBn = value;
      } else if (lower.includes('english') || lower.includes("mother's name")) {
        result.motherNameEn = sanitizeEnglishName(value).trim();
      } else if (label.includes('জন্ম নিবন্ধন') || lower.includes('brn')) {
        result.motherBrn = toEnglishDigits(value).replace(/\D/g, '');
      } else if (label.includes('জন্ম তারিখ') || lower.includes('date of birth')) {
        result.motherDob = toEnglishDigits(value);
      } else if (label.includes('এনআইডি') || lower.includes('nid')) {
        result.motherNid = toEnglishDigits(value).replace(/\D/g, '');
      } else {
        extraFields.push({ id: crypto.randomUUID(), label, value });
      }
      continue;
    }

    if (currentSection === 'address') {
      if (label.includes('বিভাগ') || lower.includes('division')) {
        result.division = value;
      } else if (label.includes('জেলা') || lower.includes('district')) {
        result.district = value;
      } else if (label.includes('সিটি কর্পোরেশন') || label.includes('উপজেলা') || lower.includes('upazila')) {
        result.upazila = value;
      } else if (label.includes('ইউনিয়ন') || label.includes('পৌরসভা') || lower.includes('union')) {
        result.unionOrPourashava = value;
      } else if (label.includes('ওয়ার্ড নং') || label.includes('ওয়ার্ড নং') || lower.includes('ward no')) {
        result.wardNo = toEnglishDigits(value);
      } else if (label.includes('ডাকঘর')) {
        result.postOfficeBn = value;
      } else if (lower.includes('post office')) {
        result.postOfficeEn = value;
      } else if (label.includes('গ্রাম')) {
        result.villageBn = value;
      } else if (lower.includes('village')) {
        result.villageEn = value;
      } else if (label.includes('বাসা/হোল্ডিং') || label.includes('হোল্ডিং') || lower.includes('house/holding') || lower.includes('holding no')) {
        // Always keep house/holding fields empty per user specification
        continue;
      } else {
        extraFields.push({ id: crypto.randomUUID(), label, value });
      }
      continue;
    }

    // Personal section
    if (label.includes('নাম (বাংলা)')) {
      result.nameBn = value;
    } else if (lower.includes('name (english)')) {
      result.nameEn = sanitizeEnglishName(value).trim();
    } else if (label.includes('কততম সন্তান') || lower.includes('birth order')) {
      result.birthOrder = toEnglishDigits(value);
    } else if (label.includes('লিঙ্গ') || lower.includes('gender')) {
      if (/পুরুষ|male|boy|ছেলে/i.test(value)) result.gender = 'পুরুষ';
      else if (/মহিলা|female|girl|মেয়ে|নারী/i.test(value)) result.gender = 'মহিলা';
      else if (/তৃতীয়|তৃতীয়|other/i.test(value)) result.gender = 'তৃতীয় লিঙ্গ';
    } else if (label.includes('মোবাইল') || lower.includes('mobile') || lower.includes('phone')) {
      result.mobile = toEnglishDigits(value).replace(/\s+/g, '');
    } else if (label.includes('জন্ম তারিখ') || lower.includes('date of birth')) {
      result.dob = toEnglishDigits(value);
    } else if (label.includes('ধর্ম') || lower.includes('religion')) {
      result.religion = value;
    } else {
      extraFields.push({ id: crypto.randomUUID(), label, value });
    }
  }

  if (extraFields.length > 0) {
    result.customFields = extraFields;
  }

  return result;
}

export function formatAsTemplateText(data: BdrisFormData): string {
  const customBlock =
    data.customFields.length > 0
      ? `\n[ অন্যান্য তথ্য / Additional Details ]\n--------------------------------------------------\n` +
        data.customFields.map((f) => `${f.label}: ${f.value}`).join('\n')
      : '';

  return `নতুন জন্ম নিবন্ধনের তথ্য ফরম
==================================================

[ ব্যক্তিগত তথ্য / Personal Information ]
--------------------------------------------------
নাম (বাংলা): ${data.nameBn}
Name (English): ${data.nameEn}
বাবা-মায়ের কততম সন্তান: ${data.birthOrder}
লিঙ্গ: ${data.gender}
মোবাইল নম্বর: ${data.mobile}
জন্ম তারিখ (Date of Birth): ${data.dob}

[ ঠিকানার বিবরণ / Address Details ]
--------------------------------------------------
বিভাগ: ${data.division}
জেলা: ${data.district}
সিটি কর্পোরেশন/উপজেলা: ${data.upazila}
ইউনিয়ন/পৌরসভা/ওয়ার্ড: ${data.unionOrPourashava}
ওয়ার্ড নং: ${data.wardNo}

ডাকঘর (বাংলা): ${data.postOfficeBn}
Post Office (English): ${data.postOfficeEn}
গ্রাম (বাংলা): ${data.villageBn}
Village (English): ${data.villageEn}
বাসা/হোল্ডিং নং: ${data.holdingNoBn}
House/Holding No: ${data.holdingNoEn}

[ পিতার তথ্য / Father's Information ]
--------------------------------------------------
পিতার নাম (বাংলা): ${data.fatherNameBn}
Father's Name (English): ${data.fatherNameEn}
জন্ম নিবন্ধন নম্বর (১৭ ডিজিট): ${data.fatherBrn}
জন্ম তারিখ (Date of Birth): ${data.fatherDob}
এনআইডি নম্বর (NID No): ${data.fatherNid}

[ মাতার তথ্য / Mother's Information ]
--------------------------------------------------
মাতার নাম (বাংলা): ${data.motherNameBn}
Mother's Name (English): ${data.motherNameEn}
জন্ম নিবন্ধন নম্বর (১৭ ডিজিট): ${data.motherBrn}
জন্ম তারিখ (Date of Birth): ${data.motherDob}
এনআইডি নম্বর (NID No): ${data.motherNid}${customBlock}`;
}

/**
 * Builds the self-contained JavaScript auto-filler executed directly on https://bdris.gov.bd.
 * Handles cascading AJAX dropdowns (Division -> District -> Upazila -> Union -> Ward),
 * context-scoped inputs (Person vs Father vs Mother), date normalization, and an on-page HUD.
 */
export function generateBdrisAutoFillScript(
  data: BdrisFormData,
  useWindowGlobal = false,
  documents?: BdrisDocumentsBundle
): string {
  const cleanPayload = {
    ...data,
    nameEn: sanitizeEnglishName(data.nameEn).trim(),
    fatherNameEn: sanitizeEnglishName(data.fatherNameEn).trim(),
    motherNameEn: sanitizeEnglishName(data.motherNameEn).trim(),
    holdingNoBn: '',
    holdingNoEn: '',
    mobile: toEnglishDigits(data.mobile),
    dob: toEnglishDigits(data.dob),
    wardNo: toEnglishDigits(data.wardNo),
    birthOrder: toEnglishDigits(data.birthOrder).replace(/[^\d]/g, '') || data.birthOrder,
    fatherBrn: toEnglishDigits(data.fatherBrn).replace(/\D/g, ''),
    fatherDob: toEnglishDigits(data.fatherDob),
    fatherNid: toEnglishDigits(data.fatherNid).replace(/\D/g, ''),
    motherBrn: toEnglishDigits(data.motherBrn).replace(/\D/g, ''),
    motherDob: toEnglishDigits(data.motherDob),
    motherNid: toEnglishDigits(data.motherNid).replace(/\D/g, ''),
  };

  const docsPayload: BdrisDocumentsBundle = {
    mode: documents?.mode ?? 'child_2012_2026',
    epiCard: documents?.epiCard ?? null,
    fatherCert: documents?.fatherCert ?? null,
    motherCert: documents?.motherCert ?? null,
    nidCard: documents?.nidCard ?? null,
    attestationDoc: documents?.attestationDoc ?? null,
    reuseSingleForBoth: documents?.reuseSingleForBoth ?? true,
  };

  const jsonData = JSON.stringify(cleanPayload);
  const jsonDocs = JSON.stringify(docsPayload);
  const dataInit = useWindowGlobal
    ? `var D = window.__BDRIS_SMARTFORM_DATA || ${jsonData};\n  var DOCS = window.__BDRIS_SMARTFORM_DOCS || ${jsonDocs};`
    : `var D = ${jsonData};\n  var DOCS = ${jsonDocs};`;

  return `(function(){
  ${dataInit}
  var BN = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  function toEn(s){ return String(s||'').replace(/[০-৯]/g,function(c){ var i=BN.indexOf(c); return i>=0?String(i):c; }); }
  function norm(s){ return toEn(String(s||'')).toLowerCase().replace(/[*:()\\[\\]\\-_\\s/]+/g,' ').trim(); }
  function cleanEnName(s){ return String(s||'').replace(/\\./g,' ').replace(/[^A-Za-z\\s]/g,' ').replace(/\\s+/g,' ').trim(); }
  function splitNameParts(name){
    var parts = String(name||'').trim().split(/\\s+/).filter(Boolean);
    if(parts.length === 0) return { first: '', last: '' };
    if(parts.length === 1) return { first: '', last: parts[0] };
    if(parts.length === 2) return { first: parts[0], last: parts[1] };
    return { first: parts.slice(0, parts.length - 1).join(' '), last: parts[parts.length - 1] };
  }
  function ddmmyyyyToIso(s){
    var m = /^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(toEn(String(s||'').trim()));
    return m ? (m[3]+'-'+m[2]+'-'+m[1]) : '';
  }

  function fireEvents(el){
    if(!el) return;
    ['input','change','blur'].forEach(function(evt){
      try { el.dispatchEvent(new Event(evt, {bubbles:true})); } catch(e){}
    });
    if(window.jQuery){
      try { window.jQuery(el).trigger('change'); } catch(e){}
    }
  }

  function setVal(el, val){
    if(!el || val === undefined || val === null || val === '') return false;
    var tag = el.tagName.toLowerCase();
    var targetVal = String(val);
    if(tag === 'input' && el.type === 'date'){
      var iso = ddmmyyyyToIso(targetVal);
      if(iso) targetVal = iso;
    }
    var proto = tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if(desc && desc.set){ desc.set.call(el, targetVal); } else { el.value = targetVal; }
    fireEvents(el);
    el.style.outline = '2px solid #059669';
    return true;
  }

  function selectMatch(sel, target){
    if(!sel || !target) return false;
    var tNorm = norm(target);
    var opts = Array.prototype.slice.call(sel.options || []);
    var found = opts.find(function(o){
      var ot = norm(o.textContent);
      var ov = norm(o.value);
      return ot === tNorm || ov === tNorm;
    }) || opts.find(function(o){
      var ot = norm(o.textContent);
      return ot && tNorm && (ot.indexOf(tNorm) !== -1 || tNorm.indexOf(ot) !== -1);
    });
    if(found){
      sel.value = found.value;
      fireEvents(sel);
      sel.style.outline = '2px solid #059669';
      return true;
    }
    return false;
  }

  function getContextText(el){
    var parts = [];
    if(el.id){
      try {
        var lbl = document.querySelector('label[for="'+CSS.escape(el.id)+'"]');
        if(lbl) parts.push(lbl.textContent);
      } catch(e){}
    }
    var pLabel = el.closest('label');
    if(pLabel) parts.push(pLabel.textContent);

    // Climb up only while container holds this single field (avoids Father/Mother sibling leak!)
    var cur = el.parentElement;
    var singleBox = null;
    for(var depth = 0; depth < 4 && cur; depth++){
      var controls = cur.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
      if(controls.length <= 1){
        singleBox = cur;
        cur = cur.parentElement;
      } else {
        break;
      }
    }
    if(singleBox){
      singleBox.querySelectorAll('label, .control-label, .form-label, span, small').forEach(function(l){
        if(!l.contains(el)) parts.push(l.textContent);
      });
    }
    var td = el.closest('td');
    if(td && td.previousElementSibling && td.previousElementSibling.tagName === 'TH'){
      parts.push(td.previousElementSibling.textContent);
    }

    var sec = el.closest('fieldset, section, .card, .panel, .tab-pane');
    var secHeader = '';
    if(sec){
      var h = sec.querySelector('legend, h1, h2, h3, h4, h5, .card-header, .panel-heading');
      if(h) secHeader = h.textContent;
    }

    var rawAttr = [el.name, el.id, el.getAttribute('data-field')].filter(Boolean).join(' ');
    return {
      rawAttr: rawAttr,
      attr: norm([el.name, el.id, el.placeholder, el.getAttribute('aria-label')].join(' ')),
      label: norm(parts.join(' ')),
      section: norm(secHeader)
    };
  }

  function isEngField(ctx){
    if(/(En|Eng|English)$|(_|-|\\b)(en|eng|english)(\\b|_|-)/i.test(ctx.rawAttr)) return true;
    var combined = ctx.attr + ' ' + ctx.label;
    return /\\b(en|eng|english)\\b|ইংরেজি/.test(combined);
  }

  function resolveParentRole(ctx){
    if(/mother|mata|matar/i.test(ctx.rawAttr + ' ' + ctx.attr)) return 'mother';
    if(/father|pita|pitar/i.test(ctx.rawAttr + ' ' + ctx.attr)) return 'father';
    var hasMotherLbl = /mother|মাতা|মায়ের|মায়ের/.test(ctx.label);
    var hasFatherLbl = /father|পিতা|পিতার|বাবা/.test(ctx.label);
    if(hasMotherLbl && !hasFatherLbl) return 'mother';
    if(hasFatherLbl && !hasMotherLbl) return 'father';
    var hasMotherSec = /mother|মাতা|মায়ের|মায়ের/.test(ctx.section);
    var hasFatherSec = /father|পিতা|পিতার|বাবা/.test(ctx.section);
    if(hasMotherSec && !hasFatherSec) return 'mother';
    if(hasFatherSec && !hasMotherSec) return 'father';
    return 'person';
  }

  function triggerVerifyForAnchor(anchorEl, roleName, forceClick){
    if(!anchorEl) return false;
    var cur = anchorEl.parentElement;
    var bestScope = null;
    for(var depth = 0; depth < 5 && cur; depth++){
      if(cur.closest('#bdris-smartform-hud')) break;
      var txt = norm(cur.textContent || '');
      var hasBothParents = (/father|পিতা/.test(txt) && /mother|মাতা/.test(txt));
      if(hasBothParents) break;
      bestScope = cur;
      var btns = cur.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn');
      if(btns.length > 0){
        for(var i = 0; i < btns.length; i++){
          var b = btns[i];
          if(b.closest('#bdris-smartform-hud')) continue;
          var bText = norm((b.textContent || b.value || b.title || b.getAttribute('aria-label') || ''));
          if(/খুঁজুন|খুজুন|যাচাই|verify|search|find|অন্বেষণ|check/.test(bText)){
            if(forceClick || !b.dataset.bdrisSfVerified){
              b.dataset.bdrisSfVerified = roleName;
              (function(targetBtn){
                setTimeout(function(){
                  try {
                    targetBtn.style.outline = '2px solid #0284c7';
                    targetBtn.click();
                  } catch(e){}
                }, 180);
              })(b);
              return true;
            }
          }
        }
      }
      cur = cur.parentElement;
    }
    return false;
  }

  function docToFile(doc){
    if(!doc || !doc.base64) return null;
    try {
      var bin = atob(doc.base64);
      var len = bin.length;
      var arr = new Uint8Array(len);
      for(var i = 0; i < len; i++){ arr[i] = bin.charCodeAt(i); }
      return new File([arr], doc.name || 'document.jpg', { type: doc.mimeType || 'image/jpeg' });
    } catch(e){
      return null;
    }
  }

  function attachFileToInput(fileInput, doc){
    if(!fileInput || !doc) return false;
    var fileObj = docToFile(doc);
    if(!fileObj) return false;
    try {
      var dt = new DataTransfer();
      dt.items.add(fileObj);
      fileInput.files = dt.files;
      fireEvents(fileInput);
      fileInput.style.outline = '2px solid #059669';
      if(fileInput.parentElement){
        fileInput.parentElement.style.outline = '1px dashed #059669';
      }
      return true;
    } catch(e){
      return false;
    }
  }

  function getFileInputContext(fileEl){
    var ctx = getContextText(fileEl);
    var extra = [ctx.attr, ctx.label, ctx.section];
    var cur = fileEl.parentElement;
    for(var d = 0; d < 3 && cur; d++){
      var fInputs = cur.querySelectorAll('input[type="file"]');
      if(fInputs.length <= 1){
        extra.push(norm(cur.textContent || ''));
        cur = cur.parentElement;
      } else {
        break;
      }
    }
    return extra.join(' ');
  }

  function attachDocuments(modeOverride){
    if(!DOCS) return 0;
    var allProvided = [DOCS.epiCard, DOCS.fatherCert, DOCS.motherCert, DOCS.nidCard, DOCS.attestationDoc].filter(Boolean);
    var singleFallback = DOCS.reuseSingleForBoth && allProvided.length > 0 ? allProvided[0] : null;
    var isAdultMode = DOCS.mode === 'adult_pre_2012';

    var epiOrAttestDoc = isAdultMode
      ? (DOCS.attestationDoc || DOCS.nidCard || singleFallback)
      : (DOCS.epiCard || DOCS.attestationDoc || singleFallback);
    var nidOrIdDoc = DOCS.nidCard || DOCS.attestationDoc || singleFallback;
    var fatherDoc = isAdultMode ? nidOrIdDoc : (DOCS.fatherCert || DOCS.motherCert || singleFallback);
    var motherDoc = isAdultMode ? nidOrIdDoc : (DOCS.motherCert || DOCS.fatherCert || singleFallback);
    var anyParentOrIdDoc = isAdultMode ? nidOrIdDoc : (fatherDoc || motherDoc || singleFallback);

    if(!epiOrAttestDoc && !anyParentOrIdDoc && !nidOrIdDoc) return 0;

    var fileInputs = Array.prototype.slice.call(document.querySelectorAll('input[type="file"]')).filter(function(f){
      return !f.closest('#bdris-smartform-hud');
    });
    if(fileInputs.length === 0) return 0;

    var attachedCount = 0;
    var unmatched = [];

    fileInputs.forEach(function(fEl){
      var ctxStr = getFileInputContext(fEl);
      var targetDoc = null;

      if(modeOverride === 'attestation'){
        if(/প্রত্যয়ন|টিকা|ইপিআই|epi|attestation|hospital|ডাক্তার|birth.*proof|medical|সনদ/.test(ctxStr)){
          targetDoc = epiOrAttestDoc;
        }
      } else if(modeOverride === 'parents'){
        if(/পিতা|মাতা|father|mother|parent|প্রমাণ|proof|nid|জাতীয়|জাতীয়|পরিচয়/.test(ctxStr)){
          targetDoc = anyParentOrIdDoc;
        }
      } else {
        if(/প্রত্যয়ন|টিকা|ইপিআই|epi|attestation|hospital|ডাক্তার|birth.*proof|medical/.test(ctxStr)){
          targetDoc = epiOrAttestDoc;
        } else if(/nid|জাতীয় পরিচয়|জাতীয় পরিচয়|পরিচয়পত্র/.test(ctxStr)){
          targetDoc = nidOrIdDoc;
        } else if(/মাতা|mother/.test(ctxStr) && !/পিতা|father/.test(ctxStr)){
          targetDoc = motherDoc;
        } else if(/পিতা|father|parent|অভিভাবক|প্রমাণ|proof/.test(ctxStr)){
          targetDoc = anyParentOrIdDoc;
        }
      }

      if(targetDoc){
        if(attachFileToInput(fEl, targetDoc)) attachedCount++;
      } else {
        unmatched.push(fEl);
      }
    });

    if(attachedCount === 0 && unmatched.length > 0){
      if(modeOverride === 'attestation' && epiOrAttestDoc){
        if(attachFileToInput(unmatched[0], epiOrAttestDoc)) attachedCount++;
      } else if(modeOverride === 'parents' && anyParentOrIdDoc){
        var targetSlot = unmatched.length > 1 ? unmatched[1] : unmatched[0];
        if(attachFileToInput(targetSlot, anyParentOrIdDoc)) attachedCount++;
      } else {
        var orderedDocs = [];
        if(DOCS.reuseSingleForBoth && singleFallback && allProvided.length === 1){
          orderedDocs = [singleFallback, singleFallback];
        } else if(isAdultMode){
          orderedDocs = [epiOrAttestDoc, nidOrIdDoc].filter(Boolean);
        } else {
          orderedDocs = [epiOrAttestDoc, fatherDoc, motherDoc].filter(Boolean);
        }
        unmatched.forEach(function(fEl, idx){
          if(orderedDocs[idx] && attachFileToInput(fEl, orderedDocs[idx])){
            attachedCount++;
          }
        });
      }
    }

    return attachedCount;
  }

  var lastFatherAnchor = null;
  var lastMotherAnchor = null;

  function runFill(){
    var filledCount = 0;
    lastFatherAnchor = null;
    lastMotherAnchor = null;

    var nameBnParts = splitNameParts(D.nameBn);
    var cleanEn = cleanEnName(D.nameEn);
    var nameEnParts = splitNameParts(cleanEn);
    var fatherCleanEn = cleanEnName(D.fatherNameEn);
    var motherCleanEn = cleanEnName(D.motherNameEn);

    var inputs = Array.prototype.slice.call(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea'));
    inputs.forEach(function(el){
      if(el.closest('#bdris-smartform-hud')) return;
      var ctx = getContextText(el);
      var all = ctx.attr + ' ' + ctx.label;
      var eng = isEngField(ctx);
      var role = resolveParentRole(ctx);
      var isFirst = /first.*name|প্রথম.*অংশ|pratham|given.*name/.test(all);
      var isLast = /last.*name|শেষ.*অংশ|shesh|sur.*name/.test(all);

      if(role === 'father'){
        var fBnParts = splitNameParts(D.fatherNameBn);
        var fEnParts = splitNameParts(fatherCleanEn);
        if(/brn|birth.*reg|জন্ম নিবন্ধন/.test(all)){
          lastFatherAnchor = el;
          if(setVal(el, D.fatherBrn)) filledCount++;
        } else if((/nid|national.*id|এনআইডি|জাতীয় পরিচয়|জাতীয় পরিচয়/.test(all)) && setVal(el, D.fatherNid)){
          filledCount++;
        } else if(/dob|birth.*date|জন্ম তারিখ/.test(all)){
          if(!lastFatherAnchor) lastFatherAnchor = el;
          if(setVal(el, D.fatherDob)) filledCount++;
        } else if(/name|নাম/.test(all) || /বাংলা|english|ইংরেজি/.test(all)){
          var fVal = eng
            ? (isFirst ? fEnParts.first : (isLast ? fEnParts.last : fatherCleanEn))
            : (isFirst ? fBnParts.first : (isLast ? fBnParts.last : D.fatherNameBn));
          if(setVal(el, fVal)) filledCount++;
        }
        return;
      }

      if(role === 'mother'){
        var mBnParts = splitNameParts(D.motherNameBn);
        var mEnParts = splitNameParts(motherCleanEn);
        if(/brn|birth.*reg|জন্ম নিবন্ধন/.test(all)){
          lastMotherAnchor = el;
          if(setVal(el, D.motherBrn)) filledCount++;
        } else if((/nid|national.*id|এনআইডি|জাতীয় পরিচয়|জাতীয় পরিচয়/.test(all)) && setVal(el, D.motherNid)){
          filledCount++;
        } else if(/dob|birth.*date|জন্ম তারিখ/.test(all)){
          if(!lastMotherAnchor) lastMotherAnchor = el;
          if(setVal(el, D.motherDob)) filledCount++;
        } else if(/name|নাম/.test(all) || /বাংলা|english|ইংরেজি/.test(all)){
          var mVal = eng
            ? (isFirst ? mEnParts.first : (isLast ? mEnParts.last : motherCleanEn))
            : (isFirst ? mBnParts.first : (isLast ? mBnParts.last : D.motherNameBn));
          if(setVal(el, mVal)) filledCount++;
        }
        return;
      }

      // Skip House/Holding fields always (kept empty per requirement)
      if(/house|holding|বাসা|হোল্ডিং|বাড়ি|বাড়ি/.test(all) && !/গ্রাম|village/.test(all)){
        return;
      }

      // Personal & Address fields
      if(/name|নাম|প্রথম.*অংশ|শেষ.*অংশ|first.*name|last.*name/.test(all) && !/post.*office|ডাকঘর|village|গ্রাম|union|ইউনিয়ন|উপজেলা/.test(all)){
        var pVal = eng
          ? (isFirst ? nameEnParts.first : (isLast ? nameEnParts.last : cleanEn))
          : (isFirst ? nameBnParts.first : (isLast ? nameBnParts.last : D.nameBn));
        if(setVal(el, pVal)) filledCount++;
      }
      else if((/birth.*order|order.*birth|কততম সন্তান|সন্তানের ক্রম/.test(all)) && setVal(el, D.birthOrder)) filledCount++;
      else if((/mobile|phone|মোবাইল/.test(all)) && setVal(el, D.mobile)) filledCount++;
      else if((/dob|birth.*date|date.*birth|জন্ম তারিখ/.test(all)) && setVal(el, D.dob)) filledCount++;
      else if((/post.*office|ডাকঘর/.test(all) && eng) && setVal(el, D.postOfficeEn)) filledCount++;
      else if((/post.*office|ডাকঘর/.test(all) && !eng) && setVal(el, D.postOfficeBn)) filledCount++;
      else if((/village|mahalla|গ্রাম|মহল্লা/.test(all) && eng) && setVal(el, D.villageEn)) filledCount++;
      else if((/village|mahalla|গ্রাম|মহল্লা/.test(all) && !eng) && setVal(el, D.villageBn)) filledCount++;
      else if((/ward|ওয়ার্ড|ওয়ার্ড/.test(all)) && setVal(el, D.wardNo)) filledCount++;
    });

    // Auto-verify Father & Mother BRN if BRN + DOB present
    if(D.fatherBrn && D.fatherDob && lastFatherAnchor){
      triggerVerifyForAnchor(lastFatherAnchor, 'father', false);
    }
    if(D.motherBrn && D.motherDob && lastMotherAnchor){
      triggerVerifyForAnchor(lastMotherAnchor, 'mother', false);
    }

    // Selects: Gender, Religion, Birth Order, Nationality & Cascading Address
    var selects = Array.prototype.slice.call(document.querySelectorAll('select'));
    var chainTargets = [
      { test: /division|বিভাগ/, val: D.division },
      { test: /district|জেলা/, val: D.district },
      { test: /upazila|city.*corp|উপজেলা|সিটি কর্পোরেশন/, val: D.upazila },
      { test: /union|pourashava|paurashava|ইউনিয়ন|ইউনিয়ন|পৌরসভা/, val: D.unionOrPourashava },
      { test: /ward|ওয়ার্ড|ওয়ার্ড/, val: D.wardNo }
    ];

    selects.forEach(function(sel){
      if(sel.closest('#bdris-smartform-hud')) return;
      var ctx = getContextText(sel);
      var all = ctx.attr + ' ' + ctx.label;
      if(/gender|sex|লিঙ্গ/.test(all)){
        var gVal = D.gender === 'পুরুষ' ? 'Male' : (D.gender === 'মহিলা' ? 'Female' : 'Other');
        if(selectMatch(sel, D.gender) || selectMatch(sel, gVal)) filledCount++;
      } else if(/religion|ধর্ম/.test(all) && D.religion){
        if(selectMatch(sel, D.religion)) filledCount++;
      } else if(/birth.*order|order.*birth|কততম সন্তান/.test(all) && D.birthOrder){
        if(selectMatch(sel, D.birthOrder)) filledCount++;
      } else if(/nationality|জাতীয়তা|জাতীয়তা/.test(all)){
        if(selectMatch(sel, 'বাংলাদেশী') || selectMatch(sel, 'Bangladeshi')) filledCount++;
      } else if(/country|দেশ/.test(all)){
        if(selectMatch(sel, D.birthPlaceCountry || 'বাংলাদেশ') || selectMatch(sel, 'Bangladesh')) filledCount++;
      }
    });

    // Sequential AJAX Cascade for Division -> District -> Upazila -> Union -> Ward
    function runCascade(idx){
      if(idx >= chainTargets.length) return;
      var step = chainTargets[idx];
      if(!step.val){ runCascade(idx + 1); return; }
      var matchedSelects = selects.filter(function(sel){
        var ctx = getContextText(sel);
        return step.test.test(ctx.attr + ' ' + ctx.label);
      });
      if(matchedSelects.length === 0){ runCascade(idx + 1); return; }

      var tries = 0;
      var timer = setInterval(function(){
        tries++;
        var anyMatched = false;
        matchedSelects.forEach(function(sel){
          if(sel.options && sel.options.length > 1){
            if(selectMatch(sel, step.val)) anyMatched = true;
          }
        });
        if(anyMatched || tries > 20){
          clearInterval(timer);
          setTimeout(function(){ runCascade(idx + 1); }, 350);
        }
      }, 250);
    }
    runCascade(0);

    var attachedCount = attachDocuments();
    showHud(filledCount, attachedCount);
  }

  function showHud(count, attachedCount){
    var existing = document.getElementById('bdris-smartform-hud');
    if(existing) existing.remove();
    var hasDocs = Boolean(DOCS && (DOCS.epiCard || DOCS.fatherCert || DOCS.motherCert || DOCS.nidCard || DOCS.attestationDoc));
    var hasVerify = Boolean((D.fatherBrn && D.fatherDob) || (D.motherBrn && D.motherDob));
    var hud = document.createElement('div');
    hud.id = 'bdris-smartform-hud';
    hud.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;background:#0f172a;color:#f8fafc;padding:14px 16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.28);font-family:system-ui,sans-serif;font-size:13px;max-width:340px;border:1px solid #334155;';
    hud.innerHTML = '<div style="font-weight:700;color:#34d399;margin-bottom:4px;">BDRIS SmartForm Auto-Fill</div>' +
      '<div style="margin-bottom:10px;line-height:1.45;">আবেদনকারী: <b>'+(D.nameBn || D.nameEn || 'প্রোফাইল')+'</b><br/>ফিল্ড পূরণ: <b>'+count+'</b> টি' +
      (hasDocs ? ' · ফাইল অ্যাটাচ: <b>'+attachedCount+'</b> টি' : '') +
      '<br/><span style="color:#94a3b8;font-size:11px;">বাসা/হোল্ডিং ফাঁকা রাখা হয়েছে। ক্যাপচা ও ওটিপি যাচাই করে সাবমিট করুন।</span></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
      '<button id="bdris-sf-refill" style="flex:1;background:#059669;color:#fff;border:none;padding:7px 10px;border-radius:6px;cursor:pointer;font-weight:600;">আবার ফিলাপ</button>' +
      (hasVerify ? '<button id="bdris-sf-verify" style="background:#0284c7;color:#fff;border:none;padding:7px 10px;border-radius:6px;cursor:pointer;font-weight:600;">যাচাই ক্লিক</button>' : '') +
      (hasDocs ? '<button id="bdris-sf-attach-all" style="background:#0f766e;color:#fff;border:none;padding:7px 10px;border-radius:6px;cursor:pointer;font-weight:600;">ফাইল অ্যাটাচ</button>' : '') +
      '<button id="bdris-sf-close" style="background:#334155;color:#e2e8f0;border:none;padding:7px 10px;border-radius:6px;cursor:pointer;">বন্ধ</button>' +
      '</div>';
    document.body.appendChild(hud);
    document.getElementById('bdris-sf-refill').onclick = runFill;
    if(hasVerify && document.getElementById('bdris-sf-verify')){
      document.getElementById('bdris-sf-verify').onclick = function(){
        if(D.fatherBrn && D.fatherDob && lastFatherAnchor) triggerVerifyForAnchor(lastFatherAnchor, 'father', true);
        if(D.motherBrn && D.motherDob && lastMotherAnchor) triggerVerifyForAnchor(lastMotherAnchor, 'mother', true);
      };
    }
    if(hasDocs && document.getElementById('bdris-sf-attach-all')){
      document.getElementById('bdris-sf-attach-all').onclick = function(){
        var c = attachDocuments();
        showHud(count, c);
      };
    }
    document.getElementById('bdris-sf-close').onclick = function(){ hud.remove(); };
  }

  runFill();
})();`;
}

export function generateBookmarkletUrl(
  data: BdrisFormData,
  documents?: BdrisDocumentsBundle
): string {
  const script = generateBdrisAutoFillScript(data, false, documents)
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ');
  return `javascript:${encodeURIComponent(script)}`;
}

export function generateUserscript(
  data: BdrisFormData,
  documents?: BdrisDocumentsBundle
): string {
  const script = generateBdrisAutoFillScript(data, false, documents);
  return `// ==UserScript==
// @name         BDRIS SmartForm Auto-Fill (${data.nameEn || data.nameBn || 'Applicant'})
// @namespace    https://bdris.gov.bd/
// @version      2.1
// @description  Auto-fills BDRIS birth registration form fields on bdris.gov.bd
// @match        https://bdris.gov.bd/*
// @match        https://*.bdris.gov.bd/*
// @grant        none
// ==/UserScript==

window.addEventListener('load', function() {
  setTimeout(function() {
    ${script}
  }, 800);
});
`;
}

export async function generateChromeExtensionZip(
  data: BdrisFormData,
  serverOrigin: string,
  syncKey: string,
  documents?: BdrisDocumentsBundle
): Promise<Blob> {
  const zip = new JSZip();
  const payloadJson = JSON.stringify(data, null, 2);
  const docsJson = JSON.stringify(documents || { reuseSingleForBoth: true });
  const cleanOrigin = serverOrigin.replace(/\/+$/, '');

  const hostPermissions = Array.from(
    new Set([
      'https://bdris.gov.bd/*',
      'https://*.bdris.gov.bd/*',
      'https://aistudio.google.com/*',
      'https://*.run.app/*',
      'https://*.netlify.app/*',
      'https://*.vercel.app/*',
      'https://*.web.app/*',
      'https://*.firebaseapp.com/*',
      'https://*.pages.dev/*',
      'http://localhost:3000/*',
      'https://*/*',
      ...(cleanOrigin ? [`${cleanOrigin}/*`] : []),
    ])
  );

  const bridgeMatches = Array.from(
    new Set([
      'https://*.run.app/*',
      'https://*.netlify.app/*',
      'https://*.vercel.app/*',
      'https://*.web.app/*',
      'https://*.firebaseapp.com/*',
      'https://*.pages.dev/*',
      'http://localhost:3000/*',
      ...(cleanOrigin && cleanOrigin.startsWith('http') ? [`${cleanOrigin}/*`] : []),
    ])
  );

  const manifest = {
    manifest_version: 3,
    name: 'BDRIS SmartForm Live Auto-Fill',
    version: '3.2.0',
    description:
      'One-time install extension that syncs live with BDRIS SmartForm (Netlify, AI Studio, Cloud Run & local) and auto-fills bdris.gov.bd.',
    permissions: ['activeTab', 'scripting', 'storage', 'tabs'],
    host_permissions: hostPermissions,
    background: {
      service_worker: 'background.js',
    },
    content_scripts: [
      {
        matches: ['https://bdris.gov.bd/*', 'https://*.bdris.gov.bd/*'],
        js: ['auto-runner.js'],
        run_at: 'document_idle',
      },
      {
        matches: bridgeMatches,
        js: ['bridge.js'],
        run_at: 'document_idle',
        all_frames: true,
      },
    ],
    action: {
      default_popup: 'popup.html',
      default_title: 'BDRIS SmartForm Live Auto-Fill',
    },
  };

  const bridgeJs = `(function(){
  if (window.__BDRIS_BRIDGE_LOADED) {
    try {
      window.postMessage({ type: 'BDRIS_SMARTFORM_BRIDGE_ACK', ok: true, version: '3.2.0' }, '*');
    } catch (e) {}
    return;
  }
  window.__BDRIS_BRIDGE_LOADED = true;

  var STORAGE_SYNC_KEY = 'bdris_smartform_sync_key_v1';
  var STORAGE_PAYLOAD_KEY = 'bdris_smartform_bridge_payload_v1';

  function isAppWindow() {
    try {
      return Boolean(
        localStorage.getItem(STORAGE_SYNC_KEY) ||
        localStorage.getItem(STORAGE_PAYLOAD_KEY) ||
        localStorage.getItem('bdris_smartform_active_draft_v1') ||
        document.title.indexOf('BDRIS') !== -1
      );
    } catch (e) {
      return false;
    }
  }

  function safeSend(msg, cb) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage(msg, function(res) {
          void chrome.runtime.lastError;
          if (cb) cb(res);
        });
      }
    } catch (e) {}
  }

  function syncKeyToExtension() {
    try {
      var key = localStorage.getItem(STORAGE_SYNC_KEY);
      if (key && key.length >= 8) {
        safeSend({
          type: 'BRIDGE_SYNC_KEY',
          syncKey: key,
          serverUrl: window.location.origin
        });
      }
    } catch (e) {}
  }

  function pushPayloadToExtension(payload, ackBack) {
    if (!payload || !payload.data) return;
    var key = '';
    try { key = localStorage.getItem(STORAGE_SYNC_KEY) || ''; } catch (e) {}
    safeSend({
      type: 'BRIDGE_PUSH_PAYLOAD',
      payload: payload,
      syncKey: key,
      serverUrl: window.location.origin
    }, function(res) {
      if (ackBack) {
        window.postMessage({
          type: 'BDRIS_SMARTFORM_BRIDGE_ACK',
          ok: Boolean(res && res.ok),
          version: '3.2.0',
          pushed: true
        }, '*');
      }
    });
  }

  window.addEventListener('message', function(ev) {
    if (!ev.data || typeof ev.data !== 'object') return;
    if (ev.data.type === 'BDRIS_SMARTFORM_PING_BRIDGE') {
      syncKeyToExtension();
      window.postMessage({ type: 'BDRIS_SMARTFORM_BRIDGE_ACK', ok: true, version: '3.2.0' }, '*');
      return;
    }
    if (ev.data.type === 'BDRIS_SMARTFORM_LIVE_PUSH' && ev.data.payload) {
      pushPayloadToExtension(ev.data.payload, true);
    }
  });

  window.addEventListener('storage', function(ev) {
    if (ev.key === STORAGE_SYNC_KEY && ev.newValue) {
      syncKeyToExtension();
    } else if (ev.key === STORAGE_PAYLOAD_KEY && ev.newValue) {
      try {
        var parsed = JSON.parse(ev.newValue);
        if (parsed && parsed.data) pushPayloadToExtension(parsed, false);
      } catch (e) {}
    }
  });

  if (isAppWindow()) {
    syncKeyToExtension();
    try {
      var initialPayload = localStorage.getItem(STORAGE_PAYLOAD_KEY);
      if (initialPayload) {
        var parsedInit = JSON.parse(initialPayload);
        if (parsedInit && parsedInit.data) {
          pushPayloadToExtension(parsedInit, false);
        }
      }
    } catch (e) {}
    window.postMessage({ type: 'BDRIS_SMARTFORM_BRIDGE_ACK', ok: true, version: '3.2.0' }, '*');
  }
})();`;

  const backgroundJs = `var DEFAULT_SERVER = ${JSON.stringify(cleanOrigin)};
var DEFAULT_KEY = ${JSON.stringify(syncKey)};
var MEM_CACHE = { item: null, queue: [] };

function normalizeOrigin(url) {
  return String(url || DEFAULT_SERVER).trim().replace(/\\/+$/, '');
}

function getCandidateOrigins(base) {
  var clean = normalizeOrigin(base);
  var list = [];
  if (clean) list.push(clean);
  if (clean.indexOf('ais-dev-') !== -1) {
    list.push(clean.replace('ais-dev-', 'ais-pre-'));
  } else if (clean.indexOf('ais-pre-') !== -1) {
    list.push(clean.replace('ais-pre-', 'ais-dev-'));
  }
  if (DEFAULT_SERVER && list.indexOf(DEFAULT_SERVER) === -1) {
    list.push(DEFAULT_SERVER);
  }
  return Array.from(new Set(list));
}

function toTimeMs(iso) {
  var t = Date.parse(iso || '');
  return isNaN(t) ? 0 : t;
}

function isCandidateAppTab(tab) {
  if (!tab || !tab.url) return false;
  var u = tab.url;
  if (u.indexOf('http://') !== 0 && u.indexOf('https://') !== 0) return false;
  if (u.indexOf('bdris.gov.bd') !== -1) return false;
  if (
    u.indexOf('netlify.app') !== -1 ||
    u.indexOf('vercel.app') !== -1 ||
    u.indexOf('.web.app') !== -1 ||
    u.indexOf('firebaseapp.com') !== -1 ||
    u.indexOf('pages.dev') !== -1 ||
    u.indexOf('.run.app') !== -1 ||
    u.indexOf('aistudio.google.com') !== -1 ||
    u.indexOf('localhost') !== -1 ||
    (DEFAULT_SERVER && u.indexOf(DEFAULT_SERVER) === 0)
  ) {
    return true;
  }
  return Boolean(tab.title && tab.title.indexOf('BDRIS') !== -1);
}

function compactQueueForStorage(queue, keepFirstDocs) {
  return (Array.isArray(queue) ? queue : []).slice(0, 10).map(function(q, idx) {
    if (!q || typeof q !== 'object') return q;
    return {
      id: q.id,
      bdrisTrackingId: q.bdrisTrackingId || '',
      status: q.status || 'pushed',
      pushedAt: q.pushedAt || '',
      data: q.data,
      documents: (idx === 0 && keepFirstDocs) ? (q.documents || null) : null
    };
  });
}

function safeStorageSet(obj, fallbackWithoutDocs, cb) {
  chrome.storage.local.set(obj, function() {
    if (chrome.runtime.lastError && fallbackWithoutDocs) {
      chrome.storage.local.set(fallbackWithoutDocs, function() {
        void chrome.runtime.lastError;
        if (cb) cb();
      });
      return;
    }
    if (cb) cb();
  });
}

async function tryFetchServer(serverUrl, syncKey) {
  var origins = getCandidateOrigins(serverUrl);
  for (var i = 0; i < origins.length; i++) {
    var origin = origins[i];
    if (!origin || !syncKey) continue;
    try {
      var resp = await fetch(origin + '/api/sync/' + encodeURIComponent(syncKey), {
        cache: 'no-store',
        credentials: 'include'
      });
      if (!resp.ok) continue;
      var ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (ct.indexOf('application/json') === -1) continue;
      var json = await resp.json();
      if (json && typeof json === 'object') {
        json._originUsed = origin;
        return json;
      }
    } catch (e) {}
  }
  return null;
}

async function pullFromOpenAppTabs() {
  var collected = { syncKey: '', serverUrl: '', serverJson: null, bridgeItem: null, draftData: null };
  try {
    var allTabs = await chrome.tabs.query({});
    var tabs = (allTabs || []).filter(isCandidateAppTab);
    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      if (!tab || !tab.id) continue;
      try {
        var results = await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          func: async function() {
            try {
              var key = localStorage.getItem('bdris_smartform_sync_key_v1') || '';
              var payloadRaw = localStorage.getItem('bdris_smartform_bridge_payload_v1') || '';
              var draftRaw = localStorage.getItem('bdris_smartform_active_draft_v1') || '';
              if (!key && !payloadRaw && !draftRaw) return null;

              var bridgePayload = null;
              if (payloadRaw) {
                try { bridgePayload = JSON.parse(payloadRaw); } catch (e) {}
              }
              var draftData = null;
              if (draftRaw) {
                try { draftData = JSON.parse(draftRaw); } catch (e) {}
              }

              var serverJson = null;
              if (key) {
                try {
                  var controller = new AbortController();
                  var tid = setTimeout(function() { controller.abort(); }, 2000);
                  var r = await fetch('/api/sync/' + encodeURIComponent(key), {
                    cache: 'no-store',
                    credentials: 'include',
                    signal: controller.signal
                  });
                  clearTimeout(tid);
                  var ct = (r.headers.get('content-type') || '').toLowerCase();
                  if (r.ok && ct.indexOf('application/json') !== -1) {
                    serverJson = await r.json();
                  }
                } catch (e) {}
              }

              return {
                origin: window.location.origin,
                syncKey: key,
                bridgePayload: bridgePayload,
                draftData: draftData,
                serverJson: serverJson
              };
            } catch (e) {
              return null;
            }
          }
        });

        for (var j = 0; j < (results || []).length; j++) {
          var res = results[j] && results[j].result;
          if (!res) continue;
          if (res.syncKey && !collected.syncKey) collected.syncKey = res.syncKey;
          if (res.origin && !collected.serverUrl) collected.serverUrl = res.origin;
          if (res.serverJson && (res.serverJson.active || (res.serverJson.queue && res.serverJson.queue.length))) {
            if (!collected.serverJson || toTimeMs(res.serverJson.updatedAt) >= toTimeMs(collected.serverJson.updatedAt)) {
              collected.serverJson = res.serverJson;
            }
          }
          if (res.bridgePayload && res.bridgePayload.data) {
            if (!collected.bridgeItem || toTimeMs(res.bridgePayload.pushedAt) >= toTimeMs(collected.bridgeItem.pushedAt)) {
              collected.bridgeItem = res.bridgePayload;
            }
          }
          if (res.draftData && (res.draftData.nameBn || res.draftData.nameEn)) {
            collected.draftData = res.draftData;
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
  return collected;
}

function upsertQueue(existingQueue, item) {
  var list = Array.isArray(existingQueue) ? existingQueue.slice() : [];
  var filtered = list.filter(function(q) { return q && q.id !== item.id; });
  return [item].concat(filtered).slice(0, 10);
}

function mergeQueues(qA, qB, qC) {
  var map = new Map();
  var all = []
    .concat(Array.isArray(qA) ? qA : [])
    .concat(Array.isArray(qB) ? qB : [])
    .concat(Array.isArray(qC) ? qC : []);
  all.forEach(function(item) {
    if (!item || !item.data) return;
    var key = item.id || (item.data.nameBn || item.data.nameEn || String(Math.random()));
    var prev = map.get(key);
    if (!prev || toTimeMs(item.pushedAt) >= toTimeMs(prev.pushedAt)) {
      map.set(key, item);
    }
  });
  var merged = Array.from(map.values());
  merged.sort(function(a, b) {
    return toTimeMs(b.pushedAt) - toTimeMs(a.pushedAt);
  });
  return merged.slice(0, 10);
}

function pushToAllBdrisTabs(item, force) {
  if (!item || !item.data) return;
  chrome.tabs.query({ url: ['https://bdris.gov.bd/*', 'https://*.bdris.gov.bd/*'] }, function(tabs) {
    if (!tabs || !tabs.length) return;
    tabs.forEach(function(tab) {
      if (!tab.id) return;
      chrome.tabs.sendMessage(tab.id, {
        type: 'APPLY_LIVE_DATA',
        item: item,
        force: Boolean(force)
      }, function() {
        void chrome.runtime.lastError;
      });
    });
  });
}

async function resolveLatestState() {
  var store = await chrome.storage.local.get([
    'serverUrl',
    'syncKey',
    'autoRun',
    'cachedItem',
    'cachedActive',
    'cachedDocs',
    'cachedPushedAt',
    'liveQueue'
  ]);

  var serverUrl = normalizeOrigin(store.serverUrl || DEFAULT_SERVER);
  var syncKey = store.syncKey || DEFAULT_KEY;
  var autoRun = store.autoRun !== false;

  // 1. Pull directly from any open Netlify / AI Studio / App tab
  var tabPull = await pullFromOpenAppTabs();
  if (tabPull.syncKey) syncKey = tabPull.syncKey;
  if (tabPull.serverUrl) serverUrl = normalizeOrigin(tabPull.serverUrl);

  // 2. Also try direct background fetch as backup when running on full-stack server
  var serverJson = tabPull.serverJson || (await tryFetchServer(serverUrl, syncKey));
  var serverItem = (serverJson && serverJson.active && serverJson.active.data) ? serverJson.active : null;
  var serverQueue = (serverJson && Array.isArray(serverJson.queue)) ? serverJson.queue : [];

  var localItem = MEM_CACHE.item && MEM_CACHE.item.data
    ? MEM_CACHE.item
    : (store.cachedItem && store.cachedItem.data
        ? store.cachedItem
        : (store.cachedActive ? {
            id: 'local_cached',
            pushedAt: store.cachedPushedAt || '',
            data: store.cachedActive,
            documents: store.cachedDocs || null
          } : null));

  var candidates = [];
  if (serverItem) candidates.push({ item: serverItem, source: tabPull.serverJson ? 'live_iframe_server' : 'server' });
  if (tabPull.bridgeItem) candidates.push({ item: tabPull.bridgeItem, source: 'bridge_cache' });
  if (localItem) candidates.push({ item: localItem, source: 'bridge_cache' });

  candidates.sort(function(a, b) {
    return toTimeMs(b.item.pushedAt) - toTimeMs(a.item.pushedAt);
  });

  var bestItem = candidates.length ? candidates[0].item : null;
  var source = candidates.length ? candidates[0].source : 'none';

  // If nothing pushed yet, surface current form draft as fallback if named
  if (!bestItem && tabPull.draftData) {
    bestItem = {
      id: 'live_draft',
      pushedAt: new Date().toISOString(),
      data: tabPull.draftData,
      documents: null
    };
    source = 'bridge_cache';
  }

  var mergedQueue = mergeQueues(serverQueue, tabPull.bridgeItem ? [tabPull.bridgeItem] : [], MEM_CACHE.queue, store.liveQueue);
  if (bestItem && !mergedQueue.length) {
    mergedQueue = [bestItem];
  }

  if (bestItem && bestItem.data) {
    MEM_CACHE.item = bestItem;
    MEM_CACHE.queue = mergedQueue;
    var itemNoDocs = Object.assign({}, bestItem, { documents: null });
    safeStorageSet(
      {
        serverUrl: serverUrl,
        syncKey: syncKey,
        cachedItem: bestItem,
        cachedActive: bestItem.data,
        cachedDocs: bestItem.documents || null,
        cachedPushedAt: bestItem.pushedAt || '',
        liveQueue: compactQueueForStorage(mergedQueue, false)
      },
      {
        serverUrl: serverUrl,
        syncKey: syncKey,
        cachedItem: itemNoDocs,
        cachedActive: bestItem.data,
        cachedDocs: null,
        cachedPushedAt: bestItem.pushedAt || '',
        liveQueue: compactQueueForStorage(mergedQueue, false)
      }
    );
  }

  return {
    ok: true,
    source: source,
    autoRun: autoRun,
    item: bestItem,
    queue: mergedQueue
  };
}

chrome.runtime.onInstalled.addListener(function() {
  chrome.tabs.query({}, function(tabs) {
    (tabs || []).filter(isCandidateAppTab).forEach(function(tab) {
      if (!tab.id) return;
      try {
        chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['bridge.js']
        }, function() {
          void chrome.runtime.lastError;
        });
      } catch (e) {}
    });
  });
});

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'BRIDGE_SYNC_KEY') {
    var update = {};
    if (msg.syncKey) update.syncKey = msg.syncKey;
    if (msg.serverUrl) update.serverUrl = normalizeOrigin(msg.serverUrl);
    chrome.storage.local.set(update, function() {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'BRIDGE_PUSH_PAYLOAD' && msg.payload && msg.payload.data) {
    var p = msg.payload;
    var item = {
      id: p.id || ('live_' + Date.now()),
      bdrisTrackingId: p.bdrisTrackingId || '',
      status: p.status || 'pushed',
      pushedAt: p.pushedAt || new Date().toISOString(),
      data: p.data,
      documents: p.documents || null
    };

    MEM_CACHE.item = item;
    MEM_CACHE.queue = upsertQueue(MEM_CACHE.queue, item);

    chrome.storage.local.get(['liveQueue'], function(res) {
      var nextQueue = upsertQueue(res.liveQueue, item);
      MEM_CACHE.queue = nextQueue;

      var storageUpdate = {
        cachedItem: item,
        cachedActive: item.data,
        cachedDocs: item.documents,
        cachedPushedAt: item.pushedAt,
        liveQueue: compactQueueForStorage(nextQueue, false)
      };
      var fallbackNoDocs = {
        cachedItem: Object.assign({}, item, { documents: null }),
        cachedActive: item.data,
        cachedDocs: null,
        cachedPushedAt: item.pushedAt,
        liveQueue: compactQueueForStorage(nextQueue, false)
      };
      if (msg.syncKey) {
        storageUpdate.syncKey = msg.syncKey;
        fallbackNoDocs.syncKey = msg.syncKey;
      }
      if (msg.serverUrl) {
        storageUpdate.serverUrl = normalizeOrigin(msg.serverUrl);
        fallbackNoDocs.serverUrl = normalizeOrigin(msg.serverUrl);
      }

      safeStorageSet(storageUpdate, fallbackNoDocs, function() {
        pushToAllBdrisTabs(item, true);
        sendResponse({ ok: true, pushedAt: item.pushedAt });
      });
    });
    return true;
  }

  if (msg.type === 'SELECT_ACTIVE_ITEM' && msg.item && msg.item.data) {
    var chosen = msg.item;
    MEM_CACHE.item = chosen;
    var chosenNoDocs = Object.assign({}, chosen, { documents: null });
    safeStorageSet(
      {
        cachedItem: chosen,
        cachedActive: chosen.data,
        cachedDocs: chosen.documents || null,
        cachedPushedAt: chosen.pushedAt || new Date().toISOString()
      },
      {
        cachedItem: chosenNoDocs,
        cachedActive: chosen.data,
        cachedDocs: null,
        cachedPushedAt: chosen.pushedAt || new Date().toISOString()
      },
      function() {
        sendResponse({ ok: true });
      }
    );
    return true;
  }

  if (msg.type === 'FETCH_LIVE_DATA') {
    resolveLatestState()
      .then(function(result) { sendResponse(result); })
      .catch(function() { sendResponse({ ok: false, source: 'error', item: null, queue: [] }); });
    return true;
  }
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (chrome.runtime.lastError || !tab || !tab.url) return;
    if (tab.url.indexOf('https://bdris.gov.bd') !== 0 && tab.url.indexOf('.bdris.gov.bd') === -1) return;
    resolveLatestState().then(function(res) {
      if (res && res.autoRun !== false && res.item && res.item.data) {
        chrome.tabs.sendMessage(activeInfo.tabId, {
          type: 'APPLY_LIVE_DATA',
          item: res.item,
          force: false
        }, function() {
          void chrome.runtime.lastError;
        });
      }
    });
  });
});`;

  const popupHtml = `<!doctype html>
<html lang="bn">
<head>
  <meta charset="utf-8" />
  <style>
    body { width: 350px; padding: 14px; font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; }
    h1 { font-size: 15px; margin: 0 0 4px; color: #047857; }
    p { font-size: 12px; color: #475569; margin: 0 0 10px; line-height: 1.4; }
    label { display: block; font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 4px; }
    select, input[type="text"] { width: 100%; box-sizing: border-box; font-size: 12px; padding: 7px 8px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 8px; background: #fff; }
    .row { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 12px; color: #1e293b; }
    .btns { display: flex; gap: 8px; margin-bottom: 8px; }
    button { flex: 1; padding: 9px 10px; background: #047857; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
    button:hover { background: #065f46; }
    button.secondary { flex: 0 0 auto; background: #e2e8f0; color: #0f172a; }
    button.secondary:hover { background: #cbd5e1; }
    details { margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 11px; color: #475569; }
    summary { cursor: pointer; font-weight: 600; margin-bottom: 6px; }
    #status { margin-top: 6px; font-size: 12px; color: #047857; font-weight: 500; line-height: 1.4; }
  </style>
</head>
<body>
  <h1>BDRIS SmartForm Live Sync v3.2</h1>
  <p>Netlify, সার্ভার ও চলমান অ্যাপ ট্যাব থেকে সরাসরি তথ্য এনে bdris.gov.bd পূরণ করে।</p>

  <label for="applicantSelect">প্রস্তুতকৃত আবেদন তালিকা:</label>
  <select id="applicantSelect"></select>

  <label class="row">
    <input type="checkbox" id="autoRunToggle" checked />
    <span>bdris.gov.bd খুললেই অটো-ফিল চালু হবে</span>
  </label>

  <div class="btns">
    <button id="fillBtn">bdris.gov.bd অটো-ফিল করুন</button>
    <button id="refreshBtn" class="secondary">রিফ্রেশ</button>
  </div>

  <div id="status">অ্যাপ ট্যাব ও সার্ভার থেকে তথ্য আনা হচ্ছে...</div>

  <details>
    <summary>সার্ভার ও সিঙ্ক কী সেটিংস</summary>
    <label for="serverUrlInput">Server URL</label>
    <input type="text" id="serverUrlInput" />
    <label for="syncKeyInput">Sync Key</label>
    <input type="text" id="syncKeyInput" />
    <button id="saveSettingsBtn" class="secondary" style="width:100%">সেটিংস সেভ করুন</button>
  </details>

  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `const DEFAULT_SERVER = ${JSON.stringify(cleanOrigin)};
const DEFAULT_KEY = ${JSON.stringify(syncKey)};
const FALLBACK_DATA = ${payloadJson};
const FALLBACK_DOCS = ${docsJson};

const selectEl = document.getElementById('applicantSelect');
const autoRunEl = document.getElementById('autoRunToggle');
const serverInput = document.getElementById('serverUrlInput');
const keyInput = document.getElementById('syncKeyInput');
const statusEl = document.getElementById('status');

let queueItems = [];

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['serverUrl', 'syncKey', 'autoRun'], (res) => {
      resolve({
        serverUrl: (res.serverUrl || DEFAULT_SERVER).replace(/\\/+$/, ''),
        syncKey: res.syncKey || DEFAULT_KEY,
        autoRun: res.autoRun !== false,
      });
    });
  });
}

function renderOptions(items) {
  selectEl.innerHTML = '';
  if (!items || items.length === 0) {
    const opt = document.createElement('option');
    opt.value = '__fallback__';
    opt.textContent = (FALLBACK_DATA.nameBn || FALLBACK_DATA.nameEn || 'সর্বশেষ অফলাইন ডেটা');
    selectEl.appendChild(opt);
    return;
  }
  items.forEach((item, idx) => {
    const d = item.data || {};
    const opt = document.createElement('option');
    opt.value = String(idx);
    const label = (d.nameBn || d.nameEn || 'নামহীন') + (d.dob ? ' (' + d.dob + ')' : '');
    opt.textContent = idx === 0 ? '★ ' + label : label;
    selectEl.appendChild(opt);
  });
}

async function syncFromServer() {
  const cfg = await getConfig();
  serverInput.value = cfg.serverUrl;
  keyInput.value = cfg.syncKey;
  autoRunEl.checked = cfg.autoRun;

  statusEl.style.color = '#475569';
  statusEl.textContent = 'সর্বশেষ তথ্য যাচাই করা হচ্ছে...';

  chrome.runtime.sendMessage({ type: 'FETCH_LIVE_DATA' }, (res) => {
    if (chrome.runtime.lastError || !res || !res.ok) {
      renderOptions([]);
      statusEl.style.color = '#dc2626';
      statusEl.textContent = 'লাইভ সংযোগ পাওয়া যায়নি। অফলাইন ডেটা প্রস্তুত আছে।';
      return;
    }

    queueItems = Array.isArray(res.queue) && res.queue.length > 0
      ? res.queue
      : (res.item ? [res.item] : []);

    renderOptions(queueItems);

    if (queueItems.length > 0) {
      const activeName = queueItems[0].data?.nameBn || queueItems[0].data?.nameEn || 'আবেদন';
      const srcLabel = res.source === 'bridge_cache' ? 'ব্রাউজার ব্রিজ' : 'লাইভ সার্ভার';
      statusEl.style.color = '#047857';
      statusEl.textContent = srcLabel + ' সিঙ্ক সফল! প্রস্তুত: ' + activeName + ' (মোট ' + queueItems.length + 'টি)';
    } else {
      statusEl.style.color = '#b45309';
      statusEl.textContent = 'এখনো কোনো আবেদন পাঠানো হয়নি। ওয়েব অ্যাপ থেকে "সার্ভারে পাঠান" চাপুন।';
    }
  });
}

autoRunEl.addEventListener('change', () => {
  chrome.storage.local.set({ autoRun: autoRunEl.checked });
});

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  chrome.storage.local.set({
    serverUrl: serverInput.value.trim() || DEFAULT_SERVER,
    syncKey: keyInput.value.trim() || DEFAULT_KEY,
  }, () => {
    syncFromServer();
  });
});

document.getElementById('refreshBtn').addEventListener('click', syncFromServer);

document.getElementById('fillBtn').addEventListener('click', async () => {
  let chosenItem = null;
  let targetData = FALLBACK_DATA;
  let targetDocs = FALLBACK_DOCS;
  const idx = selectEl.value;
  if (idx !== '__fallback__' && queueItems[Number(idx)]?.data) {
    chosenItem = queueItems[Number(idx)];
    targetData = chosenItem.data;
    targetDocs = chosenItem.documents || FALLBACK_DOCS;
  } else {
    chosenItem = {
      id: 'fallback_' + Date.now(),
      pushedAt: new Date().toISOString(),
      data: targetData,
      documents: targetDocs,
    };
  }

  await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'SELECT_ACTIVE_ITEM', item: chosenItem }, () => resolve());
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  if (!tab.url || tab.url.indexOf('bdris.gov.bd') === -1) {
    chrome.tabs.create({ url: 'https://bdris.gov.bd/br/application' });
    statusEl.style.color = '#047857';
    statusEl.textContent = 'bdris.gov.bd নতুন ট্যাবে খোলা হচ্ছে ও অটো-ফিল হবে!';
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (D, DOCS) => {
      window.__BDRIS_SMARTFORM_DATA = D;
      window.__BDRIS_SMARTFORM_DOCS = DOCS;
    },
    args: [targetData, targetDocs],
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  });

  statusEl.style.color = '#047857';
  statusEl.textContent = 'bdris.gov.bd ফরমে অটো-ফিল ও ফাইল অ্যাটাচ চালানো হয়েছে!';
});

syncFromServer();`;

  const contentJs = generateBdrisAutoFillScript(data, true, documents);

  // auto-runner.js pulls live via MV3 background worker AND accepts live push messages
  const autoRunnerJs = `(function(){
  function runWithData(D, DOCS, stamp, force) {
    if (!D) return;
    if (!force && stamp && window.__BDRIS_LAST_STAMP === stamp) return;
    window.__BDRIS_LAST_STAMP = stamp || String(Date.now());
    window.__BDRIS_SMARTFORM_DATA = D;
    window.__BDRIS_SMARTFORM_DOCS = DOCS || null;
    ${contentJs}
  }

  function fetchAndApply(force) {
    try {
      chrome.runtime.sendMessage({ type: 'FETCH_LIVE_DATA' }, function(res) {
        if (chrome.runtime.lastError || !res) {
          chrome.storage.local.get(['autoRun', 'cachedActive', 'cachedDocs', 'cachedPushedAt'], function(s) {
            if (s.autoRun !== false && s.cachedActive) {
              runWithData(s.cachedActive, s.cachedDocs || null, s.cachedPushedAt || '', force);
            }
          });
          return;
        }
        if (res.autoRun === false) return;
        if (res.item && res.item.data) {
          runWithData(res.item.data, res.item.documents || null, res.item.pushedAt || '', force);
        }
      });
    } catch (e) {}
  }

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg && msg.type === 'APPLY_LIVE_DATA' && msg.item && msg.item.data) {
      runWithData(msg.item.data, msg.item.documents || null, msg.item.pushedAt || '', Boolean(msg.force));
    }
  });

  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      fetchAndApply(false);
    }
  });

  fetchAndApply(false);
})();`;

  const readme = `BDRIS SmartForm Live-Sync Chrome / Edge Extension v3.2 (Netlify + Server Ready)
=================================================================================
১. এই ZIP ফাইলটি কম্পিউটারে একবার আনজিপ (Extract) করুন।
২. Chrome বা Edge ব্রাউজারে লিখুন: chrome://extensions
৩. ডানদিকে উপরে "Developer mode" চালু করুন।
৪. "Load unpacked" বাটনে ক্লিক করে আনজিপ করা ফোল্ডারটি সিলেক্ট করুন।
   (পুরনো ভার্সন থাকলে রিফ্রেশ আইকনে ক্লিক করুন বা Remove করে নতুন ফোল্ডার দিন।)
৫. এটি Netlify (*.netlify.app), কাস্টম ডোমেইন এবং AI Studio সব জায়গা থেকেই কাজ করে!
`;

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('background.js', backgroundJs);
  zip.file('bridge.js', bridgeJs);
  zip.file('popup.html', popupHtml);
  zip.file('popup.js', popupJs);
  zip.file('content.js', contentJs);
  zip.file('auto-runner.js', autoRunnerJs);
  zip.file('README.txt', readme);

  return zip.generateAsync({ type: 'blob' });
}
