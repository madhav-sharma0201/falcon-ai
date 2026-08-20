import axios from "axios";
import api from "../utils/axios";



// ---------------------------------------
// Start Interview
// ---------------------------------------

// Resolves to the server payload on both success and failure, so callers can
// show the real reason ("Interview type and role are required") instead of a
// generic message. Returns null only if the request never reached the server.
export const startInterview = async (data) => {

  try {
    const response = await api.post(`/api/interview/start`,data);

  return response.data;
  } catch (error) {
    console.log(error)

    return error.response?.data ?? null
  }



};


// ---------------------------------------
// Submit Answer
// ---------------------------------------

export const submitAnswer = async (data) => {

  try {
    const response = await api.post(`/api/interview/answer`,data);

  return response.data;
  } catch (error) {
    console.log(error)
    return null
  }

  

};


// ---------------------------------------
// Get Single Interview
// ---------------------------------------

export const getInterview = async (id) => {


  try {
    const response = await api.get(`/api/interview/${id}`);

  return response.data;
    
  } catch (error) {
    console.log(error)
    return null
  }

  

};


// ---------------------------------------
// Get All Interviews
// ---------------------------------------

export const getAllInterviews = async () => {

  try {
    const response = await api.get(`/api/interview/all`);

  return response.data;

  } catch (error) {
    console.log(error)
    return null
  }

  

};

// ---------------------------------------
// Run Code (server-side sandbox)
// ---------------------------------------

export const executeCode = async (data) => {

  try {
    const response = await api.post(`/api/interview/execute`, data);

    return response.data;

  } catch (error) {
    console.log(error)

    return error.response?.data ?? null
  }

};
