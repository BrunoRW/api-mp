import { Preference, MercadoPagoConfig, Payment } from 'mercadopago';
import fetch from 'node-fetch';

import { v4 } from 'uuid';

import { push_line, push_client, get_lines, get_clients } from './process_payment.js';

let __SECRET__ = "chave_secreta_infity";

let recivedStatus = [];

let refundedItems = [];

let totalApproved = 0;
let totalPending = 0;
let totalCanceled = 0;
let totalRefunded = 0;

let now = () => {
    return new Date().getTime()
}

// GENERATE PAYMENT 

const generatePayment = async (req, res) => {
    let secret = req.body?.secret;
    let token = req.body?.token;
    let title = req.body?.title;
    let quantity = req.body?.quantity;
    let unit_price = req.body?.unit_price;
    let sandbox = req.body?.sandbox;
    let webhook_client = req.body?.webhook;
    let max_time = req.body?.max_time;

    let code = v4();

    if(!max_time){
        res.json({status: "error", reason: "max_time is necessary, ex: 60 (60 seconds)"});
        return;
    }

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

    let fee = unit_price / 10;

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
                marketplace_fee: fee,
                metadata: {
                    code: code,
                    max_time: (Number(max_time) * 1000) + now()
                }
            }
        });

        
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

    let token = data[0]?.token;

    if(!token){
        console.log("Falha ao pegar token, retornando.");        
        return;
    }

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
        let max_time = e.metadata.max_time;

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

        if(status == "approved" && Number(max_time) < now() && !refundedItems.includes(code)){
            console.log("\n\nGenerating refund...\n\n");
            setTimeout(() => {                
                fetch(`https://api.mercadopago.com/v1/payments/${pay_id}/refunds`, {
                    method: 'POST',
                    headers: {
                        'X-Idempotency-Key': `${code}`,
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                })
                .then(e => e.json())
                .then(e => {
                    refundedItems.push(code)
                    console.log("--- Item refunded ---")
                })
            },45000)            
            return;
        }

        let payData = recivedStatus[recivedStatus.length - 1];
        let payStatus = payData.status;

        if(payStatus == "approved"){
            totalApproved++;
        }

        if(payStatus == "canceled"){
            totalCanceled++;
        }

        if(payStatus == "refunded"){
            totalRefunded++;
        }

        if(payStatus == "pending"){
            totalPending++;
        }

        console.log('\n\n------ REC STATUS ------');
        console.log(`ID: ${recivedStatus[recivedStatus.length - 1].pay_id}, Status: ${payStatus}, Code: ${recivedStatus[recivedStatus.length - 1].code}`);
        console.log('------------------------');

        console.log('\n\n------ TOTAL STATUS ------');
        console.log(`Total Orders: ${totalPending}, Total Pending: ${totalPending - totalApproved - totalRefunded - totalCanceled}, Total Approved: ${totalApproved}, Total Refunded: ${totalRefunded}, Total Canceled: ${totalCanceled}`);
        console.log('------------------------------');
        let webh = data[0]?.webhook;

        if(!webh){
            console.log("Falha ao pegar webhook, retornando.");        
            return;
        }

        if(webh != "/"){
            fetch(webh, {
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
    let last = req.body?.last;

    let data = recivedStatus.filter(e=>{
        return e.code == code;
    })

    console.log('\n\n------ CHECK STATUS ------');
    console.log(data);
    console.log('--------------------------');

    if(last && data.length > 0){
        res.json(data[data.length - 1]);    
        return;
    }

    if(data.length == 0){
        res.json({});
        return;
    }

    res.json(data);
}

export { 
    generatePayment,
    checkPaymentStatusWEB,
    checkPayment
};
