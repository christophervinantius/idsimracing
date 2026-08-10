<script setup>
    const { locale } = useI18n()

    const gameData = inject("gameData")

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
</script>

<template>
    <div class="bg-red-900 dark:bg-red-900 p-4 lg:p-6 flex flex-col gap-4 lg:gap-6">
        <div class="flex items-center justify-between rounded-t">
            <div :class="getGameStyle(gameData?.game)">
                {{ gameData?.game }}
            </div>
        </div>
        <div class="flex flex-col-reverse lg:flex-row items-center justify-between w-full gap-4 lg:gap-6">
            <div class="flex flex-col gap-4 lg:gap-6 w-full lg:w-3/5">
                <h3 class="text-center lg:text-justify text-xl lg:text-2xl font-semibold text-white">
                    {{ gameData?.name }}
                </h3>
                <p v-if="locale === 'id'" class="text-sm lg:text-base text-justify leading-relaxed text-white">
                    <span v-if="gameData?.description_id">{{ gameData?.description_id }}</span>
                    <span v-else>{{ $t("noDescription") }}</span>
                </p>
                <p v-else-if="locale === 'en'" class="text-sm lg:text-base text-justify leading-relaxed text-white">
                    <span v-if="gameData?.description_en">{{ gameData?.description_en }}</span>
                    <span v-else>{{ $t("noDescription") }}</span>
                </p>
                <div class="flex justify-center lg:justify-start items-center gap-4 lg:gap-6 text-white text-xl lg:text-2xl">
                    <NuxtLink v-if="gameData?.steam_link" :to="gameData?.steam_link" target="_blank">   
                        <Icon name="simple-icons:steam" mode="svg" class="rounded-sm lg:rounded-md" />
                    </NuxtLink>
                    <NuxtLink v-if="gameData?.other_link" :to="gameData?.other_link" target="_blank">   
                        <Icon name="material-symbols:download" mode="svg" class="rounded-sm lg:rounded-md" />
                    </NuxtLink>
                </div>
            </div>
            <div class="w-1/2 lg:w-2/5">
                <NuxtImg 
                    :src="`/images/logos/${gameData?.game}_Cover.png`"
                    :alt="gameData?.name"
                    class="w-full object-contain"
                />
            </div>
        </div>
    </div>
</template>