<script setup>
    useHead({
        title: "Indonesia Sim Racing",
        meta: [
            {
                name: "description",
                content: "Indonesia Sim Racing 2025"
            }
        ]
    })
    useSeoMeta({
        title: "Indonesia Sim Racing",
        description: "Indonesia Sim Racing 2025"
    })

    const { $supabase } = useNuxtApp()
    const { data: schedule, error } = await useAsyncData("schedule", async () => {
        const { data, error } = await $supabase
            .from("schedule")
            .select("*")
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

    const selectedEvent = ref("Semua")

    const eventList = computed(() => {
        let events = []
        events = schedule.value.map(item => item.event)
        return ["Semua", ...new Set(events)]
    })

    const filteredSchedule = computed(() => {
        if(selectedEvent.value === "Semua"){
            return schedule.value
        }
        return schedule.value.filter(item => item.event === selectedEvent.value)
    })

    const nextThreeRaces = computed(() => {
        const todayDate = new Date()
        todayDate.setHours(0, 0, 0, 0)
        return schedule.value.filter(item => new Date(item.date) >= todayDate).slice(0, 3)
    })

</script>

<template>
    <div>
        <div class="bg-black px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-white text-center text-lg lg:text-2xl font-bold leading-6">
                Balapan Mendatang
            </div>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                <div v-for="event in nextThreeRaces" :key="event.id">
                    <CardSchedule
                        :date="event.date"
                        :organizer="event.organizer"
                        :event="event.event"
                        :group="event.group"
                        :round="event.round"
                        :circuit="event.circuit"
                    />
                </div>
            </div>
        </div>
        <div class="px-8 lg:px-32 py-8 flex flex-col gap-6 lg:gap-8">
            <div class="text-black text-center text-lg lg:text-2xl font-bold leading-6">
                Kalender Lengkap Indonesia Sim Racing 2025
            </div>
            <div v-if="schedule" class="mx-auto">
                <div class="flex gap-2 items-center text-sm lg:text-base">
                    <label for="event" name="event">Event:</label>
                    <select id="event" name="event" class="border-2 border-gray-300 rounded-md p-2" v-model="selectedEvent">
                        <option v-for="event in eventList" :key="event" :value="event">
                            {{ event }}
                        </option>
                    </select>
                </div>
            </div>
            <div v-if="schedule" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                <div v-for="event in filteredSchedule" :id="event.id">
                    <CardSchedule
                        :organizer="event.organizer"
                        :event="event.event" 
                        :round="event.round"
                        :group="event.group"
                        :date="event.date"
                        :circuit="event.circuit"
                    />
                </div>
            </div>
            <button v-if="showTopButton" @click="scrollToTop" class="fixed bottom-12 right-8 bg-red-500 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
                <Icon name="mi:arrow-up" size="2.5em"  mode="svg" />
            </button>
        </div>
    </div>
</template>