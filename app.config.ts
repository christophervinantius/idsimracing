export default defineAppConfig({
  ui: {
    modal: {
      slots: {
        content: 'sm:max-w-2xl lg:max-w-3xl'
      },
      variants: {
        fullscreen: {
          false: {
            content: 'sm:max-w-2xl lg:max-w-3xl'
          }
        }
      }
    }
  }
})
