#!/usr/bin/env python3
"""Minimal, dependency-free TonForge Agent API client (stdlib only).

    TONFORGE_AGENT_TOKEN=tfa_... python3 client.py

The acting wallet is derived from the token; you only pass a wallet where the
API requires it in the body (create listing).
"""
import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("TONFORGE_API", "https://tonforge.org/api/v1/agent")
TOKEN = os.environ.get("TONFORGE_AGENT_TOKEN")
if not TOKEN:
    raise SystemExit("Set TONFORGE_AGENT_TOKEN")


class TonForgeAgent:
    def __init__(self, token: str, base: str = BASE) -> None:
        self.token = token
        self.base = base

    def _call(self, method: str, path: str, body: dict | None = None) -> dict:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as resp:
                payload = json.load(resp)
        except urllib.error.HTTPError as e:
            payload = json.load(e)
            # API returns {error, code} or {success:false, message, code}.
            code = payload.get("code", "")
            msg = payload.get("error") or payload.get("message") or "request failed"
            raise RuntimeError(f"{e.code} {code}: {msg}") from None
        return payload.get("data", {})

    def me(self) -> dict:
        return self._call("GET", "/me")

    def list_listings(self) -> list:
        return self._call("GET", "/listings").get("listings", [])

    def create_listing(self, **fields) -> dict:
        return self._call("POST", "/listings", fields).get("listing", {})

    def update_listing(self, listing_id: str, **patch) -> dict:
        return self._call("PATCH", f"/listings/{listing_id}", patch).get("listing", {})

    def list_orders(self, limit: int = 100) -> list:
        return self._call("GET", f"/orders?limit={limit}").get("orders", [])


if __name__ == "__main__":
    agent = TonForgeAgent(TOKEN)
    print("identity:", agent.me())
    listings = agent.list_listings()
    print(f"you have {len(listings)} listing(s)")
    orders = agent.list_orders(10)
    print(f"latest {len(orders)} order(s):", orders)
