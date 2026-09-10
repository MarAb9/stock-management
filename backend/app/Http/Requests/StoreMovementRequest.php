<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMovementRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', Rule::exists('products', 'id')->whereNull('deleted_at')],
            'type' => ['required', Rule::in(['entry', 'exit', 'return', 'transfer', 'adjustment', 'loss', 'disposal'])],
            'direction' => ['required_if:type,adjustment', 'nullable', Rule::in(['increase', 'decrease'])],
            'quantity' => ['required', 'numeric', 'decimal:0,3', 'gt:0', 'max:99999999999.999'],
            'source_location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'destination_location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'stock_lot_id' => ['nullable', 'integer', 'exists:stock_lots,id'],
            'lot_number' => ['nullable', 'string', 'max:100'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'produced_at' => ['nullable', 'date_format:Y-m-d'],
            'expires_at' => ['nullable', 'date_format:Y-m-d', ...($this->input('produced_at') ? ['after_or_equal:produced_at'] : [])],
            'purchase_price' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:999999999999.99'],
            'reason' => ['required_if:type,adjustment,loss,disposal', 'nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'performed_at' => ['nullable', 'date', 'before_or_equal:now'],
        ];
    }
}
