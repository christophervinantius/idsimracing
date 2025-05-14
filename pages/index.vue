<script setup>
    useHead({
        htmlAttrs: {
            lang: "id"
        },
        title: "Indonesia Sim Racing",
        meta: [
            {
                name: "description",
                content: "Jadwal Lengkap Indonesia Sim Racing 2025 - Assetto Corsa Indonesia, Croco Racing Community, 97th Sim Racing Community"
            }
        ]
    })
    useSeoMeta({
        title: "Indonesia Sim Racing",
        ogTitle: "Indonesia Sim Racing",
        twitterTitle: "Indonesia Sim Racing",
        description: "Jadwal Lengkap Indonesia Sim Racing 2025 - Assetto Corsa Indonesia, Croco Racing Community, 97th Sim Racing Community",
        ogDescription: "Jadwal Lengkap Indonesia Sim Racing 2025 - Assetto Corsa Indonesia, Croco Racing Community, 97th Sim Racing Community",
        twitterDescription: "Jadwal Lengkap Indonesia Sim Racing 2025 - Assetto Corsa Indonesia, Croco Racing Community, 97th Sim Racing Community",
        ogImage: "https://idsimracing.pages.dev/images/1.png",
        twitterImage: "https://idsimracing.pages.dev/images/1.png",
        ogUrl: "https://idsimracing.pages.dev",
        twitterCard: "summary_large_image",
    })

    const { $supabase } = useNuxtApp()
    const { data: schedule, error } = await useAsyncData("schedule", async () => {
        const { data, error } = await $supabase
            .from("schedule")
            .select(`
                id,
                round,
                date,
                finish_date,
                circuit,
                stream_link,
                country,
                country_2,
                events (
                    name,
                    games (
                        abbreviation,
                        link
                    ),
                    organizers (
                        abbreviation,
                        discord
                    )
                )
            `)
            .order("date", { ascending: true })
        if(error){
            throw error
        }
        return data
    })

    const { locale } = useI18n()

    const showTopButton = ref(false)

    const handleScrollTop = () => {
        showTopButton.value = window.scrollY > 100
    }

    const selectedEvents = ref([])
    const selectedMonths = ref([])
    const totalEvents = ref(0)
    const totalMonths = ref(0)
    const selectedStatus = ref("Semua")

    const date = new Date()
    const year = date.getFullYear()

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        })
    }

    const eventList = computed(() => {
        const events = [...new Set(
            schedule.value.map(item => item.events.name).sort()
        )]
        selectedEvents.value = [...new Set(events)]
        totalEvents.value = events.length
        return events
    })

    const monthsList = computed(() => {
        const months = [...new Set(
            schedule.value.map(item => {
                const month = new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" })
                return month
            })
        )]
        selectedMonths.value = [...new Set(months)]
        totalMonths.value = months.length
        return months
    })

    onMounted(() => {
        const savedEvents = localStorage.getItem("selectedEvents")
        const savedMonths = localStorage.getItem("selectedMonths")
        const savedStatus = localStorage.getItem("selectedStatus")

        if(savedEvents){
            selectedEvents.value = JSON.parse(savedEvents)
        }

        if(savedMonths){
            selectedMonths.value = JSON.parse(savedMonths)
        }

        if(savedStatus){
            selectedStatus.value = savedStatus
        }

        window.addEventListener("scroll", handleScrollTop)

        watch(selectedEvents, (newValue) => {
            localStorage.setItem("selectedEvents", JSON.stringify(newValue))
        })

        watch(selectedMonths, (newValue) => {
            localStorage.setItem("selectedMonths", JSON.stringify(newValue))
        })

        watch(selectedStatus, (newValue) => {
            localStorage.setItem("selectedStatus", newValue)
        })
    })

    onUnmounted(() => {
        window.removeEventListener("scroll", handleScrollTop)
    })

    const filteredSchedule = computed(() => {
        if(selectedStatus.value === "Semua"){
            return schedule.value.filter(item => selectedEvents.value.includes(item.events.name) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))))
        }else if(selectedStatus.value === "Selesai"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.finish_date)
                const todayDate = new Date()
                return eventDate < todayDate && (selectedEvents.value.includes(item.events.name) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))))
            })
        }else if(selectedStatus.value === "Mendatang"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.finish_date)
                const todayDate = new Date()
                return eventDate >= todayDate && (selectedEvents.value.includes(item.events.name) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))))
            })
        }
        return schedule.value.filter(item => selectedEvents.value.includes(item.events.name) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))))
    })

    const nextThreeRaces = computed(() => {
        return schedule.value.filter(item => {
            const eventDate = new Date(item.finish_date)
            const todayDate = new Date()
            return eventDate >= todayDate && (selectedEvents.value.includes(item.events.name)) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" })))
        }).slice(0, 3)
    })

    const resetFilter = () => {
        selectedEvents.value = [...eventList.value]
        selectedMonths.value = [...monthsList.value]
        selectedStatus.value = "Semua"
    }

</script>

<template>
    <div>
        <div class="bg-white dark:bg-slate-900 px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-black dark:text-white text-center text-lg lg:text-2xl font-bold leading-6">
                {{ $t('calendarTitle', {year: year}) }}
            </div>
            <div v-if="schedule" class="mx-auto">
                <div class="flex flex-col justify-center items-center gap-6 lg:gap-8">
                    <div class="bg-red-50 dark:bg-slate-950 text-black dark:text-white p-4 lg:p-8 rounded-xl lg:rounded-3xl border-2 border-red-700 dark:border-red-900 grid grid-cols-2 lg:grid-cols-5 gap-2">
                        <label v-for="event in eventList" :key="event" class="flex items-center gap-2 text-sm lg:text-base">
                            <input
                                type="checkbox"
                                :value="event"
                                v-model="selectedEvents"
                                class="accent-red-700 dark:accent-red-900"
                            />
                            {{ event }}
                        </label>
                    </div>
                    <div class="bg-red-50 dark:bg-slate-950 text-black dark:text-white p-4 lg:p-8 rounded-xl lg:rounded-3xl border-2 border-red-700 dark:border-red-900 grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <label v-for="month in monthsList" :key="month" class="flex items-center gap-2 text-sm lg:text-base">
                            <input
                                type="checkbox"
                                :value="month"
                                v-model="selectedMonths"
                                class="accent-red-700 dark:accent-red-900"
                            />
                            {{ month }}
                        </label>
                    </div>
                    <div class="flex flex-col lg:flex-row gap-2 items-center text-sm lg:text-base">
                        <label for="status" name="status" class="text-black dark:text-white">Status:</label>
                        <select id="status" name="status" class="border-2 border-red-700 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white" v-model="selectedStatus">
                            <option value="Semua">{{ $t('all') }}</option>
                            <option value="Selesai">{{ $t('finished') }}</option>
                            <option value="Mendatang">{{ $t('upcoming') }}</option>
                        </select>
                    </div>
                    <div
                        v-if="selectedEvents.length < totalEvents || selectedStatus !== 'Semua' || selectedMonths.length < totalMonths"
                        class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold px-4 py-2 rounded-lg cursor-pointer" @click="resetFilter">
                        {{ $t('resetFilter') }}
                    </div>
                </div>
            </div>
            <div v-if="schedule && filteredSchedule.length > 0" class="text-black dark:text-white text-center text-base lg:text-lg">
                <div>{{ $t('totalRaces', {total: filteredSchedule.length}) }}</div>
                <div>{{ $t('allTimesInYourTimezone') }}</div>
            </div>
        </div>
        <div class="bg-red-700 dark:bg-red-900 px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-white text-center text-lg lg:text-2xl font-bold leading-6">
                {{ $t('nearestRaces') }}
            </div>
            <div v-if="schedule && filteredSchedule.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                <div v-for="event in nextThreeRaces" :key="event.id">
                    <CardSchedule
                        :date="event.date"
                        :finish_date="event.finish_date"
                        :organizer="event.events.organizers.abbreviation"
                        :event="event.events.name"
                        :round="event.round"
                        :circuit="event.circuit"
                        :link="event.stream_link"
                        :country="event.country"
                        :country_2="event.country_2"
                        :discord="event.events.organizers.discord"
                        :game="event.events.games.abbreviation"
                        :game_link="event.events.games.link"
                    />
                </div>
            </div>
            <div v-if="filteredSchedule.length === 0" class="text-center text-white text-base lg:text-lg leading-6">
                {{ $t('noRacesFound') }}
            </div>
        </div>
        <div class="bg-white dark:bg-slate-900 px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-black dark:text-white text-center text-lg lg:text-2xl font-bold leading-6">
                {{ $t('fullCalendar') }}
            </div>
            <div v-if="schedule && filteredSchedule.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                <div v-for="event in filteredSchedule" :id="event.id">
                    <CardSchedule
                        :event="event.events.name"
                        :finish_date="event.finish_date"
                        :organizer="event.events.organizers.abbreviation"
                        :round="event.round"
                        :date="event.date"
                        :circuit="event.circuit"
                        :link="event.stream_link"
                        :country="event.country"
                        :country_2="event.country_2"
                        :discord="event.events.organizers.discord"
                        :game="event.events.games.abbreviation"
                        :game_link="event.events.games.link"
                    />
                </div>
            </div>
            <div v-if="filteredSchedule.length === 0" class="text-black dark:text-white text-center text-base lg:text-lg leading-6">
                {{ $t('noRacesFound') }}
            </div>
            <button v-if="showTopButton" @click="scrollToTop" class="fixed bottom-12 right-8 bg-red-700 dark:bg-red-900 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
                <Icon name="mi:arrow-up" size="2.5em"  mode="svg" />
            </button>
        </div>
    </div>
</template>