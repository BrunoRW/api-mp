import { Preference, MercadoPagoConfig, Payment } from 'mercadopago';
import fetch from 'node-fetch';

import { v4 } from 'uuid';

import { push_line, push_client, get_lines, get_clients } from './process_payment.js';

let __SECRET__ = "chave_secreta_infity";

let recivedStatus = [];

let maxTimePay = 10 * 1000;

let now = () => {
    return new Date().getTime()
}

// GENERATE PAYMENT 

const generatePayment = async (req, res) => {
    let secret = req.body.secret;
    let token = req.body.token;
    let title = req.body.title;
    let quantity = req.body.quantity;
    let unit_price = req.body.unit_price;
    let sandbox = req.body.sandbox;
    let webhook_client = req.body.webhook;

    console.log(req.body)

    let code = v4();

    if(!token){
        res.json({status: "error", reason: "token is necessary"});
        return;
    }

    if(!title){
        res.json({status: "error", reason: "title is necessary"});
        return;
    }

    if(!quantity){
        res.json({status: "error", reason: "quantity is necessary"});
        return;
    }

    if(!unit_price){
        res.json({status: "error", reason: "unit_price is necessary"});
        return;
    }

    if(!webhook_client){
        res.json({status: "error", reason: "webhook is necessary"});
        return;
    }

    if(secret !== __SECRET__){
        res.json({status: "error", reason: "secret is incorrect"});
        return;
    }
    
    const client = new MercadoPagoConfig({ 
        accessToken: token
    });

    const preference = new Preference(client);

    try {
        const data = await preference.create({
            body: {
                items: [
                    {
                        "title": title,
                        "quantity": quantity,
                        "unit_price": unit_price,
                    }
                ],
                metadata: {
                    code: code,
                    time: now()
                }
            }
        });

        const transactionId = data.id; // Salvar o ID da transação
        
        let link = data.init_point;

        if(sandbox){
            link = data.sandbox_init_point;
        } 

        res.json({status: "success", payment_link: link, order_id: code});

        // insert data to process line {id, webhook}
        push_line(webhook_client, code)
        push_client(token, data.collector_id, code, "")

        return;

    } catch (err) {
        res.json({status: "error", reason: "Failed to generate payment link"});
    }
}

// Função para verificar o status da transação
const checkPaymentStatusWEB = async (req, res) => {
    let pay_id = req.body.data.id;
    let collector = req.body.user_id;

    let array_data = get_clients();

    let data = array_data.filter(e=>{
        return e.collector == collector;
    })

    console.log('============= DATA =================');
    console.log(array_data, collector);
    console.log('====================================');

    let token = data[0].token;

    const url = `https://api.mercadopago.com/v1/payments/${pay_id}`;
    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    }

    await fetch(url, options)
    .then(e=>e.json())
    .then(e=>{
        let status = e.status;
        let code = e.metadata.code;
        let timeGenerate = e.metadata.time;

        let array_data = get_lines();

        let data = array_data.filter(e=>{
            return e.code === code;
        })

        let dataReturn = {
            code: code,
            status: status,
            pay_id: pay_id,
            data: now()
        };

        recivedStatus.push(dataReturn)

        if(status == "approved" && timeGenerate + maxTimePay < time()){
            fetch(`https://api.mercadopago.com/v1/payments/${pay_id}/refunds`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            return;
        }

        console.log('------ RECIVED STATUS ------');
        console.log(recivedStatus);
        console.log('-------------------------');

        if(data[0].webhook != "/"){
            fetch(data[0].webhook, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataReturn)
            })
        }
        
    })

    res.json({})
}

const checkPayment = async (req, res) => {
    let code = req.body.code;

    let data = recivedStatus.filter(e=>{
        return e.code == code;
    })

    console.log('------ CHECK STATUS ------');
    console.log(data);
    console.log('--------------------------');

    res.json(data);    
}



export { 
    generatePayment,
    checkPaymentStatusWEB,
    checkPayment
};
