import express from "express";

import { getAllInterviews, getInterview, runCode, startInterview, submitAnswer } from "../controllers/interview.controller.js";



const interviewRouter = express.Router();

interviewRouter.post("/start",startInterview);

interviewRouter.post("/answer",submitAnswer);

interviewRouter.post("/execute", runCode);

interviewRouter.get("/all",getAllInterviews);

interviewRouter.get("/:id",getInterview);

export default interviewRouter;