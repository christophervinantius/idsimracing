<script setup>
    useHead({
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
        description: "Jadwal Lengkap Indonesia Sim Racing 2025 - Assetto Corsa Indonesia, Croco Racing Community, 97th Sim Racing Community"
    })

    const { $supabase } = useNuxtApp()
    const { data: schedule, error } = await useAsyncData("schedule", async () => {
        const { data, error } = await $supabase
            .from("schedule")
            .select(`
                id,
                round,
                date,
                circuit,
                events (
                    name,
                    organizers (
                        abbreviation
                    )
                )
            `)
            .order("date", { ascending: true })
        if(error){
            throw error
        }
        return data
    })

    const showTopButton = ref(false)

    const handleScrollTop = () => {
        showTopButton.value = window.scrollY > 100
    }

    onMounted(() => {
        console.log(schedule.value)
        window.addEventListener("scroll", handleScrollTop)
    })

    onUnmounted(() => {
        window.removeEventListener("scroll", handleScrollTop)
    })

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        })
    }

    const selectedEvent = ref("Semua")
    const selectedStatus = ref("Semua")

    const eventList = computed(() => {
        let events = []
        events = schedule.value.map(item => item.events.name)
        events.sort()
        return ["Semua", ...new Set(events)]
    })

    const filteredSchedule = computed(() => {
        if(selectedStatus.value === "Semua"){
            return schedule.value.filter(item => selectedEvent.value === "Semua" ? true : item.events.name === selectedEvent.value)
        }else if(selectedStatus.value === "Selesai"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.date)
                const todayDate = new Date()
                eventDate.setHours(0, 0, 0, 0)
                todayDate.setHours(0, 0, 0, 0)
                return eventDate < todayDate && (selectedEvent.value === "Semua" ? true : item.events.name === selectedEvent.value)
            })
        }else if(selectedStatus.value === "Mendatang"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.date)
                const todayDate = new Date()
                eventDate.setHours(0, 0, 0, 0)
                todayDate.setHours(0, 0, 0, 0)
                return eventDate >= todayDate && (selectedEvent.value === "Semua" ? true : item.events.name === selectedEvent.value)
            })
        }
        return schedule.value.filter(item => item.events.name === selectedEvent.value)
    })

    const nextThreeRaces = computed(() => {
        const todayDate = new Date()
        todayDate.setHours(0, 0, 0, 0)
        return schedule.value.filter(item => new Date(item.date) >= todayDate).slice(0, 3)
    })

    const resetFilter = () => {
        selectedEvent.value = "Semua"
        selectedStatus.value = "Semua"
    }

</script>

<template>
    <div>
        <div class="bg-black px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-white text-center text-lg lg:text-2xl font-bold leading-6">
                Jadwal Balapan Terdekat
            </div>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                <div v-for="event in nextThreeRaces" :key="event.id">
                    <CardSchedule
                        :date="event.date"
                        :organizer="event.events.organizers.abbreviation"
                        :event="event.events.name"
                        :round="event.round"
                        :circuit="event.circuit"
                    />
                </div>
            </div>
        </div>
        <div class="px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-black text-center text-lg lg:text-2xl font-bold leading-6">
                Jadwal Lengkap Indonesia Sim Racing 2025
            </div>
            <div v-if="schedule" class="mx-auto">
                <div class="flex flex-col lg:flex-row justify-center items-center gap-2 lg:gap-4">
                    <div class="flex flex-col lg:flex-row gap-2 items-center text-sm lg:text-base">
                        <label for="event" name="event">Event:</label>
                        <select id="event" name="event" class="border-2 border-gray-300 rounded-md p-2" v-model="selectedEvent">
                            <option v-for="event in eventList" :key="event" :value="event">
                                {{ event }}
                            </option>
                        </select>
                    </div>
                    <div class="flex flex-col lg:flex-row gap-2 items-center text-sm lg:text-base">
                        <label for="status" name="status">Status:</label>
                        <select id="status" name="status" class="border-2 border-gray-300 rounded-md p-2" v-model="selectedStatus">
                            <option value="Semua">Semua</option>
                            <option value="Selesai">Selesai</option>
                            <option value="Mendatang">Mendatang</option>
                        </select>
                    </div>
                    <button v-if="selectedEvent !== 'Semua' || selectedStatus !== 'Semua'" @click="resetFilter" class="text-white bg-red-500 px-4 py-2 text-sm lg:text-base font-bold rounded-md cursor-pointer">Hapus Filter</button>
                </div>
            </div>
            <div v-if="schedule && filteredSchedule.length > 0" class="text-center text-base lg:text-lg">
                <label for="status" name="status">Total: {{ filteredSchedule.length }} balapan</label>
            </div>
            <div v-if="schedule && filteredSchedule.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                <div v-for="event in filteredSchedule" :id="event.id">
                    <CardSchedule
                        :event="event.events.name"
                        :organizer="event.events.organizers.abbreviation"
                        :round="event.round"
                        :date="event.date"
                        :circuit="event.circuit"
                    />
                </div>
            </div>
            <div v-if="filteredSchedule.length === 0" class="text-center text-base lg:text-lg leading-6">
                Tidak ada jadwal balapan yang ditemukan dengan filter ini.
            </div>
            <button v-if="showTopButton" @click="scrollToTop" class="fixed bottom-12 right-8 bg-red-500 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
                <Icon name="mi:arrow-up" size="2.5em"  mode="svg" />
            </button>
        </div>
    </div>
</template>