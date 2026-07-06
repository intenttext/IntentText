import { IntentBlock, IntentDocument, BlockType } from "./types";
import { flattenBlocks } from "./utils";

export interface PropertySchema {
  type: "string" | "number" | "boolean" | "date" | "enum" | "url" | "email";
  required?: boolean;
  default?: string | number | boolean;
  enumValues?: string[]; // for enum type
  pattern?: string; // regex for string validation
  min?: number; // for numbers
  max?: number; // for numbers
  format?:
    | "iso-date"
    | "iso-datetime"
    | "time"
    | "url"
    | "email"
    | "iban"
    | "bic"
    | "currency";
}

export interface BlockSchema {
  type: BlockType;
  content?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  properties?: Record<string, PropertySchema>;
  allowUnknownProperties?: boolean;
}

export interface DocumentSchema {
  name: string;
  description?: string;
  requiredBlocks?: BlockType[];
  blockSchemas?: Record<string, BlockSchema>; // key is block type
  allowUnknownBlocks?: boolean;
}

export interface ValidationError {
  blockId: string;
  blockType: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// Predefined schemas for common use cases
export const PREDEFINED_SCHEMAS: Record<string, DocumentSchema> = {
  project: {
    name: "project",
    description: "Project planning document",
    requiredBlocks: ["title"],
    blockSchemas: {
      task: {
        type: "task",
        properties: {
          owner: { type: "string" },
          due: { type: "date", format: "iso-date" },
          priority: { type: "enum", enumValues: ["low", "medium", "high"] },
        },
        allowUnknownProperties: true,
      },
      done: {
        type: "done",
        properties: {
          time: { type: "string", format: "time" },
        },
      },
    },
    allowUnknownBlocks: true,
  },

  meeting: {
    name: "meeting",
    description: "Meeting notes document",
    requiredBlocks: ["title", "section"],
    blockSchemas: {
      note: {
        type: "text",
        content: { required: true },
      },
      ask: {
        type: "ask",
        content: { required: true },
      },
      task: {
        type: "task",
        properties: {
          owner: { type: "string", required: true },
          due: { type: "date", format: "iso-date", required: true },
        },
      },
    },
    allowUnknownBlocks: true,
  },

  article: {
    name: "article",
    description: "Blog post or article",
    requiredBlocks: ["title", "summary"],
    blockSchemas: {
      image: {
        type: "image",
        properties: {
          src: { type: "url", required: true },
          at: { type: "url" }, // deprecated — parser normalizes at: → src:
          caption: { type: "string" },
        },
        allowUnknownProperties: true,
      },
      link: {
        type: "link",
        content: { required: true, minLength: 1 },
        properties: {
          to: { type: "url", required: true },
        },
      },
      section: {
        type: "section",
        content: { required: true, minLength: 1 },
      },
    },
    allowUnknownBlocks: false,
  },

  checklist: {
    name: "checklist",
    description: "Simple task checklist",
    requiredBlocks: ["title"],
    blockSchemas: {
      task: {
        type: "task",
        content: { required: true },
      },
      done: {
        type: "done",
        content: { required: true },
      },
    },
    allowUnknownBlocks: false,
  },

  agentic: {
    name: "agentic",
    description: "Agentic workflow document (v2.0+)",
    requiredBlocks: ["title"],
    blockSchemas: {
      step: {
        type: "step",
        content: { required: true },
        properties: {
          tool: { type: "string" },
          status: {
            type: "enum",
            enumValues: [
              "pending",
              "running",
              "blocked",
              "failed",
              "skipped",
              "cancelled",
              "done",
            ],
          } as PropertySchema,
          id: { type: "string" },
          depends: { type: "string" },
          timeout: { type: "number" },
          priority: { type: "number" },
          retries: { type: "number" },
        },
        allowUnknownProperties: true,
      },
      decision: {
        type: "decision",
        content: { required: true },
        properties: {
          if: { type: "string" },
          then: { type: "string" },
          else: { type: "string" },
        },
        allowUnknownProperties: true,
      },
      trigger: {
        type: "trigger",
        content: { required: true },
        properties: {
          event: { type: "string" },
        },
        allowUnknownProperties: true,
      },
      loop: {
        type: "loop",
        content: { required: true },
        properties: {
          over: { type: "string" },
          do: { type: "string" },
        },
        allowUnknownProperties: true,
      },
      retry: {
        type: "retry",
        content: { required: true },
        properties: {
          max: { type: "number" },
          delay: { type: "number" },
          backoff: {
            type: "enum",
            enumValues: ["linear", "exponential", "fixed"],
          },
        },
        allowUnknownProperties: true,
      },
      wait: {
        type: "wait",
        content: { required: true },
        properties: {
          timeout: { type: "string" },
          fallback: { type: "string" },
        },
        allowUnknownProperties: true,
      },
      parallel: {
        type: "parallel",
        content: { required: true },
        properties: {
          steps: { type: "string" },
          timeout: { type: "number" },
        },
        allowUnknownProperties: true,
      },
      handoff: {
        type: "handoff",
        content: { required: true },
        properties: {
          from: { type: "string" },
          to: { type: "string" },
        },
        allowUnknownProperties: true,
      },
      result: {
        type: "result",
        content: { required: true },
        properties: {
          status: {
            type: "enum",
            enumValues: ["success", "error", "failure"],
          },
          code: { type: "string" },
          data: { type: "string" },
        },
        allowUnknownProperties: true,
      },
      emit: {
        type: "signal",
        content: { required: true },
        properties: {
          phase: { type: "string" },
          level: { type: "string" },
          updated: { type: "string" },
        },
        allowUnknownProperties: true,
      },
    },
    allowUnknownBlocks: true,
  },
};

function validateProperty(
  value: unknown,
  schema: PropertySchema,
  fieldName: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const strValue = String(value);

  // Required check
  if (
    schema.required &&
    (value === undefined || value === null || value === "")
  ) {
    errors.push({
      blockId: "",
      blockType: "",
      field: fieldName,
      message: `Property "${fieldName}" is required`,
      severity: "error",
    });
    return errors;
  }

  // Skip further validation if value is empty and not required
  if (value === undefined || value === null || value === "") {
    return errors;
  }

  switch (schema.type) {
    case "number":
      if (isNaN(Number(value))) {
        errors.push({
          blockId: "",
          blockType: "",
          field: fieldName,
          message: `Property "${fieldName}" must be a number`,
          severity: "error",
        });
      } else {
        const num = Number(value);
        if (schema.min !== undefined && num < schema.min) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be >= ${schema.min}`,
            severity: "error",
          });
        }
        if (schema.max !== undefined && num > schema.max) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be <= ${schema.max}`,
            severity: "error",
          });
        }
      }
      break;

    case "date":
      const date = new Date(strValue);
      if (isNaN(date.getTime())) {
        // Try parsing as ISO date specifically
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (schema.format === "iso-date" && !isoDateRegex.test(strValue)) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be in ISO date format (YYYY-MM-DD)`,
            severity: "error",
          });
        } else if (!isoDateRegex.test(strValue) && !strValue.includes("T")) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be a valid date`,
            severity: "error",
          });
        }
      }
      break;

    case "enum":
      if (schema.enumValues && !schema.enumValues.includes(strValue)) {
        errors.push({
          blockId: "",
          blockType: "",
          field: fieldName,
          message: `Property "${fieldName}" must be one of: ${schema.enumValues.join(", ")}`,
          severity: "error",
        });
      }
      break;

    case "url":
      try {
        new URL(strValue);
      } catch {
        // Allow relative URLs
        if (!strValue.startsWith("/") && !strValue.startsWith("./")) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be a valid URL`,
            severity: "error",
          });
        }
      }
      break;

    case "email":
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(strValue)) {
        errors.push({
          blockId: "",
          blockType: "",
          field: fieldName,
          message: `Property "${fieldName}" must be a valid email address`,
          severity: "error",
        });
      }
      break;

    case "string":
      if (schema.pattern) {
        let regex: RegExp;
        try {
          regex = new RegExp(schema.pattern);
        } catch {
          // Invalid regex in schema — skip pattern validation rather than crash
          break;
        }
        if (!regex.test(strValue)) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" does not match required pattern`,
            severity: "error",
          });
        }
      }
      break;
  }

  // Format validation
  if (schema.format) {
    switch (schema.format) {
      case "iso-date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be ISO date (YYYY-MM-DD)`,
            severity: "error",
          });
        }
        break;
      case "time":
        if (!/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?$/i.test(strValue)) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be a valid time`,
            severity: "warning",
          });
        }
        break;
      // Financial formats (#61) — real structural validation, not just a regex:
      // IBAN carries a mod-97 checksum, BIC has an ISO 9362 shape, currency codes
      // are checked against the ISO 4217 active list. Banks reject malformed values
      // downstream; catching them at author/merge time prevents a silently wrong
      // payment instruction from ever being sealed.
      case "iban":
        if (!isValidIban(strValue)) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be a valid IBAN (ISO 13616 mod-97 checksum failed)`,
            severity: "error",
          });
        }
        break;
      case "bic":
        if (!isValidBic(strValue)) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be a valid BIC/SWIFT code (ISO 9362: 8 or 11 chars)`,
            severity: "error",
          });
        }
        break;
      case "currency":
        if (!isValidCurrencyCode(strValue)) {
          errors.push({
            blockId: "",
            blockType: "",
            field: fieldName,
            message: `Property "${fieldName}" must be a valid ISO 4217 currency code (e.g. USD, EUR, QAR)`,
            severity: "error",
          });
        }
        break;
    }
  }

  return errors;
}

/**
 * IBAN validation (ISO 13616): strip spaces, check the country/length shape, then
 * run the mod-97 checksum (move the first 4 chars to the end, map letters A→10…Z→35,
 * the remainder mod 97 must be 1). This catches transposed digits and typos that a
 * plain length/format regex would pass.
 */
export function isValidIban(raw: string): boolean {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  // 2 country letters + 2 check digits + up to 30 alphanumeric (max total 34).
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(s)) return false;
  if (s.length < 5 || s.length > 34) return false;
  // Rearrange: move the first four characters to the end.
  const rearranged = s.slice(4) + s.slice(0, 4);
  // Map each letter to two digits (A=10 … Z=35), digits stay as-is.
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch >= "A" && ch <= "Z" ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const d of code) {
      remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}

/**
 * BIC/SWIFT validation (ISO 9362): 4-letter bank code, 2-letter ISO 3166 country,
 * 2-char (letters or digits) location, and an OPTIONAL 3-char branch — so 8 or 11
 * characters total. Location/branch may not start with certain reserved chars in
 * practice, but the structural check is what callers need here.
 */
export function isValidBic(raw: string): boolean {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s);
}

/**
 * ISO 4217 active currency codes. This is the set of currencies in active use
 * (fund codes and precious metals like XAU/XAG included, since contracts reference
 * them). A 3-uppercase-letter string NOT in this set is almost certainly a typo.
 */
const ISO_4217_CODES = new Set<string>([
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BOV",
  "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHE", "CHF",
  "CHW", "CLF", "CLP", "CNY", "COP", "COU", "CRC", "CUC", "CUP", "CVE",
  "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD",
  "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD",
  "HNL", "HRK", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR", "ISK",
  "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW", "KWD",
  "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL",
  "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN",
  "MXV", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR",
  "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD",
  "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE",
  "SOS", "SRD", "SSP", "STN", "SVC", "SYP", "SZL", "THB", "TJS", "TMT",
  "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "USN",
  "UYI", "UYU", "UYW", "UZS", "VED", "VES", "VND", "VUV", "WST", "XAF",
  "XAG", "XAU", "XCD", "XDR", "XOF", "XPD", "XPF", "XPT", "XSU", "XUA",
  "YER", "ZAR", "ZMW", "ZWL",
]);

/** ISO 4217 currency code — 3 uppercase letters from the active list. */
export function isValidCurrencyCode(raw: string): boolean {
  return ISO_4217_CODES.has(raw.trim().toUpperCase());
}

function validateBlock(
  block: IntentBlock,
  schema: BlockSchema,
  documentSchema: DocumentSchema,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate content if schema defined
  if (schema.content) {
    if (schema.content.required && (!block.content || block.content === "")) {
      errors.push({
        blockId: block.id,
        blockType: block.type,
        field: "content",
        message: `Block "${block.type}" requires content`,
        severity: "error",
      });
    }
    if (block.content) {
      if (
        schema.content.minLength !== undefined &&
        block.content.length < schema.content.minLength
      ) {
        errors.push({
          blockId: block.id,
          blockType: block.type,
          field: "content",
          message: `Content must be at least ${schema.content.minLength} characters`,
          severity: "error",
        });
      }
      if (
        schema.content.maxLength !== undefined &&
        block.content.length > schema.content.maxLength
      ) {
        errors.push({
          blockId: block.id,
          blockType: block.type,
          field: "content",
          message: `Content must be at most ${schema.content.maxLength} characters`,
          severity: "error",
        });
      }
      if (schema.content.pattern) {
        const regex = new RegExp(schema.content.pattern);
        if (!regex.test(block.content)) {
          errors.push({
            blockId: block.id,
            blockType: block.type,
            field: "content",
            message: `Content does not match required pattern`,
            severity: "error",
          });
        }
      }
    }
  }

  // Validate properties
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const value = block.properties?.[propName];
      const propErrors = validateProperty(value, propSchema, propName);
      errors.push(
        ...propErrors.map((e) => ({
          ...e,
          blockId: block.id,
          blockType: block.type,
        })),
      );
    }

    // Check for unknown properties
    if (schema.allowUnknownProperties === false && block.properties) {
      const knownProps = Object.keys(schema.properties);
      for (const propName of Object.keys(block.properties)) {
        if (!knownProps.includes(propName)) {
          errors.push({
            blockId: block.id,
            blockType: block.type,
            field: propName,
            message: `Unknown property "${propName}" for block type "${block.type}"`,
            severity: "warning",
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate an IntentDocument against a schema
 */
export function validateDocument(
  document: IntentDocument,
  schema: DocumentSchema | string,
): ValidationResult {
  if (!document || !document.blocks) {
    return {
      valid: false,
      errors: [
        {
          blockId: "",
          blockType: "",
          field: "document",
          message: "Invalid document",
          severity: "error",
        },
      ],
      warnings: [],
    };
  }
  // If string provided, look up predefined schema
  const docSchema =
    typeof schema === "string" ? PREDEFINED_SCHEMAS[schema] : schema;

  if (!docSchema) {
    return {
      valid: false,
      errors: [
        {
          blockId: "",
          blockType: "",
          field: "schema",
          message: `Unknown schema "${schema}"`,
          severity: "error",
        },
      ],
      warnings: [],
    };
  }

  const allBlocks = flattenBlocks(document.blocks);
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check required blocks
  if (docSchema.requiredBlocks) {
    const presentTypes = new Set(allBlocks.map((b) => b.type));
    for (const required of docSchema.requiredBlocks) {
      if (!presentTypes.has(required)) {
        errors.push({
          blockId: "",
          blockType: "",
          field: "blocks",
          message: `Document requires at least one "${required}" block`,
          severity: "error",
        });
      }
    }
  }

  // Check unknown blocks
  if (docSchema.allowUnknownBlocks === false) {
    const allowedTypes = new Set(Object.keys(docSchema.blockSchemas || {}));
    // Always allow structural blocks
    allowedTypes.add("title");
    allowedTypes.add("summary");
    allowedTypes.add("section");
    allowedTypes.add("sub");
    allowedTypes.add("divider");

    for (const block of allBlocks) {
      if (!allowedTypes.has(block.type)) {
        errors.push({
          blockId: block.id,
          blockType: block.type,
          field: "type",
          message: `Block type "${block.type}" is not allowed in "${docSchema.name}" documents`,
          severity: "error",
        });
      }
    }
  }

  // Validate blocks against their schemas
  if (docSchema.blockSchemas) {
    for (const block of allBlocks) {
      const blockSchema = docSchema.blockSchemas[block.type];
      if (blockSchema) {
        const blockErrors = validateBlock(block, blockSchema, docSchema);
        for (const e of blockErrors) {
          if (e.severity === "error") errors.push(e);
          else warnings.push(e);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create a custom schema
 */
export function createSchema(
  config: Omit<DocumentSchema, "name"> & { name: string },
): DocumentSchema {
  return {
    allowUnknownBlocks: true,
    ...config,
  };
}

/**
 * Format validation results for CLI output
 */
export function formatValidationResult(result: ValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return "✓ Document is valid";
  }

  const lines: string[] = [];

  if (!result.valid) {
    lines.push(`✗ Validation failed with ${result.errors.length} error(s):`);
    for (const e of result.errors) {
      lines.push(
        `  [${e.severity.toUpperCase()}] ${e.blockType || "document"}: ${e.message}`,
      );
    }
  }

  if (result.warnings.length > 0) {
    lines.push(`⚠ ${result.warnings.length} warning(s):`);
    for (const w of result.warnings) {
      lines.push(`  [WARN] ${w.blockType}: ${w.message}`);
    }
  }

  if (result.valid && result.warnings.length === 0) {
    lines.push("✓ Document is valid");
  }

  return lines.join("\n");
}
