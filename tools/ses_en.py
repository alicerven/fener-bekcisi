"""İngilizce seslendirmeleri Kokoro-82M (int8 ONNX, ~88 MB, Apache-2.0) ile yerel olarak üretir.
Metinler js/lines.js dosyasından okunur (tek kaynak).

Kurulum (bir kez):
  uv venv ~/.local/share/kokoro/venv --python 3.12
  uv pip install --python ~/.local/share/kokoro/venv/bin/python kokoro-onnx soundfile
  # model: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
  #   kokoro-v1.0.int8.onnx + voices-v1.0.bin  →  ~/.local/share/kokoro/
Çalıştır:
  ~/.local/share/kokoro/venv/bin/python tools/ses_en.py
"""
import json, pathlib, re, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = pathlib.Path.home() / ".local/share/kokoro"
OUT = ROOT / "audio" / "en"
OUT.mkdir(parents=True, exist_ok=True)

src = (ROOT / "js" / "lines.js").read_text(encoding="utf-8")
lines = json.loads(re.search(r"FB\.LINES\s*=\s*(\{.*\});", src, re.S).group(1))

# Konuşmacı → (Kokoro sesi, aksan, hız)
VOICES = {"nuri": ("bm_george", "en-gb", 0.92), "narrator": ("af_heart", "en-us", 0.95)}

tts = Kokoro(str(MODEL / "kokoro-v1.0.int8.onnx"), str(MODEL / "voices-v1.0.bin"))
for i, (key, line) in enumerate(lines.items(), 1):
    voice, lang, speed = VOICES[line["who"]]
    audio, sr = tts.create(line["en"], voice=voice, speed=speed, lang=lang)
    sf.write(OUT / f"{key}.mp3", audio, sr, format="MP3")
    print(f"[{i}/{len(lines)}] {key} ({voice}): {len(audio)/sr:.1f} sn")
