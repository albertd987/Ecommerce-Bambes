<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

class CustomVerifyEmail extends VerifyEmail
{
    protected string $verifyUrl;
    protected string $lang;

    public function __construct(string $verifyUrl, string $lang = 'ca')
    {
        $this->verifyUrl = $verifyUrl;
        $this->lang = in_array($lang, ['ca', 'en']) ? $lang : 'ca';
    }

    public function toMail($notifiable): MailMessage
    {
        $isEn = $this->lang === 'en';

        return (new MailMessage)
            ->subject($isEn ? 'Verify your email address' : 'Verifica el teu correu electrònic')
            ->view('emails.verify-email', [
                'verifyUrl' => $this->verifyUrl,
                'user' => $notifiable,
                'lang' => $this->lang,
                'logoUrl' => asset('images/logo.png'),
                'title' => $isEn
                    ? 'Verify your email address'
                    : 'Verifica el teu correu electrònic',
                'subtitle' => $isEn
                    ? 'Welcome to Bambes. Confirm your email to activate your account and start shopping.'
                    : 'Benvingut/da a Bambes. Confirma el teu correu per activar el teu compte i començar a comprar.',
                'buttonText' => $isEn
                    ? 'Verify email'
                    : 'Verificar correu',
                'fallbackText' => $isEn
                    ? 'If the button does not work, copy and paste this link into your browser:'
                    : 'Si el botó no funciona, copia i enganxa aquest enllaç al navegador:',
                'ignoreText' => $isEn
                    ? 'If you did not create this account, you can ignore this email.'
                    : 'Si no has creat aquest compte, pots ignorar aquest correu.',
            ]);
    }
}