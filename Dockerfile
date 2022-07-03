FROM node:14-alpine

WORKDIR /app

RUN npm install -g nodemon

COPY package.json .

RUN npm install

RUN npm uninstall dotenv

RUN npm install dotenv --save

COPY . .

EXPOSE 3030

CMD [ "npm", "run", "dev"]