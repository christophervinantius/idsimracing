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
                stream_link,
                country,
                country_2,
                events (
                    name,
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

    const showTopButton = ref(false)

    const handleScrollTop = () => {
        showTopButton.value = window.scrollY > 100
    }

    onMounted(() => {
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

    const selectedEvents = ref([])
    const totalEvents = ref(0)
    const selectedStatus = ref("Semua")

    const date = new Date()
    const year = date.getFullYear()

    const eventList = computed(() => {
        const events = [...new Set(
            schedule.value.map(item => item.events.name).sort()
        )]
        selectedEvents.value = [...new Set(events)]
        totalEvents.value = events.length
        return [...new Set(events)]
    })

    const filteredSchedule = computed(() => {
        if(selectedStatus.value === "Semua"){
            return schedule.value.filter(item => selectedEvents.value.includes(item.events.name))
        }else if(selectedStatus.value === "Selesai"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.date)
                const todayDate = new Date()
                eventDate.setHours(0, 0, 0, 0)
                todayDate.setHours(0, 0, 0, 0)
                return eventDate < todayDate && (selectedEvents.value.includes(item.events.name))
            })
        }else if(selectedStatus.value === "Mendatang"){
            return schedule.value.filter(item => {
                const eventDate = new Date(item.date)
                const todayDate = new Date()
                eventDate.setHours(0, 0, 0, 0)
                todayDate.setHours(0, 0, 0, 0)
                return eventDate >= todayDate && (selectedEvents.value.includes(item.events.name))
            })
        }
        return schedule.value.filter(item => selectedEvents.value.includes(item.events.name))
    })

    const nextThreeRaces = computed(() => {
        const todayDate = new Date()
        todayDate.setHours(0, 0, 0, 0)
        return schedule.value.filter(item => {
            const eventDate = new Date(item.date)
            const todayDate = new Date()
            eventDate.setHours(0, 0, 0, 0)
            todayDate.setHours(0, 0, 0, 0)
            return eventDate >= todayDate && (selectedEvents.value.includes(item.events.name))  
        }).slice(0, 3)
    })

    const resetFilter = () => {
        selectedEvents.value = [...eventList.value]
        selectedStatus.value = "Semua"
    }

</script>

<template>
    <div>
        <div class="px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-center text-lg lg:text-2xl font-bold leading-6">
                {{ $t('calendarTitle', {year: year}) }}
            </div>
            <div v-if="schedule" class="mx-auto">
                <div class="flex flex-col justify-center items-center gap-6 lg:gap-8">
                    <div class="bg-red-50 p-4 lg:p-8 rounded-xl lg:rounded-3xl border-2 border-red-500 grid grid-cols-2 lg:grid-cols-5 gap-2">
                        <label v-for="event in eventList" :key="event" class="flex items-center gap-2 text-sm lg:text-base">
                            <input
                                type="checkbox"
                                :value="event"
                                v-model="selectedEvents"
                                class="accent-red-500"
                            />
                            {{ event }}
                        </label>
                    </div>
                    <div class="flex flex-col lg:flex-row gap-2 items-center text-sm lg:text-base">
                        <label for="status" name="status">Status:</label>
                        <select id="status" name="status" class="border-2 border-gray-300 rounded-md p-2" v-model="selectedStatus">
                            <option value="Semua">{{ $t('all') }}</option>
                            <option value="Selesai">{{ $t('finished') }}</option>
                            <option value="Mendatang">{{ $t('upcoming') }}</option>
                        </select>
                    </div>
                    <div
                        v-if="selectedEvents.length < totalEvents || selectedStatus !== 'Semua'"
                        class="text-white bg-red-500 text-sm lg:text-base font-bold px-4 py-2 rounded-lg cursor-pointer" @click="resetFilter">
                        {{ $t('resetFilter') }}
                    </div>
                </div>
            </div>
            <div v-if="schedule && filteredSchedule.length > 0" class="text-center text-base lg:text-lg">
                <label for="status" name="status">{{ $t('totalRaces', {total: filteredSchedule.length}) }}</label>
            </div>
        </div>
        <div class="bg-black px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-white text-center text-lg lg:text-2xl font-bold leading-6">
                {{ $t('nearestRaces') }}
            </div>
            <div v-if="schedule && filteredSchedule.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                <div v-for="event in nextThreeRaces" :key="event.id">
                    <CardSchedule
                        :date="event.date"
                        :organizer="event.events.organizers.abbreviation"
                        :event="event.events.name"
                        :round="event.round"
                        :circuit="event.circuit"
                        :link="event.stream_link"
                        :country="event.country"
                        :country_2="event.country_2"
                        :discord="event.events.organizers.discord"
                    />
                </div>
            </div>
            <div v-if="filteredSchedule.length === 0" class="text-center text-white text-base lg:text-lg leading-6">
                {{ $t('noRacesFound') }}
            </div>
        </div>
        <div class="px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-black text-center text-lg lg:text-2xl font-bold leading-6">
                {{ $t('fullCalendar') }}
            </div>
            <div v-if="schedule && filteredSchedule.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                <div v-for="event in filteredSchedule" :id="event.id">
                    <CardSchedule
                        :event="event.events.name"
                        :organizer="event.events.organizers.abbreviation"
                        :round="event.round"
                        :date="event.date"
                        :circuit="event.circuit"
                        :link="event.stream_link"
                        :country="event.country"
                        :country_2="event.country_2"
                        :discord="event.events.organizers.discord"
                    />
                </div>
            </div>
            <div v-if="filteredSchedule.length === 0" class="text-center text-base lg:text-lg leading-6">
                {{ $t('noRacesFound') }}
            </div>
            <button v-if="showTopButton" @click="scrollToTop" class="fixed bottom-12 right-8 bg-red-500 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
                <Icon name="mi:arrow-up" size="2.5em"  mode="svg" />
            </button>
        </div>
    </div>
</template>