FROM node:20-alpine

ARG API_PORT
ENV API_PORT=${API_PORT}

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
