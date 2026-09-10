<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssetRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        $id = $this->route('asset')?->id;
        return [
            'inventory_number' => ['required', 'string', 'max:100', Rule::unique('assets')->ignore($id)], 'name' => ['required', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'], 'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'], 'location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'brand' => ['nullable', 'string', 'max:100'], 'model' => ['nullable', 'string', 'max:100'], 'serial_number' => ['nullable', 'string', 'max:100', Rule::unique('assets')->ignore($id)],
            'acquired_at' => ['nullable', 'date'], 'acquisition_price' => ['nullable', 'numeric', 'min:0'], 'warranty_ends_at' => ['nullable', 'date'],
            'condition' => ['required', Rule::in(['new', 'very_good', 'good', 'fair', 'repair', 'out_of_service', 'retired'])],
            'status' => ['required', Rule::in(['available', 'assigned', 'maintenance', 'out_of_service', 'retired'])], 'assigned_to' => ['nullable', 'string', 'max:255'], 'notes' => ['nullable', 'string'],
        ];
    }
}
