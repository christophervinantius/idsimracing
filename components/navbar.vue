<script setup>
    const mode = ref("light")

    const toggleMode = () => {
        const html = document.documentElement
        mode.value = mode.value === "light" ? "dark" : "light"
        html.classList.toggle("dark")
    }

    const { locale } = useI18n();
</script>

<template>
    <div class="sticky top-0 z-50">
        <nav class="flex items-center justify-between bg-red-700 dark:bg-red-900 px-4 lg:px-16 py-4 text-white">
            <NuxtLink to="/" class="text-lg lg:text-3xl font-bold">Indonesia Sim Racing</NuxtLink>
            <ul class="flex gap-4 lg:gap-16 text-sm lg:text-lg items-center">
                <Icon v-if="mode === 'dark'" @click="toggleMode" class="cursor-pointer" name="material-symbols:dark-mode-rounded" size="1.5em" /> 
                <Icon v-if="mode === 'light'" @click="toggleMode" class="cursor-pointer" name="material-symbols:light-mode-rounded" size="1.5em" />
                <NuxtLink :to="$switchLocalePath(locale === 'id' ? 'en' : 'id')">
                    {{ locale === 'id' ? 'ID' : 'EN' }}
                </NuxtLink>
            </ul>
        </nav>
    </div>
</template>