import type * as Monaco from "monaco-editor";

export function registerLanguage(monaco: typeof Monaco) {
  monaco.languages.register({ id: "intenttext", extensions: [".it"] });

  monaco.languages.setMonarchTokensProvider("intenttext", {
    tokenizer: {
      root: [
        // Comments
        [/^\/\/.*$/, "comment"],

        // Boundary ---
        [/^---\s*$/, "boundary"],

        // Template variables
        [/\{\{[^}]*\}\}/, "template.variable"],

        // Trust keywords at start of line
        [
          /^(track|approve|sign|freeze|revision|policy|amendment):/,
          "keyword.trust",
        ],

        // Identity keywords
        [/^(title|summary|meta|context):/, "keyword.identity"],

        // Structure keywords
        [
          /^(section|sub|break|group|ref|deadline|divider):/,
          "keyword.structure",
        ],

        // Content keywords (text: is the canonical implicit-text keyword since v3.3)
        [
          /^(text|note|quote|warning|tip|info|success|code|image|link|cite|def|figure|contact|toc|caption|footnote|dedication|epigraph|byline):/,
          "keyword.content",
        ],

        // Data keywords
        [/^(input|output|table|metric|headers|row):/, "keyword.data"],

        // Agent keywords
        [
          /^(step|gate|trigger|emit|decision|memory|prompt|tool|audit|done|error|task|ask|result|handoff|wait|parallel|retry|call|loop|checkpoint|import|export|progress):/,
          "keyword.agent",
        ],

        // Layout keywords
        [
          /^(page|font|header|footer|watermark|signline|end):/,
          "keyword.layout",
        ],

        // Pipe delimiter
        [/\|/, "delimiter.pipe"],

        // Property key after pipe (word before colon)
        [/(?<=\|\s*)\w[\w-]*(?=\s*:)/, "property.key"],
      ],
    },
  });

  // Folding: sections fold to the next section/sub/title
  monaco.languages.registerFoldingRangeProvider("intenttext", {
    provideFoldingRanges(model) {
      const ranges: Monaco.languages.FoldingRange[] = [];
      const lines = model.getLineCount();
      const sectionStarts: number[] = [];

      for (let i = 1; i <= lines; i++) {
        const line = model.getLineContent(i);
        if (/^(section|sub|title):/.test(line)) {
          sectionStarts.push(i);
        }
      }

      for (let i = 0; i < sectionStarts.length; i++) {
        const start = sectionStarts[i];
        const end = (sectionStarts[i + 1] ?? lines + 1) - 1;
        if (end > start) {
          ranges.push({
            start,
            end,
            kind: monaco.languages.FoldingRangeKind.Region,
          });
        }
      }

      return ranges;
    },
  });
}
