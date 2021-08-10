require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const {TOKEN, SERVER_URL} = process.env;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const COWIN_APPOINTMENT_API = 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public';
const COWIN_AUTH_API = "https://cdn-api.co-vin.in/api/v2/auth/public"
const URI = `/webhook/${TOKEN}`;
const WEBHOOK_URL = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

const init = async () => {
    let res = await axios.get(`${TELEGRAM_API}/deleteWebhook?drop_pending_updates=True`);
    console.log(res.data);
    res = await axios.get(`${TELEGRAM_API}/setWebHook?url=${WEBHOOK_URL}`);
    console.log(res.data);
};

app.get("/", (req, res) => {
    res.send('Welcome to the Vaccine Slot Checker Service');
});

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
                    text: 'Hi @' + message.chat.username + ', Hope you\'re ready to get vaccinated! Let\'s find you a free slot. To search for a slot, type the command /search along with your PIN Code. Type /help for more information.'
                };
                await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
            } else if (cmd === '/help') {
                const reply = {
                    chat_id: message.chat.id,
                    text: 'For checking free slots, type /search along with your PIN Code (e.g: /search 123456)'
                };
                await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
            } else if (cmd === '/search') {
                const query = message.text.substr(text.length + 1);
                const pincode = query.split(' ')[0];
                if (isNaN(pincode) || pincode.length !== 6) {
                    const reply = {
                        chat_id: message.chat.id,
                        text: 'Please enter a valid PIN Code along with the command (e.g: /search 123456)'
                    };
                    await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
                } else {
                    //API call to cowin
                    let oDate = new Date();
                    let sDate = (((oDate.getDate() > 9) ? oDate.getDate() : ('0' + oDate.getDate())) + '-' + ((oDate.getMonth() > 8) ? (oDate.getMonth() + 1) : ('0' + (oDate.getMonth() + 1))) + '-' + oDate.getFullYear());
                    const res = await axios.get(`${COWIN_APPOINTMENT_API}/calendarByPin?pincode=${pincode}&date=${sDate}`);
                    
                    let centers = res.data.centers;
                    if (!centers.length) {
                        const reply = {
                            chat_id: message.chat.id,
                            text: 'Sorry, no free centers for the next 7 days'
                        };
                        await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
                    } else {
                        let sParsedText = '', reply = {};

                        let oPromise = centers.reduce(async (oPromise, center) => {
                            await oPromise;
                            let sessions = center.sessions;

                            let oInnerPromise = sessions.reduce(async (oPromise, session) => {
                                await oPromise;

                                if (session.available_capacity) {
                                    sParsedText += `Date: *${session.date.split('-').join('\\-')}*\nVaccine: *${session.vaccine}*\nCentre Name: *${center.name}*\nAge Group: *${session.min_age_limit}\\+*\n`;
                                    sParsedText += center.fee_type === "Paid" ? `Cost: *₹${center.vaccine_fees.filter(vaccine => vaccine.vaccine === session.vaccine)[0].fee}*\n\n` : `Cost: *Free*\n\n`;

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
                                    let data = await axios.post(`${TELEGRAM_API}/sendMessage`, reply);
                                    sParsedText = '';
                                    return data;
                                }
                            }, Promise.resolve());

                            await oInnerPromise;
                            sParsedText = '';

                        }, Promise.resolve());

                        await oPromise;
                    }
                }
            } else if (cmd === '/download') {
                //TODO: download certificate code
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