<!DOCTYPE html>
<html lang="ca">
<head>
    <meta charset="UTF-8">
    <title>Recuperar contrasenya</title>
</head>
<body style="font-family: Arial, sans-serif; background:#f9fafb; padding:20px;">

    <div style="max-width:600px; margin:auto; background:white; border-radius:12px; padding:24px; border:1px solid #e5e7eb;">

        <h2>
    {{ $lang === 'en' ? '🔐 Password reset' : '🔐 Recuperació de contrasenya' }}
</h2>

<p>
    {{ $lang === 'en'
        ? 'You requested to reset your password.'
        : 'Has sol·licitat restablir la teva contrasenya.' }}
</p>

<a href="{{ $resetUrl }}">
    {{ $lang === 'en'
        ? 'Reset password'
        : 'Restablir contrasenya' }}
</a>

<p>
    {{ $lang === 'en'
        ? 'If you did not request this, you can ignore this email.'
        : 'Si no has fet aquesta sol·licitud, pots ignorar aquest correu.' }}
</p>

        <hr style="margin:24px 0; border:none; border-top:1px solid #e5e7eb;">

        <p style="font-size:12px; color:#9ca3af;">
            © Bambes
        </p>
    </div>

</body>
</html>