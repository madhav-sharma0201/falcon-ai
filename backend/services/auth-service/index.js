import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { connectDb } from "./configs/db.js";
import dns from 'dns'
import authRouter from "./routes/auth.route.js";
dotenv.config();
// Try the machine's own resolvers first, then fall back to public DNS.
// Replacing them outright breaks MongoDB Atlas SRV lookups on networks that
// block outbound DNS to 1.1.1.1 / 8.8.8.8 (common on campus and office wifi).
dns.setServers([...dns.getServers(), '1.1.1.1', '8.8.8.8'])

const app = express();

app.use(express.json());

app.use(cookieParser());

const PORT = process.env.PORT || 6001

app.use("/",authRouter);



app.listen(PORT,() => {
    console.log( `Auth Service Running`);
    connectDb()
  }
);