import { describe, it, expect } from "vitest";
import {
  parseQuery,
  queryBlocks,
  formatQueryResult,
  QueryOptions,
} from "../src/query";
import { IntentDocument } from "../src/types";

describe("Query Language (v1.2)", () => {
  const sampleDoc: IntentDocument = {
    blocks: [
      {
        id: "1",
        type: "title",
        content: "Project Plan",
        properties: {},
      },
      {
        id: "2",
        type: "task",
        content: "Database migration",
        properties: { owner: "Ahmed", due: "2026-03-01", priority: "high" },
      },
      {
        id: "3",
        type: "task",
        content: "Update README",
        properties: { owner: "Sarah", due: "2026-02-28", priority: "medium" },
      },
      {
        id: "4",
        type: "task",
        content: "Setup CI",
        properties: { owner: "Ahmed", due: "2026-03-05" },
      },
      {
        id: "5",
        type: "task",
        content: "Initial commit",
        properties: { time: "2026-02-20", status: "done" },
      },
      {
        id: "6",
        type: "section",
        content: "Backend Tasks",
        properties: {},
        children: [
          {
            id: "7",
            type: "task",
            content: "API design",
            properties: { owner: "Ahmed", priority: "high" },
          },
        ],
      },
    ],
    metadata: { title: "Project Plan", language: "ltr" },
  };

  describe("parseQuery", () => {
    it("should parse simple equality clause", () => {
      const result = parseQuery("type=task");
      expect(result.where).toHaveLength(1);
      expect(result.where![0]).toEqual({
        field: "type",
        operator: "=",
        value: "task",
      });
    });

    it("should parse multiple clauses", () => {
      const result = parseQuery("type=task owner=Ahmed");
      expect(result.where).toHaveLength(2);
      expect(result.where![0]).toEqual({
        field: "type",
        operator: "=",
        value: "task",
      });
      expect(result.where![1]).toEqual({
        field: "owner",
        operator: "=",
        value: "Ahmed",
      });
    });

    it("should parse comparison operators", () => {
      const result = parseQuery("due<2026-03-01 priority>=5");
      expect(result.where).toHaveLength(2);
      expect(result.where![0]).toEqual({
        field: "due",
        operator: "<",
        value: "2026-03-01",
      });
      expect(result.where![1]).toEqual({
        field: "priority",
        operator: ">=",
        value: 5,
      });
    });

    it("should parse string operators", () => {
      const result = parseQuery("content:contains=design owner:startsWith=A");
      expect(result.where).toHaveLength(2);
      expect(result.where![0]).toEqual({
        field: "content",
        operator: "contains",
        value: "design",
      });
    });

    it("should parse exists operator", () => {
      const result = parseQuery("priority?");
      expect(result.where).toHaveLength(1);
      expect(result.where![0]).toEqual({
        field: "priority",
        operator: "exists",
      });
    });

    it("should parse sort", () => {
      const result = parseQuery("type=task sort:due:asc");
      expect(result.where).toHaveLength(1);
      expect(result.sort).toHaveLength(1);
      expect(result.sort![0]).toEqual({ field: "due", direction: "asc" });
    });

    it("should parse limit", () => {
      const result = parseQuery("type=task limit:10");
      expect(result.limit).toBe(10);
    });

    it("should parse offset", () => {
      const result = parseQuery("type=task offset:5 limit:10");
      expect(result.offset).toBe(5);
      expect(result.limit).toBe(10);
    });
  });

  describe("queryBlocks", () => {
    it("should filter by type", () => {
      const result = queryBlocks(sampleDoc, "type=task");
      expect(result.matched).toBe(5); // 4 top-level (including former done) + 1 nested
      expect(result.blocks.every((b) => b.type === "task")).toBe(true);
    });

    it("should filter by property", () => {
      const result = queryBlocks(sampleDoc, "owner=Ahmed");
      expect(result.matched).toBe(3); // Ahmed's tasks
    });

    it("should filter by multiple criteria (AND logic)", () => {
      const result = queryBlocks(sampleDoc, "type=task owner=Sarah");
      expect(result.matched).toBe(1);
      expect(result.blocks[0].content).toBe("Update README");
    });

    it("should handle date comparisons", () => {
      const result = queryBlocks(sampleDoc, "due<2026-03-01");
      expect(result.matched).toBe(1);
      expect(result.blocks[0].content).toBe("Update README");
    });

    it("should handle contains operator", () => {
      const result = queryBlocks(sampleDoc, "content:contains=API");
      expect(result.matched).toBe(1);
      expect(result.blocks[0].content).toBe("API design");
    });

    it("should handle exists operator", () => {
      const result = queryBlocks(sampleDoc, "type=task priority?");
      expect(result.matched).toBe(3); // 3 tasks have priority (Database, README, API design - Setup CI doesn't)
    });

    it("should sort results", () => {
      const result = queryBlocks(sampleDoc, "type=task sort:due:asc");
      expect(result.blocks[0].content).toBe("Update README"); // Earliest due date
    });

    it("should apply limit", () => {
      const result = queryBlocks(sampleDoc, "type=task limit:2");
      expect(result.blocks.length).toBe(2);
      expect(result.matched).toBe(5); // Total matched is 5 (former done is now task)
    });

    it("should apply offset", () => {
      const result = queryBlocks(sampleDoc, "type=task offset:1 limit:1");
      expect(result.blocks.length).toBe(1);
    });

    it("should search across flattened blocks (including children)", () => {
      const result = queryBlocks(sampleDoc, "content:contains=API");
      expect(result.matched).toBe(1);
      expect(result.blocks[0].id).toBe("7"); // The nested task
    });
  });

  describe("formatQueryResult", () => {
    it("should format as JSON", () => {
      const result = queryBlocks(sampleDoc, "type=task limit:2");
      const formatted = formatQueryResult(result, "json");
      expect(JSON.parse(formatted)).toBeTruthy();
    });

    it("should format as simple text", () => {
      const result = queryBlocks(sampleDoc, "type=task limit:1");
      const formatted = formatQueryResult(result, "simple");
      expect(formatted).toContain("[task]");
      expect(formatted).toContain("Database migration");
    });

    it("should format as table", () => {
      const result = queryBlocks(sampleDoc, "type=task limit:1");
      const formatted = formatQueryResult(result, "table");
      expect(formatted).toContain("ID");
      expect(formatted).toContain("Type");
      expect(formatted).toContain("Content");
    });
  });
});
