import { configureStore } from "@reduxjs/toolkit";


import resumeSlice from "./resumeSlice.js"


const store = configureStore({
  reducer: {
    resume: resumeSlice,
    
  },
});

export default store;

