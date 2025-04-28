<script setup>
    defineProps(["organizer", "event", "round", "race", "group", "date", "circuit"])

    const getCardStyle = (event) => {
        let style = "rounded-tr-3xl border-r-4 border-t-4 p-2 lg:p-6 bg-white shadow-lg "
        if(event === "MX-5 Cup Asia"){
            style += "border-red-500 shadow-red-500/20"
        }else if(event === "1 Hour Series"){
            style += "border-blue-800 shadow-blue-800/20"
        }else if(event === "Open Wheel Series"){
            style += "border-purple-800 shadow-purple-800/20"
        }else if(event === "Sprint Series"){
            style += "border-yellow-500 shadow-yellow-500/20"
        }else if(event === "Endurance Championship"){
            style += "border-red-800 shadow-red-800/20"
        }else if(event === "V8 Masters League"){
            style += "border-blue-500 shadow-blue-500/20"
        }else if(event === "BEGO Balap Cup"){
            style += "border-orange-500 shadow-orange-500/20"
        }else if(event === "Sprint Rally Challenge"){
            style += "border-purple-500 shadow-purple-500/20"
        }
        return style
    }

    const getTextStyle = (event) => {
        let style = " "
        if(event === "MX-5 Cup Asia"){
            style += "text-red-500"
        }else if(event === "1 Hour Series"){
            style += "text-blue-800"
        }else if(event === "Open Wheel Series"){
            style += "text-purple-800"
        }else if(event === "Sprint Series"){
            style += "text-yellow-500"
        }else if(event === "Endurance Championship"){
            style += "text-red-800"
        }else if(event === "V8 Masters League"){
            style += "text-blue-500"
        }else if(event === "BEGO Balap Cup"){
            style += "text-orange-500"
        }else if(event === "Sprint Rally Challenge"){
            style += "text-purple-500"
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

    const getStatusStyle = (status) => {
        let style = "w-fit px-2 py-1 mt-2 font-bold rounded-md text-sm lg:text-base text-white "
        if(status === "Selesai"){
            style += "bg-red-900"
        }else{
            style += "bg-red-500"
        }
        return style
    }

</script>

<template>
    <div :class="getCardStyle(event)">
        <div class="text-base lg:text-xl">
            {{ formatDate(date) }}
        </div>
        <div :class="getTextStyle(event)">
            <span class="font-bold text-base lg:text-xl">{{ organizer }} {{ event }} <span v-if="group != null">- {{ group }}</span></span>
        </div>
        <div class="text-sm lg:text-base">
            Round {{ round }}: {{ circuit }}
        </div>
        <div :class="getStatusStyle(getStatus(date))">
            {{ getStatus(date) }}
        </div>
    </div>
</template>