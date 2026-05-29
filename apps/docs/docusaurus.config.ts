import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "IntentText",
  tagline: "The document language for humans and AI agents",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
  },

  url: "https://docs.intenttext.io",
  baseUrl: "/",
  organizationName: "intenttext",
  projectName: "intenttext-docs",

  onBrokenLinks: "throw",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/intenttext/intenttext-docs/edit/main/",
        },
        blog: {
          showReadingTime: true,
          blogTitle: "IntentText Blog",
          blogDescription: "Releases, thinking, and decisions",
          postsPerPage: 10,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  headTags: [
    {
      tagName: "link",
      attributes: {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/img/apple-touch-icon.png",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/img/favicon-32x32.png",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/img/favicon-16x16.png",
      },
    },
  ],

  themeConfig: {
    image: "img/android-chrome-512x512.png",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "IntentText",
      logo: {
        alt: "IntentText Logo",
        src: "img/android-chrome-192x192.png",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "guideSidebar",
          label: "Guide",
          position: "left",
        },
        {
          type: "docSidebar",
          sidebarId: "referenceSidebar",
          label: "Reference",
          position: "left",
        },
        {
          type: "docSidebar",
          sidebarId: "cookbookSidebar",
          label: "Cookbook",
          position: "left",
        },
        {
          type: "docSidebar",
          sidebarId: "ecosystemSidebar",
          label: "Ecosystem",
          position: "left",
        },
        { to: "/blog", label: "Blog", position: "left" },
        {
          href: "https://github.com/intenttext/IntentText",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Learn",
          items: [
            { label: "Quick Start", to: "/docs/guide/quick-start" },
            { label: "Concepts", to: "/docs/guide/concepts" },
            { label: "Cookbook", to: "/docs/cookbook" },
          ],
        },
        {
          title: "Reference",
          items: [
            { label: "All Keywords", to: "/docs/reference/keywords" },
            { label: "CLI", to: "/docs/reference/cli" },
            { label: "Core API", to: "/docs/ecosystem/core-api" },
          ],
        },
        {
          title: "Ecosystem",
          items: [
            { label: "Hub", href: "https://intenttext-hub.vercel.app" },
            { label: "Editor", href: "https://iteditor.vercel.app" },
            {
              label: "npm",
              href: "https://npmjs.com/package/@intenttext/core",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/intenttext/IntentText",
            },
            { label: "Twitter / X", href: "https://x.com/IntentText" },
            { label: "PyPI", href: "https://pypi.org/project/intenttext/" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} IntentText.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "typescript", "python"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
