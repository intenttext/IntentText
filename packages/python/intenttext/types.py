from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class InlineSegment:
    type: str
    value: str
    href: Optional[str] = None


@dataclass
class IntentBlock:
    id: str
    type: str
    content: str
    original_content: str
    inline: list[InlineSegment] = field(default_factory=list)
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class TrackingInfo:
    version: str = ""
    by: str = ""
    active: bool = False


@dataclass
class SignatureInfo:
    signer: str = ""
    role: Optional[str] = None
    at: str = ""
    hash: str = ""
    valid: Optional[bool] = None


@dataclass
class FreezeInfo:
    at: str = ""
    hash: str = ""
    status: str = "locked"


@dataclass
class IntentMetadata:
    title: Optional[str] = None
    summary: Optional[str] = None
    agent: Optional[str] = None
    model: Optional[str] = None
    language: str = "ltr"
    context: dict[str, str] = field(default_factory=dict)
    tracking: Optional[TrackingInfo] = None
    signatures: list[SignatureInfo] = field(default_factory=list)
    freeze: Optional[FreezeInfo] = None
    meta: dict[str, str] = field(default_factory=dict)


@dataclass
class IntentDocument:
    version: str
    blocks: list[IntentBlock]
    metadata: IntentMetadata = field(default_factory=IntentMetadata)


@dataclass
class ParseWarning:
    line: int
    message: str
    code: str
    original: str


@dataclass
class ParseResult:
    document: IntentDocument
    warnings: list[ParseWarning] = field(default_factory=list)
    errors: list[ParseWarning] = field(default_factory=list)


@dataclass
class ValidationIssue:
    block_id: str
    block_type: str
    type: str
    code: str
    message: str


@dataclass
class ValidationResult:
    valid: bool
    issues: list[ValidationIssue] = field(default_factory=list)
