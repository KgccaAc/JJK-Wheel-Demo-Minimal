"""Fixed browser path from login to the online room page.

The Godot Web export renders into one canvas, so the script uses the stable
1672x941 viewport and records a screenshot after every player-visible step.
It is deliberately limited to the entrance flow; room creation is opt-in.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


PROJECT = Path(__file__).resolve().parents[2]
DEFAULT_ARTIFACT = PROJECT / "reports" / "web-acceptance" / "20260918-205958"
VIEWPORT = {"width": 1672, "height": 941}

# Coordinates are for the project's fixed desktop canvas. The export is
# configured to stretch to the viewport, so this remains deterministic.
POINTS = {
    "login_method": (410, 775),
    "guest_option": (300, 887),
    "start_game": (410, 517),
    "online_mode": (1400, 300),
    "create_room_tab": (720, 90),
    "create_room": (220, 460),
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def click(page: Page, name: str) -> None:
    x, y = POINTS[name]
    page.mouse.click(x, y)


def capture(page: Page, output: Path, stage: str, stages: list[dict[str, Any]]) -> None:
    path = output / f"{stage}.png"
    page.screenshot(path=str(path), full_page=True)
    stages.append(
        {
            "stage": stage,
            "path": str(path),
            "sha256_prefix": digest(path),
            "canvas_count": page.locator("canvas").count(),
            "url": page.url,
        }
    )


def run_page(page: Page, side: str, base_url: str, output: Path, result: dict[str, Any]) -> None:
    stages: list[dict[str, Any]] = []
    result["pages"].append({"side": side, "stages": stages})
    page.goto(f"{base_url}?online-entry={side}", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_selector("canvas", timeout=30000)
    # The 252 MB PCK can finish mounting at different times in two tabs. Give
    # the second tab a deterministic post-boot settling window before input.
    page.wait_for_timeout(9000)
    capture(page, output, f"{side}-01-login", stages)

    click(page, "login_method")
    page.wait_for_timeout(300)
    capture(page, output, f"{side}-02-login-methods", stages)
    click(page, "guest_option")
    page.wait_for_timeout(1000)
    capture(page, output, f"{side}-03-guest-selected", stages)

    click(page, "start_game")
    page.wait_for_timeout(4500)
    capture(page, output, f"{side}-04-home", stages)

    click(page, "online_mode")
    page.wait_for_timeout(5500)
    capture(page, output, f"{side}-05-online-matchmaking", stages)

    click(page, "create_room_tab")
    page.wait_for_timeout(2500)
    capture(page, output, f"{side}-06-online-room", stages)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=os.environ.get("LOCAL_WEB_URL", "http://127.0.0.1:8095/index.html"))
    parser.add_argument("--output", default=str(DEFAULT_ARTIFACT))
    parser.add_argument("--pages", type=int, choices=(1, 2), default=2)
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--create-room", action="store_true")
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    result: dict[str, Any] = {
        "status": "started",
        "url": args.url,
        "viewport": VIEWPORT,
        "pages": [],
        "console_errors": [],
        "page_errors": [],
        "request_failures": [],
        "network": [],
        "create_room": None,
        "room_join": None,
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed)
        contexts = []
        pages: dict[str, Page] = {}
        try:
            for side in ("host", "guest")[: args.pages]:
                context = browser.new_context(viewport=VIEWPORT, ignore_https_errors=True)
                contexts.append(context)
                page = context.new_page()
                page.on(
                    "console",
                    lambda message, side=side: result["console_errors"].append(
                        {"side": side, "type": message.type, "text": message.text}
                    )
                    if message.type == "error"
                    else None,
                )
                page.on(
                    "pageerror",
                    lambda error, side=side: result["page_errors"].append(
                        {"side": side, "text": str(error)}
                    ),
                )
                page.on(
                    "requestfailed",
                    lambda request, side=side: result["request_failures"].append(
                        {"side": side, "url": request.url, "error": request.failure}
                    ),
                )
                page.on(
                    "request",
                    lambda request, side=side: result["network"].append(
                        {"side": side, "event": "request", "method": request.method, "url": request.url}
                    )
                    if "/preview-room-api/" in request.url
                    else None,
                )
                page.on(
                    "response",
                    lambda response, side=side: result["network"].append(
                        {"side": side, "event": "response", "status": response.status, "url": response.url}
                    )
                    if "/preview-room-api/" in response.url
                    else None,
                )
                pages[side] = page
                run_page(page, side, args.url, output, result)

            if args.create_room:
                host = pages.get("host")
                if host is None:
                    result["create_room"] = {"status": "missing_host"}
                else:
                    try:
                        host.wait_for_timeout(1200)
                        with host.expect_response(
                            lambda response: "/preview-room-api/api/rooms" in response.url
                            and response.request.method == "POST",
                            timeout=15000,
                        ) as response_info:
                            click(host, "create_room")
                        response = response_info.value
                        body = response.json()
                        result["create_room"] = {
                            "status": response.status,
                            "url": response.url,
                            "body": body,
                        }
                        host_stages = next(item["stages"] for item in result["pages"] if item["side"] == "host")
                        capture(host, output, "host-07-room-created", host_stages)
                    except PlaywrightTimeoutError as error:
                        result["create_room"] = {"status": "timeout", "error": str(error)}

                created = result.get("create_room") or {}
                body = created.get("body", {}) if isinstance(created, dict) else {}
                data = body.get("data", {}) if isinstance(body, dict) else {}
                room = data.get("room", body.get("room", {})) if isinstance(data, dict) else {}
                room_code = str(room.get("roomId", room.get("room_id", room.get("code", "")))) if isinstance(room, dict) else ""
                guest = pages.get("guest")
                if room_code and guest is not None:
                    try:
                        guest.wait_for_timeout(1500)
                        with guest.expect_response(
                            lambda response: "/preview-room-api/api/rooms" in response.url
                            and response.request.method == "POST",
                            timeout=15000,
                        ) as response_info:
                            guest.mouse.click(1210, 345)
                            guest.keyboard.type(room_code)
                            guest.mouse.click(1015, 610)
                        response = response_info.value
                        result["room_join"] = {
                            "status": response.status,
                            "url": response.url,
                            "room_code": room_code,
                            "body": response.json(),
                        }
                        guest_stages = next(item["stages"] for item in result["pages"] if item["side"] == "guest")
                        capture(guest, output, "guest-07-room-joined", guest_stages)
                        host.wait_for_timeout(2500)
                        capture(host, output, "host-08-peer-joined", host_stages)
                    except PlaywrightTimeoutError as error:
                        # A canvas can be visually ready one frame before the
                        # scene finishes reconnecting its button signals. One
                        # bounded retry keeps the script deterministic while
                        # still failing on a real missing request.
                        try:
                            guest.wait_for_timeout(1800)
                            with guest.expect_response(
                                lambda response: "/preview-room-api/api/rooms" in response.url
                                and response.request.method == "POST",
                                timeout=10000,
                            ) as response_info:
                                guest.mouse.click(1015, 610)
                            response = response_info.value
                            result["room_join"] = {
                                "status": response.status,
                                "url": response.url,
                                "room_code": room_code,
                                "body": response.json(),
                                "retry": True,
                            }
                            guest_stages = next(item["stages"] for item in result["pages"] if item["side"] == "guest")
                            capture(guest, output, "guest-07-room-joined", guest_stages)
                            host.wait_for_timeout(2500)
                            capture(host, output, "host-08-peer-joined", host_stages)
                        except PlaywrightTimeoutError as retry_error:
                            result["room_join"] = {"status": "timeout", "room_code": room_code, "error": str(retry_error), "initial_error": str(error)}
                elif args.pages == 2:
                    result["room_join"] = {"status": "skipped", "reason": "room_code_missing"}
                else:
                    result["room_join"] = {"status": "skipped", "reason": "single_page"}

            api_failures = [
                item for item in result["request_failures"] if "/preview-room-api/" in item.get("url", "")
            ]
            create_required = bool(args.create_room)
            create_ok = isinstance(result.get("create_room"), dict) and result["create_room"].get("status") in (200, 201)
            join_required = create_required and args.pages == 2
            join_ok = isinstance(result.get("room_join"), dict) and result["room_join"].get("status") in (200, 201)
            result["status"] = (
                "passed"
                if not result["console_errors"]
                and not result["page_errors"]
                and not api_failures
                and (not create_required or create_ok)
                and (not join_required or join_ok)
                else "failed"
            )
        finally:
            for context in contexts:
                context.close()
            browser.close()

    report = output / "online-entry-flow.json"
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
