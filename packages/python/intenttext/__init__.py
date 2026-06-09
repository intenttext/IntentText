"""IntentText for Python — a thin client over the canonical TypeScript core.

This package does not re-implement the IntentText grammar. Parsing is delegated to
the canonical `@intenttext/core` CLI (see :mod:`intenttext.parser`), guaranteeing the
Python and JS results never diverge. It is currently **experimental** and not part of
the supported v4 release surface.
"""

from .parser import (
    IntentTextCoreNotFound,
    IntentTextParseError,
    parse,
    parse_safe,
)
from .types import (
    FreezeInfo,
    InlineSegment,
    IntentBlock,
    IntentDocument,
    IntentMetadata,
    ParseResult,
    ParseWarning,
    SignatureInfo,
    TrackingInfo,
)

__version__ = "4.0.0"

__all__ = [
    "parse",
    "parse_safe",
    "IntentTextCoreNotFound",
    "IntentTextParseError",
    "InlineSegment",
    "IntentBlock",
    "IntentDocument",
    "IntentMetadata",
    "ParseResult",
    "ParseWarning",
    "TrackingInfo",
    "SignatureInfo",
    "FreezeInfo",
    "__version__",
]
