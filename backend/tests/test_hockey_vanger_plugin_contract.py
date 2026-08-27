"""Consistentie-bewaking voor het Ghost/Scout-plugin-contract (roadmap item
988, RFTR-B5): plugins/ghost/hockey-vanger-contract.json.

Ghost (plugins/ghost/ghost.py) laadt dit bestand echt runtime in. Scout
(plugins/chrome/hockey-vanger/interceptor.js + popup.js) kan dat niet -
interceptor.js draait als MAIN-world content script zonder chrome.*-
toegang, en popup.js's hash-opbouw is verweven met Scout-eigen localStorage-
boekhouding - dus staan de waarden daar bewust hardgecodeerd, met een
commentaar-verwijzing naar dit contract. Deze tests bewaken dat die
hardgecodeerde kopieën niet stilzwijgend van het contract afdrijven, en dat
elk cmd_type in het contract ook echt door de backend-dispatch wordt
afgehandeld."""

import json
import re
from pathlib import Path

import pytest

from routers.hockey_vanger_cmd_queue import _CMD_RESULT_DISPATCH

REPO_ROOT      = Path(__file__).resolve().parents[2]
CONTRACT_PATH  = REPO_ROOT / "plugins" / "ghost" / "hockey-vanger-contract.json"
INTERCEPTOR_JS = REPO_ROOT / "plugins" / "chrome" / "hockey-vanger" / "interceptor.js"
POPUP_JS       = REPO_ROOT / "plugins" / "chrome" / "hockey-vanger" / "popup.js"


@pytest.fixture(scope="module")
def contract():
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_every_contract_cmd_type_is_handled_by_the_backend_dispatch(contract):
    contract_cmd_types = set(contract["hash_templates"].keys())
    assert contract_cmd_types == set(_CMD_RESULT_DISPATCH.keys())


def test_interceptor_js_url_patterns_match_the_contract(contract):
    src = INTERCEPTOR_JS.read_text(encoding="utf-8")
    for name, pattern in contract["url_patterns"].items():
        # JSON-string -> JS-regex-literal-vorm: "/" is ongeescaped in het
        # contract, maar wél geescaped binnen een /.../ -literal in JS.
        js_literal_form = pattern.replace("/", r"\/")
        assert js_literal_form in src, f"url_pattern '{name}' niet (meer) gevonden in interceptor.js"

    assert contract["target_host"] in src, "target_host niet (meer) gevonden in interceptor.js"


def test_popup_js_hash_templates_match_the_contract(contract):
    src = POPUP_JS.read_text(encoding="utf-8")
    for cmd_type, template in contract["hash_templates"].items():
        # Statische tekstfragmenten tussen de {placeholders} - popup.js bouwt
        # de hash op via string-concatenatie, geen format-template, dus we
        # controleren de losse letterlijke stukken i.p.v. de hele string.
        fragments = [f for f in re.split(r"\{[^}]+\}", template) if len(f) >= 2]
        for frag in fragments:
            assert frag in src, f"fragment '{frag}' van hash_template '{cmd_type}' niet (meer) gevonden in popup.js"
