<script setup>
    useHead({
        htmlAttrs: {
            lang: "id"
        },
        title: "ID Sim Racing Database",
        meta: [
            {
                name: "description",
                content: "Database Sim Racer Indonesia"
            }
        ]
    })

    useSeoMeta({
        title: "ID Sim Racing",
        ogTitle: "ID Sim Racing",
        twitterTitle: "ID Sim Racing",
        description: "Database Sim Racer Indonesia",
        ogDescription: "Database Sim Racer Indonesia",
        twitterDescription: "Database Sim Racer Indonesia",
        ogImage: "https://idsimracing.pages.dev/images/1.png",
        twitterImage: "https://idsimracing.pages.dev/images/1.png",
        ogUrl: "https://idsimracing.pages.dev/database",
        twitterCard: "summary_large_image",
    })

    const { $supabase } = useNuxtApp()

    const fetchAllDrivers = async () => {
        const batchSize = 1000
        let allDrivers = []
        let start = 0
        let hasMore = true
        
        while(hasMore){
            const { data, error } = await $supabase
                .from("drivers")
                .select(`
                    id,
                    name,
                    rating,
                    organizers (
                        abbreviation,
                        name
                    ),
                    countries (
                        name,
                        code
                    )
                `)
                .range(start, start + batchSize - 1)
                .order("rating", { ascending: true })
                .order("name", { ascending: true })
            
            if(error) throw error
            
            if(data && data.length > 0){
                allDrivers = [...allDrivers, ...data]
                start += batchSize
                hasMore = data.length === batchSize
            }else{
                hasMore = false
            }
        }
        
        return allDrivers
    }

    const { data: database } = await useAsyncData("database", fetchAllDrivers)

    const getRatingStyle = (rating) => {
        if(rating === "Platinum"){
            return "bg-slate-700 text-white font-bold"
        }else if(rating === "Gold"){
            return "bg-yellow-500 text-black font-bold"
        }else if(rating === "Silver"){
            return "bg-zinc-500 text-white font-bold"
        }else if(rating === "Bronze"){
            return "bg-amber-700 text-white font-bold"
        }else if(rating === "Copper"){
            return "bg-red-700 text-white font-bold"
        }else if(rating === "Iron"){
            return "bg-black text-white font-bold"
        }
    }

    const selectedCountries = ref([])

    const countriesList = computed(() => {
        if(!database.value) return []
        const countries = database.value.map(driver => driver.countries.name)
        selectedCountries.value = [...new Set(countries)]
        return [...new Set(countries)].sort()
    })

    const orderedSelectedCountries = computed({
        get(){
            return countriesList.value.filter(country => selectedCountries.value.includes(country))
        },
        set(newValue){
            selectedCountries.value = newValue
        }
    })

    const selectedOrganizer = ref("Croco Racing Community")

    const organizersList = computed(() => {
        if(!database.value) return []
        const organizers = database.value.map(driver => driver.organizers.name)
        return [...new Set(organizers)].sort()
    })

    const ratingsOrder = {
        "Platinum": 1,
        "Gold": 2,
        "Silver": 3,
        "Bronze": 4,
        "Copper": 5,
        "Iron": 6
    }
    
    const selectedRatings = ref([])

    const ratingsList = computed(() => {
        if(!database.value) return []
        const ratings = database.value.map(driver => driver.rating)
        selectedRatings.value = [...new Set(ratings)]
        return [...new Set(ratings)].sort((a, b) => ratingsOrder[a] - ratingsOrder[b])
    })

    const orderedSelectedRatings = computed({
        get(){
            return ratingsList.value.filter(rating => selectedRatings.value.includes(rating))
        },
        set(newValue){
            selectedRatings.value = newValue
        }
    })

    const searchQuery = ref("")

    const filteredDrivers = computed(() => {
        currentPage.value = 1
        if(!database.value) return []
        const driversData = database.value.filter(driver =>
            driver.name.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
            selectedCountries.value.includes(driver.countries.name) &&
            selectedRatings.value.includes(driver.rating) &&
            driver.organizers.name === selectedOrganizer.value
        )
        return driversData.sort((a, b) => {
            if(ratingsOrder[a.rating] !== ratingsOrder[b.rating]){
                return ratingsOrder[a.rating] - ratingsOrder[b.rating]
            }
            return a.name.localeCompare(b.name)
        })
    })

    const currentPage = ref(1)
    const itemsPerPage = 50

    const paginatedDrivers = computed(() => {
        const start = (currentPage.value - 1) * itemsPerPage
        const end = start + itemsPerPage
        return filteredDrivers.value.slice(start, end)
    })

    const totalPages = computed(() => Math.ceil(filteredDrivers.value.length / itemsPerPage))

    const goToPage = (page) => {
        if(page >= 1 && page <= totalPages.value){
            currentPage.value = page
        }
    }

    const clearFilterField = (filterType) => {
        if(filterType === "rating"){
            selectedRatings.value = []
        }else if(filterType === "country"){
            selectedCountries.value = []
        }
        currentPage.value = 1
    }

    const resetFilter = () => {
        searchQuery.value = ""
        selectedOrganizer.value = "Croco Racing Community"
        selectedRatings.value = [...ratingsList.value]
        selectedCountries.value = [...countriesList.value]
        currentPage.value = 1
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
            {{ $t('databaseTitle') }}
        </div>
        <div class="mx-aut flex flex-col justify-center items-center gap-4">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('organizer') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-700 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="selectedOrganizer"
                            :items="organizersList"
                        />
                    </div>
                </div>
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('rating') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-700 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="orderedSelectedRatings"
                            :items="ratingsList"
                            multiple
                        />
                        <button 
                            @click="clearFilterField('rating')" 
                            :disabled="selectedRatings.length === 0"
                            class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                            <Icon name="mdi:filter-off" mode="svg" />
                        </button>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('country') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-700 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="orderedSelectedCountries"
                            :items="countriesList"
                            multiple
                        />
                        <button
                            @click="clearFilterField('country')" 
                            :disabled="selectedCountries.length === 0"
                            class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
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
                            class="text-sm lg:text-base w-75 border-2 border-red-700 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                        />
                    </div>
                </div>
            </div>
            <div
                v-if="searchQuery || selectedRatings.length !== ratingsList.length || selectedCountries.length !== countriesList.length || selectedOrganizer !== 'Croco Racing Community'"
                class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold px-4 py-2 rounded-lg cursor-pointer" @click="resetFilter">
                {{ $t('resetFilter') }}
            </div>
        </div>
        <div v-if="filteredDrivers.length" class="mx-auto w-full lg:w-3/5 flex flex-col gap-6 lg:gap-8">
            <div class="text-black dark:text-white text-center text-base lg:text-lg">
                <div>{{ $t('totalDrivers', {total: filteredDrivers.length}) }}</div>
                <div>{{ $t('driversDisclaimer') }}</div>
            </div>
            <table class="w-full">
                <thead class="bg-red-700 dark:bg-red-900 text-white">
                    <tr>
                        <th class="w-4/5 px-2 lg:px-4 py-2 text-sm lg:text-base">{{ $t('name') }}</th>
                        <th class="2-1/5 px-2 lg:px-4 py-2 text-sm lg:text-base">{{ $t('rating') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="driver in paginatedDrivers"
                        :key="driver.id"
                        class="text-center border-b border-slate-300 dark:border-slate-700 bg-red-50 dark:bg-slate-950 hover:bg-red-100 dark:hover:bg-slate-800"
                    >
                        <td class="w-4/5 px-2 lg:px-4 py-2 flex items-center gap-1 lg:gap-2 font-bold text-sm lg:text-base">
                            <div>
                                <Icon
                                    :name="`flag-${driver.countries.code}-4x3`"
                                    mode="svg"
                                    class="rounded-sm lg:rounded-md"
                                />
                            </div>
                            <div class="text-left">
                                {{ driver.name }}
                            </div>
                        </td>
                        <td
                            class="w-1/5 px-2 lg:px-4 py-2 text-sm lg:text-base"
                            :class="getRatingStyle(driver.rating)"
                        >
                            {{ driver.rating }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-else class="text-center text-white text-base lg:text-lg leading-6">
            {{ $t('noDriversFound') }}
        </div>
        <div v-if="totalPages > 1" class="flex justify-center items-center gap-2 mt-4">
            <div class="flex gap-2">
                <button 
                    @click="goToPage(1)" 
                    :disabled="currentPage === 1"
                    class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                >
                    <Icon name="material-symbols:first-page" mode="svg" />
                </button>
                <button 
                    @click="goToPage(currentPage - 1)" 
                    :disabled="currentPage === 1"
                    class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                >
                    <Icon name="material-symbols:arrow-back-ios" mode="svg" />
                </button>
            </div>
            <span class="px-3 py-1 font-bold text-sm lg:text-base">{{ currentPage }} / {{ totalPages }}</span>
            <div class="flex gap-2">
                <button 
                    @click="goToPage(currentPage + 1)" 
                    :disabled="currentPage === totalPages"
                    class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                >
                    <Icon name="material-symbols:arrow-forward-ios" mode="svg" />
                </button>
                <button 
                    @click="goToPage(totalPages)" 
                    :disabled="currentPage === totalPages"
                    class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                >
                    <Icon name="material-symbols:last-page" mode="svg" />
                </button>
            </div>
        </div>
        <button v-if="showTopButton" @click="scrollToTop" class="fixed bottom-12 right-8 bg-red-700 dark:bg-red-900 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
            <Icon name="mi:arrow-up" size="2.5em"  mode="svg" />
        </button>
    </div>
</template>