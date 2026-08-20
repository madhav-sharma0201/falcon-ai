import api from "../utils/axios";




  export  const getCurrentUser = async () => {

      try {

        const response = await api.get(
          "/api/me" 
        );

        return response.data

      } catch (error) {

       
        console.log(
          error.response?.data ||
          error.message
        );
        return null
    };}


    // Resolves to the server payload on both success and failure, so callers can
    // read the real balance and message. Returns null only if the request never
    // reached the server. Check `success` before using the result.
    export const useCoins = async (data) => {
        try {
             const response = await api.post(
          "/api/auth/use-interview-coins",data)

          return response.data
        } catch (error) {
            console.log(
          error.response?.data ||
          error.message
        );
        return error.response?.data ?? null
        }
    }
