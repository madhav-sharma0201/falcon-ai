FROM node

WORKDIR /app


COPY package*.json ./
RUN npm install

COPY ./services/roadmap-service/package*.json ./services/roadmap-service/
RUN cd services/roadmap-service && npm install

COPY services/roadmap-service ./services/roadmap-service
COPY shared ./shared

WORKDIR /app/services/roadmap-service

EXPOSE 8004

CMD [ "npm","start" ]