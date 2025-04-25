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

    const nextThreeRaces = computed(() => {
        const todayDate = new Date()
        todayDate.setHours(0, 0, 0, 0)
        return schedule.value.filter(item => new Date(item.date) >= todayDate).slice(0, 3)
    })

</script>

<template>
    <div>
        <div class="bg-black px-32 py-8 flex flex-col gap-8">
            <div class="text-white text-center text-2xl font-bold">
                Balapan Mendatang:
            </div>
            <div class="grid grid-cols-3 gap-8">
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
    </div>
</template>