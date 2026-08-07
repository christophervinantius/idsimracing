<script setup>
    useHead({
        htmlAttrs: {
            lang: "id"
        },
        title: "Admin | ID Sim Racing",
        meta: [
            {
                name: "description",
                content: "Halaman Admin Update Jadwal Balapan ID Sim Racing"
            }
        ]
    })

    useSeoMeta({
        title: "Admin | ID Sim Racing",
        description: "Halaman Admin Update Jadwal Balapan ID Sim Racing"
    })

    const { $supabase } = useNuxtApp()
    const config = useRuntimeConfig()

    // State variables
    const schedules = ref([])
    const eventsList = ref([])
    const loading = ref(false)
    const saving = ref(false)
    const errorMsg = ref("")
    const toastMessage = ref("")
    const toastType = ref("success") // 'success' | 'error'

    // Filter states
    const searchQuery = ref("")
    const timeFilter = ref("week") // 'week' | 'next14' | 'upcoming' | 'all'

    // Admin Login / Access Gate state
    const isAuthenticated = ref(false)
    const loginPasswordInput = ref("")
    const loginPasswordError = ref("")
    const showLoginPassword = ref(false)

    // Password and Modal state
    const ADM_PASS = config.public?.passAdm
    const CRUD_PASS = config.public?.passCrud
    const adminPasswordInput = ref("")
    const adminPasswordError = ref("")
    const showAdminPassword = ref(false)

    const isModalOpen = ref(false)
    const modalMode = ref("edit") // 'edit' | 'create'
    const editingScheduleId = ref(null)

    // Delete modal state
    const isDeleteModalOpen = ref(false)
    const deletingScheduleItem = ref(null)
    const deletePasswordInput = ref("")
    const deletePasswordError = ref("")
    const showDeletePassword = ref(false)
    const deleting = ref(false)

    const handleLogin = () => {
        loginPasswordError.value = ""
        if (loginPasswordInput.value === ADM_PASS) {
            isAuthenticated.value = true
            sessionStorage.setItem("admin_authenticated", "true")
            fetchSchedules()
            fetchEventsList()
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

    const formData = reactive({
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

    const showToast = (message, type = "success") => {
        toastMessage.value = message
        toastType.value = type
        setTimeout(() => {
            toastMessage.value = ""
        }, 4000)
    }

    // Date range helper for 1 week from now (includes today's date from 00:00:00)
    const getWeekRange = () => {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0) // Start of today (00:00:00)
        const end = new Date(start)
        end.setDate(end.getDate() + 7)
        end.setHours(23, 59, 59, 999) // 7 days from today (23:59:59)
        return { start, end }
    }

    // Fetch schedules from Supabase
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
            } else if (timeFilter.value === "next14") {
                const start = new Date()
                start.setHours(0, 0, 0, 0)
                const end = new Date(start)
                end.setDate(end.getDate() + 14)
                end.setHours(23, 59, 59, 999)
                const startIso = start.toISOString()
                const endIso = end.toISOString()
                query = query.or(`and(date.gte.${startIso},date.lte.${endIso}),is_postponed.eq.true,stream_link.is.null,stream_link.eq.`)
            } else if (timeFilter.value === "upcoming") {
                const startIso = new Date().toISOString()
                query = query.or(`finish_date.gte.${startIso},is_postponed.eq.true,stream_link.is.null,stream_link.eq.`)
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

    // Fetch list of events for the modal dropdown
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

    // Initial load - check session authentication
    onMounted(() => {
        if (sessionStorage.getItem("admin_authenticated") === "true") {
            isAuthenticated.value = true
            fetchSchedules()
            fetchEventsList()
        }
    })

    // Re-fetch when time filter changes
    watch(timeFilter, () => {
        fetchSchedules()
    })

    // Filter schedules based on search query
    const filteredSchedules = computed(() => {
        if (!searchQuery.value.trim()) return schedules.value
        const q = searchQuery.value.toLowerCase()
        return schedules.value.filter(item => {
            const eventName = item.events?.name?.toLowerCase() || ""
            const circuit = item.circuit?.toLowerCase() || ""
            const roundStr = String(item.round || "").toLowerCase()
            return eventName.includes(q) || circuit.includes(q) || roundStr.includes(q)
        })
    })

    // Helper functions for date formatting
    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return "-"
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return dateStr
        const formatted = d.toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            weekday: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
        return formatted.replace(/\s*pukul\s*/i, " - ")
    }

    const getScheduleStatus = (item) => {
        if (item.is_postponed) return "Ditunda"
        const endDate = new Date(item.finish_date || item.date)
        if (endDate < new Date()) return "Selesai"
        return "Aktif"
    }

    const getStatusBadgeClass = (status) => {
        if (status === "Ditunda") {
            return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
        } else if (status === "Selesai") {
            return "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300 border border-gray-300 dark:border-slate-700"
        }
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
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

    // Open Modal for Create or Edit
    const openCreateModal = () => {
        modalMode.value = "create"
        editingScheduleId.value = null
        formData.event_id = eventsList.value.length ? eventsList.value[0].id : ""
        formData.round = ""
        formData.season = ""
        formData.date = formatDateForInput(new Date())
        formData.finish_date = formatDateForInput(new Date(Date.now() + 2 * 3600 * 1000))
        formData.circuit = ""
        formData.country = ""
        formData.country_2 = ""
        formData.stream_link = ""
        formData.is_postponed = false
        adminPasswordInput.value = ""
        adminPasswordError.value = ""
        showAdminPassword.value = false
        isModalOpen.value = true
    }

    const openEditModal = (scheduleItem) => {
        modalMode.value = "edit"
        editingScheduleId.value = scheduleItem.id
        formData.event_id = scheduleItem.event_id || ""
        formData.round = scheduleItem.round || ""
        formData.season = scheduleItem.season || ""
        formData.date = formatDateForInput(scheduleItem.date)
        formData.finish_date = formatDateForInput(scheduleItem.finish_date)
        formData.circuit = scheduleItem.circuit || ""
        formData.country = scheduleItem.country || ""
        formData.country_2 = scheduleItem.country_2 || ""
        formData.stream_link = scheduleItem.stream_link || ""
        formData.is_postponed = Boolean(scheduleItem.is_postponed)
        adminPasswordInput.value = ""
        adminPasswordError.value = ""
        showAdminPassword.value = false
        isModalOpen.value = true
    }

    const closeModal = () => {
        isModalOpen.value = false
        adminPasswordInput.value = ""
        adminPasswordError.value = ""
        showAdminPassword.value = false
    }

    // Save schedule changes (Insert / Update)
    const saveSchedule = async () => {
        adminPasswordError.value = ""
        if (!formData.event_id) {
            showToast("Pilih event terlebih dahulu", "error")
            return
        }
        if (!formData.date) {
            showToast("Pilih tanggal balapan", "error")
            return
        }
        if (adminPasswordInput.value !== CRUD_PASS) {
            adminPasswordError.value = "Password admin salah!"
            return
        }

        saving.value = true
        try {
            const payload = {
                event_id: formData.event_id,
                round: formData.round,
                season: formData.season ? Number(formData.season) || formData.season : null,
                date: new Date(formData.date).toISOString(),
                finish_date: formData.finish_date ? new Date(formData.finish_date).toISOString() : new Date(formData.date).toISOString(),
                circuit: formData.circuit,
                country: formData.country,
                country_2: formData.country_2 || null,
                stream_link: formData.stream_link || null,
                is_postponed: formData.is_postponed
            }

            if (modalMode.value === "edit") {
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

            closeModal()
            await fetchSchedules()
        } catch (err) {
            console.error("Error saving schedule:", err)
            showToast(err.message || "Gagal menyimpan jadwal balapan", "error")
        } finally {
            saving.value = false
        }
    }

    // Delete schedule modal handlers
    const openDeleteModal = (scheduleItem) => {
        deletingScheduleItem.value = scheduleItem
        deletePasswordInput.value = ""
        deletePasswordError.value = ""
        showDeletePassword.value = false
        isDeleteModalOpen.value = true
    }

    const closeDeleteModal = () => {
        isDeleteModalOpen.value = false
        deletingScheduleItem.value = null
        deletePasswordInput.value = ""
        deletePasswordError.value = ""
        showDeletePassword.value = false
    }

    const confirmDelete = async () => {
        if (!deletingScheduleItem.value) return
        deletePasswordError.value = ""
        if (deletePasswordInput.value !== CRUD_PASS) {
            deletePasswordError.value = "Password admin salah!"
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
            closeDeleteModal()
            await fetchSchedules()
        } catch (err) {
            console.error("Error deleting schedule:", err)
            showToast(err.message || "Gagal menghapus jadwal balapan", "error")
        } finally {
            deleting.value = false
        }
    }
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
                                :class="loginPasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-700 dark:border-red-900'"
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
                        class="w-full py-3 bg-red-700 hover:bg-red-800 dark:bg-red-900 dark:hover:bg-red-800 text-white rounded-lg font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2"
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
                        @click="fetchSchedules"
                        :disabled="loading"
                        class="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                        <span>Refresh</span>
                    </button>
                    <button
                        @click="openCreateModal"
                        class="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 dark:bg-red-900 dark:hover:bg-red-800 text-white rounded-lg font-bold transition cursor-pointer shadow-md"
                    >
                        <span>Tambah Jadwal</span>
                    </button>
                    <button
                        @click="handleLogout"
                        class="flex items-center gap-2 px-3.5 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer"
                        title="Keluar dari Admin"
                    >
                        <span>Keluar</span>
                    </button>
                </div>
            </div>

        <!-- Filter & Search Controls Bar -->
        <div class="bg-red-50 dark:bg-slate-950 p-4 rounded-xl border border-red-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div class="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                        @click="timeFilter = 'week'"
                        class="px-3 py-1.5 text-xs lg:text-sm font-bold rounded-lg transition cursor-pointer border"
                        :class="timeFilter === 'week' 
                            ? 'bg-red-700 dark:bg-red-900 text-white border-red-700 dark:border-red-900 shadow-sm' 
                            : 'bg-white dark:bg-slate-900 text-black dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800'"
                    >
                        Dalam 1 Minggu
                    </button>
                    <button
                        @click="timeFilter = 'upcoming'"
                        class="px-3 py-1.5 text-xs lg:text-sm font-bold rounded-lg transition cursor-pointer border"
                        :class="timeFilter === 'upcoming' 
                            ? 'bg-red-700 dark:bg-red-900 text-white border-red-700 dark:border-red-900 shadow-sm' 
                            : 'bg-white dark:bg-slate-900 text-black dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800'"
                    >
                        Semua Mendatang
                    </button>
                </div>
            </div>

            <div class="relative w-full md:w-72">
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Cari event"
                    class="w-full pl-4 pr-4 py-1.5 text-sm rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
            </div>
        </div>

        <!-- Schedule Data Counter -->
        <div class="flex items-center justify-between text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium px-1">
            <span>
                Total: {{ filteredSchedules.length }} balapan
            </span>
        </div>

        <!-- Schedule Table -->
        <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <table class="w-full min-w-[1050px] table-fixed text-left border-collapse">
                <thead class="bg-red-700 dark:bg-red-900 text-white">
                    <tr>
                        <th class="px-3 sm:px-4 py-3 w-[22%]">Event</th>
                        <th class="px-1.5 sm:px-2 py-3 w-[6%]">Round</th>
                        <th class="px-3 sm:px-4 py-3 w-[24%]">Jadwal</th>
                        <th class="px-3 sm:px-4 py-3 w-[24%]">Sirkuit</th>
                        <th class="px-2 sm:px-3 py-3 text-center w-[8%]">Stream</th>
                        <th class="px-2 sm:px-3 py-3 text-center w-[8%]">Status</th>
                        <th class="px-2 sm:px-3 py-3 text-center w-[8%]">Aksi</th>
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
                        v-for="item in filteredSchedules"
                        :key="item.id"
                        class="hover:bg-red-50/50 dark:hover:bg-slate-900/50 transition-colors text-black dark:text-white"
                    >
                        <td class="px-3 sm:px-4 py-3">
                            <div class="text-gray-900 dark:text-white">
                                {{ item.events.organizers.abbreviation }} {{ item.events?.name || 'Event N/A' }}{{ item.season ? ' (S' + item.season + ')' : '' }}
                            </div>
                        </td>

                        <td class="px-1.5 sm:px-2 py-3 whitespace-nowrap">
                            {{ item.round || '-' }}
                        </td>

                        <td class="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <div class="text-gray-900 dark:text-gray-100">
                                {{ formatDateDisplay(item.date) }}
                            </div>
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
                                <span>{{ item.circuit || '-' }}</span>
                            </div>
                        </td>

                        <!-- Stream Link -->
                        <td class="px-2 sm:px-3 py-3 text-center whitespace-nowrap">
                            <a
                                v-if="item.stream_link"
                                :href="item.stream_link"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="px-2.5 py-1 rounded-full text-xs font-bold transition bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900 border border-red-300 dark:border-red-800 inline-flex items-center justify-center gap-1"
                            >
                                Stream
                            </a>
                            <span v-else class="text-xs text-gray-400 dark:text-gray-600">-</span>
                        </td>

                        <!-- Status Badge -->
                        <td class="px-2 sm:px-3 py-3 text-center whitespace-nowrap">
                            <span
                                class="px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 select-none"
                                :class="getStatusBadgeClass(getScheduleStatus(item))"
                            >
                                {{ getScheduleStatus(item) }}
                            </span>
                        </td>

                        <!-- Actions -->
                        <td class="px-2 sm:px-3 py-3 text-center whitespace-nowrap">
                            <div class="flex items-center justify-center gap-2">
                                <button
                                    @click="openEditModal(item)"
                                    class="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg transition cursor-pointer"
                                    title="Edit Jadwal"
                                >
                                    <Icon name="material-symbols:edit" class="text-lg" />
                                </button>
                                <button
                                    @click="openDeleteModal(item)"
                                    class="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 text-red-600 dark:text-red-400 rounded-lg transition cursor-pointer"
                                    title="Hapus Jadwal"
                                >
                                    <Icon name="material-symbols:delete" class="text-lg" />
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Edit / Create Modal -->
        <div
            v-if="isModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <!-- Modal Header -->
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <span>{{ modalMode === 'edit' ? 'Edit Jadwal Balapan' : 'Tambah Jadwal Balapan Baru' }}</span>
                    </h2>
                    <button @click="closeModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <!-- Modal Form -->
                <form @submit.prevent="saveSchedule" class="flex flex-col gap-4">
                    <!-- Row 1: Event (100%) -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Event <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <select
                                v-model="formData.event_id"
                                required
                                class="p-2.5 pr-10 appearance-none rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full cursor-pointer"
                            >
                                <option value="" disabled>-- Pilih Event --</option>
                                <option v-for="ev in eventsList" :key="ev.id" :value="ev.id">
                                    {{ ev.organizers?.abbreviation ? ev.organizers.abbreviation + ' ' : '' }}{{ ev.name }}
                                </option>
                            </select>
                            <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 text-xl text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <!-- Row 2: Season (50%) Round (50%) -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Season</label>
                            <input
                                v-model="formData.season"
                                type="text"
                                placeholder="Contoh: 2"
                                class="p-2.5 rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Round <span class="text-red-600">*</span></label>
                            <input
                                v-model="formData.round"
                                type="text"
                                placeholder="Contoh: 3"
                                class="p-2.5 rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                            />
                        </div>
                    </div>

                    <!-- Row 3: Jadwal Mulai (50%) Jadwal Selesai (50%) -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Jadwal Mulai <span class="text-red-600">*</span></label>
                            <input
                                v-model="formData.date"
                                type="datetime-local"
                                required
                                class="p-2 sm:p-2.5 rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Jadwal Selesai</label>
                            <input
                                v-model="formData.finish_date"
                                type="datetime-local"
                                required
                                class="p-2 sm:p-2.5 rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                            />
                        </div>
                    </div>

                    <!-- Row 4: Sirkuit (100%) -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Sirkuit (dan Sesi)</label>
                        <input
                            v-model="formData.circuit"
                            type="text"
                            placeholder="Contoh: Imola Circuit - Qualifying"
                            class="p-2.5 rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                        />
                    </div>

                    <!-- Row 5: Kode Negara 1 (50%) Kode Negara 2 (50%) -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Kode Negara 1</label>
                            <input
                                v-model="formData.country"
                                type="text"
                                placeholder="Contoh: us"
                                class="p-2.5 rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                            />
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Kode Negara 2</label>
                            <input
                                v-model="formData.country_2"
                                type="text"
                                placeholder="Contoh: jp"
                                class="p-2.5 rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                            />
                        </div>
                    </div>

                    <!-- Row 6: Stream Link (100%) -->
                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white text-sm font-medium">Stream Link (YouTube URL)</label>
                        <input
                            v-model="formData.stream_link"
                            type="url"
                            placeholder="https://youtube.com/live/..."
                            class="p-2.5 rounded-lg border-2 border-red-700 dark:border-red-900 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                        />
                    </div>

                    <!-- Row 7: Postponed (50%) Password Admin (50%) -->
                    <div class="grid grid-cols-2 gap-4 items-end">
                        <div class="flex items-center gap-2 sm:gap-3 py-2.5">
                            <input
                                id="postponed-checkbox"
                                v-model="formData.is_postponed"
                                type="checkbox"
                                class="w-4 h-4 sm:w-5 sm:h-5 accent-red-700 rounded cursor-pointer shrink-0"
                            />
                            <label for="postponed-checkbox" class="text-black dark:text-white text-xs sm:text-sm font-medium cursor-pointer select-none">
                                Ditunda (Postponed)
                            </label>
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-black dark:text-white text-sm font-medium">Password Admin <span class="text-red-600">*</span></label>
                            <div class="relative flex items-center">
                                <input
                                    v-model="adminPasswordInput"
                                    :type="showAdminPassword ? 'text' : 'password'"
                                    required
                                    placeholder="Password admin"
                                    @input="adminPasswordError = ''"
                                    class="p-2.5 pr-9 sm:pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-xs sm:text-sm focus:outline-none w-full"
                                    :class="adminPasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-700 dark:border-red-900'"
                                />
                                <button
                                    type="button"
                                    @click="showAdminPassword = !showAdminPassword"
                                    class="absolute right-2.5 sm:right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                    title="Tampilkan/Sembunyikan Password"
                                >
                                    <Icon :name="showAdminPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-lg sm:text-xl" />
                                </button>
                            </div>
                            <p v-if="adminPasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                                {{ adminPasswordError }}
                            </p>
                        </div>
                    </div>

                    <!-- Modal Actions -->
                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <button
                            type="button"
                            @click="closeModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="saving"
                            class="px-5 py-2 bg-red-700 hover:bg-red-800 dark:bg-red-900 dark:hover:bg-red-800 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <Icon v-if="saving" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ saving ? 'Menyimpan...' : 'Simpan' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div
            v-if="isDeleteModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
                <!-- Delete Modal Header -->
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4 mb-4">
                    <h2 class="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <Icon name="material-symbols:warning-rounded" class="text-red-600 text-2xl" />
                        <span>Konfirmasi Hapus</span>
                    </h2>
                    <button @click="closeDeleteModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                        <Icon name="material-symbols:close" class="text-2xl" />
                    </button>
                </div>

                <!-- Delete Modal Form -->
                <form @submit.prevent="confirmDelete" class="flex flex-col gap-4">
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Apakah Anda yakin ingin menghapus jadwal balapan
                        <strong class="text-black dark:text-white">
                            "{{ deletingScheduleItem?.events?.name || '' }} - Round {{ deletingScheduleItem?.round }}"
                        </strong>?
                    </p>

                    <div class="flex flex-col gap-1">
                        <label class="text-black dark:text-white">Password Admin <span class="text-red-600">*</span></label>
                        <div class="relative flex items-center">
                            <input
                                v-model="deletePasswordInput"
                                :type="showDeletePassword ? 'text' : 'password'"
                                required
                                placeholder="Masukkan password admin"
                                @input="deletePasswordError = ''"
                                class="p-2.5 pr-10 rounded-lg border-2 bg-white dark:bg-slate-950 text-black dark:text-white text-sm focus:outline-none w-full"
                                :class="deletePasswordError ? 'border-red-600 dark:border-red-500' : 'border-red-700 dark:border-red-900'"
                            />
                            <button
                                type="button"
                                @click="showDeletePassword = !showDeletePassword"
                                class="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer flex items-center"
                                title="Tampilkan/Sembunyikan Password"
                            >
                                <Icon :name="showDeletePassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" class="text-xl" />
                            </button>
                        </div>
                        <p v-if="deletePasswordError" class="text-xs text-red-600 dark:text-red-400 font-semibold">
                            {{ deletePasswordError }}
                        </p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800 pt-4 mt-2">
                        <button
                            type="button"
                            @click="closeDeleteModal"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-black dark:text-white rounded-lg font-bold transition cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            :disabled="deleting"
                            class="px-5 py-2 bg-red-700 hover:bg-red-800 dark:bg-red-900 dark:hover:bg-red-800 text-white rounded-lg font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <Icon v-if="deleting" name="material-symbols:refresh" class="animate-spin" />
                            <span>{{ deleting ? 'Menghapus...' : 'Hapus' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
        </div>
    </div>
</template>
