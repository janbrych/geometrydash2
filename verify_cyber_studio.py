from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({"width": 1280, "height": 720})
    page.goto("http://localhost:8000/editor.html")
    page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/editor_cyber_studio.png")
    browser.close()
print("Screenshot captured")
