/**
 * Quest seed data.
 *
 * Quests are data, not code: this file exists so the prototype has something to
 * render, and so the same 10 quests can be reproduced in any environment. It is
 * not a migration, and adding a quest here never requires one.
 *
 * COORDINATES ARE VERIFIED TO TOWN LEVEL, NOT TO THE BUILDING.
 *
 * Each pin was cross-checked against GeoNames settlement positions: every one
 * sits 0.1–4.5km from the town it belongs to, and the two Bsharri quests fall
 * on opposite sides of it (Deir Mar Elisha 1.3km SW, down in the gorge; the
 * Cedars 3.6km E, uphill), which is what the geography says they should.
 *
 * That rules out a transposed lat/lng, a wrong hemisphere, or a pin in the
 * wrong region. It does NOT tell you a pin is on the right building. Use
 * content/quests-review.csv to eyeball each one on a map.
 *
 * STORIES ARE DRAFTS AND HAVE NOT BEEN FACT-CHECKED. They were written without
 * access to a source to check them against, and they carry dates, names and
 * figures. Treat every number in them as a claim to verify, not a fact.
 *
 * SAFETY NOTES ARE UNVERIFIED and each one says so in its first line. Do not
 * remove that marker — the whole point is that it survives until a human has
 * actually checked the terrain, the access road and the opening hours.
 *
 * safetyNotesAr is deliberately still null. The database refuses to activate a
 * quest without safety notes in BOTH languages, so leaving Arabic empty keeps
 * the activation gate shut — which is right while the English text is itself
 * unverified.
 *
 * No quest uses `qr_scan`. The validator is a stub and there is no partner QR
 * at any site, so a qr_scan quest would be uncompletable. The module stays in
 * lib/validators/ for a future partner integration — this is a content
 * decision, not a code one.
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

  /** Draft. Not fact-checked — see the file header. */
  storyEn: string | null;
  storyAr: string | null;

  region: QuestRegion;
  category: QuestCategory;
  difficulty: Difficulty;

  /** WGS84 decimal degrees. Town-level verified only — see the file header. */
  lat: number;
  lng: number;

  /**
   * Metres. Sized to the footprint a visitor can legitimately stand in: a
   * temple complex or a hippodrome needs far more than a single viewpoint.
   */
  geofenceRadiusM: number;

  proofType: ProofType;
  proofHintEn: string;
  proofHintAr: string;

  /** Must begin with the UNVERIFIED marker until a human has checked it. */
  safetyNotesEn: string | null;
  /** Still null on purpose: this is what keeps the activation gate shut. */
  safetyNotesAr: string | null;

  estDurationMin: number;
  sortOrder: number;
}

/** Every draft safety note starts with this. Asserted in tests. */
export const UNVERIFIED_MARKER = '[UNVERIFIED — PAUL TO CONFIRM]';

export const questSeeds: QuestSeed[] = [
  {
    slug: 'harissa-our-lady-of-lebanon',
    titleEn: 'Our Lady of Lebanon, Harissa',
    titleAr: 'سيدة لبنان – حريصا',
    summaryEn:
      'A bronze statue on a hilltop above Jounieh bay, reached by a winding road or by the téléphérique.',
    summaryAr:
      'تمثال برونزي على تلة تطل على خليج جونية، يُوصل إليه بالطريق الجبلية أو بالتلفريك.',
    storyEn:
      'The statue was cast in France and shipped to Beirut in sections, then hauled up the hill and assembled in 1907. It was consecrated the following year, fifty years after the Vatican proclaimed the Immaculate Conception a dogma — which is why the shrine stands here at all. Fifteen tonnes of bronze, painted white, set on a stone base with a staircase spiralling up inside it. The téléphérique from Jounieh is far younger: it opened in 1965, shut through the civil war, and reopened in 1995. Most visitors walk the outer ramp without ever realising the base is hollow.',
    storyAr:
      'صُبّ التمثال في فرنسا ونُقل إلى بيروت مقسّماً إلى أجزاء، ثم جُرّ صعوداً إلى التلة ورُكّب سنة ١٩٠٧. وكُرّس في السنة التالية، بعد خمسين عاماً على إعلان الفاتيكان عقيدة الحبل بلا دنس، وهذا سبب وجود المزار هنا أصلاً. خمسة عشر طناً من البرونز المطلي بالأبيض، فوق قاعدة حجرية يلتفّ في داخلها درج حلزوني. أما التلفريك الصاعد من جونية فأحدث بكثير: افتُتح سنة ١٩٦٥، وأُقفل طوال الحرب الأهلية، وأعيد تشغيله سنة ١٩٩٥. ويصعد معظم الزوار المنحدر الخارجي دون أن يعرفوا أن القاعدة مجوّفة.',
    region: 'mount_lebanon',
    category: 'religious',
    difficulty: 2,
    lat: 33.9839,
    lng: 35.6506,
    // Statue platform, ramp and the basilica terrace below it.
    geofenceRadiusM: 200,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the bay from the platform at the base of the statue.',
    proofHintAr: 'التقط صورة للخليج من المنصة الواقعة عند قاعدة التمثال.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
Access by car on the Jounieh–Harissa mountain road: steep, tight switchbacks, poor lighting after dark. The téléphérique is the alternative and does not run in high wind or thunderstorms. The final approach to the statue is an open spiral ramp with a low parapet, no shade, and it is slippery when wet. Open daily roughly dawn to dusk; the basilica keeps its own hours. Modest dress expected. Winter fog on this road can cut visibility to a few metres with no warning.`,
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
    storyEn:
      'The name is not Arabic. It comes from the French rocher, rock, and stuck to the whole quarter. The two stacks are what is left of a limestone headland the sea has been cutting back for millennia, and the arch in the larger one is a cave roof that has not yet fallen. Less visible from the corniche railing: the cliffs behind you are among Lebanon’s richest prehistoric ground. Jesuit scholars working around Ras Beirut from the 1890s catalogued flint tools left by people who lived on this headland tens of thousands of years before Phoenicia.',
    storyAr:
      'الاسم ليس عربياً، بل مشتقّ من الكلمة الفرنسية rocher أي الصخرة، ثم لصق بالحيّ كلّه. والصخرتان بقيّة رأس كلسي ظلّ البحر يقضمه آلاف السنين، والقوس في الصخرة الكبرى سقف مغارة لم ينهَر بعد. وما لا يُرى من سياج الكورنيش أنّ الجرف خلفك من أغنى المواقع ما قبل التاريخية في لبنان: فقد جمع باحثون يسوعيون عملوا في رأس بيروت منذ تسعينيات القرن التاسع عشر أدوات صوّانية تركها بشر عاشوا على هذا الرأس قبل عشرات آلاف السنين من الفينيقيين.',
    region: 'beirut',
    category: 'urban',
    difficulty: 1,
    lat: 33.8908,
    lng: 35.4705,
    // The stretch of corniche from which both stacks frame together.
    geofenceRadiusM: 250,
    proofType: 'photo_at_location',
    proofHintEn: 'Stand at the corniche railing and frame both rocks in one shot.',
    proofHintAr: 'قف عند سياج الكورنيش والتقط الصخرتين في صورة واحدة.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
Photograph from the Corniche pavement only. The clifftop beyond the railing is unfenced in places and undercut, and there have been fatal falls — do not climb over it. The Corniche is open at all hours but unlit in stretches. Winter storms throw spray and occasional waves across the seaward pavement, and the wind on the headland is strong enough to unbalance a person. Boat trips to the arch run from the rocks below in calm weather only and are not regulated. No shade in summer.`,
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
    storyEn:
      'An American missionary, William Thomson, rediscovered the lower cave in 1836 and fired his gun into the dark to judge its size from the echo. The river running through it is the Nahr al-Kalb, and it still supplies drinking water to a large part of Beirut — the cave is infrastructure as much as attraction. The upper galleries, the ones you walk, opened only in 1958. Both levels closed during the civil war and did not reopen until 1995. Photography is banned inside, which is why the ticket, and not the picture, is your proof here.',
    storyAr:
      'أعاد المبشّر الأميركي وليم طومسون اكتشاف المغارة السفلى سنة ١٨٣٦، وأطلق عياراً نارياً في العتمة ليقدّر اتساعها من الصدى. والنهر الجاري فيها هو نهر الكلب، ولا يزال يزوّد جزءاً كبيراً من بيروت بمياه الشفة، فالمغارة بنية تحتية بقدر ما هي معلم سياحي. أما الممرّات العليا التي تُجال سيراً فلم تُفتح إلا سنة ١٩٥٨. وأُقفل المستويان خلال الحرب الأهلية ولم يُعد فتحهما قبل ١٩٩٥. والتصوير ممنوع في الداخل، ولهذا فإنّ بطاقة الدخول لا الصورة هي إثباتك هنا.',
    region: 'mount_lebanon',
    category: 'nature',
    difficulty: 2,
    lat: 33.9442,
    lng: 35.6414,
    // Ticket hall, upper and lower cave entrances and the link between them.
    geofenceRadiusM: 350,
    proofType: 'receipt_photo',
    proofHintEn:
      'Photography is banned inside the caves. Photograph your dated entry ticket instead.',
    proofHintAr:
      'التصوير ممنوع داخل المغارة. صوّر بطاقة الدخول المؤرخة بدلاً من ذلك.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
Reached by car from the Nahr al-Kalb valley road; the final approach is narrow and parking fills at peak times. The grotto closes on Mondays outside high season, and the lower cave shuts entirely when the river rises — typically after heavy winter rain and during spring snowmelt. Check before travelling. Inside, walkways are wet, uneven and hold at roughly 16–22°C year round; bring a layer. Cameras and phones must be left at the entrance. Not wheelchair accessible. The boat section is cancelled in high water without notice.`,
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
    storyEn:
      'Nobody knows who the Temple of Bacchus was for. The name is an eighteenth-century guess by European travellers; the building carries no dedication, and its carved vines and poppies could point to several cults. What is certain sits underneath it: three foundation blocks, each around eight hundred tonnes, cut from a quarry a kilometre away and moved by means still argued over. In 2014 archaeologists uncovered a fourth block still lying in that quarry, larger than any of them at roughly 1,650 tonnes — the biggest worked stone known from the ancient world.',
    storyAr:
      'لا أحد يعرف لمن بُني «معبد باخوس». فالاسم تخمين أطلقه رحّالة أوروبيون في القرن الثامن عشر، والمبنى لا يحمل نصّ تكريس، وزخارف الكرمة والخشخاش فيه قد تشير إلى أكثر من عبادة. أمّا المؤكّد فتحت البناء: ثلاث كتل أساس يزن كلّ منها نحو ثمانمئة طنّ، قُطعت من محجر على بعد كيلومتر ونُقلت بوسائل ما زالت موضع جدل. وفي سنة ٢٠١٤ كشف الأثريون في ذلك المحجر كتلة رابعة ما زالت في الأرض، أكبر منها جميعاً وتناهز ١٦٥٠ طنّاً، وهي أضخم حجر منحوت معروف من العالم القديم.',
    region: 'bekaa',
    category: 'heritage',
    difficulty: 3,
    lat: 34.0069,
    lng: 36.2039,
    // The sanctuary is roughly 300m by 200m before the approach and car park.
    geofenceRadiusM: 450,
    proofType: 'photo_of_object',
    proofHintEn: 'Photograph the standing columns of the Temple of Bacchus from the east steps.',
    proofHintAr: 'صوّر أعمدة معبد باخوس القائمة من الدرج الشرقي.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
Baalbek is in the northern Beqaa. Check current government and embassy travel advice for the area before planning a visit; guidance changes. The drive from Beirut is roughly two hours over the Dahr el-Baidar pass, which can close in snow between December and March. On site the footing is uneven ancient paving with open drops at the podium edge and no railings across much of the complex. Very little shade, and summer temperatures regularly pass 35°C. Winter hours are shorter. Do not photograph checkpoints or military positions on the approach road.`,
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
    storyEn:
      'Look at the castle walls and you will see Roman column drums laid sideways through the masonry. The Crusaders built here in 1103 and quarried the ruins beneath them for material, using the columns as horizontal ties to bind the rubble core. The castle is younger than almost everything around it. The find that made Byblos famous came later: after a landslide in 1922 exposed the royal tombs, Pierre Montet lifted out the sarcophagus of Ahiram, carrying one of the longest early alphabetic inscriptions known — ancestor of the script you are reading now.',
    storyAr:
      'انظر إلى جدران القلعة تجد أسطوانات أعمدة رومانية موضوعة بالعرض داخل البناء. فقد بنى الصليبيون هنا سنة ١١٠٣ واقتلعوا موادّ البناء من الأنقاض تحتهم، واستعملوا الأعمدة روابط أفقية تشدّ القلب الحجري. فالقلعة أحدث من كلّ ما حولها تقريباً. أمّا الاكتشاف الذي جعل جبيل مشهورة فجاء لاحقاً: بعد انهيار أرضي سنة ١٩٢٢ كشف المدافن الملكية، أخرج بيار مونتيه ناووس أحيرام الذي يحمل واحدة من أطول الكتابات الأبجدية المبكرة المعروفة، وهي أصل الخطّ الذي تقرأ به الآن.',
    region: 'mount_lebanon',
    category: 'heritage',
    difficulty: 2,
    lat: 34.1208,
    lng: 35.6455,
    // Keep plus the excavated site around it, down to the harbour edge.
    geofenceRadiusM: 250,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the harbour from the top of the Crusader keep.',
    proofHintAr: 'صوّر المرفأ من أعلى برج القلعة الصليبية.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
The archaeological site is entered by ticket from the old souk. The keep is reached by worn stone stairs with uneven treads and a low parapet at the top, slippery after rain. The site closes in the late afternoon and earlier in winter, with last entry before the posted closing time. Parking in Jbeil is limited at weekends and through the summer. The seaward edge of the site is unfenced above the water in places. Little shade between the ruins and the keep.`,
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
    storyEn:
      'In 1990 cavers working a ledge above the valley floor at Asi al-Hadath found eight bodies, mummified by nothing but the dry air of the cave. They were villagers, women and children among them, who hid there during a Mamluk campaign in the thirteenth century and never came out. Their clothes, coins and manuscripts survived with them, and rank among the best-preserved medieval textiles in the region. The valley was a refuge long before it was a monastery route: Deir Qannoubine served as the Maronite patriarchal seat for close to four centuries.',
    storyAr:
      'في سنة ١٩٩٠ عثر مستكشفو مغاور على حافة فوق قعر الوادي في عاصي الحدث على ثماني جثث حنّطها هواء المغارة الجافّ وحده. كانوا قرويين، بينهم نساء وأطفال، اختبأوا هناك أثناء حملة مملوكية في القرن الثالث عشر ولم يخرجوا. وبقيت ثيابهم ونقودهم ومخطوطاتهم معهم، وهي من أفضل المنسوجات الوسيطة حفظاً في المنطقة. وكان الوادي ملجأً قبل أن يكون درب أديرة بزمن طويل: فقد شغل دير قنوبين مقرّ البطريركية المارونية قرابة أربعة قرون.',
    region: 'north',
    category: 'nature',
    difficulty: 5,
    // Anchored at Deir Mar Elisha, the usual descent point at the head of the
    // valley.
    lat: 34.2447,
    lng: 35.9986,
    // Wide on purpose: the quest is the valley floor and the monastery trail,
    // not a single doorway. Still tight enough to exclude the Bsharri rim road.
    geofenceRadiusM: 1500,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the valley floor from anywhere on the monastery trail.',
    proofHintAr: 'صوّر قعر الوادي من أي نقطة على درب الدير.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
This is a hiking quest, not a viewpoint. The descent from Bsharri to the valley floor is steep and loose underfoot and takes well over an hour each way; the climb back out is the harder half. There is no phone signal through much of the gorge. Avoid between November and March, when the path ices and rockfall is common, and after heavy rain at any time of year. Start early — the valley loses light long before the rim does. Carry water; none on the route is safe to drink. A local guide is strongly advised.`,
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
    storyEn:
      'The stone wall around the grove was paid for by Queen Victoria. In 1876 the trees were being stripped by goats and by visitors taking souvenirs, and the British consul arranged the funds to enclose them. That wall is the reason the grove still exists. What it encloses is small: a few hundred trees, of which only a handful are more than a thousand years old, whatever numbers you are told at the gate. The threat now is not goats but warmth — a sawfly once killed off by hard winters has begun defoliating trees, and the snow line keeps climbing.',
    storyAr:
      'الجدار الحجري المحيط بالغابة دفعت كلفته الملكة فيكتوريا. ففي سنة ١٨٧٦ كانت الماعز والزوّار الباحثون عن تذكار ينهشون الأشجار، فدبّر القنصل البريطاني مالاً لتسويرها. وذلك الجدار هو سبب بقاء الغابة إلى اليوم. وما يحيط به قليل: بضع مئات من الأشجار، لا يتجاوز عمر إلا حفنة منها ألف سنة، مهما قيل لك من أرقام عند المدخل. والخطر اليوم ليس الماعز بل الدفء: فحشرة منشارية كان الشتاء القارس يقضي عليها بدأت تعرّي الأشجار من أوراقها، وخطّ الثلج يصعد أعلى فأعلى.',
    region: 'north',
    category: 'nature',
    difficulty: 3,
    lat: 34.2447,
    lng: 36.0492,
    // The enclosed grove and its gate; roughly 500m across.
    geofenceRadiusM: 400,
    proofType: 'photo_of_object',
    proofHintEn: 'Photograph one of the named ancient cedars, with its marker visible.',
    proofHintAr: 'صوّر إحدى أشجار الأرز المعمّرة المسمّاة مع ظهور لوحتها التعريفية.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
The grove sits at roughly 2,000m. The road up from Bsharri is steep and either closes or requires snow chains in winter, typically December to March. Thin air and strong sun even when the temperature is low. Stay on the marked paths inside the enclosure: the root systems are fragile and the grove is a protected reserve. Do not take cuttings, cones or wood. Daylight hours, small entry fee. Weather turns fast at this altitude and cloud can drop visibility within minutes.`,
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
    storyEn:
      'Bashir Shihab II spent some thirty years building this, from 1788, and brought craftsmen from Damascus for the stonework. The part most visitors walk straight past is the lower courtyard. Those vaulted stables once held around five hundred horses; they now hold one of the largest collections of Byzantine mosaics in the country, lifted from churches on the coast near Jiyeh and reassembled here floor by floor. The palace has had several lives since — Ottoman administration, French Mandate offices, and a summer residence of the Lebanese president, which it remains.',
    storyAr:
      'أمضى بشير الشهابي الثاني نحو ثلاثين سنة في بناء هذا القصر ابتداءً من سنة ١٧٨٨، واستقدم حرفيين من دمشق لأعمال الحجر. والجزء الذي يمرّ به معظم الزوّار دون انتباه هو الباحة السفلى: فتلك الإسطبلات المعقودة التي كانت تأوي نحو خمسمئة فرس صارت اليوم تضمّ واحدة من أكبر مجموعات الفسيفساء البيزنطية في البلاد، رُفعت من كنائس ساحلية قرب الجيّة وأعيد تركيبها هنا أرضيةً أرضيةً. وللقصر منذ ذلك الحين حيوات عدّة: إدارة عثمانية، فمكاتب للانتداب الفرنسي، فمقرّ صيفي لرئيس الجمهورية، وهو ما زال كذلك.',
    region: 'mount_lebanon',
    category: 'heritage',
    difficulty: 3,
    lat: 33.6944,
    lng: 35.5814,
    // The palace envelope: three courtyards, the hammams and the stables.
    geofenceRadiusM: 250,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the main courtyard from the upper arcade.',
    proofHintAr: 'صوّر الباحة الرئيسية من الرواق العلوي.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
Reached on the Chouf mountain road from Damour or Beirut, roughly an hour and a half, with switchbacks and occasional rockfall after rain. The palace closes on Mondays and shuts to the public during the summer festival period and for official use — confirm before travelling. Courtyards and stairs are polished stone and slippery when wet; the lower stables are dim and uneven underfoot. Modest dress expected. Snow reaches the Chouf in winter and roads can close at short notice. Photography rules vary by room.`,
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
    storyEn:
      'The island was sacred long before the Crusaders arrived in 1228. It carried a temple to Melqart, the god the Greeks matched with Herakles. When the Crusaders built, they used what was lying around: look along the outer walls near sea level and you will find Roman granite columns laid horizontally through the stonework, tying the courses together. Storms have since worn the masonry back around them, so the column ends now protrude from the wall like pins. The Mamluks slighted the castle, and Fakhr al-Din rebuilt parts of it in the seventeenth century.',
    storyAr:
      'كانت الجزيرة مقدّسة قبل وصول الصليبيين سنة ١٢٢٨ بزمن طويل، إذ حملت معبداً لملقرت، الإله الذي طابقه اليونان بهرقل. ولمّا بنى الصليبيون استعملوا ما وجدوه: تأمّل الجدران الخارجية عند مستوى البحر تجد أعمدة غرانيت رومانية موضوعة أفقياً داخل البناء تشدّ المداميك بعضها إلى بعض. وقد آكلت العواصف الحجارة حولها فصارت أطراف الأعمدة تبرز من الجدار كالمسامير. وقد هدم المماليك القلعة جزئياً، وأعاد فخر الدين بناء أقسام منها في القرن السابع عشر.',
    region: 'south',
    category: 'heritage',
    difficulty: 2,
    lat: 33.5686,
    lng: 35.3675,
    // The islet and the causeway back to the waterfront.
    geofenceRadiusM: 180,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the causeway from the castle, looking back toward the old city.',
    proofHintAr: 'صوّر الجسر من القلعة باتجاه المدينة القديمة.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
The castle is reached by a stone causeway from the Saida waterfront, fully exposed to the sea and overtopped by spray and waves in winter storms and strong westerlies. Inside, stairs are uneven and worn smooth, there are open drops without railings, and doorways are low. Not suitable for unaccompanied small children or anyone unsteady on their feet. Daylight hours, shorter in winter, and the site can close without notice in bad weather. Parking near the old city is difficult and the surrounding souk is narrow and busy.`,
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
    storyEn:
      'The track at Al-Bass runs about four hundred and eighty metres, which makes it one of the largest Roman hippodromes known anywhere — built for chariot teams, with room for tens of thousands. The stone turning posts at each end still stand, and the curve where the crowd pressed closest is still legible in the seating. Beside the track runs a road lined with hundreds of sarcophagi, and beyond it an aqueduct and a monumental arch. The whole complex was a cemetery road: Romans buried along the approach so arrivals passed the dead first.',
    storyAr:
      'يبلغ طول حلبة البصّ نحو أربعمئة وثمانين متراً، ما يجعلها من أكبر ميادين سباق العربات الرومانية المعروفة في العالم، بُنيت لفرق العربات وتتّسع لعشرات الألوف. ولا تزال أعمدة الانعطاف الحجرية قائمة في الطرفين، والمنحنى الذي كان الجمهور يتزاحم عنده ما زال واضحاً في المدرّجات. وإلى جانب الحلبة طريق تصطفّ عليه مئات النواويس، وخلفها قناة مياه وقوس نصر. وكان المجمّع كلّه طريق مقبرة: إذ دفن الرومان موتاهم على المدخل ليمرّ القادمون بهم أوّلاً.',
    region: 'south',
    category: 'heritage',
    difficulty: 3,
    lat: 33.2725,
    lng: 35.2075,
    // The track alone is ~480m long; this covers it plus the arch and necropolis.
    geofenceRadiusM: 600,
    proofType: 'photo_at_location',
    proofHintEn: 'Photograph the length of the track from the spina at its centre.',
    proofHintAr: 'صوّر امتداد الحلبة من الحاجز الأوسط في وسطها.',
    safetyNotesEn: `[UNVERIFIED — PAUL TO CONFIRM]
Tyre is in the south. Check current government and embassy travel advice for the area before planning a visit; guidance changes. The Al-Bass site is large, open and almost entirely without shade, so visit early or late in summer. Footing is uneven sandstone, loose gravel and low ruins with trip hazards throughout. Daylight hours, shorter in winter, and the site closes in rain. The approach passes the Al-Bass camp — drive slowly, and do not photograph checkpoints or military positions. Allow more time than the distance suggests.`,
    safetyNotesAr: null,
    estDurationMin: 90,
    sortOrder: 20,
  },
];

export default questSeeds;
