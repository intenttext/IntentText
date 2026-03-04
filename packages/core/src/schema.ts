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
  format?: "iso-date" | "iso-datetime" | "time" | "url" | "email";
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
        type: "note",
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
          at: { type: "url", required: true },
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
          },
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
      status: {
        type: "status",
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
        const regex = new RegExp(schema.pattern);
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
    }
  }

  return errors;
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
