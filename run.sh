#!/bin/bash

# Replace config environment variables
envsub config.json

# Execute main process
node ./bin/gtfs2ldes.js