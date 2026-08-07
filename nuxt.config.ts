// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
      passAdm: process.env.PASS_ADM,
      passCrud: process.env.PASS_CRUD,
    }
  },

  modules: ['@nuxt/icon', '@nuxtjs/i18n', '@nuxt/image', '@nuxt/ui'],

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
  }
})