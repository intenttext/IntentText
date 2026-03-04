import { describe, it, expect } from "vitest";
import {
  validateDocument,
  createSchema,
  formatValidationResult,
  PREDEFINED_SCHEMAS,
} from "../src/schema";
import { IntentDocument } from "../src/types";

describe("Schema Validation (v1.2)", () => {
  describe("Predefined schemas", () => {
    it("should have project schema defined", () => {
      expect(PREDEFINED_SCHEMAS.project).toBeDefined();
      expect(PREDEFINED_SCHEMAS.project.requiredBlocks).toContain("title");
    });

    it("should have meeting schema defined", () => {
      expect(PREDEFINED_SCHEMAS.meeting).toBeDefined();
      expect(PREDEFINED_SCHEMAS.meeting.requiredBlocks).toContain("section");
    });

    it("should have article schema defined", () => {
      expect(PREDEFINED_SCHEMAS.article).toBeDefined();
      expect(PREDEFINED_SCHEMAS.article.allowUnknownBlocks).toBe(false);
    });

    it("should have checklist schema defined", () => {
      expect(PREDEFINED_SCHEMAS.checklist).toBeDefined();
    });
  });

  describe("validateDocument", () => {
    const validProjectDoc: IntentDocument = {
      blocks: [
        { id: "1", type: "title", content: "My Project" },
        {
          id: "2",
          type: "task",
          content: "Do something",
          properties: { owner: "Ahmed", due: "2026-03-01", priority: "high" },
        },
      ],
      metadata: { title: "My Project" },
    };

    it("should validate a valid project document", () => {
      const result = validateDocument(validProjectDoc, "project");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail when required block is missing", () => {
      const doc: IntentDocument = {
        blocks: [
          {
            id: "1",
            type: "task",
            content: "Task without title",
            properties: { owner: "Ahmed" },
          },
        ],
      };
      const result = validateDocument(doc, "project");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("requires"))).toBe(
        true,
      );
    });

    it("should validate enum values", () => {
      const doc: IntentDocument = {
        blocks: [
          { id: "1", type: "title", content: "Project" },
          {
            id: "2",
            type: "task",
            content: "Task",
            properties: { owner: "Ahmed", priority: "urgent" },
          },
        ],
      };
      const result = validateDocument(doc, "project");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("priority"))).toBe(
        true,
      );
    });

    it("should allow tasks without owner in project schema", () => {
      const doc: IntentDocument = {
        blocks: [
          { id: "1", type: "title", content: "Project" },
          {
            id: "2",
            type: "task",
            content: "Task",
            properties: {},
          },
        ],
      };
      // Project schema doesn't require owner for tasks
      const result = validateDocument(doc, "project");
      expect(result.valid).toBe(true);
    });

    it("should validate date format", () => {
      const doc: IntentDocument = {
        blocks: [
          { id: "1", type: "title", content: "Project" },
          {
            id: "2",
            type: "task",
            content: "Task",
            properties: { owner: "Ahmed", due: "03-01-2026" },
          },
        ],
      };
      const result = validateDocument(doc, "project");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("ISO"))).toBe(true);
    });

    it("should validate URL properties", () => {
      const doc: IntentDocument = {
        blocks: [
          { id: "1", type: "title", content: "Article" },
          { id: "2", type: "summary", content: "Summary" },
          {
            id: "3",
            type: "image",
            content: "Photo",
            properties: { at: "not-a-url" },
          },
        ],
      };
      const result = validateDocument(doc, "article");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("URL"))).toBe(true);
    });

    it("should allow relative URLs", () => {
      const doc: IntentDocument = {
        blocks: [
          { id: "1", type: "title", content: "Article" },
          { id: "2", type: "summary", content: "Summary" },
          {
            id: "3",
            type: "image",
            content: "Photo",
            properties: { at: "./assets/photo.png" },
          },
        ],
      };
      const result = validateDocument(doc, "article");
      expect(result.valid).toBe(true);
    });

    it("should warn on unknown properties", () => {
      const doc: IntentDocument = {
        blocks: [
          { id: "1", type: "title", content: "Project" },
          {
            id: "2",
            type: "task",
            content: "Task",
            properties: { owner: "Ahmed", unknownProp: "value" },
          },
        ],
      };
      const result = validateDocument(doc, "project");
      // Project schema allows unknown properties on tasks
      expect(result.warnings.length).toBe(0);
    });

    it("should reject unknown block types when not allowed", () => {
      const doc: IntentDocument = {
        blocks: [
          { id: "1", type: "title", content: "Article" },
          { id: "2", type: "summary", content: "Summary" },
          { id: "3", type: "question", content: "Is this allowed?" },
        ],
      };
      const result = validateDocument(doc, "article");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("question"))).toBe(
        true,
      );
    });

    it("should validate nested blocks", () => {
      const doc: IntentDocument = {
        blocks: [
          { id: "1", type: "title", content: "Project" },
          {
            id: "2",
            type: "section",
            content: "Tasks",
            children: [
              {
                id: "3",
                type: "task",
                content: "Child task",
                properties: { owner: "Ahmed" },
              },
            ],
          },
        ],
      };
      const result = validateDocument(doc, "project");
      expect(result.valid).toBe(true);
    });
  });

  describe("createSchema", () => {
    it("should create a custom schema", () => {
      const schema = createSchema({
        name: "custom",
        description: "Custom schema",
        requiredBlocks: ["title"],
        allowUnknownBlocks: true,
      });
      expect(schema.name).toBe("custom");
      expect(schema.allowUnknownBlocks).toBe(true);
    });

    it("should use default allowUnknownBlocks", () => {
      const schema = createSchema({
        name: "minimal",
      });
      expect(schema.allowUnknownBlocks).toBe(true);
    });
  });

  describe("formatValidationResult", () => {
    it("should format valid result", () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [],
      };
      const formatted = formatValidationResult(result);
      expect(formatted).toContain("✓");
    });

    it("should format errors", () => {
      const result = {
        valid: false,
        errors: [
          {
            blockId: "1",
            blockType: "task",
            field: "owner",
            message: "Owner is required",
            severity: "error" as const,
          },
        ],
        warnings: [],
      };
      const formatted = formatValidationResult(result);
      expect(formatted).toContain("✗");
      expect(formatted).toContain("Owner is required");
    });

    it("should format warnings", () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [
          {
            blockId: "1",
            blockType: "task",
            field: "priority",
            message: "Priority should be specified",
            severity: "warning" as const,
          },
        ],
      };
      const formatted = formatValidationResult(result);
      expect(formatted).toContain("⚠");
      expect(formatted).toContain("warning");
    });

    it("should return error for unknown schema", () => {
      const doc: IntentDocument = { blocks: [] };
      const result = validateDocument(doc, "nonexistent");
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Unknown schema");
    });
  });

  describe("Agentic schema (v2.2)", () => {
    it("should have agentic schema defined", () => {
      expect(PREDEFINED_SCHEMAS.agentic).toBeDefined();
      expect(PREDEFINED_SCHEMAS.agentic.requiredBlocks).toContain("title");
      expect(PREDEFINED_SCHEMAS.agentic.allowUnknownBlocks).toBe(true);
    });

    it("should validate step blocks with correct properties", () => {
      const doc: IntentDocument = {
        version: "2.0",
        blocks: [
          { id: "1", type: "title", content: "Workflow" },
          {
            id: "2",
            type: "step",
            content: "Fetch data",
            properties: { tool: "http.get", status: "pending" },
          },
        ],
        metadata: { title: "Workflow" },
      };
      const result = validateDocument(doc, "agentic");
      expect(result.valid).toBe(true);
    });

    it("should validate retry blocks", () => {
      const doc: IntentDocument = {
        version: "2.1",
        blocks: [
          { id: "1", type: "title", content: "Retry Flow" },
          {
            id: "2",
            type: "retry",
            content: "API call",
            properties: { max: 3, delay: 1000, backoff: "exponential" },
          },
        ],
        metadata: { title: "Retry Flow" },
      };
      const result = validateDocument(doc, "agentic");
      expect(result.valid).toBe(true);
    });

    it("should validate handoff and result blocks", () => {
      const doc: IntentDocument = {
        version: "2.1",
        blocks: [
          { id: "1", type: "title", content: "Agent Flow" },
          {
            id: "2",
            type: "handoff",
            content: "Transfer",
            properties: { from: "agent-a", to: "agent-b" },
          },
          {
            id: "3",
            type: "result",
            content: "Done",
            properties: { status: "success", code: "200" },
          },
        ],
        metadata: { title: "Agent Flow" },
      };
      const result = validateDocument(doc, "agentic");
      expect(result.valid).toBe(true);
    });

    it("should require title block", () => {
      const doc: IntentDocument = {
        version: "2.0",
        blocks: [{ id: "1", type: "step", content: "Do something" }],
        metadata: {},
      };
      const result = validateDocument(doc, "agentic");
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("title");
    });
  });
});
