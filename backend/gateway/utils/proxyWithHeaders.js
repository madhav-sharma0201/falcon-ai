import proxy from "express-http-proxy";

export const proxyWithUser =
(serviceUrl)=>{

 return proxy(
  serviceUrl,
  {
   proxyReqPathResolver: (req) => req.url,
   proxyReqOptDecorator:
   (proxyReqOpts, srcReq)=>{

    if(srcReq.user){

      proxyReqOpts.headers[
       "x-user-id"
      ] =
      srcReq.user.userId;

    }

    return proxyReqOpts;

   }

  }
 );

}