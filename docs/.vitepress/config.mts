import { defineConfig } from 'vitepress';

const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareSourceCode',
      'name': 'KeysetEngine Drizzle',
      'description': 'High-performance, database-agnostic keyset pagination and universal search library for Drizzle ORM on Node.js and Bun.',
      'programmingLanguage': 'TypeScript',
      'runtimePlatform': ['Node.js 18+', 'Bun 1.0+'],
      'codeRepository': 'https://github.com/aebibtech/keysetengine-drizzle',
      'license': 'https://opensource.org/licenses/MIT',
      'author': {
        '@type': 'Person',
        'name': 'Paul Camano',
        'url': 'https://github.com/aebibtech'
      }
    },
    {
      '@type': 'WebSite',
      'name': 'KeysetEngine Drizzle Documentation',
      'url': 'https://drizzle.keysetengine.aebibtech.com',
      'description': 'Complete guides, architectural specifications, and API documentation for KeysetEngine Drizzle ORM pagination library.'
    }
  ]
});

export default defineConfig({
  title: 'KeysetEngine Drizzle',
  description: 'High-performance, database-agnostic keyset pagination and search engine for Drizzle ORM on Node.js and Bun',
  base: '/',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,

  sitemap: {
    hostname: 'https://drizzle.keysetengine.aebibtech.com'
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'canonical', href: 'https://drizzle.keysetengine.aebibtech.com' }],
    ['meta', { name: 'theme-color', content: '#2563eb' }],
    ['meta', { name: 'author', content: 'Paul Camano — StewardAxis LLC' }],
    ['meta', { name: 'keywords', content: 'Drizzle ORM, Keyset Pagination, Cursor Pagination, Node.js, Bun, TypeScript, PostgreSQL, SQLite, MySQL, High Performance' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'KeysetEngine Drizzle' }],
    ['meta', { property: 'og:title', content: 'KeysetEngine Drizzle — Keyset Pagination & Search' }],
    ['meta', { property: 'og:description', content: 'High-Performance Keyset Pagination & Search for Drizzle ORM on Node.js & Bun. Avoid SQL OFFSET degradation with O(1) indexed seeks.' }],
    ['meta', { property: 'og:url', content: 'https://drizzle.keysetengine.aebibtech.com' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'KeysetEngine Drizzle — Keyset Pagination & Search' }],
    ['meta', { name: 'twitter:description', content: 'High-Performance Keyset Pagination & Search for Drizzle ORM on Node.js & Bun.' }],
    ['script', { type: 'application/ld+json' }, jsonLd]
  ],

  themeConfig: {
    siteTitle: 'KeysetEngine Drizzle',
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'FAQ', link: '/guide/faq' },
      { text: 'Databases', link: '/databases/postgresql' },
      { text: 'Security', link: '/security/cryptographic-protection' },
      { text: 'API Reference', link: '/api/core' },
      { text: 'llms.txt', link: '/llms.txt', target: '_blank' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview & Installation', link: '/guide/getting-started' },
          { text: 'Why Keyset Pagination?', link: '/guide/why-keyset' },
          { text: 'Frequently Asked Questions', link: '/guide/faq' }
        ]
      },
      {
        text: 'Core Architecture',
        items: [
          { text: 'Pipeline & Expressions', link: '/guide/architecture' },
          { text: 'Bidirectional Traversal', link: '/guide/bidirectional' },
          { text: 'Dynamic Search & Stale Cursors', link: '/guide/search' },
          { text: 'Index Design & Optimization', link: '/guide/indexing' }
        ]
      },
      {
        text: 'Security & Tokens',
        items: [
          { text: 'Cryptographic Protection', link: '/security/cryptographic-protection' }
        ]
      },
      {
        text: 'Database Adapters',
        items: [
          { text: 'PostgreSQL Strategy', link: '/databases/postgresql' },
          { text: 'SQLite & In-Memory', link: '/databases/sqlite' },
          { text: 'MySQL Strategy', link: '/databases/mysql' }
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Core API', link: '/api/core' },
          { text: 'Security API', link: '/api/security' },
          { text: 'Search Strategies API', link: '/api/search-strategies' }
        ]
      }
    ],

    search: {
      provider: 'local'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/aebibtech/keysetengine-drizzle' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Paul Camano — StewardAxis LLC'
    }
  }
});
