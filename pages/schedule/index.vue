<script setup>
    useHead({
        title: "Schedule",
        meta: [
            {
                name: "description",
                content: "Indonesia Sim Racing Schedule 2025"
            }
        ]
    })
    useSeoMeta({
        title: "Schedule",
        description: "Indonesia Sim Racing Schedule 2025"
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

    const selectedOrganizer = ref("Semua")
    const selectedEvent = ref("Semua")

    const eventList = computed(() => {
        let events = []
        if(selectedOrganizer.value === "Semua"){
            events = schedule.value.map(item => item.event)
        }else{
            events = schedule.value.filter(item => item.organizer === selectedOrganizer.value).map(item => item.event)
        }
        return ["Semua", ...new Set(events)]
    })

    const filteredSchedule = computed(() => {
        if(selectedOrganizer.value === "Semua"){
            if(selectedEvent.value === "Semua"){
                return schedule.value
            }
            return schedule.value.filter(item => item.event === selectedEvent.value)
        }else{
            if(selectedEvent.value === "Semua"){
                return schedule.value.filter(item => item.organizer === selectedOrganizer.value)
            }
            return schedule.value.filter(item => item.organizer === selectedOrganizer.value && item.event === selectedEvent.value)
        }
    })

    const resetFilter = (e) => {
        e.preventDefault()
        selectedOrganizer.value = "Semua"
        selectedEvent.value = "Semua"
    }

</script>

<template>
    <div class="flex flex-col gap-8 px-32 py-16">
        <div class="text-3xl font-bold text-center underline">
            Jadwal Indonesia Sim Racing 2025
        </div>
        <div v-if="schedule" class="mx-auto">
            <form class="flex gap-6 items-center justify-center">
                <div class="flex gap-2 items-center">
                    <label for="organizer" name="organizer">Organizer:</label>
                    <select id="organizer" name="organizer" class="border-2 border-gray-300 rounded-md p-2" v-model="selectedOrganizer">
                        <option value="Semua">Semua</option>
                        <option value="ACI">ACI</option>
                        <option value="97S">97S</option>
                        <option value="CRC">CRC</option>
                    </select>
                </div>
                <div class="flex gap-2 items-center">
                    <label for="event" name="event">Event:</label>
                    <select id="event" name="event" class="border-2 border-gray-300 rounded-md p-2" v-model="selectedEvent">
                        <option v-for="event in eventList" :key="event" :value="event">
                            {{ event }}
                        </option>
                    </select>
                </div>
                <button v-if="selectedOrganizer !== 'Semua' || selectedEvent !== 'Semua'" class="bg-red-500 px-4 py-2 text-white font-bold rounded-md cursor-pointer" @click="resetFilter">
                    Reset Filter
                </button>
            </form>
        </div>
        <div v-if="schedule" class="grid grid-cols-3 gap-8">
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
        <div v-if="filteredSchedule.length === 0" class="text-center text-xl">
            Tidak ada jadwal yang ditemukan untuk filter yang dipilih.
        </div>
    </div>
</template>