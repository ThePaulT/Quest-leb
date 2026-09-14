/**
 * Quest seed data.
 *
 * Quests are data, not code: this file exists so the prototype has something to
 * render, and so the same 10 quests can be reproduced in any environment. It is
 * not a migration, and adding a quest here never requires one.
 *
 * ⚠️ COORDINATES ARE UNVERIFIED. They were written from general knowledge of
 * each site, not read off a survey, and have NOT been checked against
 * OpenStreetMap. Nothing here has been inserted into any database yet. Verify
 * every lat/lng — and the geofence radius that goes with it — before seeding.
 *
 * `story_*` and `safety_notes_*` are deliberate TODO stubs. A quest cannot be
 * activated without safety notes in both languages: the database enforces it
 * (quests_safety_notes_required_when_active), so every row here seeds with
 * is_active = false until someone writes them.
 */

/** Mirrors public.quest_region. Replace with `supabase gen types` output once a project exists. */
export type QuestRegion =
  | 'beirut'
  | 'mount_lebanon'
  | 'north'
  | 'south'
  | 'bekaa';

/** Mirrors public.quest_category. */
export type QuestCategory =
  | 'heritage'
  | 'nature'
  | 'food'
  | 'urban'
  | 'religious';

/** Mirrors public.proof_type. One validator module per value, in lib/validators/. */
export type ProofType =
  | 'photo_at_location'
  | 'photo_of_object'
  | 'receipt_photo'
  | 'qr_scan';

/** 1 = a stroll from a parked car. 5 = a full day on foot in rough terrain. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface QuestSeed {
  slug: string;

  titleEn: string;
  titleAr: string;
  summaryEn: string;
  summaryAr: string;

  /** TODO: long-form bilingual narrative, written with the Ministry. */
  storyEn: null;
  storyAr: null;

  region: QuestRegion;
  category: QuestCategory;
  difficulty: Difficulty;

  /** WGS84 decimal degrees. UNVERIFIED — see the file header. */
  lat: number;
  lng: number;

  /** Metres. Sized to the site, not to GPS accuracy alone. */
  geofenceRadiusM: number;

  proofType: ProofType;
  proofHintEn: string;
  proofHintAr: string;

  /** TODO: required in both languages before is_active can be set true. */
  safetyNotesEn: null;
  safetyNotesAr: null;

  estDurationMin: number;
  sortOrder: number;
}

export const questSeeds: QuestSeed[] = [
  {
    slug: 'harissa-our-lady-of-lebanon',
    titleEn: 'Our Lady of Lebanon, Harissa',
    titleAr: 'سيدة لبنان – حريصا',
    summaryEn:
      'A bronze statue on a hilltop above Jounieh bay, reached by a winding road or by the téléphérique.',
    summaryAr:
      'تمثال برونزي على تلة تطل على خليج جونية، يُوصل إليه بالطريق الجبلية أو بالتلفريك.',
    storyEn: null,
    storyAr: null,
    region: 'mount_lebanon',
    category: 'religious',
    difficulty: 2,
    lat: 33.9839,
    lng: 35.6506,
    geofenceRadiusM: 200,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the bay from the platform at the base of the statue.',
    proofHintAr: 'التقط صورة للخليج من المنصة الواقعة عند قاعدة التمثال.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 60,
    sortOrder: 10,
  },
  {
    slug: 'raouche-pigeon-rocks',
    titleEn: 'Raouché Rocks',
    titleAr: 'صخرة الروشة',
    summaryEn:
      'Two sea stacks standing off the Beirut corniche, the city’s most photographed natural landmark.',
    summaryAr:
      'صخرتان بحريتان قبالة كورنيش بيروت، وهما أكثر معلم طبيعي تصويراً في المدينة.',
    storyEn: null,
    storyAr: null,
    region: 'beirut',
    category: 'urban',
    difficulty: 1,
    lat: 33.8908,
    lng: 35.4705,
    geofenceRadiusM: 250,
    proofType: 'photo_at_location',
    proofHintEn: 'Stand on the corniche railing side and frame both rocks in one shot.',
    proofHintAr: 'قف عند سياج الكورنيش والتقط الصخرتين في صورة واحدة.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 30,
    sortOrder: 10,
  },
  {
    slug: 'jeita-grotto',
    titleEn: 'Jeita Grotto',
    titleAr: 'مغارة جعيتا',
    summaryEn:
      'Two limestone cave systems in the Nahr al-Kalb valley: an upper gallery walked on foot, a lower one crossed by boat.',
    summaryAr:
      'مغارتان كلسيتان في وادي نهر الكلب: الجزء العلوي يُجال فيه سيراً، والسفلي يُعبر بالقارب.',
    storyEn: null,
    storyAr: null,
    region: 'mount_lebanon',
    category: 'nature',
    difficulty: 2,
    lat: 33.9442,
    lng: 35.6414,
    geofenceRadiusM: 300,
    // Cameras are not allowed inside the caves, so the ticket is the proof.
    proofType: 'receipt_photo',
    proofHintEn:
      'Photography is banned inside the caves. Photograph your dated entry ticket instead.',
    proofHintAr:
      'التصوير ممنوع داخل المغارة. صوّر بطاقة الدخول المؤرخة بدلاً من ذلك.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 90,
    sortOrder: 20,
  },
  {
    slug: 'baalbek-temple-of-bacchus',
    titleEn: 'Baalbek',
    titleAr: 'بعلبك',
    summaryEn:
      'The Roman sanctuary of Heliopolis, whose Temple of Bacchus is among the best preserved anywhere.',
    summaryAr:
      'حرم هليوبوليس الروماني، ومعبد باخوس فيه من أفضل المعابد الرومانية حفظاً في العالم.',
    storyEn: null,
    storyAr: null,
    region: 'bekaa',
    category: 'heritage',
    difficulty: 3,
    lat: 34.0069,
    lng: 36.2039,
    geofenceRadiusM: 400,
    proofType: 'photo_of_object',
    proofHintEn: 'Photograph the standing columns of the Temple of Bacchus from the east steps.',
    proofHintAr: 'صوّر أعمدة معبد باخوس القائمة من الدرج الشرقي.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 120,
    sortOrder: 10,
  },
  {
    slug: 'byblos-citadel',
    titleEn: 'Byblos Citadel',
    titleAr: 'قلعة جبيل',
    summaryEn:
      'The Crusader keep built into one of the oldest continuously inhabited towns in the world.',
    summaryAr: 'قلعة صليبية مبنية داخل واحدة من أقدم المدن المأهولة باستمرار في العالم.',
    storyEn: null,
    storyAr: null,
    region: 'mount_lebanon',
    category: 'heritage',
    difficulty: 2,
    lat: 34.1208,
    lng: 35.6455,
    geofenceRadiusM: 250,
    proofType: 'qr_scan',
    proofHintEn: 'Scan the quest code on the interpretive panel at the citadel entrance.',
    proofHintAr: 'امسح رمز المهمة الموجود على اللوحة التعريفية عند مدخل القلعة.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 90,
    sortOrder: 30,
  },
  {
    slug: 'qadisha-valley',
    titleEn: 'Qadisha Valley',
    titleAr: 'وادي قاديشا',
    summaryEn:
      'The Holy Valley: a deep gorge below Bsharri lined with cliff monasteries and hermitages.',
    summaryAr: 'الوادي المقدس: خانق عميق تحت بشري تنتشر فيه الأديرة والمحابس المنحوتة في الصخر.',
    storyEn: null,
    storyAr: null,
    region: 'north',
    category: 'nature',
    difficulty: 5,
    // Anchored at Deir Mar Elisha, the usual descent point at the head of the
    // valley. The radius is wide on purpose: the quest is the valley, not a door.
    lat: 34.2447,
    lng: 35.9986,
    geofenceRadiusM: 2000,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the valley floor from anywhere on the monastery trail.',
    proofHintAr: 'صوّر قعر الوادي من أي نقطة على درب الدير.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 240,
    sortOrder: 10,
  },
  {
    slug: 'cedars-of-god',
    titleEn: 'Cedars of God',
    titleAr: 'أرز الرب',
    summaryEn:
      'One of the last old-growth cedar stands in Lebanon, above Bsharri at around 2,000 metres.',
    summaryAr: 'إحدى آخر غابات الأرز المعمّرة في لبنان، فوق بشري على ارتفاع نحو ألفي متر.',
    storyEn: null,
    storyAr: null,
    region: 'north',
    category: 'nature',
    difficulty: 3,
    lat: 34.2447,
    lng: 36.0492,
    geofenceRadiusM: 400,
    proofType: 'photo_of_object',
    proofHintEn: 'Photograph one of the named ancient cedars, with its marker visible.',
    proofHintAr: 'صوّر إحدى أشجار الأرز المعمّرة المسمّاة مع ظهور لوحتها التعريفية.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 60,
    sortOrder: 20,
  },
  {
    slug: 'beiteddine-palace',
    titleEn: 'Beiteddine Palace',
    titleAr: 'قصر بيت الدين',
    summaryEn:
      'An early 19th-century emiri palace in the Chouf, built around courtyards, hammams and mosaic halls.',
    summaryAr:
      'قصر أميري من أوائل القرن التاسع عشر في الشوف، مبني حول باحات وحمّامات وقاعات فسيفساء.',
    storyEn: null,
    storyAr: null,
    region: 'mount_lebanon',
    category: 'heritage',
    difficulty: 3,
    lat: 33.6944,
    lng: 35.5814,
    geofenceRadiusM: 300,
    proofType: 'qr_scan',
    proofHintEn: 'Scan the quest code in the main courtyard, beside the ticket desk.',
    proofHintAr: 'امسح رمز المهمة في الباحة الرئيسية بجانب شبّاك التذاكر.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 90,
    sortOrder: 40,
  },
  {
    slug: 'sidon-sea-castle',
    titleEn: 'Sidon Sea Castle',
    titleAr: 'قلعة صيدا البحرية',
    summaryEn:
      'A Crusader fortress on a small island, joined to the Saida waterfront by a stone causeway.',
    summaryAr: 'قلعة صليبية على جزيرة صغيرة، تصلها بواجهة صيدا البحرية جسر حجري.',
    storyEn: null,
    storyAr: null,
    region: 'south',
    category: 'heritage',
    difficulty: 2,
    lat: 33.5686,
    lng: 35.3675,
    geofenceRadiusM: 150,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the causeway from the castle, looking back toward the old city.',
    proofHintAr: 'صوّر الجسر من القلعة باتجاه المدينة القديمة.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 45,
    sortOrder: 10,
  },
  {
    slug: 'tyre-hippodrome',
    titleEn: 'Tyre Hippodrome',
    titleAr: 'ميدان سباق الخيل في صور',
    summaryEn:
      'The Roman chariot-racing track at the Al-Bass site, one of the largest known, beside the monumental arch.',
    summaryAr:
      'حلبة سباق العربات الرومانية في موقع البص، من أكبر ما عُرف منها، إلى جانب قوس النصر.',
    storyEn: null,
    storyAr: null,
    region: 'south',
    category: 'heritage',
    difficulty: 3,
    lat: 33.2725,
    lng: 35.2075,
    geofenceRadiusM: 500,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the length of the track from the spina at its centre.',
    proofHintAr: 'صوّر امتداد الحلبة من الحاجز الأوسط في وسطها.',
    safetyNotesEn: null,
    safetyNotesAr: null,
    estDurationMin: 90,
    sortOrder: 20,
  },
];

export default questSeeds;
