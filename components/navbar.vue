<template>
    <div class="sticky top-0 z-50">
        <nav class="container flex items-center justify-between bg-red-500 px-4 lg:px-16 py-4 text-white">
            <NuxtLink to="/" class="text-lg lg:text-3xl font-bold">Indonesia Sim Racing</NuxtLink>
            <ul class="flex gap-4 lg:gap-16 text-sm lg:text-lg">
                <NuxtLink :to="$localePath('index', 'id')">ID</NuxtLink>
                <NuxtLink :to="$localePath('index', 'en')">EN</NuxtLink>
            </ul>
        </nav>
    </div>
</template>