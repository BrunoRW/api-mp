import { config } from 'dotenv';
import express from 'express';
import routes from './app/routes.js';
import cors from "cors"

config();

const app = express();
const port = 3030;

app.use(cors({
    origin: '*'
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(routes);

// const handler = ServerlessHttp(app);

app.listen(port, () => {
    console.log(`\n\n\n➔ Server is running at port: ${port} 🚀\n\n\n`);
});

