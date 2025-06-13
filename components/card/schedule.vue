<script setup>
    defineProps(
        [
            "event",
            "round",
            "race",
            "date",
            "finish_date",
            "circuit",
            "link",
            "country",
            "country_2",
            "organizer",
            "game",
        ]
    )

    const emits = defineEmits(
        [
            "organizerClick",
            "gameClick"
        ]
    )

    const { locale, t } = useI18n()

    const getCardStyle = (event) => {
        let style = "rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 p-4 lg:p-6 bg-red-50 dark:bg-slate-950 text-black dark:text-white "
        if(event.startsWith("MX-5 Cup Asia")){
            style += "border-red-500"
        }else if(event.startsWith("1 Hour Series")){
            style += "border-emerald-500"
        }else if(event === "Open Wheel Series"){
            style += "border-cyan-500"
        }else if(event.startsWith("Sprint Series")){
            style += "border-yellow-500"
        }else if(event === "Endurance Championship"){
            style += "border-pink-500"
        }else if(event === "V8 Masters League"){
            style += "border-blue-500"
        }else if(event === "Juniors"){
            style += "border-lime-500"
        }else if(event === "B.E.G.O. Balap Cup"){
            style += "border-orange-500"
        }else if(event === "Sprint Rally Challenge"){
            style += "border-purple-500"
        }
        return style
    }

    const getOrganizerStyle = (organizer) => {
        let style = "px-2 py-1 font-bold rounded-md text-sm lg:text-base cursor-pointer "
        if(organizer === "ACI"){
            style += "bg-red-500 hover:bg-red-600 text-white"
        }else if(organizer === "97SRC"){
            style += "bg-white hover:bg-neutral-300 text-black"
        }else if(organizer === "CRC"){
            style += "bg-yellow-500 hover:bg-yellow-600 text-black"
        }
        return style
    }

    const getGameStyle = (game) => {
        let style = "px-2 py-1 font-bold rounded-md text-sm lg:text-base cursor-pointer "
        if(game === "AC"){
            style += "bg-red-500 hover:bg-red-600 text-white"
        }else if(game === "ACC"){
            style += "bg-white hover:bg-neutral-300 text-red-600"
        }else if(game === "RBR"){
            style += "bg-black hover:bg-neutral-600 text-white"
        }
        return style
    }

    const getTextStyle = (event) => {
        let style = " "
        if(event.startsWith("MX-5 Cup Asia")){
            style += "text-red-500"
        }else if(event.startsWith("1 Hour Series")){
            style += "text-emerald-500"
        }else if(event === "Open Wheel Series"){
            style += "text-cyan-500"
        }else if(event.startsWith("Sprint Series")){
            style += "text-yellow-500"
        }else if(event === "Endurance Championship"){
            style += "text-pink-500"
        }else if(event === "V8 Masters League"){
            style += "text-blue-500"
        }else if(event === "Juniors"){
            style += "text-lime-500"
        }else if(event === "B.E.G.O. Balap Cup"){
            style += "text-orange-500"
        }else if(event === "Sprint Rally Challenge"){
            style += "text-purple-500"
        }
        return style
    }

    const formatDate = (date) => {
        let newDate = new Date(date)

        let dateOptions = {
            month: "long",
            day: "numeric",
            weekday: "long"
        }
        
        newDate = newDate.toLocaleDateString(locale.value === "en" ? "en-US" : "id-ID", dateOptions)

        return newDate
    }

    const formatTime = (date) => {
        let newTime = new Date(date)

        let timeOptions = {
            hour: "2-digit",
            minute: "2-digit"
        }

        newTime = newTime.toLocaleTimeString(locale.value === "en" ? "en-US" : "id-ID", timeOptions)

        return newTime
    }

    const getStatus = (date, finish_date) => {
        let eventDate = new Date(date)
        let todayDate = new Date()
        let finishDate = new Date(finish_date)
        let remainingEventDays = Math.floor((eventDate - todayDate) / (1000 * 60 * 60 * 24))
        let remainingFinishDays = Math.floor((finishDate - todayDate) / (1000 * 60 * 60 * 24))
        if(remainingEventDays < 0 && remainingFinishDays < 0){
            return t("finished")
        }else if(remainingEventDays < 0 && remainingFinishDays >= 0){
            return t("started")
        }else if(remainingEventDays <= 1){
            let remainingHours = Math.ceil((eventDate - todayDate) / (1000 * 60 * 60))
            if(remainingHours > 24){
                remainingHours -= 24
                return t("oneDayAndHoursLeft", {count: remainingHours})
            }else{
                let remainingMinutes = Math.ceil((eventDate - todayDate) / (1000 * 60))
                if(remainingMinutes < 60){
                    return t("minutesLeft", {count: remainingMinutes})
                }else{
                    return t("hoursLeft", {count: remainingHours})
                }
            }
        }else{
            return t("daysLeft", {days: remainingEventDays})
        }
    }

    const getStatusStyle = (status) => {
        let style = "w-fit px-2 py-1 font-bold rounded-md text-sm lg:text-base text-white "
        if(status === t("finished")){
            style += "bg-red-900"
        }else{
            style += "bg-red-500"
        }
        return style
    }

</script>

<template>
    <div :class="getCardStyle(event)">
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1">
                <button
                    data-modal-toggle="organizationModal"
                    data-modal-target="organizationModal"
                    :class="getOrganizerStyle(organizer)"
                    @click="emits('organizerClick')"
                >
                    {{ organizer }}
                </button>
                <button
                    data-modal-toggle="gameModal"
                    data-modal-target="gameModal"
                    :class="getGameStyle(game)"
                    @click="emits('gameClick')"
                >
                    {{ game }}
                </button>
            </div>
            <div v-if="country_2" class="flex items-center gap-1 text-2xl lg:text-3xl">
                <Icon :name="`flag-${ country }-4x3`" mode="svg" class="rounded-sm lg:rounded-md" />
                <Icon :name="`flag-${ country_2 }-4x3`" mode="svg" class="rounded-sm lg:rounded-md" />
            </div>
            <div v-else-if="country_2 === null && country" class="text-2xl lg:text-3xl">
                <Icon :name="`flag-${ country }-4x3`" mode="svg" class="rounded-sm lg:rounded-md" />
            </div>
        </div>
        <div class="text-base lg:text-xl">
            {{ formatDate(date) }} - {{  formatTime(date) }}
        </div>
        <div :class="getTextStyle(event)">
            <span class="font-bold text-base lg:text-xl">{{ event }}</span>
        </div>
        <div class="text-sm lg:text-base">
            Round {{ round }}: {{ circuit }}
        </div>
        <div class="flex gap-1 lg:gap-2 items-center mt-2">
            <div :class="getStatusStyle(getStatus(date, finish_date))">
                {{ getStatus(date, finish_date) }}
            </div>
            <NuxtLink v-if="link" :to="link" target="_blank" class="text-sm lg:text-base text-white bg-blue-500 hover:bg-blue-400 px-2 py-1 rounded-md font-bold cursor-pointer">
                <div v-if="getStatus(date, finish_date) === t('finished')">
                    <span class="text-sm lg:text-base">{{ $t("watchReplay") }}</span>
                </div>
                <div v-else="getStatus(date, finish_date) === t('finished')">
                    <span class="text-sm lg:text-base">{{ $t("watchLive") }}</span>
                </div>
            </NuxtLink>
        </div>
    </div>
</template>