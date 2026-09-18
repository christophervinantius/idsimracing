<script setup>
    const { locale, setLocale } = useI18n()
    const route = useRoute()

    const mode = ref(null)
    const isMenuOpen = ref(false)

    watch(() => route.fullPath, () => {
        isMenuOpen.value = false
    })

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
    <div class="sticky top-0 z-50 bg-red-900 dark:bg-red-900">
        <nav class="relative z-10 w-full flex items-center justify-between bg-red-900 dark:bg-red-900 px-4 lg:px-16 py-4 text-white border-none outline-none">
            <div class="flex items-center gap-4 lg:gap-16">
                <div class="flex items-center">
                    <NuxtImg src="/images/IDSimRacing.png" alt="ID Sim Racing" class="h-8 lg:h-10 w-auto object-contain" />
                </div>
                <!-- Desktop Menu -->
                <ul class="hidden md:flex gap-6 lg:gap-12 text-sm lg:text-lg items-center font-bold">
                    <li>
                        <NuxtLink
                            to="/"
                            exact-active-class="underline underline-offset-4"
                            :class="{ 'underline underline-offset-4': route.path === '/' }"
                        >
                            {{ $t('calendar') }}
                        </NuxtLink>
                    </li>
                    <li>
                        <NuxtLink to="/standings" active-class="underline underline-offset-4">
                            {{ $t('standings') }}
                        </NuxtLink>
                    </li>
                    <li>
                        <NuxtLink to="/database" active-class="underline underline-offset-4">
                            {{ $t('database') }}
                        </NuxtLink>
                    </li>
                    <li>
                        <NuxtLink to="/rentals" active-class="underline underline-offset-4">
                            {{ $t('rentals') }}
                        </NuxtLink>
                    </li>
                </ul>
            </div>

            <!-- Controls (Theme, Locale, Mobile Hamburger) -->
            <div class="flex items-center gap-4 lg:gap-8 text-sm lg:text-lg">
                <!-- Desktop Theme & Locale Controls -->
                <div class="hidden md:flex items-center gap-4 lg:gap-8">
                    <Icon v-if="mode === 'dark'" @click="toggleMode" class="cursor-pointer" name="material-symbols:dark-mode-rounded" size="1.5em" mode="svg" /> 
                    <Icon v-if="mode === 'light'" @click="toggleMode" class="cursor-pointer" name="material-symbols:light-mode-rounded" size="1.5em" mode="svg" />
                    <div @click="toggleLocale" class="cursor-pointer font-bold select-none">
                        {{ locale === 'id' ? 'ID' : 'EN' }}
                    </div>
                </div>
                <!-- Mobile Hamburger Button -->
                <button
                    type="button"
                    class="md:hidden flex items-center justify-center p-1 rounded-md hover:bg-red-800 transition-colors cursor-pointer text-white focus:outline-none"
                    @click="isMenuOpen = !isMenuOpen"
                    :aria-label="isMenuOpen ? 'Close Menu' : 'Open Menu'"
                >
                    <Icon v-if="!isMenuOpen" name="material-symbols:menu-rounded" size="1.8em" mode="svg" />
                    <Icon v-else name="material-symbols:close-rounded" size="1.8em" mode="svg" />
                </button>
            </div>
        </nav>

        <!-- Mobile Menu Dropdown -->
        <transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-2"
        >
            <div
                v-if="isMenuOpen"
                class="md:hidden relative z-0 bg-red-900 dark:bg-red-900 -mt-1 px-4 pt-1 pb-3 shadow-xl text-white flex flex-col gap-2.5 border-none outline-none"
            >
                <ul class="flex flex-col gap-1 font-bold text-base">
                    <li>
                        <NuxtLink
                            to="/"
                            @click="isMenuOpen = false"
                            class="w-fit flex items-center py-1 hover:opacity-80 transition-opacity"
                            exact-active-class="underline underline-offset-4"
                            :class="{ 'underline underline-offset-4': route.path === '/' }"
                        >
                            {{ $t('calendar') }}
                        </NuxtLink>
                    </li>
                    <li>
                        <NuxtLink
                            to="/standings"
                            @click="isMenuOpen = false"
                            class="w-fit flex items-center py-1 hover:opacity-80 transition-opacity"
                            active-class="underline underline-offset-4"
                        >
                            {{ $t('standings') }}
                        </NuxtLink>
                    </li>
                    <li>
                        <NuxtLink
                            to="/database"
                            @click="isMenuOpen = false"
                            class="w-fit flex items-center py-1 hover:opacity-80 transition-opacity"
                            active-class="underline underline-offset-4"
                        >
                            {{ $t('database') }}
                        </NuxtLink>
                    </li>
                    <li>
                        <NuxtLink
                            to="/rentals"
                            @click="isMenuOpen = false"
                            class="w-fit flex items-center py-1 hover:opacity-80 transition-opacity"
                            active-class="underline underline-offset-4"
                        >
                            {{ $t('rentals') }}
                        </NuxtLink>
                    </li>
                </ul>

                <!-- Mobile Mode & Language Controls -->
                <div class="flex items-center gap-4 text-base pt-1">
                    <Icon v-if="mode === 'dark'" @click="toggleMode" class="cursor-pointer" name="material-symbols:dark-mode-rounded" size="1.5em" mode="svg" /> 
                    <Icon v-if="mode === 'light'" @click="toggleMode" class="cursor-pointer" name="material-symbols:light-mode-rounded" size="1.5em" mode="svg" />
                    <div @click="toggleLocale" class="cursor-pointer font-bold select-none">
                        {{ locale === 'id' ? 'ID' : 'EN' }}
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>