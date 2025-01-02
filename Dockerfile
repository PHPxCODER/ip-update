FROM node:slim

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json /app
RUN npm install

# Copy source code
COPY . /app

# Build the TypeScript files
RUN npm run build

# Command to start the application
CMD ["node", "dist/index.js"]
