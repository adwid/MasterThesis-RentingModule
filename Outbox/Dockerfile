FROM node:latest

# Create app directory
WORKDIR /app/src/

# install app dependencies
COPY package*.json /app/src/

RUN npm install

COPY . /app/src/

EXPOSE 3000

CMD ["npm", "start"]
