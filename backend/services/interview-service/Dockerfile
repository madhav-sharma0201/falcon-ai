FROM node

WORKDIR /app


COPY package*.json ./
RUN npm install

COPY ./services/interview-service/package*.json ./services/interview-service/
RUN cd services/interview-service && npm install

COPY services/interview-service ./services/interview-service
COPY shared ./shared

WORKDIR /app/services/interview-service

EXPOSE 8002

CMD [ "npm","start" ]