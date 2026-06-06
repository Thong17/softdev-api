FROM node:14-alpine

WORKDIR /app

# Build arg
ARG ENV_FILE=.env.janyard

COPY package.json .
COPY package-lock.json .

RUN npm install

COPY . .

# Copy selected env file as .env
COPY ${ENV_FILE} .env

EXPOSE 3030

CMD ["npm", "start"]