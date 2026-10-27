import axios from 'axios';

async function main() {
  const token = '8890272332:AAHprBblI9WaahOIZrT23hJJZs1y1BFNohg';
  const me = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
  console.log('Bot Info:', me.data);

  const webhook = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  console.log('Webhook Info:', webhook.data);

  try {
    const chat = await axios.get(`https://api.telegram.org/bot${token}/getChat?chat_id=-5314819518`);
    console.log('Chat Info:', chat.data);
  } catch (err: any) {
    console.log('Chat Error:', err.response?.data || err.message);
  }

  // Also test sending to -5314819518
  try {
    const res = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: '-5314819518',
      text: '🔔 TEST ALERT: Intersys BMS Telegram Bot Connection Test at ' + new Date().toLocaleTimeString()
    });
    console.log('SendMessage to -5314819518 Result:', res.data);
  } catch (err: any) {
    console.error('SendMessage Error:', err.response?.data || err.message);
  }
}

main().catch(console.error);
