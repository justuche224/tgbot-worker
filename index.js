import 'dotenv/config'
import { Telegraf, Markup } from "telegraf";
import cron from 'node-cron';
import { message } from "telegraf/filters";
let ctx;
const problemResponse = {
    text: `
    <b>Experiencing an Issue?</b>

    We're sorry to hear you're facing a problem. Please describe the issue you're encountering in detail.

    Alternatively, you can contact our support team directly via email for assistance.
  `,
    extra: Markup.inlineKeyboard([
        [Markup.button.url('📧 Contact Us', 'https://ecohavest.org/contact')]
    ])
};
export const keywordResponses = {
    kyc: {
        text: `
<b>KYC Verification Guide</b>

1️⃣ Upload a clear photo of your ID (passport, driver's license)  
2️⃣ Provide proof of address (utility bill, bank statement)  
3️⃣ Allow up to 24 hours for review.
    `,
        extra: Markup.inlineKeyboard([
            [Markup.button.url('📄 KYC Docs', 'https://ecohavest.org/dashboard/account/kyc')],
            [Markup.button.callback('❓ Need Help?', 'kyc_help')]
        ])
    },
    signup: {
        text: `
<b>How to Sign Up</b>

• Go to ${Markup.button.url('Signup Page', 'https://ecohavest.org/signup')}  
• Fill in your details and verify your email  
• Start trading instantly!
    `
    },
    problem: problemResponse,
    issue: problemResponse,
    issues: problemResponse,
    trouble: problemResponse,
    other: problemResponse
};
// import { fetchCryptoData, formatCryptoMessage } from "./crypto.js";
import axios from 'axios';
const API_URL = 'https://api.coinranking.com/v2/coins?limit=10&timePeriod=3h';
/**
 * Fetches cryptocurrency data from the CoinRanking API.
 * @returns {Promise<CoinRankingApiResponse | null>} The API response data or null if an error occurs.
 */
export async function fetchCryptoData() {
    try {
        // API key if required by CoinRanking for production use
        // const response = await axios.get(API_URL, {
        //   headers: { 'x-access-token': 'YOUR_API_KEY' }
        // });
        const response = await axios.get(API_URL);
        if (response.data.status === 'success') {
            return response.data;
        }
        else {
            console.error('CoinRanking API returned status:', response.data.status);
            return null;
        }
    }
    catch (error) {
        console.error('Error fetching crypto data:', error instanceof Error ? error.message : error);
        return null;
    }
}
/**
 * Formats the cryptocurrency data into a human-readable string.
 * @param {CoinRankingApiResponse} data - The data fetched from the CoinRanking API.
 * @returns {string} A formatted string summarizing the top coins.
 */
export function formatCryptoMessage(data) {
    if (!data || data.status !== 'success' || !data.data?.coins?.length) {
        return 'Could not retrieve cryptocurrency data at this time.';
    }
    const topCoins = data.data.coins.slice(0, 10);
    let message = '<b>📊 Top 10 Crypto Updates (Last 3h):</b>\n\n';
    topCoins.forEach((coin) => {
        const price = parseFloat(coin.price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const change = parseFloat(coin.change);
        const changeSymbol = change > 0 ? '📈' : (change < 0 ? '📉' : '➡️');
        message += `<b>${coin.name} (${coin.symbol})</b>\n`;
        message += `  Price: ${price}\n`;
        message += `  Change: ${changeSymbol} ${change}%\n\n`; // Added newline for spacing
    });
    // Add market stats if needed
    const stats = data.data.stats;
    message += `\n<b>Market Stats:</b>\n`;
    message += `  Total Coins: ${stats.totalCoins.toLocaleString()}\n`;
    message += `  Total Market Cap: ${parseFloat(stats.totalMarketCap).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n`; // Note: API gives short string, this might not be accurate
    message += `  Total 24h Vol: ${parseFloat(stats.total24hVolume).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n`;
    return message;
}
const NEWS_API_KEY = process.env.NEWS_API_ORG_KEY;
const NEWS_API_URL = `https://newsapi.org/v2/everything?q=crypto&pageSize=10&apiKey=${NEWS_API_KEY}`;
/**
 * Fetches recent cryptocurrency news from the NewsAPI.
 * @returns {Promise<NewsApiResponse | null>} The API response data or null if an error occurs.
 */
export async function fetchCryptoNews() {
    if (!NEWS_API_KEY) {
        console.error('NewsAPI key is missing. Please set the NEWS_API_KEY environment variable.');
        return null;
    }
    try {
        const response = await axios.get(NEWS_API_URL);
        if (response.data.status === 'ok') {
            return response.data;
        }
        else {
            // Handle API-specific errors (e.g., invalid key)
            console.error(`NewsAPI returned status: ${response.data.status}`, response.data.message);
            return response.data; // Return the error response for potential handling
        }
    }
    catch (error) {
        console.error('Error fetching crypto news:', error instanceof Error ? error.message : error);
        // Check if it's an Axios error for more details
        if (axios.isAxiosError(error) && error.response) {
            console.error('NewsAPI error details:', error.response.data);
        }
        return null;
    }
}
/**
 * Formats the news articles into a human-readable string.
 * @param {NewsApiResponse} data - The data fetched from the NewsAPI.
 * @returns {string} A formatted string summarizing the top news articles.
 */
export function formatNewsMessage(data) {
    if (!data || data.status !== 'ok' || !data.articles?.length) {
        let errorMessage = 'Could not retrieve cryptocurrency news at this time.';
        if (data?.status === 'error') {
            errorMessage += ` (API Error: ${data.message || 'Unknown'})`;
        }
        return errorMessage;
    }
    let message = '<b>📰 Latest Crypto News:</b>\n\n';
    data.articles.forEach((article, index) => {
        message += `${index + 1}. <a href="${article.url}">${article.title}</a>\n`;
        message += `   <i>Source: ${article.source.name}</i>\n\n`;
    });
    return message;
}
const CHAT_ID = process.env.TARGET_CHAT_ID;
const bot_token = process.env.BOT_TOKEN;
const bot = new Telegraf(bot_token);

async function sendCryptoUpdates() {
    try {
        const [cryptoData, newsData] = await Promise.all([
            fetchCryptoData(),
            fetchCryptoNews()
        ]);
        const cryptoMessage = cryptoData
            ? formatCryptoMessage(cryptoData)
            : '⚠️ Failed to retrieve crypto prices.';
        const newsMessage = newsData
            ? formatNewsMessage(newsData)
            : '⚠️ Failed to retrieve crypto news.';
        const combinedMessage = `${cryptoMessage}\n\n${newsMessage}`;
        await bot.telegram.sendMessage(CHAT_ID, combinedMessage, {
            parse_mode: 'HTML'
        });
        console.log('✅ Crypto update sent via cron.');
    }
    catch (err) {
        console.error('❌ Error sending crypto update:', err);
    }
}
// ============================================================================
// Bot Configuration & Setup
// ============================================================================
const allCommands = [
    { command: 'help', description: 'Show this help message' },
    { command: 'faq', description: 'Frequently Asked Questions' },
    { command: 'crypto_updates', description: 'Get latest crypto prices & news' },
    { command: 'ban', description: 'Ban a user (admin only)' }, // TODO: Implement ban command
    { command: 'shutdown', description: 'Shutdown the bot (admin only)' }, // TODO: Implement shutdown command
];
bot.telegram.setMyCommands(allCommands);
// ============================================================================
// Middleware
// ============================================================================
// Response Time Logger
bot.use(async (ctx, next) => {
    const start = new Date().getTime();
    await next();
    const ms = new Date().getTime() - start;
    console.log('Response time: %sms', ms);
});
// Admin Check Middleware
const isAdmin = async (ctx, next) => {
    try {
        if (!ctx.from) {
            ctx.reply('Unable to verify user.');
            return;
        }
        const chatMember = await ctx.getChatMember(ctx.from.id);
        if (chatMember.status === 'administrator' || chatMember.status === 'creator') {
            return next();
        }
        else {
            ctx.reply('You are not authorized to use this command.');
        }
    }
    catch (error) {
        console.error('Error checking admin status:', error);
        ctx.reply('An error occurred while checking permissions.');
    }
};
// ============================================================================
// Command Handlers
// ============================================================================
bot.start(ctx => ctx.reply("HI from Ecohavest"));
bot.command('help', (ctx) => {
    let helpText = 'Available commands:\n';
    allCommands.forEach(cmd => {
        helpText += `/${cmd.command} - ${cmd.description}\n`;
    });
    ctx.reply(helpText);
});
bot.command('faq', (ctx) => {
    const faqText = `
<b>Frequently Asked Questions:</b>

<b>1. How can I make deals with Ecoharvest?</b>
   - To make a deal, you must first become a registered customer. Once you are signed up, you can make your first deposit. Alternatively, reach out to our customer service at <a href="mailto:support@ecohavest.org">support@ecohavest.org</a>.

<b>2. How can I apply for KYC Verification?</b>
   - Once verified, you'll access all Ecoharvest services. Verify your identity by uploading clear color copies (photo or scan) of:
     • <b>Proof of identity:</b> Passport, national ID card, or driving license (if it includes your address, additional proof might not be needed).
     • <b>Proof of address:</b> Bank/card statement or utility bill (e.g., water, gas, electric, internet, phone), residency certificate, or tenancy contract.

<b>3. Are there any withdrawal limits?</b>
   - You can request cryptocurrency withdrawals equivalent to at least 50 USD.

<b>4. How long does it take for my deposit to be added?</b>
   - Deposits are processed immediately.

<b>5. How does Ecoharvest thrive?</b>
   - Ecoharvest provides Solar Energy Solutions using automated elements, cryptocurrency trading, AI-based asset management, Blockchain technologies, and protocols for fast order delivery.
  `;
    ctx.replyWithHTML(faqText);
});
// Crypto Updates Command (Prices & News)
bot.command('crypto_updates', async (ctx) => {
    ctx.reply('Fetching latest crypto prices and news, please wait...');
    try {
        // Fetch data concurrently
        const [cryptoData, newsData] = await Promise.all([
            fetchCryptoData(),
            fetchCryptoNews()
        ]);
        let cryptoMessage = 'Could not retrieve crypto price data.';
        let newsMessage = 'Could not retrieve crypto news data.';
        if (cryptoData) {
            cryptoMessage = formatCryptoMessage(cryptoData);
        }
        else {
            console.error('Failed to get crypto data for combined message.');
        }
        // Check newsData structure carefully, including status
        if (newsData) {
            newsMessage = formatNewsMessage(newsData);
        }
        else {
            // This case handles network errors or missing API key for news
            newsMessage = 'Could not retrieve cryptocurrency news (check API key and network).';
            console.error('Failed to get news data for combined message (Network/Key Error).');
        }
        // Combine messages
        const combinedMessage = `${cryptoMessage}\n\n${newsMessage}`;
        ctx.replyWithHTML(combinedMessage);
    }
    catch (error) {
        console.error("Error fetching or sending crypto/news data:", error);
        ctx.reply('An error occurred while fetching crypto prices and news.');
    }
});
// TODO: Implement admin commands: ban, shutdown (using isAdmin middleware)
// ============================================================================
// Event Handlers
// ============================================================================
// Welcome New Members
bot.on(message('new_chat_members'), (ctx) => {
    const newcomers = ctx.message.new_chat_members;
    newcomers.forEach((member) => {
        ctx.replyWithHTML(`👋 Welcome, <b>${member.first_name}</b>!`);
        ctx.replyWithHTML(`Here's a quick intro to get started:\n\n` +
            `• Read the <a href="https://ecohavest.org/about">About Us</a>\n` +
            `• Drop a hello in #introductions\n` +
            `• Use /help for commands` +
            `• Use /faq for frequently asked questions`, Markup.inlineKeyboard([
                [Markup.button.url('📜 About Us', 'https://ecohavest.org/about')],
                [Markup.button.callback('💬 Introduce Me', 'start_intro')]
            ]));
    });
});
// Keyword Responder
bot.on(message('text'), (ctx, next) => {
    const incoming = ctx.message.text.toLowerCase();
    for (const [keyword, { text, extra }] of Object.entries(keywordResponses)) {
        if (incoming.includes(keyword)) {
            // Send a formatted reply with optional buttons
            return ctx.replyWithHTML(text, extra);
        }
    }
    // If no keyword matches, pass control to the next middleware/handler
    return next();
});
// bot.on('text', ctx => {
//   ctx.reply(`Chat ID is ${ctx.chat.id}`);
// });
// ============================================================================
// Action Handlers (Callback Queries)
// ============================================================================
bot.action('start_intro', (ctx) => {
    ctx.answerCbQuery();
    ctx.replyWithHTML(`Great! Please tell us a bit about yourself.<i> For example:</i>\n` +
        `"I'm Alex, I love automation and chess!"`);
});
bot.action('kyc_help', (ctx) => {
    ctx.answerCbQuery("Providing KYC help...");
    ctx.replyWithHTML(`<b>Need help with KYC?</b>\n\n` +
        `If you're having trouble with the KYC process, please:\n` +
        `• Ensure your documents are clear and valid.\n` +
        `• Check the <a href="https://ecohavest.org/faq">FAQ page</a> for common issues.\n` +
        `• Contact support at <a href="mailto:support@ecohavest.org">support@ecohavest.org</a> for direct assistance.`);
});
// ============================================================================
// Bot Launch & Error Handling
// ============================================================================
bot.launch({ polling: true, dropPendingUpdates: true })
console.log('Bot started in polling mode!')

cron.schedule('0 */3 * * *', sendCryptoUpdates, {
    timezone: 'Africa/Lagos'
});
// sendCryptoUpdates();
// Enable graceful stop
process.once('SIGINT', () => {
    console.log("SIGINT received, stopping bot...");
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    console.log("SIGTERM received, stopping bot...");
    bot.stop('SIGTERM');
});
// Optional: Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});
