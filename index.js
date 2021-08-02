require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const {TOKEN, SERVER_URL} = process.env;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;
const WEBHOOK_URL = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

const init = async () => {
    const res = await axios.get(`${TELEGRAM_API}/setWebHook?url=${WEBHOOK_URL}`);
    console.log(res.data);
};

app.post(URI, async (req, res) => {
    if (!req.body)  return res.send();
    const message = req.body.message;

    if (message.entities) {
        const {type, offset, length} = message.entities[0];
        if (type === 'bot_command') {
            const text = message.text.substr(offset, length);
            const cmd = text.split(' ')[0];
            if (cmd === '/start') {
                const reply = {
                    chat_id: message.chat.id,
                    text: 'Hi @' + message.chat.username + ', Hope you\'re ready to get vaccinated! Let\'s find you a free slot. To search for a slot, type the command /search and enter your PIN Code. Type /help if you have additional queries!'
                };
                const result = await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
            } else if (cmd === '/help') {
                const reply = {
                    chat_id: message.chat.id,
                    text: 'For checking free slots, type /search and enter your PIN Code'
                };
                const result = await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
            } else if (cmd === '/search') {
                const query = message.text.substr(text.length + 1);
                const pincode = query.split(' ')[0];
                console.log(pincode);
            } else {
                const reply = {
                    chat_id: message.chat.id,
                    text: 'Sorry, I didn\'t understand that. Type /help for more information'
                };
                const result = await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
            }
        }
    }
    res.send();
});

app.listen(process.env.PORT || 5000, async () => {
    console.log(`Server started on port ${process.env.PORT || 5000}`);
    await init();
});