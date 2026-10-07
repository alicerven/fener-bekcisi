"""Tanıtım videosunun karelerini başsız Chrome ile yakalar (Chrome DevTools Protocol).
Gereken: canli-sunucu.py çalışıyor olmalı (http://127.0.0.1:8080), google-chrome, websocket-client.
Çıktı: <out>/kare_00000.png …, kart_baslik.png, kart_kapanis.png, ses.json
  python video/kayit_al.py /tmp/opencode/fb-video
"""
import base64, json, pathlib, subprocess, sys, tempfile, time, urllib.request
import websocket

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/opencode/fb-video")
URL = "http://127.0.0.1:8080/fener-bekcisi/?kayit=1"
PORT = 9333
OUT.mkdir(parents=True, exist_ok=True)
for f in OUT.glob("kare_*.png"):
    f.unlink()

prof = tempfile.mkdtemp(prefix="fb-chrome-")
chrome = subprocess.Popen([
    "google-chrome", "--headless=new", f"--remote-debugging-port={PORT}", f"--user-data-dir={prof}",
    "--window-size=1280,720", "--hide-scrollbars", "--mute-audio", "--no-first-run", "--autoplay-policy=no-user-gesture-required",
    "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
            page = next(t for t in tabs if t["type"] == "page")
            break
        except Exception:
            time.sleep(0.2)
    ws = websocket.create_connection(page["webSocketDebuggerUrl"], max_size=None, suppress_origin=True)
    msg_id = 0

    def cdp(method, **params):
        global msg_id
        msg_id += 1
        ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
        while True:
            r = json.loads(ws.recv())
            if r.get("id") == msg_id:
                if "error" in r:
                    raise RuntimeError(r["error"])
                return r.get("result", {})

    def js(expr):
        r = cdp("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"])
        return r["result"].get("value")

    def shot(path):
        data = cdp("Page.captureScreenshot", format="png", clip={"x": 0, "y": 0, "width": 1280, "height": 720, "scale": 1})["data"]
        path.write_bytes(base64.b64decode(data))

    cdp("Emulation.setDeviceMetricsOverride", width=1280, height=720, deviceScaleFactor=1, mobile=False)
    cdp("Page.navigate", url=URL)
    for _ in range(100):
        time.sleep(0.1)
        try:
            if js("!!window.__kayit"):
                break
        except Exception:
            pass
    time.sleep(0.5)

    js("__kayit.showCard('title')"); time.sleep(0.2); shot(OUT / "kart_baslik.png")
    js("__kayit.showCard('outro')"); time.sleep(0.2); shot(OUT / "kart_kapanis.png")
    js("__kayit.reset()")

    total, fps = js("__kayit.TOTAL"), js("__kayit.FPS")
    n = int(round(total * fps))
    t0 = time.time()
    for i in range(n):
        js("__kayit.frame()")
        shot(OUT / f"kare_{i:05d}.png")
        if i % 100 == 0:
            print(f"{i}/{n} kare · {time.time() - t0:.0f} sn", flush=True)
    (OUT / "ses.json").write_text(json.dumps(js("__kayit.log()"), ensure_ascii=False, indent=1))
    print(f"bitti: {n} kare, {time.time() - t0:.0f} sn")
finally:
    chrome.terminate()
