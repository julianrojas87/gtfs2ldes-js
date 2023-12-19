# Start from a Node.js ready container
FROM node:18
# Set working directory in the container
WORKDIR /opt/gtfs2ldes
# Copy source files
COPY . .
## Install dependencies
ENV NODE_ENV production
RUN npm ci --omit=dev
# Install envsub to parse environment variables
RUN npm install -g envsub
# Set output volume path
VOLUME [ "/data" ]
# Setup container's entrypoint script
RUN chmod +x run.sh 
ENTRYPOINT [ "./run.sh" ]