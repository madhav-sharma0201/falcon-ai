FROM node

WORKDIR /app


COPY package*.json ./
RUN npm install

COPY ./services/auth-service/package*.json ./services/auth-service/
RUN cd services/auth-service && npm install

COPY services/auth-service ./services/auth-service
COPY shared ./shared

WORKDIR /app/services/auth-service

EXPOSE 8001

CMD [ "npm","start" ]
