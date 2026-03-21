<x-filament-panels::page>
    {{-- Variants Stock Overview --}}
    <div class="space-y-4">
        <h3 class="text-lg font-medium">Variants i Stock</h3>

        <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
            <table class="w-full text-start">
                <thead>
                    <tr class="border-b border-gray-200 dark:border-gray-700">
                        <th class="px-4 py-3 text-start text-sm font-medium text-gray-600 dark:text-gray-400">SKU</th>
                        <th class="px-4 py-3 text-start text-sm font-medium text-gray-600 dark:text-gray-400">Stock</th>
                        <th class="px-4 py-3 text-start text-sm font-medium text-gray-600 dark:text-gray-400">Estat</th>
                        <th class="px-4 py-3 text-end text-sm font-medium text-gray-600 dark:text-gray-400">Accions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($this->variants as $variant)
                        <tr class="border-b border-gray-100 dark:border-gray-800 last:border-0">
                            <td class="px-4 py-3 text-sm font-mono">{{ $variant->sku }}</td>
                            <td class="px-4 py-3 text-sm font-semibold">{{ $variant->stock }}</td>
                            <td class="px-4 py-3">
                                <x-filament::badge :color="$variant->status_color">
                                    {{ $variant->status_label }}
                                </x-filament::badge>
                            </td>
                            <td class="px-4 py-3 text-end">
                                <x-filament::button
                                    size="sm"
                                    wire:click="adjustStock({{ $variant->id }})"
                                    icon="heroicon-m-adjustments-horizontal"
                                >
                                    Ajustar stock
                                </x-filament::button>
                            </td>
                        </tr>
                    @endforeach

                    @if ($this->variants->isEmpty())
                        <tr>
                            <td colspan="4" class="px-4 py-8 text-center text-sm text-gray-500">
                                No hi ha variants per aquest producte.
                            </td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    </div>

    {{-- Stock Adjustment Modal --}}
    <x-filament::modal id="adjust-stock" heading="Ajustar Stock" width="md">
        <form wire:submit="submitAdjustment">
            {{ $this->adjustForm }}

            @if (isset($this->adjustData['current_stock']) && isset($this->adjustData['quantity']) && is_numeric($this->adjustData['quantity']))
                <div class="mt-4 rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm">
                    <span class="font-medium">Previsió:</span>
                    Stock actual: <strong>{{ $this->adjustData['current_stock'] }}</strong>
                    &rarr; Nou stock: <strong>{{ $this->adjustData['current_stock'] + (int) $this->adjustData['quantity'] }}</strong>
                </div>
            @endif

            <div class="mt-4 flex justify-end gap-3">
                <x-filament::button type="button" color="gray" x-on:click="$dispatch('close-modal', { id: 'adjust-stock' })">
                    Cancel·lar
                </x-filament::button>
                <x-filament::button type="submit">
                    Aplicar ajust
                </x-filament::button>
            </div>
        </form>
    </x-filament::modal>

    {{-- Movement History --}}
    <div class="space-y-4">
        <h3 class="text-lg font-medium">Historial de Moviments</h3>
        {{ $this->table }}
    </div>
</x-filament-panels::page>
