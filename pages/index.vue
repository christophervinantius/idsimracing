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
                season,
                is_postponed,
                event_entries (
                    id,
                    results (
                        id
                    )
                ),
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

    const getEventFullName = (item) => {
        const orgAbbr = item.events?.organizers?.abbreviation
        const eventName = item.events?.name || ""
        return orgAbbr ? `${orgAbbr} ${eventName}` : eventName
    }

    const eventList = computed(() => {
        if(!schedule.value) return []
        const events = [...new Set(
            schedule.value.map(item => getEventFullName(item)).sort()
        )]
        selectedEvents.value = [...new Set(events)]
        totalEvents.value = events.length
        return events
    })

    const yearsList = computed(() => {
        if(!schedule.value) return []
        const years = [...new Set(
            schedule.value.map(item => new Date(item.date).getFullYear())
        )].sort((a, b) => a - b)

        const currentYear = new Date().getFullYear()
        selectedYears.value = years.includes(currentYear) ? [currentYear] : []
        totalYears.value = years.length
        return years
    })
    
    const monthsList = computed(() => {
        if(!schedule.value) return []
        const monthIndices = [...new Set(
            schedule.value.map(item => new Date(item.date).getMonth())
        )].sort((a, b) => a - b)

        const months = monthIndices.map(index => {
            const date = new Date(2026, index, 1)
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
        if(!schedule.value) return []
        if(selectedStatus.value === "Semua"){
            return schedule.value.filter(item => selectedEvents.value.includes(getEventFullName(item)) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()))
        }else if(selectedStatus.value === "Selesai"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.finish_date)
                const todayDate = new Date()
                return eventDate < todayDate && (selectedEvents.value.includes(getEventFullName(item)) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()))
            })
        }else if(selectedStatus.value === "Mendatang"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.finish_date)
                const todayDate = new Date()
                return eventDate >= todayDate && (selectedEvents.value.includes(getEventFullName(item)) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()))
            })
        }
        return schedule.value.filter(item => selectedEvents.value.includes(getEventFullName(item)) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()))
    })

    const PAGE_SIZE = 12
    const displayCount = ref(PAGE_SIZE)

    const displayedSchedule = computed(() => {
        return filteredSchedule.value.slice(0, displayCount.value)
    })

    const hasMore = computed(() => {
        return displayCount.value < filteredSchedule.value.length
    })

    const loadMore = () => {
        displayCount.value += PAGE_SIZE
    }

    watch([selectedEvents, selectedMonths, selectedYears, selectedStatus], () => {
        displayCount.value = PAGE_SIZE
    })

    const nextThreeRaces = computed(() => {
        if(!schedule.value) return []
        return schedule.value.filter(item => {
            const eventDate = new Date(item.finish_date)
            const todayDate = new Date()
            return eventDate >= todayDate && (selectedEvents.value.includes(getEventFullName(item))) && (selectedMonths.value.includes(new Date(item.date).toLocaleString(locale.value === "en" ? "en-US" : "id-ID", { month: "long" }))) && selectedYears.value.includes(new Date(item.date).getFullYear()) && !item.is_postponed
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
        }else if(event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open") || event.startsWith("Asri Motor Slalom Cup")){
            style += "text-yellow-500"
        }else if(event === "Endurance Championship"){
            style += "text-pink-500"
        }else if(event === "Masters League" || event === "Praga Cup"){
            style += "text-blue-500"
        }else if(event === "Juniors"){
            style += "text-lime-500"
        }else if(event === "B.E.G.O. Balap Cup"){
            style += "text-orange-500"
        }else if(event === "Sprint Rally Challenge" || event === "Rally Championship"){
            style += "text-purple-500"
        }else if(event.startsWith("Speedway Master Series")){
            style += "text-fuchsia-500"
        }else if(event === "Javahosting Rental Cup"){
            style += "text-indigo-500"
        }else if(event === "Indorance"){
            style += "text-sky-500"
        }else if(event === "Endurance Edition" || event === "Global Edition"){
            style += "text-rose-500"
        }else if(event.startsWith("LMU Championship")){
            style += "text-amber-500"
        }else if(event === "LMU Solo Endurance"){
            style += "text-pink-800"
        }
        return style
    }

    // Returns a color string for standard 500 accents,
    // or a { style } object for custom accents (e.g. 800, 900).
    // v-calendar bar supports both formats.
    const getBarColor = (event) => {
        if(event.startsWith("MX-5 Cup Asia")){
            return "red"
        }else if(event.startsWith("1 Hour Series")){
            return "emerald"
        }else if(event === "Open Wheel Series"){
            return "cyan"
        }else if(event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open") || event.startsWith("Asri Motor Slalom Cup")){
            return "yellow"
        }else if(event === "Endurance Championship"){
            return "pink"
        }else if(event === "Masters League" || event === "Praga Cup"){
            return "blue"
        }else if(event === "Juniors"){
            return "lime"
        }else if(event === "B.E.G.O. Balap Cup"){
            return "orange"
        }else if(event === "Sprint Rally Challenge" || event === "Rally Championship"){
            return "purple"
        }else if(event.startsWith("Speedway Master Series")){
            return "fuchsia"
        }else if(event === "Javahosting Rental Cup"){
            return "indigo"
        }else if(event === "Indorance"){
            return "sky"
        }else if(event === "Endurance Edition" || event === "Global Edition"){
            return "rose"
        }else if(event.startsWith("LMU Championship")){
            return "amber"
        }else if(event === "LMU Solo Endurance"){
            return { style: { backgroundColor: '#9d174d' } } // pink-800
        }
        return ""
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

    // --- Table View ---
    const viewMode = ref('kalender')

    const tableSelectedMonth = ref(new Date().getMonth())
    const tableSelectedYear = ref(new Date().getFullYear())
    const showMonthPicker = ref(false)
    const pickerYear = ref(new Date().getFullYear())

    // All months with schedule data (sparse — only months that have events)
    const tableDataMonths = computed(() => {
        if(!schedule.value) return []
        const seen = new Map()
        schedule.value.forEach(item => {
            const d = new Date(item.date)
            const key = `${d.getFullYear()}-${d.getMonth()}`
            if(!seen.has(key)) seen.set(key, { month: d.getMonth(), year: d.getFullYear() })
        })
        return [...seen.values()].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    })

    // Full contiguous month list from first to last schedule month (fills gaps)
    const tableMonthsList = computed(() => {
        if(!tableDataMonths.value.length) return []
        const first = tableDataMonths.value[0]
        const last = tableDataMonths.value[tableDataMonths.value.length - 1]
        const result = []
        let y = first.year, m = first.month
        while(y < last.year || (y === last.year && m <= last.month)) {
            result.push({
                month: m,
                year: y,
                label: new Date(y, m, 1).toLocaleString(locale.value === 'en' ? 'en-US' : 'id-ID', { month: 'long', year: 'numeric' })
            })
            m++
            if(m > 11) { m = 0; y++ }
        }
        return result
    })

    // Years covered by the full month list
    const tablePickerYears = computed(() => {
        const years = [...new Set(tableMonthsList.value.map(e => e.year))].sort((a, b) => a - b)
        return years
    })

    // Months available for a given picker year
    const tablePickerMonthsForYear = computed(() => {
        return tableMonthsList.value.filter(e => e.year === pickerYear.value).map(e => e.month)
    })

    const tableNavIndex = computed(() =>
        tableMonthsList.value.findIndex(e => e.month === tableSelectedMonth.value && e.year === tableSelectedYear.value)
    )

    const tableNavLabel = computed(() => {
        const found = tableMonthsList.value.find(e => e.month === tableSelectedMonth.value && e.year === tableSelectedYear.value)
        return found ? found.label : new Date(tableSelectedYear.value, tableSelectedMonth.value, 1).toLocaleString(locale.value === 'en' ? 'en-US' : 'id-ID', { month: 'long', year: 'numeric' })
    })

    const tablePrevMonth = () => {
        const idx = tableNavIndex.value
        if(idx > 0) {
            tableSelectedMonth.value = tableMonthsList.value[idx - 1].month
            tableSelectedYear.value = tableMonthsList.value[idx - 1].year
        }
    }

    const tableNextMonth = () => {
        const idx = tableNavIndex.value
        if(idx < tableMonthsList.value.length - 1) {
            tableSelectedMonth.value = tableMonthsList.value[idx + 1].month
            tableSelectedYear.value = tableMonthsList.value[idx + 1].year
        }
    }

    const openMonthPicker = () => {
        pickerYear.value = tableSelectedYear.value
        showMonthPicker.value = !showMonthPicker.value
    }

    const selectPickerMonth = (month) => {
        if(!tablePickerMonthsForYear.value.includes(month)) return
        tableSelectedMonth.value = month
        tableSelectedYear.value = pickerYear.value
        showMonthPicker.value = false
    }

    const pickerPrevYear = () => {
        const idx = tablePickerYears.value.indexOf(pickerYear.value)
        if(idx > 0) pickerYear.value = tablePickerYears.value[idx - 1]
    }

    const pickerNextYear = () => {
        const idx = tablePickerYears.value.indexOf(pickerYear.value)
        if(idx < tablePickerYears.value.length - 1) pickerYear.value = tablePickerYears.value[idx + 1]
    }

    const moveTableToday = () => {
        const now = new Date()
        tableSelectedMonth.value = now.getMonth()
        tableSelectedYear.value = now.getFullYear()
        showMonthPicker.value = false
    }

    const tableMonthPickerRef = ref(null)
    const handlePickerClickOutside = (e) => {
        if(tableMonthPickerRef.value && !tableMonthPickerRef.value.contains(e.target)) {
            showMonthPicker.value = false
        }
    }
    watch(showMonthPicker, (val) => {
        if(val) document.addEventListener('mousedown', handlePickerClickOutside)
        else document.removeEventListener('mousedown', handlePickerClickOutside)
    })

    const tableFilteredSchedule = computed(() => {
        if(!schedule.value) return []
        return schedule.value.filter(item => {
            const itemMonth = new Date(item.date).getMonth()
            const itemYear = new Date(item.date).getFullYear()
            const matchesMonth = itemMonth === tableSelectedMonth.value && itemYear === tableSelectedYear.value
            const matchesEvent = selectedEvents.value.includes(getEventFullName(item))
            const matchesYear = selectedYears.value.includes(itemYear)
            if(selectedStatus.value === 'Selesai') {
                const finishDate = new Date(item.finish_date)
                return matchesMonth && matchesEvent && matchesYear && finishDate < new Date()
            } else if(selectedStatus.value === 'Mendatang') {
                const finishDate = new Date(item.finish_date)
                return matchesMonth && matchesEvent && matchesYear && finishDate >= new Date()
            }
            return matchesMonth && matchesEvent && matchesYear
        })
    })

    const formatDateDisplay = (dateStr) => {
        if(!dateStr) return '-'
        const d = new Date(dateStr)
        if(isNaN(d.getTime())) return dateStr
        const localeStr = locale.value === 'en' ? 'en-US' : 'id-ID'
        const formatted = d.toLocaleString(localeStr, {
            day: 'numeric',
            month: 'long',
            weekday: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        if(locale.value !== 'en') {
            return formatted.replace(/\s*pukul\s*/i, ' - ')
        }
        return formatted.replace(/\s+at\s+/i, ' - ')
    }

    const formatDateOnly = (dateStr) => {
        if(!dateStr) return '-'
        const d = new Date(dateStr)
        if(isNaN(d.getTime())) return dateStr
        const localeStr = locale.value === 'en' ? 'en-US' : 'id-ID'
        return d.toLocaleString(localeStr, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }

    const formatTimeOnly = (dateStr) => {
        if(!dateStr) return '-'
        const d = new Date(dateStr)
        if(isNaN(d.getTime())) return dateStr
        const localeStr = locale.value === 'en' ? 'en-US' : 'id-ID'
        return d.toLocaleTimeString(localeStr, {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getEventRowStyle = (event) => {
        if(!event) return 'bg-white dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-900'
        if(event.startsWith('MX-5 Cup Asia')) {
            return 'bg-red-200/80 dark:bg-red-900/60 hover:bg-red-300/80 dark:hover:bg-red-900/80'
        } else if(event.startsWith('1 Hour Series')) {
            return 'bg-emerald-200/80 dark:bg-emerald-900/60 hover:bg-emerald-300/80 dark:hover:bg-emerald-900/80'
        } else if(event === 'Open Wheel Series') {
            return 'bg-cyan-200/80 dark:bg-cyan-900/60 hover:bg-cyan-300/80 dark:hover:bg-cyan-900/80'
        } else if(event.startsWith('Sprint Series') || event.startsWith('Porsche Supercup') || event.startsWith('GT3 Open') || event.startsWith('Asri Motor Slalom Cup')) {
            return 'bg-yellow-200/80 dark:bg-yellow-900/60 hover:bg-yellow-300/80 dark:hover:bg-yellow-900/80'
        } else if(event === 'Endurance Championship') {
            return 'bg-pink-200/80 dark:bg-pink-900/60 hover:bg-pink-300/80 dark:hover:bg-pink-900/80'
        } else if(event === 'Masters League' || event === 'Praga Cup') {
            return 'bg-blue-200/80 dark:bg-blue-900/60 hover:bg-blue-300/80 dark:hover:bg-blue-900/80'
        } else if(event === 'Juniors') {
            return 'bg-lime-200/80 dark:bg-lime-900/60 hover:bg-lime-300/80 dark:hover:bg-lime-900/80'
        } else if(event === 'B.E.G.O. Balap Cup') {
            return 'bg-orange-200/80 dark:bg-orange-900/60 hover:bg-orange-300/80 dark:hover:bg-orange-900/80'
        } else if(event === 'Sprint Rally Challenge' || event === 'Rally Championship') {
            return 'bg-purple-200/80 dark:bg-purple-900/60 hover:bg-purple-300/80 dark:hover:bg-purple-900/80'
        } else if(event.startsWith('Speedway Master Series')) {
            return 'bg-fuchsia-200/80 dark:bg-fuchsia-900/60 hover:bg-fuchsia-300/80 dark:hover:bg-fuchsia-900/80'
        } else if(event === 'Javahosting Rental Cup') {
            return 'bg-indigo-200/80 dark:bg-indigo-900/60 hover:bg-indigo-300/80 dark:hover:bg-indigo-900/80'
        } else if(event === 'Indorance') {
            return 'bg-sky-200/80 dark:bg-sky-900/60 hover:bg-sky-300/80 dark:hover:bg-sky-900/80'
        } else if(event === 'Endurance Edition' || event === 'Global Edition') {
            return 'bg-rose-200/80 dark:bg-rose-900/60 hover:bg-rose-300/80 dark:hover:bg-rose-900/80'
        } else if(event.startsWith('LMU Championship')) {
            return 'bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-300/80 dark:hover:bg-amber-900/80'
        } else if(event === 'LMU Solo Endurance') {
            return 'bg-pink-300/80 dark:bg-pink-800/60 hover:bg-pink-400/80 dark:hover:bg-pink-800/80'
        }
        return 'bg-white dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-900'
    }

    const getAdminEventStyle = (event) => {
        if(!event) return 'font-bold'
        let style = 'font-bold '
        if(event.startsWith('MX-5 Cup Asia')) {
            style += 'text-red-500'
        } else if(event.startsWith('1 Hour Series')) {
            style += 'text-emerald-500'
        } else if(event === 'Open Wheel Series') {
            style += 'text-cyan-500'
        } else if(event.startsWith('Sprint Series') || event.startsWith('Porsche Supercup') || event.startsWith('GT3 Open') || event.startsWith('Asri Motor Slalom Cup')) {
            style += 'text-yellow-500'
        } else if(event === 'Endurance Championship') {
            style += 'text-pink-500'
        } else if(event === 'Masters League' || event === 'Praga Cup') {
            style += 'text-blue-500'
        } else if(event === 'Juniors') {
            style += 'text-lime-500'
        } else if(event === 'B.E.G.O. Balap Cup') {
            style += 'text-orange-500'
        } else if(event === 'Sprint Rally Challenge' || event === 'Rally Championship') {
            style += 'text-purple-500'
        } else if(event.startsWith('Speedway Master Series')) {
            style += 'text-fuchsia-500'
        } else if(event === 'Javahosting Rental Cup') {
            style += 'text-indigo-500'
        } else if(event === 'Indorance') {
            style += 'text-sky-500'
        } else if(event === 'Endurance Edition' || event === 'Global Edition') {
            style += 'text-rose-500'
        } else if(event.startsWith('LMU Championship')) {
            style += 'text-amber-500'
        } else if(event === 'LMU Solo Endurance') {
            style += 'text-pink-800'
        }
        return style
    }

    const getAdminOrganizerStyle = (organizer) => {
        let style = 'px-1.5 py-0.5 font-bold rounded text-xs shrink-0 '
        if(organizer === 'ACI') {
            style += 'bg-red-500 text-white'
        } else if(organizer === '97SRC') {
            style += 'bg-white text-black border border-gray-300'
        } else if(organizer === 'CRC') {
            style += 'bg-yellow-500 text-black'
        } else if(organizer === 'BRM') {
            style += 'bg-sky-500 text-black'
        } else if(organizer === 'JRC') {
            style += 'bg-indigo-500 text-black'
        } else if(organizer === 'ERGP') {
            style += 'bg-white text-red-600 border border-gray-300'
        } else if(organizer === 'SRC') {
            style += 'bg-blue-500 text-white'
        } else if(organizer === 'ISL') {
            style += 'bg-pink-800 text-white'
        } else {
            style += 'bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-200'
        }
        return style
    }

    const getAdminGameStyle = (game) => {
        let style = 'px-1.5 py-0.5 font-bold rounded text-xs shrink-0 '
        if(game === 'AC') {
            style += 'bg-red-500 text-white'
        } else if(game === 'ACC') {
            style += 'bg-white text-red-600 border border-gray-300'
        } else if(game === 'RBR') {
            style += 'bg-black text-white'
        } else if(game === 'LMU') {
            style += 'bg-amber-500 text-black'
        } else {
            style += 'bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-200'
        }
        return style
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
                                class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                                v-model="orderedSelectedYears"
                                :items="yearsList"
                                multiple
                            />
                            <button 
                                @click="clearFilterField('year')" 
                                :disabled="selectedYears.length === 0"
                                class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                                <Icon name="mdi:filter-off" mode="svg" />
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                        <label class="text-black dark:text-white font-bold">{{ $t('months') }}</label>
                        <div class="flex items-center gap-2">
                            <USelectMenu
                                class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                                v-model="orderedSelectedMonths"
                                :items="monthsList"
                                multiple
                            />
                            <button 
                                @click="clearFilterField('month')" 
                                :disabled="selectedMonths.length === 0"
                                class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
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
                                class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                                v-model="orderedSelectedEvents"
                                :items="eventList"
                                multiple
                            />
                            <button 
                                @click="clearFilterField('event')" 
                                :disabled="selectedEvents.length === 0"
                                class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                                <Icon name="mdi:filter-off" mode="svg" />
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                        <label class="text-black dark:text-white font-bold">Status</label>
                        <div class="flex items-center gap-2">
                            <USelectMenu
                                class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
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
                    class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold px-4 py-2 rounded-lg cursor-pointer" @click="resetFilter">
                    {{ $t('resetFilter') }}
                </div>
            </div>
        </div>
        <div v-if="schedule && filteredSchedule.length > 0" class="text-black dark:text-white text-center text-base lg:text-lg">
            <div>{{ $t('totalRaces', {total: filteredSchedule.length}) }}</div>
            <div>{{ $t('allTimesInYourTimezone') }}</div>
        </div>
    </div>
    <div class="bg-red-900 dark:bg-red-900 px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
        <div class="text-white text-center text-lg lg:text-2xl font-bold leading-6">
            {{ $t('nearestRaces') }}
        </div>
        <div v-if="nextThreeRaces.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <div v-for="event in nextThreeRaces" :key="event.id">
                <CardSchedule
                    :id="event.id"
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
                    :season="event.season"
                    :has_result="Boolean(event.event_entries && event.event_entries.some(e => e.results && e.results.length > 0))"
                    @organizerClick="setOrganizationData(event.events.organizers.abbreviation, event.events.organizers.name, event.events.organizers.description_en, event.events.organizers.description_id, event.events.organizers.youtube, event.events.organizers.discord, event.events.organizers.instagram, event.events.organizers.twitter, event.events.organizers.facebook, event.events.organizers.tiktok)"
                    @gameClick="setGameData(event.events.games.abbreviation, event.events.games.name, event.events.games.description_en, event.events.games.description_id, event.events.games.steam_link, event.events.games.other_link)"
                />
            </div>
        </div>
        <div v-else="nextThreeRaces.length > 0" class="text-center text-white text-base lg:text-lg leading-6">
            {{ $t('noRacesFound') }}
        </div>
    </div>
    <div id="calendar" class="flex justify-center items-center gap-3 pt-8">
        <button
            @click="viewMode = 'kalender'"
            :class="viewMode === 'kalender'
                ? 'bg-red-900 text-white font-bold px-5 py-2 rounded-lg cursor-pointer text-sm lg:text-base flex items-center gap-2 shadow'
                : 'border-2 border-red-900 text-red-900 dark:text-red-400 dark:border-red-400 font-bold px-5 py-2 rounded-lg cursor-pointer text-sm lg:text-base flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/20 transition'"
        >
            {{ $t('calendarView') }}
        </button>
        <button
            @click="viewMode = 'tabel'"
            :class="viewMode === 'tabel'
                ? 'bg-red-900 text-white font-bold px-5 py-2 rounded-lg cursor-pointer text-sm lg:text-base flex items-center gap-2 shadow'
                : 'border-2 border-red-900 text-red-900 dark:text-red-400 dark:border-red-400 font-bold px-5 py-2 rounded-lg cursor-pointer text-sm lg:text-base flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/20 transition'"
        >
            {{ $t('tableView') }}
        </button>
    </div>
    <div v-if="viewMode === 'kalender'" class="bg-white dark:bg-slate-900 px-1 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
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
                                {{ customData.events.organizers.abbreviation }} - {{ customData.events.name }} {{ customData.season && "(S" + customData.season + ")"}}
                            </div>
                            <div v-if="customData.round === 'Invitation' || customData.round === 'Prologue'">
                                {{ customData.round }} Round: {{ customData.circuit }}
                            </div>
                            <div v-else-if="customData.round !== null">
                                Round {{ customData.round }}: {{ customData.circuit }}
                            </div>
                            <div v-else-if="customData.circuit !== null">
                                {{ customData.circuit }}
                            </div>
                        </li>
                    </ul>
                </template>
                <template #footer>
                    <div class="w-fit mx-auto px-4 py-2">
                        <button
                            class="bg-red-900 dark:bg-red-900 text-white cursor-pointer w-full text-sm lg:text-base font-bold px-4 py-2 rounded-md"
                            @click="moveToday"
                        >
                            {{ $t('today') }}
                        </button>
                    </div>
                </template>
            </Calendar>
        </div>
    </div>
    <div v-if="viewMode === 'tabel'" class="bg-white dark:bg-slate-900 px-4 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
        <!-- Month Navigator -->
        <div class="flex justify-center items-center gap-4">
            <button
                @click="tablePrevMonth"
                :disabled="tableNavIndex === 0"
                class="text-black dark:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
                <Icon name="mi:chevron-left" size="1.5em" mode="svg" />
            </button>
            <!-- Clickable label that opens the month picker -->
            <div class="relative" ref="tableMonthPickerRef">
                <button
                    @click="openMonthPicker"
                    class="text-black dark:text-white font-bold text-base lg:text-lg min-w-[180px] text-center px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                    {{ tableNavLabel }}
                </button>
                <!-- Month Picker Dropdown -->
                <Transition
                    enter-active-class="transition ease-out duration-150"
                    enter-from-class="opacity-0 scale-95 -translate-y-1"
                    enter-to-class="opacity-100 scale-100 translate-y-0"
                    leave-active-class="transition ease-in duration-100"
                    leave-from-class="opacity-100 scale-100 translate-y-0"
                    leave-to-class="opacity-0 scale-95 -translate-y-1"
                >
                    <div
                        v-if="showMonthPicker"
                        class="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-slate-900 text-white rounded-xl shadow-2xl p-4 min-w-[220px] select-none"
                    >
                        <!-- Year nav -->
                        <div class="flex items-center justify-between mb-3">
                            <button
                                @click="pickerPrevYear"
                                :disabled="tablePickerYears.indexOf(pickerYear) === 0"
                                class="p-1 rounded-full hover:bg-slate-700 transition disabled:opacity-30 cursor-pointer disabled:cursor-default"
                            >
                                <Icon name="mi:chevron-left" size="1.2em" mode="svg" />
                            </button>
                            <span class="font-bold text-sm">{{ pickerYear }}</span>
                            <button
                                @click="pickerNextYear"
                                :disabled="tablePickerYears.indexOf(pickerYear) === tablePickerYears.length - 1"
                                class="p-1 rounded-full hover:bg-slate-700 transition disabled:opacity-30 cursor-pointer disabled:cursor-default"
                            >
                                <Icon name="mi:chevron-right" size="1.2em" mode="svg" />
                            </button>
                        </div>
                        <!-- Month grid -->
                        <div class="grid grid-cols-3 gap-1.5">
                            <button
                                v-for="(mName, mIdx) in (locale === 'en'
                                    ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                                    : ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])"
                                :key="mIdx"
                                @click="selectPickerMonth(mIdx)"
                                :disabled="!tablePickerMonthsForYear.includes(mIdx)"
                                :class="[
                                    'py-1.5 rounded-lg text-sm font-semibold transition',
                                    mIdx === tableSelectedMonth && pickerYear === tableSelectedYear
                                        ? 'bg-red-600 text-white'
                                        : tablePickerMonthsForYear.includes(mIdx)
                                            ? 'hover:bg-slate-700 cursor-pointer'
                                            : 'opacity-30 cursor-default'
                                ]"
                            >
                                {{ mName }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
            <button
                @click="tableNextMonth"
                :disabled="tableNavIndex === tableMonthsList.length - 1"
                class="text-black dark:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
                <Icon name="mi:chevron-right" size="1.5em" mode="svg" />
            </button>
        </div>
        <!-- Table -->
        <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <table class="w-full min-w-[800px] table-fixed text-left border-collapse">
                <colgroup>
                    <col class="w-[23%]" />
                    <col class="w-[9%]" />
                    <col class="w-[30%]" />
                    <col class="w-[8%]" />
                    <col class="w-[30%]" />
                </colgroup>
                <tbody class="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-950 text-sm">
                    <tr v-if="tableFilteredSchedule.length === 0">
                        <td colspan="5" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            {{ $t('noRacesFound') }}
                        </td>
                    </tr>
                    <tr
                        v-for="item in tableFilteredSchedule"
                        :key="item.id"
                        class="transition-colors text-black dark:text-white"
                        :class="getEventRowStyle(item.events?.name)"
                    >
                        <td class="px-3 sm:px-4 py-3 whitespace-nowrap text-xs lg:text-sm">
                            {{ formatDateOnly(item.date) }}
                        </td>
                        <td class="px-3 sm:px-4 py-3 whitespace-nowrap text-xs lg:text-sm">
                            {{ formatTimeOnly(item.date) }}
                        </td>
                        <td class="px-3 sm:px-4 py-3">
                            <div class="flex flex-col gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-1.5">
                                <div class="flex items-center gap-1.5 lg:contents">
                                    <span :class="getAdminOrganizerStyle(item.events?.organizers?.abbreviation)">
                                        {{ item.events?.organizers?.abbreviation }}
                                    </span>
                                    <span v-if="item.events?.games?.abbreviation" :class="getAdminGameStyle(item.events?.games?.abbreviation)">
                                        {{ item.events?.games?.abbreviation }}
                                    </span>
                                </div>
                                <span :class="getAdminEventStyle(item.events?.name)">
                                    {{ item.events?.name || 'Event N/A' }}{{ item.season ? ' (S' + item.season + ')' : '' }}
                                </span>
                            </div>
                        </td>
                        <td class="px-1.5 sm:px-2 py-3 whitespace-nowrap text-sm">
                            {{ item.round ? (item.round === 'Invitation' || item.round === 'Prologue' ? item.round : 'Round ' + item.round) : '' }}
                        </td>
                        <td class="px-3 sm:px-4 py-3">
                            <div class="flex items-center gap-1">
                                <Icon
                                    v-if="item.country"
                                    :name="`flag-${item.country.toLowerCase()}-4x3`"
                                    class="rounded-sm shadow-sm shrink-0"
                                />
                                <Icon
                                    v-if="item.country_2"
                                    :name="`flag-${item.country_2.toLowerCase()}-4x3`"
                                    class="rounded-sm shadow-sm shrink-0"
                                />
                                <span>{{ item.circuit || '' }}</span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <!-- Today button -->
        <div class="flex justify-center">
            <button
                class="bg-red-900 dark:bg-red-900 text-white cursor-pointer text-sm lg:text-base font-bold px-4 py-2 rounded-md hover:bg-red-950 dark:hover:bg-red-950 transition"
                @click="moveTableToday"
            >
                {{ $t('today') }}
            </button>
        </div>
    </div>

    <!-- Full Card Grid (always at bottom) -->
    <div class="bg-white dark:bg-slate-900 px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
        <div class="text-black dark:text-white text-center text-lg lg:text-2xl font-bold leading-6">
            {{ $t('fullCalendar') }}
        </div>
        <div v-if="schedule && filteredSchedule.length > 0" class="text-black dark:text-white text-center text-sm lg:text-base">
            {{ $t('showingOf', { showing: displayedSchedule.length, total: filteredSchedule.length }) }}
        </div>
        <div v-if="schedule && filteredSchedule.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <div v-for="event in displayedSchedule" :key="event.id" :id="event.id">
                <CardSchedule
                    :id="event.id"
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
                    :season="event.season"
                    :has_result="Boolean(event.event_entries && event.event_entries.some(e => e.results && e.results.length > 0))"
                    @organizerClick="setOrganizationData(event.events.organizers.abbreviation, event.events.organizers.name, event.events.organizers.description_en, event.events.organizers.description_id, event.events.organizers.youtube, event.events.organizers.discord, event.events.organizers.instagram, event.events.organizers.twitter, event.events.organizers.facebook, event.events.organizers.tiktok)"
                    @gameClick="setGameData(event.events.games.abbreviation, event.events.games.name, event.events.games.description_en, event.events.games.description_id, event.events.games.steam_link, event.events.games.other_link)"
                />
            </div>
        </div>
        <div v-if="hasMore" class="flex justify-center">
            <button
                @click="loadMore"
                class="bg-red-900 dark:bg-red-900 hover:bg-red-950 dark:hover:bg-red-950 text-white text-sm lg:text-base font-bold px-8 py-3 rounded-lg cursor-pointer transition-colors duration-200"
            >
                {{ $t('loadMore') }}
            </button>
        </div>
        <div v-if="filteredSchedule.length === 0" class="text-black dark:text-white text-center text-base lg:text-lg leading-6">
            {{ $t('noRacesFound') }}
        </div>
    </div>

    <!-- Floating Scroll Buttons -->
    <button v-if="showCalendarButton && viewMode === 'kalender'" @click="scrollToCalendar" class="fixed bottom-12 left-8 bg-red-900 dark:bg-red-900 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
        <Icon name="mi:calendar" size="2.5em" mode="svg" />
    </button>
    <button v-if="showTopButton" @click="scrollToTop" class="fixed bottom-12 right-8 bg-red-900 dark:bg-red-900 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
        <Icon name="mi:arrow-up" size="2.5em" mode="svg" />
    </button>
</template>