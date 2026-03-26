<!DOCTYPE html>
<html lang="{{ $lang ?? 'ca' }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? 'Verifica el teu correu' }}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6; margin:0; padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px; background-color:#ffffff; border-radius:28px; overflow:hidden; box-shadow:0 10px 35px rgba(0,0,0,0.08);">

                    {{-- HERO --}}
                    <tr>
                        <td style="padding:36px 36px 28px 36px; background-color:#111111;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="vertical-align:middle;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
 
                                                </td>
                                                <td style="padding-left:14px;">
                                                    <div style="font-size:13px; letter-spacing:1.2px; text-transform:uppercase; color:rgba(255,255,255,0.72);">
                                                        Bambes
                                                    </div>
                                                    <div style="font-size:15px; font-weight:700; color:#ffffff; margin-top:4px;">
                                                        {{ $lang === 'en' ? 'Email verification' : 'Verificació de correu' }}
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <h1 style="margin:28px 0 0 0; font-size:32px; line-height:1.2; color:#ffffff; font-weight:700;">
                                {{ $title }}
                            </h1>

                            <p style="margin:14px 0 0 0; font-size:15px; line-height:1.7; color:rgba(255,255,255,0.82); max-width:560px;">
                                {{ $subtitle }}
                            </p>
                        </td>
                    </tr>

                    {{-- BODY --}}
                    <tr>
                        <td style="padding:36px;">
                            <p style="margin:0 0 18px 0; font-size:15px; line-height:1.7; color:#374151;">
                                {{ $lang === 'en'
                                    ? 'Hi' . (!empty($user?->name) ? ' ' . e($user->name) : '') . ','
                                    : 'Hola' . (!empty($user?->name) ? ' ' . e($user->name) : '') . ',' }}
                            </p>

                            <p style="margin:0 0 24px 0; font-size:15px; line-height:1.7; color:#374151;">
                                {{ $lang === 'en'
                                    ? 'To finish creating your account, please confirm your email address by clicking the button below. This will activate your account and let you access all features.'
                                    : 'Per acabar de crear el teu compte, confirma el teu correu electrònic fent clic al botó de sota. Això activarà el teu compte i et permetrà accedir a totes les funcionalitats.' }}
                            </p>

                            {{-- CTA BOX --}}
                            <div style="margin:0 0 28px 0; padding:24px; border:1px solid #e5e7eb; background-color:#f9fafb; border-radius:22px;">
                                <p style="margin:0 0 16px 0; font-size:14px; font-weight:700; color:#111827;">
                                    {{ $lang === 'en' ? 'Verify your account' : 'Verifica el teu compte' }}
                                </p>

                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                    <tr>
                                        <td align="center" style="border-radius:999px; background-color:#111111;">
                                            <a href="{{ $verifyUrl }}"
                                               style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:999px;">
                                                {{ $buttonText }}
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <p style="margin:16px 0 0 0; font-size:13px; line-height:1.6; color:#6b7280;">
                                    {{ $lang === 'en'
                                        ? 'If the button does not work, use the manual link below.'
                                        : 'Si el botó no funciona, pots utilitzar l’enllaç manual de sota.' }}
                                </p>
                            </div>

                            {{-- FALLBACK LINK --}}
                            <div style="margin:0 0 22px 0; padding:18px; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:18px;">
                                <p style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:#111827;">
                                    {{ $fallbackText }}
                                </p>
                                <p style="margin:0; font-size:13px; line-height:1.7; color:#4b5563; word-break:break-all;">
                                    <a href="{{ $verifyUrl }}" style="color:#111111; text-decoration:underline;">
                                        {{ $verifyUrl }}
                                    </a>
                                </p>
                            </div>

                            {{-- INFO BOX --}}
                            <div style="margin:0 0 22px 0; padding:18px; background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:18px;">
                                <p style="margin:0 0 8px 0; font-size:13px; font-weight:700; color:#111827;">
                                    {{ $lang === 'en' ? 'Why are you receiving this email?' : 'Per què has rebut aquest correu?' }}
                                </p>
                                <p style="margin:0; font-size:13px; line-height:1.7; color:#6b7280;">
                                    {{ $lang === 'en'
                                        ? 'Because someone used this email address to create an account on Bambes.'
                                        : 'Perquè algú ha utilitzat aquesta adreça de correu per crear un compte a Bambes.' }}
                                </p>
                            </div>

                            <p style="margin:0; font-size:13px; line-height:1.7; color:#6b7280;">
                                {{ $ignoreText }}
                            </p>
                        </td>
                    </tr>

                    {{-- FOOTER --}}
                    <tr>
                        <td style="padding:22px 36px 32px 36px; border-top:1px solid #f3f4f6;">
                            <p style="margin:0; font-size:12px; line-height:1.7; color:#9ca3af;">
                                © {{ date('Y') }} Bambes
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>