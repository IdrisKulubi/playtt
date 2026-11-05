"""Headless export of the editor's bundle: python editor-export.py [url]"""
import sys, zipfile, pathlib
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
out = pathlib.Path(__file__).parent / "editor-out"
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1800, "height": 1100})
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(2500)
    page.screenshot(path=str(out / "editor-view.png"))
    with page.expect_download(timeout=240000) as dl:
        page.get_by_role("button", name="Export bundle").click()
    d = dl.value
    zp = out / "bundle.zip"
    d.save_as(str(zp))
    b.close()
import shutil
shutil.rmtree(out / "bundle", ignore_errors=True)
with zipfile.ZipFile(zp) as z:
    z.extractall(out / "bundle")
    print(len(z.namelist()), "files")
    print("\n".join(z.namelist()[:12]))
