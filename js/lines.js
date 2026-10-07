/* Oyundaki tüm konuşma satırları — tek kaynak.
   tools/ses_en.py bu dosyayı okuyup İngilizce sesleri üretir; bu yüzden '=' ile ';' arası geçerli JSON olmalı.
   who: "nuri" | "narrator"   ·   ses dosyası: audio/<dil>/<anahtar>.mp3 */
window.FB = window.FB || {};
FB.LINES = {
  "intro1": {"who": "narrator", "tr": "Kıyı kasabası, gece yarısı. Fener üç gecedir sönük.", "en": "A coastal town, midnight. The lighthouse has been dark for three nights."},
  "intro2": {"who": "narrator", "tr": "Yaşlı bekçi Nuri seni kulübesinin önünde bekliyor.", "en": "Nuri, the old keeper, is waiting for you outside his cabin."},
  "n0_1": {"who": "nuri", "tr": "Sonunda biri geldi! Fırtına fenerin merceğini paramparça etti.", "en": "At last, someone came! The storm shattered the lighthouse lens."},
  "n0_2": {"who": "nuri", "tr": "Üç mercek parçası kasabanın sokaklarına dağıldı. Parlayan mavi taşlar onlar.", "en": "Three pieces of the lens are scattered across the town. Look for the glowing blue stones."},
  "n0_3": {"who": "nuri", "tr": "Ama dikkat et. Işık sönünce Gölgeler sokaklara indi. Seni görürlerse peşine düşerler.", "en": "But be careful. When the light went out, the Shadows came down to the streets. If they see you, they will hunt you."},
  "n0_4": {"who": "nuri", "tr": "Duvarların arkasına saklan. Görüşlerini kesersen izini kaybeder, son gördükleri yeri ararlar.", "en": "Hide behind walls. Break their line of sight and they lose your trail, then search where they last saw you."},
  "n0_5": {"who": "narrator", "tr": "Görev: üç mercek parçasını topla.", "en": "Quest: collect the three lens shards."},
  "n1_3": {"who": "nuri", "tr": "Üç parça daha kaldı. Gölgelerden uzak dur!", "en": "Three more pieces to go. Stay away from the Shadows!"},
  "n1_2": {"who": "nuri", "tr": "İki parça daha kaldı. Gölgelerden uzak dur!", "en": "Two more pieces to go. Stay away from the Shadows!"},
  "n1_1": {"who": "nuri", "tr": "Bir parça daha kaldı. Gölgelerden uzak dur!", "en": "Just one more piece. Stay away from the Shadows!"},
  "n2_1": {"who": "nuri", "tr": "Üçünü de bulmuşsun! Ellerin titriyor ama başardın.", "en": "You found all three! Your hands are shaking, but you made it."},
  "n2_2": {"who": "nuri", "tr": "Merceği birleştirdim. Şimdi sağ üstteki fenere git ve onu yak.", "en": "I've put the lens back together. Now go to the lighthouse in the northeast and light it."},
  "n2_3": {"who": "narrator", "tr": "Görev güncellendi: feneri yak.", "en": "Quest updated: light the lighthouse."},
  "n3": {"who": "nuri", "tr": "Fener seni bekliyor evlat!", "en": "The lighthouse is waiting for you, kid!"},
  "l1": {"who": "narrator", "tr": "Merceği yerine oturttun. Fener yeniden parlıyor!", "en": "You set the lens in place. The lighthouse shines again!"},
  "l2": {"who": "narrator", "tr": "Işık sokaklara yayılırken Gölgeler dağılıp yok oluyor.", "en": "As the light spreads through the streets, the Shadows fade away."},
  "l3": {"who": "narrator", "tr": "Kasaba kurtuldu. Son.", "en": "The town is saved. The end."},
  "kilit": {"who": "narrator", "tr": "Fenerin kapısı kilitli. Mercek olmadan burada yapacak bir şey yok.", "en": "The lighthouse door is locked. Without the lens, there is nothing to do here."},
  "kayip1": {"who": "narrator", "tr": "Gölgeler seni sardı. Kasaba karanlıkta kaldı.", "en": "The Shadows surrounded you. The town remains in darkness."},
  "kayip2": {"who": "narrator", "tr": "Oyun bitti.", "en": "Game over."},
  "parca": {"who": "narrator", "tr": "Bir mercek parçası buldun!", "en": "You found a lens shard!"},
  "hepsi": {"who": "narrator", "tr": "Tüm parçalar toplandı! Nuri'ye dön.", "en": "All shards collected! Return to Nuri."},
  "vurus": {"who": "narrator", "tr": "Bir Gölge sana dokundu!", "en": "A Shadow touched you!"}
};
