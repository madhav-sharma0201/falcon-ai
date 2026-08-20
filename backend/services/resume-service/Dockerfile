FROM node

WORKDIR /app


COPY package*.json ./
RUN npm install

COPY ./services/resume-service/package*.json ./services/resume-service/
RUN cd services/resume-service && npm install

COPY services/resume-service ./services/resume-service
COPY shared ./shared

WORKDIR /app/services/resume-service

EXPOSE 8003

CMD [ "npm","start" ]