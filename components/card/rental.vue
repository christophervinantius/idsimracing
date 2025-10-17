<script setup>
    defineProps(
        [
            "name",
            "location",
            "instagram",
            "province",
            "regency"
        ]
    )

    const getCardStyle = () => {
        return "flex flex-col gap-2 border-red-700 dark:border-red-900 rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 p-4 lg:p-6 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
    }
</script>

<template>
    <div :class="getCardStyle()">
        <div>
            <span class="font-bold text-base lg:text-xl">{{ name }}</span>
        </div>
        <div class="text-sm lg:text-base">
            {{ regency }}, {{ province }}
        </div>
        <div class="flex gap-2 lg:gap-4 items-center mt-2 text-xl lg:text-2xl">
            <NuxtLink v-if="instagram" :to="instagram" target="_blank">   
                <Icon name="simple-icons:instagram" mode="svg" />
            </NuxtLink>
            <NuxtLink v-if="location" :to="location" target="_blank">   
                <Icon name="simple-icons:googlemaps" mode="svg" />
            </NuxtLink>
        </div>
    </div>
</template>