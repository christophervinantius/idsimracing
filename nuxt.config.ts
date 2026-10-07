// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  app: {
    head: {
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'theme-color', content: '#7f1d1d' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  runtimeConfig: {
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    discordWebhookStreamUrl: process.env.DISCORD_WEBHOOK_STREAM_URL,
    discordWebhookResultsUrl: process.env.DISCORD_WEBHOOK_RESULTS_URL,
    discordWebhookScheduleUrl: process.env.DISCORD_WEBHOOK_SCHEDULE_URL,
    discordCronSecret: process.env.DISCORD_CRON_SECRET || process.env.PASS_ADM,
    siteUrl: process.env.SITE_URL || 'https://idsimracing.com',
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
      passAdm: process.env.PASS_ADM,
      passCrud: process.env.PASS_CRUD,
    }
  },

  modules: ['@nuxt/icon', '@nuxtjs/i18n', '@nuxt/image', '@nuxt/ui', '@vite-pwa/nuxt'],

  ui: {
    fonts: false
  },

  i18n: {
    detectBrowserLanguage: false,
    strategy: 'no_prefix',
    defaultLocale: 'id',
    langDir: 'locales/',
    locales: [
      { code: 'id', name: 'Bahasa Indonesia', file: 'id.json' },
      { code: 'en', name: 'English', file: 'en.json' }
    ]
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'ID Sim Racing',
      short_name: 'ID Sim Racing',
      description: 'Indonesian Sim Racing Community',
      theme_color: '#7f1d1d',
      background_color: '#09090b',
      display: 'standalone',
      orientation: 'portrait-primary',
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      maximumFileSizeToCacheInBytes: 6000000
    },
    client: {
      installPrompt: true
    }
  }
})