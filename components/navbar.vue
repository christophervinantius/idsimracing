<script setup>
    const { locale, setLocale } = useI18n()

    const mode = ref(null)

    onMounted(() => {
        const savedMode = localStorage.getItem("mode")
        
        if(savedMode === "dark"){
            mode.value = "dark"
            document.documentElement.classList.add("dark")
        }else{
            mode.value = "light"
            document.documentElement.classList.remove("dark")
        }

        const savedLocale = localStorage.getItem("locale")

        if(savedLocale){
            setLocale(savedLocale)
        }else{
            setLocale("id")
        }
    })

    const toggleMode = () => {
        const html = document.documentElement
        mode.value = mode.value === "light" ? "dark" : "light"
        html.classList.toggle("dark")
        localStorage.setItem("mode", mode.value)
    }

    const toggleLocale = () => {
        const newLocale = locale.value === "id" ? "en" : "id"
        setLocale(newLocale)
        localStorage.setItem("locale", newLocale)
    }
</script>

<template>
    <div class="sticky top-0 z-50">
        <nav class="w-full flex items-center justify-between bg-red-700 dark:bg-red-900 px-4 lg:px-16 py-4 text-white">
            <ul class="w-4/5 flex gap-4 lg:gap-16 text-sm lg:text-lg items-center justify-start">
                <NuxtLink to="/" class="text-lg lg:text-3xl font-bold">ID Sim Racing</NuxtLink>
                <NuxtLink to="/database">
                    <Icon name="material-symbols:database-search-rounded" class="cursor-pointer" size="1.5em" mode="svg"/>
                </NuxtLink>
            </ul>
            <ul class="w-1/5 flex gap-4 lg:gap-16 text-sm lg:text-lg items-center justify-end">
                <Icon v-if="mode === 'dark'" @click="toggleMode" class="cursor-pointer" name="material-symbols:dark-mode-rounded" size="1.5em" mode="svg" /> 
                <Icon v-if="mode === 'light'" @click="toggleMode" class="cursor-pointer" name="material-symbols:light-mode-rounded" size="1.5em" mode="svg" />
                <div @click="toggleLocale" class="cursor-pointer">
                    {{  locale === 'id' ? 'ID' : 'EN' }}
                </div>
            </ul>
        </nav>
    </div>
</template>