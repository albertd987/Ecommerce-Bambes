<?php

namespace Tests\Feature\Chatbot;

use App\Services\ChatbotTools;
use Tests\TestCase;

class ChatbotToolWhitelistTest extends TestCase
{
    /** @test */
    public function backoffice_chatbot_has_access_to_all_tools(): void
    {
        $tools = ChatbotTools::getToolDefinitions();
        $names = array_column($tools, 'name');

        $this->assertContains('get_total_revenue', $names);
        $this->assertContains('get_top_selling_products', $names);
        $this->assertContains('highlight_element', $names);
    }

    /** @test */
    public function public_chatbot_only_exposes_highlight_element(): void
    {
        $tools = ChatbotTools::getToolDefinitions(['highlight_element']);
        $names = array_column($tools, 'name');

        $this->assertEquals(['highlight_element'], $names);
        $this->assertNotContains('get_total_revenue', $names);
        $this->assertNotContains('get_recent_orders', $names);
        $this->assertNotContains('get_customer_count', $names);
    }
}
