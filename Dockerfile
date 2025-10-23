FROM node:24.8.0-alpine
WORKDIR /usr/src/app
COPY package.json yarn.lock .
RUN yarn install
COPY . .

EXPOSE 8081
CMD ["yarn", "start"]