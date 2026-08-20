FROM node

WORKDIR /app


COPY package*.json ./
RUN npm install

COPY ./services/billing-service/package*.json ./services/billing-service/
RUN cd services/billing-service && npm install

COPY services/billing-service ./services/billing-service
COPY shared ./shared

WORKDIR /app/services/billing-service

EXPOSE 8005

CMD [ "npm","start" ]
