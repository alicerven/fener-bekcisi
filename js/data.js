/* Bölüm verisi.
   Harita lejantı:  .  çimen   =  iskele (yürünür)   T ağaç   B çalı   W deniz   F çit
                    H kırmızı çatılı ev   G gri ev   O fıçı   L fener (etkileşim noktası, engel)
   Yürünebilen zemin: '.', ':' (parke yol) ve '='; geri kalan her şey engel. Konumlar (sütun, satır).
   lines: bu bölümün diyalog anahtarları (js/lines.js). item: toplanan nesnenin türü. */
window.FB = window.FB || {};
FB.LEVELS = [
  {
    id: 1,
    item: 'shard',
    map: [
      'TTTTTTTTTTTTTTTTTWWWWWWW',
      'T......F...........T..LW',
      'T......F...........T...W',
      'T......F.....HHH....T..W',
      'T......F.....HHH.......W',
      'T.GG.........HHH..FFFF.W',
      'T.GG..FFFF..........T..W',
      'T.....F..F..BBBB....T..W',
      'TTT...F..F.....T....T.WW',
      'T.....F........T.......W',
      'T.....FFFF..BBBB...FFF.W',
      'T......................W',
      'T....O.........O.......W',
      'TTTTTTTTTTTTTTTTTTTTTTTW',
    ],
    player: [1, 1],
    nuri: [3, 2],
    lighthouse: [22, 1],
    items: [[10, 2], [17, 9], [2, 10]],
    enemies: [
      [[10, 6], [19, 6]],
      [[1, 11], [22, 11]],
      [[7, 9], [14, 9]],
    ],
    windows: [[13, 5], [15, 5], [2, 6]],
    lamps: [],
    lines: {
      intro: ['intro1', 'intro2'], n0: ['n0_1', 'alev_nuri', 'alev_anlatici', 'n0_2', 'n0_3', 'n0_4', 'n0_5'], n1: (got) => 'n1_' + (3 - got),
      n2: ['n2_1', 'n2_2', 'n2_3'], n3: 'n3', lit: ['l1', 'l2', 'l3'], locked: 'kilit', pickup: 'parca', all: 'hepsi',
    },
  },
  {
    id: 2,
    item: 'oil',
    // SEVİYE 2: dünya 4 kat büyük (48×28) ve kamera oyuncuyu izler; gerçek 2D gölgeler, yağmur, sis, suda yansımalar.
    // Oyuncu çitle çevrili, lambası yanık bir avluda başlar. Ana bulvar (15-16. satır) devriyesiz ana yoldur;
    // her Gölgenin kendi bölgesi var. Harita tools/harita2.py ile üretilip doğrulandı.
    tier: 2,
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TB...BF.HHH.:.HHH..HHH..GGG....:.GGGGG..GGGGG..T',
      'T.....F.HHH.:.HHH..HHH..GGG.BB.:.GGGGG..GGGGG..T',
      'T.....F.HHH.:.HHH..HHH..GGG.BB.:.GGGGG..GGGGG..T',
      'T.....F.....:..................:...............T',
      'T.....F.....:..................:...............T',
      'TFF.FFF.....:.BB..O.....O......:......FFFFFFFFFT',
      'T...........:.BB.BOBBO.BOBBO...:......F........T',
      'T.......GGG.:..................:.GGGG.F..O.O...T',
      'T.HHH...GGG.:........O.........:.GGGG..........T',
      'T.HHH...GGG.:.HHH.........HHH..:.GGGG.F.....O..T',
      'T.HHH.......:.HHH.........HHH..:......F..O.....T',
      'T...........:.HHH.O.....O.HHH..:......F.O......T',
      'TB.....B..B.:..................:......FFFFFFFFFT',
      'T...........:..................:...............T',
      'T::::::::::::::::::::::::::::::::::::::::::::::T',
      'T::::::::::::::::::::::::::::::::::::::::::::::T',
      'T............OO..................O.............T',
      'T.................F..........F....O............T',
      'WWW=WWWWW=WWWWWWWWWWWWW==WWWWWWWWWWWWWWWWW=WWWWW',
      'WWW=WWWWW=WWWWWWWWWWWWW==WWWWWWWWWWWWWWWWW=WWWWW',
      'WWW=WWWWW=WWWWWWWWWWWWW==WWWWWWWWWWWWWWWWW=WWWWW',
      'WWW=WWWWWWWWWWWWWWWWWWW==WWWWWWWWWWWWWWWWW=WWWWW',
      'WWW=WWWWWWWWWWWWWWWWWWW==WWWWWWWWWWWWWWWWW=WWWWW',
      'WWW=WWWWWWWWWWWWWWWWWWW==WWWWWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWWWWW==WWWWWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWWWWW==WWWWWWWWWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
    player: [2, 3],
    nuri: [24, 19],
    lighthouse: [23, 27],
    items: [[44, 11], [3, 24], [25, 5]],
    enemies: [
      [[40, 7], [45, 7], [45, 12], [42, 12]],   // depo avlusu
      [[17, 4], [27, 4], [27, 6], [17, 6]],     // çarşı meydanı (kuzeyde)
      [[1, 17], [11, 17]],                      // batı rıhtımı
      [[35, 17], [46, 17]],                     // doğu rıhtımı
      [[33, 5], [46, 5]],                       // depoların önü
    ],
    // sokak lambaları: ışığına (3×3 karo) Gölgeler giremez. litAtStart: bölüm başında yanık olanlar
    lamps: [[4, 3], [3, 14], [12, 14], [22, 14], [30, 14], [38, 14], [37, 9], [43, 9], [3, 18], [3, 21], [23, 5]],
    litAtStart: [0],
    lines: {
      intro: ['b2_intro1', 'b2_intro2'], n0: ['b2_n0_1', 'alev_nuri', 'alev_anlatici', 'b2_n0_2', 'b2_n0_3', 'b2_n0_4'], n1: () => 'b2_n1',
      n2: ['b2_n2_1', 'b2_n2_2'], n3: 'b2_n3', lit: ['b2_l1', 'b2_l2', 'b2_l3'], locked: 'b2_kilit', pickup: 'b2_kandil', all: 'b2_hepsi',
      lamp: 'b2_lamba',
    },
  },
];
