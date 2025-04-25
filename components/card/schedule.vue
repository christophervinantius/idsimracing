<script setup>
    defineProps(["organizer", "event", "round", "race", "group", "date", "circuit"])

    const getCardStyle = (organizer) => {
        let style = "rounded-tr-3xl border-r-4 border-t-4 p-6 bg-white shadow-lg "
        if(organizer === "ACI"){
            style += "border-red-500 shadow-red-500/20"
        }else if(organizer === "97S"){
            style += "border-black shadow-black/20"
        }else if(organizer === "CRC"){
            style += "border-yellow-500 shadow-yellow-500/20"
        }
        return style
    }

    const getTextStyle = (organizer) => {
        let style = " "
        if(organizer === "ACI"){
            style += "text-red-500"
        }else if(organizer === "97S"){
            style += "text-black"
        }else if(organizer === "CRC"){
            style += "text-yellow-500"
        }
        return style
    }

    const formatDate = (date) => {
        let newDate = new Date(date)
        let options = {
            month: "long",
            day: "numeric",
            weekday: "long"
        }
        newDate = newDate.toLocaleDateString("id-ID", options)
        return newDate
    }

    const getStatus = (date) => {
        let eventDate = new Date(date)
        let todayDate = new Date()
        eventDate.setHours(0, 0, 0, 0)
        todayDate.setHours(0, 0, 0, 0)
        const remainingDays = Math.ceil((eventDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24))
        if(remainingDays < 0){
            return "Selesai"
        }else if(remainingDays === 0){
            return "Hari ini!"
        }else if(remainingDays === 1){
            return "Besok"
        }else{
            return `${remainingDays} hari lagi`
        }
    }

</script>

<template>
    <div :class="getCardStyle(organizer)">
        <div class="text-xl">
            {{ formatDate(date) }}
        </div>
        <div :class="getTextStyle(organizer)">
            <span class="font-bold text-xl">{{ organizer }} {{ event }} <span v-if="group != null">- {{ group }}</span></span>
        </div>
        <div>
            Round {{ round }}: {{ circuit }}
        </div>
        <div class="w-fit px-2 py-1 mt-2 bg-black text-white font-bold rounded-md">
            {{ getStatus(date) }}
        </div>
    </div>
</template>