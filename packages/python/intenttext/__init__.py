from .merge import merge_data, parse_and_merge
from .parser import parse, parse_safe, ALIASES, ALL_KEYWORDS
from .query import query
from .renderer import render_html, render_markdown, render_print
from .source import to_source
from .trust import compute_document_hash, find_history_boundary, seal_document, verify_document
from .types import (
    InlineSegment,
    IntentBlock,
    IntentDocument,
    IntentMetadata,
    ParseResult,
    ParseWarning,
    TrackingInfo,
    SignatureInfo,
    FreezeInfo,
    ValidationIssue,
    ValidationResult,
)
from .validate import validate

__version__ = "3.3.0"

__all__ = [
    "parse",
    "parse_safe",
    "render_html",
    "render_print",
    "render_markdown",
    "merge_data",
    "parse_and_merge",
    "validate",
    "query",
    "to_source",
    "compute_document_hash",
    "find_history_boundary",
    "seal_document",
    "verify_document",
    "ALIASES",
    "ALL_KEYWORDS",
    "IntentDocument",
    "IntentBlock",
    "IntentMetadata",
    "TrackingInfo",
    "SignatureInfo",
    "FreezeInfo",
    "InlineSegment",
    "ParseResult",
    "ParseWarning",
    "ValidationResult",
    "ValidationIssue",
]
