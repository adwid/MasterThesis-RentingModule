FROM node:latest

# Create app directory
WORKDIR /app/src/

# install app dependencies
COPY package*.json /app/src/

RUN npm install

COPY . /app/src/

EXPOSE ${HOST_PORT} ${HOST_PORT}

CMD ["npm", "start"]
