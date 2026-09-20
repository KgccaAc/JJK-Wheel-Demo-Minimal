import json
import os
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


PROJECT = Path(__file__).resolve().parents[2]
REPORT_DIR = PROJECT / "reports" / "web-acceptance" / "20260918-205958"
BASE_URL = os.environ.get("LOCAL_WEB_URL", "http://127.0.0.1:8095/index.html")
HEADLESS = os.environ.get("WEB_HEADLESS", "1") != "0"


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    result = {
        "base_url": BASE_URL,
        "headless": HEADLESS,
        "pages": [],
        "console_errors": [],
        "page_errors": [],
        "room_create": None,
        "room_join": None,
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        contexts = []
        try:
            def new_side(side):
                context = browser.new_context(
                    viewport={"width": 1672, "height": 941},
                    ignore_https_errors=True,
                )
                page = context.new_page()
                contexts.append(context)

                def on_console(msg, side=side):
                    if msg.type == "error":
                        result["console_errors"].append({"side": side, "text": msg.text})

                def on_page_error(exc, side=side):
                    result["page_errors"].append({"side": side, "text": str(exc)})

                page.on("console", on_console)
                page.on("pageerror", on_page_error)
                return page

            def boot_to_online(page, side):
                response = page.goto(
                    f"{BASE_URL}?room-test={side}",
                    wait_until="domcontentloaded",
                    timeout=30000,
                )
                page.wait_for_selector("canvas", timeout=30000)
                page.wait_for_timeout(5500)
                page.mouse.click(410, 775)
                page.wait_for_timeout(300)
                page.mouse.click(300, 887)
                page.wait_for_timeout(1000)
                page.mouse.click(410, 517)
                page.wait_for_timeout(4500)
                page.mouse.click(1400, 300)
                page.wait_for_timeout(5500)
                page.screenshot(path=str(REPORT_DIR / f"web-{side}-online.png"), full_page=True)
                return response

            host = new_side("host")
            guest = new_side("guest")
            host_response = boot_to_online(host, "host")
            guest_response = boot_to_online(guest, "guest")
            host.mouse.click(720, 90)  # 自建联机房间
            guest.mouse.click(720, 90)  # 自建联机房间
            host.wait_for_timeout(2500)
            guest.wait_for_timeout(2500)
            host.screenshot(path=str(REPORT_DIR / "web-host-room-page.png"), full_page=True)
            guest.screenshot(path=str(REPORT_DIR / "web-guest-room-page.png"), full_page=True)
            result["pages"] = [
                {
                    "side": "host",
                    "url": host.url,
                    "status": host_response.status if host_response else None,
                    "title": host.title(),
                    "canvas_count": host.locator("canvas").count(),
                    "screenshot": str(REPORT_DIR / "web-host-online.png"),
                },
                {
                    "side": "guest",
                    "url": guest.url,
                    "status": guest_response.status if guest_response else None,
                    "title": guest.title(),
                    "canvas_count": guest.locator("canvas").count(),
                    "screenshot": str(REPORT_DIR / "web-guest-online.png"),
                },
            ]

            try:
                with host.expect_response(
                    lambda r: "/preview-room-api/api/rooms" in r.url and r.request.method == "POST",
                    timeout=20000,
                ) as response_info:
                    host.mouse.click(220, 460)
                room_response = response_info.value
                body = room_response.json()
                result["room_create"] = {
                    "status": room_response.status,
                    "url": room_response.url,
                    "body": body,
                }
            except PlaywrightTimeoutError as exc:
                result["room_create"] = {
                    "error": "create_response_timeout",
                    "detail": str(exc),
                }
            host.wait_for_timeout(2500)
            host.screenshot(path=str(REPORT_DIR / "web-host-room-created.png"), full_page=True)

            created = result["room_create"].get("body", {}) if result["room_create"] else {}
            data = created.get("data", {}) if isinstance(created, dict) else {}
            room = data.get("room", created.get("room", created)) if isinstance(data, dict) else {}
            room_code = str(room.get("roomId", room.get("room_id", room.get("room_code", room.get("roomCode", room.get("code", ""))))))
            if room_code:
                guest.mouse.click(1210, 345)
                guest.keyboard.type(room_code)
                guest.mouse.click(1015, 610)
                guest.wait_for_timeout(3500)
                guest.screenshot(path=str(REPORT_DIR / "web-guest-joined.png"), full_page=True)
                host.wait_for_timeout(2500)
                host.screenshot(path=str(REPORT_DIR / "web-host-peer-joined.png"), full_page=True)
                result["room_join"] = {"room_code": room_code, "ui_attempted": True}
            else:
                result["room_join"] = {"ui_attempted": False, "reason": "room_code_missing"}

            print(json.dumps(result, ensure_ascii=False, indent=2))
            (REPORT_DIR / "local-web-dual-page-initial.json").write_text(
                json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            ok_pages = all(
                item.get("status") == 200 and item.get("canvas_count", 0) > 0
                for item in result["pages"]
            )
            ok_create = (
                isinstance(result.get("room_create"), dict)
                and result["room_create"].get("status") in (200, 201)
            )
            ok_join = (
                isinstance(result.get("room_join"), dict)
                and result["room_join"].get("ui_attempted") is True
            )
            return 0 if ok_pages and ok_create and ok_join else 1
        finally:
            for context in contexts:
                context.close()
            browser.close()


if __name__ == "__main__":
    raise SystemExit(main())
