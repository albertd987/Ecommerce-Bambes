<!DOCTYPE html>
<html lang="{{ $lang ?? 'ca' }}">
<head>
    <meta charset="utf-8">
    <title>{{ ($lang ?? 'ca') === 'en' ? 'Invoice' : 'Factura' }} #{{ $order['id'] }}</title>
    <style>
        @page {
            margin: 26px 32px;
        }

        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #1f2937;
            margin: 0;
            line-height: 1.45;
        }

        h1, h2, h3, p {
            margin: 0;
        }

        .page {
            width: 100%;
        }

        .no-break {
            page-break-inside: avoid;
        }

        .header {
            border-bottom: 2px solid #111827;
            padding-bottom: 16px;
            margin-bottom: 18px;
        }

        .header-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .header-table td {
            vertical-align: top;
            border: none;
            padding: 0;
        }

        .header-left {
            width: 50%;
            text-align: left;
        }

        .header-right {
            width: 50%;
            text-align: right;
        }

        .logo-img {
            width: 240px;
            height: auto;
            display: inline-block;
        }

        .logo-placeholder {
            width: 240px;
            height: 95px;
            border: 1px dashed #cbd5e1;
            color: #94a3b8;
            text-align: center;
            line-height: 95px;
            font-size: 12px;
        }

        .brand-name {
            font-size: 30px;
            font-weight: bold;
            color: #111827;
            margin-bottom: 6px;
        }

        .brand-subtitle {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 10px;
        }

        .invoice-badge {
            display: inline-block;
            padding: 6px 12px;
            background: #111827;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
            border-radius: 999px;
        }

        .section {
            margin-bottom: 18px;
        }

        .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #111827;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid #d1d5db;
        }

        .two-col {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .two-col td {
            width: 50%;
            vertical-align: top;
            border: none;
            padding: 0;
        }

        .two-col td:first-child {
            padding-right: 12px;
        }

        .two-col td:last-child {
            padding-left: 12px;
        }

        .compact-three-col {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .compact-three-col td {
            width: 33.33%;
            vertical-align: top;
            border: none;
            padding: 0;
        }

        .compact-three-col td:nth-child(1) {
            padding-right: 10px;
        }

        .compact-three-col td:nth-child(2) {
            padding-left: 5px;
            padding-right: 5px;
        }

        .compact-three-col td:nth-child(3) {
            padding-left: 10px;
        }

        .info-block p {
            margin-bottom: 4px;
            font-size: 11px;
            line-height: 1.4;
        }

        .compact-info p {
            margin-bottom: 3px;
            font-size: 11px;
            line-height: 1.35;
        }

        .muted {
            color: #6b7280;
        }

        .divider {
            height: 1px;
            background: #e5e7eb;
            margin: 16px 0;
        }

        .products-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
        }

        .products-table th {
            text-align: left;
            font-size: 11px;
            padding: 9px 8px;
            background: #f9fafb;
            border-top: 1px solid #d1d5db;
            border-bottom: 1px solid #d1d5db;
        }

        .products-table td {
            padding: 9px 8px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
            font-size: 11px;
        }

        .right {
            text-align: right;
        }

        .summary-wrap {
            width: 100%;
            margin-top: 6px;
        }

        .summary-table {
            width: 46%;
            margin-left: auto;
            border-collapse: collapse;
        }

        .summary-table td {
            padding: 7px 8px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
        }

        .summary-label {
            color: #4b5563;
        }

        .grand-total td {
            font-weight: bold;
            font-size: 13px;
            border-top: 2px solid #111827;
            border-bottom: none;
            padding-top: 10px;
            color: #111827;
        }

        .note {
            margin-top: 8px;
            font-size: 10px;
            color: #6b7280;
        }

        .footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #d1d5db;
            text-align: center;
            font-size: 10px;
            color: #6b7280;
        }
    </style>
</head>
<body>
@php
    $lang = $lang ?? 'ca';

    $t = [
        'ca' => [
            'invoice_simple' => 'Factura simplificada de compra',
            'seller_data' => 'Dades del venedor',
            'order_info' => 'Informació de la comanda',
            'order_id' => 'ID comanda',
            'invoice_number' => 'Factura núm.',
            'reference' => 'Referència',
            'status' => 'Estat',
            'date' => 'Data',
            'customer_data' => 'Dades del client',
            'name' => 'Nom',
            'email' => 'Email',
            'phone' => 'Telèfon',
            'billing_address' => 'Adreça de facturació',
            'shipping_address' => 'Adreça d\'enviament',
            'product_details' => 'Detall dels productes',
            'product' => 'Producte',
            'quantity' => 'Quantitat',
            'unit_price' => 'Preu unitari',
            'amount' => 'Import',
            'economic_summary' => 'Resum econòmic',
            'subtotal_no_tax' => 'Subtotal (sense IVA)',
            'discount' => 'Descompte',
            'shipping' => 'Despeses d\'enviament',
            'tax' => 'IVA',
            'total' => 'Total',
            'note' => 'Tots els imports estan expressats en euros (€). El total inclou els impostos aplicables.',
            'thanks' => 'Gràcies per confiar en Bambes.',
            'footer' => 'Aquest document s\'ha generat automàticament i serveix com a comprovant de compra.',
        ],
        'en' => [
            'invoice_simple' => 'Simplified purchase invoice',
            'seller_data' => 'Seller information',
            'order_info' => 'Order information',
            'order_id' => 'Order ID',
            'invoice_number' => 'Invoice no.',
            'reference' => 'Reference',
            'status' => 'Status',
            'date' => 'Date',
            'customer_data' => 'Customer information',
            'name' => 'Name',
            'email' => 'Email',
            'phone' => 'Phone',
            'billing_address' => 'Billing address',
            'shipping_address' => 'Shipping address',
            'product_details' => 'Product details',
            'product' => 'Product',
            'quantity' => 'Quantity',
            'unit_price' => 'Unit price',
            'amount' => 'Amount',
            'economic_summary' => 'Order summary',
            'subtotal_no_tax' => 'Subtotal (excluding VAT)',
            'discount' => 'Discount',
            'shipping' => 'Shipping',
            'tax' => 'VAT',
            'total' => 'Total',
            'note' => 'All amounts are expressed in euros (€). The total includes applicable taxes.',
            'thanks' => 'Thank you for trusting Bambes.',
            'footer' => 'This document has been generated automatically and serves as proof of purchase.',
        ],
    ];

    $statusMap = [
        'ca' => [
            'paid' => 'Pagada',
            'payment-received' => 'Pagada',
            'awaiting-payment' => 'Pendent de pagament',
            'pending' => 'Pendent',
            'processing' => 'En procés',
            'shipped' => 'Enviada',
            'completed' => 'Completada',
            'cancelled' => 'Cancel·lada',
            'refunded' => 'Reemborsada',
        ],
        'en' => [
            'paid' => 'Paid',
            'payment-received' => 'Paid',
            'awaiting-payment' => 'Awaiting payment',
            'pending' => 'Pending',
            'processing' => 'Processing',
            'shipped' => 'Shipped',
            'completed' => 'Completed',
            'cancelled' => 'Cancelled',
            'refunded' => 'Refunded',
        ],
    ];

    $txt = $t[$lang] ?? $t['ca'];

    $rawStatus = strtolower((string) ($order['status'] ?? ''));
    $translatedStatus = $statusMap[$lang][$rawStatus] ?? ($order['status'] ?? '—');

    $invoiceNumber = 'FAC-' . date('Y') . '-' . str_pad((string) $order['id'], 4, '0', STR_PAD_LEFT);

    $subTotal = (int) ($order['totals']['sub_total'] ?? 0);
    $taxTotal = (int) ($order['totals']['tax_total'] ?? 0);
    $shippingTotal = (int) ($order['totals']['shipping_total'] ?? 0);
    $discountTotal = (int) ($order['totals']['discount_total'] ?? 0);
    $grandTotal = (int) ($order['totals']['total'] ?? 0);
    $subTotalWithoutTax = max(0, $subTotal - $taxTotal);

    try {
        $date = !empty($order['created_at'])
            ? \Carbon\Carbon::parse($order['created_at'])->setTimezone('Europe/Madrid')
            : null;

        $formattedDate = $date
            ? ($lang === 'en'
                ? $date->format('d/m/Y') . ' at ' . $date->format('H:i')
                : $date->format('d/m/Y') . ' a les ' . $date->format('H:i'))
            : '—';
    } catch (\Throwable $e) {
        $formattedDate = $order['created_at'] ?? '—';
    }
@endphp

<div class="page">
    <div class="header no-break">
        <table class="header-table">
            <tr>
                <td class="header-left">
                    @if(file_exists(public_path('logo.png')))
                        <img src="{{ public_path('logo.png') }}" class="logo-img" alt="Bambes logo">
                    @else
                        <div class="logo-placeholder">LOGO</div>
                    @endif
                </td>
                <td class="header-right">
                    <div class="brand-name">Bambes</div>
                    <div class="brand-subtitle">{{ $txt['invoice_simple'] }}</div>
                    <div class="invoice-badge">{{ $invoiceNumber }}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="section no-break">
        <table class="two-col">
            <tr>
                <td>
                    <div class="section-title">{{ $txt['seller_data'] }}</div>
                    <div class="info-block">
                        <p><strong>Bambes</strong></p>
                        <p>Carrer Exemple, 12</p>
                        <p>08700 Igualada</p>
                        <p>Barcelona, Espanya</p>
                        <p><strong>NIF:</strong> B-12345678</p>
                        <p><strong>Email:</strong> contacte@bambes.com</p>
                        <p><strong>{{ $txt['phone'] }}:</strong> +34 600 000 000</p>
                    </div>
                </td>
                <td>
                    <div class="section-title">{{ $txt['order_info'] }}</div>
                    <div class="info-block">
                        <p><strong>{{ $txt['order_id'] }}:</strong> {{ $order['id'] }}</p>
                        <p><strong>{{ $txt['invoice_number'] }}:</strong> {{ $invoiceNumber }}</p>
                        <p><strong>{{ $txt['reference'] }}:</strong> {{ $order['reference'] ?? '—' }}</p>
                        <p><strong>{{ $txt['status'] }}:</strong> {{ $translatedStatus }}</p>
                        <p><strong>{{ $txt['date'] }}:</strong> {{ $formattedDate }}</p>
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <div class="divider"></div>

    <div class="section no-break">
        <table class="compact-three-col">
            <tr>
                <td>
                    <div class="section-title">{{ $txt['customer_data'] }}</div>
                    <div class="info-block compact-info">
                        <p>
                            <strong>{{ $txt['name'] }}:</strong>
                            {{ trim(($order['customer']['first_name'] ?? '') . ' ' . ($order['customer']['last_name'] ?? '')) ?: '—' }}
                        </p>
                        <p><strong>{{ $txt['email'] }}:</strong> {{ $order['customer']['email'] ?? '—' }}</p>
                        <p><strong>{{ $txt['phone'] }}:</strong> {{ $order['customer']['phone'] ?? '—' }}</p>
                    </div>
                </td>

                <td>
                    <div class="section-title">{{ $txt['billing_address'] }}</div>
                    <div class="info-block compact-info">
                        @if(!empty($order['billing_address']))
                            <p>{{ trim(($order['billing_address']['first_name'] ?? '') . ' ' . ($order['billing_address']['last_name'] ?? '')) }}</p>
                            <p>{{ $order['billing_address']['line_one'] ?? '' }}</p>
                            @if(!empty($order['billing_address']['line_two']))
                                <p>{{ $order['billing_address']['line_two'] }}</p>
                            @endif
                            <p>{{ $order['billing_address']['postcode'] ?? '' }} {{ $order['billing_address']['city'] ?? '' }}</p>
                            @if(!empty($order['billing_address']['state']))
                                <p>{{ $order['billing_address']['state'] }}</p>
                            @endif
                        @else
                            <p class="muted">—</p>
                        @endif
                    </div>
                </td>

                <td>
                    <div class="section-title">{{ $txt['shipping_address'] }}</div>
                    <div class="info-block compact-info">
                        @if(!empty($order['shipping_address']))
                            <p>{{ trim(($order['shipping_address']['first_name'] ?? '') . ' ' . ($order['shipping_address']['last_name'] ?? '')) }}</p>
                            <p>{{ $order['shipping_address']['line_one'] ?? '' }}</p>
                            @if(!empty($order['shipping_address']['line_two']))
                                <p>{{ $order['shipping_address']['line_two'] }}</p>
                            @endif
                            <p>{{ $order['shipping_address']['postcode'] ?? '' }} {{ $order['shipping_address']['city'] ?? '' }}</p>
                            @if(!empty($order['shipping_address']['state']))
                                <p>{{ $order['shipping_address']['state'] }}</p>
                            @endif
                        @else
                            <p class="muted">—</p>
                        @endif
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <div class="divider"></div>

    <div class="section no-break">
        <div class="section-title">{{ $txt['product_details'] }}</div>

        <table class="products-table">
            <thead>
                <tr>
                    <th>{{ $txt['product'] }}</th>
                    <th class="right">{{ $txt['quantity'] }}</th>
                    <th class="right">{{ $txt['unit_price'] }}</th>
                    <th class="right">{{ $txt['amount'] }}</th>
                </tr>
            </thead>
            <tbody>
                @foreach(($order['lines'] ?? []) as $line)
                    <tr>
                        <td>{{ $line['name'] ?? $txt['product'] }}</td>
                        <td class="right">{{ $line['quantity'] ?? 1 }}</td>
                        <td class="right">{{ number_format((($line['unit_price'] ?? 0) / 100), 2) }} €</td>
                        <td class="right">{{ number_format((($line['total'] ?? 0) / 100), 2) }} €</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="section no-break">
        <div class="section-title">{{ $txt['economic_summary'] }}</div>

        <div class="summary-wrap">
            <table class="summary-table">
                <tr>
                    <td class="summary-label">{{ $txt['subtotal_no_tax'] }}</td>
                    <td class="right">{{ number_format(($subTotalWithoutTax / 100), 2) }} €</td>
                </tr>

                @if($discountTotal > 0)
                    <tr>
                        <td class="summary-label">{{ $txt['discount'] }}</td>
                        <td class="right">-{{ number_format(($discountTotal / 100), 2) }} €</td>
                    </tr>
                @endif

                <tr>
                    <td class="summary-label">{{ $txt['shipping'] }}</td>
                    <td class="right">{{ number_format(($shippingTotal / 100), 2) }} €</td>
                </tr>

                <tr>
                    <td class="summary-label">{{ $txt['tax'] }}</td>
                    <td class="right">{{ number_format(($taxTotal / 100), 2) }} €</td>
                </tr>

                <tr class="grand-total">
                    <td>{{ $txt['total'] }}</td>
                    <td class="right">{{ number_format(($grandTotal / 100), 2) }} €</td>
                </tr>
            </table>

            <p class="note">{{ $txt['note'] }}</p>
        </div>
    </div>

    <div class="footer no-break">
        <p>{{ $txt['thanks'] }}</p>
        <p>{{ $txt['footer'] }}</p>
    </div>
</div>
</body>
</html>