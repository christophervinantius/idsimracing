<script setup>
    defineProps(["organizer", "event", "round", "race", "date", "circuit", "link", "country", "country_2"])

    const { locale, t } = useI18n()

    const getCardStyle = (event) => {
        let style = "rounded-tr-3xl border-r-4 border-t-4 p-4 lg:p-6 bg-red-50 "
        if(event.startsWith("MX-5 Cup Asia")){
            style += "border-red-500"
        }else if(event.startsWith("1 Hour Series")){
            style += "border-blue-800"
        }else if(event === "Open Wheel Series"){
            style += "border-purple-800"
        }else if(event.startsWith("Sprint Series")){
            style += "border-yellow-500"
        }else if(event === "Endurance Championship"){
            style += "border-red-800"
        }else if(event === "V8 Masters League"){
            style += "border-blue-500"
        }else if(event === "B.E.G.O Balap Cup"){
            style += "border-orange-500"
        }else if(event === "Sprint Rally Challenge"){
            style += "border-purple-500"
        }
        return style
    }

    const getTextStyle = (event) => {
        let style = " "
        if(event.startsWith("MX-5 Cup Asia")){
            style += "text-red-500"
        }else if(event.startsWith("1 Hour Series")){
            style += "text-blue-800"
        }else if(event === "Open Wheel Series"){
            style += "text-purple-800"
        }else if(event.startsWith("Sprint Series")){
            style += "text-yellow-500"
        }else if(event === "Endurance Championship"){
            style += "text-red-800"
        }else if(event === "V8 Masters League"){
            style += "text-blue-500"
        }else if(event === "B.E.G.O Balap Cup"){
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
        
        newDate = newDate.toLocaleDateString(locale.value === "en" ? "en-UK" : "id-ID", options)

        return newDate
    }

    const getStatus = (date) => {
        let eventDate = new Date(date)
        let todayDate = new Date()
        eventDate.setHours(0, 0, 0, 0)
        todayDate.setHours(0, 0, 0, 0)
        const remainingDays = Math.ceil((eventDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24))
        if(remainingDays < 0){
            return t("finished")
        }else if(remainingDays === 0){
            return t("today") + "!"
        }else if(remainingDays === 1){
            return t("tomorrow")
        }else{
            return t("daysLeft", {days: remainingDays})
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
        <div class="flex items-center justify-between">
            <div class="text-base lg:text-xl">
                {{ formatDate(date) }}
            </div>
            <div v-if="country_2" class="flex items-center gap-1 text-2xl lg:text-3xl">
                <Icon :name="`flag-${ country }-4x3`" mode="svg" />
                <Icon :name="`flag-${ country_2 }-4x3`" mode="svg" />
            </div>
            <div v-else class="text-2xl lg:text-3xl">
                <Icon :name="`flag-${ country }-4x3`" mode="svg" />
            </div>
        </div>
        <div :class="getTextStyle(event)">
            <span class="font-bold text-base lg:text-xl">{{ organizer }} {{ event }}</span>
        </div>
        <div class="text-sm lg:text-base">
            Round {{ round }}: {{ circuit }}
        </div>
        <div class="flex gap-2 items-center mt-2">
            <div :class="getStatusStyle(getStatus(date))">
                {{ getStatus(date) }}
            </div>
            <NuxtLink v-if="link" :to="link" target="_blank" class="text-sm lg:text-base text-white bg-blue-500 px-2 py-1 rounded-md font-bold cursor-pointer">
                <div v-if="getStatus(date) === t('today') + '!'">
                    <span class="text-sm lg:text-base">{{ $t("watchLive") }}</span>
                </div>
                <div v-else="getStatus(date) === t('today')">
                    <span class="text-sm lg:text-base">{{ $t("watchReplay") }}</span>
                </div>
            </NuxtLink>
        </div>
    </div>
</template>