import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Ground Truth',
  tagline: 'Commodity Forecasting System - Technical Documentation',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://gibbons-tony.github.io',
  baseUrl: '/groundtruth-docs/',

  organizationName: 'gibbons-tony',
  projectName: 'groundtruth-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/gibbonstony/ucberkeley-capstone/tree/main/',
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/caramanta-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Ground Truth',
      logo: {
        alt: 'Caramanta Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          to: '/docs/overview',
          label: 'Overview',
          position: 'left',
        },
        {
          to: '/docs/research-agent/introduction',
          label: 'Research Agent',
          position: 'left',
        },
        {
          to: '/docs/forecast-agent/introduction',
          label: 'Forecast Agent',
          position: 'left',
        },
        {
          to: '/docs/trading-agent/introduction',
          label: 'Trading Agent',
          position: 'left',
        },
        {
          href: 'https://studiomios.wixstudio.com/caramanta',
          label: 'Live System',
          position: 'right',
        },
        {
          href: 'https://github.com/gibbonstony/ucberkeley-capstone',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Agents',
          items: [
            {
              label: 'Research Agent',
              to: '/docs/research-agent/introduction',
            },
            {
              label: 'Forecast Agent',
              to: '/docs/forecast-agent/introduction',
            },
            {
              label: 'Trading Agent',
              to: '/docs/trading-agent/introduction',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'GitHub Repository',
              href: 'https://github.com/gibbonstony/ucberkeley-capstone',
            },
            {
              label: 'Live System',
              href: 'https://studiomios.wixstudio.com/caramanta',
            },
          ],
        },
        {
          title: 'UC Berkeley MIDS',
          items: [
            {
              label: 'School of Information',
              href: 'https://www.ischool.berkeley.edu/',
            },
            {
              label: 'MIDS Program',
              href: 'https://www.ischool.berkeley.edu/programs/mids',
            },
          ],
        },
      ],
      copyright: `UC Berkeley Master of Information and Data Science (MIDS) Capstone Project 2024<br/>Built with Docusaurus`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['python', 'sql', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
