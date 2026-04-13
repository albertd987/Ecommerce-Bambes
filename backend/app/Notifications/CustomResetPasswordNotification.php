<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class CustomResetPasswordNotification extends Notification
{
    use Queueable;

    public string $token;
    public string $lang;

    public function __construct(string $token, string $lang = 'ca')
    {
        $this->token = $token;
        $this->lang = str_starts_with(strtolower($lang), 'en') ? 'en' : 'ca';
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontendUrl = config('app.frontend_url', 'http://localhost:5173');

        $resetUrl = $frontendUrl . '/reset-password?token=' . urlencode($this->token) . '&email=' . urlencode($notifiable->email) . '&lang=' . $this->lang;

        return (new MailMessage)
            ->subject(
                $this->lang === 'en'
                    ? 'Password reset - Bambes'
                    : 'Recuperació de contrasenya - Bambes'
            )
            ->view('emails.reset-password', [
                'resetUrl' => $resetUrl,
                'user' => $notifiable,
                'lang' => $this->lang,
            ]);
    }
}