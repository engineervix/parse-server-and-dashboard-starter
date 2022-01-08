FROM node:14.18.2-buster

RUN mkdir -p /usr/src/node-app && chown -R node:node /usr/src/node-app

WORKDIR /usr/src/node-app

RUN npm install -g parse-dashboard

COPY package.json ./
COPY package-lock.json ./

USER node

RUN npm install

COPY --chown=node:node . .

ENV PATH ./node_modules/.bin:$PATH
