// Closed sets the matcher scores against. Stimuli are our own; no licensed test items.

export type Lang = 'en' | 'ar'

// Arabic entries are drafts awaiting review by a native Gulf Arabic speaker.
export const ARABIC_REVIEWED = false

// Two ten-word lists per language. Rule: common concrete nouns, one or two syllables in
// English, no two words from the same category in a list, no animals (they would clash
// with the naming task), no words that sound alike within a list.
export const WORD_LISTS: Record<Lang, string[][]> = {
  en: [
    ['river', 'candle', 'doctor', 'window', 'garden', 'pencil', 'bridge', 'butter', 'jacket', 'mirror'],
    ['basket', 'tower', 'lemon', 'pillow', 'farmer', 'ticket', 'ocean', 'hammer', 'ribbon', 'kettle'],
  ],
  ar: [
    ['نهر', 'شمعة', 'طبيب', 'نافذة', 'حديقة', 'قلم', 'جسر', 'زبدة', 'معطف', 'مرآة'],
    ['سلة', 'برج', 'ليمون', 'وسادة', 'مزارع', 'تذكرة', 'بحر', 'مطرقة', 'شريط', 'إبريق'],
  ],
}

export const SOUND_CHECK_WORDS: Record<Lang, string[]> = {
  en: ['table', 'water', 'morning'],
  ar: ['طاولة', 'ماء', 'صباح'],
}

// Each row is one animal: the first form is the label, the rest are accepted variants.
// Scoring rule for close kin (stated, so a human scorer can apply the same one): different
// names for the same animal count once (camel, dromedary); male, female and young of one
// animal count once (camel, she-camel, calf of a camel) because the row is the unit.
const EN_ANIMALS: string[][] = [
  ['dog', 'puppy'], ['cat', 'kitten'], ['horse', 'pony', 'mare', 'stallion', 'foal'], ['cow', 'bull', 'calf', 'cattle', 'ox'],
  ['sheep', 'lamb', 'ram', 'ewe'], ['goat', 'kid goat'], ['pig', 'hog', 'piglet', 'boar'], ['camel', 'dromedary'], ['donkey', 'ass', 'mule'],
  ['lion', 'lioness'], ['tiger', 'tigress'], ['elephant'], ['giraffe'], ['zebra'], ['monkey'], ['gorilla'], ['chimpanzee', 'chimp'],
  ['bear'], ['polar bear'], ['panda'], ['wolf'], ['fox'], ['deer', 'stag', 'doe', 'fawn'], ['rabbit', 'bunny', 'hare'], ['mouse', 'mice'],
  ['rat'], ['squirrel'], ['hippopotamus', 'hippo'], ['rhinoceros', 'rhino'], ['leopard'], ['cheetah'], ['hyena'], ['kangaroo'], ['koala'],
  ['crocodile'], ['alligator'], ['snake', 'serpent', 'cobra', 'python', 'viper'], ['lizard', 'gecko'], ['turtle', 'tortoise'], ['frog', 'toad'],
  ['chicken', 'hen', 'rooster', 'chick', 'cock'], ['duck', 'duckling'], ['goose', 'geese'], ['turkey'], ['pigeon', 'dove'], ['eagle'],
  ['falcon', 'hawk'], ['owl'], ['parrot'], ['peacock'], ['sparrow'], ['crow', 'raven'], ['ostrich'], ['penguin'], ['flamingo'], ['swan'],
  ['fish'], ['shark'], ['whale'], ['dolphin'], ['seal'], ['octopus'], ['crab'], ['lobster'], ['shrimp', 'prawn'], ['jellyfish'],
  ['bee'], ['ant'], ['butterfly'], ['spider'], ['fly'], ['mosquito'], ['scorpion'], ['beetle'], ['worm'], ['snail'],
  ['bat'], ['gazelle'], ['oryx'], ['antelope'], ['buffalo', 'bison'], ['moose', 'elk'], ['reindeer'], ['llama', 'alpaca'], ['otter'],
  ['beaver'], ['raccoon'], ['skunk'], ['hedgehog'], ['porcupine'], ['mole'], ['badger'], ['jaguar'], ['panther'], ['lynx', 'bobcat'],
  ['walrus'], ['hamster'], ['guinea pig'], ['bird'], ['salmon'], ['tuna'], ['goldfish'], ['stingray', 'ray'], ['seahorse'], ['starfish'],
  ['wasp'], ['grasshopper', 'locust'], ['cricket'], ['dragonfly'], ['ladybird', 'ladybug'], ['caterpillar'], ['moth'], ['cockroach'],
  ['vulture'], ['pelican'], ['seagull', 'gull'], ['stork'], ['heron'], ['woodpecker'], ['hummingbird'], ['canary'], ['quail'],
  ['baboon'], ['orangutan'], ['lemur'], ['sloth'], ['armadillo'], ['anteater'], ['wombat'], ['platypus'], ['meerkat'], ['mongoose'],
  ['warthog'], ['wildebeest'], ['ibex'], ['yak'], ['jackal'], ['coyote'], ['weasel', 'ferret', 'stoat'], ['chameleon'], ['iguana'], ['eel'],
]

const AR_ANIMALS: string[][] = [
  ['جمل', 'بعير', 'ناقة', 'إبل', 'حوار', 'بكرة', 'قعود'], ['حصان', 'خيل', 'فرس', 'مهر'], ['كلب', 'جرو'], ['قطة', 'قط', 'بسة', 'قطوة', 'هر'],
  ['بقرة', 'ثور', 'عجل', 'بقر'], ['خروف', 'غنم', 'نعجة', 'كبش', 'شاة'], ['ماعز', 'عنز', 'تيس', 'معزة'], ['حمار', 'جحش'], ['أسد', 'سبع', 'لبوة'],
  ['نمر'], ['فيل'], ['زرافة'], ['قرد', 'سعدان'], ['دب'], ['ذئب', 'ذيب'], ['ثعلب'], ['غزال', 'ظبي', 'غزالة'], ['مها', 'وضيحي'], ['أرنب'],
  ['فأر', 'فار'], ['ضبع'], ['فهد'], ['تمساح'], ['ثعبان', 'حية', 'أفعى'], ['ضب', 'سحلية'], ['سلحفاة'], ['ضفدع'], ['دجاجة', 'دجاج', 'ديك', 'صوص'],
  ['بطة', 'بط'], ['حمامة', 'حمام'], ['صقر', 'شاهين'], ['نسر'], ['بومة'], ['ببغاء'], ['طاووس'], ['عصفور'], ['غراب'], ['نعامة'], ['حبارى'],
  ['سمكة', 'سمك'], ['قرش'], ['حوت'], ['دلفين'], ['سرطان', 'قبقب'], ['روبيان', 'جمبري'], ['نحلة', 'نحل'], ['نملة', 'نمل'], ['فراشة'],
  ['عنكبوت'], ['ذبابة', 'ذباب'], ['بعوضة', 'بعوض'], ['عقرب'], ['خفاش'], ['وعل', 'طهر'], ['جاموس'], ['قنفذ'], ['كنغر'], ['حمار وحشي'],
  ['وحيد القرن', 'خرتيت'], ['فرس النهر'], ['بطريق'], ['طير', 'طائر'], ['جرادة', 'جراد'], ['هدهد'], ['نورس'],
]

export const ANIMALS: Record<Lang, string[][]> = { en: EN_ANIMALS, ar: AR_ANIMALS }
