import axios from "axios";
import api from "../utils/axios";


export const getResume = async () => {
  try {
    const response = await api.get("/api/resume/get-resume");
  return response.data;
  } catch (error) {
    console.log(error)
    return null
  }

  
};