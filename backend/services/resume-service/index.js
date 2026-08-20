import express from 'express'
import dotenv from "dotenv"
dotenv.config()
import dns from "dns"
import { connectDb } from './configs/db.js'
import resumeRouter from './routes/resume.route.js'
// Try the machine's own resolvers first, then fall back to public DNS.
// Replacing them outright breaks MongoDB Atlas SRV lookups on networks that
// block outbound DNS to 1.1.1.1 / 8.8.8.8 (common on campus and office wifi).
dns.setServers([...dns.getServers(), '1.1.1.1', '8.8.8.8'])
const app = express()
app.use(express.json());




const PORT = process.env.PORT || 6003

app.get("/", (req,res)=>{
    return res.send(`hello from resume-server `)

})
app.use("/",resumeRouter)

app.listen(PORT,()=>{
    console.log(`Resume Service Started on ${PORT}`)
    connectDb()
   
})

