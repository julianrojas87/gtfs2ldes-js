import fs from "fs";
import path from "path";
import del from "del";
import Utils from "./Utils.js";
import { Connections } from 'gtfs2lc';
import JsonLParser from "stream-json/jsonl/Parser.js";
import { RDFFormatter } from "./RDFFormatter.js";

export const processGTFS = config => {
    return new Promise(async (resolve, reject) => {
        console.log('/******************************************/');
        try {
            const timestamp = new Date();
            const dataFolder = path.resolve(config["general"].data_folder || "./data");
            const templates = config["uri_templates"];
            const jsonldContext = config["@context"];
            const target = config["general"].target_url;
            const throttleRate = config["general"].throttle_rate;

            console.log('Starting processing of GTFS source');
            // Download and decompress GTFS source
            const source = config["gtfs"].source;
            let stream = null;
            // Check if this is a URL or a local file
            if (source.startsWith("http")) {
                stream = await Utils.download(source, config["gtfs"].auth_headers || []);
            } else {
                stream = fs.createReadStream(source);
            }
            await Utils.unzip(stream, dataFolder);
            console.log('GTFS source downloaded and extracted successfully');

            // Start Linked Connection generation process
            new Connections({ format: "jsonld", store: "LevelStore", baseUris: templates })
                .resultStream(dataFolder, dataFolder, async rawConns => {
                    const connsStream = fs.createReadStream(rawConns, 'utf-8')
                        .pipe(JsonLParser.parser())
                        .pipe(RDFFormatter(jsonldContext, timestamp.toISOString()));

                    // POST every connection to the LDES Server ingestion endpoint
                    let count = 0;
                    let failed = 0;
                    // Throttle HTTP requests to avoid timeouts
                    let chunk = [];
                    for await (const conn of connsStream) {
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

                    console.log(`Process completed in ${new Date() - timestamp} ms: posted ${count} new versioned Connections`);
                    if (failed > 0) console.error(`Failed on posting ${failed} Connections!`);

                    // Clean up
                    await del([
                        `${dataFolder}/linkedConnections.json`
                    ], { force: true });
                    console.log('/******************************************/');
                    // Return this mostly for testing
                    resolve({ count, failed });
                });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}