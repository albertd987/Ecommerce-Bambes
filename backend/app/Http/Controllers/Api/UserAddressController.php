<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserAddress;
use Illuminate\Http\Request;

class UserAddressController extends Controller
{
    public function index(Request $request)
    {
        $addresses = $request->user()
            ->addresses()
            ->get()
            ->map(fn ($address) => $this->formatAddress($address));

        return response()->json([
            'data' => $addresses,
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateAddress($request);

        $user = $request->user();

        if (!empty($data['is_default'])) {
            $user->addresses()->update(['is_default' => false]);
        }

        $address = $user->addresses()->create($data);

        return response()->json([
            'data' => $this->formatAddress($address),
            'message' => 'Adreça creada correctament',
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $address = $request->user()
            ->addresses()
            ->findOrFail($id);

        return response()->json([
            'data' => $this->formatAddress($address),
        ]);
    }

    public function update(Request $request, $id)
    {
        $address = $request->user()
            ->addresses()
            ->findOrFail($id);

        $data = $this->validateAddress($request);

        if (!empty($data['is_default'])) {
            $request->user()->addresses()->update(['is_default' => false]);
        }

        $address->update($data);

        return response()->json([
            'data' => $this->formatAddress($address->fresh()),
            'message' => 'Adreça actualitzada correctament',
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $address = $request->user()
            ->addresses()
            ->findOrFail($id);

        $wasDefault = $address->is_default;

        $address->delete();

        if ($wasDefault) {
            $next = $request->user()->addresses()->first();
            if ($next) {
                $next->update(['is_default' => true]);
            }
        }

        return response()->json([
            'message' => 'Adreça eliminada correctament',
        ]);
    }

    private function validateAddress(Request $request): array
    {
        return $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
            'line_one' => ['required', 'string', 'max:255'],
            'line_two' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'postcode' => ['required', 'string', 'max:20'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'is_default' => ['nullable', 'boolean'],
        ]);
    }

    private function formatAddress(UserAddress $address): array
    {
        return [
            'id' => $address->id,
            'label' => $address->label,
            'first_name' => $address->first_name,
            'last_name' => $address->last_name,
            'contact_email' => $address->contact_email,
            'contact_phone' => $address->contact_phone,
            'line_one' => $address->line_one,
            'line_two' => $address->line_two,
            'city' => $address->city,
            'state' => $address->state,
            'postcode' => $address->postcode,
            'country_code' => $address->country_code,
            'is_default' => (bool) $address->is_default,
            'created_at' => optional($address->created_at)->toISOString(),
            'updated_at' => optional($address->updated_at)->toISOString(),
        ];
    }
}