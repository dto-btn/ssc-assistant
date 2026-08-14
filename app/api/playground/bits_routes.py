"""Server-side BITS lookup so the browser never opens a direct MCP connection.

The playground BR table used to connect straight to the BITS MCP server from the browser.
This route runs the same lookup server-side behind the standard playground auth, so the
frontend only ever talks to the API.
"""

import logging

from apiflask import APIBlueprint
from flask import jsonify, request

from utils.auth import auth, user_ad
from tools.bits.bits_functions import get_br_information

logger = logging.getLogger(__name__)

api_playground_bits = APIBlueprint("api_playground_bits", __name__, tag="Playground")

# Cap the batch so a single request cannot fan out into an unbounded query.
_MAX_BR_NUMBERS = 25


@api_playground_bits.post("/bits/business-request")
@auth.login_required(role="chat")
@user_ad.login_required
def business_request_lookup():
    """Return Business Request records for the given BR numbers via the BITS backend."""
    payload = request.get_json(silent=True) or {}
    raw_numbers = payload.get("br_numbers")
    if not isinstance(raw_numbers, list) or not raw_numbers:
        return jsonify({"error": "br_numbers must be a non-empty array of integers"}), 400

    br_numbers: list[int] = []
    for value in raw_numbers:
        try:
            br_numbers.append(int(value))
        except (TypeError, ValueError):
            return jsonify({"error": "br_numbers must contain only integers"}), 400

    if len(br_numbers) > _MAX_BR_NUMBERS:
        return jsonify({"error": f"Too many BR numbers requested (max {_MAX_BR_NUMBERS})"}), 400

    try:
        result = get_br_information(br_numbers)
    except Exception:  # pylint: disable=broad-except
        logger.exception("BITS lookup failed for br_numbers=%s", br_numbers)
        return jsonify({"error": "BITS lookup failed"}), 502

    return jsonify(result)
