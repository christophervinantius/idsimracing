<script setup>
    const { t, locale } = useI18n()

    const { $supabase } = useNuxtApp()

    const { data: rentals } = await useAsyncData("rentals", async () => {
        const { data, error } = await $supabase
            .from("rentals")
            .select(`
                id,
                name,
                location,
                instagram,
                province,
                regency
            `)
            .order("name", { ascending: true })
        if(error) throw error
        return data
    })

    const pageTitle = computed(() =>
        locale.value === "en"
            ? "Indonesian Racing Simulator Rental Centers | ID Sim Racing"
            : "Daftar Rental Simulator Balap Indonesia | ID Sim Racing"
    )

    const pageDescription = computed(() =>
        locale.value === "en"
            ? "Directory of sim racing simulator rental spots and lounges across Indonesia (Jakarta, Tangerang, Bandung, Surabaya, etc.) with rig specs, pricing, and locations."
            : "Temukan tempat rental simulator balap (sim racing) terdekat di Indonesia (Jakarta, Tangerang, Bandung, Surabaya, dll) lengkap dengan spesifikasi rig, harga, dan lokasi."
    )

    useHead({
        htmlAttrs: {
            lang: () => (locale.value === "en" ? "en" : "id")
        },
        link: [
            { rel: "canonical", href: "https://idsimracing.pages.dev/rentals" }
        ],
        script: [
            {
                type: "application/ld+json",
                children: () => JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    "name": "Daftar Tempat Rental Sim Racing Indonesia",
                    "description": "Tempat rental simulator balap (sim racing) di Indonesia",
                    "itemListElement": (rentals.value || []).map((r, idx) => ({
                        "@type": "ListItem",
                        "position": idx + 1,
                        "name": r.name,
                        "description": r.province ? `${r.name} - ${r.province}` : r.name
                    }))
                })
            }
        ]
    })

    useSeoMeta({
        title: pageTitle,
        ogTitle: pageTitle,
        twitterTitle: pageTitle,
        description: pageDescription,
        ogDescription: pageDescription,
        twitterDescription: pageDescription,
        ogImage: "https://idsimracing.pages.dev/images/1.png",
        twitterImage: "https://idsimracing.pages.dev/images/1.png",
        ogUrl: "https://idsimracing.pages.dev/rentals",
        twitterCard: "summary_large_image",
    })

    const selectedProvinces = ref([])

    const provincesList = computed(() => {
        if(!rentals.value) return []
        const provinces = rentals.value.map(rental => rental.province)
        selectedProvinces.value = [...new Set(provinces)]
        return [...new Set(provinces)].sort()
    })

    const orderedSelectedProvinces = computed({
        get(){
            return provincesList.value.filter(province => selectedProvinces.value.includes(province))
        },
        set(newValue){
            selectedProvinces.value = newValue
        }
    })

    const searchQuery = ref("")

    const filteredRentals = computed(() => {
        if(!rentals.value) return []
        return rentals.value.filter(rental => 
            rental.name.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
            selectedProvinces.value.includes(rental.province)
        )
    })

    const clearFilterField = (filterType) => {
        if(filterType === "province"){
            selectedProvinces.value = []
        }
    }

    const resetFilter = () => {
        searchQuery.value = ""
        selectedProvinces.value = [...provincesList.value]
    }

    const showTopButton = ref(false)

    const handleScrollTop = () => {
        showTopButton.value = window.scrollY > 100
    }

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        })
    }

    onMounted(() => {
        window.addEventListener("scroll", handleScrollTop)
    })

    onUnmounted(() => {
        window.removeEventListener("scroll", handleScrollTop)
    })
</script>

<template>
    <div class="bg-white dark:bg-slate-900 px-8 lg:px-32 py-8 flex flex-col gap-6">
        <div class="text-black dark:text-white text-center text-lg lg:text-2xl font-bold leading-6">
            {{ $t('rentalsTitle') }}
        </div>
        <div class="mx-auto flex flex-col justify-center items-center gap-4">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('province') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="orderedSelectedProvinces"
                            :items="provincesList"
                            multiple
                        />
                        <button
                            @click="clearFilterField('province')" 
                            :disabled="selectedProvinces.length === 0"
                            class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                            <Icon name="mdi:filter-off" mode="svg" />
                        </button>
                    </div>
                </div>
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('name') }}</label>
                    <div class="flex items-center gap-2">
                        <input
                            v-model="searchQuery"
                            type="text"
                            :placeholder="$t('searchName')"
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                        />
                    </div>
                </div>
            </div>
            <div
                v-if="searchQuery || selectedProvinces.length !== provincesList.length"
                class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold px-4 py-2 rounded-lg cursor-pointer" @click="resetFilter">
                {{ $t('resetFilter') }}
            </div>
        </div>
    </div>
    <div>
        <div v-if="filteredRentals.length" class="bg-white dark:bg-slate-900 px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-black dark:text-white text-center text-base lg:text-lg">
                <div>{{ $t('totalRentals', {total: filteredRentals.length}) }}</div>
            </div>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                <div v-for="rental in filteredRentals" :id="rental.id">
                    <CardRental
                        :name="rental.name"
                        :location="rental.location"
                        :instagram="rental.instagram"
                        :province="rental.province"
                        :regency="rental.regency"
                    />
                </div>
            </div>
        </div>
        <div v-else class="text-center text-white text-base lg:text-lg leading-6">
            {{ $t('noRentalsFound') }}
        </div>
        <button v-if="showTopButton" @click="scrollToTop" class="fixed bottom-12 right-8 bg-red-900 dark:bg-red-900 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
            <Icon name="mi:arrow-up" size="2.5em"  mode="svg" />
        </button>
    </div>
</template>