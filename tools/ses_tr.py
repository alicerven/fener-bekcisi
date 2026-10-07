"""Türkçe seslendirmeleri EMA Lightning ile yerel olarak üretir (yalnızca eksik olanları).
Metinler js/lines.js dosyasından okunur (tek kaynak).
  ~/.local/share/ema-lightning/venv/bin/python tools/ses_tr.py          # eksikleri üret
  ~/.local/share/ema-lightning/venv/bin/python tools/ses_tr.py --hepsi  # hepsini yeniden üret
"""
import json, pathlib, re, sys
import soundfile as sf
from ema_lightning import EMA

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "audio" / "tr"
OUT.mkdir(parents=True, exist_ok=True)
src = (ROOT / "js" / "lines.js").read_text(encoding="utf-8")
lines = json.loads(re.search(r"FB\.LINES\s*=\s*(\{.*\});", src, re.S).group(1))
todo = {k: v for k, v in lines.items() if "--hepsi" in sys.argv or not (OUT / f"{k}.mp3").exists()}
print(f"{len(todo)} klip üretilecek")
if todo:
    tts = EMA()
    for i, (key, line) in enumerate(todo.items(), 1):
        sp = tts.say(line["tr"], seed=7, sample_rate=24000)
        sf.write(OUT / f"{key}.mp3", sp.audio, sp.sample_rate, format="MP3")
        print(f"[{i}/{len(todo)}] {key}: {sp.duration:.1f} sn", flush=True)
