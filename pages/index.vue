<script setup>
    import { Calendar } from 'v-calendar'
    import 'v-calendar/style.css'

    useHead({
        htmlAttrs: {
            lang: "id"
        },
        title: "ID Sim Racing",
        meta: [
            {
                name: "description",
                content: "Pusat Sim Racer Indonesia"
            }
        ]
    })

    useSeoMeta({
        title: "ID Sim Racing",
        ogTitle: "ID Sim Racing",
        twitterTitle: "ID Sim Racing",
        description: "Pusat Sim Racer Indonesia",
        ogDescription: "Pusat Sim Racer Indonesia",
        twitterDescription: "Pusat Sim Racer Indonesia",
        ogImage: "https://idsimracing.pages.dev/images/1.png",
        twitterImage: "https://idsimracing.pages.dev/images/1.png",
        ogUrl: "https://idsimracing.pages.dev",
        twitterCard: "summary_large_image",
    })

    const { $supabase } = useNuxtApp()
    const { data: schedule } = await useAsyncData("schedule", async () => {
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
                is_postponed,
                events (
                    name,
                    games (
                        abbreviation,
                        name,
                        description_en,
                        description_id,
                        steam_link,
                        other_link
                    ),
                    organizers (
                        abbreviation,
                        name,
                        description_en,
                        description_id,
                        discord,
                        youtube,
                        instagram,
                        twitter,
                        facebook,
                        tiktok
                    )
                )
            `)
            .order("date", { ascending: true })
        if(error){
            throw error
        }
        return data
    })

    const { locale, t } = useI18n()

    const showTopButton = ref(false)
    const showCalendarButton = ref(false)

    const handleScrollTop = () => {
        showTopButton.value = window.scrollY > 100
    }

    const handleScrollCalendar = () => {
        showCalendarButton.value = window.scrollY > 100
    }
    
    const scrollToCalendar = () => {
        const calendarElement = document.getElementById("calendar")
        if(calendarElement){
            calendarElement.scrollIntoView({ behavior: "smooth" })
        }
    }

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        })
    }

    const selectedEvents = ref([])
    const selectedMonths = ref([])
    const selectedYears = ref([])
    const totalEvents = ref(0)
    const totalMonths = ref(0)
    const totalYears = ref(0)
    const selectedStatus = ref("Mendatang")

    const eventList = computed(() => {
        const events = [...new Set(
            schedule.value.map(item => item.events.name).sort()
        )]
        selectedEvents.value = [...new Set(events)]
        totalEvents.value = events.length
        return events
    })

    const yearsList = computed(() => {
        const years = [...new Set(
            schedule.value.map(item => new Date(item.date).getFullYear())
        )].sort((a, b) => a - b)

        const currentYear = new Date().getFullYear()
        selectedYears.value = years.includes(currentYear) ? [currentYear] : []
        totalYears.value = years.length
        return years
    })
    
    const monthsList = computed(() => {
        const monthIndices = [...new Set(
            schedule.value.map(item => new Date(item.date).getMonth())
        )].sort((a, b) => a - b)

        const months = monthIndices.map(index => {
            const date = new Date(2025, index, 1)
            return date.toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" })
        })

        selectedMonths.value = [...months]
        totalMonths.value = months.length
        return months
    })

    const orderedSelectedEvents = computed({
        get(){
            return eventList.value.filter(event => selectedEvents.value.includes(event))
        },
        set(newValue){
            selectedEvents.value = newValue
        }
    })

    const orderedSelectedMonths = computed({
        get(){
            return monthsList.value.filter(month => selectedMonths.value.includes(month))
        },
        set(newValue) {
            selectedMonths.value = newValue
        }
    })

    const orderedSelectedYears = computed({
        get(){
            return yearsList.value.filter(year => selectedYears.value.includes(year))
        },
        set(newValue){
            selectedYears.value = newValue
        }
    })

    const statusList = computed(() => [
        { value: "Semua", label: t('all')},
        { value: "Selesai", label: t('finished')},
        { value: "Mendatang", label: t('upcoming')}
    ])

    const selectedStatusObject = computed({
        get(){
            return statusList.value.find(status => status.value === selectedStatus.value) || statusList.value[2]
        },
        set(newValue){
            selectedStatus.value = newValue.value
        }
    })

    const isDark = ref(false)

    onMounted(() => {
        isDark.value = document.documentElement.classList.contains('dark')
        
        const observer = new MutationObserver(() => {
            isDark.value = document.documentElement.classList.contains('dark')
        })
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        })

        const savedEvents = localStorage.getItem("selectedEvents")
        const savedMonths = localStorage.getItem("selectedMonths")
        const savedYears = localStorage.getItem("selectedYears")
        const savedStatus = localStorage.getItem("selectedStatus")

        if(savedEvents){
            selectedEvents.value = JSON.parse(savedEvents)
        }

        if(savedMonths){
            selectedMonths.value = JSON.parse(savedMonths)
        }
        
        if(savedYears){
            selectedYears.value = JSON.parse(savedYears)
        }

        if(savedStatus){
            selectedStatus.value = savedStatus
        }

        window.addEventListener("scroll", handleScrollTop)
        window.addEventListener("scroll", handleScrollCalendar)

        watch(selectedEvents, (newValue) => {
            localStorage.setItem("selectedEvents", JSON.stringify(newValue))
        })

        watch(selectedMonths, (newValue) => {
            localStorage.setItem("selectedMonths", JSON.stringify(newValue))
        })

        watch(selectedYears, (newValue) => {
            localStorage.setItem("selectedYears", JSON.stringify(newValue))
        })

        watch(selectedStatus, (newValue) => {
            localStorage.setItem("selectedStatus", newValue)
        })
    })

    onUnmounted(() => {
        window.removeEventListener("scroll", handleScrollTop)
        window.removeEventListener("scroll", handleScrollCalendar)
    })

    const filteredSchedule = computed(() => {
        if(selectedStatus.value === "Semua"){
            return schedule.value.filter(item => selectedEvents.value.includes(item.events.name) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()))
        }else if(selectedStatus.value === "Selesai"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.finish_date)
                const todayDate = new Date()
                return eventDate < todayDate && (selectedEvents.value.includes(item.events.name) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()))
            })
        }else if(selectedStatus.value === "Mendatang"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.finish_date)
                const todayDate = new Date()
                return eventDate >= todayDate && (selectedEvents.value.includes(item.events.name) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()))
            })
        }
        return schedule.value.filter(item => selectedEvents.value.includes(item.events.name) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()))
    })

    const nextThreeRaces = computed(() => {
        return schedule.value.filter(item => {
            const eventDate = new Date(item.finish_date)
            const todayDate = new Date()
            return eventDate >= todayDate && (selectedEvents.value.includes(item.events.name)) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()) && !item.is_postponed
        }).slice(0, 3)
    })

    const clearFilterField = (filterType) => {
        if(filterType === "year"){
            selectedYears.value = []
        }else if(filterType === "month"){
            selectedMonths.value = []
        }else if(filterType === "event"){
            selectedEvents.value = []
        }
    }

    const resetFilter = () => {
        selectedEvents.value = [...eventList.value]
        selectedMonths.value = [...monthsList.value]
        selectedYears.value = [...yearsList.value]
        selectedStatus.value = "Mendatang"
    }

    const organizationData = reactive({
        organizer: "",
        name: "",
        description_en: "",
        description_id: "",
        youtube: "",
        discord: "",
        instagram: "",
        twitter: "",
        facebook: "",
        tiktok: ""
    })

    const setOrganizationData = (organizer, name, description_en, description_id, youtube, discord, instagram, twitter, facebook, tiktok) => {
        organizationData.organizer = organizer
        organizationData.name = name
        organizationData.description_en = description_en
        organizationData.description_id = description_id
        organizationData.youtube = youtube
        organizationData.discord = discord
        organizationData.instagram = instagram
        organizationData.twitter = twitter
        organizationData.facebook = facebook
        organizationData.tiktok = tiktok
    }

    provide("organizationData", organizationData)

    const gameData = reactive({
        game: "",
        name: "",
        description_en: "",
        description_id: "",
        steam_link: "",
        other_link: ""
    })

    const setGameData = (game, name, description_en, description_id, steam_link, other_link) => {
        gameData.game = game
        gameData.name = name
        gameData.description_en = description_en
        gameData.description_id = description_id
        gameData.steam_link = steam_link
        gameData.other_link = other_link
    }

    provide("gameData", gameData)

    const getEventStyle = (event) => {
        let style = "text-base font-bold "
        if(event.startsWith("MX-5 Cup Asia")){
            style += "text-red-500"
        }else if(event.startsWith("1 Hour Series")){
            style += "text-emerald-500"
        }else if(event === "Open Wheel Series"){
            style += "text-cyan-500"
        }else if(event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open")){
            style += "text-yellow-500"
        }else if(event === "Endurance Championship"){
            style += "text-pink-500"
        }else if(event === "V8 Masters League" || event === "Praga Cup"){
            style += "text-blue-500"
        }else if(event === "Juniors"){
            style += "text-lime-500"
        }else if(event === "B.E.G.O. Balap Cup"){
            style += "text-orange-500"
        }else if(event === "Sprint Rally Challenge"){
            style += "text-purple-500"
        }else if(event.startsWith("Speedway Master Series")){
            style += "text-fuchsia-500"
        }else if(event === "Javahosting Rental Cup"){
            style += "text-indigo-500"
        }else if(event === "Indorance"){
            style += "text-sky-500"
        }else if(event === "Endurance Edition" || event === "Global Edition"){
            style += "text-rose-500"
        }
        return style
    }

    const getBarColor = (event) => {
        let color = ""
        if(event.startsWith("MX-5 Cup Asia")){
            color = "red"
        }else if(event.startsWith("1 Hour Series")){
            color = "emerald"
        }else if(event === "Open Wheel Series"){
            color = "cyan"
        }else if(event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open")){
            color = "yellow"
        }else if(event === "Endurance Championship"){
            color = "pink"
        }else if(event === "V8 Masters League" || event === "Praga Cup"){
            color = "blue"
        }else if(event === "Juniors"){
            color = "lime"
        }else if(event === "B.E.G.O. Balap Cup"){
            color = "orange"
        }else if(event === "Sprint Rally Challenge"){
            color = "purple"
        }else if(event.startsWith("Speedway Master Series")){
            color = "fuchsia"
        }else if(event === "Javahosting Rental Cup"){
            color = "indigo"
        }else if(event === "Indorance"){
            color = "sky"
        }else if(event === "Endurance Edition" || event === "Global Edition"){
            color = "rose"
        }
        return color
    }

    const calendarAttributes = computed(() => {
        return [
            ...filteredSchedule.value.map(item => ({
                key: item.id,
                dates: new Date(item.date),
                bar: getBarColor(item.events.name),
                popover: true,
                customData: item,
            })),
            {
                key: 'today',
                dates: new Date(),
                highlight: {
                    fillMode: 'solid',
                },
            }
        ]
    })

    const formatTime = (date) => {
        let newTime = new Date(date)

        let timeOptions = {
            hour: "2-digit",
            minute: "2-digit"
        }

        newTime = newTime.toLocaleTimeString(locale.value === "en" ? "en-US" : "id-ID", timeOptions)

        return newTime
    }

    const calendar = ref(null);

    const moveToday = () => {
        calendar.value.move(new Date());
    }
</script>

<template>
    <div class="bg-white dark:bg-slate-900 px-8 lg:px-32 py-8 flex flex-col gap-6">
        <div class="text-black dark:text-white text-center text-lg lg:text-2xl font-bold leading-6">
            {{ $t('calendarTitle') }}
        </div>
        <div v-if="schedule" class="mx-auto">
            <div class="flex flex-col justify-center items-center gap-4">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                        <label class="text-black dark:text-white font-bold">{{ $t('years') }}</label>
                        <div class="flex items-center gap-2">
                            <USelectMenu
                                class="text-sm lg:text-base w-75 border-2 border-red-700 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                                v-model="orderedSelectedYears"
                                :items="yearsList"
                                multiple
                            />
                            <button 
                                @click="clearFilterField('year')" 
                                :disabled="selectedYears.length === 0"
                                class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                                <Icon name="mdi:filter-off" mode="svg" />
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                        <label class="text-black dark:text-white font-bold">{{ $t('months') }}</label>
                        <div class="flex items-center gap-2">
                            <USelectMenu
                                class="text-sm lg:text-base w-75 border-2 border-red-700 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                                v-model="orderedSelectedMonths"
                                :items="monthsList"
                                multiple
                            />
                            <button 
                                @click="clearFilterField('month')" 
                                :disabled="selectedMonths.length === 0"
                                class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                                <Icon name="mdi:filter-off" mode="svg" />
                            </button>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                        <label class="text-black dark:text-white font-bold">{{ $t('events') }}</label>
                        <div class="flex items-center gap-2">
                            <USelectMenu
                                class="text-sm lg:text-base w-75 border-2 border-red-700 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                                v-model="orderedSelectedEvents"
                                :items="eventList"
                                multiple
                            />
                            <button 
                                @click="clearFilterField('event')" 
                                :disabled="selectedEvents.length === 0"
                                class="text-white bg-red-700 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                                <Icon name="mdi:filter-off" mode="svg" />
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                        <label class="text-black dark:text-white font-bold">Status</label>
                        <div class="flex items-center gap-2">
                            <USelectMenu
                                class="text-sm lg:text-base w-75 border-2 border-red-700 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                                v-model="selectedStatusObject"
                                :items="statusList"
                                option-attribute="label"
                                value-attribute="value"
                            />
                        </div>
                    </div>
                </div>
                <div
                    v-if="selectedEvents.length < totalEvents || selectedStatus !== 'Mendatang' || selectedMonths.length < totalMonths || selectedYears.length < totalYears"
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
        <div v-if="nextThreeRaces.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <div v-for="event in nextThreeRaces" :key="event.id">
                <CardSchedule
                    :date="event.date"
                    :finish_date="event.finish_date"
                    :event="event.events.name"
                    :round="event.round"
                    :circuit="event.circuit"
                    :link="event.stream_link"
                    :country="event.country"
                    :country_2="event.country_2"
                    :is_postponed="event.is_postponed"
                    :organizer="event.events.organizers.abbreviation"
                    :game="event.events.games.abbreviation"
                    @organizerClick="setOrganizationData(event.events.organizers.abbreviation, event.events.organizers.name, event.events.organizers.description_en, event.events.organizers.description_id, event.events.organizers.youtube, event.events.organizers.discord, event.events.organizers.instagram, event.events.organizers.twitter, event.events.organizers.facebook, event.events.organizers.tiktok)"
                    @gameClick="setGameData(event.events.games.abbreviation, event.events.games.name, event.events.games.description_en, event.events.games.description_id, event.events.games.steam_link, event.events.games.other_link)"
                />
            </div>
        </div>
        <div v-else="nextThreeRaces.length > 0" class="text-center text-white text-base lg:text-lg leading-6">
            {{ $t('noRacesFound') }}
        </div>
    </div>
    <div id="calendar" class="bg-white dark:bg-slate-900 px-1 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
        <div class="text-black dark:text-white text-center text-lg lg:text-2xl font-bold leading-6">
            {{ $t('calendar') }}
        </div>
        <div class="mx-auto w-3/4">
            <Calendar
                ref="calendar"
                expanded
                borderless
                :is-dark="isDark"
                show-weeknumbers="left-outside"
                trim-weeks
                :locale="locale"
                :first-day-of-week="2"
                :masks="{ weekdays: 'WWW' }"
                :attributes="calendarAttributes"
            >
                <template #day-popover="{ attributes }">
                    <ul class="p-2 lg:p-4 grid gap-4">
                        <li
                            v-for="{ key, customData } in [...attributes].sort((a, b) => new Date(a.customData.date) - new Date(b.customData.date))"
                            :key="key"
                            class="block text-xs lg:text-sm"
                        >
                            <div>
                                {{ formatTime(customData.date) }}
                            </div>
                            <div :class="getEventStyle(customData.events.name)">
                                {{ customData.events.organizers.abbreviation }} - {{ customData.events.name }}
                            </div>
                            <div v-if="customData.round === 'Invitation'">
                                {{ customData.round }} Round: {{ customData.circuit }}
                            </div>
                            <div v-else>
                                Round {{ customData.round }}: {{ customData.circuit }}
                            </div>
                        </li>
                    </ul>
                </template>
                <template #footer>
                    <div class="w-fit mx-auto px-4 py-2">
                        <button
                            class="bg-red-700 dark:bg-red-900 text-white cursor-pointer w-full text-sm lg:text-base font-bold px-4 py-2 rounded-md"
                            @click="moveToday"
                        >
                            {{ $t('today') }}
                        </button>
                    </div>
                </template>
            </Calendar>
        </div>
    </div>
    <div class="bg-white dark:bg-slate-900 px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
        <div class="text-black dark:text-white text-center text-lg lg:text-2xl font-bold leading-6">
            {{ $t('fullCalendar') }}
        </div>
        <div v-if="schedule && filteredSchedule.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <div v-for="event in filteredSchedule" :id="event.id">
                <CardSchedule
                    :date="event.date"
                    :finish_date="event.finish_date"
                    :event="event.events.name"
                    :round="event.round"
                    :circuit="event.circuit"
                    :link="event.stream_link"
                    :country="event.country"
                    :country_2="event.country_2"
                    :is_postponed="event.is_postponed"
                    :organizer="event.events.organizers.abbreviation"
                    :game="event.events.games.abbreviation"
                    @organizerClick="setOrganizationData(event.events.organizers.abbreviation, event.events.organizers.name, event.events.organizers.description_en, event.events.organizers.description_id, event.events.organizers.youtube, event.events.organizers.discord, event.events.organizers.instagram, event.events.organizers.twitter, event.events.organizers.facebook, event.events.organizers.tiktok)"
                    @gameClick="setGameData(event.events.games.abbreviation, event.events.games.name, event.events.games.description_en, event.events.games.description_id, event.events.games.steam_link, event.events.games.other_link)"
                />
            </div>
        </div>
        <div v-if="filteredSchedule.length === 0" class="text-black dark:text-white text-center text-base lg:text-lg leading-6">
            {{ $t('noRacesFound') }}
        </div>
        <button v-if="showCalendarButton" @click="scrollToCalendar" class="fixed bottom-12 left-8 bg-red-700 dark:bg-red-900 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
            <Icon name="mi:calendar" size="2.5em"  mode="svg" />
        </button>
        <button v-if="showTopButton" @click="scrollToTop" class="fixed bottom-12 right-8 bg-red-700 dark:bg-red-900 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
            <Icon name="mi:arrow-up" size="2.5em"  mode="svg" />
        </button>
    </div>
</template>