/* Bölüm verisi.
   Harita lejantı:  .  çimen   T ağaç   B çalı   W deniz   F çit   H kırmızı çatılı ev   G gri ev   O fıçı   L fener
   Yürünebilen tek zemin '.'; geri kalan her şey engel. Varlıkların konumları (sütun, satır) olarak aşağıda. */
window.FB = window.FB || {};
FB.LEVEL = {
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
  shards: [[10, 2], [17, 9], [2, 10]],
  // her Gölge: devriye noktaları
  enemies: [
    [[10, 6], [19, 6]],
    [[1, 11], [22, 11]],
    [[7, 9], [14, 9]],
  ],
  // evlerin pencereleri (sıcak ışık kaynakları)
  windows: [[13, 5], [15, 5], [2, 6]],
};
