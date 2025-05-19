<script setup>
    defineProps(
        [
            "game",
            "name",
            "description",
            "link"
        ]
    )
</script>

<template>
    <div class="relative w-full max-w-2xl max-h-full">
        <div class="relative bg-red-700 dark:bg-red-900 rounded-lg shadow-sm">
            <div class="flex items-start justify-between p-5 rounded-t">
                <h3 class="text-xl font-semibold lg:text-2xl text-white">
                    Terms of Service
                </h3>
                <button id="closeButton" data-modal-hide="gameModal" type="button" class="text-white hover:text-neutral-300 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center cursor-pointer">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>  
                </button>
            </div>
            <div class="p-6 space-y-6">
                <p class="text-base leading-relaxed text-white">
                    With less than a month to go before the European Union enacts new consumer privacy laws for its citizens, companies around the world are updating their terms of service agreements to comply.
                </p>
            </div>
            <div class="flex items-center p-6 space-x-2 rounded-b">
                <button type="button" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">I accept</button>
                <button type="button" class="text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600">Decline</button>
            </div>
        </div>
    </div>
</template>