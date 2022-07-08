import fs from "fs";
import GTFSRT2LC from "gtfsrt2lc";
import { RDFFormatter } from "./RDFFormatter.js";
import Utils from "./Utils.js";

const { GtfsIndex, Gtfsrt2LC } = GTFSRT2LC;

export const buildIndexes = async config => {
    const staticDataPath = config["general"].data_folder;
    if (fs.existsSync(`${staticDataPath}/trips.txt`)) {
        return await new GtfsIndex({ path: staticDataPath }).getIndexes({ store: "LevelStore" });
    } else {
        return null;
    }
}

export const processGTFSRealtime = async (config, indexes) => {
    console.log('/-----------------------------------------------/');
    console.log('Starting processing of GTFS-realtime update');
    const timestamp = new Date();
    const source = config["gtfs_realtime"].source;
    const templates = config["uri_templates"];
    const headers = config["gtfs_realtime"].auth_headers;
    const jsonldContext = config["@context"];
    const target = config["general"].target_url;
    const throttleRate = parseInt(config["general"].throttle_rate);

    // Create new parser instance
    const rtParser = new Gtfsrt2LC({
        path: source,
        uris: templates,
        headers
    });
    // Set required indexes for parsing the data
    rtParser.setIndexes(indexes);
    // Parse realtime update
    const connStream = (await rtParser.parse({ format: "jsonld", objectMode: true }))
        .pipe(RDFFormatter(jsonldContext, timestamp.toISOString()));

    // POST every connection to the LDES Server ingestion endpoint
    let count = 0;
    let failed = 0;
    // Throttle HTTP requests to avoid timeouts
    let chunk = [];
    for await (const conn of connStream) {
        try {
            count++;
            chunk.push(conn);
            if (chunk.length % throttleRate === 0) {
                // Send chunks of HTTP requests "simultaneously" 
                await Promise.all(chunk.map(async c => {
                    await Utils.postConnection(c, target);
                }));
                console.log(`Posted ${count} Connection updates so far...`);
                chunk = [];
            }
        } catch (err) {
            failed++
            console.error(err);
        }
    }
    // Post remaining Connections
    await Promise.all(chunk.map(async c => {
        await Utils.postConnection(c, target);
    }));

    console.log(`Realtime update processed in ${new Date() - timestamp} ms: posted ${count} new versioned Connections`);
    if (failed > 0) console.error(`Failed on posting ${failed} Connections!`);
    console.log('/-----------------------------------------------/');
    // Return this mostly for testing
    return { count, failed };
}