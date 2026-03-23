<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class OrderConfirmationMail extends Mailable
{
    public array $order;
    public string $pdfPath;
    public string $lang;

    public function __construct(array $order, string $pdfPath, string $lang = 'ca')
    {
        $this->order = $order;
        $this->pdfPath = $pdfPath;
        $this->lang = str_starts_with(strtolower($lang), 'en') ? 'en' : 'ca';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->lang === 'en'
                ? 'Order confirmation - Bambes'
                : 'Confirmació de compra - Bambes',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.order-confirmation',
            with: [
                'order' => $this->order,
                'lang' => $this->lang,
            ],
        );
    }

    public function attachments(): array
    {
        return [
            Attachment::fromPath($this->pdfPath)
                ->as(
                    $this->lang === 'en'
                        ? 'invoice-' . $this->order['id'] . '.pdf'
                        : 'factura-' . $this->order['id'] . '.pdf'
                )
                ->withMime('application/pdf'),
        ];
    }
}