<!DOCTYPE html>
<html lang="{{ ($lang ?? 'ca') === 'en' ? 'en' : 'ca' }}">
<head>
    <meta charset="UTF-8">
    <title>
        {{ ($lang ?? 'ca') === 'en' 
            ? 'Order confirmation' 
            : 'Confirmació de compra' 
        }}
    </title>
</head>

<body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; margin: 0; padding: 20px; background-color: #f9fafb;">

    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 24px; border-radius: 8px;">

        @php
            $lang = ($lang ?? 'ca') === 'en' ? 'en' : 'ca';
            $total = number_format((($order['totals']['total'] ?? 0) / 100), 2);
        @endphp

        {{-- ========================= --}}
        {{-- HEADER --}}
        {{-- ========================= --}}
        <h2 style="margin-top: 0;">
            {{ $lang === 'en' 
                ? 'Thank you for your purchase!' 
                : 'Gràcies per la teva compra!' 
            }}
        </h2>

        <p>
            {{ $lang === 'en'
                ? 'Your order has been created successfully.'
                : 'La teva comanda s\'ha creat correctament.'
            }}
        </p>

        {{-- ========================= --}}
        {{-- INFO COMANDA --}}
        {{-- ========================= --}}
        <div style="margin: 20px 0; padding: 16px; background: #f3f4f6; border-radius: 6px;">
            <p style="margin: 4px 0;">
                <strong>
                    {{ $lang === 'en' ? 'Order ID:' : 'ID comanda:' }}
                </strong>
                {{ $order['id'] }}
            </p>

            <p style="margin: 4px 0;">
                <strong>
                    {{ $lang === 'en' ? 'Reference:' : 'Referència:' }}
                </strong>
                {{ $order['reference'] ?? '—' }}
            </p>

            <p style="margin: 4px 0;">
                <strong>
                    {{ $lang === 'en' ? 'Total:' : 'Total:' }}
                </strong>
                {{ $total }} €
            </p>
        </div>

        {{-- ========================= --}}
        {{-- MISSATGE --}}
        {{-- ========================= --}}
        <p>
            {{ $lang === 'en'
                ? 'We have attached your invoice in PDF format.'
                : 'T\'adjuntem la factura en format PDF.'
            }}
        </p>

        <p>
            {{ $lang === 'en'
                ? 'Thank you for trusting Bambes.'
                : 'Gràcies per confiar en Bambes.'
            }}
        </p>

        {{-- ========================= --}}
        {{-- FOOTER --}}
        {{-- ========================= --}}
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />

        <p style="font-size: 12px; color: #6b7280;">
            {{ $lang === 'en'
                ? 'This is an automatic email, please do not reply.'
                : 'Aquest és un correu automàtic, si us plau no responguis.'
            }}
        </p>

    </div>

</body>
</html>