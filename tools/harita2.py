"""Bölüm 2 (Liman, 48×28) haritasını dikdörtgen tanımlarından üretir ve doğrular.
Çıktıyı js/data.js'teki map dizisine yapıştır.  python3 tools/harita2.py
Lejant: . çimen  : parke taşı yol  = iskele  T ağaç  B çalı  W deniz  F çit  H/G ev  O sandık/fıçı  L liman feneri
"""
W, H = 48, 28
g = [["." for _ in range(W)] for _ in range(H)]

def rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = ch

def put(pts, ch):
    for x, y in pts:
        g[y][x] = ch

# deniz ve kıyı
rect(0, 19, 47, 27, "W")
# kenarlar
rect(0, 0, 47, 0, "T"); rect(0, 0, 0, 18, "T"); rect(47, 0, 47, 18, "T")

# yollar: ana bulvar (15-16. satır) ve iki kuzey-güney cadde
rect(1, 15, 46, 16, ":")
rect(12, 1, 12, 14, ":")
rect(31, 1, 31, 14, ":")

# başlangıç avlusu (sol üst): çitle çevrili, 3. sütundan çıkış
rect(6, 1, 6, 6, "F"); rect(1, 6, 6, 6, "F"); g[6][3] = "."
put([(1, 1), (5, 1)], "B")

# batı mahallesi
rect(8, 1, 10, 3, "H")
rect(8, 8, 10, 10, "G")
rect(2, 9, 4, 11, "H")
put([(1, 13), (7, 13), (10, 13)], "B")

# çarşı meydanı ve çevresi (orta kuzey)
rect(14, 1, 16, 3, "H"); rect(19, 1, 21, 3, "H"); rect(24, 1, 26, 3, "G")
rect(14, 10, 16, 12, "H"); rect(26, 10, 28, 12, "H")
put([(18, 6), (24, 6), (21, 9), (18, 12), (24, 12)], "O")   # tezgâhlar/fıçılar
rect(28, 2, 29, 3, "B")
rect(14, 6, 15, 7, "B")
# çarşının güney sınırı: tezgâh/çalı sırası, ortada tek giriş (22,7); meydan kuzeyde kalır, güneydeki yollar görülmez
for x in range(17, 28):
    if x != 22:
        g[7][x] = "O" if x % 3 == 0 else "B"

# depo bölgesi (doğu): büyük depolar + çitle çevrili depo avlusu (kapısı batıda)
rect(33, 1, 37, 3, "G"); rect(40, 1, 44, 3, "G")
rect(33, 8, 36, 10, "G")
rect(38, 6, 46, 6, "F"); rect(38, 6, 38, 13, "F"); rect(38, 13, 46, 13, "F"); g[9][38] = "."   # avlu kapısı (38,9)
put([(41, 8), (43, 8), (41, 11), (44, 10), (40, 12)], "O")

# kıyı şeridi: rıhtımlar ve iskeleler
rect(1, 17, 46, 18, ".")
rect(3, 19, 3, 24, "=")            # batı iskelesi
rect(9, 19, 9, 21, "=")
rect(23, 19, 24, 26, "=")          # ana iskele
g[27][23] = "L"                    # liman feneri (ana iskelenin ucu)
rect(42, 19, 42, 23, "=")          # doğu iskelesi
put([(13, 17), (14, 17), (33, 17), (34, 18)], "O")   # rıhtım sandıkları
put([(18, 18), (29, 18)], "F")

rows = ["".join(r) for r in g]
assert all(len(r) == W for r in rows) and len(rows) == H

# doğrulama: önemli noktalar başlangıçtan erişilebilir mi
WALK = set(".:=")
from collections import deque
def reach(start):
    seen = {start}; q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and rows[ny][nx] in WALK and (nx, ny) not in seen:
                seen.add((nx, ny)); q.append((nx, ny))
    return seen
R = reach((3, 3))
checks = {"nuri(24,19)": (24, 19), "fener önü(23,26)": (23, 26), "kandil depo(44,11)": (44, 11),
          "kandil batı iskele(3,24)": (3, 24), "kandil çarşı(25,5)": (25, 5)}
for k, p in checks.items():
    print(("✓" if p in R else "✗"), k)
print()
for r in rows:
    print(f"      '{r}',")
