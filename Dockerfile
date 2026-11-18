FROM node:14-alpine

WORKDIR /app

# Build arg
ARG ENV_FILE=.env.stationary

# MongoDB Database Tools (mongodump / mongorestore) for Config > Data backup,
# restore and reset. node:14-alpine's own Alpine (3.17) only has the 4.2 tools,
# too old for current MongoDB; Alpine 3.22's 100.12 tools support MongoDB up to
# 8.0 and install here without changing the system libraries.
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/v3.22/community "mongodb-tools~100.12" \
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
