<script setup>
    const { locale } = useI18n()

    const organizationData = inject("organizationData")

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
</script>

<template>
    <div class="bg-red-900 dark:bg-red-900 p-4 lg:p-6 flex flex-col gap-4 lg:gap-6">
        <div class="flex items-center justify-between rounded-t">
            <div :class="getOrganizerStyle(organizationData?.organizer)">
                {{ organizationData?.organizer }}
            </div>
        </div>
        <div class="flex flex-col-reverse lg:flex-row items-center justify-between w-full gap-4 lg:gap-6">
            <div class="flex flex-col gap-4 lg:gap-6 w-full lg:w-4/5">
                <h3 class="text-center lg:text-justify text-xl lg:text-2xl font-semibold text-white">
                    {{ organizationData?.name }}
                </h3>
                <p v-if="locale === 'id'" class="text-sm lg:text-base text-justify leading-relaxed text-white">
                    <span v-if="organizationData?.description_id">{{ organizationData?.description_id }}</span>
                    <span v-else>{{ $t("noDescription") }}</span>
                </p>
                <p v-else-if="locale === 'en'" class="text-sm lg:text-base text-justify leading-relaxed text-white">
                    <span v-if="organizationData?.description_en">{{ organizationData?.description_en }}</span>
                    <span v-else>{{ $t("noDescription") }}</span>
                </p>
                <div class="flex justify-center lg:justify-start items-center gap-4 lg:gap-6 text-white text-xl lg:text-2xl">
                    <NuxtLink v-if="organizationData?.discord" :to="organizationData?.discord" target="_blank">   
                        <Icon name="simple-icons:discord" mode="svg" class="rounded-sm lg:rounded-md" />
                    </NuxtLink>
                    <NuxtLink v-if="organizationData?.youtube" :to="organizationData?.youtube" target="_blank">   
                        <Icon name="simple-icons:youtube" mode="svg" class="rounded-sm lg:rounded-md" />
                    </NuxtLink>
                    <NuxtLink v-if="organizationData?.instagram" :to="organizationData?.instagram" target="_blank">   
                        <Icon name="simple-icons:instagram" mode="svg" class="rounded-sm lg:rounded-md" />
                    </NuxtLink>
                    <NuxtLink v-if="organizationData?.facebook" :to="organizationData?.facebook" target="_blank">   
                        <Icon name="simple-icons:facebook" mode="svg" class="rounded-sm lg:rounded-md" />
                    </NuxtLink>
                    <NuxtLink v-if="organizationData?.twitter" :to="organizationData?.twitter" target="_blank">   
                        <Icon name="simple-icons:x" mode="svg" class="rounded-sm lg:rounded-md" />
                    </NuxtLink>
                    <NuxtLink v-if="organizationData?.tiktok" :to="organizationData?.tiktok" target="_blank">   
                        <Icon name="simple-icons:tiktok" mode="svg" class="rounded-sm lg:rounded-md" />
                    </NuxtLink>
                </div>
            </div>
            <div class="w-1/4 lg:w-1/5">
                <NuxtImg 
                    :src="`/images/logos/${organizationData?.organizer}.png`"
                    :alt="organizationData?.name"
                    class="w-full object-contain"
                />
            </div>
        </div>
    </div>
</template>