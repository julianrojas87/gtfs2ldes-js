# Start from a Node.js ready container
FROM node:18
# Set working directory in the container
WORKDIR /opt/gtfs2ldes
# Copy source files
COPY . .
ENV NODE_ENV production
# Extend timeout for package installation
RUN npm config set fetch-retries 5
RUN npm config set fetch-retry-mintimeout 100000
RUN npm config set fetch-retry-maxtimeout 600000
## Install dependencies
RUN npm ci --omit=dev
# Install envsub to parse environment variables
RUN npm install -g envsub
# Set output volume path
VOLUME [ "/data" ]
# Setup container's entrypoint script
RUN chmod +x run.sh 
ENTRYPOINT [ "./run.sh" ]