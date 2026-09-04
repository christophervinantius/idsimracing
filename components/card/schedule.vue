<script setup>
    defineProps(
        [
            "id",
            "event",
            "round",
            "race",
            "date",
            "finish_date",
            "circuit",
            "link",
            "country",
            "country_2",
            "is_postponed",
            "organizer",
            "game",
            "season",
            "has_result"
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
        let style = "rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 p-4 lg:p-6 text-black dark:text-white "
        if(event.startsWith("MX-5 Cup Asia")){
            style += "border-red-500 bg-red-200/80 dark:bg-red-900/60"
        }else if(event.startsWith("1 Hour Series")){
            style += "border-emerald-500 bg-emerald-200/80 dark:bg-emerald-900/60"
        }else if(event === "Open Wheel Series"){
            style += "border-cyan-500 bg-cyan-200/80 dark:bg-cyan-900/60"
        }else if(event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open") || event.startsWith("Asri Motor Slalom Cup")){
            style += "border-yellow-500 bg-yellow-200/80 dark:bg-yellow-900/60"
        }else if(event === "Endurance Championship"){
            style += "border-pink-500 bg-pink-200/80 dark:bg-pink-900/60"
        }else if(event === "Masters League" || event === "Praga Cup"){
            style += "border-blue-500 bg-blue-200/80 dark:bg-blue-900/60"
        }else if(event === "Juniors"){
            style += "border-lime-500 bg-lime-200/80 dark:bg-lime-900/60"
        }else if(event === "B.E.G.O. Balap Cup"){
            style += "border-orange-500 bg-orange-200/80 dark:bg-orange-900/60"
        }else if(event === "Sprint Rally Challenge" || event === "Rally Championship"){
            style += "border-purple-500 bg-purple-200/80 dark:bg-purple-900/60"
        }else if(event.startsWith("Speedway Master Series")){
            style += "border-fuchsia-500 bg-fuchsia-200/80 dark:bg-fuchsia-900/60"
        }else if(event === "Javahosting Rental Cup"){
            style += "border-indigo-500 bg-indigo-200/80 dark:bg-indigo-900/60"
        }else if(event === "Indorance"){
            style += "border-sky-500 bg-sky-200/80 dark:bg-sky-900/60"
        }else if(event === "Endurance Edition" || event === "Global Edition"){
            style += "border-rose-500 bg-rose-200/80 dark:bg-rose-900/60"
        }else if(event.startsWith("LMU Championship")){
            style += "border-amber-500 bg-amber-200/80 dark:bg-amber-900/60"
        }else if(event === "LMU Solo Endurance"){
            style += "border-pink-800 bg-pink-300/80 dark:bg-pink-800/60"
        }else{
            style += "bg-red-50 dark:bg-slate-950"
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
        }else if(organizer === "BRM"){
            style += "bg-sky-500 hover:bg-sky-600 text-black"
        }else if(organizer === "JRC"){
            style += "bg-indigo-500 hover:bg-indigo-600 text-black"
        }else if(organizer === "ERGP"){
            style += "bg-white hover:bg-neutral-300 text-red-600"
        }else if(organizer === "SRC"){
            style += "bg-blue-500 hover:bg-blue-600 text-white"
        }else if(organizer === "ISL"){
            style += "bg-pink-800 hover:bg-pink-900 text-white"
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
        }else if(game === "LMU"){
            style += "bg-amber-500 hover:bg-amber-600 text-black"
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
        }else if(event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open") || event.startsWith("Asri Motor Slalom Cup")){
            style += "text-yellow-500"
        }else if(event === "Endurance Championship"){
            style += "text-pink-500"
        }else if(event === "Masters League" || event === "Praga Cup"){
            style += "text-blue-500"
        }else if(event === "Juniors"){
            style += "text-lime-500"
        }else if(event === "B.E.G.O. Balap Cup"){
            style += "text-orange-500"
        }else if(event === "Sprint Rally Challenge" || event === "Rally Championship"){
            style += "text-purple-500"
        }else if(event.startsWith("Speedway Master Series")){
            style += "text-fuchsia-500"
        }else if(event === "Javahosting Rental Cup"){
            style += "text-indigo-500"
        }else if(event === "Indorance"){
            style += "text-sky-500"
        }else if(event === "Endurance Edition" || event === "Global Edition"){
            style += "text-rose-500"
        }else if(event.startsWith("LMU Championship")){
            style += "text-amber-500"
        }else if(event === "LMU Solo Endurance"){
            style += "text-pink-800"
        }
        return style
    }

    const formatDate = (date) => {
        let newDate = new Date(date)

        let dateOptions = {
            month: "long",
            day: "numeric",
            weekday: "long",
            year: "numeric"
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

    const getStatus = (date, finish_date, is_postponed) => {
        if(is_postponed){
            return t("postponed")
        }
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
        let style = "w-fit px-2 py-1 font-bold rounded-md text-sm lg:text-base border "
        if(status === t("postponed")){
            style += "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800"
        }else if(status === t("finished")){
            style += "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300 border-gray-300 dark:border-slate-700"
        }else{
            style += "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
        }
        return style
    }
</script>

<template>
    <div :class="getCardStyle(event)">
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1">
                <UModal>
                    <button :class="getOrganizerStyle(organizer)" @click="emits('organizerClick')">
                        {{ organizer }}
                    </button>
                    <template #content>
                        <ModalOrganization />
                    </template>
                </UModal>
                <UModal>
                    <button :class="getGameStyle(game)" @click="emits('gameClick')">
                        {{ game }}
                    </button>
                    <template #content>
                        <ModalGame />
                    </template>
                </UModal>
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
            {{ formatDate(date) }}
        </div>
        <div class="text-base lg:text-xl">
            {{ formatTime(date) }}
        </div>
        <div :class="getTextStyle(event)">
            <span class="font-bold text-base lg:text-xl">{{ event }} {{ season && "(S" + season + ")"}}</span>
        </div>
        <div class="text-sm lg:text-base">
            <div v-if="round === 'Invitation' || round === 'Prologue'">
                {{ round }} Round: {{ circuit }}
            </div>
            <div v-else-if="round !== null">
                Round {{ round }}: {{ circuit }}
            </div>
            <div v-else-if="circuit !== null">
                {{ circuit }}
            </div>
        </div>
        <div class="flex flex-wrap gap-1 lg:gap-2 items-center mt-2">
            <!-- Results button in front when finished -->
            <NuxtLink
                v-if="getStatus(date, finish_date, is_postponed) === t('finished') && id && has_result"
                :to="`/results/${id}`"
                target="_blank" 
                class="text-sm lg:text-base text-white bg-red-700 hover:bg-red-800 px-2 py-1 rounded-md font-bold cursor-pointer flex items-center gap-1 shadow-sm transition"
            >
                <span>{{ $t("viewResults") }}</span>
            </NuxtLink>

            <!-- Status badge (hidden if finished) -->
            <div
                v-if="getStatus(date, finish_date, is_postponed) !== t('finished')"
                :class="getStatusStyle(getStatus(date, finish_date, is_postponed))"
            >
                {{ getStatus(date, finish_date, is_postponed) }}
            </div>

            <!-- Stream / Replay Link -->
            <NuxtLink v-if="link" :to="link" target="_blank" class="text-sm lg:text-base text-white bg-blue-500 hover:bg-blue-400 px-2 py-1 rounded-md font-bold cursor-pointer">
                <div v-if="getStatus(date, finish_date, is_postponed) === t('finished')">
                    <span class="text-sm lg:text-base">{{ $t("watchReplay") }}</span>
                </div>
                <div v-else>
                    <span class="text-sm lg:text-base">{{ $t("watchLive") }}</span>
                </div>
            </NuxtLink>

            <!-- Results button when not finished -->
            <NuxtLink
                v-if="getStatus(date, finish_date, is_postponed) !== t('finished') && id && has_result"
                :to="`/results/${id}`"
                target="_blank" 
                class="text-sm lg:text-base text-white bg-red-700 hover:bg-red-800 px-2 py-1 rounded-md font-bold cursor-pointer flex items-center gap-1 shadow-sm transition"
            >
                <span>{{ $t("viewResults") }}</span>
            </NuxtLink>
        </div>
    </div>
</template>