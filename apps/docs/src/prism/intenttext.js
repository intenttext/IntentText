// Custom Prism grammar for IntentText (.it) syntax highlighting
(function (Prism) {
  Prism.languages.intenttext = {
    // Comments
    comment: /^\/\/.*$/m,

    // Trust keywords — gold
    "trust-keyword": {
      pattern:
        /^(track|approve|sign|freeze|revision|policy|amendment|history)(?=:)/m,
      alias: "keyword",
    },

    // Document identity — blue
    "identity-keyword": {
      pattern: /^(title|summary|meta|context)(?=:)/m,
      alias: "function",
    },

    // Structure — green
    "structure-keyword": {
      pattern: /^(section|sub|break|group|ref|deadline)(?=:)/m,
      alias: "class-name",
    },

    // Content — teal
    "content-keyword": {
      pattern:
        /^(note|quote|warning|tip|code|image|link|cite|def|figure|contact)(?=:)/m,
      alias: "string",
    },

    // Data — purple
    "data-keyword": {
      pattern: /^(input|output|table|metric)(?=:)/m,
      alias: "builtin",
    },

    // Agent — orange
    "agent-keyword": {
      pattern:
        /^(step|gate|trigger|emit|decision|memory|prompt|tool|audit|done|error)(?=:)/m,
      alias: "regex",
    },

    // Layout — gray
    "layout-keyword": {
      pattern: /^(page|font|header|footer|watermark|signline|divider)(?=:)/m,
      alias: "operator",
    },

    // Template variables
    variable: {
      pattern: /\{\{[^}]+\}\}/,
      alias: "interpolation",
    },

    // Pipe separator
    pipe: {
      pattern: /\|/,
      alias: "punctuation",
    },

    // Property keys before colon
    property: {
      pattern: /\b[\w][\w-]*(?=:)/,
      alias: "attr-name",
    },

    // History boundary
    boundary: {
      pattern: /^---$/m,
      alias: "comment",
    },
  };

  // Register aliases
  Prism.languages.it = Prism.languages.intenttext;
})(Prism);
