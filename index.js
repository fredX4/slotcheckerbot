require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const {TOKEN, SERVER_URL} = process.env;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const COWIN_API = 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public';
const URI = `/webhook/${TOKEN}`;
const WEBHOOK_URL = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

const init = async () => {
    const res = await axios.get(`${TELEGRAM_API}/setWebHook?url=${WEBHOOK_URL}`);
    console.log(res.data);
};

app.post(URI, async (req, res) => {
    if (!(req.body && req.body.message))  return res.send();
    
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
                await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
            } else if (cmd === '/help') {
                const reply = {
                    chat_id: message.chat.id,
                    text: 'For checking free slots, type /search and enter your PIN Code'
                };
                await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
            } else if (cmd === '/search') {
                const query = message.text.substr(text.length + 1);
                const pincode = query.split(' ')[0];
                if (isNaN(pincode) || pincode.length !== 6) {
                    const reply = {
                        chat_id: message.chat.id,
                        text: 'Please enter a valid 6 digit PIN Code'
                    };
                    await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
                } else {
                    //API call to cowin
                    let oDate = new Date();
                    let sDate = (((oDate.getDate() > 9) ? oDate.getDate() : ('0' + oDate.getDate())) + '-' + ((oDate.getMonth() > 8) ? (oDate.getMonth() + 1) : ('0' + (oDate.getMonth() + 1))) + '-' + oDate.getFullYear());
                    const res = await axios.get(`${COWIN_API}/findByPin?pincode=${pincode}&date=${sDate}`);
                    
                    let sessions = res.data.sessions;
                    if (!sessions.length) {
                        const reply = {
                            chat_id: message.chat.id,
                            text: 'Sorry, no slots available for today'
                        };
                        await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
                    } else {
                        let sParsedText = '', reply = {};
                        sessions = sessions.filter(session => {
                            return session.available_capacity;
                        });

                        if (sessions.length) {
                            sessions.forEach(session => {
                                if (session.available_capacity) {
                                    sParsedText += `Vaccine: *${session.vaccine}*\nCentre Name: *${session.name}*\nAge Group: *${session.min_age_limit}*\n`;
    
                                    sParsedText += parseInt(session.fee) ? `Cost: *₹${session.fee}*\n` : `Cost: *Free*\n`;
                                
                                    if (session.available_capacity_dose1) {
                                        sParsedText += `Dose 1 slots: *${session.available_capacity_dose1}*\n`;
                                    }
                                    if (session.available_capacity_dose2) {
                                        sParsedText += `Dose 2 slots: *${session.available_capacity_dose2}*\n`;
                                    }
                                    reply = {
                                        chat_id: message.chat.id,
                                        parse_mode: 'MarkdownV2',
                                        text: sParsedText,
                                        reply_markup: {
                                            inline_keyboard: [
                                                [
                                                    {
                                                        text: 'Book Now!',
                                                        url: `https://selfregistration.cowin.gov.in/`
                                                    }
                                                ]
                                            ]
                                        }
                                    };
                                    axios.post(`${TELEGRAM_API}/sendMessage`, reply);
                                    sParsedText = '';
                                }
                            });
                        } else {
                            reply = {
                                chat_id: message.chat.id,
                                text: 'Sorry, no slots available for today'
                            };
                            await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
                        }
                    }
                }
            } else {
                const reply = {
                    chat_id: message.chat.id,
                    text: 'Sorry, I didn\'t understand that. Type /help for more information'
                };
                await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
            }
        }
    } else {
        const reply = {
            chat_id: message.chat.id,
            text: 'Sorry, I didn\'t understand that. Type /help for more information'
        };
        await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
    }
    res.send();
});

app.listen(process.env.PORT || 5000, async () => {
    console.log(`Server started on port ${process.env.PORT || 5000}`);
    await init();
});