FROM node:24-alpine

WORKDIR /app

# Build arg
ARG ENV_FILE=.env.stationary

# MongoDB Database Tools (mongodump / mongorestore) for Config > Data backup,
# restore and reset, from the image's own Alpine (100.14, current MongoDB)
RUN apk add --no-cache mongodb-tools \
 && mongodump --version | head -1

COPY package.json .
COPY package-lock.json .

RUN npm install

COPY . .

# Copy selected env file as .env
COPY ${ENV_FILE} .env

# Backups (Config > Data) are written here; mount a volume on it to keep them
VOLUME /app/backups

EXPOSE 3030

CMD ["npm", "start"]
