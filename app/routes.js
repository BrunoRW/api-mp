import { Router } from 'express';
import {generatePayment, checkPaymentStatusWEB, checkPayment} from './services.js';

const routes = Router();

// GET 
routes.get('/', (req, res) => {
    console.log("ping");   
    res.json({ text: "inded" });
});

routes.post('/v1/payment_link', generatePayment);

routes.post('/v1/webhook', checkPaymentStatusWEB);

routes.post('/v1/check', checkPayment);


routes.post("/recive", (req, res) =>{
    console.log('\n\n====================================');
    console.log("RECIVE FINAL");
    console.log(req.body);
    console.log('====================================\n\n');
    res.json(req.body)
})

routes.post('/encrypt', (req, res) => {
    let data = req.body.quantity;
    res.json({ text: "inded" });
});

export default routes;
