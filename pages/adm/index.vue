<script setup>
    useHead({
        htmlAttrs: {
            lang: "id"
        },
        title: "Admin | ID Sim Racing",
        meta: [
            {
                name: "description",
                content: "Halaman Admin Update Jadwal Balapan, Database Pembalap, Tim, dan Rental ID Sim Racing"
            }
        ]
    })

    useSeoMeta({
        title: "Admin | ID Sim Racing",
        description: "Halaman Admin Update Jadwal Balapan, Database Pembalap, Tim, dan Rental ID Sim Racing"
    })

    const { $supabase } = useNuxtApp()
    const config = useRuntimeConfig()
    const { t } = useI18n()

    // Active Tab: 'schedule' | 'drivers' | 'teams' | 'rentals' | 'results' | 'points' | 'standings'
    const activeTab = ref("schedule")

    const adminTabs = computed(() => [
        { id: "schedule", label: "Jadwal Balapan", icon: "material-symbols:calendar-month", count: schedules.value.length },
        { id: "drivers", label: "Database Pembalap", icon: "material-symbols:sports-motorsports", count: drivers.value.length },
        { id: "teams", label: "Database Tim", icon: "material-symbols:groups", count: teams.value.length },
        { id: "rentals", label: "Rental Sim Racing", icon: "material-symbols:storefront", count: rentals.value.length },
        { id: "results", label: "Hasil Balapan", icon: "material-symbols:trophy", count: (selectedScheduleId.value && resultsRows.value.filter(r => isTeamEvent.value ? r.team_id : r.driver_id).length > 0) ? resultsRows.value.filter(r => isTeamEvent.value ? r.team_id : r.driver_id).length : null },
        { id: "points", label: "Sistem Poin", icon: "material-symbols:functions", count: pointsSystems.value.length },
        { id: "standings", label: "Klasemen", icon: "material-symbols:emoji-events", count: championships.value.length },
    ])

    // General loading & feedback state
    const loading = ref(false)
    const saving = ref(false)
    const deleting = ref(false)
    const errorMsg = ref("")
    const toastMessage = ref("")
    const toastType = ref("success") // 'success' | 'error'

    const showToast = (message, type = "success") => {
        toastMessage.value = message
        toastType.value = type
        setTimeout(() => {
            toastMessage.value = ""
        }, 4000)
    }

    // Admin Access Gate state
    const ADM_PASS = config.public?.passAdm
    const CRUD_PASS = config.public?.passCrud
    const isAuthenticated = ref(false)
    const loginPasswordInput = ref("")
    const loginPasswordError = ref("")
    const showLoginPassword = ref(false)

    const handleLogin = () => {
        loginPasswordError.value = ""
        if (loginPasswordInput.value === ADM_PASS) {
            isAuthenticated.value = true
            sessionStorage.setItem("admin_authenticated", "true")
            fetchAllAdminData()
        } else {
            loginPasswordError.value = "Password admin salah!"
        }
    }

    const handleLogout = () => {
        isAuthenticated.value = false
        sessionStorage.removeItem("admin_authenticated")
        loginPasswordInput.value = ""
        loginPasswordError.value = ""
    }

    // Common pagination options
    const itemsPerPageOptions = [10, 20, 50, 100]

    // ==========================================
    // SCHEDULE STATE & METHODS
    // ==========================================
    const schedules = ref([])
    const eventsList = ref([])
    const scheduleSearchQuery = ref("")
    const scheduleDateFilter = ref("") // 'YYYY-MM-DD'
    const timeFilter = ref("week") // 'week' | 'month' | 'all'

    const isScheduleModalOpen = ref(false)
    const scheduleModalMode = ref("edit") // 'edit' | 'create'
    const editingScheduleId = ref(null)
    const deletingScheduleItem = ref(null)
    const isScheduleDeleteModalOpen = ref(false)

    const scheduleAdminPassword = ref("")
    const scheduleAdminPasswordError = ref("")
    const showScheduleAdminPassword = ref(false)
    const scheduleDeletePassword = ref("")
    const scheduleDeletePasswordError = ref("")
    const showScheduleDeletePassword = ref(false)

    const scheduleFormData = reactive({
        event_id: "",
        round: "",
        season: "",
        date: "",
        finish_date: "",
        circuit: "",
        country: "",
        country_2: "",
        stream_link: "",
        is_postponed: false
    })

    const getWeekRange = () => {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 7)
        end.setHours(23, 59, 59, 999)
        return { start, end }
    }

    const getMonthRange = () => {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        return { start, end }
    }

    const fetchSchedules = async () => {
        loading.value = true
        errorMsg.value = ""
        try {
            let query = $supabase
                .from("schedule")
                .select(`
                    id,
                    event_id,
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
                        id,
                        name,
                        games (
                            abbreviation,
                            name
                        ),
                        organizers (
                            abbreviation,
                            name
                        )
                    )
                `)
                .order("date", { ascending: true })

            if (timeFilter.value === "week") {
                const { start, end } = getWeekRange()
                query = query.gte("date", start.toISOString()).lte("date", end.toISOString())
            } else if (timeFilter.value === "month") {
                const { start, end } = getMonthRange()
                query = query.gte("date", start.toISOString()).lte("date", end.toISOString())
            }

            const { data, error } = await query
            if (error) throw error
            schedules.value = data || []
        } catch (err) {
            console.error("Error fetching schedules:", err)
            errorMsg.value = err.message || "Gagal mengambil data jadwal balapan."
        } finally {
            loading.value = false
        }
    }

    const getEventDisplayName = (ev) => {
        const abbr = ev.organizers?.abbreviation
        return abbr ? `${abbr} ${ev.name}` : ev.name
    }

    const fetchEventsList = async () => {
        try {
            const { data, error } = await $supabase
                .from("events")
                .select(`
                    id,
                    name,
                    organizers (
                        abbreviation,
                        name
                    )
                `)
            if (error) throw error
            const list = data || []
            eventsList.value = list.sort((a, b) => getEventDisplayName(a).localeCompare(getEventDisplayName(b)))
        } catch (err) {
            console.error("Error fetching events list:", err)
        }
    }

    const hasScheduleResult = (item) => {
        if (!item) return false
        if (item.event_entries && Array.isArray(item.event_entries)) {
            if (item.event_entries.some(e => e.results && e.results.length > 0)) return true
        }
        return false
    }

    const filteredSchedules = computed(() => {
        let list = schedules.value

        // Filter by date picker if specified
        if (scheduleDateFilter.value) {
            list = list.filter(item => {
                if (!item.date) return false
                const itemDate = new Date(item.date)
                const pad = (n) => String(n).padStart(2, "0")
                const itemDateStr = `${itemDate.getFullYear()}-${pad(itemDate.getMonth() + 1)}-${pad(itemDate.getDate())}`
                return itemDateStr === scheduleDateFilter.value
            })
        }

        // Filter by search query (matching organizer, event, circuit, round, date, formatted day/month)
        if (scheduleSearchQuery.value.trim()) {
            const q = scheduleSearchQuery.value.trim().toLowerCase()
            const words = q.split(/\s+/).filter(Boolean)
            list = list.filter(item => {
                const orgAbbr = item.events?.organizers?.abbreviation || ""
                const orgName = item.events?.organizers?.name || ""
                const eventName = item.events?.name || ""
                const circuit = item.circuit || ""
                const roundStr = String(item.round || "")
                const seasonStr = item.season ? `s${item.season} season ${item.season}` : ""
                const dateIso = String(item.date || "")
                const formattedDate = item.date ? formatDateOnly(item.date) : ""
                const formattedTime = item.date ? formatTimeOnly(item.date) : ""
                const fullText = `${formattedDate} ${formattedTime} ${orgAbbr} ${eventName} ${orgName} ${seasonStr} round ${roundStr} ${circuit} ${dateIso}`.toLowerCase()
                return words.every(w => fullText.includes(w))
            })
        }

        return list
    })

    const scheduleCurrentPage = ref(1)
    const scheduleItemsPerPage = ref(20)

    const scheduleTotalPages = computed(() => {
        return Math.max(1, Math.ceil(filteredSchedules.value.length / scheduleItemsPerPage.value))
    })

    const paginatedSchedules = computed(() => {
        const start = (scheduleCurrentPage.value - 1) * scheduleItemsPerPage.value
        return filteredSchedules.value.slice(start, start + scheduleItemsPerPage.value)
    })

    watch([scheduleSearchQuery, scheduleDateFilter, timeFilter, scheduleItemsPerPage], () => {
        scheduleCurrentPage.value = 1
    })

    watch(scheduleDateFilter, (newVal) => {
        if (newVal && (timeFilter.value === "week" || timeFilter.value === "month")) {
            timeFilter.value = "all"
        }
    })

    watch(timeFilter, () => {
        fetchSchedules()
    })

    const formatDateOnly = (dateStr) => {
        if (!dateStr) return "-"
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return dateStr
        return d.toLocaleString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        })
    }

    const formatTimeOnly = (dateStr) => {
        if (!dateStr) return "-"
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return dateStr
        return d.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    const getScheduleStatus = (item) => {
        if (item.is_postponed) return "Ditunda"
        const startDate = new Date(item.date)
        const finishDate = new Date(item.finish_date || item.date)
        const todayDate = new Date()

        const remainingEventDays = Math.floor((startDate - todayDate) / (1000 * 60 * 60 * 24))
        const remainingFinishDays = Math.floor((finishDate - todayDate) / (1000 * 60 * 60 * 24))

        if (remainingEventDays < 0 && remainingFinishDays < 0) return "Selesai"
        if (remainingEventDays < 0 && remainingFinishDays >= 0) return t("started")

        if (remainingEventDays <= 1) {
            let remainingHours = Math.ceil((startDate - todayDate) / (1000 * 60 * 60))
            if (remainingHours > 24) {
                return t("oneDayAndHoursLeft", { count: remainingHours - 24 })
            } else {
                const remainingMinutes = Math.ceil((startDate - todayDate) / (1000 * 60))
                if (remainingMinutes < 60) {
                    return t("minutesLeft", { count: remainingMinutes })
                } else {
                    return t("hoursLeft", { count: remainingHours })
                }
            }
        }
        return t("daysLeft", { days: remainingEventDays })
    }

    const getStatusBadgeClass = (status) => {
        if (status === "Ditunda") {
            return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
        } else if (status === "Selesai") {
            return "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300 border border-gray-300 dark:border-slate-700"
        }
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
    }

    const getEventRowStyle = (event) => {
        if (!event) return "bg-white dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-900"
        if (event.startsWith("MX-5 Cup Asia")) return "bg-red-200/80 dark:bg-red-900/60 hover:bg-red-300/80 dark:hover:bg-red-900/80"
        if (event.startsWith("1 Hour Series")) return "bg-emerald-200/80 dark:bg-emerald-900/60 hover:bg-emerald-300/80 dark:hover:bg-emerald-900/80"
        if (event === "Open Wheel Series") return "bg-cyan-200/80 dark:bg-cyan-900/60 hover:bg-cyan-300/80 dark:hover:bg-cyan-900/80"
        if (event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open") || event.startsWith("Asri Motor Slalom Cup")) {
            return "bg-yellow-200/80 dark:bg-yellow-900/60 hover:bg-yellow-300/80 dark:hover:bg-yellow-900/80"
        }
        if (event === "Endurance Championship") return "bg-pink-200/80 dark:bg-pink-900/60 hover:bg-pink-300/80 dark:hover:bg-pink-900/80"
        if (event === "Masters League" || event === "Praga Cup") return "bg-blue-200/80 dark:bg-blue-900/60 hover:bg-blue-300/80 dark:hover:bg-blue-900/80"
        if (event === "Juniors") return "bg-lime-200/80 dark:bg-lime-900/60 hover:bg-lime-300/80 dark:hover:bg-lime-900/80"
        if (event === "B.E.G.O. Balap Cup") return "bg-orange-200/80 dark:bg-orange-900/60 hover:bg-orange-300/80 dark:hover:bg-orange-900/80"
        if (event === "Sprint Rally Challenge" || event === "Rally Championship") return "bg-purple-200/80 dark:bg-purple-900/60 hover:bg-purple-300/80 dark:hover:bg-purple-900/80"
        if (event.startsWith("Speedway Master Series")) return "bg-fuchsia-200/80 dark:bg-fuchsia-900/60 hover:bg-fuchsia-300/80 dark:hover:bg-fuchsia-900/80"
        if (event === "Javahosting Rental Cup") return "bg-indigo-200/80 dark:bg-indigo-900/60 hover:bg-indigo-300/80 dark:hover:bg-indigo-900/80"
        if (event === "Indorance") return "bg-sky-200/80 dark:bg-sky-900/60 hover:bg-sky-300/80 dark:hover:bg-sky-900/80"
        if (event === "Endurance Edition" || event === "Global Edition") return "bg-rose-200/80 dark:bg-rose-900/60 hover:bg-rose-300/80 dark:hover:bg-rose-900/80"
        if (event.startsWith("LMU Championship")) return "bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-300/80 dark:hover:bg-amber-900/80"
        if (event === "LMU Solo Endurance") return "bg-pink-300/80 dark:bg-pink-800/60 hover:bg-pink-400/80 dark:hover:bg-pink-800/80"
        return "bg-white dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-900"
    }

    const getAdminEventStyle = (event) => {
        if (!event) return "font-bold"
        let style = "font-bold "
        if (event.startsWith("MX-5 Cup Asia")) style += "text-red-500"
        else if (event.startsWith("1 Hour Series")) style += "text-emerald-500"
        else if (event === "Open Wheel Series") style += "text-cyan-500"
        else if (event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open") || event.startsWith("Asri Motor Slalom Cup")) style += "text-yellow-500"
        else if (event === "Endurance Championship") style += "text-pink-500"
        else if (event === "Masters League" || event === "Praga Cup") style += "text-blue-500"
        else if (event === "Juniors") style += "text-lime-500"
        else if (event === "B.E.G.O. Balap Cup") style += "text-orange-500"
        else if (event === "Sprint Rally Challenge" || event === "Rally Championship") style += "text-purple-500"
        else if (event.startsWith("Speedway Master Series")) style += "text-fuchsia-500"
        else if (event === "Javahosting Rental Cup") style += "text-indigo-500"
        else if (event === "Indorance") style += "text-sky-500"
        else if (event === "Endurance Edition" || event === "Global Edition") style += "text-rose-500"
        else if (event.startsWith("LMU Championship")) style += "text-amber-500"
        else if (event === "LMU Solo Endurance") style += "text-pink-800"
        return style
    }

    const getAdminOrganizerStyle = (organizer) => {
        let style = "px-1.5 py-0.5 font-bold rounded text-xs shrink-0 "
        if (organizer === "ACI") style += "bg-red-500 text-white"
        else if (organizer === "97SRC") style += "bg-white text-black border border-gray-300"
        else if (organizer === "CRC") style += "bg-yellow-500 text-black"
        else if (organizer === "BRM") style += "bg-sky-500 text-black"
        else if (organizer === "JRC") style += "bg-indigo-500 text-black"
        else if (organizer === "ERGP") style += "bg-white text-red-600 border border-gray-300"
        else if (organizer === "SRC") style += "bg-blue-500 text-white"
        else if (organizer === "ISL") style += "bg-pink-800 text-white"
        else style += "bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-200"
        return style
    }

    const getAdminGameStyle = (game) => {
        let style = "px-1.5 py-0.5 font-bold rounded text-xs shrink-0 "
        if (game === "AC") style += "bg-red-500 text-white"
        else if (game === "ACC") style += "bg-white text-red-600 border border-gray-300"
        else if (game === "RBR") style += "bg-black text-white"
        else if (game === "LMU") style += "bg-amber-500 text-black"
        else style += "bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-200"
        return style
    }

    const formatDateForInput = (dateStr) => {
        if (!dateStr) return ""
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return ""
        const pad = (n) => String(n).padStart(2, "0")
        const year = d.getFullYear()
        const month = pad(d.getMonth() + 1)
        const day = pad(d.getDate())
        const hours = pad(d.getHours())
        const minutes = pad(d.getMinutes())
        return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    const openCreateModal = () => {
        scheduleModalMode.value = "create"
        editingScheduleId.value = null
        scheduleFormData.event_id = eventsList.value.length ? eventsList.value[0].id : ""
        scheduleFormData.round = ""
        scheduleFormData.season = ""
        scheduleFormData.date = formatDateForInput(new Date())
        scheduleFormData.finish_date = formatDateForInput(new Date(Date.now() + 2 * 3600 * 1000))
        scheduleFormData.circuit = ""
        scheduleFormData.country = ""
        scheduleFormData.country_2 = ""
        scheduleFormData.stream_link = ""
        scheduleFormData.is_postponed = false
        scheduleAdminPassword.value = ""
        scheduleAdminPasswordError.value = ""
        showScheduleAdminPassword.value = false
        isScheduleModalOpen.value = true
    }

    const openEditModal = (scheduleItem) => {
        scheduleModalMode.value = "edit"
        editingScheduleId.value = scheduleItem.id
        deletingScheduleItem.value = scheduleItem
        scheduleFormData.event_id = scheduleItem.event_id || ""
        scheduleFormData.round = scheduleItem.round || ""
        scheduleFormData.season = scheduleItem.season || ""
        scheduleFormData.date = formatDateForInput(scheduleItem.date)
        scheduleFormData.finish_date = formatDateForInput(scheduleItem.finish_date)
        scheduleFormData.circuit = scheduleItem.circuit || ""
        scheduleFormData.country = scheduleItem.country || ""
        scheduleFormData.country_2 = scheduleItem.country_2 || ""
        scheduleFormData.stream_link = scheduleItem.stream_link || ""
        scheduleFormData.is_postponed = Boolean(scheduleItem.is_postponed)
        scheduleAdminPassword.value = ""
        scheduleAdminPasswordError.value = ""
        showScheduleAdminPassword.value = false
        isScheduleModalOpen.value = true
    }

    const handleJsonFileUpload = (e, field = 'results') => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result)
                scheduleFormData[field] = JSON.stringify(parsed, null, 2)
                showToast("File JSON berhasil dimuat!")
            } catch (err) {
                showToast("Format file JSON tidak valid!", "error")
            }
        }
        reader.readAsText(file)
    }

    const closeScheduleModal = () => {
        isScheduleModalOpen.value = false
        scheduleAdminPassword.value = ""
        scheduleAdminPasswordError.value = ""
        showScheduleAdminPassword.value = false
    }

    const saveSchedule = async () => {
        scheduleAdminPasswordError.value = ""
        if (!scheduleFormData.event_id) {
            showToast("Pilih event terlebih dahulu", "error")
            return
        }
        if (!scheduleFormData.date) {
            showToast("Pilih tanggal balapan", "error")
            return
        }
        if (scheduleAdminPassword.value !== CRUD_PASS) {
            scheduleAdminPasswordError.value = "Password admin salah!"
            return
        }

        saving.value = true
        try {
            const payload = {
                event_id: scheduleFormData.event_id,
                round: scheduleFormData.round,
                season: scheduleFormData.season ? Number(scheduleFormData.season) || scheduleFormData.season : null,
                date: new Date(scheduleFormData.date).toISOString(),
                finish_date: scheduleFormData.finish_date ? new Date(scheduleFormData.finish_date).toISOString() : new Date(scheduleFormData.date).toISOString(),
                circuit: scheduleFormData.circuit,
                country: scheduleFormData.country,
                country_2: scheduleFormData.country_2 || null,
                stream_link: scheduleFormData.stream_link || null,
                is_postponed: scheduleFormData.is_postponed
            }

            if (scheduleModalMode.value === "edit") {
                const { error } = await $supabase
                    .from("schedule")
                    .update(payload)
                    .eq("id", editingScheduleId.value)
                if (error) throw error
                showToast("Jadwal balapan berhasil diperbarui!")
            } else {
                const { error } = await $supabase
                    .from("schedule")
                    .insert(payload)
                if (error) throw error
                showToast("Jadwal balapan baru berhasil ditambahkan!")
            }

            closeScheduleModal()
            await fetchSchedules()
        } catch (err) {
            console.error("Error saving schedule:", err)
            showToast(err.message || "Gagal menyimpan jadwal balapan", "error")
        } finally {
            saving.value = false
        }
    }

    const openScheduleDeleteModal = (item) => {
        deletingScheduleItem.value = item || schedules.value.find(s => s.id === editingScheduleId.value)
        scheduleDeletePassword.value = ""
        scheduleDeletePasswordError.value = ""
        showScheduleDeletePassword.value = false
        isScheduleDeleteModalOpen.value = true
    }

    const closeScheduleDeleteModal = () => {
        isScheduleDeleteModalOpen.value = false
        deletingScheduleItem.value = null
        scheduleDeletePassword.value = ""
        scheduleDeletePasswordError.value = ""
        showScheduleDeletePassword.value = false
    }

    const confirmDeleteSchedule = async () => {
        if (!deletingScheduleItem.value) return
        scheduleDeletePasswordError.value = ""
        if (scheduleDeletePassword.value !== CRUD_PASS) {
            scheduleDeletePasswordError.value = "Password admin salah!"
            return
        }
        deleting.value = true
        try {
            const { error } = await $supabase
                .from("schedule")
                .delete()
                .eq("id", deletingScheduleItem.value.id)
            if (error) throw error

            showToast("Jadwal balapan berhasil dihapus!")
            closeScheduleDeleteModal()
            closeScheduleModal()
            await fetchSchedules()
        } catch (err) {
            console.error("Error deleting schedule:", err)
            showToast(err.message || "Gagal menghapus jadwal balapan", "error")
        } finally {
            deleting.value = false
        }
    }

    // ==========================================
    // DRIVERS STATE & METHODS
    // ==========================================
    const drivers = ref([])
    const countriesList = ref([])
    const teamsList = ref([])
    const organizersList = ref([])
    const driverSearchQuery = ref("")
    const driverRatingFilter = ref("all") // 'all' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Copper' | 'Iron'

    const isDriverModalOpen = ref(false)
    const driverModalMode = ref("edit") // 'edit' | 'create'
    const editingDriverId = ref(null)
    const deletingDriverItem = ref(null)
    const isDriverDeleteModalOpen = ref(false)

    const driverAdminPassword = ref("")
    const driverAdminPasswordError = ref("")
    const showDriverAdminPassword = ref(false)
    const driverDeletePassword = ref("")
    const driverDeletePasswordError = ref("")
    const showDriverDeletePassword = ref(false)

    const ratingOptions = ["Platinum", "Gold", "Silver", "Bronze", "Copper", "Iron"]
    const ratingsOrder = {
        "Platinum": 1,
        "Gold": 2,
        "Silver": 3,
        "Bronze": 4,
        "Copper": 5,
        "Iron": 6
    }
    const driverSortBy = ref("rating") // 'name' | 'team' | 'rating'
    const driverSortOrder = ref("asc") // 'asc' | 'desc'

    const handleDriverSort = (field) => {
        if (driverSortBy.value === field) {
            driverSortOrder.value = driverSortOrder.value === "asc" ? "desc" : "asc"
        } else {
            driverSortBy.value = field
            driverSortOrder.value = "asc"
        }
        driverCurrentPage.value = 1
    }

    const driverFormData = reactive({
        name: "",
        country: "",
        team: "",
        organizer: "",
        rating: ""
    })

    const getRatingStyle = (rating) => {
        if (rating === "Platinum") return "bg-slate-700 text-white font-bold"
        if (rating === "Gold") return "bg-yellow-500 text-black font-bold"
        if (rating === "Silver") return "bg-zinc-500 text-white font-bold"
        if (rating === "Bronze") return "bg-amber-700 text-white font-bold"
        if (rating === "Copper") return "bg-red-700 text-white font-bold"
        if (rating === "Iron") return "bg-black text-white font-bold"
        return "bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-200"
    }

    const fetchDrivers = async () => {
        loading.value = true
        errorMsg.value = ""
        try {
            const batchSize = 1000
            let allDrivers = []
            let start = 0
            let hasMore = true

            while (hasMore) {
                const { data, error } = await $supabase
                    .from("drivers")
                    .select(`
                        id,
                        name,
                        rating,
                        country,
                        team,
                        organizer,
                        countries (
                            id,
                            name,
                            code
                        ),
                        teams (
                            id,
                            name
                        ),
                        organizers (
                            id,
                            abbreviation,
                            name
                        )
                    `)
                    .range(start, start + batchSize - 1)
                    .order("rating", { ascending: true })
                    .order("name", { ascending: true })

                if (error) throw error

                if (data && data.length > 0) {
                    allDrivers = [...allDrivers, ...data]
                    start += batchSize
                    hasMore = data.length === batchSize
                } else {
                    hasMore = false
                }
            }

            drivers.value = allDrivers
        } catch (err) {
            console.error("Error fetching drivers:", err)
            errorMsg.value = err.message || "Gagal mengambil data pembalap."
        } finally {
            loading.value = false
        }
    }

    const fetchLookupData = async () => {
        try {
            const [countriesRes, teamsRes, organizersRes] = await Promise.all([
                $supabase.from("countries").select("id, name, code").order("name"),
                $supabase.from("teams").select("id, name").order("name"),
                $supabase.from("organizers").select("id, name, abbreviation").order("name")
            ])
            if (countriesRes.data) countriesList.value = countriesRes.data
            if (teamsRes.data) teamsList.value = teamsRes.data
            if (organizersRes.data) organizersList.value = organizersRes.data
        } catch (err) {
            console.error("Error fetching lookup data:", err)
        }
    }

    const filteredDrivers = computed(() => {
        let list = [...drivers.value]
        if (driverRatingFilter.value !== "all") {
            list = list.filter(d => d.rating === driverRatingFilter.value)
        }
        if (driverSearchQuery.value.trim()) {
            const q = driverSearchQuery.value.toLowerCase()
            list = list.filter(item => {
                const name = item.name?.toLowerCase() || ""
                const teamName = item.teams?.name?.toLowerCase() || ""
                const countryName = item.countries?.name?.toLowerCase() || ""
                return name.includes(q) || teamName.includes(q) || countryName.includes(q)
            })
        }

        return list.sort((a, b) => {
            let res = 0
            if (driverSortBy.value === "name") {
                res = (a.name || "").localeCompare(b.name || "")
            } else if (driverSortBy.value === "team") {
                const teamA = a.teams?.name || ""
                const teamB = b.teams?.name || ""
                res = teamA.localeCompare(teamB)
                if (res === 0) {
                    res = (a.name || "").localeCompare(b.name || "")
                }
            } else if (driverSortBy.value === "rating") {
                const rA = ratingsOrder[a.rating] || 99
                const rB = ratingsOrder[b.rating] || 99
                res = rA - rB
                if (res === 0) {
                    res = (a.name || "").localeCompare(b.name || "")
                }
            }
            return driverSortOrder.value === "asc" ? res : -res
        })
    })

    const driverCurrentPage = ref(1)
    const driverItemsPerPage = ref(20)

    const driverTotalPages = computed(() => {
        return Math.max(1, Math.ceil(filteredDrivers.value.length / driverItemsPerPage.value))
    })

    const paginatedDrivers = computed(() => {
        const start = (driverCurrentPage.value - 1) * driverItemsPerPage.value
        return filteredDrivers.value.slice(start, start + driverItemsPerPage.value)
    })

    watch([driverSearchQuery, driverRatingFilter, driverSortBy, driverSortOrder, driverItemsPerPage], () => {
        driverCurrentPage.value = 1
    })

    const { exportDriversToExcel, downloadDriverTemplate, parseDriversFromExcel } = useExportDriversExcel()
    const handleExportAdminDrivers = () => {
        exportDriversToExcel(filteredDrivers.value, "Admin_Database_Pembalap_IDSimRacing.xlsx")
    }

    const isDriverImportModalOpen = ref(false)
    const driverImportFile = ref(null)
    const driverImportLoading = ref(false)
    const driverImportData = ref([])
    const driverImportError = ref("")
    const driverImportAdminPassword = ref("")
    const driverImportAdminPasswordError = ref("")
    const showDriverImportAdminPassword = ref(false)
    const driverFileInputRef = ref(null)

    const openDriverImportModal = () => {
        driverImportFile.value = null
        driverImportData.value = []
        driverImportError.value = ""
        driverImportAdminPassword.value = ""
        driverImportAdminPasswordError.value = ""
        showDriverImportAdminPassword.value = false
        isDriverImportModalOpen.value = true
    }

    const closeDriverImportModal = () => {
        isDriverImportModalOpen.value = false
        driverImportFile.value = null
        driverImportData.value = []
        driverImportError.value = ""
        driverImportAdminPassword.value = ""
        driverImportAdminPasswordError.value = ""
        showDriverImportAdminPassword.value = false
    }

    const handleDriverFileSelect = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        driverImportFile.value = file
        driverImportError.value = ""
        driverImportLoading.value = true
        try {
            const parsed = await parseDriversFromExcel(file)
            if (parsed.length === 0) {
                driverImportError.value = "Tidak ada data pembalap yang valid ditemukan dalam file Excel."
                driverImportData.value = []
            } else {
                driverImportData.value = parsed
            }
        } catch (err) {
            console.error("Error parsing driver Excel:", err)
            driverImportError.value = "Gagal membaca file Excel. Pastikan format kolom sesuai template."
        } finally {
            driverImportLoading.value = false
        }
    }

    const isExistingDriver = (driverName) => {
        if (!driverName) return false
        return drivers.value.some(d => d.name.trim().toLowerCase() === driverName.trim().toLowerCase())
    }

    const confirmImportDrivers = async () => {
        driverImportAdminPasswordError.value = ""
        if (driverImportData.value.length === 0) {
            showToast("Pilih file Excel yang memiliki data pembalap", "error")
            return
        }
        if (driverImportAdminPassword.value !== CRUD_PASS) {
            driverImportAdminPasswordError.value = "Password admin salah!"
            return
        }

        driverImportLoading.value = true
        try {
            await fetchLookupData()

            // 1. Collect and insert new teams
            const existingTeamsMap = new Map()
            teamsList.value.forEach(t => existingTeamsMap.set(t.name.trim().toLowerCase(), t.id))

            const newTeamNames = new Set()
            driverImportData.value.forEach(d => {
                const tName = (d.team || "Independent").trim()
                if (tName && !existingTeamsMap.has(tName.toLowerCase())) {
                    newTeamNames.add(tName)
                }
            })

            if (newTeamNames.size > 0) {
                const teamsToInsert = Array.from(newTeamNames).map(name => ({ name }))
                const { data: insertedTeams, error: teamInsertError } = await $supabase
                    .from("teams")
                    .insert(teamsToInsert)
                    .select("id, name")
                
                if (teamInsertError) throw teamInsertError
                if (insertedTeams) {
                    insertedTeams.forEach(t => existingTeamsMap.set(t.name.trim().toLowerCase(), t.id))
                }
            }

            // 2. Resolve country IDs
            const defaultCountry = countriesList.value.find(c => c.name.toLowerCase() === "indonesia" || c.code.toLowerCase() === "id") || countriesList.value[0]
            const getCountryId = (countryStr) => {
                if (!countryStr) return defaultCountry.id
                const q = countryStr.trim().toLowerCase()
                const found = countriesList.value.find(c => c.name.toLowerCase() === q || c.code.toLowerCase() === q)
                return found ? found.id : defaultCountry.id
            }

            // 3. Resolve default organizer
            const defaultOrg = organizersList.value.find(o => o.abbreviation === "CRC") || organizersList.value[0]

            // 4. Map drivers for insert and update
            const existingDriversMap = new Map()
            drivers.value.forEach(d => existingDriversMap.set(d.name.trim().toLowerCase(), d.id))

            const driversToInsert = []
            const driversToUpdate = []

            for (const item of driverImportData.value) {
                const teamNameLower = (item.team || "Independent").trim().toLowerCase()
                const teamId = existingTeamsMap.get(teamNameLower) || teamsList.value[0]?.id
                const countryId = getCountryId(item.country)
                const existingId = existingDriversMap.get(item.name.trim().toLowerCase())

                const payload = {
                    name: item.name.trim(),
                    country: countryId,
                    team: teamId,
                    organizer: defaultOrg?.id,
                    rating: item.rating || "Silver"
                }

                if (existingId) {
                    driversToUpdate.push({ id: existingId, ...payload })
                } else {
                    driversToInsert.push(payload)
                }
            }

            // Batch update existing
            for (const d of driversToUpdate) {
                const { id, ...data } = d
                await $supabase.from("drivers").update(data).eq("id", id)
            }

            // Batch insert new
            if (driversToInsert.length > 0) {
                const { error: insertError } = await $supabase.from("drivers").insert(driversToInsert)
                if (insertError) throw insertError
            }

            showToast(`Berhasil mengimpor ${driverImportData.value.length} data pembalap (${driversToInsert.length} baru, ${driversToUpdate.length} diperbarui)!`)
            closeDriverImportModal()
            await fetchDrivers()
            await fetchLookupData()
        } catch (err) {
            console.error("Error importing drivers:", err)
            showToast(err.message || "Gagal mengimpor data pembalap", "error")
        } finally {
            driverImportLoading.value = false
        }
    }

    const openCreateDriverModal = () => {
        driverModalMode.value = "create"
        editingDriverId.value = null
        driverFormData.name = ""
        driverFormData.country = ""
        driverFormData.team = ""
        const crcOrg = organizersList.value.find(o => o.abbreviation === "CRC")
        driverFormData.organizer = crcOrg ? crcOrg.id : (organizersList.value[0]?.id || "")
        driverFormData.rating = ""
        driverAdminPassword.value = ""
        driverAdminPasswordError.value = ""
        showDriverAdminPassword.value = false
        isDriverModalOpen.value = true
    }

    const openEditDriverModal = (driverItem) => {
        driverModalMode.value = "edit"
        editingDriverId.value = driverItem.id
        deletingDriverItem.value = driverItem
        driverFormData.name = driverItem.name || ""
        driverFormData.country = driverItem.country || driverItem.countries?.id || ""
        driverFormData.team = driverItem.team || driverItem.teams?.id || ""
        driverFormData.organizer = driverItem.organizer || driverItem.organizers?.id || ""
        driverFormData.rating = driverItem.rating || ""
        driverAdminPassword.value = ""
        driverAdminPasswordError.value = ""
        showDriverAdminPassword.value = false
        isDriverModalOpen.value = true
    }

    const closeDriverModal = () => {
        isDriverModalOpen.value = false
        driverAdminPassword.value = ""
        driverAdminPasswordError.value = ""
        showDriverAdminPassword.value = false
    }

    const saveDriver = async () => {
        driverAdminPasswordError.value = ""
        if (!driverFormData.name.trim()) {
            showToast("Masukkan nama pembalap", "error")
            return
        }
        if (driverAdminPassword.value !== CRUD_PASS) {
            driverAdminPasswordError.value = "Password admin salah!"
            return
        }

        saving.value = true
        try {
            const payload = {
                name: driverFormData.name.trim(),
                country: driverFormData.country || null,
                team: driverFormData.team ? Number(driverFormData.team) : null,
                organizer: driverFormData.organizer || (organizersList.value.find(o => o.abbreviation === "CRC")?.id || organizersList.value[0]?.id || null),
                rating: driverFormData.rating || null
            }

            if (driverModalMode.value === "edit") {
                const { error } = await $supabase
                    .from("drivers")
                    .update(payload)
                    .eq("id", editingDriverId.value)
                if (error) throw error
                showToast("Data pembalap berhasil diperbarui!")
            } else {
                const { error } = await $supabase
                    .from("drivers")
                    .insert(payload)
                if (error) throw error
                showToast("Pembalap baru berhasil ditambahkan!")
            }

            closeDriverModal()
            await fetchDrivers()
        } catch (err) {
            console.error("Error saving driver:", err)
            showToast(err.message || "Gagal menyimpan data pembalap", "error")
        } finally {
            saving.value = false
        }
    }

    const openDriverDeleteModal = (item) => {
        deletingDriverItem.value = item || drivers.value.find(d => d.id === editingDriverId.value)
        driverDeletePassword.value = ""
        driverDeletePasswordError.value = ""
        showDriverDeletePassword.value = false
        isDriverDeleteModalOpen.value = true
    }

    const closeDriverDeleteModal = () => {
        isDriverDeleteModalOpen.value = false
        deletingDriverItem.value = null
        driverDeletePassword.value = ""
        driverDeletePasswordError.value = ""
        showDriverDeletePassword.value = false
    }

    const confirmDeleteDriver = async () => {
        if (!deletingDriverItem.value) return
        driverDeletePasswordError.value = ""
        if (driverDeletePassword.value !== CRUD_PASS) {
            driverDeletePasswordError.value = "Password admin salah!"
            return
        }
        deleting.value = true
        try {
            const { error } = await $supabase
                .from("drivers")
                .delete()
                .eq("id", deletingDriverItem.value.id)
            if (error) throw error

            showToast("Pembalap berhasil dihapus!")
            closeDriverDeleteModal()
            closeDriverModal()
            await fetchDrivers()
        } catch (err) {
            console.error("Error deleting driver:", err)
            showToast(err.message || "Gagal menghapus pembalap", "error")
        } finally {
            deleting.value = false
        }
    }

    // ==========================================
    // TEAMS STATE & METHODS
    // ==========================================
    const teams = ref([])
    const teamSearchQuery = ref("")

    const isTeamModalOpen = ref(false)
    const teamModalMode = ref("edit") // 'edit' | 'create'
    const editingTeamId = ref(null)
    const deletingTeamItem = ref(null)
    const isTeamDeleteModalOpen = ref(false)

    const teamAdminPassword = ref("")
    const teamAdminPasswordError = ref("")
    const showTeamAdminPassword = ref(false)
    const teamDeletePassword = ref("")
    const teamDeletePasswordError = ref("")
    const showTeamDeletePassword = ref(false)

    const teamFormData = reactive({
        name: ""
    })

    const fetchTeams = async () => {
        loading.value = true
        errorMsg.value = ""
        try {
            const { data, error } = await $supabase
                .from("teams")
                .select(`
                    id,
                    name,
                    created_at
                `)
                .order("name", { ascending: true })

            if (error) throw error
            teams.value = data || []
        } catch (err) {
            console.error("Error fetching teams:", err)
            errorMsg.value = err.message || "Gagal mengambil data tim."
        } finally {
            loading.value = false
        }
    }

    const filteredTeams = computed(() => {
        if (!teamSearchQuery.value.trim()) return teams.value
        const q = teamSearchQuery.value.toLowerCase()
        return teams.value.filter(item => {
            const name = item.name?.toLowerCase() || ""
            return name.includes(q)
        })
    })

    const teamCurrentPage = ref(1)
    const teamItemsPerPage = ref(20)

    const teamTotalPages = computed(() => {
        return Math.max(1, Math.ceil(filteredTeams.value.length / teamItemsPerPage.value))
    })

    const paginatedTeams = computed(() => {
        const start = (teamCurrentPage.value - 1) * teamItemsPerPage.value
        return filteredTeams.value.slice(start, start + teamItemsPerPage.value)
    })

    watch([teamSearchQuery, teamItemsPerPage], () => {
        teamCurrentPage.value = 1
    })

    const getDriverCountForTeam = (teamId) => {
        return drivers.value.filter(d => d.team === teamId || d.teams?.id === teamId).length
    }

    const openCreateTeamModal = () => {
        teamModalMode.value = "create"
        editingTeamId.value = null
        teamFormData.name = ""
        teamAdminPassword.value = ""
        teamAdminPasswordError.value = ""
        showTeamAdminPassword.value = false
        isTeamModalOpen.value = true
    }

    const openEditTeamModal = (teamItem) => {
        teamModalMode.value = "edit"
        editingTeamId.value = teamItem.id
        deletingTeamItem.value = teamItem
        teamFormData.name = teamItem.name || ""
        teamAdminPassword.value = ""
        teamAdminPasswordError.value = ""
        showTeamAdminPassword.value = false
        isTeamModalOpen.value = true
    }

    const closeTeamModal = () => {
        isTeamModalOpen.value = false
        teamAdminPassword.value = ""
        teamAdminPasswordError.value = ""
        showTeamAdminPassword.value = false
    }

    const saveTeam = async () => {
        teamAdminPasswordError.value = ""
        if (!teamFormData.name.trim()) {
            showToast("Masukkan nama tim", "error")
            return
        }
        if (teamAdminPassword.value !== CRUD_PASS) {
            teamAdminPasswordError.value = "Password admin salah!"
            return
        }

        saving.value = true
        try {
            const payload = {
                name: teamFormData.name.trim()
            }

            if (teamModalMode.value === "edit") {
                const { error } = await $supabase
                    .from("teams")
                    .update(payload)
                    .eq("id", editingTeamId.value)
                if (error) throw error
                showToast("Data tim berhasil diperbarui!")
            } else {
                const { error } = await $supabase
                    .from("teams")
                    .insert(payload)
                if (error) throw error
                showToast("Tim baru berhasil ditambahkan!")
            }

            closeTeamModal()
            await fetchTeams()
            await fetchLookupData()
        } catch (err) {
            console.error("Error saving team:", err)
            showToast(err.message || "Gagal menyimpan data tim", "error")
        } finally {
            saving.value = false
        }
    }

    const openTeamDeleteModal = (item) => {
        deletingTeamItem.value = item || teams.value.find(t => t.id === editingTeamId.value)
        teamDeletePassword.value = ""
        teamDeletePasswordError.value = ""
        showTeamDeletePassword.value = false
        isTeamDeleteModalOpen.value = true
    }

    const closeTeamDeleteModal = () => {
        isTeamDeleteModalOpen.value = false
        deletingTeamItem.value = null
        teamDeletePassword.value = ""
        teamDeletePasswordError.value = ""
        showTeamDeletePassword.value = false
    }

    const confirmDeleteTeam = async () => {
        if (!deletingTeamItem.value) return
        teamDeletePasswordError.value = ""
        if (teamDeletePassword.value !== CRUD_PASS) {
            teamDeletePasswordError.value = "Password admin salah!"
            return
        }
        deleting.value = true
        try {
            const { error } = await $supabase
                .from("teams")
                .delete()
                .eq("id", deletingTeamItem.value.id)
            if (error) throw error

            showToast("Tim berhasil dihapus!")
            closeTeamDeleteModal()
            closeTeamModal()
            await fetchTeams()
            await fetchLookupData()
        } catch (err) {
            console.error("Error deleting team:", err)
            const isFkErr = err.message?.includes("foreign key") || err.message?.includes("violates")
            showToast(isFkErr ? "Gagal menghapus: Tim masih memiliki pembalap terdaftar." : (err.message || "Gagal menghapus tim"), "error")
        } finally {
            deleting.value = false
        }
    }

    // ==========================================
    // RENTALS STATE & METHODS
    // ==========================================
    const rentals = ref([])
    const rentalSearchQuery = ref("")

    const isRentalModalOpen = ref(false)
    const rentalModalMode = ref("edit") // 'edit' | 'create'
    const editingRentalId = ref(null)
    const deletingRentalItem = ref(null)
    const isRentalDeleteModalOpen = ref(false)

    const rentalAdminPassword = ref("")
    const rentalAdminPasswordError = ref("")
    const showRentalAdminPassword = ref(false)
    const rentalDeletePassword = ref("")
    const rentalDeletePasswordError = ref("")
    const showRentalDeletePassword = ref(false)

    const rentalFormData = reactive({
        name: "",
        instagram: "",
        location: "",
        province: "",
        regency: "",
        show: true
    })

    const fetchRentals = async () => {
        loading.value = true
        errorMsg.value = ""
        try {
            const { data, error } = await $supabase
                .from("rentals")
                .select(`
                    id,
                    name,
                    location,
                    instagram,
                    province,
                    regency,
                    show
                `)
                .order("name", { ascending: true })

            if (error) throw error
            rentals.value = data || []
        } catch (err) {
            console.error("Error fetching rentals:", err)
            errorMsg.value = err.message || "Gagal mengambil data rental."
        } finally {
            loading.value = false
        }
    }

    const filteredRentals = computed(() => {
        if (!rentalSearchQuery.value.trim()) return rentals.value
        const q = rentalSearchQuery.value.toLowerCase()
        return rentals.value.filter(item => {
            const name = item.name?.toLowerCase() || ""
            const province = item.province?.toLowerCase() || ""
            const regency = item.regency?.toLowerCase() || ""
            return name.includes(q) || province.includes(q) || regency.includes(q)
        })
    })

    const rentalCurrentPage = ref(1)
    const rentalItemsPerPage = ref(20)

    const rentalTotalPages = computed(() => {
        return Math.max(1, Math.ceil(filteredRentals.value.length / rentalItemsPerPage.value))
    })

    const paginatedRentals = computed(() => {
        const start = (rentalCurrentPage.value - 1) * rentalItemsPerPage.value
        return filteredRentals.value.slice(start, start + rentalItemsPerPage.value)
    })

    watch([rentalSearchQuery, rentalItemsPerPage], () => {
        rentalCurrentPage.value = 1
    })

    const formatInstagramUrl = (input) => {
        if (!input) return ""
        let val = input.trim()
        if (!val) return ""
        if (val.startsWith("http://") || val.startsWith("https://")) {
            return val
        }
        val = val.replace(/^@/, "")
        return `https://www.instagram.com/${val}/`
    }

    const openCreateRentalModal = () => {
        rentalModalMode.value = "create"
        editingRentalId.value = null
        rentalFormData.name = ""
        rentalFormData.instagram = ""
        rentalFormData.location = ""
        rentalFormData.province = ""
        rentalFormData.regency = ""
        rentalFormData.show = true
        rentalAdminPassword.value = ""
        rentalAdminPasswordError.value = ""
        showRentalAdminPassword.value = false
        isRentalModalOpen.value = true
    }

    const openEditRentalModal = (rentalItem) => {
        rentalModalMode.value = "edit"
        editingRentalId.value = rentalItem.id
        deletingRentalItem.value = rentalItem
        rentalFormData.name = rentalItem.name || ""
        rentalFormData.instagram = rentalItem.instagram || ""
        rentalFormData.location = rentalItem.location || ""
        rentalFormData.province = rentalItem.province || ""
        rentalFormData.regency = rentalItem.regency || ""
        rentalFormData.show = rentalItem.show !== false
        rentalAdminPassword.value = ""
        rentalAdminPasswordError.value = ""
        showRentalAdminPassword.value = false
        isRentalModalOpen.value = true
    }

    const closeRentalModal = () => {
        isRentalModalOpen.value = false
        rentalAdminPassword.value = ""
        rentalAdminPasswordError.value = ""
        showRentalAdminPassword.value = false
    }

    const saveRental = async () => {
        rentalAdminPasswordError.value = ""
        if (!rentalFormData.name.trim()) {
            showToast("Masukkan nama rental", "error")
            return
        }
        if (rentalAdminPassword.value !== CRUD_PASS) {
            rentalAdminPasswordError.value = "Password admin salah!"
            return
        }

        saving.value = true
        try {
            const formattedIg = formatInstagramUrl(rentalFormData.instagram)
            const payload = {
                name: rentalFormData.name.trim(),
                instagram: formattedIg || null,
                location: rentalFormData.location.trim() || null,
                province: rentalFormData.province.trim() || "",
                regency: rentalFormData.regency.trim() || "",
                show: Boolean(rentalFormData.show)
            }

            if (rentalModalMode.value === "edit") {
                const { error } = await $supabase
                    .from("rentals")
                    .update(payload)
                    .eq("id", editingRentalId.value)
                if (error) throw error
                showToast("Data rental berhasil diperbarui!")
            } else {
                const { error } = await $supabase
                    .from("rentals")
                    .insert(payload)
                if (error) throw error
                showToast("Rental baru berhasil ditambahkan!")
            }

            closeRentalModal()
            await fetchRentals()
        } catch (err) {
            console.error("Error saving rental:", err)
            showToast(err.message || "Gagal menyimpan data rental", "error")
        } finally {
            saving.value = false
        }
    }

    const openRentalDeleteModal = (item) => {
        deletingRentalItem.value = item || rentals.value.find(r => r.id === editingRentalId.value)
        rentalDeletePassword.value = ""
        rentalDeletePasswordError.value = ""
        showRentalDeletePassword.value = false
        isRentalDeleteModalOpen.value = true
    }

    const closeRentalDeleteModal = () => {
        isRentalDeleteModalOpen.value = false
        deletingRentalItem.value = null
        rentalDeletePassword.value = ""
        rentalDeletePasswordError.value = ""
        showRentalDeletePassword.value = false
    }

    const confirmDeleteRental = async () => {
        if (!deletingRentalItem.value) return
        rentalDeletePasswordError.value = ""
        if (rentalDeletePassword.value !== CRUD_PASS) {
            rentalDeletePasswordError.value = "Password admin salah!"
            return
        }
        deleting.value = true
        try {
            const { error } = await $supabase
                .from("rentals")
                .delete()
                .eq("id", deletingRentalItem.value.id)
            if (error) throw error

            showToast("Rental berhasil dihapus!")
            closeRentalDeleteModal()
            closeRentalModal()
            await fetchRentals()
        } catch (err) {
            console.error("Error deleting rental:", err)
            showToast(err.message || "Gagal menghapus rental", "error")
        } finally {
            deleting.value = false
        }
    }

    // ==========================================
    // RACE RESULTS STATE & METHODS
    // ==========================================
    const allSchedulesList = ref([])
    const selectedScheduleId = ref("")
    const selectedSessionType = ref("race") // 'race' | 'race_1' | 'race_2' | 'qualifying'
    const resultsRows = ref([])
    const resultsScheduleSearch = ref("")
    const loadingResults = ref(false)
    const savingResults = ref(false)
    const hasExistingDbResults = ref(false)
    const isResultsProvisional = ref(false)
    const isTeamEvent = ref(false)

    const isResultsSaveModalOpen = ref(false)
    const resultsAdminPassword = ref("")
    const resultsAdminPasswordError = ref("")
    const showResultsAdminPassword = ref(false)

    const isResultsDeleteModalOpen = ref(false)
    const resultsDeletePassword = ref("")
    const resultsDeletePasswordError = ref("")
    const showResultsDeletePassword = ref(false)

    const resultStatusOptions = [
        { value: "finished", label: "Finished (FIN)", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
        { value: "dnf", label: "DNF (Did Not Finish)", badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
        { value: "dns", label: "DNS (Did Not Start)", badge: "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300" },
        { value: "dsq", label: "DSQ (Disqualified)", badge: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" }
    ]

    const sessionTypeOptions = [
        { value: "race", label: "Race" },
        { value: "race_1", label: "Race 1" },
        { value: "race_2", label: "Race 2" },
        { value: "qualifying", label: "Qualifying" }
    ]

    const fetchAllSchedulesList = async () => {
        try {
            const { data, error } = await $supabase
                .from("schedule")
                .select(`
                    id,
                    event_id,
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
                        id,
                        name,
                        games (
                            abbreviation,
                            name
                        ),
                        organizers (
                            abbreviation,
                            name
                        )
                    )
                `)
                .order("date", { ascending: false })

            if (error) throw error
            allSchedulesList.value = data || []
        } catch (err) {
            console.error("Error fetching all schedules list:", err)
        }
    }

    const selectedSchedule = computed(() => {
        return allSchedulesList.value.find(s => s.id === selectedScheduleId.value) || schedules.value.find(s => s.id === selectedScheduleId.value) || null
    })

    const filteredSchedulesForSelect = computed(() => {
        const list = allSchedulesList.value.length > 0 ? allSchedulesList.value : schedules.value
        if (!resultsScheduleSearch.value.trim()) return list
        const q = resultsScheduleSearch.value.trim().toLowerCase()
        const words = q.split(/\s+/).filter(Boolean)
        return list.filter(s => {
            const orgAbbr = s.events?.organizers?.abbreviation || ""
            const orgName = s.events?.organizers?.name || ""
            const evName = s.events?.name || ""
            const circuit = s.circuit || ""
            const round = String(s.round || "")
            const season = s.season ? `s${s.season} season ${s.season}` : ""
            const dateStr = s.date ? formatDateOnly(s.date) : ""
            const fullText = `${dateStr} ${orgAbbr} ${evName} ${orgName} ${season} round ${round} ${circuit}`.toLowerCase()
            return words.every(w => fullText.includes(w))
        })
    })

    const resultsClassFilter = ref("ALL")
    const selectedEntryClassId = ref("ALL")
    const seasonDriverClassesMap = ref(new Map()) // driver_id -> class_id

    const currentScheduleSeason = computed(() => {
        if (!selectedSchedule.value) return null
        if (selectedSchedule.value.season_id) {
            return seasonsList.value.find(s => s.id === selectedSchedule.value.season_id) || null
        }
        if (selectedSchedule.value.event_id && selectedSchedule.value.season) {
            return seasonsList.value.find(s =>
                s.event_id === selectedSchedule.value.event_id &&
                String(s.season_number) === String(selectedSchedule.value.season)
            ) || null
        }
        return null
    })

    const availableClassesForSchedule = computed(() => {
        if (!selectedSchedule.value?.event_id) return []
        return classesList.value.filter(c => c.event_id === selectedSchedule.value.event_id)
    })

    const getClassNameById = (classId) => {
        const cls = classesList.value.find(c => c.id === classId)
        return cls ? cls.name : "Overall"
    }

    const displayedResultsRows = computed(() => {
        if (selectedEntryClassId.value === "ALL") {
            return resultsRows.value
        }
        return resultsRows.value.filter(r => r.class_id === selectedEntryClassId.value)
    })

    const fetchSeasonDriverClasses = async () => {
        const seasonId = currentScheduleSeason.value?.id || selectedSchedule.value?.season_id
        if (!seasonId) {
            seasonDriverClassesMap.value = new Map()
            return
        }
        try {
            const { data, error } = await $supabase
                .from("season_driver_classes")
                .select("driver_id, class_id")
                .eq("season_id", seasonId)

            if (error) throw error
            const map = new Map()
            for (const row of data || []) {
                if (row.driver_id && row.class_id) {
                    map.set(row.driver_id, row.class_id)
                }
            }
            seasonDriverClassesMap.value = map
        } catch (err) {
            console.warn("Error fetching season_driver_classes:", err)
            seasonDriverClassesMap.value = new Map()
        }
    }

    const createEmptyResultRow = (pos = 1) => {
        const defaultClassId = selectedEntryClassId.value !== "ALL"
            ? selectedEntryClassId.value
            : (availableClassesForSchedule.value.length === 1 ? availableClassesForSchedule.value[0].id : "")

        return {
            _rowId: 'row_' + Math.random().toString(36).substring(2, 9),
            id: null,
            event_entry_id: null,
            position: pos,
            scoring_position: pos,
            class_id: defaultClassId,
            driver_id: "",
            co_driver_ids: [],
            team_id: "",
            car_number: null,
            car_model: "",
            status: "finished",
            grid_position: null,
            is_pole: false,
            num_laps: null,
            best_lap: "",
            best_lap_ms: null,
            total_time: "",
            total_time_ms: null,
            has_penalty: false,
            penalty_time_sec: null,
            fastest_lap: false,
            no_points: false
        }
    }

    const addResultRow = () => {
        const nextPos = displayedResultsRows.value.length + 1
        const newRow = createEmptyResultRow(nextPos)
        resultsRows.value.push(newRow)
        recalculateScoringPositions()
    }

    const addMultipleResultRows = (count = 5) => {
        for (let i = 0; i < count; i++) {
            const nextPos = displayedResultsRows.value.length + 1
            const newRow = createEmptyResultRow(nextPos)
            resultsRows.value.push(newRow)
        }
        recalculateScoringPositions()
    }

    const removeDisplayedRow = (row) => {
        const idx = resultsRows.value.indexOf(row)
        if (idx !== -1) {
            resultsRows.value.splice(idx, 1)
            recalculateScoringPositions()
        }
    }

    const removeResultRow = (index) => {
        resultsRows.value.splice(index, 1)
        reindexPositions()
    }

    const clearAllResultsRows = () => {
        if (selectedEntryClassId.value !== "ALL") {
            resultsRows.value = resultsRows.value.filter(r => r.class_id !== selectedEntryClassId.value)
        } else {
            resultsRows.value = []
        }
        recalculateScoringPositions()
    }

    const recalculateScoringPositions = () => {
        const classCounters = new Map()
        resultsRows.value.forEach((row, idx) => {
            row.position = idx + 1
            const key = row.class_id || "__overall__"
            const currentCount = (classCounters.get(key) || 0) + 1
            classCounters.set(key, currentCount)
            row.scoring_position = currentCount
        })
    }

    const reindexPositions = () => {
        recalculateScoringPositions()
    }

    const moveDisplayedRowUp = (displayedIdx) => {
        const list = displayedResultsRows.value
        if (displayedIdx <= 0) return
        const curr = list[displayedIdx]
        const prev = list[displayedIdx - 1]
        const idx1 = resultsRows.value.indexOf(curr)
        const idx2 = resultsRows.value.indexOf(prev)
        if (idx1 !== -1 && idx2 !== -1) {
            resultsRows.value[idx1] = prev
            resultsRows.value[idx2] = curr
            recalculateScoringPositions()
        }
    }

    const moveDisplayedRowDown = (displayedIdx) => {
        const list = displayedResultsRows.value
        if (displayedIdx >= list.length - 1) return
        const curr = list[displayedIdx]
        const next = list[displayedIdx + 1]
        const idx1 = resultsRows.value.indexOf(curr)
        const idx2 = resultsRows.value.indexOf(next)
        if (idx1 !== -1 && idx2 !== -1) {
            resultsRows.value[idx1] = next
            resultsRows.value[idx2] = curr
            recalculateScoringPositions()
        }
    }

    const moveRowUp = (index) => {
        if (index <= 0) return
        const temp = resultsRows.value[index]
        resultsRows.value[index] = resultsRows.value[index - 1]
        resultsRows.value[index - 1] = temp
        reindexPositions()
    }

    const moveRowDown = (index) => {
        if (index >= resultsRows.value.length - 1) return
        const temp = resultsRows.value[index]
        resultsRows.value[index] = resultsRows.value[index + 1]
        resultsRows.value[index + 1] = temp
        reindexPositions()
    }

    const activeDriverSearchRowIndex = ref(null)
    const driverDropdownSearchQuery = ref("")

    const openDriverDropdown = (idx) => {
        activeDriverSearchRowIndex.value = idx
        driverDropdownSearchQuery.value = ""
    }

    const closeDriverDropdown = () => {
        activeDriverSearchRowIndex.value = null
        driverDropdownSearchQuery.value = ""
    }

    const getDriverById = (id) => {
        if (!id) return null
        const strId = String(id).toLowerCase()
        return (drivers.value || []).find(d => String(d.id).toLowerCase() === strId) || null
    }

    const filteredDriversForDropdown = computed(() => {
        if (!driverDropdownSearchQuery.value.trim()) {
            return drivers.value.slice(0, 100)
        }
        const q = driverDropdownSearchQuery.value.trim().toLowerCase()
        return drivers.value.filter(d => {
            const nameMatch = d.name && d.name.toLowerCase().includes(q)
            const teamMatch = d.teams?.name && d.teams.name.toLowerCase().includes(q)
            const countryMatch = (d.countries?.name && d.countries.name.toLowerCase().includes(q)) || (d.countries?.code && d.countries.code.toLowerCase().includes(q))
            const ratingMatch = d.rating && d.rating.toLowerCase().includes(q)
            return nameMatch || teamMatch || countryMatch || ratingMatch
        }).slice(0, 100)
    })

    const selectDriverForRow = (row, driver) => {
        row.driver_id = driver ? driver.id : ""
        onDriverSelected(row)
        closeDriverDropdown()
    }

    const activeCoDriverSearchIndex = ref(null) // { rowIdx, coIdx }

    const openCoDriverDropdown = (rowIdx, coIdx) => {
        activeCoDriverSearchIndex.value = { rowIdx, coIdx }
        driverDropdownSearchQuery.value = ""
    }

    const closeCoDriverDropdown = () => {
        activeCoDriverSearchIndex.value = null
        driverDropdownSearchQuery.value = ""
    }

    const selectCoDriverForRow = (row, coIdx, driver) => {
        if (!row.co_driver_ids) row.co_driver_ids = []
        if (driver) {
            row.co_driver_ids[coIdx] = driver.id
            if (!row.team_id && driver.team) {
                row.team_id = driver.team
            }
        } else {
            row.co_driver_ids.splice(coIdx, 1)
        }
        closeCoDriverDropdown()
    }

    const addCoDriverToRow = (row) => {
        if (!row.co_driver_ids) row.co_driver_ids = []
        row.co_driver_ids.push("")
        const coIdx = row.co_driver_ids.length - 1
        const rowIdx = displayedResultsRows.value.indexOf(row)
        if (rowIdx !== -1) {
            openCoDriverDropdown(rowIdx, coIdx)
        }
    }

    const removeCoDriverFromRow = (row, coIdx) => {
        if (!row.co_driver_ids) return
        row.co_driver_ids.splice(coIdx, 1)
        if (activeCoDriverSearchIndex.value?.coIdx === coIdx) {
            closeCoDriverDropdown()
        }
    }

    const activeTeamSearchRowIndex = ref(null)
    const teamDropdownSearchQuery = ref("")

    const openTeamDropdown = (idx) => {
        activeTeamSearchRowIndex.value = idx
        teamDropdownSearchQuery.value = ""
    }

    const closeTeamDropdown = () => {
        activeTeamSearchRowIndex.value = null
        teamDropdownSearchQuery.value = ""
    }

    const getTeamById = (id) => {
        if (!id) return null
        return teamsList.value.find(t => t.id === id || String(t.id) === String(id)) || null
    }

    const filteredTeamsForDropdown = computed(() => {
        if (!teamDropdownSearchQuery.value.trim()) {
            return teamsList.value.slice(0, 100)
        }
        const q = teamDropdownSearchQuery.value.trim().toLowerCase()
        return teamsList.value.filter(t => {
            return t.name && t.name.toLowerCase().includes(q)
        }).slice(0, 100)
    })

    const selectTeamForRow = (row, team) => {
        row.team_id = team ? team.id : ""
        if (selectedEntryClassId.value !== "ALL") {
            row.class_id = selectedEntryClassId.value
        } else if (!row.class_id && availableClassesForSchedule.value.length === 1) {
            row.class_id = availableClassesForSchedule.value[0].id
        }
        recalculateScoringPositions()
        closeTeamDropdown()
    }

    const onDriverSelected = (row) => {
        if (!row.driver_id) return
        const d = drivers.value.find(drv => drv.id === row.driver_id)
        if (d && d.team) {
            row.team_id = d.team
        }
        if (selectedEntryClassId.value !== "ALL") {
            row.class_id = selectedEntryClassId.value
        } else if (seasonDriverClassesMap.value.has(row.driver_id)) {
            row.class_id = seasonDriverClassesMap.value.get(row.driver_id)
        } else if (!row.class_id && availableClassesForSchedule.value.length === 1) {
            row.class_id = availableClassesForSchedule.value[0].id
        }
        recalculateScoringPositions()
    }

    const onClassSelected = (row) => {
        recalculateScoringPositions()
    }

    const poleDriverIds = ref({})
    const fastestLapDriverIds = ref({})
    const fastestLapTimes = ref({})

    const getRowUniqueId = (row) => {
        if (!row) return ""
        if (!row._rowId) {
            row._rowId = 'row_' + Math.random().toString(36).substring(2, 9)
        }
        return row._rowId
    }

    const getTeamRowEntryKey = (row) => {
        if (!row || !row.team_id) return ""
        const carNum = (row.car_number !== null && row.car_number !== undefined && row.car_number !== '') ? String(row.car_number).trim() : ''
        return carNum ? `${row.team_id}#${carNum}` : getRowUniqueId(row)
    }

    const isRowMatchTeamEntity = (row, targetId) => {
        if (!row || !row.team_id || !targetId) return false
        const strTarget = String(targetId).trim()
        const currentKey = getTeamRowEntryKey(row)
        if (currentKey.toLowerCase() === strTarget.toLowerCase()) return true
        if (row._rowId && row._rowId.toLowerCase() === strTarget.toLowerCase()) return true

        if (strTarget.includes('#')) {
            const [tId, cNum] = strTarget.split('#')
            const rowCarNum = (row.car_number !== null && row.car_number !== undefined && row.car_number !== '') ? String(row.car_number).trim() : ''
            if (String(row.team_id) === tId && rowCarNum === cNum) {
                return true
            }
        } else {
            if (String(row.team_id).toLowerCase() === strTarget.toLowerCase()) {
                return true
            }
        }
        return false
    }

    const getDriverDisplayName = (driverOrTeamId) => {
        if (!driverOrTeamId) return ""
        if (isTeamEvent.value) {
            let teamId = driverOrTeamId
            let carNum = null

            if (typeof driverOrTeamId === 'string' && driverOrTeamId.includes('#')) {
                const parts = driverOrTeamId.split('#')
                teamId = parts[0]
                carNum = parts[1]
            }

            const r = (resultsRows.value || []).find(row => isRowMatchTeamEntity(row, driverOrTeamId))
            const actualCarNum = carNum || (r?.car_number !== null && r?.car_number !== undefined && r?.car_number !== '' ? r.car_number : null)
            const t = (r?.team_id ? getTeamById(r.team_id) : null) || getTeamById(teamId)
            const teamName = t?.name || r?.team_name || "Tim Terpilih"

            return actualCarNum ? `#${actualCarNum} ${teamName}` : teamName
        }
        const d = getDriverById(driverOrTeamId)
        if (d?.name) return d.name
        const r = (resultsRows.value || []).find(row => String(row.driver_id).toLowerCase() === String(driverOrTeamId).toLowerCase())
        if (r?.driver_name) return r.driver_name
        return "Pembalap Terpilih"
    }

    const activeResultClasses = computed(() => {
        const clsList = availableClassesForSchedule.value || []
        if (clsList.length > 1) {
            return clsList
        }
        if (clsList.length === 1) {
            return clsList
        }
        return [{ id: '', name: 'Overall' }]
    })

    const getDriversForClass = (classId) => {
        const clsList = availableClassesForSchedule.value || []
        let rows = (resultsRows.value || []).filter(r => isTeamEvent.value ? r.team_id : r.driver_id)
        if (clsList.length > 1 && classId) {
            const classSpecific = rows.filter(r => r.class_id === classId)
            if (classSpecific.length > 0) {
                rows = classSpecific
            }
        }
        if (isTeamEvent.value) {
            return rows.map(r => {
                const t = getTeamById(r.team_id)
                const teamName = t?.name || "Unknown Team"
                return {
                    driver_id: getTeamRowEntryKey(r),
                    team_id: r.team_id,
                    name: r.car_number ? `#${r.car_number} ${teamName}` : teamName,
                    car_number: r.car_number,
                    isTeam: true
                }
            })
        }
        return rows.map(r => {
            const d = (drivers.value || []).find(drv => String(drv.id).toLowerCase() === String(r.driver_id).toLowerCase())
            return {
                driver_id: r.driver_id,
                name: d?.name || "Unknown Driver",
                car_number: r.car_number
            }
        })
    }

    const getPoleDriverId = (classId) => {
        const key = classId || '__overall__'
        const clsLen = availableClassesForSchedule.value?.length || 0
        const rows = resultsRows.value || []
        if (rows.length > 0) {
            const row = rows.find(r => (!classId || (r.class_id || '') === classId || clsLen <= 1) && (r.is_pole || Number(r.grid_position) === 1))
            if (row) {
                const entityId = isTeamEvent.value
                    ? getTeamRowEntryKey(row)
                    : row.driver_id
                if (entityId) {
                    poleDriverIds.value[key] = entityId
                    return entityId
                }
            }
            return ""
        }
        if (poleDriverIds.value[key]) return poleDriverIds.value[key]
        if (poleDriverIds.value['']) return poleDriverIds.value['']
        return ""
    }

    const onPoleDriverChange = (classId, driverOrTeamId) => {
        const key = classId || '__overall__'
        poleDriverIds.value[key] = driverOrTeamId || ""
        if (!classId) poleDriverIds.value[''] = driverOrTeamId || ""

        const clsLen = availableClassesForSchedule.value?.length || 0
        const strId = driverOrTeamId ? String(driverOrTeamId).trim() : ""
        let matched = false

        ;(resultsRows.value || []).forEach(row => {
            const rowClass = row.class_id || ""
            const targetClass = classId || ""
            if (!classId || rowClass === targetClass || clsLen <= 1) {
                let isMatch = false
                if (isTeamEvent.value) {
                    isMatch = isRowMatchTeamEntity(row, strId)
                } else {
                    isMatch = Boolean(strId && row.driver_id && String(row.driver_id).toLowerCase() === strId.toLowerCase())
                }

                if (isMatch) {
                    row.is_pole = true
                    row.grid_position = 1
                    matched = true
                } else {
                    row.is_pole = false
                    if (Number(row.grid_position) === 1) {
                        row.grid_position = null
                    }
                }
            }
        })

        if (driverOrTeamId && !matched) {
            const targetClass = classId || ""
            let candidateRow = (resultsRows.value || []).find(r => (!classId || (r.class_id || '') === targetClass || clsLen <= 1) && (isTeamEvent.value ? !r.team_id : !r.driver_id))
            if (!candidateRow && (resultsRows.value || []).length > 0) {
                candidateRow = (resultsRows.value || []).find(r => !classId || (r.class_id || '') === targetClass || clsLen <= 1)
            }
            if (candidateRow) {
                if (isTeamEvent.value) {
                    if (strId.includes('#')) {
                        const [tId, cNum] = strId.split('#')
                        candidateRow.team_id = Number(tId) || tId
                        if (cNum) candidateRow.car_number = Number(cNum) || cNum
                    } else {
                        candidateRow.team_id = strId
                    }
                } else {
                    candidateRow.driver_id = driverOrTeamId
                    onDriverSelected(candidateRow)
                }
                candidateRow.is_pole = true
                candidateRow.grid_position = 1
                if (classId) candidateRow.class_id = classId
            }
        }
    }

    const getFastestLapDriverId = (classId) => {
        const key = classId || '__overall__'
        const clsLen = availableClassesForSchedule.value?.length || 0
        const rows = resultsRows.value || []
        if (rows.length > 0) {
            const row = rows.find(r => (!classId || (r.class_id || '') === classId || clsLen <= 1) && r.fastest_lap)
            if (row) {
                const entityId = isTeamEvent.value
                    ? getTeamRowEntryKey(row)
                    : row.driver_id
                if (entityId) {
                    fastestLapDriverIds.value[key] = entityId
                    return entityId
                }
            }
            return ""
        }
        if (fastestLapDriverIds.value[key]) return fastestLapDriverIds.value[key]
        if (fastestLapDriverIds.value['']) return fastestLapDriverIds.value['']
        return ""
    }

    const onFastestLapDriverChange = (classId, driverOrTeamId) => {
        const key = classId || '__overall__'
        fastestLapDriverIds.value[key] = driverOrTeamId || ""
        if (!classId) fastestLapDriverIds.value[''] = driverOrTeamId || ""

        const clsLen = availableClassesForSchedule.value?.length || 0
        const strId = driverOrTeamId ? String(driverOrTeamId).trim() : ""
        let matched = false

        ;(resultsRows.value || []).forEach(row => {
            const rowClass = row.class_id || ""
            const targetClass = classId || ""
            if (!classId || rowClass === targetClass || clsLen <= 1) {
                let isMatch = false
                if (isTeamEvent.value) {
                    isMatch = isRowMatchTeamEntity(row, strId)
                } else {
                    isMatch = Boolean(strId && row.driver_id && String(row.driver_id).toLowerCase() === strId.toLowerCase())
                }

                if (isMatch) {
                    row.fastest_lap = true
                    matched = true
                    if (fastestLapTimes.value[key] && !row.best_lap) {
                        row.best_lap = fastestLapTimes.value[key]
                    } else if (row.best_lap) {
                        fastestLapTimes.value[key] = row.best_lap
                    }
                } else {
                    row.fastest_lap = false
                }
            }
        })

        if (driverOrTeamId && !matched) {
            const targetClass = classId || ""
            let candidateRow = (resultsRows.value || []).find(r => (!classId || (r.class_id || '') === targetClass || clsLen <= 1) && (isTeamEvent.value ? !r.team_id : !r.driver_id))
            if (candidateRow) {
                if (isTeamEvent.value) {
                    if (strId.includes('#')) {
                        const [tId, cNum] = strId.split('#')
                        candidateRow.team_id = Number(tId) || tId
                        if (cNum) candidateRow.car_number = Number(cNum) || cNum
                    } else {
                        candidateRow.team_id = strId
                    }
                } else {
                    candidateRow.driver_id = driverOrTeamId
                    onDriverSelected(candidateRow)
                }
                candidateRow.fastest_lap = true
                if (classId) candidateRow.class_id = classId
                if (fastestLapTimes.value[key]) candidateRow.best_lap = fastestLapTimes.value[key]
            }
        }
    }

    const getFastestLapTime = (classId) => {
        const key = classId || '__overall__'
        if (fastestLapTimes.value[key]) return fastestLapTimes.value[key]
        if (fastestLapTimes.value['']) return fastestLapTimes.value['']
        const clsLen = availableClassesForSchedule.value?.length || 0
        const row = (resultsRows.value || []).find(r => (!classId || (r.class_id || '') === classId || clsLen <= 1) && r.fastest_lap)
        if (row && row.best_lap) {
            fastestLapTimes.value[key] = row.best_lap
            return row.best_lap
        }
        return ""
    }

    const onFastestLapTimeChange = (classId, timeStr) => {
        const key = classId || '__overall__'
        fastestLapTimes.value[key] = timeStr
        if (!classId) fastestLapTimes.value[''] = timeStr
        const clsLen = availableClassesForSchedule.value?.length || 0
        const row = (resultsRows.value || []).find(r => (!classId || (r.class_id || '') === classId || clsLen <= 1) && r.fastest_lap)
        if (row) {
            row.best_lap = timeStr
        }
    }

    const activeTopDriverSearch = ref(null) // { type: 'pole' | 'fastest_lap', classId: string }
    const topDriverSearchQuery = ref("")

    const openTopDriverSearch = (type, classId) => {
        activeTopDriverSearch.value = { type, classId: classId || '' }
        topDriverSearchQuery.value = ""
    }

    const closeTopDriverSearch = () => {
        activeTopDriverSearch.value = null
        topDriverSearchQuery.value = ""
    }

    const selectTopDriver = (type, classId, driverOrTeam) => {
        const entityId = driverOrTeam ? driverOrTeam.id : ""
        if (type === 'pole') {
            onPoleDriverChange(classId, entityId)
        } else {
            onFastestLapDriverChange(classId, entityId)
        }
        closeTopDriverSearch()
    }

    const syncTopDriversFromRows = () => {
        poleDriverIds.value = {}
        fastestLapDriverIds.value = {}
        fastestLapTimes.value = {}
        ;(resultsRows.value || []).forEach(row => {
            let entityId = null
            if (isTeamEvent.value) {
                if (row.team_id) {
                    entityId = getTeamRowEntryKey(row)
                }
            } else {
                entityId = row.driver_id
            }
            if (!entityId) return
            const classKey = row.class_id || '__overall__'
            if (row.is_pole || Number(row.grid_position) === 1) {
                poleDriverIds.value[classKey] = entityId
                if (!row.class_id) poleDriverIds.value[''] = entityId
            }
            if (row.fastest_lap) {
                fastestLapDriverIds.value[classKey] = entityId
                if (!row.class_id) fastestLapDriverIds.value[''] = entityId
                if (row.best_lap) {
                    fastestLapTimes.value[classKey] = row.best_lap
                    if (!row.class_id) fastestLapTimes.value[''] = row.best_lap
                }
            }
        })
    }

    const getFilteredTopDrivers = (classId) => {
        const q = topDriverSearchQuery.value.trim().toLowerCase()
        const clsLen = availableClassesForSchedule.value?.length || 0

        if (isTeamEvent.value) {
            let classRows = (resultsRows.value || []).filter(r => r && r.team_id)
            if (clsLen > 1 && classId) {
                const classSpecific = classRows.filter(r => (r.class_id || '') === classId)
                if (classSpecific.length > 0) {
                    classRows = classSpecific
                }
            }

            const raceEntries = []
            const seenKeys = new Set()

            for (const r of classRows) {
                const teamObj = getTeamById(r.team_id) || (teamsList.value || []).find(tm => String(tm.id) === String(r.team_id))
                const teamName = teamObj?.name || r.team_name || `Team ${r.team_id}`
                const carNum = (r.car_number !== null && r.car_number !== undefined && r.car_number !== '') ? String(r.car_number).trim() : ''
                const key = getTeamRowEntryKey(r)

                if (seenKeys.has(key)) continue
                seenKeys.add(key)

                raceEntries.push({
                    id: key,
                    team_id: r.team_id,
                    car_number: r.car_number,
                    _rowId: r._rowId,
                    name: carNum ? `#${carNum} ${teamName}` : teamName,
                    rawName: teamName,
                    isTeam: true
                })
            }

            if (!q) {
                return raceEntries
            }

            return raceEntries.filter(entry => {
                const nameMatch = entry.name && entry.name.toLowerCase().includes(q)
                const rawNameMatch = entry.rawName && entry.rawName.toLowerCase().includes(q)
                const carNumMatch = entry.car_number !== null && entry.car_number !== undefined && String(entry.car_number).toLowerCase().includes(q)
                return nameMatch || rawNameMatch || carNumMatch
            })
        }

        const classRows = (resultsRows.value || []).filter(r => r && r.driver_id)
        const participatingDriverIds = new Set()
        if (clsLen > 1 && classId) {
            classRows.filter(r => r.class_id === classId).forEach(r => participatingDriverIds.add(r.driver_id))
        } else {
            classRows.forEach(r => participatingDriverIds.add(r.driver_id))
        }

        if (!q) {
            if (participatingDriverIds.size > 0) {
                const partDrivers = []
                participatingDriverIds.forEach(id => {
                    const d = (drivers.value || []).find(drv => drv.id === id)
                    if (d) partDrivers.push(d)
                })
                return partDrivers
            }
            return (drivers.value || []).slice(0, 50)
        }

        return (drivers.value || []).filter(d => {
            const nameMatch = d.name && d.name.toLowerCase().includes(q)
            const teamMatch = d.teams?.name && d.teams.name.toLowerCase().includes(q)
            const countryMatch = (d.countries?.name && d.countries.name.toLowerCase().includes(q)) || (d.countries?.code && d.countries.code.toLowerCase().includes(q))
            const ratingMatch = d.rating && d.rating.toLowerCase().includes(q)
            return nameMatch || teamMatch || countryMatch || ratingMatch
        }).slice(0, 50)
    }

    const setFastestLapOnly = (target) => {
        const targetRow = (typeof target === 'object' && target !== null) ? target : resultsRows.value[target]
        if (!targetRow) return

        const targetClass = targetRow.class_id || "__overall__"
        const isCurrentlyFastest = Boolean(targetRow.fastest_lap)

        resultsRows.value.forEach((row) => {
            const rowClass = row.class_id || "__overall__"
            // Toggle/clear only within the same class group
            if (rowClass === targetClass) {
                row.fastest_lap = (row === targetRow) ? !isCurrentlyFastest : false
            }
        })
        syncTopDriversFromRows()
    }

    const setPolePositionOnly = (target) => {
        const targetRow = (typeof target === 'object' && target !== null) ? target : resultsRows.value[target]
        if (!targetRow) return

        const targetClass = targetRow.class_id || "__overall__"
        const isCurrentlyPole = Boolean(targetRow.is_pole || Number(targetRow.grid_position) === 1)

        resultsRows.value.forEach((row) => {
            const rowClass = row.class_id || "__overall__"
            // Toggle/clear only within the same class group
            if (rowClass === targetClass) {
                if (row === targetRow) {
                    row.is_pole = !isCurrentlyPole
                    row.grid_position = !isCurrentlyPole ? 1 : null
                } else {
                    row.is_pole = false
                    if (Number(row.grid_position) === 1) {
                        row.grid_position = null
                    }
                }
            }
        })
        syncTopDriversFromRows()
    }

    const parseTimeToMs = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return null
        const cleaned = timeStr.trim().replace(/^(\+)/, "").replace(/s$/, "")
        if (!cleaned || cleaned === "-") return null

        const parts = cleaned.split(":")
        if (parts.length === 3) {
            const hours = parseFloat(parts[0]) || 0
            const minutes = parseFloat(parts[1]) || 0
            const seconds = parseFloat(parts[2]) || 0
            return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000)
        } else if (parts.length === 2) {
            const minutes = parseFloat(parts[0]) || 0
            const seconds = parseFloat(parts[1]) || 0
            return Math.round((minutes * 60 + seconds) * 1000)
        } else {
            const seconds = parseFloat(parts[0])
            return !isNaN(seconds) ? Math.round(seconds * 1000) : null
        }
    }

    const fetchRaceResultsForSchedule = async () => {
        if (!selectedScheduleId.value) {
            resultsRows.value = []
            hasExistingDbResults.value = false
            return
        }

        loadingResults.value = true
        errorMsg.value = ""
        try {
            await fetchSeasonDriverClasses()

            let { data: entries, error: entriesError } = await $supabase
                .from("event_entries")
                .select(`
                    id,
                    schedule_id,
                    entry_type,
                    driver_id,
                    team_id,
                    car_number,
                    car_model,
                    class_id,
                    results (
                        id,
                        event_entry_id,
                        session_type,
                        classified_position,
                        scoring_position,
                        status,
                        grid_position,
                        num_laps,
                        best_lap_ms,
                        total_time_ms,
                        has_penalty,
                        penalty_time_ns,
                        fastest_lap,
                        is_provisional,
                        no_points
                    )
                `)
                .eq("schedule_id", selectedScheduleId.value)

            if (entriesError && (entriesError.message?.includes("no_points") || entriesError.code === "PGRST204" || entriesError.code === "42703")) {
                const retry = await $supabase
                    .from("event_entries")
                    .select(`
                        id,
                        schedule_id,
                        entry_type,
                        driver_id,
                        team_id,
                        car_number,
                        car_model,
                        class_id,
                        results (
                            id,
                            event_entry_id,
                            session_type,
                            classified_position,
                            scoring_position,
                            status,
                            grid_position,
                            num_laps,
                            best_lap_ms,
                            total_time_ms,
                            has_penalty,
                            penalty_time_ns,
                            fastest_lap,
                            is_provisional
                        )
                    `)
                    .eq("schedule_id", selectedScheduleId.value)
                entries = retry.data
                entriesError = retry.error
            }

            if (entriesError) {
                console.warn("Error fetching event_entries:", entriesError)
            }

            const validEntries = (entries || []).filter(e => 
                e.results && e.results.some(r => r.session_type === selectedSessionType.value || (!r.session_type && selectedSessionType.value === 'race'))
            )

            if (validEntries.length > 0) {
                hasExistingDbResults.value = true
                const currentSessionRes = validEntries.flatMap(e => e.results || []).filter(r => r.session_type === selectedSessionType.value || (!r.session_type && selectedSessionType.value === 'race'))
                isResultsProvisional.value = Boolean(currentSessionRes.length > 0 && currentSessionRes.some(r => r.is_provisional))

                const isExistingTeam = validEntries.some(e => e.entry_type === 'team' || (!e.driver_id && e.team_id))
                isTeamEvent.value = isExistingTeam

                const mapped = validEntries.map(e => {
                    const res = e.results.find(r => r.session_type === selectedSessionType.value || (!r.session_type && selectedSessionType.value === 'race')) || {}
                    const penSec = res.penalty_time_ns ? (Number(res.penalty_time_ns) / 1000000000) : null
                    const leadDriverId = isTeamEvent.value ? "" : (e.driver_id || "")
                    const coDriverIds = []
                    const driverClassId = e.class_id || (leadDriverId && seasonDriverClassesMap.value.get(leadDriverId)) || (availableClassesForSchedule.value.length === 1 ? availableClassesForSchedule.value[0].id : "")
                    return {
                        _rowId: 'row_' + Math.random().toString(36).substring(2, 9),
                        id: res.id || null,
                        event_entry_id: e.id,
                        position: res.classified_position || 1,
                        scoring_position: res.scoring_position ?? res.classified_position ?? 1,
                        class_id: driverClassId,
                        driver_id: leadDriverId,
                        co_driver_ids: coDriverIds,
                        team_id: e.team_id || "",
                        car_number: e.car_number,
                        car_model: e.car_model || "",
                        status: res.status || "finished",
                        grid_position: res.grid_position,
                        is_pole: Number(res.grid_position) === 1,
                        num_laps: res.num_laps,
                        best_lap: res.best_lap_ms ? formatLapTime(res.best_lap_ms) : "",
                        total_time: res.total_time_ms
                            ? (selectedSessionType.value === 'qualifying' ? formatLapTime(res.total_time_ms) : formatTotalTime(res.total_time_ms))
                            : (res.best_lap_ms ? formatLapTime(res.best_lap_ms) : ""),
                        total_time_ms: res.total_time_ms,
                        has_penalty: Boolean(res.has_penalty),
                        penalty_time_sec: penSec,
                        fastest_lap: Boolean(res.fastest_lap),
                        no_points: Boolean(res.no_points)
                    }
                })
                mapped.sort((a, b) => (a.position || 999) - (b.position || 999))
                resultsRows.value = mapped
                reindexPositions()
                syncTopDriversFromRows()
            } else {
                hasExistingDbResults.value = false
                isTeamEvent.value = false
                resultsRows.value = Array.from({ length: 10 }, (_, i) => createEmptyResultRow(i + 1))
            }
        } catch (err) {
            console.error("Error loading race results:", err)
            showToast(err.message || "Gagal memuat hasil balapan", "error")
        } finally {
            loadingResults.value = false
        }
    }

    const populateRowsFromParsedAcsm = (json) => {
        const parsed = parseAcsmResult(json)
        if (parsed.length === 0) {
            showToast("Tidak ada data pembalap dalam file JSON", "error")
            return
        }

        const hasMultipleDrivers = parsed.some(item => (item.driverNames && item.driverNames.length > 1) || (item.driverName && item.driverName.includes(',')))
        if (hasMultipleDrivers) {
            isTeamEvent.value = true
        }

        const rows = parsed.map((item, idx) => {
            let leadDriverId = ""
            let coDriverIds = []
            let matchedTeamId = null

            if (isTeamEvent.value) {
                if (item.teamName && item.teamName !== "-") {
                    const tName = item.teamName.toLowerCase().trim()
                    const foundTeam = teamsList.value.find(t => t.name?.toLowerCase().trim() === tName)
                    if (foundTeam) matchedTeamId = foundTeam.id
                }
            } else {
                const cleanName = item.driverName?.toLowerCase().trim()
                const rawDriverNames = item.driverNames && item.driverNames.length > 0 ? item.driverNames : (item.driverName ? [item.driverName] : [])
                const matchedDriverIds = []
                for (const rawName of rawDriverNames) {
                    const clean = rawName.toLowerCase().trim()
                    const found = drivers.value.find(d => d.name?.toLowerCase().trim() === clean)
                    if (found && !matchedDriverIds.includes(found.id)) {
                        matchedDriverIds.push(found.id)
                    }
                }

                const matchedDriver = drivers.value.find(d => {
                    const dName = d.name?.toLowerCase().trim()
                    return dName === cleanName || (item.driverNames && item.driverNames.some(dn => dName === dn.toLowerCase().trim()))
                })

                leadDriverId = matchedDriverIds[0] || (matchedDriver ? matchedDriver.id : "")
                coDriverIds = matchedDriverIds.slice(1)

                if (matchedDriver && matchedDriver.team) {
                    matchedTeamId = matchedDriver.team
                } else if (item.teamName && item.teamName !== "-") {
                    const tName = item.teamName.toLowerCase().trim()
                    const foundTeam = teamsList.value.find(t => t.name?.toLowerCase().trim() === tName)
                    if (foundTeam) matchedTeamId = foundTeam.id
                }
            }

            const classHay = (item.raceClass || item.carClass || item.teamClass || "").toLowerCase().trim()
            let matchedClassId = ""
            if (selectedEntryClassId.value !== "ALL") {
                matchedClassId = selectedEntryClassId.value
            } else if (!isTeamEvent.value && leadDriverId && seasonDriverClassesMap.value.has(leadDriverId)) {
                matchedClassId = seasonDriverClassesMap.value.get(leadDriverId)
            } else if (classHay && availableClassesForSchedule.value.length > 0) {
                const foundCls = availableClassesForSchedule.value.find(c =>
                    c.name.toLowerCase().trim() === classHay ||
                    classHay.includes(c.name.toLowerCase().trim())
                )
                if (foundCls) matchedClassId = foundCls.id
            } else if (availableClassesForSchedule.value.length === 1) {
                matchedClassId = availableClassesForSchedule.value[0].id
            }

            const carNum = item.carNumber ? parseInt(item.carNumber, 10) : null

            return {
                _rowId: 'row_' + Math.random().toString(36).substring(2, 9),
                id: null,
                event_entry_id: null,
                position: idx + 1,
                scoring_position: idx + 1,
                class_id: matchedClassId,
                driver_id: leadDriverId,
                co_driver_ids: coDriverIds,
                team_id: matchedTeamId || "",
                car_number: !isNaN(carNum) ? carNum : null,
                car_model: item.carModel !== "-" ? item.carModel : "",
                status: item.disqualified ? "dsq" : "finished",
                grid_position: item.gridPosition || null,
                is_pole: Number(item.gridPosition) === 1,
                num_laps: item.lapsCompleted ?? item.numLaps ?? null,
                best_lap: item.bestLapMs > 0 ? formatLapTime(item.bestLapMs) : "",
                best_lap_ms: item.bestLapMs || null,
                total_time: (selectedSessionType.value === 'qualifying')
                    ? (idx === 0 ? (item.bestLap || (item.bestLapMs > 0 ? formatLapTime(item.bestLapMs) : "")) : (item.gap && item.gap !== "-" ? item.gap : (item.bestLap || (item.bestLapMs > 0 ? formatLapTime(item.bestLapMs) : ""))))
                    : (item.gap && item.gap !== "-" ? item.gap : (idx === 0 && item.totalTime ? item.totalTimeFormatted : "")),
                total_time_ms: item.totalTime || null,
                has_penalty: Boolean(item.hasPenalty),
                penalty_time_sec: item.penaltyTime || null,
                fastest_lap: Boolean(item.isFastestLap),
                no_points: false
            }
        })

        if (selectedEntryClassId.value !== "ALL") {
            const otherClassesRows = resultsRows.value.filter(r => r.class_id !== selectedEntryClassId.value)
            resultsRows.value = [...otherClassesRows, ...rows]
        } else {
            resultsRows.value = rows
        }
        recalculateScoringPositions()
        syncTopDriversFromRows()
    }

    const handleResultsJsonUpload = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result)
                populateRowsFromParsedAcsm(parsed)
                showToast("File ACSM JSON berhasil dimuat ke tabel posisi!")
            } catch (err) {
                showToast("Format file JSON tidak valid!", "error")
            }
        }
        reader.readAsText(file)
        e.target.value = ""
    }

    const openSaveResultsModal = () => {
        if (!selectedScheduleId.value) {
            showToast("Pilih jadwal balapan terlebih dahulu", "error")
            return
        }
        const validRows = isTeamEvent.value
            ? resultsRows.value.filter(r => r.team_id)
            : resultsRows.value.filter(r => r.driver_id)
        if (validRows.length === 0) {
            showToast(isTeamEvent.value ? "Isi minimal satu data tim" : "Isi minimal satu data pembalap", "error")
            return
        }
        resultsAdminPassword.value = ""
        resultsAdminPasswordError.value = ""
        showResultsAdminPassword.value = false
        isResultsSaveModalOpen.value = true
    }

    const closeSaveResultsModal = () => {
        isResultsSaveModalOpen.value = false
        resultsAdminPassword.value = ""
        resultsAdminPasswordError.value = ""
        showResultsAdminPassword.value = false
    }

    const confirmSaveRaceResults = async () => {
        resultsAdminPasswordError.value = ""
        if (resultsAdminPassword.value !== CRUD_PASS) {
            resultsAdminPasswordError.value = "Password admin salah!"
            return
        }

        if (selectedSessionType.value !== 'qualifying') {
            activeResultClasses.value.forEach(cls => {
                const poleDId = getPoleDriverId(cls.id)
                if (poleDId) {
                    onPoleDriverChange(cls.id, poleDId)
                }
                const flDId = getFastestLapDriverId(cls.id)
                if (flDId) {
                    onFastestLapDriverChange(cls.id, flDId)
                }
                const flTime = getFastestLapTime(cls.id)
                if (flTime) {
                    onFastestLapTimeChange(cls.id, flTime)
                }
            })
        }

        const validRows = isTeamEvent.value
            ? resultsRows.value.filter(r => r.team_id)
            : resultsRows.value.filter(r => r.driver_id)
        if (validRows.length === 0) {
            showToast(isTeamEvent.value ? "Isi minimal satu data tim" : "Isi minimal satu data pembalap", "error")
            return
        }

        savingResults.value = true
        try {
            const schedId = selectedScheduleId.value
            const sessType = selectedSessionType.value

            const { data: existingEntries } = await $supabase
                .from("event_entries")
                .select("id, driver_id, team_id, car_number, schedule_id")
                .eq("schedule_id", schedId)

            const entryMap = new Map()
            const teamCarEntryMap = new Map()
            if (existingEntries) {
                existingEntries.forEach(e => {
                    if (e.driver_id) entryMap.set(String(e.driver_id), e.id)
                    if (e.team_id) {
                        const key = `${e.team_id}::${e.car_number ?? ''}`
                        teamCarEntryMap.set(key, e.id)
                        if (!teamCarEntryMap.has(String(e.team_id))) {
                            teamCarEntryMap.set(String(e.team_id), e.id)
                        }
                    }
                })
            }

            for (let i = 0; i < validRows.length; i++) {
                const row = validRows[i]
                let entryId = row.event_entry_id
                if (!entryId) {
                    if (isTeamEvent.value) {
                        const key = `${row.team_id}::${row.car_number ?? ''}`
                        entryId = teamCarEntryMap.get(key) || teamCarEntryMap.get(String(row.team_id))
                    } else {
                        entryId = entryMap.get(String(row.driver_id))
                    }
                }
                const allRowDrivers = isTeamEvent.value ? [] : [row.driver_id, ...(row.co_driver_ids || [])].filter(Boolean)

                const entryPayload = {
                    schedule_id: schedId,
                    entry_type: isTeamEvent.value ? "team" : ((row.co_driver_ids && row.co_driver_ids.length > 0) ? "team" : "driver"),
                    driver_id: isTeamEvent.value ? null : (row.driver_id || (allRowDrivers[0] || null)),
                    team_id: row.team_id ? Number(row.team_id) : null,
                    car_number: row.car_number ? Number(row.car_number) : null,
                    car_model: row.car_model || null,
                    class_id: row.class_id || null
                }

                if (!entryId) {
                    const { data: newEntry, error: entryErr } = await $supabase
                        .from("event_entries")
                        .insert(entryPayload)
                        .select("id")
                        .single()
                    if (entryErr) throw entryErr
                    entryId = newEntry.id
                    row.event_entry_id = entryId
                    if (isTeamEvent.value) {
                        const key = `${row.team_id}::${row.car_number ?? ''}`
                        teamCarEntryMap.set(key, entryId)
                    } else {
                        entryMap.set(String(row.driver_id), entryId)
                    }
                } else {
                    await $supabase
                        .from("event_entries")
                        .update(entryPayload)
                        .eq("id", entryId)
                }

                // If drivers have an assigned class and season exists, save to season_driver_classes for all drivers
                const seasonId = currentScheduleSeason.value?.id || selectedSchedule.value?.season_id
                if (seasonId && row.class_id && allRowDrivers.length > 0) {
                    for (const dId of allRowDrivers) {
                        const { data: existingSdc } = await $supabase
                            .from("season_driver_classes")
                            .select("id")
                            .eq("season_id", seasonId)
                            .eq("driver_id", dId)
                            .maybeSingle()

                        if (existingSdc) {
                            await $supabase
                                .from("season_driver_classes")
                                .update({ class_id: row.class_id })
                                .eq("id", existingSdc.id)
                        } else {
                            await $supabase
                                .from("season_driver_classes")
                                .insert({
                                    season_id: seasonId,
                                    driver_id: dId,
                                    class_id: row.class_id
                                })
                        }
                        seasonDriverClassesMap.value.set(dId, row.class_id)
                    }
                }

                const parsedTotalMs = row.total_time ? parseTimeToMs(row.total_time) : null
                const parsedBestMs = row.best_lap ? parseTimeToMs(row.best_lap) : null
                const totalMs = parsedTotalMs || row.total_time_ms
                const bestMs = parsedBestMs || row.best_lap_ms || (sessType === 'qualifying' ? totalMs : null)
                const penNs = row.penalty_time_sec ? Math.round(Number(row.penalty_time_sec) * 1000000000) : null
                const isPolePosition = (sessType === 'qualifying' && (Number(row.scoring_position) === 1 || i === 0)) || row.is_pole || Number(row.grid_position) === 1

                const resultPayload = {
                    event_entry_id: entryId,
                    session_type: sessType,
                    classified_position: i + 1,
                    scoring_position: row.scoring_position ? Number(row.scoring_position) : (i + 1),
                    status: row.status || "finished",
                    grid_position: isPolePosition ? 1 : (row.grid_position ? Number(row.grid_position) : null),
                    num_laps: (sessType !== 'qualifying' && row.num_laps !== null && row.num_laps !== '' && !isNaN(Number(row.num_laps))) ? Number(row.num_laps) : null,
                    best_lap_ms: bestMs || null,
                    total_time_ms: totalMs || null,
                    has_penalty: sessType === 'qualifying' ? false : Boolean(row.has_penalty),
                    penalty_time_ns: sessType === 'qualifying' ? null : penNs,
                    fastest_lap: sessType === 'qualifying' ? false : Boolean(row.fastest_lap),
                    is_provisional: Boolean(isResultsProvisional.value),
                    no_points: sessType === 'qualifying' ? false : Boolean(row.no_points)
                }

                const { data: existingResult } = await $supabase
                    .from("results")
                    .select("id")
                    .eq("event_entry_id", entryId)
                    .eq("session_type", sessType)
                    .maybeSingle()

                let { error: resErr } = existingResult
                    ? await $supabase.from("results").update(resultPayload).eq("id", existingResult.id)
                    : await $supabase.from("results").insert(resultPayload)

                if (resErr && (resErr.message?.includes("no_points") || resErr.code === "PGRST204" || resErr.code === "42703")) {
                    const fallbackPayload = { ...resultPayload }
                    delete fallbackPayload.no_points
                    const retry = existingResult
                        ? await $supabase.from("results").update(fallbackPayload).eq("id", existingResult.id)
                        : await $supabase.from("results").insert(fallbackPayload)
                    resErr = retry.error
                }
                if (resErr) throw resErr
            }

            showToast(`Hasil balapan (${validRows.length} posisi) berhasil disimpan!`)
            closeSaveResultsModal()
            await fetchSchedules()
            await fetchRaceResultsForSchedule()

            // Standings that score this schedule are recalculated immediately
            // so the championship table never lags behind saved results.
            await syncStandingsForSchedule(schedId)
        } catch (err) {
            console.error("Error saving race results:", err)
            showToast(err.message || "Gagal menyimpan hasil balapan", "error")
        } finally {
            savingResults.value = false
        }
    }

    const openDeleteResultsModal = () => {
        if (!selectedScheduleId.value) return
        resultsDeletePassword.value = ""
        resultsDeletePasswordError.value = ""
        showResultsDeletePassword.value = false
        isResultsDeleteModalOpen.value = true
    }

    const closeDeleteResultsModal = () => {
        isResultsDeleteModalOpen.value = false
        resultsDeletePassword.value = ""
        resultsDeletePasswordError.value = ""
        showResultsDeletePassword.value = false
    }

    const confirmDeleteRaceResults = async () => {
        resultsDeletePasswordError.value = ""
        if (resultsDeletePassword.value !== CRUD_PASS) {
            resultsDeletePasswordError.value = "Password admin salah!"
            return
        }

        deleting.value = true
        try {
            const schedId = selectedScheduleId.value
            const sessType = selectedSessionType.value

            const { data: entries } = await $supabase
                .from("event_entries")
                .select("id")
                .eq("schedule_id", schedId)

            if (entries && entries.length > 0) {
                const entryIds = entries.map(e => e.id)
                await $supabase
                    .from("results")
                    .delete()
                    .in("event_entry_id", entryIds)
                    .eq("session_type", sessType)
            }

            showToast("Hasil balapan sesi ini berhasil dihapus!")
            closeDeleteResultsModal()
            await fetchRaceResultsForSchedule()
            await syncStandingsForSchedule(schedId)
        } catch (err) {
            console.error("Error deleting race results:", err)
            showToast(err.message || "Gagal menghapus hasil balapan", "error")
        } finally {
            deleting.value = false
        }
    }

    // Championships that score the currently selected schedule + session, so
    // the admin can see whether saving will feed a standings table and which
    // points system will be applied.
    const scheduleChampionshipLinks = ref([])
    const loadingScheduleChampionships = ref(false)

    const fetchScheduleChampionshipLinks = async () => {
        if (!selectedScheduleId.value) {
            scheduleChampionshipLinks.value = []
            return
        }
        loadingScheduleChampionships.value = true
        try {
            const { data, error } = await $supabase
                .from("championship_events")
                .select(`
                    id,
                    session_type,
                    points_multiplier,
                    points_system_id,
                    championships (
                        id,
                        standings_type,
                        class_id,
                        classes (
                            id,
                            name
                        ),
                        seasons (
                            id,
                            season_number,
                            events (
                                id,
                                name
                            )
                        )
                    ),
                    points_systems (
                        id,
                        name
                    )
                `)
                .eq("schedule_id", selectedScheduleId.value)

            if (error) throw error
            scheduleChampionshipLinks.value = data || []
        } catch (err) {
            console.warn("Error fetching championship links:", err)
            scheduleChampionshipLinks.value = []
        } finally {
            loadingScheduleChampionships.value = false
        }
    }

    // Links matching the session currently being edited.
    const activeSessionChampionshipLinks = computed(() => {
        return scheduleChampionshipLinks.value.filter(l => l.session_type === selectedSessionType.value)
    })

    // Recalculates every championship scoring this schedule.
    const syncStandingsForSchedule = async (scheduleId) => {
        try {
            const summaries = await recalculateChampionshipsForSchedule($supabase, scheduleId)
            if (summaries && summaries.length > 0) {
                const names = summaries.map(s => s.championshipName).join(", ")
                showToast(`Klasemen diperbarui: ${names}`)
            }
            if (selectedChampionshipId.value && summaries && summaries.some(s => s.championshipId === selectedChampionshipId.value)) {
                await fetchStandings()
            }
        } catch (err) {
            console.error("Error syncing standings:", err)
            showToast("Hasil tersimpan, namun klasemen gagal diperbarui: " + (err.message || ""), "error")
        }
    }

    watch(selectedScheduleId, () => {
        resultsClassFilter.value = "ALL"
        selectedEntryClassId.value = "ALL"
        fetchRaceResultsForSchedule()
        fetchScheduleChampionshipLinks()
    })

    watch(selectedSessionType, () => {
        resultsClassFilter.value = "ALL"
        selectedEntryClassId.value = "ALL"
        fetchRaceResultsForSchedule()
    })

    watch(isTeamEvent, () => {
        syncTopDriversFromRows()
    })

    watch(activeTab, (newTab) => {
        if (newTab === "results" && allSchedulesList.value.length === 0) {
            fetchAllSchedulesList()
        }
    })

    // ==========================================
    // POINTS SYSTEMS STATE & METHODS
    // ==========================================
    const pointsSystems = ref([])
    const loadingPointsSystems = ref(false)
    const pointsSystemSearch = ref("")

    const isPointsSystemModalOpen = ref(false)
    const pointsSystemModalMode = ref("create") // 'create' | 'edit'
    const editingPointsSystemId = ref(null)
    const savingPointsSystem = ref(false)
    const pointsSystemPassword = ref("")
    const pointsSystemPasswordError = ref("")
    const showPointsSystemPassword = ref(false)

    const isPointsSystemDeleteModalOpen = ref(false)
    const deletingPointsSystemItem = ref(null)
    const pointsSystemDeletePassword = ref("")
    const pointsSystemDeletePasswordError = ref("")
    const showPointsSystemDeletePassword = ref(false)

    // rules: [{ position, points }], bonuses: [{ bonus_type, points, requires_classification }]
    const pointsSystemForm = reactive({
        name: "",
        description: "",
        rules: [],
        bonuses: []
    })

    const bonusTypeOptions = [
        { value: "fastest_lap", label: "Fastest Lap" },
        { value: "pole", label: "Pole Position" }
    ]

    const fetchPointsSystems = async () => {
        loadingPointsSystems.value = true
        try {
            const { data, error } = await $supabase
                .from("points_systems")
                .select(`
                    id,
                    name,
                    description,
                    points_system_rules (
                        id,
                        position,
                        points
                    ),
                    points_bonuses (
                        id,
                        bonus_type,
                        points,
                        requires_classification
                    )
                `)
                .order("name")

            if (error) throw error
            pointsSystems.value = (data || []).map(sys => ({
                ...sys,
                points_system_rules: [...(sys.points_system_rules || [])].sort((a, b) => a.position - b.position)
            }))
        } catch (err) {
            console.error("Error fetching points systems:", err)
            showToast(err.message || "Gagal memuat sistem poin", "error")
        } finally {
            loadingPointsSystems.value = false
        }
    }

    const filteredPointsSystems = computed(() => {
        if (!pointsSystemSearch.value.trim()) return pointsSystems.value
        const q = pointsSystemSearch.value.toLowerCase()
        return pointsSystems.value.filter(s =>
            (s.name || "").toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q)
        )
    })

    const pointsSystemsMapLocal = computed(() => {
        const map = new Map()
        pointsSystems.value.forEach(s => map.set(s.id, s))
        return map
    })

    const summarizePointsSystem = (sys) => {
        const rules = [...(sys.points_system_rules || [])].sort((a, b) => a.position - b.position)
        if (rules.length === 0) return "Belum ada aturan poin"
        const top = rules.slice(0, 5).map(r => formatPoints(r.points)).join("-")
        return `${top}${rules.length > 5 ? "..." : ""} (${rules.length} posisi)`
    }

    const addPointsRule = () => {
        const nextPos = pointsSystemForm.rules.length + 1
        pointsSystemForm.rules.push({ position: nextPos, points: 0 })
    }

    const removePointsRule = (index) => {
        pointsSystemForm.rules.splice(index, 1)
        pointsSystemForm.rules.forEach((r, i) => { r.position = i + 1 })
    }

    const addPointsBonus = () => {
        const used = pointsSystemForm.bonuses.map(b => b.bonus_type)
        const available = bonusTypeOptions.find(o => !used.includes(o.value))
        if (!available) {
            showToast("Semua jenis bonus sudah ditambahkan", "error")
            return
        }
        pointsSystemForm.bonuses.push({
            bonus_type: available.value,
            points: 1,
            requires_classification: true
        })
    }

    const removePointsBonus = (index) => {
        pointsSystemForm.bonuses.splice(index, 1)
    }

    const applyPointsPreset = (preset) => {
        pointsSystemForm.rules = preset.rules.map((pts, idx) => ({ position: idx + 1, points: pts }))
        if (!pointsSystemForm.name) pointsSystemForm.name = preset.name
        if (!pointsSystemForm.description) pointsSystemForm.description = preset.description
        showToast(`Preset "${preset.name}" diterapkan`)
    }

    const openCreatePointsSystemModal = () => {
        pointsSystemModalMode.value = "create"
        editingPointsSystemId.value = null
        pointsSystemForm.name = ""
        pointsSystemForm.description = ""
        pointsSystemForm.rules = []
        pointsSystemForm.bonuses = []
        pointsSystemPassword.value = ""
        pointsSystemPasswordError.value = ""
        showPointsSystemPassword.value = false
        isPointsSystemModalOpen.value = true
    }

    const openEditPointsSystemModal = (sys) => {
        pointsSystemModalMode.value = "edit"
        editingPointsSystemId.value = sys.id
        pointsSystemForm.name = sys.name || ""
        pointsSystemForm.description = sys.description || ""
        pointsSystemForm.rules = [...(sys.points_system_rules || [])]
            .sort((a, b) => a.position - b.position)
            .map(r => ({ position: r.position, points: Number(r.points) }))
        pointsSystemForm.bonuses = (sys.points_bonuses || []).map(b => ({
            bonus_type: b.bonus_type,
            points: Number(b.points),
            requires_classification: Boolean(b.requires_classification)
        }))
        pointsSystemPassword.value = ""
        pointsSystemPasswordError.value = ""
        showPointsSystemPassword.value = false
        isPointsSystemModalOpen.value = true
    }

    const closePointsSystemModal = () => {
        isPointsSystemModalOpen.value = false
        pointsSystemPassword.value = ""
        pointsSystemPasswordError.value = ""
        showPointsSystemPassword.value = false
    }

    const savePointsSystem = async () => {
        pointsSystemPasswordError.value = ""
        if (pointsSystemPassword.value !== CRUD_PASS) {
            pointsSystemPasswordError.value = "Password admin salah!"
            return
        }
        if (!pointsSystemForm.name.trim()) {
            showToast("Nama sistem poin wajib diisi", "error")
            return
        }
        if (pointsSystemForm.rules.length === 0) {
            showToast("Minimal tambahkan 1 aturan poin", "error")
            return
        }

        savingPointsSystem.value = true
        try {
            let systemId = editingPointsSystemId.value

            const systemPayload = {
                name: pointsSystemForm.name.trim(),
                description: pointsSystemForm.description.trim() || null
            }

            if (systemId) {
                const { error } = await $supabase
                    .from("points_systems")
                    .update(systemPayload)
                    .eq("id", systemId)
                if (error) throw error

                // Rules and bonuses are replaced wholesale: simpler and keeps
                // the stored table exactly matching what the form shows.
                await $supabase.from("points_system_rules").delete().eq("points_system_id", systemId)
                await $supabase.from("points_bonuses").delete().eq("points_system_id", systemId)
            } else {
                const { data, error } = await $supabase
                    .from("points_systems")
                    .insert(systemPayload)
                    .select("id")
                    .single()
                if (error) throw error
                systemId = data.id
            }

            const rulePayload = pointsSystemForm.rules.map((r, idx) => ({
                points_system_id: systemId,
                position: Number(r.position) || idx + 1,
                points: Number(r.points) || 0
            }))
            if (rulePayload.length > 0) {
                const { error } = await $supabase.from("points_system_rules").insert(rulePayload)
                if (error) throw error
            }

            if (pointsSystemForm.bonuses.length > 0) {
                const bonusPayload = pointsSystemForm.bonuses.map(b => ({
                    points_system_id: systemId,
                    bonus_type: b.bonus_type,
                    points: Number(b.points) || 0,
                    requires_classification: Boolean(b.requires_classification)
                }))
                const { error } = await $supabase.from("points_bonuses").insert(bonusPayload)
                if (error) throw error
            }

            showToast(editingPointsSystemId.value ? "Sistem poin berhasil diperbarui!" : "Sistem poin berhasil dibuat!")
            closePointsSystemModal()
            await fetchPointsSystems()

            // Editing a points system changes past results, so refresh any
            // championship that uses it.
            if (editingPointsSystemId.value) {
                await recalculateChampionshipsUsingSystem(editingPointsSystemId.value)
            }
        } catch (err) {
            console.error("Error saving points system:", err)
            showToast(err.message || "Gagal menyimpan sistem poin", "error")
        } finally {
            savingPointsSystem.value = false
        }
    }

    const openDeletePointsSystemModal = (sys) => {
        deletingPointsSystemItem.value = sys
        pointsSystemDeletePassword.value = ""
        pointsSystemDeletePasswordError.value = ""
        showPointsSystemDeletePassword.value = false
        isPointsSystemDeleteModalOpen.value = true
    }

    const closeDeletePointsSystemModal = () => {
        isPointsSystemDeleteModalOpen.value = false
        deletingPointsSystemItem.value = null
        pointsSystemDeletePassword.value = ""
        pointsSystemDeletePasswordError.value = ""
        showPointsSystemDeletePassword.value = false
    }

    const confirmDeletePointsSystem = async () => {
        pointsSystemDeletePasswordError.value = ""
        if (pointsSystemDeletePassword.value !== CRUD_PASS) {
            pointsSystemDeletePasswordError.value = "Password admin salah!"
            return
        }
        if (!deletingPointsSystemItem.value) return

        deleting.value = true
        try {
            const sysId = deletingPointsSystemItem.value.id

            // Refuse while rounds still reference it, otherwise the FK blocks
            // the delete with an opaque error.
            const { count } = await $supabase
                .from("championship_events")
                .select("id", { count: "exact", head: true })
                .eq("points_system_id", sysId)

            if (count && count > 0) {
                showToast(`Sistem poin ini masih dipakai ${count} ronde. Ubah ronde tersebut dahulu.`, "error")
                deleting.value = false
                return
            }

            await $supabase.from("points_system_rules").delete().eq("points_system_id", sysId)
            await $supabase.from("points_bonuses").delete().eq("points_system_id", sysId)
            const { error } = await $supabase.from("points_systems").delete().eq("id", sysId)
            if (error) throw error

            showToast("Sistem poin berhasil dihapus!")
            closeDeletePointsSystemModal()
            await fetchPointsSystems()
        } catch (err) {
            console.error("Error deleting points system:", err)
            showToast(err.message || "Gagal menghapus sistem poin", "error")
        } finally {
            deleting.value = false
        }
    }

    // ==========================================
    // SEASONS, CHAMPIONSHIPS & STANDINGS
    // ==========================================
    const seasonsList = ref([])
    const classesList = ref([])
    const selectedSeasonId = ref("")
    const championships = ref([])
    const loadingChampionships = ref(false)
    const selectedChampionshipId = ref("")
    const championshipRounds = ref([])
    const loadingRounds = ref(false)
    const standingsRows = ref([])
    const loadingStandings = ref(false)
    const recalculating = ref(false)
    const standingsViewType = ref("driver") // mirrors championship standings_type

    // Season modal
    const isSeasonModalOpen = ref(false)
    const seasonModalMode = ref("create")
    const editingSeasonId = ref(null)
    const savingSeason = ref(false)
    const seasonPassword = ref("")
    const seasonPasswordError = ref("")
    const showSeasonPassword = ref(false)
    const seasonForm = reactive({
        event_id: "",
        season_number: 1
    })

    // Championship modal
    const isChampionshipModalOpen = ref(false)
    const championshipModalMode = ref("create")
    const editingChampionshipId = ref(null)
    const savingChampionship = ref(false)
    const championshipPassword = ref("")
    const championshipPasswordError = ref("")
    const showChampionshipPassword = ref(false)
    const championshipForm = reactive({
        season_id: "",
        class_id: "",
        standings_type: "driver",
        default_points_system_id: ""
    })

    // Inline class creation in championship modal
    const showAddClassInput = ref(false)
    const newClassName = ref("")
    const creatingClass = ref(false)

    const selectedSeasonInModal = computed(() => {
        return seasonsList.value.find(s => s.id === championshipForm.season_id) || null
    })

    const availableClassesForModal = computed(() => {
        if (!selectedSeasonInModal.value?.event_id) return []
        return classesList.value.filter(c => c.event_id === selectedSeasonInModal.value.event_id)
    })

    const isChampionshipDeleteModalOpen = ref(false)
    const deletingChampionshipItem = ref(null)
    const championshipDeletePassword = ref("")
    const championshipDeletePasswordError = ref("")
    const showChampionshipDeletePassword = ref(false)

    // Add-rounds modal
    const isAddRoundsModalOpen = ref(false)
    const addRoundsSearch = ref("")
    const addRoundsSelection = ref([]) // [{ schedule_id, session_type }]
    const savingRounds = ref(false)

    const standingsTypeOptions = [
        { value: "driver", label: "Klasemen Pembalap" },
        { value: "team", label: "Klasemen Tim" }
    ]

    // Fetch classes for events
    const fetchClasses = async () => {
        try {
            const { data, error } = await $supabase
                .from("classes")
                .select(`
                    id,
                    name,
                    event_id,
                    created_at,
                    events (
                        id,
                        name
                    )
                `)
                .order("name", { ascending: true })

            if (error) throw error
            classesList.value = data || []
        } catch (err) {
            console.error("Error fetching classes:", err)
        }
    }

    const handleCreateClass = async () => {
        if (!newClassName.value.trim() || !selectedSeasonInModal.value?.event_id) {
            showToast("Nama kelas dan season wajib dipilih", "error")
            return
        }
        creatingClass.value = true
        try {
            const { data, error } = await $supabase
                .from("classes")
                .insert({
                    event_id: selectedSeasonInModal.value.event_id,
                    name: newClassName.value.trim()
                })
                .select("id, name, event_id")
                .single()

            if (error) throw error
            await fetchClasses()
            championshipForm.class_id = data.id
            newClassName.value = ""
            showAddClassInput.value = false
            showToast("Kelas berhasil ditambahkan!")
        } catch (err) {
            console.error("Error creating class:", err)
            showToast(err.message || "Gagal menambahkan kelas", "error")
        } finally {
            creatingClass.value = false
        }
    }

    // A season is one numbered season of an event (e.g. Masters League S7).
    const fetchSeasons = async () => {
        try {
            const { data, error } = await $supabase
                .from("seasons")
                .select(`
                    id,
                    season_number,
                    event_id,
                    created_at,
                    events (
                        id,
                        name,
                        organizers (
                            abbreviation,
                            name
                        ),
                        games (
                            abbreviation
                        )
                    )
                `)
                .order("season_number", { ascending: false })

            if (error) throw error
            seasonsList.value = data || []
        } catch (err) {
            console.error("Error fetching seasons:", err)
            showToast(err.message || "Gagal memuat season", "error")
        }
    }

    // Display label for a season row, used across selects and chips: Organizer - Event (Season)
    const getSeasonLabel = (season) => {
        if (!season) return "-"
        const organizer = season.events?.organizers?.abbreviation || season.events?.organizers?.name || ""
        const eventName = season.events?.name || "Event"
        const seasonText = `S${season.season_number}`
        if (organizer) {
            return `${organizer} ${eventName} (${seasonText})`
        }
        return `${eventName} (${seasonText})`
    }

    // Alphabetical by label so the long season list stays scannable.
    // numeric collation keeps S2 before S10.
    const sortedSeasonsList = computed(() => {
        return [...seasonsList.value].sort((a, b) =>
            getSeasonLabel(a).localeCompare(getSeasonLabel(b), undefined, { numeric: true, sensitivity: "base" })
        )
    })

    const selectedSeason = computed(() => {
        return seasonsList.value.find(s => s.id === selectedSeasonId.value) || null
    })

    // Championship naming helpers based on class and standings type
    const getChampionshipName = (champ) => {
        if (!champ) return "-"
        const className = champ.classes?.name || (champ.class_id ? "Kelas Khusus" : "Overall")
        const typeLabel = champ.standings_type === "driver" ? "Pembalap" : "Tim"
        return `${className} (${typeLabel})`
    }

    const getChampionshipFullName = (champ) => {
        if (!champ) return "-"
        const seasonLabel = champ.seasons ? getSeasonLabel(champ.seasons) : ""
        const champName = getChampionshipName(champ)
        return seasonLabel ? `${seasonLabel} - ${champName}` : champName
    }

    const fetchChampionships = async () => {
        loadingChampionships.value = true
        try {
            const { data, error } = await $supabase
                .from("championships")
                .select(`
                    id,
                    season_id,
                    standings_type,
                    class_id,
                    created_at,
                    classes (
                        id,
                        name,
                        event_id
                    ),
                    seasons (
                        id,
                        season_number,
                        event_id,
                        events (
                            id,
                            name,
                            organizers (
                                abbreviation
                            )
                        )
                    ),
                    championship_events (
                        id
                    )
                `)
                .order("created_at", { ascending: false })

            if (error) throw error
            championships.value = data || []
        } catch (err) {
            console.error("Error fetching championships:", err)
            showToast(err.message || "Gagal memuat championship", "error")
        } finally {
            loadingChampionships.value = false
        }
    }

    const selectedChampionship = computed(() => {
        return championships.value.find(c => c.id === selectedChampionshipId.value) || null
    })

    // Season dropdown doubles as a filter for the championship list.
    const filteredChampionships = computed(() => {
        if (!selectedSeasonId.value) return championships.value
        return championships.value.filter(c => c.season_id === selectedSeasonId.value)
    })

    // Clear a championship that the season filter has hidden.
    watch(selectedSeasonId, () => {
        if (!selectedChampionshipId.value) return
        if (!filteredChampionships.value.some(c => c.id === selectedChampionshipId.value)) {
            selectedChampionshipId.value = ""
        }
    })

    // Most-used points system among the championship's rounds acts as the
    // inherited default for newly added rounds.
    const championshipDefaultSystemId = computed(() => {
        const counts = new Map()
        championshipRounds.value.forEach(r => {
            if (!r.points_system_id) return
            counts.set(r.points_system_id, (counts.get(r.points_system_id) || 0) + 1)
        })
        let best = ""
        let bestCount = 0
        counts.forEach((count, id) => {
            if (count > bestCount) {
                best = id
                bestCount = count
            }
        })
        return best || (pointsSystems.value[0]?.id || "")
    })

    const fetchChampionshipRounds = async () => {
        if (!selectedChampionshipId.value) {
            championshipRounds.value = []
            return
        }
        loadingRounds.value = true
        try {
            const { data, error } = await $supabase
                .from("championship_events")
                .select(`
                    id,
                    championship_id,
                    schedule_id,
                    session_type,
                    points_system_id,
                    points_multiplier,
                    schedule (
                        id,
                        round,
                        circuit,
                        date,
                        season,
                        country,
                        events (
                            name,
                            organizers (
                                abbreviation
                            ),
                            games (
                                abbreviation
                            )
                        )
                    )
                `)
                .eq("championship_id", selectedChampionshipId.value)

            if (error) throw error

            const rows = data || []
            rows.sort((a, b) => {
                const da = a.schedule?.date ? new Date(a.schedule.date).getTime() : 0
                const db = b.schedule?.date ? new Date(b.schedule.date).getTime() : 0
                if (da !== db) return da - db
                return String(a.session_type).localeCompare(String(b.session_type))
            })
            championshipRounds.value = rows
        } catch (err) {
            console.error("Error fetching championship rounds:", err)
            showToast(err.message || "Gagal memuat ronde championship", "error")
        } finally {
            loadingRounds.value = false
        }
    }

    const fetchStandings = async () => {
        if (!selectedChampionshipId.value) {
            standingsRows.value = []
            return
        }
        loadingStandings.value = true
        try {
            let { data, error } = await $supabase
                .from("standings")
                .select(`
                    id,
                    entity_type,
                    driver_id,
                    team_id,
                    car_number,
                    points,
                    wins,
                    podiums,
                    position,
                    updated_at,
                    drivers (
                        id,
                        name,
                        country_name,
                        countries (
                            code
                        )
                    ),
                    teams (
                        id,
                        name
                    )
                `)
                .eq("championship_id", selectedChampionshipId.value)
                .order("position", { ascending: true })

            if (error && (error.message?.includes("car_number") || error.code === "PGRST204" || error.code === "42703")) {
                const res = await $supabase
                    .from("standings")
                    .select(`
                        id,
                        entity_type,
                        driver_id,
                        team_id,
                        points,
                        wins,
                        podiums,
                        position,
                        updated_at,
                        drivers (
                            id,
                            name,
                            country_name,
                            countries (
                                code
                            )
                        ),
                        teams (
                            id,
                            name
                        )
                    `)
                    .eq("championship_id", selectedChampionshipId.value)
                    .order("position", { ascending: true })
                data = res.data
                error = res.error
            }

            if (error) throw error
            standingsRows.value = data || []
        } catch (err) {
            console.error("Error fetching standings:", err)
            showToast(err.message || "Gagal memuat klasemen", "error")
        } finally {
            loadingStandings.value = false
        }
    }

    // Rounds that already have results saved, so the UI can show which
    // rounds actually contribute points.
    const roundsWithResults = ref(new Set())

    const fetchRoundsResultStatus = async () => {
        const scheduleIds = [...new Set(championshipRounds.value.map(r => r.schedule_id))]
        if (scheduleIds.length === 0) {
            roundsWithResults.value = new Set()
            return
        }
        try {
            const sessions = await fetchSessionsForScoring($supabase, scheduleIds)
            const keys = new Set()
            sessions.forEach(s => {
                if (s.results.length > 0) keys.add(`${s.schedule_id}::${s.session_type}`)
            })
            roundsWithResults.value = keys
        } catch (err) {
            console.warn("Error checking round results:", err)
        }
    }

    const roundHasResults = (round) => {
        return roundsWithResults.value.has(`${round.schedule_id}::${round.session_type}`)
    }

    const loadChampionshipDetail = async () => {
        await fetchChampionshipRounds()
        if (selectedChampionship.value) {
            standingsViewType.value = selectedChampionship.value.standings_type || "driver"
        }
        await Promise.all([fetchStandings(), fetchRoundsResultStatus()])
    }

    // ---- Season CRUD ----
    const openCreateSeasonModal = () => {
        seasonModalMode.value = "create"
        editingSeasonId.value = null
        seasonForm.event_id = ""
        seasonForm.season_number = 1
        seasonPassword.value = ""
        seasonPasswordError.value = ""
        showSeasonPassword.value = false
        isSeasonModalOpen.value = true
    }

    const openEditSeasonModal = (season) => {
        seasonModalMode.value = "edit"
        editingSeasonId.value = season.id
        seasonForm.event_id = season.event_id || ""
        seasonForm.season_number = season.season_number || 1
        seasonPassword.value = ""
        seasonPasswordError.value = ""
        showSeasonPassword.value = false
        isSeasonModalOpen.value = true
    }

    const closeSeasonModal = () => {
        isSeasonModalOpen.value = false
        seasonPassword.value = ""
        seasonPasswordError.value = ""
        showSeasonPassword.value = false
    }

    const saveSeason = async () => {
        seasonPasswordError.value = ""
        if (seasonPassword.value !== CRUD_PASS) {
            seasonPasswordError.value = "Password admin salah!"
            return
        }
        if (!seasonForm.event_id) {
            showToast("Pilih event terlebih dahulu", "error")
            return
        }
        if (!seasonForm.season_number || Number(seasonForm.season_number) < 1) {
            showToast("Nomor season wajib diisi", "error")
            return
        }

        savingSeason.value = true
        try {
            const payload = {
                event_id: seasonForm.event_id,
                season_number: Number(seasonForm.season_number)
            }

            if (editingSeasonId.value) {
                const { error } = await $supabase.from("seasons").update(payload).eq("id", editingSeasonId.value)
                if (error) throw error
            } else {
                const { error } = await $supabase.from("seasons").insert(payload)
                if (error) throw error
            }

            showToast(editingSeasonId.value ? "Season berhasil diperbarui!" : "Season berhasil dibuat!")
            closeSeasonModal()
            await fetchSeasons()
        } catch (err) {
            console.error("Error saving season:", err)
            showToast(err.message || "Gagal menyimpan season", "error")
        } finally {
            savingSeason.value = false
        }
    }

    // ---- Championship CRUD ----
    const openCreateChampionshipModal = () => {
        championshipModalMode.value = "create"
        editingChampionshipId.value = null
        championshipForm.season_id = selectedSeasonId.value || sortedSeasonsList.value[0]?.id || ""
        championshipForm.class_id = ""
        championshipForm.standings_type = "driver"
        championshipForm.default_points_system_id = pointsSystems.value[0]?.id || ""
        showAddClassInput.value = false
        newClassName.value = ""
        championshipPassword.value = ""
        championshipPasswordError.value = ""
        showChampionshipPassword.value = false
        isChampionshipModalOpen.value = true
    }

    const openEditChampionshipModal = (champ) => {
        championshipModalMode.value = "edit"
        editingChampionshipId.value = champ.id
        championshipForm.season_id = champ.season_id || ""
        championshipForm.class_id = champ.class_id || ""
        championshipForm.standings_type = champ.standings_type || "driver"
        championshipForm.default_points_system_id = ""
        showAddClassInput.value = false
        newClassName.value = ""
        championshipPassword.value = ""
        championshipPasswordError.value = ""
        showChampionshipPassword.value = false
        isChampionshipModalOpen.value = true
    }

    const closeChampionshipModal = () => {
        isChampionshipModalOpen.value = false
        showAddClassInput.value = false
        newClassName.value = ""
        championshipPassword.value = ""
        championshipPasswordError.value = ""
        showChampionshipPassword.value = false
    }

    const saveChampionship = async () => {
        championshipPasswordError.value = ""
        if (championshipPassword.value !== CRUD_PASS) {
            championshipPasswordError.value = "Password admin salah!"
            return
        }
        if (!championshipForm.season_id) {
            showToast("Pilih season terlebih dahulu", "error")
            return
        }

        savingChampionship.value = true
        try {
            const payload = {
                season_id: championshipForm.season_id,
                class_id: championshipForm.class_id || null,
                standings_type: championshipForm.standings_type
            }

            let champId = editingChampionshipId.value
            const wasEdit = Boolean(champId)

            if (champId) {
                const { error } = await $supabase.from("championships").update(payload).eq("id", champId)
                if (error) throw error
            } else {
                const { data, error } = await $supabase
                    .from("championships")
                    .insert(payload)
                    .select("id")
                    .single()
                if (error) throw error
                champId = data.id
            }

            showToast(wasEdit ? "Championship berhasil diperbarui!" : "Championship berhasil dibuat!")
            closeChampionshipModal()
            await fetchChampionships()
            selectedChampionshipId.value = champId
            await loadChampionshipDetail()

            // Changing driver/team scoring changes the whole table.
            if (wasEdit) await handleRecalculateChampionship(true)
        } catch (err) {
            console.error("Error saving championship:", err)
            showToast(err.message || "Gagal menyimpan championship", "error")
        } finally {
            savingChampionship.value = false
        }
    }

    const openDeleteChampionshipModal = (champ) => {
        deletingChampionshipItem.value = champ
        championshipDeletePassword.value = ""
        championshipDeletePasswordError.value = ""
        showChampionshipDeletePassword.value = false
        isChampionshipDeleteModalOpen.value = true
    }

    const closeDeleteChampionshipModal = () => {
        isChampionshipDeleteModalOpen.value = false
        deletingChampionshipItem.value = null
        championshipDeletePassword.value = ""
        championshipDeletePasswordError.value = ""
        showChampionshipDeletePassword.value = false
    }

    const confirmDeleteChampionship = async () => {
        championshipDeletePasswordError.value = ""
        if (championshipDeletePassword.value !== CRUD_PASS) {
            championshipDeletePasswordError.value = "Password admin salah!"
            return
        }
        if (!deletingChampionshipItem.value) return

        deleting.value = true
        try {
            const champId = deletingChampionshipItem.value.id
            // Children first: standings and rounds both FK to championships.
            await $supabase.from("standings").delete().eq("championship_id", champId)
            await $supabase.from("championship_events").delete().eq("championship_id", champId)
            const { error } = await $supabase.from("championships").delete().eq("id", champId)
            if (error) throw error

            showToast("Championship berhasil dihapus!")
            closeDeleteChampionshipModal()
            if (selectedChampionshipId.value === champId) {
                selectedChampionshipId.value = ""
                championshipRounds.value = []
                standingsRows.value = []
            }
            await fetchChampionships()
        } catch (err) {
            console.error("Error deleting championship:", err)
            showToast(err.message || "Gagal menghapus championship", "error")
        } finally {
            deleting.value = false
        }
    }

    // ---- Rounds (championship_events) ----
    const availableRoundsToAdd = computed(() => {
        const existing = new Set(championshipRounds.value.map(r => `${r.schedule_id}::${r.session_type}`))
        const list = allSchedulesList.value.length > 0 ? allSchedulesList.value : schedules.value
        const q = addRoundsSearch.value.trim().toLowerCase()
        const words = q ? q.split(/\s+/).filter(Boolean) : []

        const out = []
        for (const sched of list) {
            if (words.length > 0) {
                const orgAbbr = sched.events?.organizers?.abbreviation || ""
                const orgName = sched.events?.organizers?.name || ""
                const evName = sched.events?.name || ""
                const circuit = sched.circuit || ""
                const round = String(sched.round || "")
                const season = sched.season ? `s${sched.season} season ${sched.season}` : ""
                const dateStr = sched.date ? formatDateOnly(sched.date) : ""
                const hay = `${dateStr} ${orgAbbr} ${evName} ${orgName} ${season} round ${round} ${circuit}`.toLowerCase()
                if (!words.every(w => hay.includes(w))) continue
            }
            for (const opt of sessionTypeOptions) {
                const key = `${sched.id}::${opt.value}`
                if (existing.has(key)) continue
                out.push({
                    key,
                    schedule_id: sched.id,
                    session_type: opt.value,
                    sessionLabel: opt.label,
                    schedule: sched
                })
            }
        }
        return out
    })

    const openAddRoundsModal = () => {
        if (!selectedChampionshipId.value) {
            showToast("Pilih championship terlebih dahulu", "error")
            return
        }
        if (pointsSystems.value.length === 0) {
            showToast("Buat sistem poin terlebih dahulu di tab Sistem Poin", "error")
            return
        }
        addRoundsSearch.value = ""
        addRoundsSelection.value = []
        isAddRoundsModalOpen.value = true
    }

    const closeAddRoundsModal = () => {
        isAddRoundsModalOpen.value = false
        addRoundsSelection.value = []
        addRoundsSearch.value = ""
    }

    const toggleRoundSelection = (key) => {
        const idx = addRoundsSelection.value.indexOf(key)
        if (idx >= 0) addRoundsSelection.value.splice(idx, 1)
        else addRoundsSelection.value.push(key)
    }

    const isRoundSelected = (key) => addRoundsSelection.value.includes(key)

    const selectAllVisibleRounds = () => {
        // Race sessions only: qualifying rarely scores championship points.
        const raceKeys = availableRoundsToAdd.value
            .filter(r => r.session_type !== "qualifying")
            .map(r => r.key)
        addRoundsSelection.value = [...new Set([...addRoundsSelection.value, ...raceKeys])]
    }

    const confirmAddRounds = async () => {
        if (addRoundsSelection.value.length === 0) {
            showToast("Pilih minimal 1 ronde", "error")
            return
        }
        const defaultSystem = championshipDefaultSystemId.value
        if (!defaultSystem) {
            showToast("Tidak ada sistem poin tersedia", "error")
            return
        }

        savingRounds.value = true
        try {
            const payload = addRoundsSelection.value.map(key => {
                const [scheduleId, sessionType] = key.split("::")
                return {
                    championship_id: selectedChampionshipId.value,
                    schedule_id: scheduleId,
                    session_type: sessionType,
                    points_system_id: defaultSystem,
                    points_multiplier: 1
                }
            })

            const { error } = await $supabase.from("championship_events").insert(payload)
            if (error) throw error

            showToast(`${payload.length} ronde berhasil ditambahkan!`)
            closeAddRoundsModal()
            await fetchChampionships()
            await loadChampionshipDetail()
            await handleRecalculateChampionship(true)
        } catch (err) {
            console.error("Error adding rounds:", err)
            showToast(err.message || "Gagal menambahkan ronde", "error")
        } finally {
            savingRounds.value = false
        }
    }

    const updateRoundConfig = async (round, field, value) => {
        try {
            const payload = {}
            if (field === "points_system_id") payload.points_system_id = value || null
            else if (field === "points_multiplier") payload.points_multiplier = Number(value) || 1
            else return

            const { error } = await $supabase
                .from("championship_events")
                .update(payload)
                .eq("id", round.id)
            if (error) throw error

            Object.assign(round, payload)
            showToast("Konfigurasi ronde diperbarui")
            await handleRecalculateChampionship(true)
        } catch (err) {
            console.error("Error updating round:", err)
            showToast(err.message || "Gagal memperbarui ronde", "error")
            await fetchChampionshipRounds()
        }
    }

    const removeRoundFromChampionship = async (round) => {
        try {
            const { error } = await $supabase.from("championship_events").delete().eq("id", round.id)
            if (error) throw error
            showToast("Ronde dihapus dari championship")
            await fetchChampionships()
            await loadChampionshipDetail()
            await handleRecalculateChampionship(true)
        } catch (err) {
            console.error("Error removing round:", err)
            showToast(err.message || "Gagal menghapus ronde", "error")
        }
    }

    // Apply the championship default points system to every round at once.
    const applyDefaultSystemToAllRounds = async (systemId) => {
        if (!systemId || championshipRounds.value.length === 0) return
        try {
            const { error } = await $supabase
                .from("championship_events")
                .update({ points_system_id: systemId })
                .eq("championship_id", selectedChampionshipId.value)
            if (error) throw error
            showToast("Sistem poin diterapkan ke semua ronde")
            await loadChampionshipDetail()
            await handleRecalculateChampionship(true)
        } catch (err) {
            console.error("Error applying default system:", err)
            showToast(err.message || "Gagal menerapkan sistem poin", "error")
        }
    }

    // ---- Recalculation ----
    const handleRecalculateChampionship = async (silent = false) => {
        if (!selectedChampionship.value) return
        recalculating.value = true
        try {
            const summary = await recalculateChampionship($supabase, {
                id: selectedChampionship.value.id,
                name: getChampionshipName(selectedChampionship.value),
                standings_type: selectedChampionship.value.standings_type,
                class_id: selectedChampionship.value.class_id,
                season_id: selectedChampionship.value.season_id
            })
            await fetchStandings()
            if (!silent) {
                showToast(`Klasemen dihitung ulang: ${summary.rowsWritten} baris dari ${summary.roundsScored} ronde`)
            }
        } catch (err) {
            console.error("Error recalculating standings:", err)
            showToast(err.message || "Gagal menghitung ulang klasemen", "error")
        } finally {
            recalculating.value = false
        }
    }

    const recalculateChampionshipsUsingSystem = async (systemId) => {
        try {
            const { data } = await $supabase
                .from("championship_events")
                .select("championships ( id, standings_type, class_id, season_id, classes ( name ) )")
                .eq("points_system_id", systemId)

            const unique = new Map()
            for (const row of data || []) {
                const champ = row.championships
                if (champ && !unique.has(champ.id)) {
                    unique.set(champ.id, {
                        id: champ.id,
                        name: getChampionshipName(champ),
                        standings_type: champ.standings_type,
                        class_id: champ.class_id,
                        season_id: champ.season_id
                    })
                }
            }
            if (unique.size === 0) return

            for (const champ of unique.values()) {
                await recalculateChampionship($supabase, champ)
            }
            if (selectedChampionshipId.value) await fetchStandings()
            showToast(`${unique.size} championship dihitung ulang`)
        } catch (err) {
            console.error("Error recalculating affected championships:", err)
        }
    }

    // Standings rows filtered by the current driver/team toggle.
    const visibleStandings = computed(() => {
        return standingsRows.value.filter(r => r.entity_type === standingsViewType.value)
    })

    const standingsSummary = computed(() => {
        const rows = visibleStandings.value
        return {
            entities: rows.length,
            totalPoints: rows.reduce((sum, r) => sum + (Number(r.points) || 0), 0),
            rounds: championshipRounds.value.length,
            scoredRounds: championshipRounds.value.filter(r => roundHasResults(r)).length
        }
    })

    const getStandingsRowStyle = (position) => {
        if (position === 1) {
            return "bg-yellow-200/90 dark:bg-yellow-950/60 hover:bg-yellow-300/90 dark:hover:bg-yellow-900/60 text-yellow-700 dark:text-yellow-400 font-extrabold"
        } else if (position === 2) {
            return "bg-slate-200/90 dark:bg-slate-800/80 hover:bg-slate-300/90 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-extrabold"
        } else if (position === 3) {
            return "bg-amber-200/80 dark:bg-amber-950/50 hover:bg-amber-300/80 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-500 font-extrabold"
        }
        return "text-black dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800/50"
    }

    watch(selectedChampionshipId, () => {
        loadChampionshipDetail()
    })

    watch(activeTab, (newTab) => {
        if (newTab === "points" && pointsSystems.value.length === 0) {
            fetchPointsSystems()
        }
        if (newTab === "standings") {
            if (seasonsList.value.length === 0) fetchSeasons()
            if (classesList.value.length === 0) fetchClasses()
            if (championships.value.length === 0) fetchChampionships()
            if (pointsSystems.value.length === 0) fetchPointsSystems()
            if (allSchedulesList.value.length === 0) fetchAllSchedulesList()
        }
    })

    // ==========================================
    // GENERAL HELPERS & LIFECYCLE
    // ==========================================
    const fetchAllAdminData = () => {
        fetchSchedules()
        fetchAllSchedulesList()
        fetchEventsList()
        fetchDrivers()
        fetchTeams()
        fetchLookupData()
        fetchRentals()
        fetchPointsSystems()
        fetchSeasons()
        fetchClasses()
        fetchChampionships()
    }

    const handleRefreshCurrentTab = () => {
        if (activeTab.value === "schedule") fetchSchedules()
        else if (activeTab.value === "drivers") fetchDrivers()
        else if (activeTab.value === "teams") fetchTeams()
        else if (activeTab.value === "rentals") fetchRentals()
        else if (activeTab.value === "results") {
            fetchAllSchedulesList()
            fetchRaceResultsForSchedule()
        }
        else if (activeTab.value === "points") fetchPointsSystems()
        else if (activeTab.value === "standings") {
            fetchSeasons()
            fetchClasses()
            fetchChampionships()
            loadChampionshipDetail()
        }
    }

    const handleCreateCurrentTab = () => {
        if (activeTab.value === "schedule") openCreateModal()
        else if (activeTab.value === "drivers") openCreateDriverModal()
        else if (activeTab.value === "teams") openCreateTeamModal()
        else if (activeTab.value === "rentals") openCreateRentalModal()
        else if (activeTab.value === "results") addResultRow()
        else if (activeTab.value === "points") openCreatePointsSystemModal()
        else if (activeTab.value === "standings") openCreateChampionshipModal()
    }

    const getCreateButtonLabel = () => {
        if (activeTab.value === "schedule") return "Tambah Jadwal"
        if (activeTab.value === "drivers") return "Tambah Pembalap"
        if (activeTab.value === "teams") return "Tambah Tim"
        if (activeTab.value === "rentals") return "Tambah Rental"
        if (activeTab.value === "results") return "Tambah Baris Posisi"
        if (activeTab.value === "points") return "Tambah Sistem Poin"
        if (activeTab.value === "standings") return "Tambah Championship"
        return "Tambah"
    }

    onMounted(() => {
        if (sessionStorage.getItem("admin_authenticated") === "true") {
            isAuthenticated.value = true
            fetchAllAdminData()
        }
    })
</script>

<template>
    <div class="bg-white dark:bg-slate-900 min-h-screen">
        <!-- Toast Notification -->
        <Transition
            enter-active-class="transition ease-out duration-300 transform"
            enter-from-class="opacity-0 -translate-y-4"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition ease-in duration-200 transform"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-4"
        >
            <div
                v-if="toastMessage"
                class="fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-xl text-white font-semibold flex items-center gap-3"
                :class="toastType === 'success' ? 'bg-emerald-600' : 'bg-red-600'"
            >
                <Icon :name="toastType === 'success' ? 'material-symbols:check-circle' : 'material-symbols:error'" class="text-xl" />
                <span>{{ toastMessage }}</span>
            </div>
        </Transition>

        <!-- Login Gate Screen (Unauthenticated) -->
        <div v-if="!isAuthenticated" class="min-h-screen flex items-center justify-center px-4 py-12">
            <div class="max-w-md w-full bg-white dark:bg-slate-950 p-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col gap-6">
                <div class="flex flex-col items-center text-center gap-2">
                    <h1 class="text-2xl font-bold text-black dark:text-white">Akses Admin</h1>
                </div>

                <form @submit.prevent="handleLogin" class="flex flex-col gap-4">
                    <div class="flex flex-col gap-1">
                        <label class="text-sm font-semibold text-black dark:text-white">Password Admin</label>
                        <div class="relative flex items-center">
                            <input
                                v-model="loginPasswordInput"
                                :type="showLoginPassword ? 'text' : 'password'"
                                required
                                autofocus
                                placeholder="Masukkan password admin"
                                @input="loginPasswordError = ''"
                                class="p-3 pr-10 rounded-lg border-2 bg-white dark:bg-slate-900 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="loginPasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showLoginPassword = !showLoginPassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showLoginPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="loginPasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold mt-1">
                            {{ loginPasswordError }}
                        </p>
                    </div>

                    <button
                        type="submit"
                        class="w-full py-3 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2"
                    >
                        <span>Masuk ke Admin</span>
                    </button>
                </form>
            </div>
        </div>

        <!-- Admin Dashboard Content (Authenticated) -->
        <div v-else class="px-4 lg:px-16 py-8 flex flex-col gap-6">
            <!-- Header Section -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-6">
                <div>
                    <h1 class="text-2xl lg:text-3xl font-extrabold text-black dark:text-white flex items-center gap-2">
                        Admin Page
                    </h1>
                </div>
                <div class="flex items-center gap-3">
                    <button
                        @click="handleRefreshCurrentTab"
                        :disabled="loading"
                        class="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                        <Icon name="material-symbols:refresh" :class="{ 'animate-spin': loading }" class="text-lg" />
                        <span>Refresh</span>
                    </button>
                    <button
                        @click="handleCreateCurrentTab"
                        class="flex items-center gap-2 px-4 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition cursor-pointer shadow-md"
                    >
                        <Icon name="material-symbols:add-circle-outline" class="text-lg" />
                        <span>{{ getCreateButtonLabel() }}</span>
                    </button>
                    <button
                        @click="handleLogout"
                        class="flex items-center gap-2 px-3.5 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer"
                        title="Keluar dari Admin"
                    >
                        <Icon name="material-symbols:logout" class="text-lg" />
                        <span>Keluar</span>
                    </button>
                </div>
            </div>

            <!-- Tab Navigation Dropdown Selector -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-slate-800 pb-4">
                <div class="flex items-center gap-3 w-full sm:w-auto">
                    <label class="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 shrink-0">Pilih Menu:</label>
                    <div class="relative w-full sm:w-80">
                        <div class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-red-900 dark:text-red-400">
                            <Icon :name="adminTabs.find(t => t.id === activeTab)?.icon || 'material-symbols:menu'" class="text-xl" />
                        </div>
                        <select
                            v-model="activeTab"
                            class="w-full pl-10 pr-10 py-2.5 appearance-none rounded-xl border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-900 text-black dark:text-white text-xs sm:text-sm font-bold shadow-xs focus:outline-none cursor-pointer"
                        >
                            <option v-for="tab in adminTabs" :key="tab.id" :value="tab.id">
                                {{ tab.label }} ({{ tab.count !== null && tab.count !== undefined ? tab.count : 0 }})
                            </option>
                        </select>
                        <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 top-1/2 -translate-y-1/2 text-xl text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <div class="hidden sm:flex items-center gap-2">
                    <span class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-2 shadow-xs">
                        <Icon :name="adminTabs.find(t => t.id === activeTab)?.icon || ''" class="text-base" />
                        <span>{{ adminTabs.find(t => t.id === activeTab)?.label }}</span>
                    </span>
                </div>
            </div>

            <!-- TAB 1: SCHEDULE MANAGEMENT -->
            <div v-if="activeTab === 'schedule'" class="flex flex-col gap-6">
                <!-- Filter & Search Controls Bar -->
                <div class="bg-red-50 dark:bg-slate-950 p-4 rounded-xl border border-red-200 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div class="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <button
                            @click="timeFilter = 'week'"
                            class="px-3 py-1.5 text-xs lg:text-sm font-bold rounded-lg transition cursor-pointer border"
                            :class="timeFilter === 'week' 
                                ? 'bg-red-900 dark:bg-red-900 text-white border-red-900 dark:border-red-900 shadow-sm' 
                                : 'bg-white dark:bg-slate-900 text-black dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800'"
                        >
                            Dalam 1 Minggu
                        </button>
                        <button
                            @click="timeFilter = 'month'"
                            class="px-3 py-1.5 text-xs lg:text-sm font-bold rounded-lg transition cursor-pointer border"
                            :class="timeFilter === 'month' 
                                ? 'bg-red-900 dark:bg-red-900 text-white border-red-900 dark:border-red-900 shadow-sm' 
                                : 'bg-white dark:bg-slate-900 text-black dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800'"
                        >
                            Bulan Ini
                        </button>
                        <button
                            @click="timeFilter = 'all'"
                            class="px-3 py-1.5 text-xs lg:text-sm font-bold rounded-lg transition cursor-pointer border"
                            :class="timeFilter === 'all' 
                                ? 'bg-red-900 dark:bg-red-900 text-white border-red-900 dark:border-red-900 shadow-sm' 
                                : 'bg-white dark:bg-slate-900 text-black dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800'"
                        >
                            Semua Data
                        </button>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                        <!-- Specific Date Filter -->
                        <div class="flex items-center gap-1.5 w-full sm:w-auto">
                            <label class="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0">Tanggal:</label>
                            <div class="relative flex items-center w-full sm:w-auto">
                                <input
                                    v-model="scheduleDateFilter"
                                    type="date"
                                    class="p-1.5 pr-7 text-xs font-medium rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-900 text-black dark:text-white focus:outline-none w-full sm:w-auto cursor-pointer"
                                />
                                <button
                                    v-if="scheduleDateFilter"
                                    type="button"
                                    @click="scheduleDateFilter = ''"
                                    class="absolute right-2 text-gray-400 hover:text-red-600 transition cursor-pointer flex items-center"
                                    title="Hapus filter tanggal"
                                >
                                    <Icon name="material-symbols:close" class="text-sm" />
                                </button>
                            </div>
                        </div>

                        <!-- Search Bar -->
                        <div class="relative w-full sm:w-64">
                            <input
                                v-model="scheduleSearchQuery"
                                type="text"
                                placeholder="Cari event / sirkuit / tanggal"
                                class="w-full pl-4 pr-4 py-1.5 text-sm rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>
                    </div>
                </div>

                <!-- Schedule Data Counter & Items Per Page -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium px-1 gap-2">
                    <span>
                        Menampilkan <b class="text-black dark:text-white">{{ filteredSchedules.length > 0 ? (scheduleCurrentPage - 1) * scheduleItemsPerPage + 1 : 0 }}</b> - <b class="text-black dark:text-white">{{ Math.min(scheduleCurrentPage * scheduleItemsPerPage, filteredSchedules.length) }}</b> dari <b class="text-black dark:text-white">{{ filteredSchedules.length }}</b> total data
                    </span>
                    <div class="flex items-center gap-2">
                        <label class="text-xs">Tampilkan per halaman:</label>
                        <select
                            v-model="scheduleItemsPerPage"
                            class="p-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs cursor-pointer focus:outline-none"
                        >
                            <option v-for="opt in itemsPerPageOptions" :key="opt" :value="opt">{{ opt }}</option>
                        </select>
                    </div>
                </div>

                <!-- Schedule Table -->
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                    <table class="w-full min-w-[1000px] table-fixed text-left border-collapse">
                        <thead class="bg-red-900 dark:bg-red-900 text-white">
                            <tr>
                                <th class="px-3 sm:px-4 py-3 w-[18%]">Tanggal</th>
                                <th class="px-2 sm:px-3 py-3 w-[6%]">Waktu</th>
                                <th class="px-3 sm:px-4 py-3 w-[26%]">Event</th>
                                <th class="px-1.5 sm:px-2 py-3 w-[6%]">Round</th>
                                <th class="px-3 sm:px-4 py-3 w-[25%]">Sirkuit</th>
                                <th class="px-2 sm:px-3 py-3 text-center w-[9%]">Stream</th>
                                <th class="px-2 sm:px-3 py-3 text-center w-[10%]">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-950 text-sm">
                            <tr v-if="loading" class="text-center py-8">
                                <td colspan="7" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <div class="flex items-center justify-center gap-2">
                                        <Icon name="material-symbols:refresh" class="animate-spin text-xl text-red-700" />
                                        <span>Memuat data jadwal balapan...</span>
                                    </div>
                                </td>
                            </tr>

                            <tr v-else-if="filteredSchedules.length === 0" class="text-center py-8">
                                <td colspan="7" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <div class="flex flex-col items-center justify-center gap-2">
                                        <span>Jadwal tidak ditemukan</span>
                                    </div>
                                </td>
                            </tr>

                            <tr
                                v-for="item in paginatedSchedules"
                                :key="item.id"
                                @click="openEditModal(item)"
                                class="cursor-pointer transition-colors text-black dark:text-white"
                                :class="getEventRowStyle(item.events?.name)"
                            >
                                <td class="px-3 sm:px-4 py-3 whitespace-nowrap text-xs lg:text-sm">
                                    {{ formatDateOnly(item.date) }}
                                </td>

                                <td class="px-2 sm:px-3 py-3 whitespace-nowrap text-xs lg:text-sm">
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

                                <td class="px-1.5 sm:px-2 py-3 whitespace-nowrap">
                                    {{ item.round || '' }}
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

                                <td class="px-2 sm:px-3 py-3 text-center whitespace-nowrap" @click.stop>
                                    <div class="flex items-center justify-center gap-1">
                                        <a
                                            v-if="item.stream_link"
                                            :href="item.stream_link"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="px-2.5 py-1 rounded-full text-xs font-bold transition bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900 border border-red-300 dark:border-red-800 inline-flex items-center justify-center gap-1"
                                        >
                                            Stream
                                        </a>
                                        <NuxtLink
                                            v-if="hasScheduleResult(item)"
                                            :to="`/results/${item.id}`"
                                            target="_blank"
                                            class="px-2.5 py-1 rounded-full text-xs font-bold transition inline-flex items-center justify-center gap-0.5 border bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800 shadow-xs"
                                            title="Lihat Hasil Balapan"
                                        >
                                            <span>Hasil</span>
                                        </NuxtLink>
                                        <span v-if="!item.stream_link && !hasScheduleResult(item)" class="text-xs text-gray-400 dark:text-gray-600">-</span>
                                    </div>
                                </td>

                                <td class="px-2 sm:px-3 py-3 text-center whitespace-nowrap">
                                    <span
                                        class="px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 select-none"
                                        :class="getStatusBadgeClass(getScheduleStatus(item))"
                                    >
                                        {{ getScheduleStatus(item) }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Schedule Pagination Controls -->
                <div v-if="scheduleTotalPages > 1" class="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        Halaman {{ scheduleCurrentPage }} dari {{ scheduleTotalPages }}
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button
                            @click="scheduleCurrentPage > 1 && scheduleCurrentPage--"
                            :disabled="scheduleCurrentPage === 1"
                            class="p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-black dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center"
                        >
                            <Icon name="mi:chevron-left" size="1.2em" />
                        </button>
                        <span class="px-3 py-1 font-bold text-xs">{{ scheduleCurrentPage }} / {{ scheduleTotalPages }}</span>
                        <button
                            @click="scheduleCurrentPage < scheduleTotalPages && scheduleCurrentPage++"
                            :disabled="scheduleCurrentPage === scheduleTotalPages"
                            class="p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-black dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center"
                        >
                            <Icon name="mi:chevron-right" size="1.2em" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- TAB 2: DRIVERS DATABASE MANAGEMENT -->
            <div v-else-if="activeTab === 'drivers'" class="flex flex-col gap-6">
                <!-- Filter & Search Controls Bar -->
                <div class="bg-red-50 dark:bg-slate-950 p-4 rounded-xl border border-red-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <label class="text-xs font-bold text-gray-700 dark:text-gray-300">Rating:</label>
                        <button
                            @click="driverRatingFilter = 'all'"
                            class="px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer border"
                            :class="driverRatingFilter === 'all'
                                ? 'bg-red-900 text-white border-red-900 shadow-sm'
                                : 'bg-white dark:bg-slate-900 text-black dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800'"
                        >
                            Semua
                        </button>
                        <button
                            v-for="r in ratingOptions"
                            :key="r"
                            @click="driverRatingFilter = r"
                            class="px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer border"
                            :class="driverRatingFilter === r
                                ? 'bg-red-900 text-white border-red-900 shadow-sm'
                                : 'bg-white dark:bg-slate-900 text-black dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800'"
                        >
                            {{ r }}
                        </button>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <!-- Sort Control Dropdown -->
                        <div class="flex items-center gap-1.5 w-full sm:w-auto">
                            <label class="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0">Urutkan:</label>
                            <select
                                v-model="driverSortBy"
                                class="p-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white cursor-pointer focus:outline-none"
                            >
                                <option value="rating">Rating</option>
                                <option value="name">Nama Pembalap</option>
                                <option value="team">Tim</option>
                            </select>
                            <button
                                type="button"
                                @click="driverSortOrder = driverSortOrder === 'asc' ? 'desc' : 'asc'"
                                class="p-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs font-medium shrink-0"
                                :title="driverSortOrder === 'asc' ? 'Menaik (A-Z / Ascending)' : 'Menurun (Z-A / Descending)'"
                            >
                                <Icon :name="driverSortOrder === 'asc' ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'" class="text-sm text-red-700" />
                                <span class="text-xs font-bold">{{ driverSortOrder === 'asc' ? 'A-Z' : 'Z-A' }}</span>
                            </button>
                        </div>

                        <div class="relative w-full sm:w-64">
                            <input
                                v-model="driverSearchQuery"
                                type="text"
                                placeholder="Cari nama / tim / negara"
                                class="w-full pl-4 pr-4 py-1.5 text-sm rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>
                    </div>
                </div>

                <!-- Driver Data Counter & Items Per Page -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium px-1 gap-2">
                    <span>
                        Menampilkan <b class="text-black dark:text-white">{{ filteredDrivers.length > 0 ? (driverCurrentPage - 1) * driverItemsPerPage + 1 : 0 }}</b> - <b class="text-black dark:text-white">{{ Math.min(driverCurrentPage * driverItemsPerPage, filteredDrivers.length) }}</b> dari <b class="text-black dark:text-white">{{ filteredDrivers.length }}</b> total pembalap
                    </span>
                    <div class="flex flex-wrap items-center gap-3">
                        <button
                            @click="handleExportAdminDrivers"
                            class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-sm"
                            title="Ekspor data pembalap ke Excel"
                        >
                            <Icon name="material-symbols:download" class="text-base" />
                            <span>Ekspor Excel</span>
                        </button>
                        <button
                            @click="openDriverImportModal"
                            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-sm"
                            title="Impor data pembalap dari Excel"
                        >
                            <Icon name="material-symbols:upload" class="text-base" />
                            <span>Impor Excel</span>
                        </button>
                        <div class="flex items-center gap-2">
                            <label class="text-xs">Tampilkan per halaman:</label>
                            <select
                                v-model="driverItemsPerPage"
                                class="p-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs cursor-pointer focus:outline-none"
                            >
                                <option v-for="opt in itemsPerPageOptions" :key="opt" :value="opt">{{ opt }}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Drivers Table -->
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                    <table class="w-full min-w-[700px] table-fixed text-left border-collapse">
                        <thead class="bg-red-900 dark:bg-red-900 text-white">
                            <tr>
                                <th
                                    @click="handleDriverSort('name')"
                                    class="px-4 py-3 w-[45%] cursor-pointer hover:bg-red-800 transition select-none"
                                    title="Klik untuk mengurutkan berdasarkan Nama Pembalap"
                                >
                                    <div class="flex items-center gap-1.5">
                                        <span>Nama Pembalap</span>
                                        <Icon
                                            v-if="driverSortBy === 'name'"
                                            :name="driverSortOrder === 'asc' ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'"
                                            class="text-base"
                                        />
                                        <Icon
                                            v-else
                                            name="material-symbols:unfold-more"
                                            class="text-base opacity-50"
                                        />
                                    </div>
                                </th>
                                <th
                                    @click="handleDriverSort('team')"
                                    class="px-4 py-3 w-[35%] cursor-pointer hover:bg-red-800 transition select-none"
                                    title="Klik untuk mengurutkan berdasarkan Tim"
                                >
                                    <div class="flex items-center gap-1.5">
                                        <span>Tim</span>
                                        <Icon
                                            v-if="driverSortBy === 'team'"
                                            :name="driverSortOrder === 'asc' ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'"
                                            class="text-base"
                                        />
                                        <Icon
                                            v-else
                                            name="material-symbols:unfold-more"
                                            class="text-base opacity-50"
                                        />
                                    </div>
                                </th>
                                <th
                                    @click="handleDriverSort('rating')"
                                    class="px-4 py-3 text-center w-[20%] cursor-pointer hover:bg-red-800 transition select-none"
                                    title="Klik untuk mengurutkan berdasarkan Rating"
                                >
                                    <div class="flex items-center justify-center gap-1.5">
                                        <span>Rating</span>
                                        <Icon
                                            v-if="driverSortBy === 'rating'"
                                            :name="driverSortOrder === 'asc' ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'"
                                            class="text-base"
                                        />
                                        <Icon
                                            v-else
                                            name="material-symbols:unfold-more"
                                            class="text-base opacity-50"
                                        />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-950 text-sm">
                            <tr v-if="loading" class="text-center py-8">
                                <td colspan="3" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <div class="flex items-center justify-center gap-2">
                                        <Icon name="material-symbols:refresh" class="animate-spin text-xl text-red-700" />
                                        <span>Memuat data pembalap...</span>
                                    </div>
                                </td>
                            </tr>

                            <tr v-else-if="filteredDrivers.length === 0" class="text-center py-8">
                                <td colspan="3" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <div class="flex flex-col items-center justify-center gap-2">
                                        <span>Pembalap tidak ditemukan</span>
                                    </div>
                                </td>
                            </tr>

                            <tr
                                v-for="driver in paginatedDrivers"
                                :key="driver.id"
                                @click="openEditDriverModal(driver)"
                                class="cursor-pointer transition-colors bg-white dark:bg-slate-950 hover:bg-red-50 dark:hover:bg-slate-900 text-black dark:text-white"
                            >
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-2">
                                        <Icon
                                            v-if="driver.countries?.code"
                                            :name="`flag-${driver.countries.code.toLowerCase()}-4x3`"
                                            class="rounded-sm shadow-sm shrink-0"
                                        />
                                        <span class="font-bold text-sm">{{ driver.name }}</span>
                                    </div>
                                </td>

                                <td class="px-4 py-3 text-sm font-medium">
                                    {{ driver.teams?.name || '-' }}
                                </td>

                                <td class="px-4 py-3 text-center">
                                    <span
                                        v-if="driver.rating"
                                        class="px-3 py-1 rounded text-xs font-bold inline-block"
                                        :class="getRatingStyle(driver.rating)"
                                    >
                                        {{ driver.rating }}
                                    </span>
                                    <span v-else class="text-xs text-gray-400 dark:text-gray-600 font-medium">
                                        -
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Driver Pagination Controls -->
                <div v-if="driverTotalPages > 1" class="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        Halaman {{ driverCurrentPage }} dari {{ driverTotalPages }}
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button
                            @click="driverCurrentPage > 1 && driverCurrentPage--"
                            :disabled="driverCurrentPage === 1"
                            class="p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-black dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center"
                        >
                            <Icon name="mi:chevron-left" size="1.2em" />
                        </button>
                        <span class="px-3 py-1 font-bold text-xs">{{ driverCurrentPage }} / {{ driverTotalPages }}</span>
                        <button
                            @click="driverCurrentPage < driverTotalPages && driverCurrentPage++"
                            :disabled="driverCurrentPage === driverTotalPages"
                            class="p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-black dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center"
                        >
                            <Icon name="mi:chevron-right" size="1.2em" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- TAB 3: TEAMS DATABASE MANAGEMENT -->
            <div v-else-if="activeTab === 'teams'" class="flex flex-col gap-6">
                <!-- Filter & Search Controls Bar -->
                <div class="bg-red-50 dark:bg-slate-950 p-4 rounded-xl border border-red-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div class="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Total Tim: <span class="font-bold text-black dark:text-white">{{ teams.length }} tim</span>
                    </div>

                    <div class="relative w-full md:w-72">
                        <input
                            v-model="teamSearchQuery"
                            type="text"
                            placeholder="Cari nama tim"
                            class="w-full pl-4 pr-4 py-1.5 text-sm rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                </div>

                <!-- Team Data Counter & Items Per Page -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium px-1 gap-2">
                    <span>
                        Menampilkan <b class="text-black dark:text-white">{{ filteredTeams.length > 0 ? (teamCurrentPage - 1) * teamItemsPerPage + 1 : 0 }}</b> - <b class="text-black dark:text-white">{{ Math.min(teamCurrentPage * teamItemsPerPage, filteredTeams.length) }}</b> dari <b class="text-black dark:text-white">{{ filteredTeams.length }}</b> total tim
                    </span>
                    <div class="flex items-center gap-2">
                        <label class="text-xs">Tampilkan per halaman:</label>
                        <select
                            v-model="teamItemsPerPage"
                            class="p-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs cursor-pointer focus:outline-none"
                        >
                            <option v-for="opt in itemsPerPageOptions" :key="opt" :value="opt">{{ opt }}</option>
                        </select>
                    </div>
                </div>

                <!-- Teams Table -->
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                    <table class="w-full min-w-[500px] table-fixed text-left border-collapse">
                        <thead class="bg-red-900 dark:bg-red-900 text-white">
                            <tr>
                                <!-- <th class="px-4 py-3 w-[15%]">ID Tim</th> -->
                                <th class="px-4 py-3 w-[60%]">Nama Tim</th>
                                <th class="px-4 py-3 text-center w-[25%]">Jumlah Pembalap</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-950 text-sm">
                            <tr v-if="loading" class="text-center py-8">
                                <td colspan="3" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <div class="flex items-center justify-center gap-2">
                                        <Icon name="material-symbols:refresh" class="animate-spin text-xl text-red-700" />
                                        <span>Memuat data tim...</span>
                                    </div>
                                </td>
                            </tr>

                            <tr v-else-if="filteredTeams.length === 0" class="text-center py-8">
                                <td colspan="3" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <div class="flex flex-col items-center justify-center gap-2">
                                        <span>Tim tidak ditemukan</span>
                                    </div>
                                </td>
                            </tr>

                            <tr
                                v-for="team in paginatedTeams"
                                :key="team.id"
                                @click="openEditTeamModal(team)"
                                class="cursor-pointer transition-colors bg-white dark:bg-slate-950 hover:bg-red-50 dark:hover:bg-slate-900 text-black dark:text-white"
                            >
                                <!-- <td class="px-4 py-3">
                                    {{ team.id }}
                                </td> -->

                                <td class="px-4 py-3 font-bold text-sm">
                                    {{ team.name }}
                                </td>

                                <td class="px-4 py-3 text-center">
                                    <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-slate-800 dark:text-red-300">
                                        {{ getDriverCountForTeam(team.id) }} Pembalap
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Team Pagination Controls -->
                <div v-if="teamTotalPages > 1" class="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        Halaman {{ teamCurrentPage }} dari {{ teamTotalPages }}
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button
                            @click="teamCurrentPage > 1 && teamCurrentPage--"
                            :disabled="teamCurrentPage === 1"
                            class="p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-black dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center"
                        >
                            <Icon name="mi:chevron-left" size="1.2em" />
                        </button>
                        <span class="px-3 py-1 font-bold text-xs">{{ teamCurrentPage }} / {{ teamTotalPages }}</span>
                        <button
                            @click="teamCurrentPage < teamTotalPages && teamCurrentPage++"
                            :disabled="teamCurrentPage === teamTotalPages"
                            class="p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-black dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center"
                        >
                            <Icon name="mi:chevron-right" size="1.2em" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- TAB 4: RENTALS MANAGEMENT -->
            <div v-else-if="activeTab === 'rentals'" class="flex flex-col gap-6">
                <!-- Filter & Search Controls Bar -->
                <div class="bg-red-50 dark:bg-slate-950 p-4 rounded-xl border border-red-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div class="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Total Rental: <span class="font-bold text-black dark:text-white">{{ rentals.length }} lokasi</span>
                    </div>

                    <div class="relative w-full md:w-72">
                        <input
                            v-model="rentalSearchQuery"
                            type="text"
                            placeholder="Cari nama / provinsi / kota"
                            class="w-full pl-4 pr-4 py-1.5 text-sm rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                </div>

                <!-- Rental Data Counter & Items Per Page -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium px-1 gap-2">
                    <span>
                        Menampilkan <b class="text-black dark:text-white">{{ filteredRentals.length > 0 ? (rentalCurrentPage - 1) * rentalItemsPerPage + 1 : 0 }}</b> - <b class="text-black dark:text-white">{{ Math.min(rentalCurrentPage * rentalItemsPerPage, filteredRentals.length) }}</b> dari <b class="text-black dark:text-white">{{ filteredRentals.length }}</b> total rental
                    </span>
                    <div class="flex items-center gap-2">
                        <label class="text-xs">Tampilkan per halaman:</label>
                        <select
                            v-model="rentalItemsPerPage"
                            class="p-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs cursor-pointer focus:outline-none"
                        >
                            <option v-for="opt in itemsPerPageOptions" :key="opt" :value="opt">{{ opt }}</option>
                        </select>
                    </div>
                </div>

                <!-- Rentals Table -->
                <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                    <table class="w-full min-w-[750px] table-fixed text-left border-collapse">
                        <thead class="bg-red-900 dark:bg-red-900 text-white">
                            <tr>
                                <th class="px-4 py-3 w-[40%]">Nama Rental</th>
                                <th class="px-4 py-3 w-[30%]">Lokasi</th>
                                <th class="px-3 py-3 text-center w-[15%]">Instagram</th>
                                <th class="px-3 py-3 text-center w-[15%]">Google Maps</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-950 text-sm">
                            <tr v-if="loading" class="text-center py-8">
                                <td colspan="4" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <div class="flex items-center justify-center gap-2">
                                        <Icon name="material-symbols:refresh" class="animate-spin text-xl text-red-700" />
                                        <span>Memuat data rental...</span>
                                    </div>
                                </td>
                            </tr>

                            <tr v-else-if="filteredRentals.length === 0" class="text-center py-8">
                                <td colspan="4" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <div class="flex flex-col items-center justify-center gap-2">
                                        <span>Rental tidak ditemukan</span>
                                    </div>
                                </td>
                            </tr>

                            <tr
                                v-for="rental in paginatedRentals"
                                :key="rental.id"
                                @click="openEditRentalModal(rental)"
                                class="cursor-pointer transition-colors bg-white dark:bg-slate-950 hover:bg-red-50 dark:hover:bg-slate-900 text-black dark:text-white"
                            >
                                <td class="px-4 py-3">
                                    <div class="font-bold text-sm">{{ rental.name }}</div>
                                </td>

                                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                    {{ rental.regency ? rental.regency + ', ' : '' }}{{ rental.province || '-' }}
                                </td>

                                <td class="px-3 py-3 text-center" @click.stop>
                                    <a
                                        v-if="rental.instagram"
                                        :href="rental.instagram"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="inline-flex items-center justify-center p-1.5 rounded-lg bg-pink-100 hover:bg-pink-200 text-pink-700 dark:bg-pink-950 dark:text-pink-300 transition"
                                        title="Buka Instagram"
                                    >
                                        <Icon name="simple-icons:instagram" class="text-lg" />
                                    </a>
                                    <span v-else class="text-gray-400 text-xs">-</span>
                                </td>

                                <td class="px-3 py-3 text-center" @click.stop>
                                    <a
                                        v-if="rental.location"
                                        :href="rental.location"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 transition"
                                        title="Buka Google Maps"
                                    >
                                        <Icon name="simple-icons:googlemaps" class="text-lg" />
                                    </a>
                                    <span v-else class="text-gray-400 text-xs">-</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Rental Pagination Controls -->
                <div v-if="rentalTotalPages > 1" class="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        Halaman {{ rentalCurrentPage }} dari {{ rentalTotalPages }}
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button
                            @click="rentalCurrentPage > 1 && rentalCurrentPage--"
                            :disabled="rentalCurrentPage === 1"
                            class="p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-black dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center"
                        >
                            <Icon name="mi:chevron-left" size="1.2em" />
                        </button>
                        <span class="px-3 py-1 font-bold text-xs">{{ rentalCurrentPage }} / {{ rentalTotalPages }}</span>
                        <button
                            @click="rentalCurrentPage < rentalTotalPages && rentalCurrentPage++"
                            :disabled="rentalCurrentPage === rentalTotalPages"
                            class="p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-black dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center"
                        >
                            <Icon name="mi:chevron-right" size="1.2em" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- TAB 5: RACE RESULTS MANAGEMENT -->
            <div v-else-if="activeTab === 'results'" class="flex flex-col gap-6">
                <!-- Top Configuration & Schedule Selector Card -->
                <div class="bg-red-50 dark:bg-slate-950 p-5 rounded-2xl border border-red-200 dark:border-slate-800 flex flex-col gap-5">
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                        <!-- Select Schedule Dropdown & Search -->
                        <div class="lg:col-span-6 flex flex-col gap-1.5">
                            <div class="flex items-center justify-between">
                                <label class="text-xs sm:text-sm font-bold text-black dark:text-white flex items-center gap-1.5">
                                    <span>Pilih Jadwal Balapan <span class="text-red-600">*</span></span>
                                    <span class="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                                        ({{ filteredSchedulesForSelect.length }} jadwal tersedia)
                                    </span>
                                </label>
                                <span v-if="selectedScheduleId" class="text-xs font-normal text-gray-500 dark:text-gray-400">
                                    ID: {{ selectedScheduleId.slice(0, 8) }}...
                                </span>
                            </div>
                            <div class="flex flex-col sm:flex-row gap-2">
                                <div class="relative w-full sm:w-48 shrink-0">
                                    <input
                                        v-model="resultsScheduleSearch"
                                        type="text"
                                        placeholder="Cari jadwal / event..."
                                        class="w-full pl-3 pr-7 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                                    />
                                    <button
                                        v-if="resultsScheduleSearch"
                                        type="button"
                                        @click="resultsScheduleSearch = ''"
                                        class="absolute right-2 top-2 text-gray-400 hover:text-red-600 transition cursor-pointer"
                                        title="Hapus pencarian"
                                    >
                                        <Icon name="material-symbols:close" class="text-xs" />
                                    </button>
                                </div>
                                <div class="relative flex-1">
                                    <select
                                        v-model="selectedScheduleId"
                                        class="w-full p-2 pr-8 appearance-none rounded-xl border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-900 text-black dark:text-white text-xs sm:text-sm font-medium focus:outline-none cursor-pointer"
                                    >
                                        <option value="" disabled>-- Pilih Jadwal Balapan ({{ filteredSchedulesForSelect.length }}) --</option>
                                        <option v-for="sched in filteredSchedulesForSelect" :key="sched.id" :value="sched.id">
                                            {{ formatDateOnly(sched.date) }} - {{ sched.events?.organizers?.abbreviation ? sched.events.organizers.abbreviation + ' ' : '' }}{{ sched.events?.name || 'Event' }}{{ sched.season ? ' (S' + sched.season + ')' : '' }} - Round {{ sched.round || '?' }} ({{ sched.circuit || 'TBA' }})
                                        </option>
                                    </select>
                                    <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 text-lg text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <!-- Session Type Selector -->
                        <div class="lg:col-span-3 flex flex-col gap-1.5">
                            <label class="text-xs sm:text-sm font-bold text-black dark:text-white">Sesi Balapan</label>
                            <div class="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border-2 border-red-900 dark:border-red-900">
                                <button
                                    v-for="opt in sessionTypeOptions"
                                    :key="opt.value"
                                    type="button"
                                    @click="selectedSessionType = opt.value"
                                    class="flex-1 py-1 px-2 rounded-lg text-xs font-bold transition text-center cursor-pointer"
                                    :class="selectedSessionType === opt.value
                                        ? 'bg-red-900 text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'"
                                >
                                    {{ opt.label }}
                                </button>
                            </div>
                        </div>

                        <!-- DB Status Badge -->
                        <div class="lg:col-span-3 flex flex-col justify-end gap-2">
                            <div class="flex items-center justify-end p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
                                <span
                                    v-if="hasExistingDbResults"
                                    class="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                >
                                    ● Tersimpan di Database
                                </span>
                                <span
                                    v-else
                                    class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                >
                                    ○ Belum Ada Data di DB
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Championship Points Integration Banner -->
                    <div
                        v-if="selectedScheduleId"
                        class="p-3.5 rounded-xl border flex flex-col gap-2"
                        :class="activeSessionChampionshipLinks.length > 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'"
                    >
                        <div class="flex items-start gap-2">
                            <Icon
                                :name="activeSessionChampionshipLinks.length > 0 ? 'material-symbols:emoji-events' : 'material-symbols:info'"
                                class="text-lg shrink-0 mt-0.5"
                                :class="activeSessionChampionshipLinks.length > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'"
                            />
                            <div class="flex flex-col gap-1.5 min-w-0">
                                <p
                                    class="text-xs sm:text-sm font-bold"
                                    :class="activeSessionChampionshipLinks.length > 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'"
                                >
                                    <template v-if="activeSessionChampionshipLinks.length > 0">
                                        Sesi ini menghitung poin untuk {{ activeSessionChampionshipLinks.length }} championship
                                    </template>
                                    <template v-else>
                                        Sesi ini belum terhubung ke championship mana pun
                                    </template>
                                </p>

                                <div v-if="activeSessionChampionshipLinks.length > 0" class="flex flex-wrap gap-1.5">
                                    <span
                                        v-for="link in activeSessionChampionshipLinks"
                                        :key="link.id"
                                        class="px-2 py-1 rounded-md text-[11px] font-bold bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1"
                                    >
                                        <span>{{ getChampionshipName(link.championships) }}</span>
                                        <span class="opacity-60">|</span>
                                        <span class="font-normal">{{ link.points_systems?.name || 'Tanpa sistem poin' }}</span>
                                        <span v-if="Number(link.points_multiplier) !== 1" class="px-1 rounded bg-red-900 text-white">
                                            {{ formatPoints(link.points_multiplier) }}x
                                        </span>
                                    </span>
                                </div>
                                <p
                                    v-else
                                    class="text-[11px] text-amber-700 dark:text-amber-400"
                                >
                                    Hasil tetap tersimpan, tapi tidak menghasilkan poin klasemen. Tambahkan jadwal ini sebagai ronde di tab
                                    <button @click="activeTab = 'standings'" class="font-bold underline cursor-pointer">Klasemen</button>.
                                </p>
                                <p
                                    v-if="activeSessionChampionshipLinks.length > 0"
                                    class="text-[11px] text-emerald-700 dark:text-emerald-400"
                                >
                                    Klasemen akan otomatis dihitung ulang setelah hasil disimpan.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Selected Schedule Summary Card Banner -->
                    <div v-if="selectedSchedule" class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                            <span :class="getAdminOrganizerStyle(selectedSchedule.events?.organizers?.abbreviation)">
                                {{ selectedSchedule.events?.organizers?.abbreviation }}
                            </span>
                            <span v-if="selectedSchedule.events?.games?.abbreviation" :class="getAdminGameStyle(selectedSchedule.events?.games?.abbreviation)">
                                {{ selectedSchedule.events?.games?.abbreviation }}
                            </span>
                            <span class="font-bold text-black dark:text-white">
                                {{ selectedSchedule.events?.name }}{{ selectedSchedule.season ? ' (S' + selectedSchedule.season + ')' : '' }}
                            </span>
                            <span class="text-gray-400 dark:text-gray-600">•</span>
                            <span class="font-semibold text-gray-700 dark:text-gray-300">Round {{ selectedSchedule.round }}</span>
                            <span class="text-gray-400 dark:text-gray-600">•</span>
                            <div class="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                                <Icon
                                    v-if="selectedSchedule.country"
                                    :name="`flag-${selectedSchedule.country.toLowerCase()}-4x3`"
                                    class="rounded-sm shadow-sm shrink-0"
                                />
                                <span>{{ selectedSchedule.circuit }}</span>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                            <!-- Team Event Checkbox Toggle -->
                            <label
                                class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 border select-none"
                                :class="isTeamEvent
                                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                                    : 'bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300'"
                                title="Centang jika sesi ini adalah Team Event / Balapan Tim (hanya memasukkan nama tim dan nomor mobil)"
                            >
                                <input
                                    v-model="isTeamEvent"
                                    type="checkbox"
                                    class="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <div class="flex items-center gap-1">
                                    <Icon name="material-symbols:groups" class="text-sm" />
                                    <span>{{ isTeamEvent ? 'Team Event (Balapan Tim)' : 'Individu (Driver)' }}</span>
                                </div>
                            </label>

                            <!-- Provisional vs Final checkbox toggle -->
                            <label
                                class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 border select-none"
                                :class="isResultsProvisional
                                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                                    : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'"
                                title="Centang jika hasil balapan masih bersifat sementara (Provisional) atau uncheck jika sudah resmi (Official / Final)"
                            >
                                <input
                                    v-model="isResultsProvisional"
                                    type="checkbox"
                                    class="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <div class="flex items-center gap-1">
                                    <Icon :name="isResultsProvisional ? 'material-symbols:hourglass-top' : 'material-symbols:verified'" class="text-sm" />
                                    <span>{{ isResultsProvisional ? 'Hasil Sementara (Provisional)' : 'Hasil Resmi (Official / Final)' }}</span>
                                </div>
                            </label>

                            <label class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-gray-300 dark:border-slate-700">
                                <Icon name="material-symbols:upload-file" class="text-base text-red-700" />
                                <span>Upload ACSM JSON</span>
                                <input
                                    type="file"
                                    accept=".json,application/json"
                                    @change="handleResultsJsonUpload"
                                    class="hidden"
                                />
                            </label>
                        </div>
                    </div>

                    <!-- Input Mode Selector (Overall vs Specific Class) -->
                    <div
                        v-if="availableClassesForSchedule.length > 0"
                        class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                    >
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <Icon name="material-symbols:tune" class="text-base text-red-700" />
                                <span>Mode Input Hasil:</span>
                            </span>
                            <div class="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-slate-950 p-1 rounded-xl border border-gray-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    @click="selectedEntryClassId = 'ALL'"
                                    class="py-1 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                    :class="selectedEntryClassId === 'ALL'
                                        ? 'bg-red-900 text-white shadow-xs'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'"
                                >
                                    <Icon name="material-symbols:grid-view" class="text-sm" />
                                    <span>Semua Kelas (Overall Grid)</span>
                                    <span class="text-[10px] opacity-75">({{ resultsRows.filter(r => isTeamEvent ? r.team_id : r.driver_id).length }})</span>
                                </button>
                                <button
                                    v-for="cls in availableClassesForSchedule"
                                    :key="cls.id"
                                    type="button"
                                    @click="selectedEntryClassId = cls.id"
                                    class="py-1 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                    :class="selectedEntryClassId === cls.id
                                        ? 'bg-red-900 text-white shadow-xs'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'"
                                >
                                    <Icon name="material-symbols:category" class="text-sm" />
                                    <span>Input Khusus Kelas {{ cls.name }}</span>
                                    <span class="text-[10px] opacity-75">({{ resultsRows.filter(r => r.class_id === cls.id && (isTeamEvent ? r.team_id : r.driver_id)).length }})</span>
                                </button>
                            </div>
                        </div>

                        <div v-if="selectedEntryClassId !== 'ALL'" class="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 font-semibold flex items-center gap-1.5">
                            <Icon name="material-symbols:info" class="text-sm" />
                            <span>Mengedit/mengimpor hasil hanya untuk kelas <strong>{{ getClassNameById(selectedEntryClassId) }}</strong></span>
                        </div>
                    </div>

                    <!-- Action Buttons Bar -->
                    <div class="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-gray-200/80 dark:border-slate-800">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-bold text-gray-700 dark:text-gray-300 mr-1">
                                {{ selectedEntryClassId !== 'ALL' ? `Tambah Posisi (${getClassNameById(selectedEntryClassId)}):` : 'Tambah Posisi:' }}
                            </span>
                            <button
                                type="button"
                                @click="addResultRow"
                                class="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-slate-800 text-black dark:text-white border border-gray-300 dark:border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                            >
                                <Icon name="material-symbols:add" class="text-sm" />
                                <span>+1 Baris</span>
                            </button>
                            <button
                                type="button"
                                @click="addMultipleResultRows(5)"
                                class="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-slate-800 text-black dark:text-white border border-gray-300 dark:border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                                +5 Baris
                            </button>
                            <button
                                type="button"
                                @click="addMultipleResultRows(10)"
                                class="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-slate-800 text-black dark:text-white border border-gray-300 dark:border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                                +10 Baris
                            </button>
                        </div>

                        <div class="flex items-center gap-2">
                            <button
                                v-if="displayedResultsRows.length > 0"
                                type="button"
                                @click="clearAllResultsRows"
                                class="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:underline cursor-pointer flex items-center gap-1"
                            >
                                <Icon name="material-symbols:clear-all" class="text-sm" />
                                <span>{{ selectedEntryClassId !== 'ALL' ? `Kosongkan Tabel (${getClassNameById(selectedEntryClassId)})` : 'Kosongkan Tabel' }}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Empty State: No Schedule Selected -->
                <div
                    v-if="!selectedScheduleId"
                    class="p-12 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col items-center justify-center text-center gap-3"
                >
                    <div class="p-4 rounded-full bg-red-50 dark:bg-slate-900 text-red-700 dark:text-red-400">
                        <Icon name="material-symbols:sports-score" class="text-4xl" />
                    </div>
                    <h3 class="text-lg font-bold text-black dark:text-white">Pilih Jadwal Balapan Terlebih Dahulu</h3>
                    <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md">
                        Silakan pilih jadwal balapan di menu dropdown atas untuk mulai mengisi data hasil balapan, driver, tim, dan catatan waktu per posisi.
                    </p>
                </div>

                <!-- Results Table -->
                <div v-else class="flex flex-col gap-4">
                    <!-- Pole Position & Fastest Lap Configuration Card (Race Sessions) -->
                    <div v-if="selectedSessionType !== 'qualifying'" class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                        <div class="flex items-center justify-between">
                            <h4 class="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <Icon name="material-symbols:sports-motorsports-rounded" class="text-red-700 dark:text-red-400 text-base" />
                                <span>Pole Position & Lap Tercepat (Fastest Lap)</span>
                            </h4>
                            <span class="text-[11px] text-gray-400">Pilih pembalap peraih Pole Position dan Lap Tercepat beserta waktunya</span>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div
                                v-for="cls in activeResultClasses"
                                :key="cls.id"
                                class="p-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 flex flex-col gap-2.5"
                            >
                                <div v-if="(availableClassesForSchedule?.length || 0) > 1" class="flex items-center justify-between pb-1 border-b border-gray-200 dark:border-slate-800">
                                    <span class="font-bold text-xs text-red-700 dark:text-red-400">Kelas: {{ cls.name }}</span>
                                </div>

                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <!-- Pole Position Field -->
                                    <div class="flex flex-col gap-1">
                                        <label class="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                            <Icon name="material-symbols:flag-rounded" class="text-amber-500 text-sm" />
                                            <span>Pole Position</span>
                                        </label>
                                        <div class="relative w-full">
                                            <button
                                                type="button"
                                                @click="activeTopDriverSearch?.type === 'pole' && activeTopDriverSearch?.classId === cls.id ? closeTopDriverSearch() : openTopDriverSearch('pole', cls.id)"
                                                class="w-full p-2 text-left rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer flex items-center justify-between gap-1.5 transition hover:border-red-600"
                                                :class="{ 'ring-1 ring-red-500 border-red-500': activeTopDriverSearch?.type === 'pole' && activeTopDriverSearch?.classId === cls.id }"
                                            >
                                                <div class="flex items-center gap-1.5 min-w-0 overflow-hidden truncate">
                                                    <template v-if="getPoleDriverId(cls.id)">
                                                        <Icon
                                                            v-if="!isTeamEvent && getDriverById(getPoleDriverId(cls.id))?.countries?.code"
                                                            :name="`flag-${getDriverById(getPoleDriverId(cls.id)).countries.code.toLowerCase()}-4x3`"
                                                            class="rounded-xs shrink-0"
                                                        />
                                                        <Icon
                                                            v-else-if="isTeamEvent"
                                                            name="material-symbols:groups"
                                                            class="text-blue-600 dark:text-blue-400 shrink-0 text-sm"
                                                        />
                                                        <span class="truncate font-bold text-black dark:text-white">
                                                            {{ getDriverDisplayName(getPoleDriverId(cls.id)) }}
                                                        </span>
                                                        <span
                                                            v-if="!isTeamEvent && getDriverById(getPoleDriverId(cls.id))?.rating"
                                                            class="text-[10px] px-1 py-0.5 rounded text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 font-normal shrink-0"
                                                        >
                                                            {{ getDriverById(getPoleDriverId(cls.id))?.rating }}
                                                        </span>
                                                    </template>
                                                    <template v-else>
                                                        <span class="text-gray-400 dark:text-gray-500 italic truncate">{{ isTeamEvent ? '-- Cari & Pilih Tim Pole --' : '-- Cari & Pilih Pole --' }}</span>
                                                    </template>
                                                </div>
                                                <div class="flex items-center gap-1 shrink-0 text-gray-400">
                                                    <Icon name="material-symbols:search" class="text-sm" />
                                                    <Icon name="material-symbols:keyboard-arrow-down-rounded" class="text-base" />
                                                </div>
                                            </button>

                                            <!-- Dropdown Popover with Live Search -->
                                            <div
                                                v-if="activeTopDriverSearch?.type === 'pole' && activeTopDriverSearch?.classId === cls.id"
                                                class="absolute left-0 w-72 sm:w-80 max-w-[90vw] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1.5 top-full mt-1"
                                                @click.stop
                                            >
                                                <div class="relative flex items-center">
                                                    <Icon name="material-symbols:search" class="absolute left-2.5 text-gray-400 text-sm pointer-events-none" />
                                                    <input
                                                        v-model="topDriverSearchQuery"
                                                        type="text"
                                                        autofocus
                                                        :placeholder="isTeamEvent ? 'Ketik nama tim atau nomor mobil...' : 'Ketik nama, tim, atau negara...'"
                                                        class="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                                                        @keydown.esc="closeTopDriverSearch"
                                                    />
                                                    <button
                                                        v-if="topDriverSearchQuery"
                                                        type="button"
                                                        @click="topDriverSearchQuery = ''"
                                                        class="absolute right-2 text-gray-400 hover:text-red-600 transition cursor-pointer"
                                                        title="Hapus pencarian"
                                                    >
                                                        <Icon name="material-symbols:close" class="text-xs" />
                                                    </button>
                                                </div>

                                                <div class="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 rounded-lg border border-gray-100 dark:border-slate-800">
                                                    <button
                                                        type="button"
                                                        @click="selectTopDriver('pole', cls.id, null)"
                                                        class="w-full px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-red-50 dark:hover:bg-slate-800/80 text-red-600 dark:text-red-400 transition cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <Icon name="material-symbols:block" class="text-sm" />
                                                        <span>Tanpa Pole (Kosongkan)</span>
                                                    </button>

                                                    <button
                                                        v-for="d in getFilteredTopDrivers(cls.id)"
                                                        :key="d.id"
                                                        type="button"
                                                        @click="selectTopDriver('pole', cls.id, d)"
                                                        class="w-full px-2.5 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between gap-2"
                                                        :class="{ 'bg-red-50 dark:bg-red-950/40 font-bold': String(getPoleDriverId(cls.id)) === String(d.id) }"
                                                    >
                                                        <div class="flex items-center gap-2 min-w-0">
                                                             <Icon
                                                                v-if="!isTeamEvent && d.countries?.code"
                                                                :name="`flag-${d.countries.code.toLowerCase()}-4x3`"
                                                                class="rounded-xs shrink-0 text-sm"
                                                            />
                                                            <Icon
                                                                v-else-if="isTeamEvent"
                                                                name="material-symbols:groups"
                                                                class="text-blue-600 dark:text-blue-400 shrink-0 text-sm"
                                                            />
                                                            <div class="flex flex-col min-w-0">
                                                                <span class="truncate text-black dark:text-white font-medium">
                                                                    {{ d.name }}
                                                                </span>
                                                                <span v-if="!isTeamEvent && d.teams?.name" class="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                                                    {{ d.teams.name }}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div class="flex items-center gap-1 shrink-0">
                                                            <span
                                                                v-if="!isTeamEvent && d.rating"
                                                                class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                                                :class="getRatingStyle(d.rating)"
                                                            >
                                                                {{ d.rating }}
                                                            </span>
                                                            <Icon
                                                                v-if="String(getPoleDriverId(cls.id)) === String(d.id)"
                                                                name="material-symbols:check"
                                                                class="text-red-700 dark:text-red-400 text-base"
                                                            />
                                                        </div>
                                                    </button>

                                                    <div v-if="getFilteredTopDrivers(cls.id).length === 0" class="p-3 text-center text-xs text-gray-400">
                                                        {{ isTeamEvent ? 'Tidak ada tim di balapan / tidak cocok' : 'Tidak ditemukan pembalap yang cocok' }}
                                                    </div>
                                                </div>

                                                <div class="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-0.5">
                                                    <span>Ditemukan: {{ getFilteredTopDrivers(cls.id).length }} {{ isTeamEvent ? 'mobil tim' : 'pembalap' }}</span>
                                                    <button
                                                        type="button"
                                                        @click="closeTopDriverSearch"
                                                        class="text-gray-500 hover:text-black dark:hover:text-white underline cursor-pointer"
                                                    >
                                                        Tutup
                                                    </button>
                                                </div>
                                            </div>

                                            <div
                                                v-if="activeTopDriverSearch?.type === 'pole' && activeTopDriverSearch?.classId === cls.id"
                                                class="fixed inset-0 z-40 bg-transparent"
                                                @click="closeTopDriverSearch"
                                            />
                                        </div>
                                    </div>

                                    <!-- Fastest Lap Field -->
                                    <div class="flex flex-col gap-1">
                                        <label class="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                            <Icon name="material-symbols:electric-bolt" class="text-purple-600 text-sm" />
                                            <span>Fastest Lap & Waktu</span>
                                        </label>
                                        <div class="flex items-center gap-1.5">
                                            <div class="relative flex-1 min-w-0">
                                                <button
                                                    type="button"
                                                    @click="activeTopDriverSearch?.type === 'fastest_lap' && activeTopDriverSearch?.classId === cls.id ? closeTopDriverSearch() : openTopDriverSearch('fastest_lap', cls.id)"
                                                    class="w-full p-2 text-left rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer flex items-center justify-between gap-1.5 transition hover:border-red-600"
                                                    :class="{ 'ring-1 ring-red-500 border-red-500': activeTopDriverSearch?.type === 'fastest_lap' && activeTopDriverSearch?.classId === cls.id }"
                                                >
                                                    <div class="flex items-center gap-1.5 min-w-0 overflow-hidden truncate">
                                                        <template v-if="getFastestLapDriverId(cls.id)">
                                                            <Icon
                                                                v-if="!isTeamEvent && getDriverById(getFastestLapDriverId(cls.id))?.countries?.code"
                                                                :name="`flag-${getDriverById(getFastestLapDriverId(cls.id)).countries.code.toLowerCase()}-4x3`"
                                                                class="rounded-xs shrink-0"
                                                            />
                                                            <Icon
                                                                v-else-if="isTeamEvent"
                                                                name="material-symbols:groups"
                                                                class="text-blue-600 dark:text-blue-400 shrink-0 text-sm"
                                                            />
                                                            <span class="truncate font-bold text-black dark:text-white">
                                                                {{ getDriverDisplayName(getFastestLapDriverId(cls.id)) }}
                                                            </span>
                                                            <span
                                                                v-if="!isTeamEvent && getDriverById(getFastestLapDriverId(cls.id))?.rating"
                                                                class="text-[10px] px-1 py-0.5 rounded text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 font-normal shrink-0"
                                                            >
                                                                {{ getDriverById(getFastestLapDriverId(cls.id))?.rating }}
                                                            </span>
                                                        </template>
                                                        <template v-else>
                                                            <span class="text-gray-400 dark:text-gray-500 italic truncate">{{ isTeamEvent ? '-- Cari & Pilih Tim FL --' : '-- Cari & Pilih FL --' }}</span>
                                                        </template>
                                                    </div>
                                                    <div class="flex items-center gap-1 shrink-0 text-gray-400">
                                                        <Icon name="material-symbols:search" class="text-sm" />
                                                        <Icon name="material-symbols:keyboard-arrow-down-rounded" class="text-base" />
                                                    </div>
                                                </button>

                                                <!-- Dropdown Popover with Live Search -->
                                                <div
                                                    v-if="activeTopDriverSearch?.type === 'fastest_lap' && activeTopDriverSearch?.classId === cls.id"
                                                    class="absolute left-0 w-72 sm:w-80 max-w-[90vw] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1.5 top-full mt-1"
                                                    @click.stop
                                                >
                                                    <div class="relative flex items-center">
                                                        <Icon name="material-symbols:search" class="absolute left-2.5 text-gray-400 text-sm pointer-events-none" />
                                                        <input
                                                            v-model="topDriverSearchQuery"
                                                            type="text"
                                                            autofocus
                                                            :placeholder="isTeamEvent ? 'Ketik nama tim atau nomor mobil...' : 'Ketik nama, tim, atau negara...'"
                                                            class="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                                                            @keydown.esc="closeTopDriverSearch"
                                                        />
                                                        <button
                                                            v-if="topDriverSearchQuery"
                                                            type="button"
                                                            @click="topDriverSearchQuery = ''"
                                                            class="absolute right-2 text-gray-400 hover:text-red-600 transition cursor-pointer"
                                                            title="Hapus pencarian"
                                                        >
                                                            <Icon name="material-symbols:close" class="text-xs" />
                                                        </button>
                                                    </div>

                                                    <div class="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 rounded-lg border border-gray-100 dark:border-slate-800">
                                                        <button
                                                            type="button"
                                                            @click="selectTopDriver('fastest_lap', cls.id, null)"
                                                            class="w-full px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-red-50 dark:hover:bg-slate-800/80 text-red-600 dark:text-red-400 transition cursor-pointer flex items-center gap-1.5"
                                                        >
                                                            <Icon name="material-symbols:block" class="text-sm" />
                                                            <span>Tanpa FL (Kosongkan)</span>
                                                        </button>

                                                        <button
                                                            v-for="d in getFilteredTopDrivers(cls.id)"
                                                            :key="d.id"
                                                            type="button"
                                                            @click="selectTopDriver('fastest_lap', cls.id, d)"
                                                            class="w-full px-2.5 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between gap-2"
                                                            :class="{ 'bg-red-50 dark:bg-red-950/40 font-bold': String(getFastestLapDriverId(cls.id)) === String(d.id) }"
                                                        >
                                                            <div class="flex items-center gap-2 min-w-0">
                                                                <Icon
                                                                    v-if="!isTeamEvent && d.countries?.code"
                                                                    :name="`flag-${d.countries.code.toLowerCase()}-4x3`"
                                                                    class="rounded-xs shrink-0 text-sm"
                                                                />
                                                                <Icon
                                                                    v-else-if="isTeamEvent"
                                                                    name="material-symbols:groups"
                                                                    class="text-blue-600 dark:text-blue-400 shrink-0 text-sm"
                                                                />
                                                                <div class="flex flex-col min-w-0">
                                                                    <span class="truncate text-black dark:text-white font-medium">
                                                                        {{ d.name }}
                                                                    </span>
                                                                    <span v-if="!isTeamEvent && d.teams?.name" class="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                                                        {{ d.teams.name }}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div class="flex items-center gap-1 shrink-0">
                                                                <span
                                                                    v-if="!isTeamEvent && d.rating"
                                                                    class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                                                    :class="getRatingStyle(d.rating)"
                                                                >
                                                                    {{ d.rating }}
                                                                </span>
                                                                <Icon
                                                                    v-if="String(getFastestLapDriverId(cls.id)) === String(d.id)"
                                                                    name="material-symbols:check"
                                                                    class="text-red-700 dark:text-red-400 text-base"
                                                                />
                                                            </div>
                                                        </button>

                                                        <div v-if="getFilteredTopDrivers(cls.id).length === 0" class="p-3 text-center text-xs text-gray-400">
                                                            {{ isTeamEvent ? 'Tidak ada tim di balapan / tidak cocok' : 'Tidak ditemukan pembalap yang cocok' }}
                                                        </div>
                                                    </div>

                                                    <div class="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-0.5">
                                                        <span>Ditemukan: {{ getFilteredTopDrivers(cls.id).length }} {{ isTeamEvent ? 'mobil tim' : 'pembalap' }}</span>
                                                        <button
                                                            type="button"
                                                            @click="closeTopDriverSearch"
                                                            class="text-gray-500 hover:text-black dark:hover:text-white underline cursor-pointer"
                                                        >
                                                            Tutup
                                                        </button>
                                                    </div>
                                                </div>

                                                <div
                                                    v-if="activeTopDriverSearch?.type === 'fastest_lap' && activeTopDriverSearch?.classId === cls.id"
                                                    class="fixed inset-0 z-40 bg-transparent"
                                                    @click="closeTopDriverSearch"
                                                />
                                            </div>

                                            <input
                                                type="text"
                                                :value="getFastestLapTime(cls.id)"
                                                @input="onFastestLapTimeChange(cls.id, $event.target.value)"
                                                placeholder="1:23.456"
                                                title="Catatan Waktu Lap Tercepat"
                                                class="w-24 sm:w-28 shrink-0 p-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Data Counter, Multi-Class Filter & Actions -->
                    <div class="flex flex-wrap items-center justify-between text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium px-1 gap-3">
                        <div class="flex flex-wrap items-center gap-3">
                            <span v-if="selectedEntryClassId === 'ALL'">
                                Total <b class="text-black dark:text-white">{{ resultsRows.length }}</b> posisi (<b class="text-black dark:text-white">{{ resultsRows.filter(r => isTeamEvent ? r.team_id : r.driver_id).length }}</b> terisi)
                            </span>
                            <span v-else>
                                Kelas <b class="text-red-700 dark:text-red-400">{{ getClassNameById(selectedEntryClassId) }}</b>: <b class="text-black dark:text-white">{{ displayedResultsRows.length }}</b> posisi (<b class="text-black dark:text-white">{{ displayedResultsRows.filter(r => isTeamEvent ? r.team_id : r.driver_id).length }}</b> terisi)
                            </span>

                            <!-- Multi-Class Filter Pills (if multiple classes exist and in ALL mode) -->
                            <div v-if="availableClassesForSchedule.length > 1 && selectedEntryClassId === 'ALL'" class="flex items-center gap-1 bg-gray-100 dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    @click="resultsClassFilter = 'ALL'"
                                    class="py-0.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer"
                                    :class="resultsClassFilter === 'ALL'
                                        ? 'bg-red-900 text-white shadow-xs'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'"
                                >
                                    Semua Kelas
                                </button>
                                <button
                                    v-for="cls in availableClassesForSchedule"
                                    :key="cls.id"
                                    type="button"
                                    @click="resultsClassFilter = cls.id"
                                    class="py-0.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                    :class="resultsClassFilter === cls.id
                                        ? 'bg-red-900 text-white shadow-xs'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'"
                                >
                                    <span>{{ cls.name }}</span>
                                    <span class="text-[10px] opacity-75">({{ resultsRows.filter(r => r.class_id === cls.id && (isTeamEvent ? r.team_id : r.driver_id)).length }})</span>
                                </button>
                            </div>
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                v-if="availableClassesForSchedule.length > 0"
                                type="button"
                                @click="recalculateScoringPositions"
                                class="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1"
                                title="Hitung ulang urutan posisi tiap kelas otomatis berdasarkan hasil overall"
                            >
                                <Icon name="material-symbols:autorenew" class="text-sm text-red-700 dark:text-red-400" />
                                <span>Hitung Ulang Posisi Kelas</span>
                            </button>
                            <span v-if="selectedSessionType !== 'qualifying'" class="text-xs hidden sm:inline text-gray-400">Pole Position & Lap Tercepat dapat diisi pada kotak di atas</span>
                            <span v-else class="text-xs hidden sm:inline text-gray-400">Masukkan catatan waktu lap atau selisih gap kualifikasi di kolom Gap / Waktu</span>
                        </div>
                    </div>

                    <!-- Interactive Table -->
                    <div class="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                        <table class="w-full min-w-[950px] table-fixed text-left border-collapse">
                            <thead class="bg-red-900 dark:bg-red-900 text-white text-xs">
                                <tr v-if="!isTeamEvent">
                                    <th class="px-2 py-3 text-center w-[4%]">Pos</th>
                                    <th class="px-2 py-3 text-center w-[5%]">No.</th>
                                    <th class="px-3 py-3" :class="selectedSessionType === 'qualifying' ? 'w-[32%]' : 'w-[23%]'">Pembalap (Driver / Co-Drivers) <span class="text-red-300">*</span></th>
                                    <th class="px-2 py-3" :class="selectedSessionType === 'qualifying' ? 'w-[16%]' : 'w-[13%]'">Kelas (Class)</th>
                                    <th class="px-2 py-3 text-center" :class="selectedSessionType === 'qualifying' ? 'w-[8%]' : 'w-[7%]'">Pos Kelas</th>
                                    <th class="px-3 py-3" :class="selectedSessionType === 'qualifying' ? 'w-[20%]' : 'w-[16%]'">Tim (Team)</th>
                                    <th v-if="selectedSessionType !== 'qualifying'" class="px-2 py-3 text-center w-[9%]">Status</th>
                                    <th v-if="selectedSessionType !== 'qualifying'" class="px-2 py-3 text-center w-[5%]">Laps</th>
                                    <th class="px-2 py-3" :class="selectedSessionType === 'qualifying' ? 'w-[11%]' : 'w-[9%]'">{{ selectedSessionType === 'qualifying' ? 'Waktu / Gap' : 'Gap / Waktu' }}</th>
                                    <th v-if="selectedSessionType !== 'qualifying'" class="px-2 py-3 text-center w-[5%]">Penalti</th>
                                    <th v-if="selectedSessionType !== 'qualifying'" class="px-2 py-3 text-center w-[4%]" title="Centang jika tidak berhak mendapatkan poin kejuaraan">No Pts</th>
                                    <th class="px-2 py-3 text-center" :class="selectedSessionType === 'qualifying' ? 'w-[4%]' : 'w-[4%]'">Aksi</th>
                                </tr>
                                <tr v-else>
                                    <th class="px-2 py-3 text-center w-[4%]">Pos</th>
                                    <th class="px-2 py-3 text-center w-[6%]">No.</th>
                                    <th class="px-3 py-3" :class="selectedSessionType === 'qualifying' ? 'w-[46%]' : 'w-[33%]'">Tim (Team Name) <span class="text-red-300">*</span></th>
                                    <th class="px-2 py-3" :class="selectedSessionType === 'qualifying' ? 'w-[20%]' : 'w-[16%]'">Kelas (Class)</th>
                                    <th class="px-2 py-3 text-center" :class="selectedSessionType === 'qualifying' ? 'w-[10%]' : 'w-[8%]'">Pos Kelas</th>
                                    <th v-if="selectedSessionType !== 'qualifying'" class="px-2 py-3 text-center w-[9%]">Status</th>
                                    <th v-if="selectedSessionType !== 'qualifying'" class="px-2 py-3 text-center w-[5%]">Laps</th>
                                    <th class="px-2 py-3" :class="selectedSessionType === 'qualifying' ? 'w-[14%]' : 'w-[10%]'">{{ selectedSessionType === 'qualifying' ? 'Waktu / Gap' : 'Gap / Waktu' }}</th>
                                    <th v-if="selectedSessionType !== 'qualifying'" class="px-2 py-3 text-center w-[5%]">Penalti</th>
                                    <th v-if="selectedSessionType !== 'qualifying'" class="px-2 py-3 text-center w-[4%]" title="Centang jika tidak berhak mendapatkan poin kejuaraan">No Pts</th>
                                    <th class="px-2 py-3 text-center" :class="selectedSessionType === 'qualifying' ? 'w-[4%]' : 'w-[4%]'">Aksi</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-950 text-xs">
                                <tr v-if="loadingResults" class="text-center py-8">
                                    <td :colspan="isTeamEvent ? (selectedSessionType === 'qualifying' ? 7 : 11) : (selectedSessionType === 'qualifying' ? 8 : 12)" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                        <div class="flex items-center justify-center gap-2">
                                            <Icon name="material-symbols:refresh" class="animate-spin text-xl text-red-700" />
                                            <span>Memuat data hasil balapan...</span>
                                        </div>
                                    </td>
                                </tr>

                                <tr v-else-if="displayedResultsRows.length === 0" class="text-center py-8">
                                    <td :colspan="isTeamEvent ? (selectedSessionType === 'qualifying' ? 7 : 11) : (selectedSessionType === 'qualifying' ? 8 : 12)" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                        <div class="flex flex-col items-center justify-center gap-2">
                                            <span>Belum ada baris posisi{{ selectedEntryClassId !== 'ALL' ? ' untuk kelas ini' : '' }}. Klik tombol "+1 Baris" untuk menambahkan posisi.</span>
                                        </div>
                                    </td>
                                </tr>

                                <tr
                                    v-for="(row, idx) in displayedResultsRows"
                                    :key="row.id || idx"
                                    v-show="selectedEntryClassId !== 'ALL' || resultsClassFilter === 'ALL' || row.class_id === resultsClassFilter"
                                    class="transition-colors hover:bg-gray-50 dark:hover:bg-slate-900/60"
                                    :class="{
                                        'bg-yellow-50/40 dark:bg-yellow-950/20': (selectedEntryClassId !== 'ALL' ? row.scoring_position === 1 : row.position === 1),
                                        'bg-slate-50/40 dark:bg-slate-900/40': (selectedEntryClassId !== 'ALL' ? row.scoring_position === 2 : row.position === 2),
                                        'bg-amber-50/30 dark:bg-amber-950/20': (selectedEntryClassId !== 'ALL' ? row.scoring_position === 3 : row.position === 3),
                                    }"
                                >
                                    <!-- Position Column -->
                                    <td class="px-2 py-2.5 text-center">
                                        <div class="flex items-center justify-center gap-1">
                                            <div class="flex flex-col">
                                                <button
                                                    type="button"
                                                    @click="moveDisplayedRowUp(idx)"
                                                    :disabled="idx === 0"
                                                    class="text-gray-400 hover:text-red-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none p-0.5"
                                                    title="Pindah ke Atas"
                                                >
                                                    <Icon name="material-symbols:arrow-drop-up" class="text-base" />
                                                </button>
                                                <button
                                                    type="button"
                                                    @click="moveDisplayedRowDown(idx)"
                                                    :disabled="idx === displayedResultsRows.length - 1"
                                                    class="text-gray-400 hover:text-red-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none p-0.5"
                                                    title="Pindah ke Bawah"
                                                >
                                                    <Icon name="material-symbols:arrow-drop-down" class="text-base" />
                                                </button>
                                            </div>
                                            <span
                                                class="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0"
                                                :class="{
                                                    'bg-yellow-400 text-yellow-950 border border-yellow-500 shadow-xs': (selectedEntryClassId !== 'ALL' ? row.scoring_position === 1 : row.position === 1),
                                                    'bg-slate-300 text-slate-900 border border-slate-400 shadow-xs': (selectedEntryClassId !== 'ALL' ? row.scoring_position === 2 : row.position === 2),
                                                    'bg-amber-600 text-white border border-amber-700 shadow-xs': (selectedEntryClassId !== 'ALL' ? row.scoring_position === 3 : row.position === 3),
                                                    'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700': (selectedEntryClassId !== 'ALL' ? (row.scoring_position || 99) > 3 : row.position > 3)
                                                }"
                                            >
                                                {{ selectedEntryClassId !== 'ALL' ? (row.scoring_position || idx + 1) : row.position }}
                                            </span>
                                        </div>
                                    </td>

                                    <!-- Car Number Column -->
                                    <td class="px-2 py-2.5 text-center">
                                        <input
                                            v-model.number="row.car_number"
                                            type="number"
                                            placeholder="#"
                                            class="w-full max-w-[52px] p-1.5 text-xs text-center rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-red-500"
                                            title="Nomor Mobil / Subteam Car Number (e.g. 50, 51)"
                                        />
                                    </td>

                                    <!-- Team Column when isTeamEvent -->
                                    <td v-if="isTeamEvent" class="px-3 py-2.5">
                                        <div class="relative">
                                            <!-- Trigger Button / Display -->
                                            <button
                                                type="button"
                                                @click="openTeamDropdown(idx)"
                                                class="w-full p-2 text-left rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer flex items-center justify-between gap-1.5 transition hover:border-red-600"
                                                :class="{ 'ring-1 ring-red-500 border-red-500': activeTeamSearchRowIndex === idx }"
                                            >
                                                <div class="flex items-center gap-1.5 min-w-0 overflow-hidden truncate">
                                                    <template v-if="row.team_id && getTeamById(row.team_id)">
                                                        <Icon name="material-symbols:groups" class="text-xs text-blue-600 dark:text-blue-400 shrink-0" />
                                                        <span class="truncate font-bold text-black dark:text-white">
                                                            {{ getTeamById(row.team_id)?.name }}
                                                        </span>
                                                    </template>
                                                    <template v-else>
                                                        <span class="text-gray-400 dark:text-gray-500 italic">-- Cari & Pilih Tim --</span>
                                                    </template>
                                                </div>
                                                <div class="flex items-center gap-1 shrink-0 text-gray-400">
                                                    <Icon name="material-symbols:search" class="text-sm" />
                                                    <Icon name="material-symbols:keyboard-arrow-down-rounded" class="text-base" />
                                                </div>
                                            </button>

                                            <!-- Dropdown Popover with Live Search -->
                                            <div
                                                v-if="activeTeamSearchRowIndex === idx"
                                                class="absolute left-0 w-64 sm:w-72 max-w-[90vw] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1.5"
                                                :class="idx >= displayedResultsRows.length - 3 && displayedResultsRows.length > 2 ? 'bottom-full mb-1' : 'top-full mt-1'"
                                                @click.stop
                                            >
                                                <div class="relative flex items-center">
                                                    <Icon name="material-symbols:search" class="absolute left-2.5 text-gray-400 text-sm pointer-events-none" />
                                                    <input
                                                        v-model="teamDropdownSearchQuery"
                                                        type="text"
                                                        autofocus
                                                        placeholder="Ketik nama tim..."
                                                        class="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                                                        @keydown.esc="closeTeamDropdown"
                                                    />
                                                    <button
                                                        v-if="teamDropdownSearchQuery"
                                                        type="button"
                                                        @click="teamDropdownSearchQuery = ''"
                                                        class="absolute right-2 text-gray-400 hover:text-red-600 transition cursor-pointer"
                                                        title="Hapus pencarian"
                                                    >
                                                        <Icon name="material-symbols:close" class="text-xs" />
                                                    </button>
                                                </div>

                                                <div class="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 rounded-lg border border-gray-100 dark:border-slate-800">
                                                    <button
                                                        type="button"
                                                        @click="selectTeamForRow(row, null)"
                                                        class="w-full px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-red-50 dark:hover:bg-slate-800/80 text-red-600 dark:text-red-400 transition cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <Icon name="material-symbols:block" class="text-sm" />
                                                        <span>Tanpa Tim (Kosongkan)</span>
                                                    </button>

                                                    <button
                                                        v-for="t in filteredTeamsForDropdown"
                                                        :key="t.id"
                                                        type="button"
                                                        @click="selectTeamForRow(row, t)"
                                                        class="w-full px-2.5 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between gap-2"
                                                        :class="{ 'bg-blue-50 dark:bg-blue-950/40 font-bold': row.team_id === t.id }"
                                                    >
                                                        <div class="flex items-center gap-2 min-w-0">
                                                            <Icon name="material-symbols:groups" class="text-xs text-blue-600 dark:text-blue-400 shrink-0" />
                                                            <span class="truncate text-black dark:text-white font-medium">
                                                                {{ t.name }}
                                                            </span>
                                                        </div>
                                                        <Icon
                                                            v-if="row.team_id === t.id"
                                                            name="material-symbols:check"
                                                            class="text-blue-600 dark:text-blue-400 text-base shrink-0"
                                                        />
                                                    </button>

                                                    <div v-if="filteredTeamsForDropdown.length === 0" class="p-3 text-center text-xs text-gray-400">
                                                        Tidak ditemukan tim yang cocok
                                                    </div>
                                                </div>

                                                <div class="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-0.5">
                                                    <span>{{ filteredTeamsForDropdown.length }} tim</span>
                                                    <button
                                                        type="button"
                                                        @click="closeTeamDropdown"
                                                        class="text-gray-500 hover:text-black dark:hover:text-white underline cursor-pointer"
                                                    >
                                                        Tutup (Esc)
                                                    </button>
                                                </div>
                                            </div>

                                            <div
                                                v-if="activeTeamSearchRowIndex === idx"
                                                class="fixed inset-0 z-40 bg-transparent"
                                                @click="closeTeamDropdown"
                                            />
                                        </div>
                                    </td>

                                    <!-- Driver Column with Live Search & Co-Drivers (Individual Mode) -->
                                    <td v-if="!isTeamEvent" class="px-3 py-2.5">
                                        <div class="flex flex-col gap-1.5">
                                            <!-- Lead / Primary Driver -->
                                            <div class="relative">
                                                <!-- Trigger Button / Display -->
                                                <button
                                                    type="button"
                                                    @click="openDriverDropdown(idx)"
                                                    class="w-full p-2 text-left rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer flex items-center justify-between gap-1.5 transition hover:border-red-600"
                                                    :class="{ 'ring-1 ring-red-500 border-red-500': activeDriverSearchRowIndex === idx }"
                                                >
                                                    <div class="flex items-center gap-1.5 min-w-0 overflow-hidden truncate">
                                                        <span v-if="row.co_driver_ids && row.co_driver_ids.length > 0" class="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold shrink-0">D1</span>
                                                        <template v-if="row.driver_id && getDriverById(row.driver_id)">
                                                            <Icon
                                                                v-if="getDriverById(row.driver_id)?.countries?.code"
                                                                :name="`flag-${getDriverById(row.driver_id).countries.code.toLowerCase()}-4x3`"
                                                                class="rounded-xs shrink-0"
                                                            />
                                                            <span class="truncate font-bold text-black dark:text-white">
                                                                {{ getDriverById(row.driver_id)?.name }}
                                                            </span>
                                                            <span
                                                                v-if="getDriverById(row.driver_id)?.rating"
                                                                class="text-[10px] px-1 py-0.5 rounded text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 font-normal shrink-0"
                                                            >
                                                                {{ getDriverById(row.driver_id)?.rating }}
                                                            </span>
                                                        </template>
                                                        <template v-else>
                                                            <span class="text-gray-400 dark:text-gray-500 italic">-- Cari & Pilih Pembalap --</span>
                                                        </template>
                                                    </div>
                                                    <div class="flex items-center gap-1 shrink-0 text-gray-400">
                                                        <Icon name="material-symbols:search" class="text-sm" />
                                                        <Icon name="material-symbols:keyboard-arrow-down-rounded" class="text-base" />
                                                    </div>
                                                </button>

                                                <!-- Dropdown Popover with Live Search -->
                                                <div
                                                    v-if="activeDriverSearchRowIndex === idx"
                                                    class="absolute left-0 w-72 sm:w-80 max-w-[90vw] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1.5"
                                                    :class="idx >= displayedResultsRows.length - 3 && displayedResultsRows.length > 2 ? 'bottom-full mb-1' : 'top-full mt-1'"
                                                    @click.stop
                                                >
                                                    <!-- Search Box -->
                                                    <div class="relative flex items-center">
                                                        <Icon name="material-symbols:search" class="absolute left-2.5 text-gray-400 text-sm pointer-events-none" />
                                                        <input
                                                            v-model="driverDropdownSearchQuery"
                                                            type="text"
                                                            autofocus
                                                            placeholder="Ketik nama, tim, atau negara..."
                                                            class="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                                                            @keydown.esc="closeDriverDropdown"
                                                        />
                                                        <button
                                                            v-if="driverDropdownSearchQuery"
                                                            type="button"
                                                            @click="driverDropdownSearchQuery = ''"
                                                            class="absolute right-2 text-gray-400 hover:text-red-600 transition cursor-pointer"
                                                            title="Hapus pencarian"
                                                        >
                                                            <Icon name="material-symbols:close" class="text-xs" />
                                                        </button>
                                                    </div>

                                                    <!-- List of Drivers -->
                                                    <div class="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 rounded-lg border border-gray-100 dark:border-slate-800">
                                                        <!-- Option: Clear Driver -->
                                                        <button
                                                            type="button"
                                                            @click="selectDriverForRow(row, null)"
                                                            class="w-full px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-red-50 dark:hover:bg-slate-800/80 text-red-600 dark:text-red-400 transition cursor-pointer flex items-center gap-1.5"
                                                        >
                                                            <Icon name="material-symbols:block" class="text-sm" />
                                                            <span>Tanpa Pembalap (Kosongkan)</span>
                                                        </button>

                                                        <!-- Filtered Driver Items -->
                                                        <button
                                                            v-for="d in filteredDriversForDropdown"
                                                            :key="d.id"
                                                            type="button"
                                                            @click="selectDriverForRow(row, d)"
                                                            class="w-full px-2.5 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between gap-2"
                                                            :class="{ 'bg-red-50 dark:bg-red-950/40 font-bold': row.driver_id === d.id }"
                                                        >
                                                            <div class="flex items-center gap-2 min-w-0">
                                                                <Icon
                                                                    v-if="d.countries?.code"
                                                                    :name="`flag-${d.countries.code.toLowerCase()}-4x3`"
                                                                    class="rounded-xs shrink-0 text-sm"
                                                                />
                                                                <div class="flex flex-col min-w-0">
                                                                    <span class="truncate text-black dark:text-white font-medium">
                                                                        {{ d.name }}
                                                                    </span>
                                                                    <span v-if="d.teams?.name" class="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                                                        {{ d.teams.name }}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div class="flex items-center gap-1 shrink-0">
                                                                <span
                                                                    v-if="d.rating"
                                                                    class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                                                    :class="getRatingStyle(d.rating)"
                                                                >
                                                                    {{ d.rating }}
                                                                </span>
                                                                <Icon
                                                                    v-if="row.driver_id === d.id"
                                                                    name="material-symbols:check"
                                                                    class="text-red-700 dark:text-red-400 text-base"
                                                                />
                                                            </div>
                                                        </button>

                                                        <div v-if="filteredDriversForDropdown.length === 0" class="p-3 text-center text-xs text-gray-400">
                                                            Tidak ditemukan pembalap yang cocok
                                                        </div>
                                                    </div>

                                                    <div class="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-0.5">
                                                        <span>Ditemukan: {{ filteredDriversForDropdown.length }} pembalap</span>
                                                        <button
                                                            type="button"
                                                            @click="closeDriverDropdown"
                                                            class="text-gray-500 hover:text-black dark:hover:text-white underline cursor-pointer"
                                                        >
                                                            Tutup (Esc)
                                                        </button>
                                                    </div>
                                                </div>

                                                <!-- Backdrop to close dropdown when clicking outside -->
                                                <div
                                                    v-if="activeDriverSearchRowIndex === idx"
                                                    class="fixed inset-0 z-40 bg-transparent"
                                                    @click="closeDriverDropdown"
                                                />
                                            </div>

                                            <!-- Co-Drivers list (if any) -->
                                            <div
                                                v-for="(coId, coIdx) in (row.co_driver_ids || [])"
                                                :key="coIdx"
                                                class="flex items-center gap-1 relative"
                                            >
                                                <span class="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold shrink-0">
                                                    D{{ coIdx + 2 }}
                                                </span>

                                                <div class="relative flex-1">
                                                    <button
                                                        type="button"
                                                        @click="openCoDriverDropdown(idx, coIdx)"
                                                        class="w-full p-1.5 text-left rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer flex items-center justify-between gap-1 transition hover:border-red-600"
                                                        :class="{ 'ring-1 ring-red-500 border-red-500': activeCoDriverSearchIndex?.rowIdx === idx && activeCoDriverSearchIndex?.coIdx === coIdx }"
                                                    >
                                                        <div class="flex items-center gap-1 min-w-0 overflow-hidden truncate">
                                                            <template v-if="coId && getDriverById(coId)">
                                                                <Icon
                                                                    v-if="getDriverById(coId)?.countries?.code"
                                                                    :name="`flag-${getDriverById(coId).countries.code.toLowerCase()}-4x3`"
                                                                    class="rounded-xs shrink-0"
                                                                />
                                                                <span class="truncate font-semibold text-black dark:text-white">
                                                                    {{ getDriverById(coId)?.name }}
                                                                </span>
                                                            </template>
                                                            <template v-else>
                                                                <span class="text-gray-400 dark:text-gray-500 italic">-- Pilih Co-Driver --</span>
                                                            </template>
                                                        </div>
                                                        <Icon name="material-symbols:keyboard-arrow-down-rounded" class="text-sm text-gray-400 shrink-0" />
                                                    </button>

                                                    <!-- Co-Driver Popover -->
                                                    <div
                                                        v-if="activeCoDriverSearchIndex?.rowIdx === idx && activeCoDriverSearchIndex?.coIdx === coIdx"
                                                        class="absolute left-0 w-72 sm:w-80 max-w-[90vw] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1.5"
                                                        :class="idx >= displayedResultsRows.length - 3 && displayedResultsRows.length > 2 ? 'bottom-full mb-1' : 'top-full mt-1'"
                                                        @click.stop
                                                    >
                                                        <div class="relative flex items-center">
                                                            <Icon name="material-symbols:search" class="absolute left-2.5 text-gray-400 text-sm pointer-events-none" />
                                                            <input
                                                                v-model="driverDropdownSearchQuery"
                                                                type="text"
                                                                autofocus
                                                                placeholder="Ketik nama co-driver..."
                                                                class="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                                                                @keydown.esc="closeCoDriverDropdown"
                                                            />
                                                            <button
                                                                v-if="driverDropdownSearchQuery"
                                                                type="button"
                                                                @click="driverDropdownSearchQuery = ''"
                                                                class="absolute right-2 text-gray-400 hover:text-red-600 transition cursor-pointer"
                                                            >
                                                                <Icon name="material-symbols:close" class="text-xs" />
                                                            </button>
                                                        </div>

                                                        <div class="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 rounded-lg border border-gray-100 dark:border-slate-800">
                                                            <button
                                                                v-for="d in filteredDriversForDropdown"
                                                                :key="d.id"
                                                                type="button"
                                                                @click="selectCoDriverForRow(row, coIdx, d)"
                                                                class="w-full px-2.5 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between gap-2"
                                                                :class="{ 'bg-red-50 dark:bg-red-950/40 font-bold': coId === d.id }"
                                                            >
                                                                <div class="flex items-center gap-1.5 min-w-0">
                                                                    <Icon
                                                                        v-if="d.countries?.code"
                                                                        :name="`flag-${d.countries.code.toLowerCase()}-4x3`"
                                                                        class="rounded-xs shrink-0 text-sm"
                                                                    />
                                                                    <span class="truncate text-black dark:text-white font-medium">
                                                                        {{ d.name }}
                                                                    </span>
                                                                </div>
                                                                <Icon
                                                                    v-if="coId === d.id"
                                                                    name="material-symbols:check"
                                                                    class="text-red-700 dark:text-red-400 text-base"
                                                                />
                                                            </button>
                                                        </div>

                                                        <div class="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-0.5">
                                                            <span>{{ filteredDriversForDropdown.length }} pembalap</span>
                                                            <button
                                                                type="button"
                                                                @click="closeCoDriverDropdown"
                                                                class="text-gray-500 hover:text-black dark:hover:text-white underline cursor-pointer"
                                                            >
                                                                Tutup
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div
                                                        v-if="activeCoDriverSearchIndex?.rowIdx === idx && activeCoDriverSearchIndex?.coIdx === coIdx"
                                                        class="fixed inset-0 z-40 bg-transparent"
                                                        @click="closeCoDriverDropdown"
                                                    />
                                                </div>

                                                <button
                                                    type="button"
                                                    @click="removeCoDriverFromRow(row, coIdx)"
                                                    class="p-1 text-gray-400 hover:text-red-600 transition cursor-pointer rounded"
                                                    title="Hapus Co-Driver"
                                                >
                                                    <Icon name="material-symbols:close" class="text-sm" />
                                                </button>
                                            </div>

                                            <!-- Add Co-Driver button -->
                                            <button
                                                type="button"
                                                @click="addCoDriverToRow(row)"
                                                class="self-start text-[11px] font-bold text-red-700 dark:text-red-400 hover:underline cursor-pointer flex items-center gap-1 pt-0.5"
                                            >
                                                <Icon name="material-symbols:person-add" class="text-xs" />
                                                <span>+ Tambah Co-Driver</span>
                                            </button>
                                        </div>
                                    </td>

                                    <!-- Class Column -->
                                    <td class="px-2 py-2.5">
                                        <div class="relative flex items-center">
                                            <select
                                                v-model="row.class_id"
                                                @change="onClassSelected(row)"
                                                class="w-full p-1.5 pr-6 appearance-none rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                                            >
                                                <option value="">{{ availableClassesForSchedule.length > 0 ? '-- Pilih Kelas --' : 'Overall' }}</option>
                                                <option v-for="cls in availableClassesForSchedule" :key="cls.id" :value="cls.id">
                                                    {{ cls.name }}
                                                </option>
                                            </select>
                                            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-1 text-sm text-gray-400 pointer-events-none" />
                                        </div>
                                    </td>

                                    <!-- Scoring / In-Class Position Column -->
                                    <td class="px-2 py-2.5 text-center">
                                        <div class="flex items-center justify-center">
                                            <input
                                                v-model.number="row.scoring_position"
                                                type="number"
                                                min="1"
                                                class="w-12 p-1 text-xs text-center rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-red-500"
                                                title="Posisi Kelas / Poin (Scoring Position)"
                                            />
                                        </div>
                                    </td>

                                    <!-- Team Column with Live Search (Individual Mode) -->
                                    <td v-if="!isTeamEvent" class="px-3 py-2.5">
                                        <div class="relative">
                                            <!-- Trigger Button / Display -->
                                            <button
                                                type="button"
                                                @click="openTeamDropdown(idx)"
                                                class="w-full p-2 text-left rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer flex items-center justify-between gap-1.5 transition hover:border-red-600"
                                                :class="{ 'ring-1 ring-red-500 border-red-500': activeTeamSearchRowIndex === idx }"
                                            >
                                                <div class="flex items-center gap-1.5 min-w-0 overflow-hidden truncate">
                                                    <template v-if="row.team_id && getTeamById(row.team_id)">
                                                        <Icon name="material-symbols:groups" class="text-xs text-red-700 shrink-0" />
                                                        <span class="truncate font-medium text-black dark:text-white">
                                                            {{ getTeamById(row.team_id)?.name }}
                                                        </span>
                                                    </template>
                                                    <template v-else>
                                                        <span class="text-gray-400 dark:text-gray-500 italic">Tanpa Tim / Independen</span>
                                                    </template>
                                                </div>
                                                <div class="flex items-center gap-1 shrink-0 text-gray-400">
                                                    <Icon name="material-symbols:search" class="text-sm" />
                                                    <Icon name="material-symbols:keyboard-arrow-down-rounded" class="text-base" />
                                                </div>
                                            </button>

                                            <!-- Dropdown Popover with Live Search -->
                                            <div
                                                v-if="activeTeamSearchRowIndex === idx"
                                                class="absolute left-0 w-64 sm:w-72 max-w-[90vw] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1.5"
                                                :class="idx >= displayedResultsRows.length - 3 && displayedResultsRows.length > 2 ? 'bottom-full mb-1' : 'top-full mt-1'"
                                                @click.stop
                                            >
                                                <!-- Search Box -->
                                                <div class="relative flex items-center">
                                                    <Icon name="material-symbols:search" class="absolute left-2.5 text-gray-400 text-sm pointer-events-none" />
                                                    <input
                                                        v-model="teamDropdownSearchQuery"
                                                        type="text"
                                                        autofocus
                                                        placeholder="Ketik nama tim..."
                                                        class="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                                                        @keydown.esc="closeTeamDropdown"
                                                    />
                                                    <button
                                                        v-if="teamDropdownSearchQuery"
                                                        type="button"
                                                        @click="teamDropdownSearchQuery = ''"
                                                        class="absolute right-2 text-gray-400 hover:text-red-600 transition cursor-pointer"
                                                        title="Hapus pencarian"
                                                    >
                                                        <Icon name="material-symbols:close" class="text-xs" />
                                                    </button>
                                                </div>

                                                <!-- List of Teams -->
                                                <div class="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 rounded-lg border border-gray-100 dark:border-slate-800">
                                                    <!-- Option: Clear Team / Independent -->
                                                    <button
                                                        type="button"
                                                        @click="selectTeamForRow(row, null)"
                                                        class="w-full px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-red-50 dark:hover:bg-slate-800/80 text-gray-600 dark:text-gray-300 transition cursor-pointer flex items-center gap-1.5"
                                                        :class="{ 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-bold': !row.team_id }"
                                                    >
                                                        <Icon name="material-symbols:person" class="text-sm" />
                                                        <span>Tanpa Tim / Independen</span>
                                                    </button>

                                                    <!-- Filtered Team Items -->
                                                    <button
                                                        v-for="t in filteredTeamsForDropdown"
                                                        :key="t.id"
                                                        type="button"
                                                        @click="selectTeamForRow(row, t)"
                                                        class="w-full px-2.5 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between gap-2"
                                                        :class="{ 'bg-red-50 dark:bg-red-950/40 font-bold': row.team_id === t.id }"
                                                    >
                                                        <div class="flex items-center gap-2 min-w-0">
                                                            <Icon name="material-symbols:groups" class="text-xs text-red-700 shrink-0" />
                                                            <span class="truncate text-black dark:text-white font-medium">
                                                                {{ t.name }}
                                                            </span>
                                                        </div>

                                                        <Icon
                                                            v-if="row.team_id === t.id"
                                                            name="material-symbols:check"
                                                            class="text-red-700 dark:text-red-400 text-base shrink-0"
                                                        />
                                                    </button>

                                                    <div v-if="filteredTeamsForDropdown.length === 0" class="p-3 text-center text-xs text-gray-400">
                                                        Tidak ditemukan tim yang cocok
                                                    </div>
                                                </div>

                                                <div class="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-0.5">
                                                    <span>Ditemukan: {{ filteredTeamsForDropdown.length }} tim</span>
                                                    <button
                                                        type="button"
                                                        @click="closeTeamDropdown"
                                                        class="text-gray-500 hover:text-black dark:hover:text-white underline cursor-pointer"
                                                    >
                                                        Tutup (Esc)
                                                    </button>
                                                </div>
                                            </div>

                                            <!-- Backdrop to close dropdown when clicking outside -->
                                            <div
                                                v-if="activeTeamSearchRowIndex === idx"
                                                class="fixed inset-0 z-40 bg-transparent"
                                                @click="closeTeamDropdown"
                                            />
                                        </div>
                                    </td>

                                    <!-- Status Column -->
                                    <td v-if="selectedSessionType !== 'qualifying'" class="px-2 py-2.5 text-center">
                                        <select
                                            v-model="row.status"
                                            class="w-full p-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-bold focus:outline-none cursor-pointer text-center"
                                            :class="{
                                                'text-emerald-700 dark:text-emerald-400': row.status === 'finished',
                                                'text-rose-700 dark:text-rose-400': row.status === 'dnf',
                                                'text-gray-500 dark:text-gray-400': row.status === 'dns',
                                                'text-purple-700 dark:text-purple-400': row.status === 'dsq'
                                            }"
                                        >
                                            <option v-for="st in resultStatusOptions" :key="st.value" :value="st.value">
                                                {{ st.label }}
                                            </option>
                                        </select>
                                    </td>

                                    <!-- Laps Column -->
                                    <td v-if="selectedSessionType !== 'qualifying'" class="px-2 py-2.5 text-center">
                                        <input
                                            v-model.number="row.num_laps"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            class="w-full max-w-[54px] p-1.5 text-xs text-center rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-red-500"
                                            title="Jumlah Putaran / Laps Selesai"
                                        />
                                    </td>

                                    <!-- Gap / Total Time Column -->
                                    <td class="px-2 py-2.5">
                                        <input
                                            v-model="row.total_time"
                                            type="text"
                                            :placeholder="selectedSessionType === 'qualifying' ? (idx === 0 ? '1:23.456' : '0.123') : '+5.123s'"
                                            :title="selectedSessionType === 'qualifying' ? 'Catatan Waktu Kualifikasi atau Selisih Gap' : 'Selisih Gap atau Total Waktu'"
                                            class="w-full p-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                                        />
                                    </td>

                                    <!-- Penalty Column -->
                                    <td v-if="selectedSessionType !== 'qualifying'" class="px-2 py-2.5 text-center">
                                        <div class="flex items-center justify-center gap-1">
                                            <input
                                                :id="`pen-${idx}`"
                                                v-model="row.has_penalty"
                                                type="checkbox"
                                                class="w-4 h-4 accent-red-700 rounded cursor-pointer shrink-0"
                                                title="Ada Penalti"
                                            />
                                            <div v-if="row.has_penalty" class="flex items-center gap-0.5">
                                                <input
                                                    v-model="row.penalty_time_sec"
                                                    type="number"
                                                    step="any"
                                                    placeholder="0"
                                                    title="Waktu Penalti"
                                                    class="w-12 p-1 text-xs rounded-md border border-rose-400 bg-rose-50 dark:bg-rose-950 text-rose-900 dark:text-rose-200 text-center font-bold focus:outline-none"
                                                />
                                                <span class="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">detik</span>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- No Points Column -->
                                    <td v-if="selectedSessionType !== 'qualifying'" class="px-2 py-2.5 text-center">
                                        <input
                                            :id="`nopts-${idx}`"
                                            v-model="row.no_points"
                                            type="checkbox"
                                            class="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                                            title="Centang jika pembalap/tim tidak berhak mendapatkan poin kejuaraan pada sesi ini"
                                        />
                                    </td>

                                    <!-- Actions Column -->
                                    <td class="px-2 py-2.5 text-center">
                                        <div class="flex items-center justify-center gap-1">
                                            <button
                                                type="button"
                                                @click="removeDisplayedRow(row)"
                                                class="p-1.5 rounded-lg text-gray-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                                title="Hapus Baris Ini"
                                            >
                                                <Icon name="material-symbols:delete-outline" class="text-base" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Bottom Action Bar & Save Buttons -->
                    <div class="p-4 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-4 sticky bottom-4 shadow-xl z-20">
                        <!-- <div class="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                            <span>Selesai: <strong class="text-emerald-700 dark:text-emerald-400">{{ resultsRows.filter(r => r.status === 'finished' && r.driver_id).length }}</strong></span>
                            <span>•</span>
                            <span>DNF/DNS: <strong class="text-rose-700 dark:text-rose-400">{{ resultsRows.filter(r => r.status !== 'finished' && r.driver_id).length }}</strong></span>
                            <span v-if="resultsRows.some(r => r.fastest_lap && r.driver_id)">•</span>
                            <span v-if="resultsRows.some(r => r.fastest_lap && r.driver_id)" class="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                                <Icon name="material-symbols:electric-bolt" />
                                <span>FL: {{ drivers.find(d => d.id === resultsRows.find(r => r.fastest_lap)?.driver_id)?.name }}</span>
                            </span>
                        </div> -->

                        <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <button
                                v-if="hasExistingDbResults"
                                type="button"
                                @click="openDeleteResultsModal"
                                class="px-4 py-2.5 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-300 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer border border-red-300 dark:border-red-800"
                            >
                                Hapus Hasil Sesi
                            </button>
                            <button
                                type="button"
                                @click="openSaveResultsModal"
                                :disabled="savingResults || (isTeamEvent ? resultsRows.filter(r => r.team_id).length === 0 : resultsRows.filter(r => r.driver_id).length === 0)"
                                class="px-6 py-2.5 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                            >
                                <Icon v-if="savingResults" name="material-symbols:refresh" class="animate-spin text-lg" />
                                <Icon v-else name="material-symbols:save" class="text-lg" />
                                <span>Simpan Hasil Balapan</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 6: POINTS SYSTEMS MANAGEMENT -->
            <div v-else-if="activeTab === 'points'" class="flex flex-col gap-6">
                <!-- Info & Search Bar -->
                <div class="bg-red-50 dark:bg-slate-950 p-4 rounded-xl border border-red-200 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div class="flex items-start gap-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                        <Icon name="material-symbols:info" class="text-lg text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
                        <p>
                            Sistem poin menentukan berapa poin didapat setiap posisi finis, plus bonus
                            <span class="font-bold">Fastest Lap</span> dan <span class="font-bold">Pole Position</span>.
                            Satu sistem poin bisa dipakai oleh banyak championship dan ronde.
                        </p>
                    </div>
                    <div class="relative w-full lg:w-72 shrink-0">
                        <input
                            v-model="pointsSystemSearch"
                            type="text"
                            placeholder="Cari sistem poin..."
                            class="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <Icon name="material-symbols:search" class="absolute left-3 top-2.5 text-base text-gray-400" />
                        <button
                            v-if="pointsSystemSearch"
                            type="button"
                            @click="pointsSystemSearch = ''"
                            class="absolute right-3 top-2.5 text-gray-400 hover:text-red-600 transition cursor-pointer"
                        >
                            <Icon name="material-symbols:close" class="text-sm" />
                        </button>
                    </div>
                </div>

                <!-- Loading -->
                <div v-if="loadingPointsSystems" class="py-16 flex flex-col items-center justify-center gap-3">
                    <Icon name="material-symbols:refresh" class="animate-spin text-4xl text-red-700" />
                    <p class="text-sm text-gray-500 dark:text-gray-400">Memuat sistem poin...</p>
                </div>

                <!-- Empty State -->
                <div
                    v-else-if="filteredPointsSystems.length === 0"
                    class="py-16 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800"
                >
                    <Icon name="material-symbols:functions" class="text-5xl text-gray-300 dark:text-slate-700" />
                    <p class="font-bold text-black dark:text-white">
                        {{ pointsSystemSearch ? 'Tidak ada sistem poin yang cocok' : 'Belum ada sistem poin' }}
                    </p>
                    <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Buat sistem poin terlebih dahulu, lalu pasang ke ronde championship di tab Klasemen.
                    </p>
                    <button
                        v-if="!pointsSystemSearch"
                        @click="openCreatePointsSystemModal"
                        class="mt-2 px-5 py-2.5 bg-red-900 hover:bg-red-950 text-white rounded-xl font-bold text-sm transition cursor-pointer flex items-center gap-2"
                    >
                        <Icon name="material-symbols:add" class="text-lg" />
                        <span>Buat Sistem Poin</span>
                    </button>
                </div>

                <!-- Points System Cards -->
                <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div
                        v-for="sys in filteredPointsSystems"
                        :key="sys.id"
                        class="bg-white dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 flex flex-col gap-4 hover:shadow-md transition"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex flex-col gap-1 min-w-0">
                                <h3 class="font-bold text-black dark:text-white text-base leading-tight truncate">{{ sys.name }}</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                    {{ sys.description || 'Tanpa deskripsi' }}
                                </p>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <button
                                    @click="openEditPointsSystemModal(sys)"
                                    class="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition cursor-pointer"
                                    title="Edit sistem poin"
                                >
                                    <Icon name="material-symbols:edit" class="text-base" />
                                </button>
                                <button
                                    @click="openDeletePointsSystemModal(sys)"
                                    class="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-300 transition cursor-pointer"
                                    title="Hapus sistem poin"
                                >
                                    <Icon name="material-symbols:delete" class="text-base" />
                                </button>
                            </div>
                        </div>

                        <!-- Position Points Chips -->
                        <div class="flex flex-col gap-2">
                            <p class="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Poin per Posisi ({{ (sys.points_system_rules || []).length }})
                            </p>
                            <div class="flex flex-wrap gap-1.5">
                                <span
                                    v-for="rule in (sys.points_system_rules || []).slice(0, 12)"
                                    :key="rule.id || rule.position"
                                    class="px-2 py-1 rounded-md text-[11px] font-bold border"
                                    :class="rule.position === 1
                                        ? 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800'
                                        : rule.position === 2
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                            : rule.position === 3
                                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-500 border-amber-300 dark:border-amber-800'
                                                : 'bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700'"
                                >
                                    P{{ rule.position }}: {{ formatPoints(rule.points) }}
                                </span>
                                <span
                                    v-if="(sys.points_system_rules || []).length > 12"
                                    class="px-2 py-1 rounded-md text-[11px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700"
                                >
                                    +{{ (sys.points_system_rules || []).length - 12 }} lagi
                                </span>
                            </div>
                        </div>

                        <!-- Bonuses -->
                        <div v-if="(sys.points_bonuses || []).length > 0" class="flex flex-col gap-2 pt-1 border-t border-gray-100 dark:border-slate-800">
                            <p class="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Bonus</p>
                            <div class="flex flex-wrap gap-1.5">
                                <span
                                    v-for="bonus in sys.points_bonuses"
                                    :key="bonus.id || bonus.bonus_type"
                                    class="px-2 py-1 rounded-md text-[11px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1"
                                >
                                    <Icon
                                        :name="bonus.bonus_type === 'fastest_lap' ? 'material-symbols:electric-bolt' : 'material-symbols:flag'"
                                        class="text-xs"
                                    />
                                    {{ bonus.bonus_type === 'fastest_lap' ? 'Fastest Lap' : 'Pole' }} +{{ formatPoints(bonus.points) }}
                                    <span v-if="!bonus.requires_classification" class="font-normal opacity-70">(tanpa klasifikasi)</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 7: CHAMPIONSHIP STANDINGS MANAGEMENT -->
            <div v-else-if="activeTab === 'standings'" class="flex flex-col gap-6">
                <!-- Season & Championship Selector -->
                <div class="bg-red-50 dark:bg-slate-950 p-5 rounded-2xl border border-red-200 dark:border-slate-800 flex flex-col gap-4">
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                        <!-- Seasons -->
                        <div class="lg:col-span-4 flex flex-col gap-1.5">
                            <div class="flex items-center justify-between">
                                <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                                    Season <span class="text-[11px] font-normal text-gray-500 dark:text-gray-400">({{ seasonsList.length }})</span>
                                </label>
                                <button
                                    @click="openCreateSeasonModal"
                                    class="text-[11px] font-bold text-red-700 dark:text-red-400 hover:underline cursor-pointer flex items-center gap-0.5"
                                >
                                    <Icon name="material-symbols:add" class="text-sm" />
                                    <span>Tambah Season</span>
                                </button>
                            </div>
                            <div v-if="seasonsList.length === 0" class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400">
                                Belum ada season. Buat season dahulu.
                            </div>
                            <div v-else class="flex items-center gap-2">
                                <div class="relative flex-1">
                                    <select
                                        v-model="selectedSeasonId"
                                        class="w-full p-2.5 pr-8 appearance-none rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs sm:text-sm font-medium focus:outline-none cursor-pointer"
                                    >
                                        <option value="">-- Semua Season --</option>
                                        <option v-for="season in sortedSeasonsList" :key="season.id" :value="season.id">
                                            {{ getSeasonLabel(season) }}
                                        </option>
                                    </select>
                                    <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 top-3 text-lg text-gray-400 pointer-events-none" />
                                </div>
                                <button
                                    v-if="selectedSeason"
                                    @click="openEditSeasonModal(selectedSeason)"
                                    class="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition cursor-pointer shrink-0"
                                    title="Edit season terpilih"
                                >
                                    <Icon name="material-symbols:edit" class="text-base" />
                                </button>
                            </div>
                        </div>

                        <!-- Championship Selector -->
                        <div class="lg:col-span-5 flex flex-col gap-1.5">
                            <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                                Pilih Championship <span class="text-[11px] font-normal text-gray-500 dark:text-gray-400">({{ filteredChampionships.length }})</span>
                            </label>
                            <div class="relative">
                                <select
                                    v-model="selectedChampionshipId"
                                    class="w-full p-2.5 pr-8 appearance-none rounded-xl border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-900 text-black dark:text-white text-xs sm:text-sm font-medium focus:outline-none cursor-pointer"
                                >
                                    <option value="">
                                        {{ filteredChampionships.length === 0 && selectedSeasonId
                                            ? '-- Belum ada championship di season ini --'
                                            : '-- Pilih Championship --' }}
                                    </option>
                                    <option v-for="champ in filteredChampionships" :key="champ.id" :value="champ.id">
                                        {{ getChampionshipName(champ) }}
                                        {{ champ.seasons ? '- ' + getSeasonLabel(champ.seasons) : '' }}
                                        ({{ (champ.championship_events || []).length }} ronde)
                                    </option>
                                </select>
                                <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 top-3 text-lg text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="lg:col-span-3 flex items-center gap-2">
                            <button
                                @click="openCreateChampionshipModal"
                                class="flex-1 px-3 py-2.5 bg-red-900 hover:bg-red-950 text-white rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <Icon name="material-symbols:add" class="text-base" />
                                <span>Championship</span>
                            </button>
                            <button
                                v-if="selectedChampionship"
                                @click="openEditChampionshipModal(selectedChampionship)"
                                class="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition cursor-pointer"
                                title="Edit championship"
                            >
                                <Icon name="material-symbols:edit" class="text-base" />
                            </button>
                            <button
                                v-if="selectedChampionship"
                                @click="openDeleteChampionshipModal(selectedChampionship)"
                                class="p-2.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-300 transition cursor-pointer"
                                title="Hapus championship"
                            >
                                <Icon name="material-symbols:delete" class="text-base" />
                            </button>
                        </div>
                    </div>

                    <!-- Selected Championship Summary -->
                    <div
                        v-if="selectedChampionship"
                        class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                    >
                        <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                            <span class="px-2 py-1 rounded-md font-bold bg-red-900 text-white">
                                {{ selectedChampionship.standings_type === 'driver' ? 'PEMBALAP' : 'TIM' }}
                            </span>
                            <span class="font-bold text-black dark:text-white">{{ selectedChampionship.classes?.name || 'Overall' }}</span>
                            <span v-if="selectedChampionship.seasons" class="text-gray-400 dark:text-gray-600">•</span>
                            <span v-if="selectedChampionship.seasons" class="font-semibold text-gray-700 dark:text-gray-300">
                                {{ getSeasonLabel(selectedChampionship.seasons) }}
                            </span>
                            <span class="text-gray-400 dark:text-gray-600">•</span>
                            <span class="text-gray-700 dark:text-gray-300">
                                {{ standingsSummary.scoredRounds }}/{{ standingsSummary.rounds }} ronde ada hasil
                            </span>
                        </div>
                        <button
                            @click="handleRecalculateChampionship(false)"
                            :disabled="recalculating"
                            class="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Icon v-if="recalculating" name="material-symbols:refresh" class="animate-spin text-base" />
                            <Icon v-else name="material-symbols:calculate" class="text-base" />
                            <span>Hitung Ulang Klasemen</span>
                        </button>
                    </div>
                </div>

                <!-- No championship selected -->
                <div
                    v-if="!selectedChampionshipId"
                    class="py-16 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800"
                >
                    <Icon name="material-symbols:emoji-events" class="text-5xl text-gray-300 dark:text-slate-700" />
                    <p class="font-bold text-black dark:text-white">Pilih championship untuk melihat klasemen</p>
                    <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Alur: buat <span class="font-bold">Season</span> → buat <span class="font-bold">Championship</span> →
                        tambahkan <span class="font-bold">Ronde</span> beserta sistem poinnya → simpan hasil balapan.
                    </p>
                </div>

                <template v-else>
                    <!-- ROUNDS CONFIGURATION -->
                    <div class="bg-white dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                        <div class="p-4 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                            <div class="flex flex-col gap-0.5">
                                <h3 class="font-bold text-black dark:text-white text-sm sm:text-base flex items-center gap-2">
                                    <Icon name="material-symbols:list-alt" class="text-lg text-red-700" />
                                    <span>Ronde Championship ({{ championshipRounds.length }})</span>
                                </h3>
                                <p class="text-[11px] text-gray-500 dark:text-gray-400">
                                    Setiap ronde memakai sistem poin sendiri. Ubah pengali untuk ronde double points.
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <div v-if="championshipRounds.length > 0" class="relative">
                                    <select
                                        :value="championshipDefaultSystemId"
                                        @change="applyDefaultSystemToAllRounds($event.target.value)"
                                        class="p-2 pr-7 appearance-none rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs font-medium focus:outline-none cursor-pointer"
                                        title="Terapkan satu sistem poin ke semua ronde"
                                    >
                                        <option value="">-- Terapkan ke semua ronde --</option>
                                        <option v-for="sys in pointsSystems" :key="sys.id" :value="sys.id">
                                            {{ sys.name }}
                                        </option>
                                    </select>
                                    <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-2 top-2.5 text-base text-gray-400 pointer-events-none" />
                                </div>
                                <button
                                    @click="openAddRoundsModal"
                                    class="px-3.5 py-2 bg-red-900 hover:bg-red-950 text-white rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <Icon name="material-symbols:add" class="text-base" />
                                    <span>Tambah Ronde</span>
                                </button>
                            </div>
                        </div>

                        <div v-if="loadingRounds" class="py-10 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Icon name="material-symbols:refresh" class="animate-spin text-xl text-red-700" />
                            <span>Memuat ronde...</span>
                        </div>

                        <div v-else-if="championshipRounds.length === 0" class="py-10 flex flex-col items-center justify-center gap-2">
                            <Icon name="material-symbols:playlist-add" class="text-4xl text-gray-300 dark:text-slate-700" />
                            <p class="text-sm font-bold text-black dark:text-white">Belum ada ronde</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Tambahkan jadwal balapan sebagai ronde championship ini.</p>
                        </div>

                        <div v-else class="overflow-x-auto">
                            <table class="w-full text-xs sm:text-sm">
                                <thead class="bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-400">
                                    <tr>
                                        <th class="px-3 py-2.5 text-left font-bold whitespace-nowrap">#</th>
                                        <th class="px-3 py-2.5 text-left font-bold whitespace-nowrap">Jadwal / Ronde</th>
                                        <th class="px-3 py-2.5 text-left font-bold whitespace-nowrap">Sesi</th>
                                        <th class="px-3 py-2.5 text-left font-bold whitespace-nowrap">Sistem Poin</th>
                                        <th class="px-3 py-2.5 text-center font-bold whitespace-nowrap">Pengali</th>
                                        <th class="px-3 py-2.5 text-center font-bold whitespace-nowrap">Hasil</th>
                                        <th class="px-3 py-2.5 text-center font-bold whitespace-nowrap">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
                                    <tr
                                        v-for="(round, idx) in championshipRounds"
                                        :key="round.id"
                                        class="text-black dark:text-white hover:bg-gray-50 dark:hover:bg-slate-900/60 transition"
                                    >
                                        <td class="px-3 py-2.5 font-bold text-gray-400 dark:text-gray-500">{{ idx + 1 }}</td>
                                        <td class="px-3 py-2.5">
                                            <div class="flex flex-col gap-0.5 min-w-[200px]">
                                                <div class="flex items-center gap-1.5 flex-wrap">
                                                    <span v-if="round.schedule?.events?.organizers?.abbreviation" class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
                                                        {{ round.schedule.events.organizers.abbreviation }}
                                                    </span>
                                                    <span class="font-semibold">{{ round.schedule?.events?.name || 'Event' }}</span>
                                                    <span v-if="round.schedule?.season" class="text-[10px] text-gray-500 dark:text-gray-400">
                                                        (S{{ round.schedule.season }})
                                                    </span>
                                                </div>
                                                <div class="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                                                    <Icon
                                                        v-if="round.schedule?.country"
                                                        :name="`flag-${round.schedule.country.toLowerCase()}-4x3`"
                                                        class="rounded-sm shrink-0"
                                                    />
                                                    <span>R{{ round.schedule?.round || '?' }} — {{ round.schedule?.circuit || 'TBA' }}</span>
                                                    <span>•</span>
                                                    <span>{{ formatDateOnly(round.schedule?.date) }}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-3 py-2.5">
                                            <span
                                                class="px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap"
                                                :class="round.session_type === 'qualifying'
                                                    ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'"
                                            >
                                                {{ sessionTypeOptions.find(o => o.value === round.session_type)?.label || round.session_type }}
                                            </span>
                                        </td>
                                        <td class="px-3 py-2.5">
                                            <div class="relative min-w-[160px]">
                                                <select
                                                    :value="round.points_system_id"
                                                    @change="updateRoundConfig(round, 'points_system_id', $event.target.value)"
                                                    class="w-full p-1.5 pr-7 appearance-none rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                                                >
                                                    <option v-for="sys in pointsSystems" :key="sys.id" :value="sys.id">
                                                        {{ sys.name }}
                                                    </option>
                                                </select>
                                                <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-1.5 top-2 text-sm text-gray-400 pointer-events-none" />
                                            </div>
                                            <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                                {{ summarizePointsSystem(pointsSystemsMapLocal.get(round.points_system_id) || {}) }}
                                            </p>
                                        </td>
                                        <td class="px-3 py-2.5 text-center">
                                            <input
                                                :value="round.points_multiplier"
                                                @change="updateRoundConfig(round, 'points_multiplier', $event.target.value)"
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                class="w-16 p-1.5 text-center rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                                            />
                                        </td>
                                        <td class="px-3 py-2.5 text-center">
                                            <span
                                                v-if="roundHasResults(round)"
                                                class="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                                            >
                                                ● Ada
                                            </span>
                                            <span
                                                v-else
                                                class="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 whitespace-nowrap"
                                            >
                                                ○ Kosong
                                            </span>
                                        </td>
                                        <td class="px-3 py-2.5 text-center">
                                            <button
                                                @click="removeRoundFromChampionship(round)"
                                                class="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-300 transition cursor-pointer"
                                                title="Hapus ronde dari championship"
                                            >
                                                <Icon name="material-symbols:close" class="text-sm" />
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- STANDINGS TABLE -->
                    <div class="bg-white dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                        <div class="p-4 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                            <h3 class="font-bold text-black dark:text-white text-sm sm:text-base flex items-center gap-2">
                                <Icon name="material-symbols:leaderboard" class="text-lg text-red-700" />
                                <span>Klasemen ({{ visibleStandings.length }})</span>
                            </h3>
                            <div class="flex items-center gap-3">
                                <div class="text-[11px] text-gray-500 dark:text-gray-400">
                                    Total poin dibagikan: <span class="font-bold text-black dark:text-white">{{ formatPoints(standingsSummary.totalPoints) }}</span>
                                </div>
                                <div class="flex items-center gap-1 bg-gray-100 dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800">
                                    <button
                                        v-for="opt in standingsTypeOptions"
                                        :key="opt.value"
                                        type="button"
                                        @click="standingsViewType = opt.value"
                                        class="py-1 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                        :class="standingsViewType === opt.value
                                            ? 'bg-red-900 text-white shadow-sm'
                                            : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-800'"
                                    >
                                        {{ opt.value === 'driver' ? 'Pembalap' : 'Tim' }}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div v-if="loadingStandings || recalculating" class="py-10 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Icon name="material-symbols:refresh" class="animate-spin text-xl text-red-700" />
                            <span>{{ recalculating ? 'Menghitung klasemen...' : 'Memuat klasemen...' }}</span>
                        </div>

                        <div v-else-if="visibleStandings.length === 0" class="py-10 flex flex-col items-center justify-center gap-2 px-4">
                            <Icon name="material-symbols:leaderboard" class="text-4xl text-gray-300 dark:text-slate-700" />
                            <p class="text-sm font-bold text-black dark:text-white">Belum ada klasemen</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 text-center max-w-md">
                                <template v-if="standingsViewType !== selectedChampionship?.standings_type">
                                    Championship ini bertipe
                                    <span class="font-bold">{{ selectedChampionship?.standings_type === 'driver' ? 'Pembalap' : 'Tim' }}</span>,
                                    jadi klasemen {{ standingsViewType === 'driver' ? 'pembalap' : 'tim' }} tidak dihitung.
                                </template>
                                <template v-else-if="standingsSummary.scoredRounds === 0">
                                    Belum ada ronde dengan hasil balapan. Simpan hasil di tab Hasil Balapan, klasemen akan otomatis terhitung.
                                </template>
                                <template v-else>
                                    Klik "Hitung Ulang Klasemen" untuk menghitung dari hasil yang sudah ada.
                                </template>
                            </p>
                        </div>

                        <div v-else class="overflow-x-auto">
                            <table class="w-full text-xs sm:text-sm">
                                <thead class="bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-400">
                                    <tr>
                                        <th class="px-3 py-2.5 text-center font-bold whitespace-nowrap">Pos</th>
                                        <th class="px-3 py-2.5 text-left font-bold whitespace-nowrap">
                                            {{ standingsViewType === 'driver' ? 'Pembalap' : 'Tim' }}
                                        </th>
                                        <th class="px-3 py-2.5 text-center font-bold whitespace-nowrap">Poin</th>
                                        <th class="px-3 py-2.5 text-center font-bold whitespace-nowrap">Menang</th>
                                        <th class="px-3 py-2.5 text-center font-bold whitespace-nowrap">Podium</th>
                                        <th class="px-3 py-2.5 text-left font-bold whitespace-nowrap">Diperbarui</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
                                    <tr
                                        v-for="row in visibleStandings"
                                        :key="row.id"
                                        class="transition"
                                        :class="getStandingsRowStyle(row.position)"
                                    >
                                        <td class="px-3 py-2.5 text-center font-extrabold">{{ row.position || '-' }}</td>
                                        <td class="px-3 py-2.5">
                                            <div class="flex items-center gap-2">
                                                <Icon
                                                    v-if="standingsViewType === 'driver' && row.drivers?.countries?.code"
                                                    :name="`flag-${row.drivers.countries.code.toLowerCase()}-4x3`"
                                                    class="rounded-sm shrink-0"
                                                />
                                                <span class="font-semibold">
                                                    {{ standingsViewType === 'driver'
                                                        ? (row.drivers?.name || 'Pembalap tidak ditemukan')
                                                        : (row.car_number ? (row.teams?.name || 'Tim') + ' #' + row.car_number : (row.teams?.name || 'Tim tidak ditemukan')) }}
                                                </span>
                                            </div>
                                        </td>
                                        <td class="px-3 py-2.5 text-center font-extrabold">{{ formatPoints(row.points) }}</td>
                                        <td class="px-3 py-2.5 text-center">{{ row.wins }}</td>
                                        <td class="px-3 py-2.5 text-center">{{ row.podiums }}</td>
                                        <td class="px-3 py-2.5 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {{ formatDateOnly(row.updated_at) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- SCHEDULE MODAL (CREATE / EDIT) -->
        <!-- ========================================== -->
        <div
            v-if="isScheduleModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <span>{{ scheduleModalMode === 'edit' ? 'Edit Jadwal Balapan' : 'Tambah Jadwal Balapan Baru' }}</span>
                    </h2>
                    <button @click="closeScheduleModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="saveSchedule" class="flex flex-col gap-4">
                    <div class="grid grid-cols-5 lg:grid-cols-4 gap-2 sm:gap-4">
                        <div class="col-span-3 lg:col-span-2 flex flex-col gap-1">
                            <label class="text-black dark:text-white text-xs sm:text-sm font-medium">Event <span class="text-red-600">*</span></label>
                            <div class="relative flex items-center">
                                <select
                                    v-model="scheduleFormData.event_id"
                                    required
                                    class="p-2 sm:p-2.5 pr-8 sm:pr-10 appearance-none rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full cursor-pointer"
                                >
                                    <option value="" disabled>-- Pilih Event --</option>
                                    <option v-for="ev in eventsList" :key="ev.id" :value="ev.id">
                                        {{ ev.organizers?.abbreviation ? ev.organizers.abbreviation + ' ' : '' }}{{ ev.name }}
                                    </option>
                                </select>
                                <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-2 sm:right-3 text-lg sm:text-xl text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div class="col-span-1 lg:col-span-1 flex flex-col gap-1">
                            <label class="text-black dark:text-white text-xs sm:text-sm font-medium truncate" title="Season">Season</label>
                            <input
                                v-model="scheduleFormData.season"
                                type="text"
                                placeholder="Contoh: 2"
                                class="p-2 sm:p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                            />
                        </div>
                        <div class="col-span-1 lg:col-span-1 flex flex-col gap-1">
                            <label class="text-black dark:text-white text-xs sm:text-sm font-medium truncate" title="Round">Round <span class="text-red-600">*</span></label>
                            <input
                                v-model="scheduleFormData.round"
                                type="text"
                                placeholder="Contoh: 3"
                                class="p-2 sm:p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                            />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Jadwal Mulai <span class="text-red-600">*</span></label>
                            <input
                                v-model="scheduleFormData.date"
                                type="datetime-local"
                                required
                                class="p-2 sm:p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Jadwal Selesai</label>
                            <input
                                v-model="scheduleFormData.finish_date"
                                type="datetime-local"
                                required
                                class="p-2 sm:p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                            />
                        </div>
                    </div>

                    <div class="grid grid-cols-5 lg:grid-cols-4 gap-2 sm:gap-4">
                        <div class="col-span-3 lg:col-span-2 flex flex-col gap-1">
                            <label class="text-black dark:text-white text-xs sm:text-sm font-medium">Sirkuit (dan Sesi)</label>
                            <input
                                v-model="scheduleFormData.circuit"
                                type="text"
                                placeholder="Contoh: Imola Circuit - Qualifying"
                                class="p-2 sm:p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                            />
                        </div>
                        <div class="col-span-1 lg:col-span-1 flex flex-col gap-1">
                            <label class="text-black dark:text-white text-xs sm:text-sm font-medium truncate" title="Kode Negara 1">Negara 1</label>
                            <input
                                v-model="scheduleFormData.country"
                                type="text"
                                placeholder="us"
                                class="p-2 sm:p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                            />
                        </div>
                        <div class="col-span-1 lg:col-span-1 flex flex-col gap-1">
                            <label class="text-black dark:text-white text-xs sm:text-sm font-medium truncate" title="Kode Negara 2">Negara 2</label>
                            <input
                                v-model="scheduleFormData.country_2"
                                type="text"
                                placeholder="jp"
                                class="p-2 sm:p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                            />
                        </div>
                    </div>

                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Stream Link (YouTube URL)</label>
                        <input
                            v-model="scheduleFormData.stream_link"
                            type="url"
                            placeholder="https://youtube.com/live/..."
                            class="p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                        />
                    </div>

                    <div class="grid grid-cols-2 gap-4 items-end">
                        <div class="flex flex-col gap-2 py-1">
                            <div class="flex items-center gap-2 sm:gap-3">
                                <input
                                    id="postponed-checkbox"
                                    v-model="scheduleFormData.is_postponed"
                                    type="checkbox"
                                    class="w-4 h-4 sm:w-5 sm:h-5 accent-red-900 rounded cursor-pointer shrink-0"
                                />
                                <label for="postponed-checkbox" class="text-black dark:text-white text-xs sm:text-sm font-medium cursor-pointer select-none">
                                    Ditunda
                                </label>
                            </div>
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                            <div class="relative flex items-center">
                                <input
                                    v-model="scheduleAdminPassword"
                                    :type="showScheduleAdminPassword ? 'text' : 'password'"
                                    required
                                    placeholder="Password admin"
                                    @input="scheduleAdminPasswordError = ''"
                                    class="p-2.5 pr-9 sm:pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                                    :class="scheduleAdminPasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                                />
                                <button
                                    type="button"
                                    @click="showScheduleAdminPassword = !showScheduleAdminPassword"
                                    class="absolute right-2.5 sm:right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                    title="Tampilkan/Sembunyikan Password"
                                >
                                    <Icon :name="showScheduleAdminPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-lg sm:text-xl" />
                                </button>
                            </div>
                            <p v-if="scheduleAdminPasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                                {{ scheduleAdminPasswordError }}
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center justify-between border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <div>
                            <button
                                v-if="scheduleModalMode === 'edit'"
                                type="button"
                                @click="openScheduleDeleteModal()"
                                class="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-300 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer border border-red-300 dark:border-red-800 text-sm"
                            >
                                <span>Hapus</span>
                            </button>
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                @click="closeScheduleModal"
                                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                :disabled="saving"
                                class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                            >
                                <Icon v-if="saving" name="material-symbols:refresh" class="animate-spin" />
                                <span>{{ saving ? 'Menyimpan...' : 'Simpan' }}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- SCHEDULE DELETE MODAL -->
        <div
            v-if="isScheduleDeleteModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <span>Konfirmasi Hapus Jadwal</span>
                    </h2>
                    <button @click="closeScheduleDeleteModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="confirmDeleteSchedule" class="flex flex-col gap-4">
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Apakah Anda yakin ingin menghapus jadwal balapan
                        <strong class="text-black dark:text-white">
                            "{{ deletingScheduleItem?.events?.name || '' }} - Round {{ deletingScheduleItem?.round }} - {{ deletingScheduleItem?.circuit }}"
                        </strong>?
                    </p>

                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="scheduleDeletePassword"
                                :type="showScheduleDeletePassword ? 'text' : 'password'"
                                required
                                placeholder="Masukkan password admin"
                                @input="scheduleDeletePasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="scheduleDeletePasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showScheduleDeletePassword = !showScheduleDeletePassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showScheduleDeletePassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="scheduleDeletePasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ scheduleDeletePasswordError }}
                        </p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <button
                            type="button"
                            @click="closeScheduleDeleteModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="deleting"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="deleting" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ deleting ? 'Menghapus...' : 'Hapus' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- DRIVER MODAL (CREATE / EDIT) -->
        <!-- ========================================== -->
        <div
            v-if="isDriverModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <Icon name="material-symbols:sports-motorsports" class="text-red-700" />
                        <span>{{ driverModalMode === 'edit' ? 'Edit Data Pembalap' : 'Tambah Pembalap Baru' }}</span>
                    </h2>
                    <button @click="closeDriverModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="saveDriver" class="flex flex-col gap-4">
                    <!-- Driver Name -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Nama Pembalap <span class="text-red-600">*</span></label>
                        <input
                            v-model="driverFormData.name"
                            type="text"
                            required
                            placeholder="Contoh: Christopher Vinantius"
                            class="p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                        />
                    </div>

                    <!-- Nationality / Country -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">
                            Kewarganegaraan / Negara <span class="text-xs text-gray-400 font-normal">(Opsional)</span>
                        </label>
                        <div class="relative flex items-center">
                            <select
                                v-model="driverFormData.country"
                                class="p-2.5 pr-10 appearance-none rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full cursor-pointer"
                            >
                                <option value="">-- Tanpa Negara / Belum Ditentukan --</option>
                                <option v-for="c in countriesList" :key="c.id" :value="c.id">
                                    {{ c.name }} ({{ c.code?.toUpperCase() }})
                                </option>
                            </select>
                            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 text-xl text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <!-- Team -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">
                            Tim <span class="text-xs text-gray-400 font-normal">(Opsional)</span>
                        </label>
                        <div class="relative flex items-center">
                            <select
                                v-model="driverFormData.team"
                                class="p-2.5 pr-10 appearance-none rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full cursor-pointer"
                            >
                                <option value="">-- Tanpa Tim / Independen --</option>
                                <option v-for="team in teamsList" :key="team.id" :value="team.id">
                                    {{ team.name }}
                                </option>
                            </select>
                            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 text-xl text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <!-- Rating Dropdown (Platinum to Iron) -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">
                            Rating <span class="text-xs text-gray-400 font-normal">(Opsional)</span>
                        </label>
                        <div class="relative flex items-center">
                            <select
                                v-model="driverFormData.rating"
                                class="p-2.5 pr-10 appearance-none rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full cursor-pointer"
                            >
                                <option value="">-- Tanpa Rating (Unrated) --</option>
                                <option v-for="opt in ratingOptions" :key="opt" :value="opt">
                                    {{ opt }}
                                </option>
                            </select>
                            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 text-xl text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <!-- Admin Password -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="driverAdminPassword"
                                :type="showDriverAdminPassword ? 'text' : 'password'"
                                required
                                placeholder="Password admin"
                                @input="driverAdminPasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="driverAdminPasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showDriverAdminPassword = !showDriverAdminPassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showDriverAdminPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="driverAdminPasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ driverAdminPasswordError }}
                        </p>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center justify-between border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <div>
                            <button
                                v-if="driverModalMode === 'edit'"
                                type="button"
                                @click="openDriverDeleteModal()"
                                class="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-300 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer border border-red-300 dark:border-red-800 text-sm"
                            >
                                <span>Hapus</span>
                            </button>
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                @click="closeDriverModal"
                                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                :disabled="saving"
                                class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                            >
                                <Icon v-if="saving" name="material-symbols:refresh" class="animate-spin" />
                                <span>{{ saving ? 'Menyimpan...' : 'Simpan' }}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- DRIVER DELETE MODAL -->
        <div
            v-if="isDriverDeleteModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <span>Konfirmasi Hapus Pembalap</span>
                    </h2>
                    <button @click="closeDriverDeleteModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="confirmDeleteDriver" class="flex flex-col gap-4">
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Apakah Anda yakin ingin menghapus pembalap
                        <strong class="text-black dark:text-white">
                            "{{ deletingDriverItem?.name }}"
                        </strong>
                        ({{ deletingDriverItem?.teams?.name || 'Tanpa Tim' }}{{ deletingDriverItem?.rating ? ' - ' + deletingDriverItem.rating : '' }})?
                    </p>

                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="driverDeletePassword"
                                :type="showDriverDeletePassword ? 'text' : 'password'"
                                required
                                placeholder="Masukkan password admin"
                                @input="driverDeletePasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="driverDeletePasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showDriverDeletePassword = !showDriverDeletePassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showDriverDeletePassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="driverDeletePasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ driverDeletePasswordError }}
                        </p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <button
                            type="button"
                            @click="closeDriverDeleteModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="deleting"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="deleting" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ deleting ? 'Menghapus...' : 'Hapus' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- DRIVER IMPORT EXCEL MODAL -->
        <div
            v-if="isDriverImportModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8 flex flex-col gap-4">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <Icon name="material-symbols:upload-file" class="text-blue-600 text-2xl" />
                        <span>Impor Data Pembalap dari Excel</span>
                    </h2>
                    <button @click="closeDriverImportModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <!-- Template Download & Instructions -->
                <div class="p-3.5 rounded-xl bg-blue-50 dark:bg-slate-950 border border-blue-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="text-xs text-gray-700 dark:text-gray-300">
                        <p class="font-bold text-black dark:text-white">Format Kolom Excel:</p>
                        <p>Kolom wajib: <strong class="text-black dark:text-white">Nama Pembalap</strong>, <strong class="text-black dark:text-white">Tim</strong>, <strong class="text-black dark:text-white">Kewarganegaraan</strong>, <strong class="text-black dark:text-white">Rating</strong></p>
                    </div>
                    <button
                        type="button"
                        @click="downloadDriverTemplate()"
                        class="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                    >
                        <Icon name="material-symbols:download" class="text-base" />
                        <span>Unduh Template</span>
                    </button>
                </div>

                <!-- File Upload Box -->
                <div class="flex flex-col gap-1.5">
                    <label class="text-black dark:text-white text-sm font-semibold">Pilih File Excel (.xlsx / .xls)</label>
                    <div
                        @click="$refs.driverFileInputRef?.click()"
                        class="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-50 dark:bg-slate-950/60 transition text-center"
                    >
                        <input
                            ref="driverFileInputRef"
                            type="file"
                            accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                            @change="handleDriverFileSelect"
                            class="hidden"
                        />
                        <Icon name="material-symbols:cloud-upload-outline" class="text-3xl text-blue-600" />
                        <div v-if="driverImportFile">
                            <p class="text-sm font-bold text-black dark:text-white">{{ driverImportFile.name }}</p>
                            <p class="text-xs text-gray-500">Klik untuk mengganti file</p>
                        </div>
                        <div v-else>
                            <p class="text-sm font-medium text-black dark:text-white">Klik untuk memilih file Excel</p>
                            <p class="text-xs text-gray-400">Format yang didukung: .xlsx, .xls, .csv</p>
                        </div>
                    </div>
                    <p v-if="driverImportError" class="text-xs text-red-600 dark:text-red-400 font-semibold mt-1">
                        {{ driverImportError }}
                    </p>
                </div>

                <!-- Preview Table -->
                <div v-if="driverImportData.length > 0" class="flex flex-col gap-2">
                    <div class="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                        <span>Pratinjau Data ({{ driverImportData.length }} Pembalap):</span>
                        <span class="text-gray-500 font-normal">Data dengan nama yang sama akan diperbarui</span>
                    </div>

                    <div class="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-800 text-xs">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-100 dark:bg-slate-800 text-black dark:text-white sticky top-0">
                                <tr>
                                    <th class="px-3 py-2 w-10">No</th>
                                    <th class="px-3 py-2">Nama Pembalap</th>
                                    <th class="px-3 py-2">Tim</th>
                                    <th class="px-3 py-2">Negara</th>
                                    <th class="px-3 py-2 text-center">Rating</th>
                                    <th class="px-3 py-2 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
                                <tr v-for="(row, idx) in driverImportData" :key="idx">
                                    <td class="px-3 py-1.5 text-gray-400">{{ idx + 1 }}</td>
                                    <td class="px-3 py-1.5 font-bold text-black dark:text-white">{{ row.name }}</td>
                                    <td class="px-3 py-1.5 text-gray-700 dark:text-gray-300">{{ row.team || '-' }}</td>
                                    <td class="px-3 py-1.5 text-gray-700 dark:text-gray-300">{{ row.country }}</td>
                                    <td class="px-3 py-1.5 text-center">
                                        <span class="px-2 py-0.5 rounded text-[10px] font-bold" :class="getRatingStyle(row.rating)">
                                            {{ row.rating }}
                                        </span>
                                    </td>
                                    <td class="px-3 py-1.5 text-center">
                                        <span
                                            class="px-2 py-0.5 rounded text-[10px] font-bold"
                                            :class="isExistingDriver(row.name) ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'"
                                        >
                                            {{ isExistingDriver(row.name) ? 'Update' : 'Baru' }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Admin Password Verification -->
                <form @submit.prevent="confirmImportDrivers" class="flex flex-col gap-4 border-t border-gray-200 dark:border-slate-800 pt-3 mt-1">
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="driverImportAdminPassword"
                                :type="showDriverImportAdminPassword ? 'text' : 'password'"
                                required
                                placeholder="Masukkan password admin"
                                @input="driverImportAdminPasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="driverImportAdminPasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showDriverImportAdminPassword = !showDriverImportAdminPassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showDriverImportAdminPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="driverImportAdminPasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ driverImportAdminPasswordError }}
                        </p>
                    </div>

                    <div class="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            @click="closeDriverImportModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="driverImportLoading || driverImportData.length === 0"
                            class="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm shadow-md"
                        >
                            <Icon v-if="driverImportLoading" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ driverImportLoading ? 'Mengimpor...' : `Impor ${driverImportData.length > 0 ? '(' + driverImportData.length + ')' : ''} Pembalap` }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- TEAM MODAL (CREATE / EDIT) -->
        <!-- ========================================== -->
        <div
            v-if="isTeamModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <Icon name="material-symbols:groups" class="text-red-700" />
                        <span>{{ teamModalMode === 'edit' ? 'Edit Data Tim' : 'Tambah Tim Baru' }}</span>
                    </h2>
                    <button @click="closeTeamModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="saveTeam" class="flex flex-col gap-4">
                    <!-- Team Name -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Nama Tim <span class="text-red-600">*</span></label>
                        <input
                            v-model="teamFormData.name"
                            type="text"
                            required
                            placeholder="Contoh: ALP01 Sim Racing Team"
                            class="p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                        />
                    </div>

                    <!-- Admin Password -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="teamAdminPassword"
                                :type="showTeamAdminPassword ? 'text' : 'password'"
                                required
                                placeholder="Password admin"
                                @input="teamAdminPasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="teamAdminPasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showTeamAdminPassword = !showTeamAdminPassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showTeamAdminPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="teamAdminPasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ teamAdminPasswordError }}
                        </p>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center justify-between border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <div>
                            <button
                                v-if="teamModalMode === 'edit'"
                                type="button"
                                @click="openTeamDeleteModal()"
                                class="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-300 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer border border-red-300 dark:border-red-800 text-sm"
                            >
                                <span>Hapus</span>
                            </button>
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                @click="closeTeamModal"
                                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                :disabled="saving"
                                class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                            >
                                <Icon v-if="saving" name="material-symbols:refresh" class="animate-spin" />
                                <span>{{ saving ? 'Menyimpan...' : 'Simpan' }}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- TEAM DELETE MODAL -->
        <div
            v-if="isTeamDeleteModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <span>Konfirmasi Hapus Tim</span>
                    </h2>
                    <button @click="closeTeamDeleteModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="confirmDeleteTeam" class="flex flex-col gap-4">
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Apakah Anda yakin ingin menghapus tim
                        <strong class="text-black dark:text-white">
                            "{{ deletingTeamItem?.name }}"
                        </strong>?
                    </p>

                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="teamDeletePassword"
                                :type="showTeamDeletePassword ? 'text' : 'password'"
                                required
                                placeholder="Masukkan password admin"
                                @input="teamDeletePasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="teamDeletePasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showTeamDeletePassword = !showTeamDeletePassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showTeamDeletePassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="teamDeletePasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ teamDeletePasswordError }}
                        </p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <button
                            type="button"
                            @click="closeTeamDeleteModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="deleting"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="deleting" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ deleting ? 'Menghapus...' : 'Hapus' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- RENTAL MODAL (CREATE / EDIT) -->
        <!-- ========================================== -->
        <div
            v-if="isRentalModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <Icon name="material-symbols:storefront" class="text-red-700" />
                        <span>{{ rentalModalMode === 'edit' ? 'Edit Data Rental' : 'Tambah Rental Baru' }}</span>
                    </h2>
                    <button @click="closeRentalModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="saveRental" class="flex flex-col gap-4">
                    <!-- Rental Name -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Nama Rental <span class="text-red-600">*</span></label>
                        <input
                            v-model="rentalFormData.name"
                            type="text"
                            required
                            placeholder="Contoh: ProjectNexus Sim Racing Center"
                            class="p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                        />
                    </div>

                    <!-- Instagram Username / Link -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Instagram (Username atau Link URL)</label>
                        <div class="relative flex items-center">
                            <input
                                v-model="rentalFormData.instagram"
                                type="text"
                                placeholder="Contoh: @projectnexus.id atau https://instagram.com/..."
                                class="p-2.5 pl-9 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                            />
                            <Icon name="simple-icons:instagram" class="absolute left-3 text-pink-600 text-lg pointer-events-none" />
                        </div>
                    </div>

                    <!-- Google Maps Link -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Link Google Maps</label>
                        <div class="relative flex items-center">
                            <input
                                v-model="rentalFormData.location"
                                type="url"
                                placeholder="https://maps.app.goo.gl/..."
                                class="p-2.5 pl-9 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                            />
                            <Icon name="simple-icons:googlemaps" class="absolute left-3 text-emerald-600 text-lg pointer-events-none" />
                        </div>
                    </div>

                    <!-- Province & Regency -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Provinsi</label>
                            <input
                                v-model="rentalFormData.province"
                                type="text"
                                placeholder="Contoh: DKI Jakarta"
                                class="p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Kota / Kabupaten</label>
                            <input
                                v-model="rentalFormData.regency"
                                type="text"
                                placeholder="Contoh: Jakarta Selatan"
                                class="p-2.5 rounded-lg border-2 border-red-900 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                            />
                        </div>
                    </div>

                    <!-- Admin Password -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="rentalAdminPassword"
                                :type="showRentalAdminPassword ? 'text' : 'password'"
                                required
                                placeholder="Password admin"
                                @input="rentalAdminPasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="rentalAdminPasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showRentalAdminPassword = !showRentalAdminPassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showRentalAdminPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="rentalAdminPasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ rentalAdminPasswordError }}
                        </p>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center justify-between border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <div>
                            <button
                                v-if="rentalModalMode === 'edit'"
                                type="button"
                                @click="openRentalDeleteModal()"
                                class="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-300 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer border border-red-300 dark:border-red-800 text-sm"
                            >
                                <span>Hapus</span>
                            </button>
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                @click="closeRentalModal"
                                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                :disabled="saving"
                                class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                            >
                                <Icon v-if="saving" name="material-symbols:refresh" class="animate-spin" />
                                <span>{{ saving ? 'Menyimpan...' : 'Simpan' }}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- RENTAL DELETE MODAL -->
        <div
            v-if="isRentalDeleteModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <span>Konfirmasi Hapus Rental</span>
                    </h2>
                    <button @click="closeRentalDeleteModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="confirmDeleteRental" class="flex flex-col gap-4">
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Apakah Anda yakin ingin menghapus rental
                        <strong class="text-black dark:text-white">
                            "{{ deletingRentalItem?.name }}"
                        </strong>
                        ({{ deletingRentalItem?.regency ? deletingRentalItem.regency + ', ' : '' }}{{ deletingRentalItem?.province }})?
                    </p>

                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="rentalDeletePassword"
                                :type="showRentalDeletePassword ? 'text' : 'password'"
                                required
                                placeholder="Masukkan password admin"
                                @input="rentalDeletePasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="rentalDeletePasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showRentalDeletePassword = !showRentalDeletePassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showRentalDeletePassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="rentalDeletePasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ rentalDeletePasswordError }}
                        </p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <button
                            type="button"
                            @click="closeRentalDeleteModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="deleting"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="deleting" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ deleting ? 'Menghapus...' : 'Hapus' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- RACE RESULTS SAVE MODAL -->
        <!-- ========================================== -->
        <div
            v-if="isResultsSaveModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <Icon name="material-symbols:trophy" class="text-red-700" />
                        <span>Konfirmasi Simpan Hasil</span>
                    </h2>
                    <button @click="closeSaveResultsModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="confirmSaveRaceResults" class="flex flex-col gap-4">
                    <div class="p-3.5 rounded-xl bg-red-50 dark:bg-slate-950 border border-red-200 dark:border-slate-800 text-xs text-gray-700 dark:text-gray-300 flex flex-col gap-1.5">
                        <p class="font-bold text-black dark:text-white">Detail Penyimpanan:</p>
                        <p>Event: <strong>{{ selectedSchedule?.events?.name }} (Round {{ selectedSchedule?.round }})</strong></p>
                        <p>Sesi: <strong class="capitalize">{{ selectedSessionType }}</strong></p>
                        <p>
                            Status Hasil:
                            <strong :class="isResultsProvisional ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
                                {{ isResultsProvisional ? 'Sementara (Provisional)' : 'Resmi (Official / Final)' }}
                            </strong>
                        </p>
                        <p v-if="selectedEntryClassId !== 'ALL'">
                            Mode Input: <strong class="text-red-700 dark:text-red-400">Khusus Kelas {{ getClassNameById(selectedEntryClassId) }}</strong> ({{ displayedResultsRows.filter(r => isTeamEvent ? r.team_id : r.driver_id).length }} {{ isTeamEvent ? 'Tim' : 'Pembalap' }})
                        </p>
                        <p v-else>
                            Mode Input: <strong>Semua Kelas / Overall Grid</strong> ({{ resultsRows.filter(r => isTeamEvent ? r.team_id : r.driver_id).length }} {{ isTeamEvent ? 'Tim' : 'Pembalap' }})
                        </p>
                        <p v-if="isTeamEvent">
                            Tipe Event: <strong class="text-blue-600 dark:text-blue-400">Team Event (Balapan Tim)</strong>
                        </p>
                        <p v-if="selectedEntryClassId !== 'ALL'" class="text-[11px] text-blue-600 dark:text-blue-400">
                            *Hasil kelas lain pada sesi ini tidak akan terhapus dan tetap terjaga di database.
                        </p>
                    </div>

                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="resultsAdminPassword"
                                :type="showResultsAdminPassword ? 'text' : 'password'"
                                required
                                placeholder="Masukkan password admin"
                                @input="resultsAdminPasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="resultsAdminPasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showResultsAdminPassword = !showResultsAdminPassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showResultsAdminPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="resultsAdminPasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ resultsAdminPasswordError }}
                        </p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <button
                            type="button"
                            @click="closeSaveResultsModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="savingResults"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm shadow-md"
                        >
                            <Icon v-if="savingResults" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ savingResults ? 'Menyimpan...' : 'Simpan Hasil' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- RACE RESULTS DELETE MODAL -->
        <div
            v-if="isResultsDeleteModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <span>Konfirmasi Hapus Hasil Balapan</span>
                    </h2>
                    <button @click="closeDeleteResultsModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="confirmDeleteRaceResults" class="flex flex-col gap-4">
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Apakah Anda yakin ingin menghapus semua data hasil balapan untuk
                        <strong class="text-black dark:text-white">
                            "{{ selectedSchedule?.events?.name }} - Round {{ selectedSchedule?.round }} (Sesi: {{ selectedSessionType }})"
                        </strong>?
                    </p>

                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="resultsDeletePassword"
                                :type="showResultsDeletePassword ? 'text' : 'password'"
                                required
                                placeholder="Masukkan password admin"
                                @input="resultsDeletePasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="resultsDeletePasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-900 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showResultsDeletePassword = !showResultsDeletePassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showResultsDeletePassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="resultsDeletePasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ resultsDeletePasswordError }}
                        </p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <button
                            type="button"
                            @click="closeDeleteResultsModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="deleting"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 dark:bg-red-900 dark:hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="deleting" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ deleting ? 'Menghapus...' : 'Hapus Hasil' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- POINTS SYSTEM MODAL (CREATE / EDIT) -->
        <!-- ========================================== -->
        <div
            v-if="isPointsSystemModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-lg lg:text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <Icon name="material-symbols:functions" class="text-red-700" />
                        <span>{{ pointsSystemModalMode === 'create' ? 'Buat Sistem Poin' : 'Edit Sistem Poin' }}</span>
                    </h2>
                    <button @click="closePointsSystemModal" class="text-gray-400 hover:text-red-600 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="savePointsSystem" class="flex flex-col gap-4">
                    <!-- Name & Description -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                                Nama Sistem Poin <span class="text-red-600">*</span>
                            </label>
                            <input
                                v-model="pointsSystemForm.name"
                                type="text"
                                required
                                placeholder="cth. F1 Modern (25-18-15)"
                                class="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-xs sm:text-sm font-bold text-black dark:text-white">Deskripsi</label>
                            <input
                                v-model="pointsSystemForm.description"
                                type="text"
                                placeholder="cth. Top 10 dapat poin"
                                class="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                        </div>
                    </div>

                    <!-- Presets -->
                    <div class="flex flex-col gap-2 p-3.5 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800">
                        <p class="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Preset Cepat</p>
                        <div class="flex flex-wrap gap-2">
                            <button
                                v-for="preset in POINTS_SYSTEM_PRESETS"
                                :key="preset.name"
                                type="button"
                                @click="applyPointsPreset(preset)"
                                class="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-xs font-semibold text-black dark:text-white hover:border-red-600 hover:text-red-700 dark:hover:text-red-400 transition cursor-pointer"
                                :title="preset.description"
                            >
                                {{ preset.name }}
                            </button>
                        </div>
                    </div>

                    <!-- Position Rules -->
                    <div class="flex flex-col gap-2">
                        <div class="flex items-center justify-between">
                            <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                                Poin per Posisi <span class="text-red-600">*</span>
                                <span class="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                                    ({{ pointsSystemForm.rules.length }} posisi)
                                </span>
                            </label>
                            <button
                                type="button"
                                @click="addPointsRule"
                                class="text-[11px] font-bold text-red-700 dark:text-red-400 hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                                <Icon name="material-symbols:add" class="text-sm" />
                                <span>Tambah Posisi</span>
                            </button>
                        </div>

                        <div
                            v-if="pointsSystemForm.rules.length === 0"
                            class="p-4 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 text-center text-xs text-gray-500 dark:text-gray-400"
                        >
                            Belum ada aturan poin. Pakai preset di atas atau tambah posisi manual.
                        </div>

                        <div v-else class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-1">
                            <div
                                v-for="(rule, idx) in pointsSystemForm.rules"
                                :key="idx"
                                class="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800"
                            >
                                <span class="text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0 w-7">P{{ rule.position }}</span>
                                <input
                                    v-model.number="rule.points"
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    class="w-full min-w-0 p-1.5 text-center rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                                />
                                <button
                                    type="button"
                                    @click="removePointsRule(idx)"
                                    class="text-gray-400 hover:text-red-600 transition cursor-pointer shrink-0"
                                    title="Hapus posisi"
                                >
                                    <Icon name="material-symbols:close" class="text-sm" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Bonuses -->
                    <div class="flex flex-col gap-2">
                        <div class="flex items-center justify-between">
                            <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                                Bonus Poin
                                <span class="text-[11px] font-normal text-gray-500 dark:text-gray-400">(opsional)</span>
                            </label>
                            <button
                                type="button"
                                @click="addPointsBonus"
                                class="text-[11px] font-bold text-red-700 dark:text-red-400 hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                                <Icon name="material-symbols:add" class="text-sm" />
                                <span>Tambah Bonus</span>
                            </button>
                        </div>

                        <div
                            v-if="pointsSystemForm.bonuses.length === 0"
                            class="p-3 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 text-center text-xs text-gray-500 dark:text-gray-400"
                        >
                            Tanpa bonus. Tambahkan bonus Fastest Lap atau Pole Position bila perlu.
                        </div>

                        <div v-else class="flex flex-col gap-2">
                            <div
                                v-for="(bonus, idx) in pointsSystemForm.bonuses"
                                :key="idx"
                                class="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900"
                            >
                                <div class="relative flex-1 min-w-[140px]">
                                    <select
                                        v-model="bonus.bonus_type"
                                        class="w-full p-1.5 pr-7 appearance-none rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs focus:outline-none cursor-pointer"
                                    >
                                        <option v-for="opt in bonusTypeOptions" :key="opt.value" :value="opt.value">
                                            {{ opt.label }}
                                        </option>
                                    </select>
                                    <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-1.5 top-2 text-sm text-gray-400 pointer-events-none" />
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-xs font-bold text-gray-600 dark:text-gray-300">+</span>
                                    <input
                                        v-model.number="bonus.points"
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        class="w-16 p-1.5 text-center rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                                    />
                                    <span class="text-xs text-gray-600 dark:text-gray-300">poin</span>
                                </div>
                                <label class="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <input
                                        v-model="bonus.requires_classification"
                                        type="checkbox"
                                        class="w-3.5 h-3.5 accent-red-900 cursor-pointer"
                                    />
                                    <span>Wajib terklasifikasi</span>
                                </label>
                                <button
                                    type="button"
                                    @click="removePointsBonus(idx)"
                                    class="ml-auto text-gray-400 hover:text-red-600 transition cursor-pointer"
                                    title="Hapus bonus"
                                >
                                    <Icon name="material-symbols:delete" class="text-base" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Password -->
                    <div class="flex flex-col gap-1.5 pt-2 border-t border-gray-200 dark:border-slate-800">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                            Password Admin <span class="text-red-600">*</span>
                        </label>
                        <div class="relative">
                            <input
                                v-model="pointsSystemPassword"
                                :type="showPointsSystemPassword ? 'text' : 'password'"
                                required
                                placeholder="Masukkan password admin"
                                class="w-full p-2.5 pr-10 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                            <button
                                type="button"
                                @click="showPointsSystemPassword = !showPointsSystemPassword"
                                class="absolute right-3 top-3 text-gray-400 hover:text-red-600 transition cursor-pointer"
                            >
                                <Icon :name="showPointsSystemPassword ? 'material-symbols:visibility-off' : 'material-symbols:visibility'" />
                            </button>
                        </div>
                        <p v-if="pointsSystemPasswordError" class="text-xs text-red-600 font-semibold">{{ pointsSystemPasswordError }}</p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4">
                        <button
                            type="button"
                            @click="closePointsSystemModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="savingPointsSystem"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="savingPointsSystem" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ savingPointsSystem ? 'Menyimpan...' : 'Simpan Sistem Poin' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- POINTS SYSTEM DELETE MODAL -->
        <!-- ========================================== -->
        <div
            v-if="isPointsSystemDeleteModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2.5 rounded-full bg-red-100 dark:bg-red-950">
                        <Icon name="material-symbols:warning" class="text-2xl text-red-700 dark:text-red-400" />
                    </div>
                    <h2 class="text-lg font-bold text-black dark:text-white">Hapus Sistem Poin</h2>
                </div>

                <form @submit.prevent="confirmDeletePointsSystem" class="flex flex-col gap-4">
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Yakin ingin menghapus sistem poin
                        <span class="font-bold text-black dark:text-white">{{ deletingPointsSystemItem?.name }}</span>?
                        Aturan poin dan bonusnya juga akan dihapus.
                    </p>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                            Password Admin <span class="text-red-600">*</span>
                        </label>
                        <div class="relative">
                            <input
                                v-model="pointsSystemDeletePassword"
                                :type="showPointsSystemDeletePassword ? 'text' : 'password'"
                                required
                                class="w-full p-2.5 pr-10 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                            <button
                                type="button"
                                @click="showPointsSystemDeletePassword = !showPointsSystemDeletePassword"
                                class="absolute right-3 top-3 text-gray-400 hover:text-red-600 transition cursor-pointer"
                            >
                                <Icon :name="showPointsSystemDeletePassword ? 'material-symbols:visibility-off' : 'material-symbols:visibility'" />
                            </button>
                        </div>
                        <p v-if="pointsSystemDeletePasswordError" class="text-xs text-red-600 font-semibold">{{ pointsSystemDeletePasswordError }}</p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4">
                        <button
                            type="button"
                            @click="closeDeletePointsSystemModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="deleting"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="deleting" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ deleting ? 'Menghapus...' : 'Hapus' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- SEASON MODAL (CREATE / EDIT) -->
        <!-- ========================================== -->
        <div
            v-if="isSeasonModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-lg lg:text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <Icon name="material-symbols:calendar-clock" class="text-red-700" />
                        <span>{{ seasonModalMode === 'create' ? 'Buat Season' : 'Edit Season' }}</span>
                    </h2>
                    <button @click="closeSeasonModal" class="text-gray-400 hover:text-red-600 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="saveSeason" class="flex flex-col gap-4">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                            Event <span class="text-red-600">*</span>
                        </label>
                        <div class="relative">
                            <select
                                v-model="seasonForm.event_id"
                                required
                                class="w-full p-2.5 pr-8 appearance-none rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none cursor-pointer"
                            >
                                <option value="" disabled>-- Pilih Event --</option>
                                <option v-for="ev in eventsList" :key="ev.id" :value="ev.id">
                                    {{ ev.organizers?.abbreviation ? '[' + ev.organizers.abbreviation + '] ' : '' }}{{ ev.name }}
                                </option>
                            </select>
                            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 top-3 text-lg text-gray-400 pointer-events-none" />
                        </div>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400">
                            Season terikat ke satu event, cth. Masters League Season 7.
                        </p>
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                            Nomor Season <span class="text-red-600">*</span>
                        </label>
                        <input
                            v-model.number="seasonForm.season_number"
                            type="number"
                            required
                            min="1"
                            max="999"
                            placeholder="cth. 7"
                            class="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                    </div>

                    <div class="flex flex-col gap-1.5 pt-2 border-t border-gray-200 dark:border-slate-800">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                            Password Admin <span class="text-red-600">*</span>
                        </label>
                        <div class="relative">
                            <input
                                v-model="seasonPassword"
                                :type="showSeasonPassword ? 'text' : 'password'"
                                required
                                class="w-full p-2.5 pr-10 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                            <button
                                type="button"
                                @click="showSeasonPassword = !showSeasonPassword"
                                class="absolute right-3 top-3 text-gray-400 hover:text-red-600 transition cursor-pointer"
                            >
                                <Icon :name="showSeasonPassword ? 'material-symbols:visibility-off' : 'material-symbols:visibility'" />
                            </button>
                        </div>
                        <p v-if="seasonPasswordError" class="text-xs text-red-600 font-semibold">{{ seasonPasswordError }}</p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4">
                        <button
                            type="button"
                            @click="closeSeasonModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="savingSeason"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="savingSeason" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ savingSeason ? 'Menyimpan...' : 'Simpan Season' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- CHAMPIONSHIP MODAL (CREATE / EDIT) -->
        <!-- ========================================== -->
        <div
            v-if="isChampionshipModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-lg lg:text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <Icon name="material-symbols:emoji-events" class="text-red-700" />
                        <span>{{ championshipModalMode === 'create' ? 'Buat Championship' : 'Edit Championship' }}</span>
                    </h2>
                    <button @click="closeChampionshipModal" class="text-gray-400 hover:text-red-600 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <form @submit.prevent="saveChampionship" class="flex flex-col gap-4">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                            Season <span class="text-red-600">*</span>
                        </label>
                        <div v-if="seasonsList.length === 0" class="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                            Belum ada season. Tutup modal ini dan buat season terlebih dahulu.
                        </div>
                        <div v-else class="relative">
                            <select
                                v-model="championshipForm.season_id"
                                required
                                class="w-full p-2.5 pr-8 appearance-none rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none cursor-pointer"
                            >
                                <option value="" disabled>-- Pilih Season --</option>
                                <option v-for="season in sortedSeasonsList" :key="season.id" :value="season.id">
                                    {{ getSeasonLabel(season) }}
                                </option>
                            </select>
                            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 top-3 text-lg text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <div class="flex items-center justify-between">
                            <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                                Kelas / Kategori <span class="text-[11px] font-normal text-gray-500 dark:text-gray-400">(Opsional)</span>
                            </label>
                            <button
                                v-if="selectedSeasonInModal?.event_id && !showAddClassInput"
                                type="button"
                                @click="showAddClassInput = true"
                                class="text-[11px] font-bold text-red-700 dark:text-red-400 hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                                <Icon name="material-symbols:add" class="text-sm" />
                                <span>Tambah Kelas Baru</span>
                            </button>
                        </div>

                        <!-- Inline add class input -->
                        <div v-if="showAddClassInput" class="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 flex flex-col gap-2">
                            <label class="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                                Tambah Kelas untuk Event: {{ selectedSeasonInModal?.events?.name || 'Event' }}
                            </label>
                            <div class="flex items-center gap-2">
                                <input
                                    v-model="newClassName"
                                    type="text"
                                    placeholder="cth. GT3, Pro, Am, TCR..."
                                    class="flex-1 p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                                    @keydown.enter.prevent="handleCreateClass"
                                />
                                <button
                                    type="button"
                                    @click="handleCreateClass"
                                    :disabled="creatingClass || !newClassName.trim()"
                                    class="px-3 py-2 bg-red-900 hover:bg-red-950 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                >
                                    <Icon v-if="creatingClass" name="material-symbols:refresh" class="animate-spin text-sm" />
                                    <span>Simpan</span>
                                </button>
                                <button
                                    type="button"
                                    @click="showAddClassInput = false; newClassName = ''"
                                    class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                                >
                                    Batal
                                </button>
                            </div>
                        </div>

                        <div class="relative">
                            <select
                                v-model="championshipForm.class_id"
                                class="w-full p-2.5 pr-8 appearance-none rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none cursor-pointer"
                            >
                                <option value="">-- Tanpa Kelas (Overall / Semua Kelas) --</option>
                                <option v-for="cls in availableClassesForModal" :key="cls.id" :value="cls.id">
                                    {{ cls.name }}
                                </option>
                            </select>
                            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 top-3 text-lg text-gray-400 pointer-events-none" />
                        </div>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400">
                            Pilih kelas jika championship ini dikhususkan untuk kelas tertentu (misal: GT3, PRO, AM).
                        </p>
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                            Tipe Klasemen <span class="text-red-600">*</span>
                        </label>
                        <div class="flex items-center gap-1 bg-gray-100 dark:bg-slate-950 p-1 rounded-xl border border-gray-200 dark:border-slate-800">
                            <button
                                v-for="opt in standingsTypeOptions"
                                :key="opt.value"
                                type="button"
                                @click="championshipForm.standings_type = opt.value"
                                class="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition text-center cursor-pointer"
                                :class="championshipForm.standings_type === opt.value
                                    ? 'bg-red-900 text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-900'"
                            >
                                {{ opt.label }}
                            </button>
                        </div>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400">
                            Klasemen tim menjumlahkan poin semua mobil yang diturunkan tim di setiap sesi.
                        </p>
                    </div>

                    <div v-if="championshipModalMode === 'create'" class="flex flex-col gap-1.5">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">Sistem Poin Default</label>
                        <div v-if="pointsSystems.length === 0" class="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                            Belum ada sistem poin. Buat di tab Sistem Poin sebelum menambah ronde.
                        </div>
                        <div v-else class="relative">
                            <select
                                v-model="championshipForm.default_points_system_id"
                                class="w-full p-2.5 pr-8 appearance-none rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none cursor-pointer"
                            >
                                <option v-for="sys in pointsSystems" :key="sys.id" :value="sys.id">
                                    {{ sys.name }} — {{ summarizePointsSystem(sys) }}
                                </option>
                            </select>
                            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 top-3 text-lg text-gray-400 pointer-events-none" />
                        </div>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400">
                            Ronde yang ditambahkan akan mewarisi sistem poin ini, dan bisa diubah per ronde.
                        </p>
                    </div>

                    <div class="flex flex-col gap-1.5 pt-2 border-t border-gray-200 dark:border-slate-800">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                            Password Admin <span class="text-red-600">*</span>
                        </label>
                        <div class="relative">
                            <input
                                v-model="championshipPassword"
                                :type="showChampionshipPassword ? 'text' : 'password'"
                                required
                                class="w-full p-2.5 pr-10 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                            <button
                                type="button"
                                @click="showChampionshipPassword = !showChampionshipPassword"
                                class="absolute right-3 top-3 text-gray-400 hover:text-red-600 transition cursor-pointer"
                            >
                                <Icon :name="showChampionshipPassword ? 'material-symbols:visibility-off' : 'material-symbols:visibility'" />
                            </button>
                        </div>
                        <p v-if="championshipPasswordError" class="text-xs text-red-600 font-semibold">{{ championshipPasswordError }}</p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4">
                        <button
                            type="button"
                            @click="closeChampionshipModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="savingChampionship || seasonsList.length === 0"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="savingChampionship" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ savingChampionship ? 'Menyimpan...' : 'Simpan Championship' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- CHAMPIONSHIP DELETE MODAL -->
        <!-- ========================================== -->
        <div
            v-if="isChampionshipDeleteModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2.5 rounded-full bg-red-100 dark:bg-red-950">
                        <Icon name="material-symbols:warning" class="text-2xl text-red-700 dark:text-red-400" />
                    </div>
                    <h2 class="text-lg font-bold text-black dark:text-white">Hapus Championship</h2>
                </div>

                <form @submit.prevent="confirmDeleteChampionship" class="flex flex-col gap-4">
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Yakin ingin menghapus championship
                        <span class="font-bold text-black dark:text-white">{{ getChampionshipFullName(deletingChampionshipItem) }}</span>?
                        Semua konfigurasi ronde dan klasemennya akan dihapus. Hasil balapan tetap aman.
                    </p>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs sm:text-sm font-bold text-black dark:text-white">
                            Password Admin <span class="text-red-600">*</span>
                        </label>
                        <div class="relative">
                            <input
                                v-model="championshipDeletePassword"
                                :type="showChampionshipDeletePassword ? 'text' : 'password'"
                                required
                                class="w-full p-2.5 pr-10 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                            <button
                                type="button"
                                @click="showChampionshipDeletePassword = !showChampionshipDeletePassword"
                                class="absolute right-3 top-3 text-gray-400 hover:text-red-600 transition cursor-pointer"
                            >
                                <Icon :name="showChampionshipDeletePassword ? 'material-symbols:visibility-off' : 'material-symbols:visibility'" />
                            </button>
                        </div>
                        <p v-if="championshipDeletePasswordError" class="text-xs text-red-600 font-semibold">{{ championshipDeletePasswordError }}</p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4">
                        <button
                            type="button"
                            @click="closeDeleteChampionshipModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="deleting"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="deleting" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ deleting ? 'Menghapus...' : 'Hapus' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- ADD ROUNDS TO CHAMPIONSHIP MODAL -->
        <!-- ========================================== -->
        <div
            v-if="isAddRoundsModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <div class="flex flex-col gap-0.5">
                        <h2 class="text-lg lg:text-xl font-bold text-black dark:text-white flex items-center gap-2">
                            <Icon name="material-symbols:playlist-add" class="text-red-700" />
                            <span>Tambah Ronde</span>
                        </h2>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400">
                            Ronde baru mewarisi sistem poin
                            <span class="font-bold text-black dark:text-white">
                                {{ pointsSystemsMapLocal.get(championshipDefaultSystemId)?.name || 'default' }}
                            </span>
                            dan pengali 1x.
                        </p>
                    </div>
                    <button @click="closeAddRoundsModal" class="text-gray-400 hover:text-red-600 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <div class="flex flex-col gap-4">
                    <div class="flex flex-col sm:flex-row items-center gap-2">
                        <div class="relative flex-1 w-full">
                            <input
                                v-model="addRoundsSearch"
                                type="text"
                                placeholder="Cari event / sirkuit / ronde..."
                                class="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                            <Icon name="material-symbols:search" class="absolute left-3 top-3 text-base text-gray-400" />
                            <button
                                v-if="addRoundsSearch"
                                type="button"
                                @click="addRoundsSearch = ''"
                                class="absolute right-3 top-3 text-gray-400 hover:text-red-600 transition cursor-pointer"
                            >
                                <Icon name="material-symbols:close" class="text-sm" />
                            </button>
                        </div>
                        <button
                            type="button"
                            @click="selectAllVisibleRounds"
                            class="w-full sm:w-auto px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap"
                        >
                            Pilih Semua Sesi Race
                        </button>
                    </div>

                    <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-500 dark:text-gray-400">
                            {{ availableRoundsToAdd.length }} sesi tersedia
                        </span>
                        <span class="font-bold text-red-700 dark:text-red-400">
                            {{ addRoundsSelection.length }} dipilih
                        </span>
                    </div>

                    <div
                        v-if="availableRoundsToAdd.length === 0"
                        class="p-6 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                        Tidak ada sesi tersedia. Semua sesi mungkin sudah ditambahkan sebagai ronde.
                    </div>

                    <div v-else class="max-h-80 overflow-y-auto flex flex-col gap-1.5 p-1">
                        <button
                            v-for="opt in availableRoundsToAdd"
                            :key="opt.key"
                            type="button"
                            @click="toggleRoundSelection(opt.key)"
                            class="w-full text-left p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-2.5"
                            :class="isRoundSelected(opt.key)
                                ? 'bg-red-50 dark:bg-red-950/40 border-red-500 dark:border-red-700'
                                : 'bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-900'"
                        >
                            <Icon
                                :name="isRoundSelected(opt.key) ? 'material-symbols:check-box' : 'material-symbols:check-box-outline-blank'"
                                class="text-lg shrink-0"
                                :class="isRoundSelected(opt.key) ? 'text-red-700 dark:text-red-400' : 'text-gray-400'"
                            />
                            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span v-if="opt.schedule.events?.organizers?.abbreviation" class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
                                        {{ opt.schedule.events.organizers.abbreviation }}
                                    </span>
                                    <span class="text-xs sm:text-sm font-semibold text-black dark:text-white truncate">
                                        {{ opt.schedule.events?.name || 'Event' }}
                                    </span>
                                    <span v-if="opt.schedule.season" class="text-[10px] text-gray-500 dark:text-gray-400">
                                        (S{{ opt.schedule.season }})
                                    </span>
                                </div>
                                <div class="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                                    <span>R{{ opt.schedule.round || '?' }} — {{ opt.schedule.circuit || 'TBA' }}</span>
                                    <span>•</span>
                                    <span>{{ formatDateOnly(opt.schedule.date) }}</span>
                                </div>
                            </div>
                            <span
                                class="px-2 py-1 rounded-md text-[11px] font-bold shrink-0"
                                :class="opt.session_type === 'qualifying'
                                    ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'"
                            >
                                {{ opt.sessionLabel }}
                            </span>
                        </button>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4">
                        <button
                            type="button"
                            @click="closeAddRoundsModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            @click="confirmAddRounds"
                            :disabled="savingRounds || addRoundsSelection.length === 0"
                            class="px-5 py-2 bg-red-900 hover:bg-red-950 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                        >
                            <Icon v-if="savingRounds" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ savingRounds ? 'Menambahkan...' : `Tambah ${addRoundsSelection.length} Ronde` }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>