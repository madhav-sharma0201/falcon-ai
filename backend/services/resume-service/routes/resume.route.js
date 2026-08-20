import express from "express";
import upload from "../configs/multer.js";
import { getResume, uploadResume } from "../controllers/resume.controller.js";



const resumeRouter = express.Router();

resumeRouter.post(
  "/upload",
  upload.single("resume"),
  uploadResume
);
resumeRouter.get("/get-resume",getResume)
export default resumeRouter;