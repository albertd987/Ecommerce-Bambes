<x-filament-panels::page>
    @if ($this->colors->isEmpty())
        <div class="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
            <x-heroicon-o-swatch class="mx-auto h-12 w-12 text-gray-400" />
            <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Aquest producte encara no té colors definits.
            </p>
            <p class="text-sm text-gray-400 dark:text-gray-500">
                Fes clic a "Afegir color nou" per començar.
            </p>
        </div>
    @else
        <div class="space-y-6">
            @foreach ($this->colors as $color)
                <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                    {{-- Color header --}}
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                        <h3 class="text-base font-semibold tracking-wide">{{ $color->name }}</h3>
                        <div class="flex gap-2">
                            <x-filament::button
                                size="sm"
                                color="gray"
                                icon="heroicon-m-pencil"
                                wire:click="openEditColor({{ $color->id }})"
                            >
                                Editar
                            </x-filament::button>
                            <x-filament::button
                                size="sm"
                                color="danger"
                                icon="heroicon-m-trash"
                                wire:click="deleteColor({{ $color->id }})"
                                wire:confirm="Segur que vols eliminar el color {{ $color->name }} i totes les seves tallas i imatges?"
                            >
                                Eliminar
                            </x-filament::button>
                        </div>
                    </div>

                    <div class="px-6 py-4 space-y-4">
                        {{-- Tallas --}}
                        <div>
                            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Tallas disponibles
                            </p>
                            <div class="flex flex-wrap gap-2">
                                @foreach ($this->availableSizes as $size)
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border
                                        {{ in_array($size, $color->sizes)
                                            ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300'
                                            : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500' }}">
                                        {{ $size }}
                                        @if(in_array($size, $color->sizes))
                                            <x-heroicon-m-check class="ml-1 h-3 w-3" />
                                        @endif
                                    </span>
                                @endforeach
                            </div>
                        </div>

                        {{-- Imatges --}}
                        <div>
                            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Imatges ({{ $color->images->count() }})
                            </p>
                            <div class="flex flex-wrap gap-3">
                                @foreach ($color->images as $image)
                                    <div class="relative group">
                                        <img
                                            src="{{ $image->url }}"
                                            alt="{{ $color->name }}"
                                            class="h-24 w-24 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                                        />
                                        <button
                                            type="button"
                                            wire:click="deleteImage({{ $image->id }})"
                                            wire:confirm="Eliminar aquesta imatge?"
                                            class="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center
                                                   h-6 w-6 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600"
                                        >
                                            <x-heroicon-m-x-mark class="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                @endforeach

                                {{-- Add images button --}}
                                <button
                                    type="button"
                                    wire:click="openAddImages({{ $color->id }})"
                                    class="h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600
                                           flex flex-col items-center justify-center gap-1
                                           text-gray-400 hover:border-primary-400 hover:text-primary-500
                                           dark:text-gray-500 dark:hover:border-primary-600 transition-colors"
                                >
                                    <x-heroicon-o-plus class="h-6 w-6" />
                                    <span class="text-xs">Afegir</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    @endif

    {{-- Edit color modal --}}
    <x-filament::modal id="edit-color" heading="Editar color" width="md">
        <form wire:submit="saveEditColor">
            {{ $this->editColorForm }}

            <div class="mt-4 flex justify-end gap-3">
                <x-filament::button
                    type="button"
                    color="gray"
                    x-on:click="$dispatch('close-modal', { id: 'edit-color' })"
                >
                    Cancel·lar
                </x-filament::button>
                <x-filament::button type="submit">
                    Desar canvis
                </x-filament::button>
            </div>
        </form>
    </x-filament::modal>

    {{-- Add images modal --}}
    <x-filament::modal id="add-images" heading="Afegir imatges" width="md">
        <form wire:submit="saveAddImages">
            {{ $this->addImagesForm }}

            <div class="mt-4 flex justify-end gap-3">
                <x-filament::button
                    type="button"
                    color="gray"
                    x-on:click="$dispatch('close-modal', { id: 'add-images' })"
                >
                    Cancel·lar
                </x-filament::button>
                <x-filament::button type="submit">
                    Afegir imatges
                </x-filament::button>
            </div>
        </form>
    </x-filament::modal>
</x-filament-panels::page>
