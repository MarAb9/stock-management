<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        $id = $this->route('product')?->id;
        return [
            'reference' => ['required', 'string', 'max:100', Rule::unique('products')->ignore($id)],
            'name' => ['required', 'string', 'max:255'], 'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'], 'unit_id' => ['required', 'integer', 'exists:units,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'], 'minimum_stock' => ['required', 'numeric', 'min:0'],
            'maximum_stock' => ['nullable', 'numeric', 'gte:minimum_stock'], 'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'barcode' => ['nullable', 'string', 'max:255', Rule::unique('products')->ignore($id)],
            'track_lots' => ['boolean'], 'active' => ['boolean'],
        ];
    }
}
