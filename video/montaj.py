"""Tanıtım videosunun montajı: başlık kartı → ÖNCE (eski demodan kesit) → SONRA (yakalanan kareler + ses) → kapanış kartı.
Önce video/kayit_al.py ile kareleri yakala.
  ~/.local/share/kokoro/venv/bin/python video/montaj.py /tmp/opencode/fb-video
Gerekli: imageio-ffmpeg (ffmpeg ikilisi), soundfile.
"""
import json, pathlib, subprocess, sys
import soundfile as sf
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/opencode/fb-video")
OLD = ROOT.parent / "yetenek-vitrini" / "video" / "exo-vitrin.mp4"   # ÖNCE: ilk demonun videosu
OUT = ROOT / "video" / "fener-bekcisi-once-sonra.mp4"
FONT = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
FPS = 25
OLD_FROM, OLD_LEN = 33.4, 7.0      # eski videoda oyun bölümü
TITLE_LEN, OUTRO_LEN = 3.2, 4.0

def run(args):
    subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)

# 1) SONRA bölümünün sesi: oyunun ses günlüğünü oyundaki kurallarla yeniden oynat
#    play: çalanı keser, yenisini başlatır · idle: bir şey çalıyorsa atlanır · stop: çalanı keser
events = json.loads((SRC / "ses.json").read_text())
n_frames = len(list(SRC.glob("kare_*.png")))
after_len = n_frames / FPS
clips, cur = [], None
for e in events:
    t = e["t"]
    if cur and t < cur["end"] and e["type"] in ("play", "stop"):
        cur["end"] = t
    if e["type"] == "stop":
        cur = None
        continue
    if e["type"] == "idle" and cur and t < cur["end"]:
        continue
    path = ROOT / "audio" / e["lang"] / f"{e['key']}.mp3"
    dur = sf.info(str(path)).duration
    cur = {"path": path, "start": t, "end": t + dur}
    clips.append(cur)
# diyalog hızla geçildiğinde kesilen çok kısa klipler ("Kıyı ka—") kulağa kötü gelir: 1,2 sn'den kısa kalan kesikleri at
clips = [c for c in clips if c["end"] - c["start"] >= 1.2 or c["end"] - c["start"] >= sf.info(str(c["path"])).duration - 0.01]
print("sesler:", [(round(c["start"], 2), c["path"].parent.name + "/" + c["path"].stem, round(c["end"] - c["start"], 2)) for c in clips])

args, fl = [], []
for i, c in enumerate(clips):
    args += ["-i", str(c["path"])]
    ms = int(c["start"] * 1000)
    fl.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{c['end'] - c['start']:.3f},afade=t=out:st={max(0, c['end'] - c['start'] - 0.04):.3f}:d=0.04,adelay={ms}|{ms}[a{i}]")
mix = "".join(f"[a{i}]" for i in range(len(clips)))
fl.append(f"{mix}amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{after_len:.3f}[out]")
run([*args, "-filter_complex", ";".join(fl), "-map", "[out]", "-ar", "48000", str(SRC / "sonra.wav")])

# 2) parçalar (hepsi 1280x720, 25 fps, 48 kHz stereo)
V = f"fps={FPS},scale=1280:720:flags=lanczos,setsar=1,format=yuv420p"
A = "aresample=48000,aformat=channel_layouts=stereo"
enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "160k"]
silent = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]

run(["-loop", "1", "-t", str(TITLE_LEN), "-i", str(SRC / "kart_baslik.png"), *silent,
     "-vf", f"{V},fade=t=in:st=0:d=0.4,fade=t=out:st={TITLE_LEN - 0.3}:d=0.3", "-af", A, "-t", str(TITLE_LEN), *enc, str(SRC / "p1.mp4")])

# "BEFORE" etiketi: bu ffmpeg derlemesinde drawtext yok, etiketi Pillow ile PNG olarak çizip bindiriyoruz
from PIL import Image, ImageDraw, ImageFont
lab = Image.new("RGBA", (470, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(lab)
d.rounded_rectangle((0, 0, 469, 63), 12, fill=(5, 7, 15, 225), outline=(248, 81, 73, 255), width=3)
d.text((22, 13), "BEFORE · the original demo", font=ImageFont.truetype(FONT, 28), fill=(255, 255, 255, 255))
lab.save(SRC / "etiket_once.png")
run(["-ss", str(OLD_FROM), "-t", str(OLD_LEN), "-i", str(OLD), "-i", str(SRC / "etiket_once.png"),
     "-filter_complex", f"[0:v]{V}[b];[b][1:v]overlay=40:36,fade=t=in:st=0:d=0.3,fade=t=out:st={OLD_LEN - 0.3}:d=0.3[v]",
     "-map", "[v]", "-map", "0:a", "-af", f"{A},afade=t=out:st={OLD_LEN - 0.3}:d=0.3", *enc, str(SRC / "p2.mp4")])

run(["-framerate", str(FPS), "-i", str(SRC / "kare_%05d.png"), "-i", str(SRC / "sonra.wav"),
     "-vf", f"{V},fade=t=in:st=0:d=0.3,fade=t=out:st={after_len - 0.4}:d=0.4", "-af", A, "-shortest", *enc, str(SRC / "p3.mp4")])

run(["-loop", "1", "-t", str(OUTRO_LEN), "-i", str(SRC / "kart_kapanis.png"), *silent,
     "-vf", f"{V},fade=t=in:st=0:d=0.4,fade=t=out:st={OUTRO_LEN - 0.5}:d=0.5", "-af", A, "-t", str(OUTRO_LEN), *enc, str(SRC / "p4.mp4")])

# 3) birleştir
ins = []
for p in ("p1", "p2", "p3", "p4"):
    ins += ["-i", str(SRC / f"{p}.mp4")]
run([*ins, "-filter_complex", "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a]concat=n=4:v=1:a=1[v][a]",
     "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-profile:v", "high", "-pix_fmt", "yuv420p",
     "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(OUT)])
print("çıktı:", OUT)
