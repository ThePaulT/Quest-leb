import type { QuestRegion } from '@/lib/types';

/**
 * String catalogue.
 *
 * Arabic is first-class, not a translation layer: `ar` is written, not
 * generated, and a test asserts the two dictionaries have identical keys so a
 * new English string cannot ship without its Arabic counterpart.
 *
 * Rejection reasons are keyed by the exact `reason` the API returns, so a new
 * validator failure surfaces as a real sentence rather than a code. A test
 * asserts every reason the server can emit has an entry here.
 */

export type Locale = 'en' | 'ar';

export const LOCALES: Locale[] = ['en', 'ar'];

export function localeFrom(value: string | undefined): Locale {
  return value === 'ar' ? 'ar' : 'en';
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export interface Dictionary {
  region: Record<QuestRegion, string>;
  common: {
    appName: string;
    back: string;
    close: string;
    cancel: string;
    retry: string;
    minutes: (n: number) => string;
    metres: (n: number) => string;
    difficultyOf: (value: number) => string;
    notYetActive: string;
    completed: string;
    viewOtherLanguage: string;
  };
  map: {
    region: string;
    difficulty: string;
    all: string;
    showInactive: string;
    devOnly: string;
    empty: string;
    emptyInactive: string;
    count: (n: number) => string;
    openQuest: string;
  };
  quest: {
    story: string;
    howToProve: string;
    safety: string;
    safetyUnverified: string;
    safetyEnglishOnly: string;
    geofence: string;
    geofenceExplainer: (radius: number) => string;
    submitProof: string;
    signInToSubmit: string;
    alreadyCompleted: string;
    inactiveNotice: string;
    notFound: string;
    notFoundBody: string;
  };
  submit: {
    title: string;
    step1: string;
    step2: string;
    takePhoto: string;
    retakePhoto: string;
    locating: string;
    locationFailed: string;
    locationDenied: string;
    accuracyLabel: string;
    accuracyGood: string;
    accuracyPoor: string;
    compressing: string;
    photoReady: (kb: number) => string;
    submitting: string;
    submit: string;
    needPhoto: string;
    needLocation: string;
  };
  success: {
    verified: string;
    verifiedBody: string;
    flagged: string;
    flaggedBody: string;
    stamp: string;
    badgeEarned: string;
    backToMap: string;
  };
  /** Keyed by the `reason` string the API returns. */
  rejection: Record<string, string>;
  auth: {
    title: string;
    intro: string;
    email: string;
    emailPlaceholder: string;
    sendLink: string;
    sending: string;
    linkSent: string;
    linkSentBody: string;
    signOut: string;
    signedInAs: string;
    failed: string;
    devSignIn: string;
    devSignInNote: string;
  };
}

const en: Dictionary = {
  region: {
    beirut: 'Beirut',
    mount_lebanon: 'Mount Lebanon',
    north: 'North',
    south: 'South',
    bekaa: 'Bekaa',
  },
  common: {
    appName: 'Lebanon Quest',
    back: 'Back',
    close: 'Close',
    cancel: 'Cancel',
    retry: 'Try again',
    minutes: (n) => `${n} min`,
    metres: (n) => `${n} m`,
    difficultyOf: (value) => `Difficulty ${value} of 5`,
    notYetActive: 'Not yet active',
    completed: 'Completed',
    viewOtherLanguage: 'اعرض بالعربية',
  },
  map: {
    region: 'Region',
    difficulty: 'Difficulty',
    all: 'All',
    showInactive: 'Show inactive quests',
    devOnly: 'Dev only',
    empty: 'No quests match these filters.',
    emptyInactive: 'All ten seeded quests are inactive. Turn on “Show inactive quests”.',
    count: (n) => `${n} quest${n === 1 ? '' : 's'}`,
    openQuest: 'Open quest',
  },
  quest: {
    story: 'The story',
    howToProve: 'How to prove it',
    safety: 'Before you go',
    safetyUnverified: 'Draft — not yet checked on the ground.',
    safetyEnglishOnly: 'Not yet translated. Shown in English because safety information should not be withheld.',
    geofence: 'Where it counts',
    geofenceExplainer: (radius) =>
      `Your photo must be taken within ${radius} m of this point.`,
    submitProof: 'Submit proof',
    signInToSubmit: 'Sign in to submit proof',
    alreadyCompleted: 'You have already completed this quest.',
    inactiveNotice: 'This quest is not live yet, so proof cannot be submitted.',
    notFound: 'Quest not found',
    notFoundBody: 'That quest does not exist, or is not live yet.',
  },
  submit: {
    title: 'Submit proof',
    step1: 'Take the photo',
    step2: 'Check your location',
    takePhoto: 'Open camera',
    retakePhoto: 'Retake',
    locating: 'Finding your location…',
    locationFailed: 'Could not get your location.',
    locationDenied:
      'Location permission was refused. Proof needs your position, so allow it and try again.',
    accuracyLabel: 'GPS accuracy',
    accuracyGood: 'Accurate enough to submit.',
    accuracyPoor:
      'Too vague to prove where you are. Step into the open, wait a moment, and it usually sharpens.',
    compressing: 'Preparing photo…',
    photoReady: (kb) => `Photo ready — ${kb} KB`,
    submitting: 'Submitting…',
    submit: 'Submit',
    needPhoto: 'Take a photo first.',
    needLocation: 'Wait for your location before submitting.',
  },
  success: {
    verified: 'Verified',
    verifiedBody: 'Your proof was accepted.',
    flagged: 'Received — under review',
    flaggedBody:
      'Something about this submission needs a human look. It still counts toward your badges.',
    stamp: 'COMPLETED',
    badgeEarned: 'Badge earned',
    backToMap: 'Back to the map',
  },
  rejection: {
    'proof.missing_photo': 'No photo was received. Take one and try again.',
    'proof.gps_too_inaccurate':
      'Your GPS reading was too vague to prove where you were standing. Step into the open, away from buildings, and try again.',
    'proof.outside_geofence':
      'You were too far from the quest location. Get closer to the site and submit from there.',
    'not_implemented':
      'This quest type cannot be completed yet. It needs a QR code on site that does not exist.',
    'photo.too_large':
      'That photo is too large. It should have been shrunk automatically — try taking it again.',
    'photo.not_webp': 'That file was not a photo the app can read. Try taking it again.',
    'request.missing_quest_id': 'Something went wrong identifying this quest. Reload and retry.',
    'request.missing_position': 'Your location was missing. Allow location access and retry.',
    'request.invalid_position': 'Your location reading did not make sense. Try again outdoors.',
    'request.missing_photo': 'No photo was attached. Take one and try again.',
    'request.malformed_multipart': 'The upload did not arrive intact. Try again.',
    'quest.not_found': 'This quest is not available.',
    'completion.already_verified': 'You have already completed this quest.',
    'storage.upload_failed': 'The photo could not be saved. Try again in a moment.',
    'auth.unauthorized': 'You need to be signed in to submit proof.',
  },
  auth: {
    title: 'Sign in',
    intro: 'Proof is tied to you, so submitting needs an account. No password — we email a link.',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    sendLink: 'Email me a link',
    sending: 'Sending…',
    linkSent: 'Check your email',
    linkSentBody: 'We sent you a sign-in link. Open it on this device.',
    signOut: 'Sign out',
    signedInAs: 'Signed in as',
    failed: 'That did not work. Check the address and try again.',
    devSignIn: 'Developer sign-in',
    devSignInNote: 'Local testing only. Never available in production.',
  },
};

const ar: Dictionary = {
  region: {
    beirut: 'بيروت',
    mount_lebanon: 'جبل لبنان',
    north: 'الشمال',
    south: 'الجنوب',
    bekaa: 'البقاع',
  },
  common: {
    appName: 'مهمات لبنان',
    back: 'رجوع',
    close: 'إغلاق',
    cancel: 'إلغاء',
    retry: 'حاول مجدداً',
    minutes: (n) => `${n} دقيقة`,
    metres: (n) => `${n} متر`,
    difficultyOf: (value) => `الصعوبة ${value} من ٥`,
    notYetActive: 'غير مفعّلة',
    completed: 'مكتملة',
    viewOtherLanguage: 'View in English',
  },
  map: {
    region: 'المنطقة',
    difficulty: 'الصعوبة',
    all: 'الكل',
    showInactive: 'إظهار المهام غير المفعّلة',
    devOnly: 'للتطوير فقط',
    empty: 'لا توجد مهام مطابقة.',
    emptyInactive: 'جميع المهام العشر غير مفعّلة. فعّل «إظهار المهام غير المفعّلة».',
    count: (n) => `${n} مهمة`,
    openQuest: 'افتح المهمة',
  },
  quest: {
    story: 'الحكاية',
    howToProve: 'كيف تثبت زيارتك',
    safety: 'قبل أن تذهب',
    safetyUnverified: 'مسودة — لم تُتحقّق ميدانياً بعد.',
    safetyEnglishOnly: 'لم تُترجم بعد. تُعرض بالإنكليزية لأن معلومات السلامة لا يصحّ حجبها.',
    geofence: 'النطاق المقبول',
    geofenceExplainer: (radius) =>
      `يجب أن تُلتقط صورتك ضمن ${radius} متراً من هذه النقطة.`,
    submitProof: 'أرسل الإثبات',
    signInToSubmit: 'سجّل الدخول لإرسال الإثبات',
    alreadyCompleted: 'لقد أتممت هذه المهمة سابقاً.',
    inactiveNotice: 'هذه المهمة غير مفعّلة بعد، لذا لا يمكن إرسال إثبات.',
    notFound: 'المهمة غير موجودة',
    notFoundBody: 'هذه المهمة غير موجودة أو لم تُفعّل بعد.',
  },
  submit: {
    title: 'إرسال الإثبات',
    step1: 'التقط الصورة',
    step2: 'تحقّق من موقعك',
    takePhoto: 'افتح الكاميرا',
    retakePhoto: 'أعد الالتقاط',
    locating: 'جارٍ تحديد موقعك…',
    locationFailed: 'تعذّر تحديد موقعك.',
    locationDenied: 'رُفض إذن الموقع. الإثبات يحتاج موقعك، فاسمح به وحاول مجدداً.',
    accuracyLabel: 'دقة تحديد الموقع',
    accuracyGood: 'الدقة كافية للإرسال.',
    accuracyPoor:
      'الدقة ضعيفة ولا تثبت مكانك. اخرج إلى مكان مكشوف وانتظر قليلاً، فتتحسّن عادةً.',
    compressing: 'جارٍ تجهيز الصورة…',
    photoReady: (kb) => `الصورة جاهزة — ${kb} كيلوبايت`,
    submitting: 'جارٍ الإرسال…',
    submit: 'إرسال',
    needPhoto: 'التقط صورة أولاً.',
    needLocation: 'انتظر تحديد موقعك قبل الإرسال.',
  },
  success: {
    verified: 'تم التحقّق',
    verifiedBody: 'قُبل إثباتك.',
    flagged: 'وصل — قيد المراجعة',
    flaggedBody: 'هناك ما يحتاج مراجعة بشرية في هذا الإرسال، لكنه يُحتسب لشاراتك.',
    stamp: 'أُنجزت',
    badgeEarned: 'شارة جديدة',
    backToMap: 'العودة إلى الخريطة',
  },
  rejection: {
    'proof.missing_photo': 'لم تصل أي صورة. التقط صورة وحاول مجدداً.',
    'proof.gps_too_inaccurate':
      'دقة تحديد موقعك ضعيفة ولا تثبت مكان وقوفك. اخرج إلى مكان مكشوف بعيداً عن المباني وحاول مجدداً.',
    'proof.outside_geofence':
      'كنت بعيداً جداً عن موقع المهمة. اقترب من الموقع وأرسل من هناك.',
    'not_implemented': 'هذا النوع من المهام غير متاح بعد، فهو يحتاج رمز QR في الموقع وهو غير موجود.',
    'photo.too_large': 'الصورة كبيرة جداً. كان يُفترض تصغيرها تلقائياً — أعد التقاطها.',
    'photo.not_webp': 'هذا الملف ليس صورة يمكن للتطبيق قراءتها. أعد الالتقاط.',
    'request.missing_quest_id': 'حدث خطأ في تحديد المهمة. أعد تحميل الصفحة وحاول مجدداً.',
    'request.missing_position': 'لم يصل موقعك. اسمح بالوصول إلى الموقع وحاول مجدداً.',
    'request.invalid_position': 'قراءة موقعك غير منطقية. حاول مجدداً في الخارج.',
    'request.missing_photo': 'لم تُرفق أي صورة. التقط صورة وحاول مجدداً.',
    'request.malformed_multipart': 'لم يصل الرفع سليماً. حاول مجدداً.',
    'quest.not_found': 'هذه المهمة غير متاحة.',
    'completion.already_verified': 'لقد أتممت هذه المهمة سابقاً.',
    'storage.upload_failed': 'تعذّر حفظ الصورة. حاول بعد قليل.',
    'auth.unauthorized': 'عليك تسجيل الدخول لإرسال الإثبات.',
  },
  auth: {
    title: 'تسجيل الدخول',
    intro: 'الإثبات مرتبط بك، لذا يحتاج الإرسال إلى حساب. لا كلمة سرّ — نرسل لك رابطاً بالبريد.',
    email: 'البريد الإلكتروني',
    emailPlaceholder: 'you@example.com',
    sendLink: 'أرسل لي رابطاً',
    sending: 'جارٍ الإرسال…',
    linkSent: 'تفقّد بريدك',
    linkSentBody: 'أرسلنا إليك رابط تسجيل الدخول. افتحه على هذا الجهاز.',
    signOut: 'تسجيل الخروج',
    signedInAs: 'مسجّل الدخول باسم',
    failed: 'لم ينجح ذلك. تحقّق من العنوان وحاول مجدداً.',
    devSignIn: 'دخول المطوّر',
    devSignInNote: 'للاختبار المحلي فقط. غير متاح في الإنتاج إطلاقاً.',
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

export function t(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Falls back to a generic line rather than showing a raw key to a visitor. */
export function rejectionMessage(locale: Locale, reason: string | null): string {
  const dict = t(locale);
  if (reason && dict.rejection[reason]) return dict.rejection[reason];
  return locale === 'ar'
    ? 'تعذّر قبول الإرسال. حاول مجدداً.'
    : 'The submission could not be accepted. Please try again.';
}

export { en as enDictionary, ar as arDictionary };
